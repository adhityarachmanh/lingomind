import { db } from "./db";
import type { FeedItem, SearchUserRow } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatFeedDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mon = MONTHS[date.getMonth()];
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${dd} ${mon} ${date.getFullYear()}, ${hh}:${mm}`;
}

export function decideStreakMilestone(streak: number): boolean {
  return streak > 0 && streak % 7 === 0;
}

export async function logActivity(email: string, activityType: string, content: string): Promise<void> {
  await db.socialFeed.create({ data: { email, activityType, content } });
}

export async function getSocialFeed(email: string): Promise<FeedItem[]> {
  const following = await db.follower.findMany({ where: { followerEmail: email } });
  const followedEmails = following.map((f) => f.followedEmail);
  const feed = await db.socialFeed.findMany({
    where: { OR: [{ email }, { email: { in: followedEmails } }] },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const feedEmails = [...new Set(feed.map((f) => f.email))];
  const users = await db.user.findMany({ where: { email: { in: feedEmails } } });
  const userMap = new Map(users.map((u) => [u.email, u]));
  const pets = await db.userPet.findMany({ where: { email: { in: feedEmails }, isActive: true } });
  const petMap = new Map(pets.map((p) => [p.email, p]));
  const likes = await db.socialFeedLike.findMany({ where: { likerEmail: email } });
  const likedIds = new Set(likes.map((l) => l.feedId));

  return feed.map((f) => ({
    id: f.id,
    email: f.email,
    full_name: userMap.get(f.email)?.fullName ?? "",
    emoji: petMap.get(f.email) ? "🐾" : "👤",
    activity_type: f.activityType,
    content: f.content,
    likes_count: f.likesCount ?? 0,
    created_at: f.createdAt ? formatFeedDate(f.createdAt) : "",
    has_liked: likedIds.has(f.id),
  }));
}

export async function likeActivity(feedId: number, email: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const created = await tx.socialFeedLike.create({
      data: { feedId, likerEmail: email },
    }).catch(() => null);
    if (created) {
      await tx.socialFeed.update({ where: { id: feedId }, data: { likesCount: { increment: 1 } } });
    }
  });
}

export async function searchUsers(query: string, currentEmail: string): Promise<SearchUserRow[]> {
  const q = query.toLowerCase();
  const users = await db.user.findMany({
    where: {
      email: { not: currentEmail },
      OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }],
    },
    orderBy: { score: "desc" },
    take: 20,
  });
  const emails = users.map((u) => u.email);
  const [statsRows, follows] = await Promise.all([
    db.userEngagementStat.findMany({ where: { email: { in: emails } } }),
    db.follower.findMany({ where: { followerEmail: currentEmail, followedEmail: { in: emails } } }),
  ]);
  const statsMap = new Map(statsRows.map((s) => [s.email, s]));
  const followingSet = new Set(follows.map((f) => f.followedEmail));
  return users.map((u, i) => {
    const stats = statsMap.get(u.email);
    return {
      email: u.email, full_name: u.fullName ?? "", score: u.score ?? 0,
      current_streak: stats?.currentStreak ?? 0, total_quiz_completed: stats?.totalQuizCompleted ?? 0,
      active_frame: stats?.activeFrame ?? null, active_title: stats?.activeTitle ?? null,
      active_name_color: stats?.activeNameColor ?? null, rank: i + 1,
      is_following: followingSet.has(u.email),
    };
  });
}

export async function toggleFollow(followerEmail: string, followedEmail: string, follow: boolean): Promise<void> {
  if (follow) {
    await db.follower.create({ data: { followerEmail, followedEmail } }).catch(() => {});
  } else {
    await db.follower.deleteMany({ where: { followerEmail, followedEmail } });
  }
}
