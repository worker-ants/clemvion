# 동시성(Concurrency) 리뷰 결과

## 발견사항

변경 코드는 주로 다음 두 가지 리팩터로 구성된다.

1. `AuthController.disable2fa`에서 bcrypt 비교 로직을 `AuthService.verifyPasswordForUser`로 이관 (C-3)
2. 대응하는 테스트 코드 갱신 (컨트롤러 spec, 서비스 spec)

동시성 관점에서 검토한 결과는 아래와 같다.

### 긍정적 관찰 (변경 전후 모두)

- **[INFO]** `refresh` 토큰 회전(revoke + INSERT)이 `DataSource.transaction` 단일 트랜잭션 안에서 원자적으로 처리되며, 조건부 UPDATE(`affected` 체크)로 동시 회전(concurrent rotation) 시 이중 발급을 차단한다. 테스트(`rotates revoke + issue inside a single transaction`, `rejects without issuing a token when the conditional revoke matches 0 rows`)가 이 원자성을 명시적으로 검증하고 있다.
  - 위치: `auth.service.spec.ts` lines 1932–1976
  - 이 패턴은 이번 변경과 무관하나, 변경 파일 내에 포함되어 있어 확인.

### 이번 변경에서 신규 도입된 코드의 동시성 검토

- **[INFO]** `verifyPasswordForUser`는 순수 읽기(findById) + bcrypt.compare 로만 구성된다. 공유 가변 상태를 건드리지 않고, 결과를 DB write 없이 throw/return으로 반환하므로 경쟁 조건 없음.
  - 위치: `auth.controller.ts` line 991, `auth.service.spec.ts` lines 1271–1317

- **[INFO]** `disable2fa` 핸들러는 `verifyPasswordForUser` → `totpService.disable` → `auditLogsService.record` 순서로 순차 `await`한다. 병렬화 없음, 데드락 위험 없음.
  - 위치: `auth.controller.ts` lines 991–1003

- **[INFO]** 테스트에서 `bcrypt.hash`를 `beforeEach` 내부가 아닌 개별 `it` 블록 최상위에서 `await`로 직접 호출한다. Jest는 각 테스트를 직렬 실행하므로 문제없으나, 테스트 자체의 async 안전성은 확보되어 있다.
  - 위치: `auth.service.spec.ts` lines 1291, 1307

## 요약

이번 변경(C-3 리팩터)은 컨트롤러 레이어의 bcrypt 비교를 서비스 레이어로 이동하는 단순 책임 재배치다. 신규 `verifyPasswordForUser`는 상태를 변경하지 않고 읽기+비교만 수행하므로 경쟁 조건, 데드락, 동기화 문제가 발생할 여지가 없다. 기존에 구현되어 있던 refresh 토큰 원자적 회전 패턴(트랜잭션 + 조건부 UPDATE)도 이번 변경의 영향을 받지 않는다. 동시성 관점에서 이번 변경은 무결하다.

## 위험도

NONE

---

STATUS=success ISSUES=0
