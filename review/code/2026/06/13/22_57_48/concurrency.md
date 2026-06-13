# 동시성(Concurrency) Review

## 발견사항

### [INFO] 비밀번호 변경 → 세션 회전이 단일 트랜잭션이 아님 (revoke-all + reissue 비원자성)
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` `rotateSessionAfterPasswordChange` (L744-754), `codebase/backend/src/modules/users/users.controller.ts` `changePassword` (L138-198)
- 상세: 비밀번호 변경 플로우는 서로 독립된 비동기 단계의 순차 실행이다 — (1) `usersService.changePassword`(bcrypt hash + UPDATE), (2) `sessionsService.revokeAllFamilies`(refresh_token bulk UPDATE + login_history INSERT), (3) `usersService.findById`, (4) `generateTokens`(새 refresh_token INSERT), (5) cookie set, (6) audit record. 이들을 묶는 트랜잭션이 없다. 중간(예: 2와 4 사이) 프로세스 크래시 시 "모든 family revoke 됐으나 새 세션 미발급" 상태가 가능하나, 이는 보안상 fail-safe 방향(=로그아웃)이며 사용자는 새 비밀번호로 재로그인 가능하므로 실질 위험은 낮다. 기존 refresh-rotation 경로는 `generateTokens(manager)` 로 revoke+INSERT 를 원자화하는 반면 이 경로는 그렇지 않다는 점만 일관성 차원에서 기록.
- 제안: 필수 아님. 단계 간 부분 실패의 결과가 "추가 revoke" 로 안전측이므로 현 설계 수용 가능. 추후 일관성을 원하면 revoke+reissue 를 `dataSource.transaction` 으로 감싸는 것을 고려.

### [INFO] revokeAllFamilies 의 read-then-write 가 비원자적이나 멱등하여 무해
- 위치: `codebase/backend/src/modules/auth/sessions.service.ts` `revokeAllFamilies` (L479-506)
- 상세: `findById`(존재 확인) → `update({ userId, isRevoked:false }, { isRevoked:true })` 의 check-then-act 사이에 동일 사용자가 새 family 를 만들면(동시 로그인) 그 family 는 revoke 대상에서 빠질 수 있는 TOCTOU 여지가 이론상 존재한다. 그러나 (a) `UPDATE ... WHERE isRevoked=false` 는 DB 레벨 단일 원자 연산이고, (b) 비밀번호 변경 본인이 동시에 다른 디바이스에서 정상 로그인할 현실적 동시성은 극히 낮으며, (c) `affected` 카운트 기반 분기도 해당 UPDATE 의 반환값만 사용하므로 경쟁으로 인한 데이터 손상은 없다. bulk audit 기록(`familyId=null`)도 `affected>0` 일 때만 수행되어 무해.
- 제안: 조치 불요.

### [INFO] audit/login_history record 의 fire-and-forget 의미 유지 — await 누락 없음
- 위치: `users.controller.ts` (L187-194), `auth.controller.ts` (L159-167, L183-191), `webauthn.controller.ts` (L152, L349)
- 상세: 모든 `auditLogsService.record(...)` 및 `loginHistory.record(...)` 호출에 `await` 가 정상 부착되어 있다. 누락된 await 나 떠다니는 Promise(floating promise)는 없다. `extractClientIp(req) ?? undefined` 동기 호출도 부수효과 없는 순수 추출이라 경쟁 없음.
- 제안: 없음.

### [INFO] forwardRef 순환 의존 — DI 구성 변경일 뿐 런타임 동시성 무관
- 위치: `auth.module.ts` (L222), `users.module.ts` (L1232-1236), `users.controller.ts` 생성자 `@Inject(forwardRef(() => AuthService))`
- 상세: AuthModule↔UsersModule 순환을 forwardRef 로 해소한 것은 Nest DI 그래프 구성 시점의 문제이며 락/스레드/이벤트루프 동시성과 무관하다. 데드락(락 순서) 개념의 데드락이 아니라 모듈 초기화 순환이며 forwardRef 로 정상 해소됨.
- 제안: 없음.

## 요약
변경 전반은 NestJS(Node 단일 이벤트 루프) 기반의 순차 async/await 오케스트레이션으로, 공유 가변 상태·락·스레드 풀·뮤텍스가 도입되지 않았다. await 누락이나 floating promise 없고, 동시성 위험의 핵심인 `revokeAllFamilies` 의 bulk revoke 는 DB 레벨 단일 UPDATE 로 원자적이며 결과 분기도 그 반환값만 사용해 경쟁 조건이 없다. 비밀번호 변경 → 세션 회전 플로우가 단일 트랜잭션으로 묶이지 않아 부분 실패 가능성이 있으나, 실패 시 결과가 "세션이 더 많이 revoke 됨"(fail-safe = 로그아웃)으로 수렴하므로 데이터 무결성·보안 위험이 아니다. 데드락·이벤트 루프 블로킹·풀 고갈 징후 없음.

## 위험도
LOW
