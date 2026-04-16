export function Steps({ children }: { children: React.ReactNode }) {
  return (
    <ol className="my-4 ml-6 list-decimal space-y-3 text-sm marker:text-[hsl(var(--muted-foreground))]">
      {children}
    </ol>
  );
}

export function Step({ children }: { children: React.ReactNode }) {
  return <li className="pl-1">{children}</li>;
}
