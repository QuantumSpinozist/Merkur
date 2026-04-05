import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'md'
}

export default function Button({ children, size = 'md', className = '', ...props }: Props) {
  const sizeClasses = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-2 text-sm'
  return (
    <button
      className={`${sizeClasses} bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
