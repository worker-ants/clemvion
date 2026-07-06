# Side Effect Review — commit 656fc7cce..HEAD

대상 범위: `notif-hardening-followups` 후속 커밋 4건(04386bdd4 refactor + 문서 3건). 코드 변경은
`execution-engine.service.ts` / `background-execution.processor.ts` / 신규
`sanitize-error-message.ts` / 두 spec 파일(unit·e2e)로 국한. 나머지는 plan/review 산출물(md/json) 문서
변경으로 side effect 관점 대상 아님.

## 발견사항

- **[INFO]** `sanitizeErrorMessage` 유틸 추출 — 순수 함수, 부작용 없음
  - 위치: `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` (신규),
    `background-execution.processor.ts:17,72`, `execution-engine.service.ts:11,4500`
  - 상세: 기존 `background-execution.processor.ts` 안에 있던 module-private 함수
    `sanitizeErrorMessage`를 동일 로직 그대로 `sanitize-error-message.ts`로 옮기고 두 호출부
    (`background-execution.processor.ts`, `execution-engine.service.ts`)가 공유 import 하도록
    변경했다. 함수는 인자만으로 값을 계산해 반환하는 순수 함수(전역 상태·I/O 없음)이고, 시그니처
    (`(err: unknown) => string`)도 그대로 보존되어 동작 변화가 없다. `execution-engine.service.ts`
    호출부는 `errMessage: string`을 넘기는데, 함수 내부의 `err instanceof Error` 분기가 거짓이 되어
    `String(err)`로 처리되지만 문자열의 `String()` 변환은 항등이라 결과는 동일하다.
  - 제안: 없음(안전).

- **[INFO]** 알림 메시지 표면 변경(사용자에게 보이는 텍스트 변경) — 의도된 변경, 하위 호환 이슈 없음
  - 위치: `execution-engine.service.ts:4500`
  - 상세: `execution_failed` 알림의 `message` 필드에 노출되는 원본 예외 메시지가 이제
    stack trace/connection-string 패턴이 제거되고 500자로 절단된 값으로 바뀐다. DB에 저장되는
    `savedExecution.error.message`(비새니타이징 원본, `execution-engine.service.ts:4420` 부근)는
    변경되지 않아 내부 디버깅 정보 손실은 없다. 알림 텍스트만 사용자向으로 정리되는 것으로,
    보안 하드닝 목적에 부합하며 다른 소비자(WS 이벤트 `error` 필드 등)는 영향받지 않는다
    (WS `emitExecution`의 `error` 필드는 그대로 미가공 `err.message`/`errMessage`를 사용 —
    새니타이징 대상은 알림 표면만).
  - 제안: 없음. 다만 WS 이벤트 `error` 필드는 이번 새니타이징 대상에서 제외되어 있음을
    참고— 별도 채널이라 방어심도 통일 범위 밖으로 보이나, WS 페이로드는 코멘트에 언급된
    `sanitizePayloadForWs`가 키 기반으로 별도 방어한다고 문서화되어 있어(신규 파일 JSDoc) 의도된
    분업으로 판단됨.

- **[INFO]** `getNotificationsService()`의 인스턴스 레벨 캐시 — 전역 상태 아님
  - 위치: `execution-engine.service.ts` (본 diff 범위 밖 기존 코드, `this.resolvedNotificationsService`)
    + 신규 unit 테스트(`execution-engine.service.spec.ts:35-87`)가 해당 캐시 4분기를 검증
  - 상세: 새 unit 테스트가 검증하는 `getNotificationsService`는 `this.resolvedNotificationsService`
    (인스턴스 필드)에 해석 결과를 캐시한다. 전역 변수나 모듈 스코프 변수가 아니라 NestJS
    싱글턴 서비스의 인스턴스 필드이므로, 요청 간 공유되는 부작용이 아니라 앱 생명주기 동안
    1회 해석 후 고정되는 정상적인 lazy-init 패턴이다. 테스트 자체도 `asSvc()`로 캐스팅해
    private 필드를 직접 조작하는 방식이라 프로덕션 코드에 부작용을 남기지 않는다(모킹 대상은
    테스트 인스턴스 자신).
  - 제안: 없음. (RESOLUTION.md가 이미 "캐시 최초 null 영구고정" 이론적 리스크를 LOW로
    분류해 인지하고 있음 — 신규 발견 아님.)

- **[INFO]** e2e 테스트 신규 assertion — 실제 네트워크 호출은 기존 in-repo 테스트 인프라 대상
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts:357-372`
  - 상세: 추가된 `GET /api/notifications` 호출은 `BASE_URL`(`E2E_BASE_URL` 또는 로컬 docker
    `backend-e2e:3011`) 대상으로, 기존 e2e 스위트와 동일한 테스트 전용 백엔드를 호출한다.
    외부 서비스나 프로덕션 엔드포인트에 대한 의도치 않은 네트워크 호출이 아니다. 응답 바디에서
    `backgroundRunId` 미노출과 `resourceId === workflowId`만 단언하며 상태 변경(POST/PATCH/DELETE)
    은 없다.
  - 제안: 없음.

- **[INFO]** 함수 시그니처/공개 인터페이스 변경 없음
  - 위치: 전체 diff
  - 상세: `sanitizeErrorMessage(err: unknown): string` 시그니처는 이전 로컬 함수와 동일하게
    유지되어 이동(파일 위치 변경)만 있었고 호출자 계약 변화가 없다. `dispatchExecutionFailedNotification`
    등 기존 private 메서드의 시그니처도 변경되지 않았다. 신규 export(`sanitize-error-message.ts`)는
    모듈 내부(`execution-engine` 디렉토리) 전용으로 두 파일만 import하며, 외부 공개 API
    (controller/DTO)에는 영향이 없다.
  - 제안: 없음.

- **[INFO]** 환경 변수 읽기/쓰기 없음
  - 위치: 전체 diff
  - 상세: 이번 delta에서 신규 `process.env` 읽기/쓰기는 없다. e2e 테스트의 `E2E_BASE_URL`
    사용은 기존 라인(diff에 포함되지 않은 상단 상수 선언)의 재사용이며 신규 도입이 아니다.
  - 제안: 없음.

- **[INFO]** plan/review 문서 변경(md/json) — 코드 실행 경로에 영향 없음
  - 위치: `plan/in-progress/notif-hardening-followups.md`,
    `plan/in-progress/spec-update-notifications-background-run-id.md`,
    `review/code/2026/07/06/21_23_13/RESOLUTION.md`,
    `review/code/2026/07/06/22_42_32/{RESOLUTION.md,SUMMARY.md,_retry_state.json,api_contract.md,...}`
  - 상세: 체크박스 상태 갱신, 리뷰 결과 기록 등 순수 문서/트래커 변경이며 애플리케이션
    런타임 부작용 범주에 해당하지 않는다.
  - 제안: 없음.

## 요약

이번 delta는 (1) 이미 존재하던 에러 메시지 새니타이징 로직을 `background-execution.processor.ts`
로컬 함수에서 공유 유틸(`sanitize-error-message.ts`)로 추출해 `execution-engine.service.ts`의
알림 발사 경로에도 동일 적용한 리팩터링, (2) 그 회귀를 막기 위한 unit/e2e 테스트 보강, (3) plan·review
문서 갱신으로 구성된다. 함수 시그니처·공개 인터페이스는 그대로 유지되고, 새로 추가된 상태는 전역이
아닌 서비스 인스턴스 필드(`resolvedNotificationsService`, 기존 diff 범위 밖 코드)뿐이며, 네트워크 호출은
모두 기존 in-repo e2e 인프라 대상이다. DB에 저장되는 원본 에러 메시지는 그대로 유지하고 사용자向
알림 표면에만 새니타이징을 추가 적용해 부작용 범위가 명확히 통제되어 있다. 전반적으로 부작용
관점에서 위험 요소는 발견되지 않았다.

## 위험도

NONE
