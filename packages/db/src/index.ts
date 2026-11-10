export { prisma } from './client';
export * from './posts';
export * from './collections';
export type {
  Collection,
  Post,
  Snapshot,
  Platform,
  TrackingStatus,
  SnapshotSource,
} from '@prisma/client';
