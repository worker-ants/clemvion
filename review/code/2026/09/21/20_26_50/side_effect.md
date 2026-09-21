# 부작용(Side Effect) 리뷰 — `raceUnderHeldLock()` 추출

## 발견사항

- **[INFO]** `VACUITY_GUARD_MS`(1.5초) 가 11개 호출부 전체에 공유되는 하드코딩 상수로 고정됨 — 호출부가 오버라이드할 수 없다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:87` (`const VACUITY_GUARD_MS = 1_500;`), 사용처 `codebase/backend/test/helpers/concurrency.ts:67`
  - 상세: 리팩터 전에는 각 e2e 파일이 자신의 리터럴 `1_500` 을 갖고 있었고, 이번 diff 는 그 값이 11블록 전부 동일함을 실측(plan §B)한 뒤 단일 상수로 승격했다. 현재 시점 기준으로는 순수 동일 값 통합이라 동작 변화가 없다. 다만 함수 시그니처가 이 지연을 파라미터로 노출하지 않으므로, 앞으로 `lock_timeout` 이 1.5초보다 짧은 새 삭제 경로가 이 헬퍼를 재사용하면 공허성 가드가 "겹침 실패"와 "락 타임아웃"을 구분하지 못하고 조용히 거짓 통과할 위험이 JSDoc 경고(§21-23, §58-63)로만 방지되고 있다.
  - 제안: 현재 diff 범위에서는 조치 불필요(문서화된 위험이고 실측이 뒷받침됨). 후속 호출부 추가 시 `guardMs?: number` 같은 선택적 파라미터로 열어두는 것을 고려.

- **[INFO]** 신규 공유 헬퍼가 `expect`(Jest global)를 자체 import 해 assertion 을 헬퍼 내부에서 던짐 — 호출자 파일의 assertion 개수·실패 지점이 스택트레이스상 헬퍼 파일로 이동
  - 위치: `codebase/backend/test/helpers/concurrency.ts:1` (`import { expect } from '@jest/globals';`), `codebase/backend/test/helpers/concurrency.ts:70` (`expect(raced).toBe('pending')`)
  - 상세: 부작용은 아니지만, 이후 이 assertion 이 실패할 때 스택트레이스의 최상위 프레임이 각 `*.e2e-spec.ts` 파일이 아니라 `concurrency.ts` 가 된다. 디버깅 시 "어느 호출부인지" 를 알기 위해 헬퍼가 반환하는 값이나 에러 메시지에 컨텍스트가 없다.
  - 제안: 선택 사항 — 필요 시 에러 메시지에 호출부 식별 정보(예: `lock.sql`)를 포함해 실패 시 어떤 락 쿼리였는지 바로 알 수 있게 할 수 있으나, 현재 11개 스위트 모두 실측(음성 대조군 11 RED)으로 검증됐으므로 필수는 아니다.

## 확인한 항목 (문제 없음)

- **시그니처/인터페이스 변경**: `raceUnderHeldLock()` 은 신규 export 이며 기존 공개 함수 시그니처를 바꾸지 않는다. 9개 e2e 파일의 호출부는 모두 새 헬퍼로 대체됐을 뿐 `it()`/`describe()` 등 Jest 계약, HTTP 응답 단언, 감사 로그 카운트 단언은 diff 전후 문자 그대로 동일하다(각 파일 diff 대조 완료 — `expect(results...).toEqual(...)` 류가 이동만 하고 값이 바뀐 곳 없음).
- **호출 순서(콜백) 보존**: 원본은 `Promise.all([fireDelete(), fireDelete()])` 로 두 thunk 를 리터럴 순서대로 즉시 호출했고, 헬퍼는 `fires.map((fire) => fire())` 로 배열 인덱스 순서대로 즉시 호출한다 — 호출 순서·동시성 타이밍 동일. `webauthn-credential-delete-concurrency.e2e-spec.ts` 의 `[() => fireDelete(idA), () => fireDelete(idB)]` 도 순서 보존.
- **트랜잭션/DB 부작용**: `BEGIN`→락 쿼리→발사→가드→`COMMIT`, `finally` 의 `ROLLBACK`(no-op 커버)+`pending?.catch` 구조가 11블록 전부에서 문자 그대로 헬퍼로 이동했을 뿐 순서·조건 변경 없음. 트랜잭션 경계가 e2e 파일별 `locker` 커넥션(각 파일 `beforeAll`에서 개별 생성)에 격리돼 있어 파일 간 교차 오염 없음.
- **전역 변수**: `VACUITY_GUARD_MS` 는 모듈 스코프 `const`(불변)이며 실행 중 갱신되지 않는다 — 새 mutable 전역 아님.
- **파일시스템 부작용**: 코드 diff(파일 1-11) 자체는 fs 를 건드리지 않는다. `review/consistency/2026/09/21/19_59_55/**`(파일 12-19)는 프로젝트 규약이 강제하는 `/consistency-check --impl-prep` 실행 산출물로, 이번 작업이 유발한 **의도된** 표준 워크플로 부산물이며 예상 밖의 생성이 아니다.
- **환경 변수**: `process.env.E2E_BASE_URL` 읽기는 리팩터 대상 파일들에서 변경되지 않은 기존 코드다.
- **네트워크 호출**: `fireDelete`/`fireRemove` 가 `supertest` 로 테스트 대상 백엔드를 호출하는 것은 리팩터 이전과 동일 — 헬퍼 추출이 새 외부 호출을 추가하지 않는다.
- **`codebase/backend/src/**` 변경 0**: 프로덕션 코드 diff 없음(plan 문서·리뷰 대상 diff 모두 확인) — 런타임 동작에 영향 없음, 테스트 전용 리팩터.
- **공허성 가드 보존 검증**: plan 문서(`plan/in-progress/e2e-race-helper.md`)가 기록한 음성 대조군(락 쿼리를 `void lock` 으로 치환)이 11블록 전부에서 정확한 사유(`Received: "settled"`)로 RED 를 냈다는 실측 근거가 있어, 헬퍼 추출이 가드를 조용히 약화시키지 않았음을 코드 검토와 별개로 뒷받침한다.

## 요약

이번 변경은 9개 e2e 스펙 파일에 중복돼 있던 "락을 쥔 채 두 요청을 겹치게 하고 공허성 가드로 겹침을 확인한다" 로직을 `codebase/backend/test/helpers/concurrency.ts::raceUnderHeldLock()` 으로 추출한 순수 테스트-전용 리팩터다. 트랜잭션 순서, 발사 순서, 가드 타임아웃 값, assertion 값이 모두 diff 전후 동일하게 유지되며, 프로덕션 코드(`codebase/backend/src/**`)는 전혀 건드리지 않는다. 새로 도입된 전역 상태는 불변 모듈 상수 하나뿐이고, 시그니처 변경은 신규 export 라 기존 호출자에 영향이 없다. 유일하게 주목할 지점은 공허성 가드 대기시간(1.5초)이 파라미터화되지 않은 채 모든 호출부에 공유된다는 점인데, 현재 11개 호출부 모두 이미 같은 값을 썼다는 사실이 실측으로 확인돼 있어 지금 시점의 부작용은 아니고, 향후 다른 `lock_timeout` 특성을 가진 삭제 경로가 이 헬퍼를 그대로 재사용할 때만 잠재 위험이 된다(현재 JSDoc 이 이를 명시적으로 경고). 부작용 관점에서 차단 사유는 없다.

## 위험도

NONE
