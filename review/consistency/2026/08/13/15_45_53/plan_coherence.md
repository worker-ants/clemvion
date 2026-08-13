# Plan 정합성 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 방법

`plan/in-progress/**` 전량(약 55개 문서, 번들 4,206줄)을 대상으로 target 이 다루는 필드
(`finalNodeId`·`finalPort`·`nodeCount`·`failedNodeId`·`durationMs`·`cancelledBy`·`EiaEvent`·
`payload` 봉투·`3-execution.md §8.1`·`chat-channel-adapter`)를 전수 grep 해 교차 참조했다.
target 은 `spec_impact` 4파일(EIA/WS/chat-channel-adapter/3-execution) + `pending_plans` 2건
(spec-sync-external-interaction-api-gaps.md, spec-sync-websocket-protocol-gaps.md)을 명시했고,
후속 섹션에서 `retry-turn-terminal-guard.md` W1 을 교차 참조로 걸어 뒀다 — 이 세 참조 전부를
직접 열어 대조했다.

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 Plan 정합성 결함은 발견되지 않았다.

- **[INFO]** `cancelledBy` 캐비엇의 교차 참조는 정확하고 최신이다
  - target 위치: `## 후속 (developer)` 마지막 항목, `### 3. §6.5 execution.cancelled`
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` (status: in-progress, 완료 이동
    금지 명시) — "코드 후속 우선순위 목록 #2"(`EXECUTION_CANCELLED` payload 에 `cancelledBy`
    추가, P2, 5R W1)
  - 상세: target 은 `failRetryExecution` 경로가 `cancelledBy` 를 emit 하지 않는 것을 "선재
    결함"으로 규정하고 이를 §6.5 + `chat-channel-adapter.md §1.2` 양쪽에 caveat/optional 로
    문서화한 뒤, 실제 fix 는 `retry-turn-terminal-guard.md` W1(코드 후속 #2, 아직 미완료 P2)로
    교차 참조만 건다. 직접 대조한 결과 이 참조는 정확하다 — 해당 plan 은 아직 `in-progress`
    이고 항목 #2 는 미체크 상태이므로, target 이 "optional/caveat"로 문서화한 현재 상태와
    실제 코드 상태가 일치한다. `retry-turn-terminal-guard.md` 가 항목 #2 를 먼저 코드로
    닫아버리는 시나리오는 없었다(§체크리스트·§코드 표 모두 미체크 확인).
  - 제안: 조치 불필요. 다만 이후 `retry-turn-terminal-guard.md` #2 가 구현되면, target 이 만든
    `cancelledBy` optional 표기(§6.5, `chat-channel-adapter.md §1.2`)를 되돌리는 후속 spec
    draft 가 한 번 더 필요하다는 점을 그 plan 완료 시점에 잊지 않도록, 해당 plan `#2` 항목
    설명에 "완료 시 EIA §6.5 optional 표기 되돌릴 것" 한 줄을 덧붙이는 것을 권장(비차단).

- **[INFO]** `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`/`payload` 봉투 결정은
  다른 in-progress plan 과 겹치지 않는다
  - target 위치: `## 결정`, `## 무엇을 쓸 것인가` §0~§6
  - 관련 plan: 없음(교차 검증만)
  - 상세: 위 필드명·개념을 전 plan 번들에서 전수 grep 한 결과, target 자신의 서술
    (§왜/§영향 범위/§결정/§0~§6/§비목표) 밖에서는 단 한 건도 등장하지 않았다. 즉 이 필드들을
    "구현할 gap" 으로 등재해 둔 다른 plan 이 없고, target 이 "되살리지 않는다"고 내린 결정과
    충돌할 미해결 결정도 없다.
  - 제안: 조치 불필요.

- **[INFO]** `duration → durationMs` 전역 개명을 범위 밖으로 뺀 결정도 다른 plan 의 전제와
  충돌하지 않는다
  - target 위치: `## 비목표`, `## 후속 (developer)` 4번째 항목
  - 관련 plan: 없음(교차 검증만)
  - 상세: `node.completed`·`3-workflow-editor §8.1` 등 개명 범위에 남는 `duration` 표기를
    이미 `durationMs` 로 바꿔야 한다고 전제하는 다른 in-progress plan 은 없다(grep 0건).
    retry-turn-terminal-guard.md 안의 `durationMs` 언급(§9R W1, table #35)은 전부
    `execution.error`/`finishedAt` 미클리어 버그(엔티티 컬럼 레벨) 관련이며, WS/EIA wire
    필드명 개명과는 무관한 별개 축이다.
  - 제안: 조치 불필요.

- **[INFO]** `pending_plans` 2건 등록은 열려 있으나 target 자신의 체크리스트가 이미 추적 중
  - target 위치: frontmatter `pending_plans`, `## 체크리스트` "Planned gap 2건을
    `spec-sync-*-gaps.md` 트래커에 등재"
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md`, `spec-sync-websocket-protocol-gaps.md`
    (둘 다 열어서 확인 — `execution.completed/failed/cancelled` payload 관련 항목 없음, 추가돼도
    기존 항목과 충돌 없음)
  - 상세: 두 트래커 문서 모두 현재 이 payload 계약과 관련된 항목을 갖고 있지 않아, target 이
    나중에 `result.outputs`·`durationMs`(§6.3) Planned 항목을 등재해도 기존 서술과 충돌하지
    않는다. 아직 미등재 상태이지만 이는 target 자신의 체크리스트에 이미 미체크 항목으로
    남아 있어 "후속 항목 누락"으로 볼 수 없다(발견이 아니라 계획된 잔여 작업).
  - 제안: 조치 불필요 — 재검토(BLOCK:NO) 통과 전 자연스럽게 처리될 항목.

## 요약

`plan/in-progress/**` 전량을 target 이 건드리는 필드·문서·후속 참조 기준으로 전수
대조했으나, target 이 다른 plan 의 미해결 결정을 우회하거나, 미해소 선행 조건을 가정하거나,
다른 plan 의 후속 항목을 무효화·누락시키는 사례를 찾지 못했다. target 은 이미 두 차례
BLOCK:YES(범위 절반만 잡음)를 겪은 이력이 있는 draft 답게, 이번 버전은 `retry-turn-terminal-
guard.md` W1 캐비엇을 정확히 교차 참조하고 있고, 삭제하기로 한 필드들·범위 밖으로 뺀 개명
작업 모두 다른 in-progress plan 의 전제와 충돌하지 않는다. `pending_plans` 등록 자체는 아직
미완료이나 target 스스로의 체크리스트에 잔여 항목으로 정확히 반영돼 있어 위험이 아니다.

## 위험도
NONE
