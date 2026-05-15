## 발견사항

### 파일: `mail.service.ts`

- **[INFO]** HTML 템플릿 매 호출 시 재생성
  - 위치: `buildPasswordResetHtml()` / `buildVerificationHtml()`
  - 상세: 이메일 발송 시마다 ~800자의 HTML 문자열을 새로 생성합니다. 이메일 서비스 특성상 호출 빈도가 낮아 실질적 영향은 없지만, 구조적으로 정적 부분과 동적 부분이 혼합된 템플릿 리터럴입니다.
  - 제안: 현재 규모에서는 변경 불필요. 대용량 발송이 필요할 경우 Handlebars 등 템플릿 엔진 도입을 고려.

- **[INFO]** `escapeHtml` 다중 정규식 패스
  - 위치: `mail.service.ts` `escapeHtml()` (기존 코드, 신규 경로도 동일하게 사용)
  - 상세: `&`, `<`, `>`, `"`, `'` 5회 순차 `.replace()` 호출. 단일 패스로 최적화 가능하나 짧은 name 문자열 대상이므로 성능 영향 없음.
  - 제안: 현재 규모에서는 변경 불필요.

### 파일: `auth.service.ts`

- **[INFO]** `forgotPassword` — DB 기록 후 메일 발송의 순차 처리
  - 위치: `auth.service.ts` `forgotPassword()` 285~300줄
  - 상세: `usersService.update` (토큰 저장) → `sendPasswordResetEmail`의 순서는 종속 관계상 올바릅니다. 메일 실패 시 토큰은 DB에 잔존하나 사용자가 링크를 받지 못하는 구조입니다. 재시도 메커니즘이 없어 메일 발송 실패 시 사용자는 다시 요청해야 합니다.
  - 제안: 현재 구조는 단순성 측면에서 적절. 가용성이 중요해지면 메일 재시도를 위한 큐(e.g., Bull) 도입을 고려.

### 파일: `auth.service.spec.ts`

- **[INFO]** `createService()` 반복 호출로 인한 테스트 모듈 재컴파일
  - 위치: `mail.service.spec.ts` 각 `describe` 블록 마지막 테스트
  - 상세: `createService({ 'mail.transport': 'console' })`가 별도 NestJS 테스팅 모듈을 컴파일합니다. 테스트 내부이므로 운영 성능에는 무관하나 테스트 실행 시간에 미세한 영향.
  - 제안: 영향 미미, 현 구조 유지.

---

## 요약

이번 변경은 비밀번호 재설정 이메일 발송 기능을 `TODO`에서 실제 구현으로 전환한 것으로, 성능 관점에서 실질적 위험 요소는 없습니다. DB 업데이트 후 메일 발송의 순차 흐름은 데이터 일관성상 올바르고, HTML 템플릿 생성과 `escapeHtml` 처리는 이메일 서비스의 낮은 호출 빈도를 고려하면 과최적화 없이 적절한 수준입니다. 기존 `sendVerificationEmail`과 동일한 패턴을 일관되게 따르고 있어 유지보수성도 양호합니다.

## 위험도

**NONE**