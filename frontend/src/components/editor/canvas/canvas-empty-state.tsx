"use client";

import { ArrowRight, MousePointer2, Plug2, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DOCS } from "@/lib/docs/links";

const STEPS = [
  {
    icon: MousePointer2,
    title: "팔레트에서 다음 노드를 드래그해요",
    description: "좌측 팔레트에서 원하는 노드를 캔버스로 끌어와 트리거 옆에 놓아요.",
    href: DOCS.nodes.overview,
  },
  {
    icon: Plug2,
    title: "트리거 출력 포트에 연결해요",
    description: "트리거 노드의 출력 포트에서 선을 끌어 새 노드의 입력 포트에 이어요.",
    href: DOCS.gettingStarted.uiTour,
  },
  {
    icon: Play,
    title: "실행해서 결과를 확인해요",
    description: "상단의 Run 버튼으로 워크플로우를 실행하고 결과를 확인해요.",
    href: DOCS.runAndDebug.runningAWorkflow,
  },
];

interface Props {
  visible: boolean;
}

/**
 * 빈 캔버스 시작 가이드 카드.
 * 페이드인/아웃은 CSS 트랜지션으로만 처리해요. visible=false 상태에서는 `opacity-0 +
 * pointer-events-none + aria-hidden`으로 완전히 숨겨요. DOM은 유지되지만 접근성·상호작용에서
 * 제외되므로 사용자 관점에서는 사라진 것과 동일해요.
 *
 * 표시 기준은 "트리거 외 노드가 없는 워크플로우" 로, 기본 주입된 trigger만 있는 초기 상태에서도
 * 동일하게 나타나요 (lib/node-definitions/is-trigger.ts의 isWorkflowEmpty 참조).
 */
export function CanvasEmptyState({ visible }: Props) {
  return (
    <section
      role="region"
      aria-label="시작하기"
      aria-hidden={!visible}
      data-visible={visible ? "true" : "false"}
      className={cn(
        "w-[340px] max-w-[90vw] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-lg transition-opacity duration-300",
        visible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0",
      )}
    >
      <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
        워크플로우를 이어서 완성해봐요
      </h2>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
        트리거 다음에 이어 붙일 노드를 추가하면 워크플로우가 완성돼요.
      </p>
      <ol className="mt-4 space-y-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="flex items-start gap-3 text-sm"
            >
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))] text-xs font-semibold text-[hsl(var(--muted-foreground))]"
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <Icon
                    size={14}
                    className="text-[hsl(var(--muted-foreground))]"
                    aria-hidden="true"
                  />
                  {step.title}
                </div>
                <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                  {step.description}{" "}
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={visible ? 0 : -1}
                    className="text-[hsl(var(--primary))] underline-offset-2 hover:underline"
                  >
                    자세히
                  </a>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex items-center justify-end">
        <a
          href={DOCS.gettingStarted.firstWorkflow}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={visible ? 0 : -1}
          className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--primary-foreground))] hover:opacity-90"
        >
          시작 가이드 열기
          <ArrowRight size={12} />
        </a>
      </div>
    </section>
  );
}
