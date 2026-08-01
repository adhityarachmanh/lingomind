"use server";

import { getSession } from "../auth";
import { getSocialFeed, likeActivity } from "../social";
import type { ActionResult } from "./types";
import type { FeedItem } from "../types";

export async function getSocialFeedAction(): Promise<{ feed: FeedItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  return { feed: await getSocialFeed(session.email) };
}

export async function likeActivityAction(feedId: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await likeActivity(feedId, session.email);
  return { message: "ok" };
}
