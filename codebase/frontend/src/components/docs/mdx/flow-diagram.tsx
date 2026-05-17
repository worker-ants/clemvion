import { Fragment } from "react";
import { ArrowRight } from "lucide-react";

export interface FlowStep {
  title: string;
  sub?: string;
}

/**
 * 매뉴얼 본문에서 "A → B → C" 형태의 가로 흐름을 표현하는 다이어그램이에요.
 * 기존에 ASCII 박스로 그렸던 부분은 CJK 폭 불일치로 테두리가 어긋나므로 HTML/CSS 기반으로
 * 교체했어요. 박스마다 제목과 보조 설명을 받고, 박스 사이에는 화살표 아이콘이 들어가요.
 */
export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="my-4 overflow-x-auto">
      <div className="flex items-stretch gap-2">
        {steps.map((step, i) => (
          <Fragment key={`${step.title}-${i}`}>
            <div className="flex min-w-[140px] flex-1 flex-col items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))/0.3] px-4 py-3 text-center">
              <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                {step.title}
              </span>
              {step.sub && (
                <span className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  {step.sub}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex shrink-0 items-center text-[hsl(var(--muted-foreground))]"
                aria-hidden="true"
              >
                <ArrowRight size={18} />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
