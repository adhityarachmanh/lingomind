import { db } from "./db";
import type { ShopItem } from "./types";

export type ShopMysteryOutcome =
  | { kind: "zonk"; coins: number; message: string }
  | { kind: "double_xp"; message: string }
  | { kind: "streak_freeze"; message: string }
  | { kind: "jackpot"; coins: number; message: string };

export function decideShopMysteryRoll(roll: number): ShopMysteryOutcome {
  if (roll <= 40) return { kind: "zonk", coins: 10, message: "Mystery Box: Zonk! Kamu dapat kembalian 10 koin." };
  if (roll <= 75) return { kind: "double_xp", message: "Mystery Box: Hoki! Kamu dapat efek Double XP 1 Jam!" };
  if (roll <= 95) return { kind: "streak_freeze", message: "Mystery Box: Mantap! Kamu dapat 1 Streak Freeze!" };
  return { kind: "jackpot", coins: 100, message: "Mystery Box: JACKPOT! 🎉 Kamu dapat 100 koin!" };
}

export type StreakRepairOutcome =
  | { action: "none"; message: string }
  | { action: "restore"; currentStreak: number; lastActiveDate: Date; message: string };

export function decideStreakRepair(input: {
  lastActiveDate: Date | null;
  currentStreak: number;
  previousStreak: number;
  now: Date;
}): StreakRepairOutcome {
  const { lastActiveDate, currentStreak, previousStreak, now } = input;
  if (!lastActiveDate) return { action: "none", message: "Anda belum memiliki riwayat belajar." };

  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((day(now) - day(lastActiveDate)) / 86400000);

  if (diff <= 1) return { action: "none", message: "Streak Anda masih aktif hari ini. Lakukan 1 kuis untuk mempertahankannya!" };
  if (diff >= 2) {
    const restored = previousStreak + 1;
    const lastActive = new Date(day(now) - 86400000);
    return { action: "restore", currentStreak: restored, lastActiveDate: lastActive, message: "Streak Anda berhasil dipulihkan!" };
  }
  return { action: "none", message: "Streak Anda belum hangus." };
}

export async function getShopItems(email: string): Promise<(ShopItem & { is_owned: boolean })[]> {
  const items = await db.shopItem.findMany({ orderBy: { cost: "asc" } });
  const owned = await db.userInventory.findMany({ where: { email } });
  const ownedTypes = new Set(owned.map((o) => o.itemType));
  return items.map((i) => ({
    id: i.id, name: i.name, description: i.description, cost: i.cost,
    effect_type: i.effectType, icon_name: i.iconName,
    is_owned: ownedTypes.has(i.effectType),
  }));
}

export async function buyItem(email: string, itemId: number): Promise<string> {
  const item = await db.shopItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Item tidak ditemukan.");

  let stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) {
    stats = await db.userEngagementStat.create({ data: { email, coins: 0, currentStreak: 0, streakFreezes: 0 } });
  }
  if (stats.coins < item.cost) throw new Error(`Koin tidak cukup (butuh ${item.cost}).`);

  const defaultMessage = `Berhasil membeli ${item.name}!`;
  const now = new Date();

  return db.$transaction(async (tx) => {
    await tx.userEngagementStat.update({ where: { email }, data: { coins: { decrement: item.cost } } });

    switch (item.effectType) {
      case "streak_freeze": {
        await tx.userEngagementStat.update({ where: { email }, data: { streakFreezes: { increment: 1 } } });
        return defaultMessage;
      }
      case "streak_repair": {
        const s = await tx.userEngagementStat.findUnique({ where: { email } });
        if (!s) return defaultMessage;
        const repair = decideStreakRepair({
          lastActiveDate: s.lastActiveDate, currentStreak: s.currentStreak, previousStreak: s.previousStreak, now,
        });
        if (repair.action === "restore") {
          await tx.userEngagementStat.update({
            where: { email },
            data: { currentStreak: repair.currentStreak, lastActiveDate: repair.lastActiveDate },
          });
        }
        return repair.message;
      }
      case "double_xp": {
        await tx.userEngagementStat.update({ where: { email }, data: { doubleXpUntil: new Date(now.getTime() + 24 * 3600000) } });
        return defaultMessage;
      }
      case "exam_retake": {
        await tx.userEngagementStat.update({ where: { email }, data: { examRetakeTickets: { increment: 1 } } });
        return defaultMessage;
      }
      case "weekend_amulet": {
        await tx.userEngagementStat.update({ where: { email }, data: { hasWeekendAmulet: true } });
        return defaultMessage;
      }
      case "mystery_box": {
        const roll = Math.floor(Math.random() * 100) + 1;
        const outcome = decideShopMysteryRoll(roll);
        if (outcome.kind === "zonk") await tx.userEngagementStat.update({ where: { email }, data: { coins: { increment: outcome.coins } } });
        else if (outcome.kind === "double_xp") await tx.userEngagementStat.update({ where: { email }, data: { doubleXpUntil: new Date(now.getTime() + 3600000) } });
        else if (outcome.kind === "streak_freeze") await tx.userEngagementStat.update({ where: { email }, data: { streakFreezes: { increment: 1 } } });
        else await tx.userEngagementStat.update({ where: { email }, data: { coins: { increment: outcome.coins } } });
        return outcome.message;
      }
      default: {
        if (item.effectType.startsWith("profile_frame_")) {
          const frameValue = item.effectType.replace("profile_frame_", ""); // gold/diamond/mythic
          const dup = await tx.userInventory.findFirst({ where: { email, itemType: item.effectType, itemValue: frameValue } });
          if (dup) throw new Error("Anda sudah memiliki bingkai ini!");
          await tx.userInventory.create({ data: { email, itemType: item.effectType, itemValue: frameValue } });
          await tx.userEngagementStat.update({ where: { email }, data: { activeFrame: frameValue } });
          return defaultMessage;
        }
        if (item.effectType.startsWith("title_")) {
          const titleValue = item.effectType.replace("title_", "");
          const dup = await tx.userInventory.findFirst({ where: { email, itemType: item.effectType, itemValue: titleValue } });
          if (dup) throw new Error("Anda sudah memiliki gelar ini!");
          await tx.userInventory.create({ data: { email, itemType: item.effectType, itemValue: titleValue } });
          await tx.userEngagementStat.update({ where: { email }, data: { activeTitle: titleValue } });
          return defaultMessage;
        }
        if (item.effectType.startsWith("name_color_")) {
          const colorValue = item.effectType.replace("name_color_", "");
          const dup = await tx.userInventory.findFirst({ where: { email, itemType: item.effectType, itemValue: colorValue } });
          if (dup) throw new Error("Anda sudah memiliki warna ini!");
          await tx.userInventory.create({ data: { email, itemType: item.effectType, itemValue: colorValue } });
          await tx.userEngagementStat.update({ where: { email }, data: { activeNameColor: colorValue } });
          return defaultMessage;
        }
        if (item.effectType.startsWith("egg_")) {
          const petType = item.effectType.replace("egg_", "");
          const dup = await tx.userPet.findFirst({ where: { email, petType } });
          if (dup) throw new Error("Anda sudah memiliki jenis peliharaan ini!");
          const activeCount = await tx.userPet.count({ where: { email, isActive: true } });
          await tx.userPet.create({ data: { email, petType, stage: 1, exp: 0, isActive: activeCount === 0 } });
          await tx.socialFeed.create({ data: { email, activityType: "pet_hatched", content: `Baru saja menetaskan ${item.name}!` } }).catch(() => {});
          return defaultMessage;
        }
        return defaultMessage;
      }
    }
  });
}

export async function refillHearts(email: string): Promise<{ hearts: number }> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) throw new Error("Data user tidak ditemukan.");
  if (stats.hearts >= 5) throw new Error("Nyawa sudah penuh!");
  const missing = 5 - stats.hearts;
  const cost = missing * 60;
  if (stats.coins < cost) throw new Error(`Koin tidak cukup! Butuh ${cost} Koin.`);
  await db.userEngagementStat.update({
    where: { email },
    data: { coins: { decrement: cost }, hearts: 5, lastHeartRefill: null },
  });
  return { hearts: 5 };
}
