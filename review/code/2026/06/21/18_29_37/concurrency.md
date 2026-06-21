# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] 이메일 중복 검사와 DB 쓰기 사이의 TOCTOU 경쟁 조건
- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` (라인 136-142), `verifyEmailChange` (라인 188-215)
- **상세**: `requestEmailChange` 에서 `emailTakenByOther` 로 중복 검사 후 별도 `update` 로 `pendingEmail` 저장까지 두 단계 사이에 다른 사용자가 동일 이메일을 등록할 수 있다. `verifyEmailChange` 에서도 동일한 패턴이 존재한다 — 재검사(`emailTakenByOther`) 후 `update`(email 승격) 사이에 동일 창이 있다. 코드 주석(`email UNIQUE 제약이 race 의 최종 가드`)이 이를 인식하고 있으나, `requestEmailChange` 경로의 `pendingEmail` 저장 단계에는 UNIQUE 제약 가드가 없다 — 두 사용자가 동시에 같은 신규 이메일로 요청하면 둘 다 `pendingEmail` 에 동일 주소를 쓸 수 있다. 최종 `verifyEmailChange` 단계의 UNIQUE 제약이 이를 차단하므로 **데이터 무결성이 깨지지는 않지만**, 두 번째 사용자는 확인 메일을 받고 링크를 클릭한 후에야 409를 받게 되어 사용자 경험이 나빠진다. DB 레벨 UNIQUE 제약이 최종 방어선이므로 위험도는 낮게 평가하나, 가능하면 `requestEmailChange` 에서 `pendingEmail` 저장과 중복 검사를 단일 DB 트랜잭션(또는 `INSERT ... WHERE NOT EXISTS` 류)으로 원자화하는 것이 권장된다.
- **제안**: `verifyEmailChange` 에서의 UNIQUE 위반 처리(`isUniqueEmailViolation`)는 적절하게 구현되어 있다. 추가로 `requestEmailChange` 의 `update` 도 try/catch 로 감싸 혹시 발생할 수 있는 `pendingEmail` 관련 제약 위반을 처리하거나, 별도 DB 트랜잭션으로 묶는 것을 권장.

### [INFO] `resendEmailChange` 에서 토큰 갱신과 메일 발송 사이의 비원자성
- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` — `resendEmailChange` (라인 242-259)
- **상세**: `usersService.update` 로 새 토큰을 DB에 저장한 후 `mailService.sendEmailChangeVerification` 가 실패하면, DB에는 새 토큰이 저장됐지만 메일이 발송되지 않은 상태가 된다. 사용자는 다시 resend를 호출하면 되므로 기능적 블로킹은 없으나, 직전에 저장된 토큰이 메일 없이 1시간 동안 유효한 상태로 남는다. 동일 패턴이 `requestEmailChange` 에도 존재한다. 이는 이메일 발송 자체의 트랜잭션적 한계(네트워크 I/O를 DB 트랜잭션에 포함 불가)로 불가피하나, 실패 시 `clearPendingEmailChange` 를 호출하거나 에러를 caller에게 전파해 재시도를 유도하는 패턴이 더 안전하다.
- **제안**: `sendEmailChangeVerification` 실패 시 예외를 그대로 전파하면 caller가 500을 받아 재시도할 수 있다. 현재 코드(`requestEmailChange`)는 이미 예외를 전파하므로 적절하다. `resendEmailChange` 도 동일 — 현재 구현이 올바르다. 개선 여지 없음(INFO).

### [INFO] `verifyEmailChange` 에서 세션 revoke 후 `findById` 추가 조회
- **위치**: `/codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` (라인 218-223)
- **상세**: `update` 로 이메일을 변경한 후 `revokeAllFamilies`, 그 다음 `findById` 로 updated 사용자를 재조회한다. `revokeAllFamilies` 와 `findById` 사이에 사용자 삭제가 일어날 수는 있으나, 인증된 세션이 이미 있는 상황에서 현실적 위험은 매우 낮다. 단순 INFO.
- **제안**: 조치 불필요.

### [INFO] React `useRef(false)` 가드 — StrictMode 이중 실행 방어
- **위치**: `/codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx` — `VerifyEmailChangeInner` (라인 1199, 1201-1202)
- **상세**: `useRef(false)` + `ran.current = true` 패턴으로 React StrictMode 의 effect 이중 실행에 대한 방어가 적절히 구현되어 있다. 토큰이 1회성임을 인식하고 중복 verify API 호출을 방지하는 올바른 접근이다. 동시성 이슈 없음.
- **제안**: 조치 불필요.

## 요약

이번 변경에서 동시성 관점의 주요 구조적 문제는 없다. `verifyEmailChange` 는 최종 이메일 승격 시 DB UNIQUE 제약 위반을 try/catch 로 명시적으로 처리하고 있어 최악의 경쟁 조건 시나리오를 방어한다. `requestEmailChange` 에서의 TOCTOU는 실제 데이터 무결성 위반 없이 사용자 경험 저하로 국한되므로 허용 가능한 수준이다. async/await 사용은 전 코드에서 일관되고 await 누락 없이 올바르게 작성되었다. 프론트엔드의 `useRef` 가드로 이벤트 루프/React StrictMode 이중 실행 위험도 적절히 차단되어 있다. DB UNIQUE 제약이 최종 방어선으로 기능하는 현행 설계는 NestJS 싱글 스레드 이벤트 루프 환경에서 실용적으로 충분하다.

## 위험도

LOW

---

*분석 범위: 파일 1~17 (SQL 마이그레이션, auth.service.ts, sessions.service.ts, mail.service.ts, users.service.ts, users.controller.ts, DTO, Entity, 프론트엔드 페이지/테스트)*
