# 신규 식별자 충돌 검토 — spec/5-system/ (`--impl-prep`)

## 검토 범위 요약

이 impl-prep 게이트는 `spec/5-system/` 전역을 컨텍스트로 번들했으나, 실제로 "새로 도입되는
식별자" 는 이 라운드에서 구현 착수 예정인
[`plan/in-progress/eia-internal-rest-error-masking.md`](../../../../../plan/in-progress/eia-internal-rest-error-masking.md)
(미커밋, 아직 spec 미반영)에서 나온다. 이 plan 은 `Execution.error` 내부 REST 4표면에
egress 마스킹을 추가하고, `secret-store.md` 에 `interaction.triggerToken` 비대상 예외를
등재하는 두 결정(I1·D)을 집행한다. 프롬프트 번들은 컨텍스트 예산 초과로
`spec/5-system/14-external-interaction-api.md`·`spec/conventions/secret-store.md`·해당 plan
파일 본문을 전부 절단했으므로, 세 파일과 관련 코드(`terminal-error-payload.ts`,
`workflow-errors.ts`, `executions.service.ts`)를 직접 `Read`/`grep` 으로 열어 대조했다.

## 발견사항

- **[WARNING]** 신규 함수명 `redactExecutionErrorValue` 가 기존 typed 예외 계층 클래스명
  `ExecutionError` 를 온전한 부분 문자열로 포함한다 — 서로 다른 개념인데 검색·로그·회고에서
  섞일 위험
  - target 신규 식별자: `redactExecutionErrorValue(err: Record<string, unknown> | null):
    Record<string, unknown> | null` (`plan/in-progress/eia-internal-rest-error-masking.md:80`,
    `shared/utils/terminal-error-payload.ts` 의 "형제" 로 신설 예정)
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:33`
    `export abstract class ExecutionError extends Error` — client-safe 코드/메시지 계약을 갖는
    typed 예외 기반 클래스이며, `InvalidExecutionStateError`·`RetryLastTurnError`·
    `FormValidationError` 등 다수 하위 클래스가 상속한다. `websocket.gateway.ts`
    (`buildContinuationErrorAck`)와 `execution-engine.service.ts` 가 `instanceof ExecutionError`
    분기로 직접 소비하는, execution 도메인에서 이미 보안·client-safety 계약을 지고 있는
    핵심 식별자다
  - 상세: 새 함수는 DB 컬럼 `Execution.error`(JSONB, 임의 에러 정보 레코드)의 **값을
    마스킹**하는 순수 유틸이고, 기존 `ExecutionError` 는 **런타임에 throw 되는 예외 클래스
    계층**이다 — 데이터와 제어흐름이라는 서로 다른 층위인데 `redactExecutionErrorValue` 라는
    이름은 `ExecutionError` 를 그대로 감싸고 있어 문자열 검색("`ExecutionError` 관련 코드
    전부 보여줘") 이나 커밋 로그·PR 리뷰에서 두 개념이 뒤섞일 수 있다. 이 저장소는 바로
    이번 스레드의 §R17 4번째 불릿 자체가 *"이름이 같아 혼동하기 쉽다"* 고 스스로 캐비엇을
    단 사례(같은 `error` 필드명이되 `Execution.error` DB 컬럼 vs `outputData` 조립값)가 있고,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:175-178` 도 같은 함정을
    한 번 더 지적한 전례가 있다 — "이름이 겹치면 다음 사람이 같은 자리에서 미끄러진다" 는
    패턴이 세 번째로 반복될 소지
  - 제안: `redactExecutionErrorValue` 대신 `ExecutionError` 클래스명을 부분 포함하지 않는
    이름을 쓴다 — 예: `redactExecutionErrorField`, `maskExecutionErrorRecord`,
    `redactExecutionErrorColumn` 등 "DB 컬럼 값" 임을 드러내는 명명. 굳이 현재 이름을
    유지한다면 함수 docblock 에 "`workflow-errors.ts` 의 `ExecutionError` 예외 클래스와
    무관 — DB `Execution.error` 컬럼 값 마스킹" 캐비엇을 명시해 재발 방지 각주를 남길 것

- **[INFO]** `secret-store.md §1` "비대상" 절 신규 등재는 기존 패턴과 명명·구조가 일치해
  충돌 없음 — 확인만 기록
  - target 신규 식별자: `secret-store.md §1` 에 추가 예정인 "비대상 — `interaction.triggerToken`"
    캐비엇
  - 기존 사용처: `spec/conventions/secret-store.md:40` 의 기존 "비대상 — `AuthConfig.config`"
    캐비엇 (현재 유일한 선례)
  - 상세: plan 도 스스로 "현재 `AuthConfig.config` 만 있다" 고 명시하고 동일 포맷("비대상 —
    `<필드>`")을 따르겠다고 밝혔다. 실측 결과 필드 경로 `config.interaction.triggerToken` 은
    `spec/5-system/14-external-interaction-api.md:235,905,910,920` 전역에서 일관되게 같은
    의미로만 쓰이고 있어 다른 의미로 재사용된 자리가 없다 — 충돌 없음
  - 제안: 없음(그대로 진행 가능)

- **[INFO]** 신규 함수가 놓일 파일 위치가 plan 에 "형제"로만 서술돼 기존 파일 내 추가인지
  신규 파일인지 모호 — 신규 파일이라면 명명 컨벤션 확인 필요
  - target 신규 식별자: (미정) `shared/utils/` 에 놓일 신규 파일명 후보, 예:
    `redact-execution-error-value.ts`
  - 기존 사용처: `codebase/backend/src/shared/utils/` 현재 파일 목록
    (`terminal-error-payload.ts`, `sanitize-error-message.ts`, `strip-external-only-fields.ts`,
    `terminal-duration.ts`, `bcrypt-format.ts`, `retry-after.ts`) — 확인 결과 위 후보명과
    겹치는 기존 파일 없음
  - 상세: 실제 충돌은 없으나, plan 이 "형제" 표현만 쓰고 대상 파일(신규 vs 기존
    `terminal-error-payload.ts` 내부 추가)을 확정하지 않아 구현 시점에 임의로 정해질 여지가
    있다. naming collision 관점의 발견은 아니고 참고용 기록
  - 제안: 구현 착수 시 `terminal-error-payload.ts` 자체 확장(같은 파일 내 export 추가)과
    신규 파일 분리 중 하나를 명시적으로 정하면 이후 grep·리뷰 동선이 예측 가능해진다

## 검토했으나 충돌 없음으로 확인된 것

- **요구사항 ID**: target 이 이번 라운드에서 새 `EIA-*`/`R숫자` ID 를 부여하지 않는다.
  plan 이 인용하는 `I1`·`D` 는 `spec-sync-external-interaction-api-gaps.md` 트래커 내부의
  ad-hoc 참조 라벨일 뿐 spec 의 정식 요구사항 ID 네임스페이스와 무관하고, 트래커 안에서
  `I1` 은 단 한 곳에서만 쓰여 자체 중복도 없다. (참고: `R-5` 라는 동일 라벨이
  `spec/2-navigation/14-execution-history.md`·`spec/5-system/16-system-status-api.md`·
  EIA `R5`(하이픈 없음) 세 문서에서 각각 다른 의미로 쓰이지만, 이는 "문서별 로컬 Rationale
  번호" 라는 이 저장소의 기존 컨벤션이며 이번 target 이 새로 만든 충돌이 아니다. 세 인용
  모두 문서명을 동반해 정확히 스코프돼 있어 혼선 없음 — 실측 확인)
- **API endpoint**: 새 endpoint 없음. 기존 4개 REST 표면(`GET /executions/:id`,
  `GET /executions/workflow/:workflowId`, `GET /executions/:id/chain`,
  `POST /executions/:id/stop`)의 응답 값만 마스킹하도록 수정하는 것이라 method+path 신설 없음
- **이벤트/메시지명**: `execution.failed`·`execution.snapshot` 등 기존 이벤트 재사용, 신규
  이벤트명 없음
- **환경변수·설정키**: 신규 ENV/config key 없음
- **파일 경로 (spec)**: 신규 spec 파일 없음 — 기존 `14-external-interaction-api.md`·
  `secret-store.md` 본문 수정 예정. plan 파일명(`eia-internal-rest-error-masking.md`)도
  `plan/in-progress/`·`plan/complete/` 어디에도 중복 없음(확인함)

## 요약

target 라운드가 실질적으로 새로 도입하는 식별자는 함수명 `redactExecutionErrorValue` 와
`secret-store.md` 비대상 예외 등재 두 가지뿐이다. 후자는 기존 "비대상" 패턴을 정확히 따르고
필드 경로도 spec 전역에서 일관돼 충돌이 없다. 전자는 코드 충돌(같은 파일 내 import 경합 등)은
없지만, 이 execution 도메인에서 이미 보안 계약을 지고 있는 `ExecutionError` 예외 클래스명을
그대로 포함하고 있어 — 이 저장소가 반복적으로 자인해 온 "같은 이름, 다른 의미" 함정과 같은
형태의 의미 충돌 리스크가 있다. Critical 은 없다.

## 위험도

LOW
