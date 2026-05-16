# 테스트(Testing) 리뷰 — 2026-05-16 23:42:11

## 발견사항

### hooks.service.spec.ts — bearer/HMAC 단위 테스트 9건 (신규)

- **[INFO]** HMAC sha512 경로 테스트 미존재
  - 위치: `backend/src/modules/hooks/hooks.service.spec.ts` — 신규 `auth — bearer / HMAC` describe 블록
  - 상세: `HMAC_ALLOWED_ALGORITHMS` 허용 목록에 `sha512` 가 추가되었으나, sha512 알고리즘으로 올바른 서명을 생성해 통과하는 케이스(`hmac: accepts valid sha512 signature`)가 없다. sha256 성공 케이스만 존재한다. 허용 목록에 명시된 값임에도 정상 경로를 테스트하지 않으면 sha512 지원 여부를 회귀에서 알 수 없다.
  - 제안: `hmacAlgorithm: 'sha512'` + `createHmac('sha512', hmacSecret).update(rawBody).digest('hex')` 로 성공 케이스 1건 추가.

- **[INFO]** `hmacHeader` 대소문자 정규화 경계값 테스트 미존재
  - 위치: `backend/src/modules/hooks/hooks.service.spec.ts`
  - 상세: `hooks.service.ts` 의 `verifyAuth` 는 `config.hmacHeader ?? 'x-hub-signature-256'`를 `.toLowerCase()`로 정규화한 뒤 `headers[hmacHeader]`로 조회한다. 테스트에서는 헤더 키를 항상 소문자로 고정하여 대소문자 변환 로직이 실제로 동작하는지 확인하지 않는다.
  - 제안: 헤더 키를 `X-Hub-Signature-256`(첫 글자 대문자) 또는 `X-HUB-SIGNATURE-256`으로 설정한 케이스를 추가해 정규화 경로를 명시적으로 검증.

- **[WARNING]** `constantTimeEquals` 메서드 자체에 대한 화이트박스 단위 테스트 미존재
  - 위치: `backend/src/modules/hooks/hooks.service.spec.ts`
  - 상세: W-37 에서 추가된 테스트들은 `handleWebhook` 을 통한 통합 수준 호출이다. `constantTimeEquals` 내부 로직(길이 불일치 조기 반환, `crypto.timingSafeEqual` 사용 여부 등)은 직접 검증되지 않는다. 이 함수는 보안 임계 함수이므로 단위 레벨 화이트박스 테스트가 별도로 있어야 타이밍 공격 방어 속성이 회귀로부터 보호된다.
  - 제안: `HooksService` 인스턴스에서 `constantTimeEquals` 를 직접 추출하거나, 공개 가능하면 export 해서 (`a === b`, `a.length !== b.length`, 동일 길이 불일치, 동일 입력) 4개 케이스를 단위 테스트로 추가.

### executions.service.spec.ts — MAX_EXECUTION_PATH_ROWS 상한 테스트

- **[INFO]** `take` 상한 초과 시 잘림 동작 검증 미존재
  - 위치: `backend/src/modules/executions/executions.service.spec.ts:351`
  - 상세: 변경은 `take: 10_000` 이 쿼리 옵션에 추가되었는지만 검증한다. 실제로 10,001개 로그 행이 존재할 때 `executionPath` 가 10,000개로 잘려서 반환되는 동작, 즉 "상한 초과 시 graceful truncation" 은 테스트되지 않는다. 이 부분은 주석에서 "UI 흐름은 유지된다" 고 서술한 핵심 가정이다.
  - 제안: `pathRows` 를 10,001개로 mock 한 뒤 `executionPath.length === 10_000` 임을 확인하는 케이스 추가. 또는 mock 레이어에서 `take` 파라미터가 실제로 결과를 제한하는지 확인하는 통합 수준 테스트 추가.

### websocket.gateway.ts — MAX_SUBSCRIPTIONS 재검사 로직 (W-68)

- **[WARNING]** await 이후 재검사 경합 시나리오 단위 테스트 미존재
  - 위치: `backend/src/modules/websocket/websocket.gateway.ts:220` — 신규 재검사 블록
  - 상세: 변경의 핵심은 `authorize()` await 이후 race condition 방어다. 그런데 이 경로를 테스트하는 케이스가 없다. `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 이 재검사 시점에만 true 가 되는 시나리오(즉 첫 번째 검사는 통과, await 이후 limit에 도달)를 시뮬레이션하는 테스트가 없으면 재검사 로직의 정확성을 회귀로부터 보호할 수 없다.
  - 제안: `authorize`를 Promise.resolve로 mock 하되 호출 전후로 `clientSubs.size`를 조작해 경합 시나리오를 재현하는 단위 테스트 추가. 응답에 `success: false`와 `Maximum subscriptions` 문구가 포함되는지 검증.

### statistics.service.ts — getSummary 쿼리 통합 (W-21)

- **[WARNING]** workflowId 필터 포함/미포함 두 분기 단위 테스트 미존재
  - 위치: `backend/src/modules/statistics/statistics.service.ts:83`
  - 상세: 이전 코드는 workflowId 있는 경우 별도 쿼리를 실행했고, 새 코드는 동일 QueryBuilder에 `andWhere`를 조건부로 추가한다. diff에 이 함수에 대한 spec 파일(`statistics.service.spec.ts`) 변경이 포함되지 않아 두 분기(workflowId 없음 / workflowId 있음)가 동일한 집계 결과를 반환하는지 회귀 테스트가 갱신되었는지 확인할 수 없다.
  - 제안: `statistics.service.spec.ts` 에 (1) workflowId 없이 `getSummary` 호출 시 workspace 전체 집계 결과, (2) workflowId 포함 시 필터된 집계 결과 — 두 케이스에서 올바른 쿼리 조건이 생성되는지 단위 테스트 확인. 이미 존재한다면 diff 범위에 포함되지 않아 검토 불가이므로 기존 테스트가 유효한지 재확인 권장.

### PaginationQueryDto.sort — @Matches 검증 (W-46)

- **[INFO]** DTO 유효성 검사 단위 테스트 미존재
  - 위치: `backend/src/common/dto/pagination.dto.ts:53`
  - 상세: `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 가 추가되었으나 이를 검증하는 테스트가 diff 내에 없다. 유효하지 않은 입력(숫자 시작 식별자, 특수문자 포함, 65자 문자열, `'; DROP TABLE`)에 대해 class-validator가 실제로 거부하는지 확인하는 테스트가 없다.
  - 제안: `validate(Object.assign(new PaginationQueryDto(), { sort: 'valid_col' }))` 등 class-validator의 `validate` 함수를 직접 사용하는 단위 테스트 추가. 유효·무효 경계값을 각 1건씩 포함.

### webhook e2e — crypto.randomBytes 전환 (W-41)

- **[INFO]** e2e import 누락 위험 — `crypto` 전역 참조 확인 필요
  - 위치: `backend/test/webhook-trigger.e2e-spec.ts:71,92,109,131`
  - 상세: 변경된 diff 에 `import * as crypto from 'crypto'` 또는 `import { randomBytes } from 'crypto'`가 포함되어 있는지 확인할 수 없다. Node.js 전역 `crypto` 객체는 v19+ 에서 `globalThis.crypto`로 존재하지만, `crypto.randomBytes`는 Node.js built-in 모듈의 함수이므로 명시적 import가 필요하다.
  - 제안: 파일 상단에 `import { randomBytes } from 'crypto'`가 있는지 확인하고, 없다면 추가. diff에 해당 import 변경이 포함되지 않았다면 기존 import 활용 여부를 확인.

### sanitizePayloadForWs — 원본 참조 반환 최적화 (W-25)

- **[INFO]** `mutated` 분기 unit 테스트 미존재
  - 위치: `backend/src/modules/websocket/websocket.service.ts:93`
  - 상세: 로직 변경 후 `sanitizePayloadForWs`가 변경 없는 경우 원본 참조를 반환하는 동작(`result ?? value`)은 참조 동일성(`===`)으로만 검증 가능하다. 기존 테스트가 `toBe`(참조 비교) 대신 `toEqual`(값 비교)만 사용하면 최적화 경로를 검증하지 못한다. 또한 깊이 중첩된 객체에서 하위 값만 변경된 경우 상위 객체가 새 참조로 교체되는지 확인하는 케이스가 없다.
  - 제안: `websocket.service.spec.ts`에 (1) 자격증명 키 없는 순수 객체 → 반환값이 원본과 동일 참조(`===`) 검증, (2) 중첩된 자격증명 키가 있는 경우 새 객체 반환 검증 추가.

### V052 마이그레이션 — integration_action_required (C-9)

- **[INFO]** 마이그레이션 자체에 대한 통합/e2e 테스트 미존재
  - 위치: `backend/migrations/V052__notification_type_integration_action_required.sql`
  - 상세: CHECK constraint 변경은 마이그레이션 실행 후 `integration_action_required` 타입의 알림 INSERT가 실제로 성공하는지, 그리고 기존 유효한 타입들이 여전히 허용되는지 확인하는 e2e 또는 DB 통합 테스트가 없다. 마이그레이션 파일 단독으로 정확성을 보장할 수 없다.
  - 제안: `IntegrationActionRequiredNotifierService`에 대한 통합 테스트에서 `integration_action_required` 타입 INSERT 후 `check_violation` 이 발생하지 않음을 검증하거나, 기존 notification e2e 테스트에서 해당 타입을 포함.

---

## 요약

이번 변경은 보안 임계 경로(HMAC 인증, 알고리즘 허용 목록)와 경합 조건 방어(WebSocket 구독 한도 재검사)에 집중된 수정이며, 단위 테스트 9건과 e2e 수정을 포함하는 긍정적인 방향이다. 전체 210/210 suite, 3,762/3,762 테스트 통과가 확인되었다. 그러나 보안 관점에서 핵심인 `constantTimeEquals` 함수의 화이트박스 단위 테스트 미존재, sha512 허용 경로 테스트 누락, WebSocket MAX_SUBSCRIPTIONS 경합 시나리오 테스트 부재는 보안 속성이 미래 회귀에서 보호받지 못하는 커버리지 갭을 만든다. `statistics.service.ts` 의 쿼리 통합 변경에 대한 spec 테스트 갱신 여부도 diff 범위 밖으로 확인 불가하다. PaginationQueryDto 의 `@Matches` 검증, `sanitizePayloadForWs` 참조 반환 최적화, V052 마이그레이션에 대한 검증 케이스도 추가하면 커버리지를 더욱 강화할 수 있다.

## 위험도

MEDIUM
