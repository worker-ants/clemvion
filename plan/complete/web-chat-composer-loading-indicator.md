---
title: 웹채팅 컴포저 — AI 응답 중 전송버튼 로딩 스피너 + idle 중립 회색(흐린 비활성 개선)
worktree: webchat-composer-loading
started: 2026-06-27
owner: developer
status: complete
spec_impact: []
related_spec:
  - spec/7-channel-web-chat/1-widget-app.md
---

# 배경

라이브 테스트에서 전송 버튼이 **흐리게(비활성처럼)** 보여 "고장난 듯" 하다는 피드백.
재현/원인 확정:

- 컴포저(입력+전송버튼)는 `phase === "awaiting_user_message"` 일 때만 활성(`panel.tsx`).
  `booting`·`streaming`(= AI 처리 전·중 구간) 과 buttons/form 표면일 때 비활성(설계 §R6 — AI 처리
  중 자유 텍스트 입력 차단).
- 전송버튼 비활성 스타일이 **`opacity: .4`**(`styles.ts`) 라 보라색이 흐려져 "고장" 처럼 보임.
- 특히 AI 응답이 길면(보고 사례 durationMs 54160 = **54초**) 그 내내 흐린 비활성으로 노출 →
  "입력이 있을 때도 흐리다"는 체감의 정체. (awaiting 단계 + 텍스트 입력 시엔 보라색 활성이라 정상.)

사용자 선택: **"스트리밍 중 로딩 표시"** — 입력 차단(R6)은 유지하되 응답 중임을 명확히.

# 수정 (channel-web-chat 위젯, 외형/접근성만 — 동작 불변)

1. `components/composer.tsx`: `loading?: boolean` prop 추가. loading 시 전송버튼에 `↑` 대신
   스피너(`.wc-composer-spinner`) + `aria-busy="true"` + `aria-label="AI 응답 중"`.
2. `components/panel.tsx`: `loading={phase === "booting" || phase === "streaming"}` 전달.
   `disabled` 게이팅(§R6)은 그대로 유지.
3. `widget/styles.ts`:
   - `.wc-composer-send:disabled` 를 `opacity:.4`(흐린 반투명) → **중립 회색 `#c7cad1`** 로 변경
     (빈 입력·buttons/form 등 모든 idle 비활성에 적용, "고장" 인상 제거).
   - `.wc-composer-send[aria-busy="true"]:disabled` → 브랜드 컬러 `#5B4FE9` 유지(응답 중 = 활동 신호).
   - `.wc-composer-spinner` + `@keyframes wc-spin` 추가.

동작은 불변: AI 처리 중 입력 차단(R6) 유지, 활성 시 보라색 전송 그대로.

# 검증

- `pnpm test`(vitest) 215 pass — `panel.test.tsx` 에 스트리밍 로딩 표시 회귀 3건 추가
  (streaming→aria-busy·스피너·입력 비활성 유지 / booting→로딩 / awaiting→로딩 아님).
- `pnpm lint` clean, `pnpm build`(next, prod TS 포함) 성공.
- `pnpm typecheck`(tsc --noEmit) 의 유일한 실패는 `use-widget-eager-start.test.ts`(본 PR 미접촉,
  base 에서도 동일 — node v22 vs 요구 ≥24 의 lib.dom EventSource 타입 드리프트, prod 빌드 경로 밖).

# 관계

- 동일 라이브 테스트에서 보고된 "캐러셀이 render_carousel{...} 텍스트로 노출"(Problem 1)은 모델
  (gemma-4-26b-a4b)이 구조화 tool call 대신 본문 텍스트로 emit 한 **모델 capability 문제**로 판정
  (도구 스키마는 정상 전달 확인 — 모델이 maxItems/layout/itemButtons/titleField 등 스키마 전용 필드를
  재현). 사용자 결정: **보류**(모델 교체 후 재테스트). 본 PR 범위 아님.
