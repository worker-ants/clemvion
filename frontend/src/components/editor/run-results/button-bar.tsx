import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ArrowRight, ExternalLink } from "lucide-react";

interface ButtonDef {
  id: string;
  label: string;
  type: "link" | "port";
  url?: string;
  style?: "primary" | "secondary" | "outline" | "danger";
}

interface ButtonBarProps {
  buttons: ButtonDef[];
  onPortButtonClick: (buttonId: string) => void;
  onLinkButtonClick: (url: string) => void;
  onContinueClick: () => void;
  disabled?: boolean;
}

const STYLE_CLASSES: Record<string, string> = {
  primary:
    "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90",
  secondary:
    "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80",
  outline:
    "border border-[hsl(var(--input))] bg-transparent hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ButtonBar({
  buttons,
  onPortButtonClick,
  onLinkButtonClick,
  onContinueClick,
  disabled = false,
}: ButtonBarProps) {
  const [clicked, setClicked] = useState<{
    buttonId: string;
    label: string;
    at: string;
  } | null>(null);

  const hasOnlyLinkButtons = useMemo(
    () => buttons.length > 0 && buttons.every((b) => b.type === "link"),
    [buttons],
  );

  const handleClick = useCallback(
    (btn: ButtonDef) => {
      if (disabled || clicked) return;

      if (btn.type === "link") {
        if (btn.url && isSafeUrl(btn.url)) {
          onLinkButtonClick(btn.url);
        }
        return;
      }

      setClicked({
        buttonId: btn.id,
        label: btn.label,
        at: new Date().toISOString(),
      });
      onPortButtonClick(btn.id);
    },
    [disabled, clicked, onPortButtonClick, onLinkButtonClick],
  );

  const handleContinue = useCallback(() => {
    if (disabled || clicked) return;
    setClicked({
      buttonId: "__continue__",
      label: "Continue",
      at: new Date().toISOString(),
    });
    onContinueClick();
  }, [disabled, clicked, onContinueClick]);

  if (clicked) {
    return (
      <div className="mt-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Button clicked: <span className="font-medium text-[hsl(var(--foreground))]">{clicked.label}</span>
        </p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">
          {new Date(clicked.at).toLocaleTimeString()}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {buttons.map((btn) => (
          <Button
            key={btn.id}
            variant="ghost"
            size="sm"
            disabled={disabled || (btn.type === "link" && (!btn.url || !isSafeUrl(btn.url)))}
            className={cn(
              "h-7 text-xs gap-1.5",
              STYLE_CLASSES[btn.style ?? "secondary"],
              disabled && "opacity-50 cursor-not-allowed",
            )}
            onClick={() => handleClick(btn)}
          >
            {btn.label || "Button"}
            {btn.type === "link" && <ExternalLink size={10} />}
          </Button>
        ))}

        {hasOnlyLinkButtons && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={disabled}
            onClick={handleContinue}
          >
            Continue <ArrowRight size={10} />
          </Button>
        )}
      </div>
    </div>
  );
}
