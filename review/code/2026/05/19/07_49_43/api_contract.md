### 발견사항

- **[WARNING]** 노드 config schema에 신규 필드(`includeSystemContext`, `systemContextSections`) 추가 시 기존 저장된 workflow config와의 하위 호환성
  - 위치: `ai-agent.schema.ts`, `text-classifier.schema.ts`, `information-extractor.schema.ts` — `includeSystemContext` 및 `systemContextSections` 추가 부분
  - 상세: 두 필드 모두 Zod `.default(true)` / `.default(['time', 'timezone'])` 를 갖고 있어, DB에 저장된 기존 workflow config에 해당 키가 없어도 파싱 시 default 값이 주입된다. 그러나 `.passthrough()` 스키마 하에서 기존 저장 config를 역직렬화할 때 default 처리 경로가 일관되게 보장되는지 런타임 동작에 의존한다. 특히 `systemContextSections` 는 `z.array(z.enum([...]))` 로 정의되어 있어, DB에 저장된 구형 config에 이 필드가 없으면 default `['time', 'timezone']` 가 적용되고, 반대로 알 수 없는 값이 들어있으면 Zod validation 실패로 이어진다. 스키마 변경 자체는 additive이므로 엄밀한 breaking change는 아니나, 기존 저장 데이터에 대한 migration 계획 또는 safe-parse fallback이 없으면 잠재적 파싱 실패 위험이 있다.
  - 제안: 저장된 workflow config 역직렬화 경로에서 `.safeParse()` 를 사용하고 실패 시 default config로 fallback하는 패턴이 이미 적용되어 있는지 확인한다. 신규 enum 값 확장(현재 `['time', 'timezone', 'workspace', 'node']`) 이 향후에도 발생할 수 있으므로 `z.array(z.string())` + 런타임 필터링으로 전환하는 것도 고려할 수 있다.

- **[WARNING]** `__workspaceTimezone` 이 내부 execution context variable로 주입되는 방식의 계약 명확성
  - 위치: `execution-engine.service.ts` line ~176, `__workspaceTimezone: typeof workspaceTimezone === 'string' ? workspaceTimezone : ''`
  - 상세: `__workspaceTimezone` 은 double-underscore prefix 로 private/system variable임을 암시하나, 이 필드가 비어있는 문자열(`''`)로 fallback되는 경우 `buildSystemContextPrefixFromContext` 내부에서 어떻게 처리되는지가 API 계약상 중요하다. 빈 문자열이 "UTC"로 해석되는지, 아니면 prefix에서 timezone 섹션이 생략되는지에 따라 LLM이 받는 컨텍스트가 달라진다. 파일 14(system-context-prefix.ts)의 diff가 크기 제한으로 생략되어 상세 구현은 확인 불가.
  - 제안: `__workspaceTimezone`이 빈 문자열일 때의 동작(UTC fallback vs. 섹션 생략)을 spec과 코드 주석에 명시하고, 해당 케이스에 대한 unit test를 `system-context-prefix.spec.ts`에 포함시킨다.

- **[INFO]** Cafe24 MCP 도구 description 변경이 외부 LLM API 호출에 전달되는 도구 스키마를 변경함
  - 위치: `cafe24-mcp-tool-provider.ts` line ~493, `CAFE24_TIMEZONE_SUFFIX` append 부분
  - 상세: 도구 description에 `CAFE24_TIMEZONE_SUFFIX` 를 모든 Cafe24 operation에 일괄 append하는 방식은 LLM에 전달되는 function-calling 스키마의 내용을 변경한다. 이는 외부 Cafe24 API 자체의 계약 변경이 아니라 LLM에 전달되는 메타데이터 변경이므로 breaking change는 아니다. 다만 description 길이가 증가하면 일부 LLM 제공자의 토큰 제한이나 도구 스키마 검증에 영향을 줄 수 있다.
  - 제안: Cafe24 operation 수가 많은 경우 모든 도구에 동일한 suffix를 붙이는 대신, 도구 목록의 preamble이나 system prompt 단계에서 한 번만 명시하는 방식도 검토할 수 있다. 현재 구현은 `spec/conventions/cafe24-api-metadata.md §5.3`의 단일 정책을 따르고 있으므로 spec과의 일관성은 유지된다.

- **[INFO]** `customer.ts`, `product.ts` 필드 description 변경 — 내부 메타데이터 스키마 계약 변경
  - 위치: `customer.ts` `since` 필드, `product.ts` `since`/`until` 필드 (복수 위치)
  - 상세: `'ISO8601 — created_after'` → `'ISO8601 datetime (KST, UTC+9) — created_after. Naive ISO 도 Cafe24 가 KST 로 해석'` 로 description이 업데이트되었다. 이 description은 Cafe24 API의 실제 요청 파라미터 설명이므로, 외부 API 클라이언트가 이 메타데이터를 읽어 자동 문서화하거나 유효성 검증에 활용한다면 영향이 있을 수 있다. 하지만 변경 방향이 더 정확한 타임존 정보를 추가하는 것이므로 실질적 breaking change는 없다.
  - 제안: `until` 필드(`customer.ts`)의 description은 이번 변경에서 업데이트되지 않아 `since`와 명세가 불일치한다(`until`은 여전히 description 없음). 일관성 유지를 위해 `until` 필드에도 동일한 KST 명시를 추가하는 것을 권장한다.

### 요약

이번 변경은 AI 노드들의 LLM system prompt에 워크스페이스 타임존 컨텍스트를 자동으로 주입하는 내부 기능 추가다. 외부 REST API 엔드포인트 추가·삭제·수정이 없고, HTTP 응답 형식·상태 코드·인증/인가 계층에 변화가 없어 전통적인 의미의 API Contract 위반은 없다. 주요 계약 위험은 노드 config schema에 신규 필드 추가로 인한 기존 저장 workflow config 역직렬화 경로의 하위 호환성이며, Zod default 처리가 모든 경로에서 일관되게 동작하는지 확인이 필요하다. 또한 `customer.ts`의 `until` 필드가 `since`와 달리 KST 명시가 없어 메타데이터 스키마 내 일관성 결여가 남아있다.

### 위험도
LOW
