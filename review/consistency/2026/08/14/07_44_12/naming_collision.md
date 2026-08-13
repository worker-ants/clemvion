# 신규 식별자 충돌 검토 — spec/5-system/ (impl-prep)

## 사전 확인 — target 스펙에 실제 변경분이 있는가

`git diff origin/main -- spec/5-system/14-external-interaction-api.md` 결과 **0줄**. 이번 라운드에서
`spec/` 은 전혀 수정되지 않았다 — worktree 에 추가된 파일은 `plan/in-progress/eia-terminal-payload.md`
(신규 plan) 뿐이다.

즉 이번 impl-prep 이 실제로 검토해야 할 "target" 은 **spec 본문의 새 식별자가 아니라**, 그 plan 이
착수하려는 **코드 구현**이 다루는 필드 3종이다 (§Overview):

- `error` 객체 형태 (`{code, message, nodeId, details?}`) — `execution.failed`/`execution.cancelled`
- `durationMs` — `execution.completed`/`failed`/`cancelled` 3종
- `result.outputs` — `execution.completed`

세 필드 모두 **이미 `spec/5-system/14-external-interaction-api.md` §6 "종결 이벤트의 필드 집합"
(정본, PR #1166 도입) 에 문서화되어 있고 "미구현 (Planned)" 로만 표시**돼 있었다 — 지금 시도하는 것은
새 식별자 도입이 아니라 이미 리뷰를 통과한 spec 어휘를 코드로 따라잡는 작업이다. 이 전제 위에서 각
관점을 점검했다.

## 발견사항

- **[INFO]** `durationMs` — 기존 전사 컨벤션과 이미 정합, 충돌 없음
  - target 신규 식별자: EIA `execution.completed`/`failed`/`cancelled` payload 최상위 `durationMs`
  - 기존 사용처: `spec/4-nodes/4-integration/0-common.md` §6.1 "`meta.duration` vs `meta.durationMs`
    명명 통일" — 모든 노드 시간 메트릭을 `durationMs`(ms 단위)로 통일하는 규약. 그 외
    `spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/3-execution.md`,
    `spec/3-workflow-editor/4-ai-assistant.md` 등 execution/노드 레벨에서 이미 광범위하게 동일 의미로
    사용 중.
  - 상세: EIA 문서 자신도 "WS 계열 문서는 같은 값을 `duration` 으로 적는다 — 표기만 다르고 같은 값"
    이라고 이미 각주해 뒀다(§6 필드 집합 표). 즉 이름 차이는 인지되어 있고 의미 충돌이 아니라 표기
    통일 이슈로 이미 문서화됨 — 신규 충돌 아님.
  - 제안: 없음(현행 유지). 코드 구현 시 WS 쪽 `duration` 필드와 값 계산 로직을 공유하도록만 주의.

- **[INFO]** `result.outputs` — 전사 코퍼스에 동명 필드 없음
  - target 신규 식별자: EIA `execution.completed` payload 의 `result.outputs`
  - 기존 사용처: 없음. `spec/5-system/`, `spec/1-data-model.md`, `codebase/backend/src/modules/execution*`,
    `codebase/backend/src/modules/external-interaction/**` 전수 grep 결과 동일 키의 다른 의미 사용처를
    찾지 못했다(`nodeOutputs`/`finalOutputs`/`executionOutputs` 류도 0건).
  - 상세: 이 필드는 §6 필드 집합 표에 이미 "Planned" 로 정의돼 있고 이번에 값이 채워질 뿐이라
    구조적으로도 신규 도입이 아니다.
  - 제안: 없음.

- **[INFO]** `error.code = 'WEBCHAT_IDLE_TIMEOUT'` 류 기존 코드 재확인 — 대상 아님
  - `execution.cancelled`/`failed` 의 `error.code` 네임스페이스(`RESUME_*`, `EXECUTION_QUEUE_WAIT_TIMEOUT`,
    `WEBCHAT_IDLE_TIMEOUT`, `EXECUTION_TIMEOUT` 등)는 모두 이번 plan 범위 밖의 기존 구현이며 §5.4·R19·
    `3-error-handling.md`·`data-flow/3-execution.md`·`data-flow/15-external-interaction.md` 등에 이미
    일관되게 등재돼 있다. `error` 를 **string → object** 로 바꾸는 이번 구현이 이 네임스페이스 자체를
    건드리지 않으므로 충돌 표면이 아니다 — 참고로만 확인.

- **[INFO]** worktree 이름-기반 오탐 경로 — 이번 항목은 해당 없으나 인지 필요
  - `plan/in-progress/eia-terminal-payload.md` 자신이 "워크트리 이름(`eia-r8-cache-scope-4ae434`)이
    실제 브랜치(`claude/eia-terminal-payload`)와 무관하며, 과거 라운드에서 `_head_basis_notice()` 가
    절대경로를 프롬프트에 박아 'spec 델타 0' 을 CRITICAL 오탐으로 잘못 낸 적이 있다" 고 명시했다. 이번
    라운드에서 실제로 spec 델타가 0인 것은 **정상**(코드 전용 PR, spec 은 PR #1166 에서 이미 확정) 이며
    "target 델타 0" 을 근거로 CRITICAL 을 내는 것은 그 문서가 경고한 오탐 패턴 그대로다 — 본 checker 는
    이를 오탐으로 판단하지 않는다.

- **[INFO]** `plan/in-progress/eia-terminal-payload.md` 파일 경로 — 기존 파일과 겹치지 않음
  - `plan/in-progress/`, `plan/complete/` 어디에도 동명 파일 없음(신규 파일). 명명 컨벤션(`<주제>-<보완>.md`)
    도 기존 관례와 정합.

## 검토 범위 밖 — 별도 트랙(`update-returning-tuple-shape.md`)

같은 worktree 에 번들된 `plan/in-progress/update-returning-tuple-shape.md` 는 EIA 와 무관한
TypeORM `UPDATE/DELETE RETURNING` 튜플 처리 결함 수정 PR(이미 머지된 `f9d31041d`)의 산출물이며,
`spec/5-system/4-execution-engine.md` 등에 각주만 부착하는 완료 단계 plan 이다. `updateReturningRows`
헬퍼 등 이 트랙이 도입한 식별자는 EIA 신규 식별자와 이름 공간이 겹치지 않으며, 이번 naming_collision
관점(요구사항 ID·엔티티·API endpoint·이벤트명·ENV/설정키·파일 경로)에서 EIA 대상과 충돌하는 지점을
찾지 못했다.

## 요약

이번 impl-prep 라운드는 `spec/5-system/14-external-interaction-api.md` 를 **한 줄도 바꾸지 않는다**
(origin/main 대비 diff 0). 착수하려는 `plan/in-progress/eia-terminal-payload.md` 는 이미 §6 "종결
이벤트의 필드 집합" 정본(PR #1166)에 "Planned" 로 문서화돼 있던 `error` 객체 형태·`durationMs`·
`result.outputs` 세 필드를 코드로 채우는 작업이라, 이 검토 관점이 찾는 "새로 도입되는 식별자" 자체가
사실상 없다. `durationMs` 는 이미 전사 컨벤션(§6.1 `meta.durationMs` 통일)과 정합하고, `result.outputs`
는 코퍼스 전수 검색으로도 동명 충돌 사용처가 없다. 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV
변수·파일 경로 6개 관점 모두에서 CRITICAL/WARNING 급 충돌을 발견하지 못했다.

## 위험도

NONE
