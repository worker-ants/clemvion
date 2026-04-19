### 발견사항

---

**[WARNING] URL 자격증명이 에러 details에 그대로 노출됨**
- 위치: `http-request.handler.ts` — non-2xx 응답 처리 블록 및 catch 블록
- 상세: `sanitizeUrlCredentials(url)` 는 `config.url` 에만 적용됨. `output.error.details.url` 에는 원본 `url` 변수가 그대로 삽입됨. HTTP 오류 발생 시 `https://user:pass@host/path` 형태의 자격증명이 `output.error.details.url` 로 노출됨.
  ```typescript
  // config는 sanitize됨
  url: sanitizeUrlCredentials(url),
  // 그러나 details에는 raw URL 사용
  details: { url, method },         // ← 자격증명 노출
  ```
- 제안: `details` 내 URL 필드에도 동일하게 `sanitizeUrlCredentials(url)` 적용

---

**[WARNING] 코드 핸들러가 스택 트레이스를 output에 노출**
- 위치: `code.handler.ts` — `buildErrorResult` 반환값
- 상세: `output.error.details.stack` 및 `meta.stack` 양쪽에 스택 트레이스가 포함됨. 프로덕션에서는 내부 파일 경로, 프레임워크 버전, 코드 구조가 외부에 노출될 수 있음.
  ```typescript
  output: { error: { ...(stack ? { details: { stack, ... } } : {}) } },
  meta: { ..., stack, ... },
  ```
- 제안: 환경변수(`NODE_ENV`)에 따라 프로덕션에서는 스택 트레이스를 제거하거나, `meta.stack`을 내부 로깅으로만 사용하고 `output`에는 포함하지 않음

---

**[INFO] `send-email.handler.ts`의 ternary 표현식이 항상 동일한 값 반환 (dead code)**
- 위치: `send-email.handler.ts` — catch 블록
- 상세: 조건에 관계없이 항상 `'EMAIL_SEND_FAILED'` 를 반환하여 `IntegrationError`의 원래 코드가 유실됨. 기능 버그이자 에러 코드 다양성 손실.
  ```typescript
  const code =
    err instanceof IntegrationError
      ? 'EMAIL_SEND_FAILED'   // ← IntegrationError도 동일
      : 'EMAIL_SEND_FAILED';
  ```
- 제안: `err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED'` 로 수정

---

**[INFO] 에러 details에 사용자 입력 데이터 포함**
- 위치: `text-classifier.handler.ts` — LLM 오류 catch 블록, `send-email.handler.ts` — catch 블록
- 상세: `details: { originalInput: inputField }` (text-classifier), `details: { to, subject }` (send-email) 형태로 사용자 입력 데이터가 에러 응답에 포함됨. 분류 대상 텍스트나 이메일 수신자 같은 PII가 에러 로그/응답에 남을 수 있음.
- 제안: `originalInput`은 길이 제한(예: 100자) 후 truncate, 이메일 주소는 마스킹(`u***@example.com`) 처리 고려

---

**[INFO] `_resumeState` 필드가 어댑터의 legacy-bare 브랜치를 통해 flat cache에 저장됨**
- 위치: `handler-output.adapter.ts` — bare object 처리 브랜치
- 상세: legacy bare 객체 반환 시 `_resumeState` 가 output flat cache에 포함됨. 현재는 expression resolver가 이를 노출하지 않지만, 향후 resolver 변경 시 내부 상태가 workflow 표현식에서 접근 가능해질 위험이 있음.
- 제안: resolver 레이어에서 `_` 접두사 필드를 명시적으로 필터링하는 방어 코드 추가 검토

---

### 요약

이번 변경의 보안적 방향성(URL 자격증명 sanitize, 표준화된 에러 envelope, `_resumeState` 격리)은 전반적으로 긍정적입니다. 그러나 `sanitizeUrlCredentials` 함수가 `config.url` 에만 적용되고 `output.error.details.url` 에는 원본 URL이 그대로 사용되어 자격증명 노출 방지 효과가 절반에 그칩니다. 스택 트레이스가 `output` 에 직접 포함되는 것도 프로덕션 환경에서의 정보 노출 위험입니다. send-email 핸들러의 ternary dead code는 기능 버그이기도 합니다.

### 위험도

**MEDIUM**