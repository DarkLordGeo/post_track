import { z } from 'zod';

export const collectionNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(60, 'Name must be 60 characters or fewer');

export const createCollectionSchema = z.object({
  name: collectionNameSchema,
  description: z.string().trim().max(280).nullish(),
});

export const updateCollectionSchema = z
  .object({
    name: collectionNameSchema.optional(),
    description: z.string().trim().max(280).nullish(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, 'Nothing to update');

export const addPostsSchema = z.object({
  postIds: z.array(z.string().min(1).max(64)).min(1).max(200),
});
