## 발견사항

- **[WARNING]** `forgotPassword`의 TOCTOU(Time-of-Check-Time-of-Use) 경쟁 조건
  - 위치: `auth.service.ts` — `forgotPassword` 메서드 (findByEmail → update → sendPasswordResetEmail 시퀀스)
  - 상세: 동일 이메일로 두 요청이 동시에 들어오면 아래 순서가 발생할 수 있음:
    1. 요청 A, B 모두 `findByEmail` → 동일 user 반환
    2. 각자 `resetToken_A`, `resetToken_B` 생성
    3. A가 DB에 `tokenA` 저장 → B가 `tokenB`로 덮어씀
    4. A는 `tokenA`로 이메일 발송, B는 `tokenB`로 이메일 발송
    5. 결과: A의 이메일 링크는 DB에 없는 토큰 → 클릭 시 실패
  - 제안: DB 레벨 upsert + 조건부 갱신(예: `WHERE passwordResetToken IS NULL OR passwordResetExpiresAt < NOW()`)으로 원자적 처리, 또는 이미 유효한 토큰이 있는 경우 재사용. 완전한 해결은 DB 트랜잭션 + SELECT FOR UPDATE 또는 단일 원자적 UPDATE 사용.

- **[INFO]** DB 저장과 메일 발송 간 비원자적 시퀀스
  - 위치: `auth.service.ts` — update 후 sendPasswordResetEmail 호출
  - 상세: 토큰 DB 저장 성공 → 메일 발송 실패 시 사용자는 유효한 토큰을 알 수 없음. 반대로 메일 발송 성공 → DB 저장 실패는 현재 코드상 불가능(순서가 update → mail). 현재 에러 스왈로우 전략과 조합하면 운영자 로그만으로 추적 가능하므로 허용 가능한 수준.
  - 제안: 허용 가능 수준이나, 메일 발송 실패 시 `passwordResetToken`을 null로 롤백하거나 재시도 큐(예: Bull MQ)를 사용하면 완결성 보장 가능.

---

## 요약

변경된 코드는 Node.js 단일 스레드 이벤트 루프 환경이므로 전통적 멀티스레드 경쟁 조건은 존재하지 않으나, `forgotPassword`의 비동기 DB 조회 → 토큰 생성 → 저장 → 메일 발송 시퀀스가 동시 요청 간 비원자적으로 수행되어 TOCTOU 경쟁 조건이 발생한다. 실제 보안 영향은 제한적(사용자 UX 저하 수준)이지만, 고부하 환경에서 재현 가능한 버그다. `async/await` 사용은 올바르고, 데드락·이벤트 루프 블로킹·리소스 풀 이슈는 없다.

### 위험도
**LOW**