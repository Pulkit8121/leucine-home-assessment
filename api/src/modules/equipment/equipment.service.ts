import type { Equipment, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { ApiError } from '../../lib/errors.js';
import type {
  CreateEquipmentInput,
  ListEquipmentQuery,
  UpdateEquipmentInput,
} from './equipment.schemas.js';

/**
 * The equipment list is small and bounded (a plant has tens, not millions, of assets),
 * so it is returned unpaginated on purpose; the cleaning records underneath it are the
 * unbounded collection and those are paginated.
 */
export async function listEquipment(query: ListEquipmentQuery): Promise<Equipment[]> {
  const where: Prisma.EquipmentWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  return prisma.equipment.findMany({ where, orderBy: { code: 'asc' } });
}

export async function getEquipment(id: string): Promise<Equipment> {
  const equipment = await prisma.equipment.findUnique({ where: { id } });
  if (!equipment) throw ApiError.notFound('Equipment not found');
  return equipment;
}

export async function createEquipment(input: CreateEquipmentInput): Promise<Equipment> {
  return prisma.equipment.create({ data: input });
}

export async function updateEquipment(id: string, input: UpdateEquipmentInput): Promise<Equipment> {
  await getEquipment(id);
  return prisma.equipment.update({ where: { id }, data: input });
}

export async function deleteEquipment(id: string): Promise<void> {
  await getEquipment(id);
  // Cleaning records (and their audit entries) cascade. In a real GxP system this
  // would be a soft delete / retirement instead — see NOTES.md.
  await prisma.equipment.delete({ where: { id } });
}
