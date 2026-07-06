# Requirement Review — commit range 656fc7cce..HEAD

## 범위 요약
본 델타는 `notif-hardening-followups` 트랙의 마무리 커밋 3~4개다. 실질 코드 변경은 5개 파일:
- `sanitize-error-message.ts` 신설(공용 util 추출) — `background-execution.processor.ts` 에서 로컬 함수 제거하고 import 로 대체, `execution-engine.service.ts` 의 `dispatchExecutionFailedNotification` 에도 동일 함수 적용.
- `execution-engine.service.spec.ts` — `getNotificationsService()`(ModuleRef 지연 해석) 4분기 unit 신규.
- `background-monitoring.e2e-spec.ts` — `GET /api/notifications` 응답에 `backgroundRunId` 미노출 + `resourceId=workflowId` 단언 추가.
- 나머지는 spec 3개 파일(`1-data-model.md`, `12-background.md`, `8-notifications.md`) 동기화 + plan 문서 갱신 + 이전 리뷰/consistency 산출물 커밋(신규 로직 아님).

이전 커밋(656fc7cce)에서 이미 구현된 버그 A/B 수정 자체는 diff 범위 밖(review 대상은 그 이후 후속 조치)이라, 본 리뷰는 새 추출 util·신규 unit·신규 e2e 단언·spec 동기화의 정합성에 집중했다.

## 발견사항

- **[INFO]** `sanitizeErrorMessage` 순수 추출 리팩터링 — 동작 동일성 확인
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (신규), `codebase/backend/src/modules/execution-engine/queues/background-execution.processor.ts:12-19`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:11,4500`
  - 상세: `background-execution.processor.ts` 에 있던 로컬 함수(정규식 3종 + 500자 캡 로직)가 그대로 `sanitize-error-message.ts` 로 이동했고, 두 소비처(`processor.ts`, `execution-engine.service.ts`)가 동일 함수를 import. 정규식·상수·trim/slice 로직이 문자 단위로 동일해 순수 추출임을 확인. 기존 processor 전용 unit(`background-execution.processor.spec.ts:157` "sanitizes error messages…")이 여전히 이 로직을 커버하므로 리팩터링으로 인한 커버리지 손실 없음. `sanitize-error-message.ts` 자체에 대한 독립 unit 파일은 없으나 실질적으로 processor.spec 이 대리 검증.
  - 제안: 없음(현행 유지 가능). 선택: 추후 `sanitize-error-message.spec.ts` 독립 파일로 승격하면 두 소비처 중 하나가 삭제/변경돼도 회귀를 잡을 수 있어 더 견고하나, 현재도 실질 위험은 낮음.

- **[INFO]** `getNotificationsService()` — 정지-해석-캐시(sentinel) 패턴 정합성 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:693-713`
  - 상세: `resolvedNotificationsService` 를 `undefined`(미시도) / `null`(시도했으나 못 찾음) / 실값 3-state sentinel 로 사용. 생성자 주입 우선 → ModuleRef 지연 해석 → throw 시 `undefined` 반환 → 결과 캐시(재조회 방지) 흐름이 신규 unit 4건(주입/지연해석/throw/캐시)과 정확히 대응한다. 4건 모두 실행 확인(`npx jest -t "getNotificationsService"` 4 passed). `moduleRef.get` 이 정상적으로 `undefined` 를 반환하는(throw 아닌) 케이스는 `svc ?? null` 로 처리되어 동일하게 캐시되므로 무한 재조회 없음 — 코드 경로상 문제 없음.
  - 제안: 없음. (캐시가 최초 `null` 로 고정되면 이후 NotificationsModule 이 뒤늦게 등록돼도 영구히 `undefined` 를 반환하는 이론적 엣지가 있으나, 이는 22_42_32 리뷰에서 이미 side_effect LOW 로 평가·수용된 기지 사항이며 실무상 모듈 인스턴스화 순서는 앱 부팅 시 1회 고정이라 재현 시나리오가 없다.)

- **[INFO]** e2e 신규 단언 — DTO/엔티티 실제 정의와 line-level 대조 확인
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts:360-373`
  - 상세: `expect(bgFailed).not.toHaveProperty('backgroundRunId')` 는 `NotificationDto`(`notification-response.dto.ts`)에 해당 필드가 애초에 선언돼 있지 않고, entity 컬럼도 `select: false`(`notification.entity.ts:56`)로 확인 — 이중 방어(DTO 미선언 + DB select 배제) 라 테스트가 실제로 검증하는 불변식과 일치한다. `resourceId` camelCase 는 DTO 필드명과, 앞쪽 raw-SQL 검증(`resource_id` snake_case, DB 컬럼)과 출처가 다르나 각각 올바른 네이밍 컨벤션을 사용해 혼동 없음.
  - 제안: 없음.

- **[INFO]** spec fidelity — `spec/data-flow/8-notifications.md` §1.1 / §2.1, `spec/1-data-model.md` §2.19, `spec/4-nodes/1-logic/12-background.md` §8.2 동기화 line-level 일치 확인
  - 위치: `spec/data-flow/8-notifications.md:67,71,89` / `spec/1-data-model.md:719-722` / `spec/4-nodes/1-logic/12-background.md:248`
  - 상세: `execution_failed` 행이 "초기 세그먼트 `runExecution` catch **및** 재개 세그먼트 `finalizeResumedExecutionOutcome` 양쪽" 발사로 갱신됐고, 코드에서 두 호출부(`execution-engine.service.ts:2513` 및 `runExecution` catch 경로) 모두 `dispatchExecutionFailedNotification` 을 호출함을 확인 — 정확히 일치. `NotificationsService.findByBackgroundRun`(`notifications.service.ts:53-58`)의 `WHERE background_run_id=? ORDER BY created_at ASC` 구현이 spec §2.1 서술과 문자 그대로 일치. `notification.backgroundRunId` 컬럼의 `select: false` 도 spec Rationale 서술("REST 미노출")과 일치. 본 delta 는 이 spec 문서들을 실제로 갱신하는 커밋이므로 drift 가 아니라 drift 해소 자체(코드가 먼저 구현되고 spec 을 뒤따라 맞춘 정당한 reverse-flow, plan 파일에 SPEC-DRIFT reverse-flow 로 명시돼 절차 준수 확인됨).
  - 제안: 없음 — 이미 해소됨.

- **[INFO]** `execution_failed` 메시지 새니타이징은 spec 미문서화(방어 심도, 회색지대)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4497-4500`, `spec/data-flow/8-notifications.md` §1.1 (execution_failed 행)
  - 상세: spec §1.1 의 `execution_failed` 행은 메시지 새니타이징 여부를 명시하지 않는다(발사 조건·수신자·resource_type/id 만 규정). 새니타이징 적용은 security 방어 심도 강화 목적의 보강이라 spec 이 요구하지 않아도 무방한 영역 — 침묵 영역이므로 SPEC-DRIFT 대상 아님, 단순 INFO.
  - 제안: 없음. 필요시 추후 spec 문서화 시점에 "메시지는 사용자向 노출 전 `sanitizeErrorMessage` 로 정제한다" 한 줄 추가 고려(선택 사항).

- **[INFO]** TODO/FIXME/HACK/XXX 부재 확인
  - 위치: 전체 diff (`codebase/`)
  - 상세: `git diff 656fc7cce..HEAD -- codebase/` 에 TODO/FIXME/HACK/XXX 패턴 매칭 0건. 미완성 작업 표식 없음.
  - 제안: 없음.

- **[INFO]** plan 문서 체크박스 상태와 실제 코드/spec 변경 정합성 확인
  - 위치: `plan/in-progress/notif-hardening-followups.md`, `plan/in-progress/spec-update-notifications-background-run-id.md`
  - 상세: 두 plan 파일 모두 `[x]` 로 표시된 항목이 실제 diff(코드/spec)와 대응함을 확인(예: spec-update 파일의 5개 flip 항목 `[x]` = git diff 상 spec 5곳 실제 갱신과 1:1 대응). 잔여 `[ ]` 항목(DI 순환 아키텍처 부채, FAILED 종결 헬퍼 추출, planner §4.4 ModuleRef 문서화)은 의도적으로 별도 트랙으로 이관된 것으로 명시돼 있고 본 커밋 범위에 포함되지 않음이 plan 텍스트와 일치.
  - 제안: 없음.

## 요약
본 델타는 이전 버그 수정 커밋(656fc7cce)에 대한 재리뷰(22_42_32) 후속 조치로, (1) 에러 메시지 새니타이저를 단일 공용 util 로 추출해 두 발사 경로(top-level/background)가 방어 심도를 공유하도록 통일했고, (2) `getNotificationsService()` ModuleRef 지연 해석의 4개 분기를 white-box unit 으로 회귀 가드했으며, (3) `select:false` REST 미노출 불변식을 e2e 로 black-box 검증했고, (4) 관련 spec 3개 문서(§1.1/§2.1/§2.19/12-background §8.2)를 코드와 line-level 로 동기화했다. 모든 신규 assertion 은 실제 코드 정의(entity 컬럼, DTO 필드, service 메서드)와 대조해 검증 대상과 정확히 일치했고, 신규 unit 4건은 실행하여 통과를 재확인했다. TODO/FIXME 등 미완성 표식 없음, spec 불일치(CRITICAL 급) 없음, 에러 시나리오(throw 시 조용한 no-op, 빈 recipients 등)도 기존 코드 경로 그대로 유지돼 회귀 없음. 순수 리팩터링·테스트 보강·문서 동기화 성격의 델타로 기능적 위험은 낮다.

## 위험도
NONE
