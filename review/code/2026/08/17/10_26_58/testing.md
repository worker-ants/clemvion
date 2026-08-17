# 테스트(Testing) 코드 리뷰

## 검증 방법

diff 대상 코드(`executions.service.ts`/`.spec.ts` · `background-runs.service.ts`/`.spec.ts` ·
`websocket.service.ts`/`.spec.ts` · `sanitize-error-message.ts`/`.spec.ts` ·
`redact-stored-error.ts`/`.spec.ts`)를 실제로 열어 최신 커밋(`83436ed45` "재제출 카브아웃을
Execution 레벨로 한정")까지 반영된 최종 상태를 확인했다. 관련 5개 spec 파일을 직접 실행해
184개 테스트 전부 GREEN 을 확인했고, 이번 라운드의 핵심 변경(`nodeExecutions[].inputData` 를
Execution 레벨과 분리해 마스킹 대상으로 되돌린 부분)에 대해 **뮤테이션 검증**을 독립적으로
재현했다 — `executions.service.ts` 의 `maskIfPresent(ne.inputData, ...)` 를 원문 그대로 반환하도록
되돌리자 `⑤`·`⑥-b` 두 테스트가 정확히 RED 로 전환됐고, `background-runs.service.ts` 의
동일 관문을 되돌리자 신설 테스트("body nodeExecutions[] 의 inputData·outputData 를 모두
마스킹한다")가 RED 로 전환됐다 — 캐너리가 vacuous 하지 않음을 확인했다. 두 파일은 즉시
원상 복구했다(`git status` 로 clean 확인).

## 발견사항

- **[WARNING]** 트래커 문서가 최신 커밋으로 뒤집힌 캐너리 방향을 아직 옛 서술로 남기고 있다 — 회귀 캐너리의 의도를 반대로 설명한다.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:270`-`271` (항목 "`inputData` egress 마스킹 — 프런트 마커 가드가 선행돼야 한다")
  - 상세: 해당 항목은 "현재는 회귀 캐너리로 **비대상임을 고정**해 뒀다 (`executions.service.spec.ts` ⑧·⑧-b·⑥-b, `background-runs.service.spec.ts`)" 라고 적고 있다. 그런데 가장 최근 커밋 `83436ed45`(`fix(executions): 재제출 카브아웃을 Execution 레벨로 한정`)가 정확히 `⑥-b` 와 `background-runs.service.spec.ts` 의 새 테스트("body nodeExecutions[] 의 inputData·outputData 를 모두 마스킹한다")를 **반대 방향**(노드 레벨 `inputData` 는 이제 마스킹**되어야** 한다)으로 뒤집었다 — 직접 실행·뮤테이션으로 확인함(위 "검증 방법" 참조). 이 커밋은 `executions.service.spec.ts`·`background-runs.service.spec.ts` 두 spec 파일을 갱신했지만 `spec-sync-external-interaction-api-gaps.md` 는 손대지 않았다(`git show 83436ed45 --stat` 로 확인). 이제 `⑧`·`⑧-b`(Execution 레벨, `getChain`/`stop`)만 "비대상 고정" 서술과 일치하고, `⑥-b`·`background-runs.service.spec.ts` 는 오히려 "노드 레벨은 마스킹된다"를 고정하는 정반대 캐너리다. 이 저장소가 반복 겪은 "review/plan 문서가 SoT 가 아닌데 그걸 믿고 캐너리 의도를 오독" 패턴과 같은 형태 — 다음에 이 항목을 읽는 사람이 `⑥-b`/`background-runs` 를 "비대상" 근거로 인용하면 방금 고친 CRITICAL(WS↔REST flip-flop)을 되돌리는 방향으로 오도될 수 있다.
  - 제안: 271번째 줄에서 `⑥-b`·`background-runs.service.spec.ts` 를 제거하고, "노드 레벨은 오히려 마스킹 대상으로 전환됐다(2026-08-17, `83436ed45`)" 는 캐비엇을 추가하거나 `⑧`·`⑧-b` 만 남긴다.

- **[INFO]** `NodeExecutionSummaryDto`(Swagger) 가 `inputData` 필드를 아예 선언하지 않아, 이제 값이 실제로 마스킹되는 이 필드에 대한 계약 테스트가 없다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:143` (`NodeExecutionSummaryDto` — `outputData`/`error` 는 선언돼 있으나 `inputData` 는 없음)
  - 상세: 이 갭은 origin/main 에도 이미 있던 선존 갭이라(`git show origin/main:...` 로 확인) 이번 PR 이 만든 결함은 아니다. 다만 3라운드 전 리뷰(`00_23_57` RESOLUTION)는 이 갭을 "`inputData` 가 마스킹 비대상이 되면서 전제(런타임 마스킹 ↔ OpenAPI 불일치)가 사라졌다"며 무관하다고 처분했는데, 그 처분의 **전제가 최신 커밋으로 다시 사라졌다** — `nodeExecutions[].inputData` 가 다시 마스킹 대상이 됐으므로, "런타임에 마스킹되는데 Swagger 문서에는 그 필드 자체가 없다"는 원래 우려가 되살아난다. 이 필드 shape(`ResponseNodeExecution`의 `inputData: Record<string, unknown> | null`)을 `NodeExecutionSummaryDto` 와 대조하는 계약/스냅샷 테스트는 없다.
  - 제안: `NodeExecutionSummaryDto` 에 `inputData` 를 (형제 `outputData`/`error` 와 같은 마스킹 캐비엇을 담아) 추가 — documentation/api_contract 리뷰어 영역과 겹치므로 그쪽에서도 지적될 수 있다. 테스트 관점에서는, 후속으로 DTO 필드 목록과 `ResponseNodeExecution` 키 목록을 대조하는 가벼운 계약 테스트를 추가하면 이 클래스의 드리프트(선언 누락)를 구조적으로 잡을 수 있다.

- **[INFO]** `emitNodeEvent` 의 wire 경로 테스트가 `input` 필드가 아니라 `error` 필드로만 마스킹을 확인한다 — 이번 커밋이 고친 실제 결함(WS `input` 필드가 REST 와 플립플롭)의 당사자 필드를 wire 쪽에서 직접 겨누지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — `② emitNodeEvent — wire 도 마스킹` 테스트(`error` 필드만 검증), `① emitNodeEvent — fanout 은 error 값 안의 토큰을 마스킹`(fanout 쪽만 `input` 검증)
  - 상세: `maskWireEnvelope` 는 필드-불특정 전체 envelope 마스킹이라 `error`/`input` 어느 필드로 검증해도 메커니즘상 결과는 동일하고, 실제로 리스크는 낮다. 다만 `83436ed45` 커밋 메시지가 명시한 결함 서사("WS 가 마스킹한 `input` 값을 REST 원문이 2초 뒤 덮는다")의 당사자 필드가 정확히 `input` 인데, 이 필드의 wire-레벨 마스킹을 직접 단언하는 테스트가 없다는 것은 "이 커밋이 고친 그 문제"를 회귀로부터 지키는 캐너리로서는 다소 간접적이다.
  - 제안: 필수는 아니나, `②` 테스트의 payload 에 `input: LEAKY_INPUT` 을 추가해 `wire.input` 도 마스킹됨을 함께 단언하면 이 결함 클래스에 더 정확히 대응하는 회귀 캐너리가 된다.

## 양호한 점 (참고)

- 새로 추가/수정된 6개 테스트 파일(`background-runs.service.spec.ts` · `executions.service.spec.ts` ·
  `websocket.service.spec.ts` · `sanitize-error-message.spec.ts` · `redact-stored-error.spec.ts`) 모두
  자매 표면을 **개별적으로** 단언해 "자매 중 하나만 검증" 결함 클래스를 구조적으로 막고 있고,
  실제로 뮤테이션 검증(관문 제거 시 RED)이 문서화·재현 가능하다.
- `⑥-b`(copy-on-change) 는 값 비교가 아니라 **참조 동일성**(`toBe`/`not.toBe`)으로 3-컬럼 AND
  비교의 각 항을 개별적으로 가른다 — 값만 비교했다면 `inputData === ne.inputData` 항이 빠져도
  GREEN 이었을 자리다.
- `deepRedactSecrets`/`redactStoredDataForResponse` 계열은 마커 보존(`[REDACTED]`) 캐너리와
  "마커가 아닌 진짜 값은 여전히 마스킹된다"는 대조 단언을 쌍으로 둬서, "전부 보존" 오작동
  구현으로도 통과하는 vacuous 함정을 피했다.
- null/undefined 정규화, 비-변이(입력 불변), 평범한 값 무손상(캐너리) 등 표준 엣지 케이스가
  일관되게 커버된다.

## 요약

이번 diff 는 5라운드에 걸친 반복 리뷰(문서화된 `RESOLUTION.md` 4건)를 거치며 테스트 커버리지가
매우 촘촘해진 상태이고, 이번에 리뷰 대상이 된 최신 커밋(`83436ed45`, "재제출 카브아웃을
Execution 레벨로 한정")도 canary 방향 전환이 정확했음을 독립 뮤테이션으로 재확인했다. 유일한
실질적 결함은 코드가 아니라 **플랜 트래커 문서**(`spec-sync-external-interaction-api-gaps.md`)가
그 최신 커밋으로 뒤집힌 두 캐너리(`⑥-b`, `background-runs.service.spec.ts`)의 의도를 여전히
옛 방향("비대상 고정")으로 서술하고 있는 것 — 이 문서만 보고 향후 작업하면 방금 고친
WS↔REST flip-flop CRITICAL 을 되돌리는 방향으로 오도될 수 있다. 그 외 두 건은 INFO 수준(선존
Swagger DTO 갭의 전제 재부상, wire 테스트의 필드 선택)으로 당장 위험은 없다.

## 위험도
LOW
