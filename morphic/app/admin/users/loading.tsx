export default function UsersLoading() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] w-full px-6">
      <div className="flex flex-col items-center gap-5 animate-in fade-in duration-300">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-2 border-border" />
          <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-transparent border-t-foreground animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Loading Users
          </p>
          <p className="text-sm text-muted-foreground/80">
            Fetching team members…
          </p>
        </div>
      </div>
    </div>
  );
}
