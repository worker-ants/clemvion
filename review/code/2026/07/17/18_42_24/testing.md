STATUS=success testing review complete (2 files: 1 comment-only source diff, 1 plan-doc citation fix; 0 runtime code changes)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — output-shape.ts JSDoc 정정 + plan 인용 정정

## 범위 확인 (사실관계)

`git show --stat 3e84d2109` 로 실측: 이번 커밋은 `output-shape.ts` 23줄(+19/-6)과 plan md 1줄(±1)만 건드리며, **테스트 파일은 포함되지 않는다**. diff hunk(`@@ -112,15 +112,28 @@`)도 `isConversationOutput` 함수 **선언부 위 JSDoc 블록**에서 끝나고 함수 바디(`export function isConversationOutput(...) {`)는 한 글자도 바뀌지 않았다 — 커밋 메시지 자신의 "주석 전용 — 런타임 표면 없음" 서술과 diff 가 정확히 일치한다. 따라서 이 diff 자체에 대해 **새 테스트가 필요하지 않다** (동작 변경이 없으므로).

## 회귀 검증 (실측)

- `npx vitest run src/components/editor/run-results/__tests__/output-shape.test.ts` → **32/32 pass**. `isConversationOutput` 관련 `describe("isConversationOutput / unwrapNodeOutput regression")` (474-628행) 전부 포함.
- `npx vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` → **89/89 pass** (plan md 프론트매터 `worktree/started/owner` 는 이번 diff 가 건드리지 않은 영역이라 예상대로 통과).
- `npx eslint src/components/editor/run-results/output-shape.ts` → 무출력(clean).

## 발견사항

- **[WARNING]** 새로 "authoritative" 라고 명시된 OR-체인 6분기 중 최소 2개는 전혀 테스트되지 않고, 1개는 다른 참-분기와 항상 겹쳐 격리 검증이 안 된다.
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:265-297` (`isConversationOutput` OR-체인), 대응 테스트는 `__tests__/output-shape.test.ts:474-628`
  - 상세:
    1. **`outputInteraction`** (267-269행, `output.interactionType` 를 직접 읽는 경로) — 테스트 스위트 전수 grep(`interactionType`) 결과 이 필드를 `output` 객체 최상위에 직접 넣는 케이스가 하나도 없다. 항상 `meta.interactionType` 아니면 top-level `raw.interactionType` 만 쓰인다.
    2. **`hasConvConfig`** (277행, `output.conversationConfig` — **`output` 아래 nested**, top-level `raw.conversationConfig` 와는 다른 경로) — 테스트 스위트에서 `conversationConfig` 를 쓰는 5곳(338, 343, 451, 493, 508행) 전부 top-level `raw.conversationConfig` 만 구성한다. `output.conversationConfig` 형태의 페이로드는 이 파일에도, `grep -rln "conversationConfig" --include="*.test.ts*" src/` 로 찾은 나머지 파일(`result-detail`/`result-timeline`/`conversation-inspector` 등)에도 없다 — 전부 React prop 이름이거나 top-level 필드다.
    3. **`hasLegacyMessages && (outputInteraction || metaInteraction)`** 분기 — 유일하게 이 조건만으로 참이 되는 독립 테스트가 없다. 513-530행("canonical waiting shape") 은 `meta.interactionType` 도 참, `status === 'waiting_for_input'` 도 참이라 `isCanonicalWaiting` 이 동시에 참이 된다. 이 OR-분기를 통째로 삭제해도 현재 테스트는 여전히 green 이다 (mutation 관점에서 이 분기는 무방비).
  - 제안: 3개 각각을 다른 참-조건과 안 겹치게 고립한 positive 케이스 1개씩 추가 (예: `output.interactionType` 만 있고 `meta` 는 비우기 / `output.conversationConfig` 만 있고 `status` 없이 / `output.messages` + `meta.interactionType` 만 있고 `status` 필드 자체를 생략). plan 의 "Phase 3 — mutation 을 주입해 red 가 되는지 실측" 원칙을 이 3분기에도 적용하면 됨. **이번 커밋 자체를 막을 사유는 아님** — 코드 변경이 없는 순수 JSDoc 정정이므로 별건 후속 커밋으로 처리 가능.

- **[INFO]** `hasConvConfig` (`output.conversationConfig`) 분기의 실제 도달 가능성에 대해 테스트 코드베이스 내부 진술이 상충한다.
  - 위치: `result-timeline.test.tsx:132-135` 의 주석 vs backend `interaction.service.ts:382`, `execution-status-response.dto.ts:88-91`
  - 상세: `result-timeline.test.tsx` 는 "C-18 regression guard: ... handler never echoes `output.conversationConfig`" 라고 명시한다. 반면 backend 는 external-interaction/WS 라이브 이벤트 경로에서 `nodeOutput.conversationConfig`(nested) 를 실제로 구성해 내려보내는 지점이 있다 (`interaction.service.ts:382` "`nodeOutput.conversationConfig` 를 읽는다 → nodeOutput 그대로 동봉"). 두 경로가 서로 다른 producer(영구 persist 된 run-history envelope vs WS 라이브 이벤트)일 가능성이 있어 모순은 아닐 수 있으나, **어느 쪽이 맞는지 frontend 테스트가 실측으로 답을 주지 않는다** — `isConversationOutput` 이 이 nested 형태를 실제로 마주칠 때 여전히 true 를 반환하는지 확인하는 테스트가 없다.
  - 제안: 이 분기가 (a) 실제로 도달 가능한 라이브 경로를 방어하는 것이면 그 경로를 흉내낸 fixture 로 positive 테스트를 추가하고, (b) 정말 죽은 경로면 아키텍처/유지보수 리뷰어와 함께 제거를 검토 (제거는 이 파일의 성격상 "대화 UI 전체 게이트" 이므로 신중히). 어느 쪽이든 현재 상태(주석은 상충, 테스트는 침묵)로 방치하는 것보다 낫다.

- **[INFO]** JSDoc 의 분기 열거 정확성은 어떤 자동 테스트로도 강제되지 않는다 (본 diff 자체가 "직전 버전이 부정확했다" 는 사실의 증거).
  - 위치: `output-shape.ts:214-238` (함수 docstring)
  - 상세: 이번 커밋은 정확히 이 서술이 두 번째로 부정확해졌던 사례를 고친 것이다(1차: "Handles all four shapes" 로 `looksLikeConversationEnd` 누락). 새 문구가 "분기가 authoritative 이고 주석은 그것을 bound 하지 않는다" 고 명시적으로 자기 한계를 선언한 점은 좋은 완화책이지만, 구조적으로 이 문서와 코드의 동기화를 검증하는 장치(테스트/린트)는 여전히 없다 — 세 번째 drift 를 막는 것은 여전히 리뷰어의 기억력에 의존한다.
  - 제안 (낮은 우선순위, 이번 커밋을 막을 사유 아님): 위 WARNING 제안대로 분기별 격리 테스트가 생기면, 각 테스트의 `it()` 설명 문자열이 사실상 이 JSDoc 목록의 실행 가능한 대응물이 되어 다음 drift 시 테스트가 최소한 "이 분기가 무엇을 검증하는지" 를 남긴다.

- **[정보성 확인 — PASS]** plan md 커밋 인용 정정(`f17fc18dd` → `f0ef4a821`) 사실관계 실측 검증: `git show --stat f17fc18dd` 에 `interaction-type-registry.ts` 변경 없음, `git show f0ef4a821 | grep IS_MULTI_TURN_INTERACTION` 에서 실제 신설 확인. 정정이 정확하다. 이 파일은 순수 산문 수정이라 테스트 관점에서 추가 조치 불필요.

## 요약

이번 커밋은 이전 `/ai-review` 라운드(18_02_39)의 W#1·W#2 를 반영한 **주석/문서 전용** 수정으로, `isConversationOutput` 함수 바디는 한 글자도 바뀌지 않았고 plan md 는 커밋 해시 인용 하나만 고쳤다. 커밋의 자체 주장대로 런타임 표면이 없으므로 이 diff 자체에 새 테스트를 요구할 근거는 없으며, 관련 회귀 테스트(`output-shape.test.ts` 32/32, `plan-frontmatter.test.ts` 89/89)와 lint 를 직접 실행해 확인한 결과 모두 green 이다. 다만 이 diff 가 "OR-체인 6분기가 authoritative" 라고 명시적으로 처음 정확히 열거하면서, 그 정확한 열거를 계기로 기존 테스트 스위트를 대조해 보니 최소 3개 분기(`output.interactionType` 직접경로, `output.conversationConfig` nested 경로, 그리고 `hasLegacyMessages && metaInteraction` 을 다른 분기와 분리한 단독 케이스)가 격리 테스트 없이 방치돼 있음을 확인했다 — 이 함수가 과거 3차례 실제 프로덕션 버그(미리보기 탭 소실)의 진원지였다는 점, 그리고 이 PR 계열이 표방하는 "통과 자체는 검증이 아니다 · mutation 실측" 원칙에 비춰 볼 때 후속 커밋에서 다룰 가치가 있는 실질적 갭이다. 이번 특정 커밋의 병합을 막을 사유는 아니다.

## 위험도

LOW
