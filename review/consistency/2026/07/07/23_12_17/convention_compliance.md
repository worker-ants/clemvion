# 정식 규약 준수 검토 — spec/3-workflow-editor/0-canvas.md

## 검토 범위 확인

- target: `spec/3-workflow-editor/0-canvas.md`
- 구현 변경 사항(diff): `codebase/frontend/src/components/editor/canvas/zoom-controls.tsx` — `Panel` 에
  `rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 shadow-sm` className 추가
  (미니맵과 시각적 톤을 맞추기 위한 순수 스타일링 변경, 새 식별자·API·이벤트 페이로드·에러코드 없음).
- `spec/conventions/**` 18개 파일(+ cafe24/makeshop API 카탈로그 하위 트리)을 모두 열람해 위 diff·target
  문서와 교차 관련성을 확인했다. 각 파일 검토 결과는 아래 발견사항 절 참조.

## 발견사항

이번 diff·target 범위에서 `spec/conventions/**` 위반은 발견되지 않았다.

- diff 는 Tailwind className 3개 토큰(`border`/`bg`/`shadow-sm` 계열) 추가뿐이며, 신규 식별자·API endpoint·
  이벤트 페이로드·에러 코드·감사 액션(`AUDIT_ACTIONS`)·DTO 등 conventions 가 규율하는 어떤 표면도 새로 만들지
  않는다. `spec/conventions/audit-actions.md`(명명 시제) · `cafe24-api-catalog/**`(API 카탈로그 표 동기) ·
  `swagger.md`(API 문서 데코레이터) 등은 대상 도메인이 달라 적용되지 않는다. 프론트엔드 컴포넌트의 Tailwind
  className/디자인 토큰 사용 패턴을 규율하는 conventions 문서는 현재 레포에 존재하지 않는다(별도 확인:
  `grep -rli "className\|Tailwind\|디자인 토큰" spec/conventions/*.md` → 0건).
- target 문서 frontmatter(`id: canvas` / `status: partial` / `code:` / `pending_plans:`)는
  `spec/conventions/spec-impl-evidence.md` §2 스키마와 부합한다 — `status: partial` 에 `pending_plans:` 2건
  (`plan/in-progress/ai-agent-tool-connection-rewrite.md`, `plan/in-progress/spec-sync-canvas-gaps.md`)이
  실제로 존재하며(§2.1 의무 필드 충족), `code:` 글로브도 ≥1 파일에 매치한다.
- 파일명 `0-canvas.md` 의 `0-` prefix 는 CLAUDE.md 가 규정하는 루트 `spec/0-overview.md` 전용 컨벤션이 아니라,
  같은 영역(`spec/3-workflow-editor/`) 안에서 형제 문서(`1-node-common.md`~`5-version-history.md`)와 동일한
  **영역 내부 순번 매김** 관례다 — `spec/2-navigation/`·`spec/4-nodes/` 등 다른 영역도 동일 패턴(`0-대시보드.md`,
  `0-overview.md` 등)을 쓰므로 위반이 아니라 기존 하우스 스타일과 일치한다.
- 문서 구조(Overview/본문/Rationale 3섹션)는 target 이 별도 `## Overview` 헤딩 없이 `> 관련 문서:` 줄 이후
  바로 번호 섹션(§1~§12)으로 들어가고 말미에 `## Rationale` 을 둔다. 이는 동일 영역의 형제 문서
  (`1-node-common.md`, `2-edge.md` 등) 모두가 따르는 기존 패턴이며, 이번 diff 로 새로 도입되거나 악화된
  구조가 아니다 — 신규 위반으로 보고하지 않는다(참고용 INFO 성격이나 target-specific 변경이 아니므로 본 표에서도
  생략).
- `spec/conventions/spec-impl-evidence.md` §4.2 의 area-index 가드 관점에서도, `spec/3-workflow-editor/_product-overview.md`
  가 `0-canvas.md` 를 링크하고 있어 sibling-index 요건을 충족한다.

## 요약

이번 검토 대상(diff: `zoom-controls.tsx` 의 배경/테두리/그림자 className 추가, target: `spec/3-workflow-editor/0-canvas.md`)은
`spec/conventions/**` 가 규율하는 명명·출력 포맷·API 문서·금지 패턴 중 어느 것도 건드리지 않는 순수 시각 스타일링
변경이다. target 문서의 frontmatter·파일명 순번·구조는 기존 영역 하우스 스타일과 일치하며 신규 위반이 없다.
conventions 관점에서 이 변경을 차단하거나 conventions 갱신을 요구할 사유는 없다.

## 위험도

NONE
