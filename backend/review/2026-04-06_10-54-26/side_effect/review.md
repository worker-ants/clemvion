## 리뷰 결과

### 발견사항

**[WARNING]** `console` transport 모드에서도 실제 메일 전송 시도
- 위치: `mail.service.ts:26-38` (`sendVerificationEmail`)
- 상세: `transport === 'console'` 일 때 로그만 찍고 **그대로 `mailerService.sendMail()` 까지 호출**합니다. `jsonTransport: true` 설정이므로 실제 발송은 안 되지만, mailer 내부에서 네트워크/소켓 시도 없이 JSON 직렬화만 한다는 전제가 필요합니다. 개발 환경에서 의도가 "로그만 남기고 끝"이라면 early return이 명시적으로 더 안전합니다.
- 제안:
  ```ts
  if (transport === 'console') {
    this.logger.log(`[DEV] Verification email for ${email}: ${verifyUrl}`);
    return; // 명시적 early return
  }
  ```

**[WARNING]** `frontendUrl`이 undefined일 때 잘못된 URL 조용히 생성
- 위치: `mail.service.ts:21-22`
- 상세: `app.frontendUrl`이 설정되지 않으면 `verifyUrl`이 `"undefined/auth/verify-email?token=..."` 형태가 되어 발송은 되지만 링크가 깨집니다. 에러 없이 통과하므로 발견이 어렵습니다.
- 제안: config 로드 시점에 validate하거나, 메서드 상단에서 값 유효성 확인 후 throw.

**[INFO]** `mail.config.ts`에서 `MAIL_PORT` 파싱 실패 시 `NaN` 전달
- 위치: `mail.config.ts:7`
- 상세: `MAIL_PORT`에 숫자가 아닌 값이 들어오면 `parseInt`가 `NaN`을 반환하고, mailer가 이를 port로 사용 시 연결 실패가 발생합니다. 기본값 `587`이 있지만 환경변수가 존재하되 잘못된 경우는 기본값이 적용되지 않습니다.
- 제안:
  ```ts
  port: parseInt(process.env.MAIL_PORT ?? '587', 10) || 587,
  ```

**[INFO]** README.md가 NestJS 기본 템플릿 그대로
- 위치: `README.md` 전체
- 상세: 프로젝트 실제 설정(환경변수 목록, mail 설정 등)이 전혀 반영되지 않음. `CLAUDE.md`에 따르면 구현 완료 후 README를 spec 기준으로 정리해야 합니다. 부작용 문제는 아니지만 운영자가 잘못된 설정으로 배포할 가능성이 있습니다.

---

### 요약

mail 모듈 자체는 전역 상태 변경, 파일시스템 부작용, 예상치 못한 네트워크 호출 없이 비교적 안전하게 구현되어 있습니다. 다만 `console` transport일 때 `sendMail`을 계속 호출하는 흐름과, `frontendUrl` 미설정 시 조용히 잘못된 URL이 생성되는 부분이 잠재적 부작용으로, 운영 환경에서 의도치 않은 동작을 일으킬 수 있습니다. `MAIL_PORT` 파싱도 방어 처리가 필요합니다.

---

### 위험도

**LOW**