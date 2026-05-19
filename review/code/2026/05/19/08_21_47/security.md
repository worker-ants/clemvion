# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `isRecipientsLike` — 이메일 주소 형식 검증 없음
  - 위치: `send-email.schema.ts` `isRecipientsLike` 함수 (전체 파일 컨텍스트 기준)
  - 상세: `isRecipientsLike` 는 배열 원소가 비어 있지 않은 문자열인지만 확인하고, 실제 이메일 주소 형식(`user@domain.tld`)은 검증하지 않는다. `normalizeRecipients` 에도 형식 검사가 없다. 결과적으로 `to: ["not-an-email"]` 이나 `to: ["'; DROP TABLE users; --"]` 같은 값도 validate 단계를 통과한다. nodemailer 는 SMTP 수준에서 수신자 주소를 전달하므로, 잘못된 주소는 SMTP 서버가 거부하지만 애플리케이션 레벨에서는 오류가 발생하지 않고 `rejected` 배열에 담긴다.
  - 제안: `zod` 스키마의 `z.array(z.string())` 을 `z.array(z.string().email())` 로 강화하거나, `isRecipientsLike` 내부에 `/.+@.+\..+/.test(v)` 수준의 최소 형식 검사를 추가하는 것을 검토한다. 단, 표현식 원소(`{{ $input.email }}`) 는 런타임에 평가되므로 정적 형식 검증에서 제외하는 예외 처리가 필요하다.

- **[INFO]** `safeMessage` — 내부 오류 메시지가 에러 세부 정보에 노출될 가능성
  - 위치: `send-email.handler.ts` `safeMessage` 함수 (파일 상단 컨텍스트의 `EMAIL_SEND_FAILED` 분기)
  - 상세: catch 블록에서 `IntegrationError` 가 아닌 예외는 `safeMessage(err)` 를 통해 `code: 'EMAIL_SEND_FAILED'` 와 함께 `logUsage` 의 `error` 필드에 기록된다. `safeMessage` 의 구현이 잘린 파일 컨텍스트(`... (truncated)`) 밖에 있어 세부 내용을 확인할 수 없었지만, 함수명으로 보아 민감 정보를 필터링하려는 의도가 있는 것으로 보인다. 만약 `safeMessage` 가 SMTP 서버의 배너 문자열, 자격증명 힌트, 내부 호스트명 등을 그대로 전달한다면 로그를 통한 정보 노출이 발생할 수 있다.
  - 제안: `safeMessage` 가 SMTP 오류에서 자격증명 관련 토큰(비밀번호, 토큰 등)을 마스킹하는지 확인하고, 그렇지 않다면 정규식 치환 등으로 보강한다.

- **[INFO]** `config` echo — `rawConfig` 내 민감 필드 노출 경로 확인 권장
  - 위치: `send-email.handler.ts` `execute` 메서드의 `configEcho` 블록
  - 상세: `configEcho` 는 `rawConfig.integrationId`, `rawConfig.to`, `rawConfig.cc`, `rawConfig.bcc` 를 그대로 출력 결과에 포함한다. `integrationId` 는 식별자이므로 직접 자격증명은 아니지만, `rawConfig` 가 실제 자격증명 필드(예: 인라인 `password`, `token` 등)를 포함하는 경우 해당 값이 `NodeExecution` 테이블에 기록될 수 있다. 현재 코드는 `configEcho` 에서 `integrationId` / to/cc/bcc / subject / body / bodyType / attachments 만 명시적으로 추출하므로 임의 필드가 흘러가는 구조는 아니다. 그러나 스키마가 `.passthrough()` 로 선언되어 있으므로 추가 필드가 실수로 포함될 경우를 대비해 추후 `configEcho` 가 항상 화이트리스트 방식임을 명확히 유지해야 한다.
  - 제안: `configEcho` 를 명시적 화이트리스트 방식으로 유지하는 현행 패턴이 올바르다. `.passthrough()` 스키마에서 직렬화 경로를 별도로 검토해 의도치 않은 필드 노출이 없는지 확인한다.

- **[INFO]** `attachmentSchema` — `content` 필드가 URL 을 허용하며 `disableUrlAccess` 에 의존
  - 위치: `send-email.schema.ts` `attachmentSchema`
  - 상세: `content` 필드는 `z.string()` 으로 선언되어 있으며 테스트에서 `'https://example.com/file'` 같은 URL 이 허용됨을 확인했다. nodemailer 는 URL 을 직접 패치해 첨부 파일로 사용할 수 있으나, `sendMail` 옵션의 `disableUrlAccess: true` 가 이를 차단한다. 이 보안 방어선은 handler 코드에 주석으로 명시되어 있고(`// 보안 방어선 — 사용자 입력으로 임의 파일 시스템 / URL 접근이 발생하지 않도록`), `mapAttachmentsForNodemailer` 도 `path` / `href` 필드를 strip 하는 다중 방어 구조다. 현재 구조는 적절하지만, `disableUrlAccess` 가 향후 nodemailer 버전 업그레이드나 설정 변경으로 누락될 경우 SSRF(Server-Side Request Forgery) 취약점이 발생할 수 있다.
  - 제안: `disableFileAccess: true` 와 `disableUrlAccess: true` 는 현재처럼 하드코딩된 상수로 유지하고, `mapAttachmentsForNodemailer` 의 allow-list 방식도 함께 유지한다. 테스트에 `disableFileAccess` / `disableUrlAccess` 옵션이 sendMail 에 전달되는지 검증하는 케이스가 이미 존재하는 점은 긍정적이다.

### 보안 긍정 사항 (방어 구조 확인)

이번 변경에서 보안 관점에서 개선된 점이 다수 확인된다:

1. **경로 탐색 방어**: `attachmentSchema` 에서 `path` 필드를 의도적으로 제외하고, `mapAttachmentsForNodemailer` 에서 allow-list 추출, `disableFileAccess: true` 로 3중 방어 — 명확히 문서화되어 있다.
2. **SSRF 방어**: `disableUrlAccess: true` 로 URL 첨부 패치 차단.
3. **입력 정규화 개선**: `normalizeRecipients` 에서 문자열 자동 split 로직이 제거되어 공격자가 쉼표를 이용해 수신자를 주입하는 헤더 인젝션 패턴의 위험이 줄었다. 이제 배열만 허용하므로 한 원소가 한 주소에 대응한다.
4. **에러 마스킹**: `maskEmailForErrorDetails` / `truncateForErrorDetails` 사용으로 에러 세부 정보의 이메일 주소가 마스킹된다.
5. **하드코딩된 시크릿 없음**: 자격증명은 `IntegrationsService` 에서 런타임에 조회하며, 코드에 직접 포함되지 않는다.
6. **array-only 정준화**: `to` / `cc` / `bcc` 를 배열 전용으로 고정함으로써 zod ↔ validator 불일치(이전에는 raw string 이 validator 를 통과)가 해소되었다. 이중 레이어 검증 일관성이 확보된 것은 보안 관점에서 긍정적이다.

## 요약

이번 변경(`to/cc/bcc` array-only 정준화)은 보안 관점에서 전반적으로 개선 방향이 올바르다. 수신자 필드를 배열 전용으로 제한함으로써 comma-split 로직이 제거되었고, 이로 인해 단일 문자열에 여러 주소를 섞어 넣는 헤더 인젝션 패턴의 위험이 줄었다. zod 와 임피러티브 validator 의 이중 레이어가 동일 규칙으로 정렬되어 검증 우회 경로가 없어진 것도 긍정적이다. 하드코딩된 시크릿 없음, SSRF·경로 탐색 방어 구조(disableFileAccess/disableUrlAccess + mapAttachmentsForNodemailer allow-list) 는 이번 변경과 무관하게 이미 적절히 구현되어 있다. 개선 여지로는 이메일 주소 형식 검증 부재(표현식 원소 예외 처리 필요), `safeMessage` 함수의 SMTP 오류 마스킹 범위 확인, `.passthrough()` 스키마에서의 configEcho 화이트리스트 유지 필요성 등이 있으나 모두 INFO 수준이다.

## 위험도

LOW
