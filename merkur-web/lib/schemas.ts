import { z } from 'zod'

export const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
  parent_id: z.string().uuid().nullable().optional(),
})

export const updateFolderSchema = z.object({
  id: z.string().uuid('Invalid folder ID'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or fewer'),
})

export const deleteFolderSchema = z.object({
  id: z.string().uuid('Invalid folder ID'),
})

export const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(60, 'Title must be 60 characters or fewer').optional(),
  folder_id: z.string().uuid().nullable().optional(),
})

export const updateNoteSchema = z.object({
  id: z.string().uuid('Invalid note ID'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(60, 'Title must be 60 characters or fewer')
    .optional(),
  content: z.string().optional(),
  folder_id: z.string().uuid().nullable().optional(),
})

export const deleteNoteSchema = z.object({
  id: z.string().uuid('Invalid note ID'),
})
