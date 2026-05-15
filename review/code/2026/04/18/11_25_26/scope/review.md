## 발견사항

### 요약

이번 변경은 비밀번호 재설정 이메일 발송 기능(`forgotPassword`의 `TODO` 제거 → 실제 메일 발송)을 완성하는 단일 목적의 변경입니다. 4개 파일 모두 해당 기능과 직접적으로 연관되어 있으며, 관련 없는 리팩토링·포맷 변경·임포트 정리·설정 변경은 발견되지 않았습니다.

- `auth.service.ts`: TODO 제거 및 실제 `sendPasswordResetEmail` 호출 추가. try/catch로 메일 실패를 삼켜 이메일 열거 공격을 차단하는 보안 의도가 명확함.
- `auth.service.spec.ts`: MailService 목(mock)에 `sendPasswordResetEmail` 추가, 기존 테스트에 부정 호출 단언 추가, 신규 동작(성공·실패 경로) 테스트 2개 추가. 모두 범위 내.
- `mail.service.ts`: `sendVerificationEmail`과 동일한 패턴으로 `sendPasswordResetEmail` 및 HTML/텍스트 빌더 추가. 범위 내.
- `mail.service.spec.ts`: 기존 `sendVerificationEmail` 테스트를 미러링한 5개 테스트 추가(정상, XSS 이스케이프, URL 인코딩, 에러, 콘솔 transport). 범위 내.

**추가 관찰(INFO):**

- **[INFO]** `buildPasswordResetText`에서 `name`이 HTML 이스케이프 없이 삽입됨
  - 위치: `mail.service.ts` - `buildPasswordResetText`
  - 상세: 플레인 텍스트 이메일이므로 XSS 위험은 없음. 의도적이며 올바름. 다만 `buildPasswordResetHtml`와 대칭성을 고려한 명시적 주석이 있었다면 가독성이 더 높았을 것.
  - 제안: 현행 유지 가능 (플레인 텍스트에서 HTML 이스케이프는 불필요)

### 위험도

**NONE**