import type { ReactNode } from 'react'
export const Link = ({ to, className, children }: { to: string; className?: string; children: ReactNode }) => <a href={'#/' + to} className={className}>{children}</a>
