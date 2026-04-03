export type Folder = {
  id: string
  name: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export type Note = {
  id: string
  title: string
  content: string | null
  folder_id: string | null
  source: 'web' | 'whatsapp'
  is_cleaned: boolean
  created_at: string
  updated_at: string
}
