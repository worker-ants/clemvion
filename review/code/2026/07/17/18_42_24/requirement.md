STATUS=success requirement review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — commit 3e84d2109 (`isConversationOutput` JSDoc 정정 + plan 각주 정정)

## 검토 방법

이 커밋은 두 파일만 건드린다 — `output-shape.ts` (JSDoc 만, 런타임 코드 무변경) 와 `plan/in-progress/is-conversation-output-restructure.md` (커밋 해시 각주 1줄 정정). 커밋 메시지 자체가 두 개의 사실 주장(W#1, W#2)을 담고 있어, "의도한 기능 충족" 여부는 곧 "그 사실 주장이 실측과 일치하는가" 로 환원된다. 아래를 직접 실측했다:

1. `git show f17fc18dd --stat` / `git show --name-only f17fc18dd` → `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 를 건드리지 않음 확인 (커밋이 손댄 8개 파일에 없음).
2. `git show f0ef4a821 --stat` + `git show f0ef4a821 -- .../interaction-type-registry.ts | grep IS_MULTI_TURN_INTERACTION` → 해당 커밋이 `IS_MULTI_TURN_INTERACTION` 을 실제로 신설함을 확인.
3. `git show 3e84d2109 -- output-shape.ts` 전체 diff 확인 → 변경이 JSDoc 블록(구 `/**...*/` 내부)에만 있고 `export function isConversationOutput` 이하 함수 본문은 diff 밖(context)임을 확인 — "주석 전용, 런타임 표면 없음" 주장이 사실과 일치.
4. `isConversationOutput` 함수 본문을 직접 읽고 새 JSDoc 의 6개 bullet 을 코드의 실제 분기(조기 `return true` 블록의 2-조건 OR + 최종 `return` 의 4-항 OR = 6)와 1:1 대조.
5. `plan/complete/is-conversation-output-restructure.md` (현재 위치, 후속 커밋에서 `in-progress/`→`complete/` 이동됨) 에서 `f17fc18dd` 잔존 인용이 없고 `f0ef4a821` 인용 2곳이 서로 일치함을 grep 으로 확인.
6. `spec/` 전체에서 `isConversationOutput`/`output-shape.ts` 언급처(`conversation-thread.md`, `data-hydration-surfaces.md`, `10-graph-rag.md`) 를 찾아 이 JSDoc 변경과 충돌하는 line-level 서술이 있는지 확인.
7. 이전 리뷰 라운드(`review/code/2026/07/17/18_02_39/SUMMARY.md`, `RESOLUTION.md`)를 읽어 이 커밋이 응답하는 정확한 지적 내용과 그 처리 근거(테스트 재실행 포함)를 대조.

## 발견사항

- **[INFO]** JSDoc 의 두 항목이 diff 이전부터 있던 사소한 서술 정밀도 문제를 그대로 보존
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:122`(Legacy flat completed bullet), `:126`(Wrapped completed bullet) — 둘 다 이번 diff 의 context 라인(미변경)
  - 상세: (a) "Legacy flat completed (top-level `messages` + `interactionType`)" bullet 은 `messages` 존재를 언급하지만, 실제 가드(`raw.interactionType` 검사 또는 `raw.conversationConfig != null`, L145-151)는 `raw.messages` 존재 여부를 전혀 검사하지 않는다 — payload 의 전형적 형태를 묘사할 뿐 실제 판정 조건은 아니다. (b) "Wrapped completed (`{ config, output: { messages }, meta: { interactionType } }`)" bullet 은 `meta.interactionType` 경로(`metaInteraction`)만 예시로 들고, 코드가 실제로 동등하게 인정하는 `output.interactionType` 경로(`outputInteraction`, L164-168)는 별도 언급이 없다. 둘 다 이번 diff 가 만든 문제가 아니라 이전부터 있던 텍스트를 그대로 물려받은 것이며, 이번에 추가된 "branches below are authoritative — this list documents them, it does not bound them" 라는 명시적 헤지 문구가 정확히 이런 종류의 잔여 부정확성을 커버한다.
  - 제안: 이번 커밋의 목표(W#1·W#2로 지적된 두 결함 해소)는 완전히 달성됐으므로 이 항목은 이번 fix 의 스코프 밖이다. 다음에 이 함수를 다시 만질 기회가 있으면 두 bullet 을 코드와 더 정밀하게 맞추는 것을 권장(낮은 우선순위) — 별도 커밋 불요.

- **[INFO]** spec 본문에 `isConversationOutput` 의 분기별 정의가 없어 line-level 대조 대상이 없음
  - 위치: `spec/conventions/conversation-thread.md:389`, `spec/conventions/data-hydration-surfaces.md:33`, `spec/5-system/10-graph-rag.md:512` (모두 함수명만 참조, 분기 열거 없음) / `spec/conventions/interaction-type-registry.md §4`(endReason 값 도메인 SoT 서술, 이번 diff 대상 아님)
  - 상세: 위 spec 문서들은 `isConversationOutput` 을 "존재 판정 함수"로만 참조하고 그 6개 인식 분기를 열거하지 않는다. `interaction-type-registry.md §4` 는 `@workflow/ai-end-reason` 이 endReason 값 도메인의 SoT 라고 서술하는데, 새 JSDoc 의 "the `@workflow/ai-end-reason` package owns the value domain precisely so the list cannot drift again" 서술과 일치해 충돌 없음.
  - 제안: 조치 불요 — spec 이 이 함수의 구현 세부사항까지 규정할 필요는 없다(코드 주석이 적절한 자리). SPEC-DRIFT 아님.

## 사실 검증 결과 (핵심)

- **W#1 (plan 각주 SHA 오인용)**: 실측으로 완전히 확인됨. `f17fc18dd` 는 `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `ai-agent.handler.ts`, `node-handler.interface.ts`, `output-shape.test.ts`, `interaction-type-exhaustiveness.test.ts`, `codebase/packages/README.md`, `docker-compose.e2e.yml` 8개 파일만 건드리며 `interaction-type-registry.ts` 는 포함되지 않는다(빈 diff). `IS_MULTI_TURN_INTERACTION` 신설은 `f0ef4a821` 의 diff 에서 `+const IS_MULTI_TURN_INTERACTION: Record<WaitingInteractionType, boolean> = {` 로 직접 확인된다. 정정 후 문서 내 두 인용(`f0ef4a821`)이 서로 일치하며 잔존 오인용 없음.
- **W#2 (JSDoc "all four shapes" 과장)**: 실제 인식 경로는 조기 `return true`(interactionType 검사 OR conversationConfig 검사, 2조건) + 최종 `return` 의 4항 OR(`hasLegacyMessages && (outputInteraction||metaInteraction)` / `hasConvConfig` / `looksLikeConversationEnd` / `isCanonicalWaiting`) = 총 6분기다. 새 JSDoc 의 6개 bullet 이 이 6분기와 정확히 대응한다(특히 이 PR 의 주제였던 `looksLikeConversationEnd` 와 이전에 아예 빠져 있던 `hasConvConfig`, `isCanonicalWaiting` 가 모두 새로 반영됨). "does not bound them" 헤지 문구 추가로 향후 분기 추가 시 같은 종류의 재발("고정 개수 주장 → 과신 → drift")을 구조적으로 줄인다.
- **런타임 영향 없음**: diff 는 JSDoc 블록에만 있고 함수 바디는 완전히 unchanged. `review/code/2026/07/17/18_02_39/RESOLUTION.md` 가 이 fix 를 반영한 뒤 lint/unit/build/e2e 4단계를 모두 재실행해 PASS 를 기록했음을 확인(`PROJECT.md` "마지막 코드 commit 다음에 e2e 통과 줄" 요구 충족).
- **W#3 (CHANGELOG 누락) 미채택**: 리뷰 대상 파일 목록에 없으므로 이번 diff 의 범위가 아니다. `RESOLUTION.md` 가 "직전 15개 100% 준수" 근거를 직전 12개 중 2건만 해당한다는 실측으로 반증하고 사용자가 미채택을 결정한 근거가 문서화돼 있어, 이 fix 커밋이 그 항목을 처리하지 않은 것은 결함이 아니라 의도된 스코프 경계다.

## 요약

이 커밋은 순수 문서/주석 정정이며(런타임 표면 없음, diff 가 JSDoc 블록에 한정됨을 직접 확인), 커밋 메시지가 주장하는 두 사실(W#1 커밋 해시 오인용, W#2 JSDoc 의 "4개 shape" 과장 및 `looksLikeConversationEnd`·`hasConvConfig` 누락)을 git 아카이브와 소스 코드 대조로 독립 재검증한 결과 모두 정확했다. 새 JSDoc 의 6개 bullet 은 함수의 실제 6분기(조기-return 2조건 + OR-체인 4항)와 정확히 대응하며, "분기가 authoritative, 주석은 bound 하지 않는다" 는 헤지가 향후 유사 drift 재발 가능성을 낮춘다. plan 문서의 커밋 해시 정정도 실측 검증되어 자기모순이 해소됐고 잔존 오인용이 없다. spec 본문은 이 함수의 분기 세부를 규정하지 않아 대조 대상 자체가 없으며 충돌도 없다(SPEC-DRIFT 아님). 발견된 두 건은 모두 이번 diff 이전부터 있던 매우 경미한 서술 정밀도 문제로 INFO 등급이며 조치 불요.

## 위험도
NONE
