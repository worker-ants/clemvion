# 보안(Security) Review — 알림 이메일 발송 경로 (PR2)

## 발견사항

- **[INFO]** 이메일 헤더 인젝션 방어 — subject 만 CR/LF sanitize, message 는 방어 불요이나 근거가 코드 근접성에 의존
  - 위치: `codebase/backend/src/modules/mail/mail.service.ts` `sendNotificationEmail()` (subject 라인, `notification.title.replace(/[\r\n]+/g, ' ')`)
  - 상세: `title` 은 워크플로/통합 이름 등 사용자 입력에서 유래할 수 있는 문자열이며, 이메일 `subject` 헤더에 그대로 들어가므로 CR/LF 를 포함하면 `Bcc:`, `Cc:` 등 임의 헤더 주입(헤더 인젝션/이메일 스푸핑) 위험이 있다. 이번 diff 는 `replace(/[\r\n]+/g, ' ')` 로 개행을 공백 치환해 방어했고, `mail.service.spec.ts` 에 `Bcc: attacker@evil.com` 페이로드로 회귀 테스트도 추가돼 있다(양호). `message`/`type` 은 `to`/`subject` 헤더가 아니라 본문(HTML escape 됨) 또는 로그에만 쓰이므로 헤더 인젝션 벡터가 아니다.
  - 제안: 현재 구현으로 충분. 다만 `to` 필드는 `User.email`(DB 값)을 그대로 사용하는데, 이 값 자체에 CR/LF 가 저장될 수 있는 입력 경로(회원가입/이메일 변경)가 있다면 `mailerService`/nodemailer 계층이 이를 어떻게 처리하는지 별도로 확인해두면 안전(이번 diff 범위 밖의 기존 계약이므로 INFO).

- **[INFO]** 알림 본문 XSS 방어 확인 — 적절히 구현됨
  - 위치: `mail.service.ts` `buildNotificationHtml()`(safeTitle/safeMessage = `escapeHtml()`), `mail.service.spec.ts` `<script>`/`<img onerror>` 테스트
  - 상세: `escapeHtml()` 은 `&`, `<`, `>`, `"`, `'` 5종 모두 이스케이프하는 표준 HTML entity escape 이며, `title`/`message` 모두 HTML 파트에 삽입 전 이 함수를 통과한다. plain-text 파트(`buildNotificationText`)는 HTML 렌더링 컨텍스트가 아니므로 escape 불요라는 판단도 타당하다. 테스트가 XSS 페이로드(`<script>`, `onerror`)로 실제 이스케이프 여부를 검증해 회귀에 안전하다.
  - 제안: 조치 불필요.

- **[INFO]** User email 조회 시 컬럼 최소화(select) — 양호한 관행
  - 위치: `notifications.service.ts` `dispatchEmails()` — `userRepository.find({ where: { id: In(userIds) }, select: { id: true, email: true } })`
  - 상세: `password` 등 민감 컬럼을 조회 대상에서 배제하고 `id`/`email` 만 select 하여 과다노출(over-fetching)을 방지했다. TypeORM `In()` 파라미터 바인딩으로 SQL 인젝션 벡터도 없음.
  - 제안: 조치 불필요.

- **[INFO]** 발송 실패 시 에러 스택을 서버 로그에만 기록 — 사용자 노출 없음
  - 위치: `mail.service.ts` `sendNotificationEmail()` catch 블록(`this.logger.error(..., err.stack)`), `notifications.service.ts` `sendOneEmail()`/`dispatchEmails()` catch 블록(`this.logger.warn(...)`)
  - 상세: 에러 메시지·스택은 서버 사이드 로거로만 전파되며, `notify()`/`createMany()` 호출자에게는 예외가 전파되지 않는(best-effort) 설계다. HTTP 응답이나 클라이언트로 스택 트레이스가 노출될 경로는 diff 범위 내에 없음. `sendNotificationEmail` 자체는 throw 하지만 이는 `NotificationsService.sendOneEmail` 이 즉시 catch 해 삼키므로 최종 사용자 노출 없음.
  - 제안: 조치 불필요.

- **[INFO]** IDOR/권한검증은 이번 diff 범위 밖(PR1에서 이미 확립된 계약)
  - 위치: `notifications.service.ts` `dispatchEmails(rows)` — `rows[].userId` 를 신뢰해 해당 사용자에게 이메일 발송
  - 상세: 이번 PR 은 이미 저장된 `Notification` row(그 자체의 `userId` 소유권 검증은 상위 `notify()`/`createMany()` 호출자 책임, PR1 범위)를 받아 그 소유자에게만 메일을 보낸다. 새로운 엔드포인트나 사용자 입력에 의한 임의 userId 지정 경로는 diff 에 없으므로 권한 우회 벡터가 새로 생기지 않았다.
  - 제안: 조치 불필요 — 참고로만 기록.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 전체 diff
  - 상세: SMTP 자격증명·API 키 등은 `ConfigService` 경유로만 참조되며(`frontendUrl`, `transport` 등 non-secret 설정값만 diff 에 등장), 코드에 직접 노출된 시크릿 없음.
  - 제안: 조치 불필요.

## 요약

이번 PR2(알림 이메일 발송 경로 + `email_sent_at` 라이프사이클) 변경은 보안 관점에서 전반적으로 견고하다. XSS(HTML escape 5종 전체), 이메일 헤더 인젝션(subject CR/LF 치환) 두 핵심 벡터 모두 코드 레벨 방어와 회귀 테스트(공격 페이로드 기반 unit test)가 갖춰져 있고, User 조회는 컬럼을 최소화(`select`)했으며 TypeORM 파라미터 바인딩으로 SQL 인젝션 벡터도 없다. 에러 처리는 best-effort 정책에 따라 스택/메시지를 서버 로그에만 남기고 호출자·클라이언트에 민감정보를 노출하지 않는다. 새로 도입된 권한 경계나 사용자 입력 처리 표면이 없어(기존 저장된 row 를 소비하는 내부 파이프라인) 인증/인가 회귀도 발견되지 않았다. 하드코딩된 시크릿도 없다.

## 위험도
NONE
