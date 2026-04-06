## 요구사항 리뷰 결과

### 발견사항

---

**[CRITICAL]** README.md가 프로젝트 실제 내용을 반영하지 않음
- 위치: README.md 전체
- 상세: 현재 README는 NestJS 기본 스캐폴딩 템플릿 그대로입니다. CLAUDE.md 지침에 따르면 README는 "프로젝트의 제품 설명과 실행 방법"을 기술해야 하며, "spec을 참고하여 최종 상태"를 담아야 합니다. Idea Workflow 프로젝트에 대한 설명, 환경 변수 설정(.env), 이메일 인증 기능 등 실제 기능에 대한 내용이 전혀 없습니다.
- 제안: spec 문서를 참고하여 프로젝트 설명, 환경 변수 목록(MAIL_*, JWT_*, DB_* 등), 인증 흐름 등을 포함한 실제 README로 교체

---

**[WARNING]** `sendVerificationEmail`에서 transport가 'console'일 때도 실제 메일 전송 시도
- 위치: `mail.service.ts:23-38`
- 상세: transport가 'console'인 경우 dev 로그를 출력하지만, 이후 `mailerService.sendMail()`을 그대로 호출합니다. 개발 환경에서 `jsonTransport`로 설정되어 있으면 실제로 전송은 안 되지만, 의도가 불명확합니다. console 모드에서 실제 전송을 건너뛰어야 한다면 early return이 필요합니다.
- 제안: console 모드에서 로그 후 early return 처리 또는 명시적 주석으로 의도 명확화

---

**[WARNING]** `frontendUrl`이 undefined일 때 verifyUrl이 `undefined/auth/verify-email?token=...`로 생성됨
- 위치: `mail.service.ts:18-19`
- 상세: `configService.get<string>('app.frontendUrl')`이 undefined를 반환하면 URL이 `"undefined/auth/verify-email?token=xxx"`가 됩니다. 이메일에 잘못된 링크가 포함되어 사용자가 인증 불가능한 상태가 됩니다.
- 제안: frontendUrl 값 검증 추가 또는 필수 값으로 설정하여 서버 시작 시 실패 처리

---

**[WARNING]** `mail.config.ts`에서 host/user/pass가 빈 문자열 기본값
- 위치: `mail.config.ts:6,8,9`
- 상세: SMTP 사용 시 host, user, pass가 필수값임에도 빈 문자열로 폴백합니다. 환경 변수 미설정 시 런타임에서 SMTP 연결 실패로 이어지며, 설정 누락을 조기에 감지할 수 없습니다.
- 제안: transport가 'smtp'일 때 필수 값 검증 추가, 또는 `@nestjs/config`의 validation schema(Joi/class-validator) 적용

---

**[INFO]** 이메일 인증 토큰 만료 검증 테스트 누락
- 위치: `mail.service.spec.ts`
- 상세: 이메일 본문에 "링크는 24시간 동안 유효합니다"라고 명시되어 있으나, 실제 토큰 만료 로직은 MailService에 없고 테스트도 없습니다. 만료 처리가 AuthService에 있다면 무관하지만, 연계 동작에 대한 검증이 없습니다.
- 제안: 토큰 만료 처리 위치 명확화, 해당 위치에 테스트 추가

---

**[INFO]** `MailModule`에 `MailService` 외 다른 메일 타입(비밀번호 재설정 등) 고려 없음
- 위치: `mail.service.ts`
- 상세: 현재 `sendVerificationEmail`만 존재합니다. 스펙에 비밀번호 재설정 이메일 등이 포함되어 있다면 확장이 필요합니다.
- 제안: spec 문서에서 추가 이메일 발송 요구사항 확인 후 구현 또는 TODO 명시

---

### 요약

이번 변경에서 MailService의 핵심 기능(인증 이메일 발송, 개발 환경 콘솔 모드, HTML/text 템플릿)은 대체로 구현되어 있으나, **README가 NestJS 기본 템플릿 그대로 방치된 것이 CRITICAL 이슈**입니다. CLAUDE.md 지침에 명시된 "spec 참고 후 README 업데이트" 의무가 이행되지 않았습니다. 또한 `frontendUrl` 미설정 시 잘못된 인증 링크 발송, console 모드에서의 모호한 동작, SMTP 필수 설정 값의 빈 문자열 폴백 등 엣지 케이스 처리가 미흡하여 운영 환경에서 사용자에게 실질적인 피해를 줄 수 있는 WARNING 수준의 이슈들이 존재합니다.

### 위험도

**MEDIUM**