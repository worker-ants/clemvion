# 동시성(Concurrency) 리뷰 — refresh 토큰 rotation 원자화 (05 C-1)

## 발견사항

### [WARNING] TOCTOU 잔존 창 — findOne 과 트랜잭션 진입 사이

- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` `refresh()` lines 531–593
- **상세**: `findOne({ where: { tokenHash } })` → 만료 검증(`new Date() > stored.expiresAt`) → `isRevoked` 검증 → 트랜잭션 진입 순서로 진행된다. 트랜잭션 진입 이전의 상태 읽기(findOne)와 트랜잭션 내 조건부 UPDATE 사이에 경쟁 창이 남는다. 조건부 UPDATE(`{ id, isRevoked: false, expiresAt: MoreThan(new Date()) }`)가 이 창을 **대부분 닫아** 이중 회전을 차단하지만, reuse-detection 분기(이미 `isRevoked=true` 인 경우)와 만료 분기는 여전히 트랜잭션 밖 비원자 판단이다. 이 두 분기는 읽기 전용(family revoke UPDATE 포함)이므로 중복 실행 시 멱등성은 유지된다 — 심각도는 낮지만 동시성 관점에서 명시 필요.
- **제안**: 현행 조건부 UPDATE(`affected=0` 차단)가 정상 회전 경로의 TOCTOU 를 닫는 핵심 방어이며 올바르게 구현됐다. reuse-detection 및 만료 분기의 트랜잭션 밖 실행은 멱등적 UPDATE 이므로 허용 범위. 추가 강화가 필요하다면 `SELECT FOR UPDATE` (비관적 락)를 도입하되, 현재 설계에서는 불필요하다고 판단.

### [INFO] resolveTokenWorkspaceContext 가 트랜잭션 홀드 타임을 연장

- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` `generateTokens()` line 758 — `resolveTokenWorkspaceContext(user)` 호출이 `manager` 트랜잭션 콜백 내부에서 실행됨
- **상세**: `resolveTokenWorkspaceContext` 는 최대 3회의 순차 DB 읽기 쿼리를 수행한다. 이 읽기가 트랜잭션 커넥션을 점유한 채 실행되어 커넥션 풀 점유 시간이 연장된다. NestJS/TypeORM 의 기본 커넥션 풀 크기(10)에서 refresh 요청이 집중될 경우 커넥션 경합이 발생할 수 있다. 단, refresh 빈도와 트랜잭션 홀드 시간이 모두 짧아 실제 영향은 미미하며 이전 리뷰(SUMMARY.md INFO 1)에서도 인식된 항목이다.
- **제안**: 트랜잭션 홀드 최소화가 필요할 경우, `resolveTokenWorkspaceContext` + JWT sign 을 `dataSource.transaction` 콜백 호출 전에 선계산하고 결과(context, accessToken)를 클로저로 전달. 현 규모에서는 후속 plan 아이템으로 충분.

### [INFO] reuse-detection 분기의 family revoke 가 트랜잭션 없이 수행됨

- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` `refresh()` lines 544–562
- **상세**: 토큰 재사용 탐지 시 `refreshTokenRepository.update({ familyId }, { isRevoked: true })` + `loginHistory.record()`가 트랜잭션 없이 순차 실행된다. family revoke UPDATE 성공 후 loginHistory.record() 실패 시 불일치가 남는다. 이는 본 변경(05 C-1)의 범위 밖 기존 코드이며 `loginHistory` 실패가 보안 이벤트 손실이지 세션 정합성 손실이 아니므로 허용 가능 수준. 다만 동시성 관점에서 동일 family 토큰 동시 재사용 탐지 시 UPDATE 가 중복 실행될 수 있으나 `isRevoked: true` 멱등 재지정이므로 데이터 손상은 없다.
- **제안**: 현행 유지. 별도 가드가 필요하다면 `loginHistory.record()` 실패를 단독 try/catch 로 격리해 family revoke 의 신뢰성을 높일 수 있다(본 변경 범위 밖).

### [INFO] async/await 사용 — 문제 없음

- **위치**: `auth.service.ts` 전체 변경 분
- **상세**: 모든 비동기 호출(`findOne`, `update`, `save`, `transaction`)에 `await` 가 빠짐없이 적용됐다. `dataSource.transaction(async (manager) => { ... })` 콜백 안에서도 `await` 누락 없음. Promise 체인 미사용, 콜백 지옥 없음. `generateTokens` 의 `async/await` 체인이 트랜잭션 콜백에 올바르게 합류한다.

### [INFO] 이벤트 루프 블로킹 없음

- **위치**: `auth.service.ts` 변경 분 전체
- **상세**: `bcrypt` 해시, `uuidv4`, `createHash` 등 CPU 바운드 연산이 존재하나 이는 기존 코드 패턴이며 본 변경이 추가한 연산이 아니다. 신규 추가된 코드(`MoreThan(new Date())`, `result.affected` 판단)는 모두 동기 경량 연산으로 이벤트 루프 블로킹을 유발하지 않는다.

## 요약

이번 변경의 핵심인 `dataSource.transaction` 을 통한 revoke+INSERT 원자화와 조건부 UPDATE(`isRevoked=false AND expiresAt>now`)를 통한 TOCTOU 이중 회전 차단은 동시성 관점에서 올바르게 구현됐다. `affected=0` 시 신규 토큰 미발급 로직이 동시 refresh 경쟁을 안전하게 처리한다. `async/await` 누락, 데드락, 잘못된 동기화, 스레드 안전성 문제는 없다. 잔존 관찰 사항은 `resolveTokenWorkspaceContext` 의 트랜잭션 내 실행으로 인한 커넥션 홀드 연장(INFO 수준, 이미 인식된 후속 개선 항목)과 reuse-detection 분기의 트랜잭션 외 실행(멱등적, 기존 코드 패턴)뿐이며 즉각 차단이 필요한 동시성 결함은 없다.

## 위험도

LOW
