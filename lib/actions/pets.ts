"use server";

import { getSession } from "../auth";
import { feedPet, getAllPets, getActivePet, setActivePet } from "../pets";
import type { ActionResult } from "./types";
import type { PetItem } from "../types";

export async function getPetsAction(): Promise<{ active: PetItem | null; all: PetItem[] } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  const [active, all] = await Promise.all([getActivePet(session.email), getAllPets(session.email)]);
  return { active, all };
}

export async function setActivePetAction(petId: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  await setActivePet(session.email, petId);
  return { message: "ok" };
}

export async function feedPetAction(petId: number): Promise<{ message: string; pet: PetItem } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sesi berakhir. Silakan login kembali." };
  try {
    return await feedPet(session.email, petId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memberi makan." };
  }
}
