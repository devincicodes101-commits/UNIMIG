import React from 'react'

const Footer: React.FC = () => {
  return (
    <footer className="w-fit p-3 md:p-4 fixed bottom-0 right-0 hidden lg:block pointer-events-none select-none">
      <div className="flex items-center gap-2 text-xs text-muted-foreground/50 font-medium tracking-wider uppercase">
        <span className="w-1 h-1 rounded-full bg-[hsl(var(--unimig-green))]" />
        {/* UNIMIG AI &middot; By Devinci Codes */}
      </div>
    </footer>
  )
}

export default Footer
