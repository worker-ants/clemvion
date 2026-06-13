# 성능(Performance) 리뷰 결과

## 발견사항

### [INFO] `AuditLogsService.record` — 매 호출마다 `auditLogRepository.create` + `save` 로 단건 INSERT
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 82~91행
- 상세: `record()` 는 매 호출 시 TypeORM `create()` + `save()` 를 호출해 단건 INSERT 쿼리를 발생시킨다. 현재 call site(비밀번호 변경, 2FA enable/disable, WebAuthn 등록/삭제)는 사용자 요청당 1회만 호출되므로 N+1 이슈는 없다. 그러나 `save()` 는 TypeORM 내부적으로 `SELECT` 후 `INSERT` 를 수행하는 경우가 있어(entity 가 새 인스턴스면 생략되지만 구현에 따라 다름), 고빈도 감사 이벤트 환경에서는 `insert()` 나 QueryBuilder `insert().values().execute()` 가 더 경량이다. 현재 규모(인증 이벤트 단건)에서는 성능 문제 없음.
- 제안: 즉각 조치 불필요. 향후 고빈도 감사 이벤트(예: workflow 실행 단계별 기록)가 추가될 때 `auditLogRepository.insert(...)` 로 교체하거나 배치 큐(BullMQ 기존 인프라 활용) 방식을 검토한다.

### [INFO] `AuditLogsService.record` — 오류 삼킴(try/catch swallow) 패턴과 불필요한 객체 생성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 82~96행
- 상세: 실패 경로에서도 `auditLogRepository.create(...)` 로 entity 객체가 먼저 생성된 뒤 `save()` 에서 예외가 발생해 GC 대상이 된다. 이는 실패 빈도가 매우 낮을 것이므로 실질적 성능 영향은 없다. 구조적으로는 문제 없음.
- 제안: 변경 불필요.

### [INFO] `webauthn.controller.ts` `webauthnRegisterVerify` — `result.webauthnRecoveryCodes.length > 0` 연산
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` diff 기준 `firstCredential: result.webauthnRecoveryCodes.length > 0`
- 상세: `webauthnRecoveryCodes` 배열의 `length` 속성 참조는 O(1) 이다. 배열 전체를 순회하거나 복사하지 않으므로 성능 영향 없음. 다만 `length > 0` 대신 `length !== 0` 또는 `!!result.webauthnRecoveryCodes.length` 도 동일하며 어느 표현이든 성능 차이 없음.
- 제안: 변경 불필요.

### [INFO] 테스트 파일 내 `await bcrypt.hash('OldP@ssw0rd1', 4)` — 테스트 실행 시간 관점
- 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts` (diff 249행, 269행), `codebase/backend/src/modules/users/users.controller.spec.ts` (기존 패턴)
- 상세: `it` 블록 내부에서 `await bcrypt.hash(...)` 를 직접 호출한다. bcrypt `saltRounds=4` 는 테스트 용도로 최소화되어 있으나, 같은 테스트 스위트에서 동일 해시를 여러 `it` 블록이 반복 생성하면 테스트 실행 시간이 불필요하게 늘어날 수 있다. `auth.controller.spec.ts` 에서 `disable2fa` 관련 `it` 2건이 각각 `bcrypt.hash('OldP@ssw0rd1', 4)` 를 개별 호출한다.
- 제안: `beforeAll` 에서 한 번만 해시를 계산해 변수에 저장하면 테스트 실행이 소폭 단축된다. 필수 사항은 아님(round=4 에서 영향 미미).

## 요약

이번 변경(user.* 감사 액션 3종 추가)은 성능 관점에서 실질적 위험이 없다. 신규 call site 는 사용자 인증 이벤트당 1회의 단건 DB INSERT 를 추가하는 것이 전부이며, 반복 루프 내 호출·N+1 쿼리·메모리 누수·블로킹 I/O·불필요한 연산은 발견되지 않는다. `AuditLogsService.record()` 의 단건 INSERT 패턴은 현재 사용 규모에서 적절하고, TypeORM `save()` 가 향후 고빈도 감사 이벤트로 확장될 때 `insert()` 또는 비동기 큐 방식으로 전환하는 것이 권장된다. 테스트 내 `bcrypt.hash` 반복 호출은 `saltRounds=4` 수준에서 영향이 미미하다. 알고리즘 복잡도, 캐싱, 데이터 구조, 지연 로딩 관점에서 새로 도입된 코드의 우려 사항은 없다.

## 위험도

NONE

STATUS: SUCCESS
