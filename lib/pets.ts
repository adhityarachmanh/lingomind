import { db } from "./db";
import type { PetItem } from "./types";

export function computePetStage(exp: number): 1 | 2 | 3 | 4 {
  if (exp < 100) return 1;
  if (exp < 300) return 2;
  if (exp < 1000) return 3;
  return 4;
}

export function feedPetProgress(stage: number, exp: number, gain = 50): { stage: number; exp: number } {
  let newExp = exp + gain;
  let newStage = stage;
  while (newStage < 4) {
    const threshold = newStage === 1 ? 100 : newStage === 2 ? 300 : 1000;
    if (newExp < threshold) break;
    newExp -= threshold;
    newStage += 1;
  }
  return { stage: newStage, exp: newExp };
}

const PET_TABLE: Record<string, { emojis: string[]; labels: string[] }> = {
  dragon: {
    emojis: ["🥚", "🦎", "🦖", "🐉"],
    labels: ["Telur Naga", "Bayi Naga Api", "Naga Remaja", "Naga Raksasa"],
  },
  owl: {
    emojis: ["🥚", "🐣", "🐥", "🦉"],
    labels: ["Telur Burung", "Anak Burung", "Burung Kecil", "Burung Malam"],
  },
  fenrir: {
    emojis: ["🥚", "🐾", "🐕", "🐺"],
    labels: ["Telur Serigala", "Anak Serigala", "Serigala Muda", "Serigala Es"],
  },
};

export function petEmojiLabel(petType: string, stage: number): { emoji: string; label: string } {
  const table = PET_TABLE[petType];
  const idx = Math.min(Math.max(stage, 1), 4) - 1;
  if (!table) return { emoji: "🥚", label: "Telur Misterius" };
  return { emoji: table.emojis[idx], label: table.labels[idx] };
}

function toPetItem(p: { id: number; petType: string; stage: number | null; exp: number | null; isActive: boolean | null }): PetItem {
  const stage = p.stage ?? 1;
  const exp = p.exp ?? 0;
  const { emoji, label } = petEmojiLabel(p.petType, stage);
  return {
    id: p.id, pet_type: p.petType, stage, exp,
    emoji, label, is_active: p.isActive ?? false,
  };
}

export async function getActivePet(email: string): Promise<PetItem | null> {
  const pet = await db.userPet.findFirst({ where: { email, isActive: true } });
  return pet ? toPetItem(pet) : null;
}

export async function getAllPets(email: string): Promise<PetItem[]> {
  const pets = await db.userPet.findMany({ where: { email }, orderBy: { id: "asc" } });
  return pets.map(toPetItem);
}

export async function setActivePet(email: string, petId: number): Promise<void> {
  await db.$transaction([
    db.userPet.updateMany({ where: { email }, data: { isActive: false } }),
    db.userPet.updateMany({ where: { id: petId, email }, data: { isActive: true } }),
  ]);
}

export async function feedPet(email: string, petId: number): Promise<{ message: string; pet: PetItem }> {
  const stats = await db.userEngagementStat.findUnique({ where: { email } });
  if (!stats) throw new Error("User stats tidak ditemukan.");
  if (stats.coins < 50) throw new Error("Koin tidak cukup! Butuh 50 Koin.");

  const pet = await db.userPet.findFirst({ where: { id: petId, email } });
  if (!pet) throw new Error("Peliharaan tidak ditemukan!");

  const next = feedPetProgress(pet.stage ?? 1, pet.exp ?? 0);
  const updated = await db.$transaction([
    db.userEngagementStat.update({ where: { email }, data: { coins: { decrement: 50 } } }),
    db.userPet.update({ where: { id: petId }, data: { stage: next.stage, exp: next.exp } }),
  ]);
  const fresh = updated[1];
  return { message: "Nyam nyam! Peliharaanmu senang.", pet: toPetItem(fresh) };
}
