"use server";

import { getSession } from "../auth";
import { buyItem, getShopItems, refillHearts } from "../shop";
import { getEngagementStats } from "../dashboard";
import type { ActionResult } from "./types";
import type { ShopItem } from "../types";

export async function getShopAction(): Promise<{ items: (ShopItem & { is_owned: boolean })[]; coins: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const [items, stats] = await Promise.all([getShopItems(session.email), getEngagementStats(session.email)]);
  return { items, coins: stats?.coins ?? 0 };
}

export async function buyItemAction(itemId: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    const message = await buyItem(session.email, itemId);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal membeli item." };
  }
}

export async function refillHeartsAction(): Promise<{ hearts: number } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    return await refillHearts(session.email);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal isi ulang nyawa." };
  }
}
