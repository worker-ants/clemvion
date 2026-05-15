## 발견사항

---

### [HIGH] SSRF (Server-Side Request Forgery) via `baseUrl`
- **위치**: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts`
- **상세**: `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })`는 scheme을 제한하지만 내부 IP 대역을 차단하지 않는다. `editor` 권한 사용자가 `baseUrl`에 `http://169.254.169.254/latest/meta-data/`(AWS IMDS), `http://10.0.0.1/`, `http://192.168.1.1/` 등 클라우드 메타데이터 또는 내부망 주소를 입력하면, 서버가 해당 URL로 `listModels()` HTTP 요청을 전송한다. 인증(editor 롤)과 Rate Limit(10/60s)은 있지만, 이 두 가지가 SSRF 자체를 차단하지는 않는다. `require_tld: false`는 Ollama localhost를 지원하기 위해 필요하지만 그 부작용으로 사설 IP 전체를 허용한다.
- **제안**: DTO 또는 서비스 레이어에서 IP 기반 필터링 추가.
  ```typescript
  // 서비스에서 baseUrl을 소비하기 전에 검증
  const parsed = new URL(params.baseUrl);
  const BLOCKED = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/;
  if (BLOCKED.test(parsed.hostname)) throw new BadRequestException(...);
  ```
  단, `127.0.0.1`/`localhost`는 `local` provider에서 허용해야 하므로 provider 타입과 결합해 조건 분기가 필요하다.

---

### [WARNING] Factory 에러 로그에 raw 메시지 기록 (apiKey 포함 가능성)
- **위치**: `backend/src/modules/llm/llm.service.ts` — `previewModels` 첫 번째 catch 블록
- **상세**: `this.logger.warn(`LLM preview client init failed: ${raw}`)` 에서 `raw`는 factory가 던진 원본 에러 메시지다. 코드 주석은 "factory 에러에 apiKey가 없다"고 가정하지만, 일부 SDK(예: Azure OpenAI SDK)가 초기화 실패 시 입력값을 에러 메시지에 포함할 수 있다. 이 경우 평문 API Key가 로그에 기록된다.
- **제안**: factory 에러도 `sanitizeErrorMessage()`를 통과시킨 후 로깅한다.
  ```typescript
  const raw = error instanceof Error ? error.message : String(error);
  const sanitized = this.sanitizeErrorMessage(raw);
  this.logger.warn(`LLM preview client init failed: ${sanitized}`);
  throw new BadRequestException({ code: 'LLM_CONFIG_INVALID', message: sanitized });
  ```

---

### [WARNING] `JSON.parse` 예외 미처리 — `integration-oauth.service.ts`
- **위치**: `backend/src/modules/integrations/integration-oauth.service.ts:303`
- **상세**: 이번 변경 전후 모두 `JSON.parse(preview.credentials)`에 try/catch가 없다. `preview.credentials`가 손상된 문자열이면 처리되지 않은 예외가 발생해 요청이 500으로 종료된다. 이번 diff의 변경 범위는 아니지만, 같은 파일을 수정하면서 발견됐다.
- **제안**: `JSON.parse` 호출을 try/catch로 감싸고 파싱 실패 시 `BadRequestException`을 던진다.

---

### [INFO] `testConnection`이 실제 콘텐츠 생성 호출 수행 (Google Client)
- **위치**: `backend/src/modules/llm/clients/google.client.ts` — `testConnection()`
- **상세**: `this.ai.models.generateContent({ contents: [{ parts: [{ text: 'test' }] }] })` 는 실제 LLM 추론을 호출한다. 연결 확인 목적이라면 `listModels()`처럼 비용이 낮은 API를 사용하는 것이 더 적절하다. 비용 발생 이외의 보안 위험은 없다.

---

### [INFO] `@IsIn` 타입 캐스팅 제거 (다수 DTO 파일)
- **위치**: Files 4, 5, 13, 17, 18, 29
- **상세**: `@IsIn(X as unknown as string[])` → `@IsIn(X)` 변경은 TypeScript 타입 정확도를 높이는 개선이며 런타임 동작은 동일하다. 보안 영향 없음.

---

### [INFO] `as unknown as T` 제거 (테스트 파일 다수)
- **위치**: 다수 `.spec.ts` 파일
- **상세**: 테스트 픽스처에서 타입 우회 캐스팅 제거. 프로덕션 동작에 영향 없음.

---

## 요약

이번 변경의 핵심은 LLM Config 폼에서 저장 전 모델 목록을 미리 조회할 수 있는 `POST /api/llm-configs/preview-models` 엔드포인트 추가다. 엔드포인트 자체에는 `editor` 롤 제한, Rate Limit(10/60s), 30초 타임아웃, 에러 메시지 새니타이징 등 기본적인 보호가 구현되어 있다. 그러나 `baseUrl` 필드가 사설 IP 대역과 클라우드 메타데이터 주소를 차단하지 않아 SSRF 취약점이 존재하며, factory 에러 로그에 평문 API Key가 포함될 가능성도 있다. 나머지 변경(타입 캐스팅 제거, SDK 마이그레이션)은 보안 관점에서 중립적이거나 개선이다.

## 위험도

**MEDIUM** (SSRF 이슈가 `editor` 권한 제한으로 다소 완화되나 미해결 상태)