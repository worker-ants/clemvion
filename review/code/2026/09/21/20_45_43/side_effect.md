# 부작용(Side Effect) 리뷰 — `raceUnderHeldLock()` 추출 + PROJECT.md 가이드 반영

## 발견사항

- **[INFO]** 신규 공용 헬퍼의 모듈 로드 시 `throw` 가, 트리거 도메인과 무관한 8개 e2e 스위트의 로드 가능 여부까지 한 상수에 묶는다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:4`(`import { TRIGGER_DELETE_LOCK_TIMEOUT_MS } from '../../src/modules/triggers/trigger-config-lock'`), `:17`(`VACUITY_GUARD_MS`), `:19-24`(모듈 스코프 `if (...) throw`)
  - 상세: 이 `throw` 는 함수 안이 아니라 **모듈 최상위**에서 실행된다. `raceUnderHeldLock` 을 import 하는 9개 파일(`auth-config-` · `integration-` · `member-remove-` · `model-config-` · `schedule-` · `trigger-` · `webauthn-credential-` · `workflow-` · `workspace-delete-concurrency.e2e-spec.ts`) 은 각자 독립된 Jest 모듈 레지스트리를 쓰므로 서로의 테스트 실행을 직접 오염시키지는 않지만, 이 상수 관계(`VACUITY_GUARD_MS < TRIGGER_DELETE_LOCK_TIMEOUT_MS`)가 깨지면 **트리거/스케줄과 무관한** `auth-config-` · `member-remove-` · `webauthn-credential-` 등의 스위트까지 "락 관계가 역전됐다" 는 트리거 전용 에러 메시지로 한꺼번에 로드-실패한다. 프로덕션 쪽 `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(`trigger-config-lock.ts:128`)를 고치는 사람이 이 결합을 모르면 자신과 무관해 보이는 8개 스위트가 왜 깨졌는지 추적하는 데 시간이 든다. 다만 이 값은 두 쪽 다 리터럴 상수(런타임 입력 없음)이고 실패가 조용하지 않고 즉시·명확한 에러 메시지로 드러나므로 (오탐이 아니라 "드러나는 오류"를 의도한 fail-fast 설계) 심각도는 낮다.
  - 제안: 조치 불요(의도된 fail-fast). 다음에 이 결합이 실제로 터지면 에러 메시지에 "이 헬퍼를 쓰는 8개 무관 스위트도 함께 실패한다" 는 한 줄을 추가하는 정도로 충분.

- **[INFO]** `VACUITY_GUARD_MS`(1.5초) 가 여전히 파라미터화되지 않은 채 11개 호출부 전체에 공유된다(이전 라운드 INFO#1 과 동일한 지점, 위치만 함수 정의 위로 이동)
  - 위치: `codebase/backend/test/helpers/concurrency.ts:17`(선언), `:87`(사용)
  - 상세: 리팩터 전 각 파일이 갖고 있던 리터럴 `1_500` 이 단일 상수로 승격됐고, 함수 시그니처는 이 지연을 오버라이드할 방법을 노출하지 않는다. 현재 9파일 11블록 전부 동일 값이었음을 실측(plan §B)했으므로 지금 시점엔 동작 변화가 없다. `lock_timeout` 이 1.5초보다 짧은 새 삭제 경로가 생기면 위 모듈 로드 가드가 즉시 잡아내므로(바로 위 항목), 조용히 오탐할 여지는 이미 방어돼 있다.
  - 제안: 조치 불요.

## 확인한 항목 (문제 없음)

- **시그니처/인터페이스 변경**: `raceUnderHeldLock()` 은 신규 export. 기존 공개 함수·클래스의 시그니처는 하나도 바뀌지 않았다. 9개 e2e 파일의 호출부 교체 전후로 `it()`/`describe()` Jest 계약, HTTP 응답 단언, 감사 로그 카운트 단언 문자열이 diff 상 그대로다(`auth-config-` 파일 실제 내용을 `Read` 로 직접 대조 — `locker`/`db` 분리, `sort` 로직, `expect(...)` 값 모두 이동만 하고 값 불변 확인).
- **호출 순서(콜백) 보존**: 원본 `Promise.all([fireDelete(), fireDelete()])` (리터럴 순서 즉시 호출) → 헬퍼 `fires.map((fire) => fire())` (배열 인덱스 순서 즉시 호출)로 순서·동시성 타이밍 동일. `webauthn-credential-delete-concurrency.e2e-spec.ts` 의 `[() => fireDelete(idA), () => fireDelete(idB)]` 서로 다른 대상 케이스도 순서 보존.
- **트랜잭션/DB 부작용**: `BEGIN` → 락 쿼리 → 발사 → 공허성 가드 → `COMMIT`, `finally` 의 `ROLLBACK`(no-op 커버) + `pending?.catch` 구조가 11블록 전부에서 그대로 헬퍼로 이동했을 뿐 순서·조건 변경 없음. `locker` 는 각 spec 파일 `beforeAll` 에서 개별 생성되고 `db` 와 별도(예: `auth-config-delete-concurrency.e2e-spec.ts:33-36`) — 헬퍼의 JSDoc 계약(`locker`≠`db`)과 일치, 파일 간 커넥션 교차 없음.
- **전역 변수**: `VACUITY_GUARD_MS` 는 모듈 스코프 `const`(불변)이고 실행 중 재할당되지 않는다 — mutable 전역 아님.
- **파일시스템 부작용**: 코드 diff(파일 1·2·4~12) 자체는 fs 를 건드리지 않는다. `review/code/2026/09/21/20_26_50/**` · `review/consistency/2026/09/21/19_59_55/**` 는 프로젝트가 강제하는 `/ai-review`·`consistency-check --impl-prep` 워크플로의 정상 산출물이고 plan 체크리스트에도 기록돼 있어 예상 밖의 생성이 아니다.
- **환경 변수**: `process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011'` 읽기는 각 spec 파일의 기존 코드 그대로이며 이번 diff 에서 손대지 않았다.
- **네트워크 호출**: `fireDelete`/`fireRemove`/`fireLeave` 가 `supertest` 로 테스트 대상 백엔드를 호출하는 것은 리팩터 이전과 동일 — 헬퍼 추출이 새 외부 호출을 추가하지 않는다.
- **`codebase/backend/src/**` 변경 0**: 이번 diff 에 프로덕션 코드 변경이 없다(테스트 전용 리팩터) — 런타임 동작 영향 없음.
- **PROJECT.md 변경**: 문서 텍스트 추가뿐이며 실행 가능한 코드나 빌드 산출물에 영향 없음.

## 요약

이번 변경은 9개 e2e 스펙 파일(11블록)에 중복돼 있던 "락을 쥔 채 두 요청을 겹치게 하고 공허성 가드로 겹침을 확인" 로직을 `codebase/backend/test/helpers/concurrency.ts::raceUnderHeldLock()` 으로 추출한 순수 테스트 전용 리팩터이며, PROJECT.md 에 그 헬퍼 사용을 안내하는 문서 한 단락이 추가됐다. 트랜잭션 순서·발사 순서·가드 타임아웃 값·assertion 값이 diff 전후 문자 그대로 유지되고, 프로덕션 코드(`codebase/backend/src/**`)는 전혀 건드리지 않는다. 새로 도입된 전역 상태는 불변 모듈 상수 하나(`VACUITY_GUARD_MS`)뿐이고, 신규 export 라 기존 호출자 시그니처 영향도 없다. 유일하게 주목할 지점은 모듈 로드 시점의 fail-fast 가드가 트리거 도메인 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)와 공허성 가드 상수를 비교하면서, 그 관계가 깨질 경우 트리거와 무관한 8개 스위트까지 한꺼번에 로드-실패시키는 결합을 만든다는 점인데, 값이 둘 다 리터럴 상수이고 실패가 즉시·명확하게 드러나도록 설계돼 있어 지금 시점의 결함은 아니다. 부작용 관점에서 차단 사유는 없다.

## 위험도

NONE
