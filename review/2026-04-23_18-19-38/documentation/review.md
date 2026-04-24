## 발견사항

### [WARNING] `google.client.ts` — 핵심 아키텍처 주석 다수 제거
- **위치**: `google.client.ts` — `sanitizeGeminiSchema`, `buildContents`, stream 루프
- **상세**: Gemini API의 비자명한 제약 조건을 설명하던 주석들이 삭제되었습니다.
  - `sanitizeGeminiSchema`에서 왜 빈 `properties`/`items`에 `null`을 반환하는지 (Gemini가 빈 ObjectSchema를 400으로 거부하기 때문) 설명이 사라짐
  - `buildContents`(구 `buildChatInputs`)에서 `'tool'` role을 `'function'`으로 매핑해야 하는 이유(SDK가 `'user'` role 안의 `functionResponse`를 400으로 거부) 설명 제거
  - 신 SDK에서 `aggregated response fallback`(사용량 토큰 2차 조회)이 제거된 이유에 대한 설명 없음
- **제안**: 아래 세 곳에 최소 한 줄 주석 복원 권장

```ts
// Gemini 는 빈 properties 를 가진 ObjectSchema 를 거부 → null 반환으로 parameters 자체를 생략
if (Object.keys(sanitizedProps).length === 0) return null;

// 신 SDK(generateContentStream)는 청크마다 usageMetadata 를 누적하므로 aggregated response 불필요
for await (const raw of stream) { ... }
```

---

### [WARNING] `preview-llm-models.dto.ts` — Swagger 설명에 SSRF 방어 의도 누락
- **위치**: `preview-llm-models.dto.ts` `baseUrl` 필드 `@ApiPropertyOptional`
- **상세**: `@IsUrl({ protocols: ['http', 'https'] })`로 `file://`, `ftp://` 등을 차단하고 있지만, Swagger description에 이 보안 제약이 명시되어 있지 않습니다. API 소비자가 왜 특정 URL이 거부되는지 알 수 없습니다.
- **제안**: 설명에 `"http/https 스킴만 허용 (SSRF 방어)"` 추가

---

### [INFO] `llm.service.ts` — `withTimeout` 메서드에 문서 없음
- **위치**: `llm.service.ts:207` `private async withTimeout<T>`
- **상세**: 재사용 가능한 일반 유틸리티이지만 문서가 전혀 없습니다. 특히 `finally` 절에서 타이머를 정리하는 이유(메모리 누수 방지)가 비자명합니다.
- **제안**: 단 한 줄로 충분 — `// Ensures the timer is GC'd even if p rejects before the timeout fires.`

---

### [INFO] `google.client.ts` — `fnCallToToolCall` 헬퍼 위치
- **위치**: 파일 맨 끝 (클래스 밖)
- **상세**: 파일 하단에 standalone 함수로 추출되었는데, 동일 파일 내 `chat()`과 `stream()` 양쪽에서 사용됩니다. 이름이 자명하므로 주석은 불필요하지만, `generateToolCallId()`와 함께 파일 상단으로 옮기면 독자가 관련 유틸을 한 곳에서 찾을 수 있습니다.

---

### [INFO] MDX 문서 — "모델 불러오기" 동작 설명이 두 파일 간 미세한 표현 차이
- **위치**: `llm-config.en.mdx` vs `llm-config.mdx`
- **상세**: 영문본은 "The form can fetch the list **before saving** using the credentials you entered"이고, 한국어본은 "생성 단계에서도 폼에 입력된 자격증명으로 미리 조회돼요"로 의미는 동일하나 수정(edit) 플로우에 대한 설명은 영문본에만 spec과 다르게 누락되어 있습니다. `spec/2-navigation/6-config.md`에는 수정 플로우(DB 암호화 키 fallback)가 명시되어 있는데 MDX docs에는 없습니다.
- **제안**: 두 MDX 파일 모두 수정 플로우 설명 추가 권장

---

## 요약

전체적으로 이번 변경은 문서화 수준이 양호합니다. 신규 `preview-models` 기능은 Swagger 데코레이터, spec 문서(`spec/5-system/7-llm-client.md §5.5`, `spec/2-navigation/6-config.md`), 사용자 문서(MDX), i18n 키까지 일관되게 업데이트되었습니다. 주요 우려 사항은 `google.client.ts`에서 Gemini API의 비자명한 제약(빈 스키마 거부, functionResponse role 규칙)을 설명하던 아키텍처 주석이 SDK 마이그레이션 과정에서 대거 삭제된 점으로, 미래 기여자가 코드를 수정할 때 동일한 제약을 재발견해야 할 위험이 있습니다.

## 위험도

**LOW**