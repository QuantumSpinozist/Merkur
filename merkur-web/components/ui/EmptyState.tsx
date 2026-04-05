type Props = {
  title: string
  description?: string
}

export default function EmptyState({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <p className="text-lg font-medium text-stone-500">{title}</p>
      {description && <p className="text-sm text-stone-400 mt-1">{description}</p>}
    </div>
  )
}
