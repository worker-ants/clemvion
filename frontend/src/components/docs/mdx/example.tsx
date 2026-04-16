export function Example({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="my-4 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.3]">
      {title && (
        <figcaption className="border-b border-[hsl(var(--border))] px-3 py-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
          {title}
        </figcaption>
      )}
      <div className="[&_pre]:!my-0 [&_pre]:!rounded-none [&_pre]:!border-0">
        {children}
      </div>
    </figure>
  );
}
