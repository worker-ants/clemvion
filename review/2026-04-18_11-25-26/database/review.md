### 발견사항

- **[WARNING]** `passwordResetToken` 컬럼 인덱스 부재 가능성
  - 위치: `auth.service.ts` — `findUserByResetToken()` / `resetPassword` 플로우
  - 상세: `findUserByResetToken`은 `WHERE passwordResetToken = ?` 로 User 테이블을 조회한다. 이 컬럼에 인덱스가 없으면 사용자 수 증가 시 전체 테이블 스캔이 발생한다. 변경된 diff 자체가 이 컬럼을 새로 도입한 것은 아니지만, 비밀번호 재설정 메일 발송이 실제로 동작하게 됨으로써 이 쿼리 경로가 처음으로 프로덕션에서 실행될 수 있다.
  - 제안: `passwordResetToken` 컬럼에 `UNIQUE INDEX` 또는 최소 `INDEX` 추가 (`emailVerifyToken`도 동일하게 점검 필요)

- **[WARNING]** 비밀번호 리셋 토큰 평문 저장
  - 위치: `auth.service.ts` — `forgotPassword()` (line ~285)
  - 상세: Refresh Token은 `hashToken()`으로 SHA-256 해시 후 DB에 저장하는데, 비밀번호 재설정 토큰(`passwordResetToken`)은 UUID 원문 그대로 저장된다. DB 유출 시 공격자가 리셋 토큰을 직접 사용해 계정을 탈취할 수 있다. Refresh Token과 설계 일관성도 깨진다.
  - 제안: `hashToken(resetToken)` 해시값을 DB에 저장하고, 검증 시 요청 토큰을 해시한 뒤 비교 (`findUserByResetToken`에서도 동일하게 처리)

- **[INFO]** 토큰 저장과 메일 발송이 단일 트랜잭션 밖에 위치
  - 위치: `auth.service.ts` — `forgotPassword()` 내 `usersService.update()` + `mailService.sendPasswordResetEmail()`
  - 상세: 토큰은 DB에 커밋된 뒤 메일 발송이 실패해도 예외를 삼킨다. 의도된 설계(이메일 열거 방지)이나, DB에 유효한 토큰이 존재하는데 사용자는 이메일을 못 받은 상태가 된다. 운영자 로그로 확인 가능하므로 낮은 심각도이나 재시도 메커니즘 부재로 복구 수단이 없다.
  - 제안: 운영 환경에서 메일 발송 실패 시 별도 큐(예: BullMQ)로 재시도를 보장하는 방식 검토

- **[INFO]** 동시 요청 시 토큰 덮어쓰기
  - 위치: `auth.service.ts` — `forgotPassword()`
  - 상세: 동일 사용자가 짧은 시간 내 여러 번 비밀번호 재설정을 요청하면 이전 토큰이 덮어쓰여진다. 토큰 컬럼에 유니크 제약이 없으면 충돌 없이 통과된다. 비밀번호 재설정 플로우에서는 일반적으로 허용되는 동작이지만, 동시성 제어가 없으므로 rate-limiting이 API 레이어에서 보완되어야 한다.
  - 제안: API 레이어에서 요청 빈도 제한 적용 여부 확인 (DB 레벨 조치 불필요)

---

### 요약

변경 자체가 DB 스키마를 수정하지는 않지만, 비밀번호 재설정 메일 발송이 실제로 활성화되면서 기존에 잠재하던 두 가지 DB 설계 문제가 실질적 위험이 된다. Refresh Token은 해시 후 저장하는 반면 `passwordResetToken`은 평문으로 저장되는 비일관성이 가장 중요한 이슈이며, 메일 발송이 동작하기 시작하면 `findUserByResetToken`의 비인덱스 컬럼 풀스캔도 부하가 커질 수 있다. `mail.service.ts` 변경분은 순수 애플리케이션 레이어로 DB와 무관하다.

### 위험도
**MEDIUM**