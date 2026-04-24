## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `isDefault` 트랜잭션 패턴 중복**
- 위치: `llm-config.service.ts` — `create()`, `update()` 메서드
- 상세: 두 메서드 모두 `manager.update(isDefault=false) → manager.save()` 패턴을 트랜잭션 내에서 동일하게 구현한다. isolation level 변경, 이벤트 발행 추가, 로깅 등이 필요해지면 두 곳을 동시에 수정해야 한다.
- 제안: `clearDefaultAndSave(manager, entity, workspaceId): Promise<LlmConfig>` 같은 private 헬퍼로 추출해 단일 구현체를 공유하도록 한다.

---

**[WARNING] google.client.ts — 중요 이유 설명 주석 제거**
- 위치: `google.client.ts` — `parseJsonObject`, `toFunctionResponseObject`, `sanitizeGeminiSchema` 내부 등 다수
- 상세: `parseJsonObject`가 파싱 실패 시 `{}`를 반환하는 이유, `ArraySchema.items`가 필수인 이유, `ObjectSchema`에서 빈 properties를 거부하는 이유 등 Gemini API 제약을 설명하는 WHY 주석들이 제거되었다. 이런 제약은 API 문서를 별도로 찾지 않는 한 코드만 봐서는 이해하기 어렵다.
- 제안: "WHAT" 주석(코드가 이미 설명하는 것)은 제거하되, Gemini 특유의 제약을 설명하는 "WHY" 주석은 유지한다.

---

**[WARNING] stream 핸들러의 인라인 익명 chunk 타입**
- 위치: `google.client.ts` — stream for-await 루프 내부
- 상세: chunk를 `as { candidates?: Array<...>; usageMetadata?: {...} }` 인라인 타입으로 캐스팅한다. SDK 응답 구조가 바뀌면 이 익명 타입을 검색해 수정해야 하며, 다른 곳에서 재사용할 수도 없다.
- 제안: `type GoogleStreamChunk = { candidates?: ...; usageMetadata?: ... }` 명명 타입으로 추출한다.

---

**[WARNING] `as never` 캐스트 정리 불완전**
- 위치: `jwt.strategy.spec.ts:102` — `mockUser as never` 잔존
- 상세: 이번 변경에서 다수의 `as never` / `as unknown as T` 캐스트를 제거했으나, 같은 파일 내 `mockUser as never`는 남아있다. 의도적 잔존인지 누락인지 구분이 어렵다.
- 제안: 잔존 캐스트가 필요한 이유(`// @ts-expect-error` 와 함께)를 명시하거나, 타입이 맞다면 함께 제거한다.

---

**[INFO] package.json transformIgnorePatterns — 맥락 설명 없음**
- 위치: `backend/package.json`
- 상세: pnpm flat 구조를 처리하기 위한 비자명 정규식으로 변경되었으나 관련 설명이 없다. 향후 정규식을 단순화하면 pnpm 환경 테스트가 다시 깨질 수 있다.
- 제안: 주변 주석 파일(예: `jest.config.js`) 또는 PR 설명에 "pnpm hoisting으로 인해 `.pnpm/<pkg>/node_modules/` 경로를 함께 처리" 맥락을 남긴다.

---

**[INFO] `buildToolConfig` 반환 타입이 장황하고 재사용되지 않음**
- 위치: `google.client.ts` — `buildToolConfig` 메서드 시그니처
- 상세: 멀티라인 인라인 제네릭 반환 타입이 메서드 시그니처에만 존재한다. Gemini SDK 타입을 직접 쓸 수 없어 수동 타입을 작성한 것으로 보이나, 변경 시 찾기 어렵다.
- 제안: 파일 상단에 `type GeminiFunctionTool = { functionDeclarations: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }> }` 타입을 선언해 시그니처를 단순화한다.

---

**[INFO] `llm.service.ts` — `isPrivateHost` 함수 복잡도**
- 위치: `llm.service.ts` — `isPrivateHost` (~45줄)
- 상세: IPv4, IPv6 loopback, ULA, link-local, IPv4-mapped IPv6 분기를 한 함수에서 처리해 순환 복잡도가 약 10이다. 보안 요구사항상 필요한 복잡도이고 주석도 적절하나, 추가 IP 범위가 생기면 한계점에 도달할 수 있다.
- 제안: 현재 범위에서는 허용 가능하나, 범위가 늘어나면 `isPrivateIPv4(a, b)` / `isPrivateIPv6(prefix)` 서브함수로 분리한다.

---

### 요약

이번 변경의 핵심은 테스트 코드 전반의 `as unknown as Type` / `as any` / `as never` 불필요 캐스트 일괄 제거, Google SDK 대형 마이그레이션(`@google/generative-ai` → `@google/genai`), LLM 모델 preview API 신규 추가다. 캐스트 정리는 가독성을 크게 향상시키고, SSRF 가드·타임아웃·rate limit을 갖춘 `previewModels` 구현은 책임이 잘 분리되어 있다. 주된 유지보수성 위험은 두 가지다: Google 클라이언트의 마이그레이션 과정에서 Gemini API 제약을 설명하는 WHY 주석이 제거된 점(향후 실수 유발 가능), 그리고 `llm-config.service.ts`의 `create`/`update` 양쪽에 동일한 트랜잭션 패턴이 중복된 점. 나머지 이슈는 마이너하거나 정보 수준이다.

### 위험도

**LOW**