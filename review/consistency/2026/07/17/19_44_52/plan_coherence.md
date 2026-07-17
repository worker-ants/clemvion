# Plan 정합성 검토 — `plan/in-progress/spec-draft-frontend-layering.md`

## 검토 범위 및 방법

- target: `plan/in-progress/spec-draft-frontend-layering.md` (D1/D2/D3 결정 + 구현 위임)
- `plan/in-progress/**` 전체 24개 문서(서브폴더 `node-output-redesign/` 3개 포함)를 대상으로
  `src/lib`, `src/components`, `src/types`, `eslint.config.mjs`, `@/components`, `@/lib`,
  `레이어`/`layering`, `spec/conventions`, `codebase/frontend` 키워드로 교차 검색.
- target 이 인용하는 선행 코드 리뷰 `review/code/2026/07/17/17_29_21/{SUMMARY,RESOLUTION}.md` 원문 대조.
- 실측 확인: `git log` (PR #967/#969 반영 여부), 현재 `codebase/frontend/eslint.config.mjs` 스코프
  (`files: ["src/lib/**"]`, `src/types/**` 미포함 — target D2 전제와 일치), `spec/conventions/` 에
  `frontend-layering.md` 부재(target 의 "신설" 전제와 일치).

## 발견사항

- **[INFO]** D2 구현 위임이 손댈 파일에 이미 계류 중인 테스트 견고성 결함(W#1~#3)이 교차 언급되지 않음
  - target 위치: `## 구현 위임` 절 ("가드 테스트(`eslint-layering-guard.test.ts`)도 스코프 확장을 함께 반영해야 한다")
  - 관련 plan: 전용 `plan/in-progress/*` 파일 없음 — `review/code/2026/07/17/17_29_21/RESOLUTION.md` `## 후속 항목` ("W#1·W#2·W#3 (테스트 견고성 + 정규식 상수화) → 한 후속 작업으로 묶어 처리 권장")
  - 상세: 같은 코드 리뷰 세션이 defer 한 W#1(override 무력화 미탐지)·W#2(bare import 회귀 케이스 부재)·W#3(정규식 중복)은 정확히 target 이 "developer 후속 PR" 로 넘기는 동일 파일(`codebase/frontend/eslint.config.mjs`, `src/lib/__tests__/eslint-layering-guard.test.ts`)을 대상으로 한다. 이 defer 항목은 어떤 `plan/in-progress/*.md` 에도 등재되지 않고 RESOLUTION.md 안에만 "권장" 형태로 남아 있어, target 의 "구현 위임" 절만 보고 후속 PR 에 착수하는 developer 가 이 계류 항목의 존재를 놓칠 수 있다. 결정 충돌은 아니며(W#1~#3 은 코드 조직·테스트 커버리지 문제로 D1/D2/D3 어떤 결정과도 상충하지 않음), 두 작업이 동일 파일·동일 정규식(`COMPONENTS_PATH_RE` 후보)을 다루므로 한 PR 로 묶으면 diff 충돌·중복 수정을 피할 수 있다.
  - 제안: target 의 "구현 위임" 절에 한 줄 추가 — "`eslint-layering-guard.test.ts` 스코프 확장 시 `review/code/2026/07/17/17_29_21/RESOLUTION.md` 의 W#1~#3(override 병합 의미론 테스트·bare import 케이스·정규식 상수화)를 함께 처리하는 것을 권장" 정도로 충분하며, 별도 `plan/in-progress/*.md` 신설은 불필요한 규모(이미 RESOLUTION.md 가 추적 중).

## 확인했으나 문제 없음 (참고)

- **미해결 결정과의 충돌**: `plan/in-progress/**` 전체에서 `src/lib`/`src/components`/`src/types`/ESLint 레이어 경계를 다루는 문서는 target 자신뿐. 타 plan(예: `ai-agent-tool-connection-rewrite.md`, `marketplace-and-plugin-sdk.md`, `node-output-redesign/*`)이 `codebase/frontend/**` 를 언급하는 곳은 모두 `content/`(MDX 매뉴얼) 또는 기존 컴포넌트 파일 경로 인용뿐이며, D3 이 명시적으로 범위 밖으로 둔 `content/`(94, MDX)와 겹치므로 충돌 없음.
- **선행 plan 미해소**: target 이 전제하는 두 사실 — (a) `src/lib → @/components` 가드가 이미 강제 중(PR #967/#969, `099f63cc` 기준 merge 확인), (b) `spec/conventions/frontend-layering.md` 미존재 — 둘 다 실측으로 재확인됨. target 이 위임 대상으로 지목한 W#4/W#5 는 `RESOLUTION.md` 가 정확히 "project-planner 위임"으로 defer 한 항목과 1:1 일치하여 선행 조건 결손 없음.
- **후속 항목 누락(다른 plan 무효화)**: `node-output-redesign/ai-agent.md:213` 이 `codebase/frontend/src/lib/websocket/use-execution-events.ts` 를 인용하지만 이는 `nodeType`/`conversationMessages` 게이트 로직 서술이며 `@/components` import 를 다루지 않아 D1~D3 결정으로 무효화되지 않음. `eia-context-schema-followups.md` 의 packages harness 배선(`expression-engine`/`graph-warning-rules`/`node-summary`/`chat-channel-validation`) 은 `codebase/frontend` 가 아닌 `codebase/packages/*` 대상이라 target 스코프와 무관.

## 요약

target(`spec-draft-frontend-layering.md`)의 D1(레이어 순서 명문화)·D2(가드 스코프를 `src/types/**` 로 확장)·D3(`src/app` 제외) 결정은 `plan/in-progress/**` 전 24개 문서 어디의 미해결 결정과도 충돌하지 않고, 전제(가드 기존 강제·spec 문서 부재)도 실측과 일치하며, 다른 plan 의 후속 항목을 무효화하지도 않는다. 유일한 관찰은 target 이 위임하는 developer 후속 PR 이 손댈 파일에 이미 같은 코드 리뷰 세션이 defer 한 테스트 견고성 결함(W#1~#3)이 RESOLUTION.md 에만 기록돼 있고 target 구현 위임 절에서 교차 언급되지 않는다는 점으로, 사소한 추적성 개선 여지(INFO)에 그친다.

## 위험도
LOW
