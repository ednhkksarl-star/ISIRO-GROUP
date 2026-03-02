import type { EntityCode } from '@/types/database.types';

export const ENTITIES: Record<EntityCode, { code: EntityCode; name: string }> = {
  CBI: { code: 'CBI', name: 'CBI' },
  CEMC: { code: 'CEMC', name: 'CEMC' },
  ABS: { code: 'ABS', name: 'ABS' },
  ATSWAY: { code: 'ATSWAY', name: 'ATSWAY' },
  KWILU_SCOOPS: { code: 'KWILU_SCOOPS', name: 'KWILU SCOOPS' },
  JUDO: { code: 'JUDO', name: 'JUDO' },
};

export const ENTITY_CODES = Object.keys(ENTITIES) as EntityCode[];

