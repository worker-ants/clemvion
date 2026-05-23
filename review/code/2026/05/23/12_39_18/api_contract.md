# API 계약(API Contract) 리뷰 — `ButtonDef.userMessage` 신설 + render_* 클릭 합성

## 발견사항

이 변경은 HTTP REST/GraphQL API 엔드포인트 추가·수정이 아니라, 내부 노드 설정 스키마(`ButtonDef`)에 옵션 필드 1개를 추가하고 프론트엔드 클릭 합성 헬퍼를 확장하는 작업입니다. 그러나 `ButtonDef` 는 WebSocket 프로토콜 페이로드(`buttonConfig`)와 AI Agent `render_*` tool parameter JSON Schema 에 직접 노출되는 공개 계약이므로 아래 관점을 적용합니다.

---

### 1. 하위 호환성

- **[INFO]** `userMessage` 는 `z.string().optional()` 로 선언되어 있습니다.
  - 위치: `carousel.schema.ts`, `chart.schema.ts`, `table.schema.ts`, `template.schema.ts` — 각 `buttonDefSchema` 내 신규 필드.
  - 상세: 기존 클라이언트가 `userMessage` 를 포함하지 않은 페이로드를 전송해도 Zod 파싱이 통과합니다. 기존 LLM tool call 결과에도 필드가 없으면 그냥 `undefined` 가 됩니다. Breaking change 없음.
  - 제안: 별도 조치 불필요.

- **[INFO]** `button.types.ts` 의 TypeScript 인터페이스 `ButtonDef` 에 `userMessage?: string` 이 추가됩니다.
  - 위치: `/codebase/backend/src/nodes/presentation/_shared/button.types.ts` — `ButtonDef` 인터페이스.
  - 상세: Optional 필드이므로 기존 소비 코드 (`hasPortButtons`, `hasOnlyLinkButtons`, `validateButtons`) 는 수정 없이 동작합니다. 구조적 타이핑상 기존 `ButtonDef` 객체 리터럴도 여전히 호환됩니다.
  - 제안: 별도 조치 불필요.

---

### 2. 버전 관리

- **[INFO]** API 버전 번호 변경 없음.
  - 상세: 옵션 필드 추가는 관례상 minor 변경으로 버전 bump 없이 허용되는 패턴입니다. 이 코드베이스는 URL-level versioning (`/v1/`, `/v2/`) 대신 WebSocket 프로토콜 버전을 쓰는 구조이며, 해당 프로토콜 버전 변경 흔적은 이 diff 에 없습니다.
  - 제안: 불필요. 다만 WebSocket protocol 문서(`spec/5-system/6-websocket-protocol.md`)에 `buttonConfig.buttons[*].userMessage` 신규 필드 표기가 누락되어 있다면 cross-spec 문서를 갱신하는 것이 좋습니다(이미 일관성 검토에서 INFO 수준으로 식별된 항목과 연관).

---

### 3. 응답 형식

- **[INFO]** 각 `buttonDefSchema` 는 `.passthrough()` 를 사용하고 있어 알 수 없는 추가 필드도 그대로 통과합니다.
  - 위치: `carousel.schema.ts:342`, `chart.schema.ts:591`, `table.schema.ts:1058`, `template.schema.ts:1577`.
  - 상세: `passthrough()` 는 `userMessage` 가 없는 기존 페이로드도 문제없이 처리하고, 미래에 필드가 더 추가되어도 스키마 재정의 없이 수용합니다. 단, `.passthrough()` 는 런타임 타입 보장을 약화시킵니다.
  - 제안: 현재 설계 방침상 허용 패턴으로 보임. 변경 불필요.

- **[INFO]** `tableNodeOutputSchema` 의 `config.buttons` 배열이 `buttonDefSchema` 를 참조하고 있어 output schema 에도 `userMessage` 가 자동 반영됩니다.
  - 위치: `table.schema.ts` 내 `tableNodeOutputSchema`.
  - 상세: config echo 원칙(Principle 7)에 따라 입력된 `userMessage` 가 output 의 `config.buttons[*]` 에도 그대로 echo 됩니다. 별도 문제 없음.

---

### 4. 에러 응답

- **[INFO]** `validateButtons` 함수(`button.types.ts`)가 `userMessage` 필드에 대한 유효성 검증을 수행하지 않습니다.
  - 위치: `/codebase/backend/src/nodes/presentation/_shared/button.types.ts:114-181`.
  - 상세: 현재 구현은 `id`, `label`, `type`, `url`, `style` 에 대해서는 imperative 검증을 수행하지만 `userMessage` 에 대해서는 아무런 검증도 없습니다. 스펙 상 `type: "link"` 일 때 `userMessage` 는 무시(warning 수준)이며, 필드 자체는 string optional 이므로 별도 reject 불필요. 다만 매우 긴 문자열(예: 10,000자)이 들어올 경우의 제한이 없습니다.
  - 제안: 보안·UX 측면에서 `userMessage` 에 최대 길이 제한(`maxLength`)을 Zod 레이어 또는 `validateButtons` 에 추가하는 것을 고려하세요. 현재 상태는 MEDIUM 수준이 아닌 LOW/INFO 수준 — 명시적 요구사항 없으면 즉각 차단 불필요.

---

### 5. 요청 검증

- **[INFO]** `userMessage` 가 `type: "link"` 버튼에 설정된 경우 Zod 파싱 단계에서는 통과됩니다.
  - 위치: `carousel.schema.spec.ts` — `it('preserves userMessage on link-typed buttons at parse-time ...')` 테스트가 명시적으로 이 동작을 문서화합니다.
  - 상세: 스펙에 따르면 `type: "link"` + `userMessage` 조합은 클릭 시 무시(프론트엔드 책임). 파싱 단계에서 reject 하지 않는 것이 의도된 설계입니다. 테스트가 이를 보장하므로 계약은 명확합니다.
  - 제안: 별도 조치 불필요. 현재 테스트로 충분히 문서화됨.

- **[INFO]** `userMessage` 빈 문자열 처리가 프론트엔드(`composeUserMessage`)에서 "무시하고 다음 우선순위 적용"으로 처리됩니다.
  - 위치: `assistant-presentations-block.tsx:composeUserMessage` 및 해당 테스트.
  - 상세: LLM 이 `userMessage: ""` 를 명시적으로 보내면 의도가 모호하다고 판단하여 fallback 합성을 사용합니다. 이 결정은 테스트(`userMessage 가 빈 문자열이면 무시하고 다음 우선순위 적용`)에 문서화되어 있습니다.
  - 제안: 이 동작이 백엔드 스키마 레이어에는 반영되어 있지 않습니다(Zod schema 는 빈 문자열을 valid 로 통과). 백엔드 스키마에서 `z.string().min(1).optional()` 로 변경하거나 현재처럼 프론트엔드에서만 처리하거나를 명시적으로 결정하는 것이 권장됩니다. 계약상 모호점이 있으나 현재는 INFO 수준.

---

### 6. URL/경로 설계

- 해당 없음. 이 변경은 HTTP URL 경로 변경을 포함하지 않습니다.

---

### 7. 페이지네이션

- 해당 없음. 목록 API 변경이 없습니다.

---

### 8. 인증/인가

- 해당 없음. 이 변경은 새 엔드포인트를 추가하거나 기존 엔드포인트의 인증/인가 정책을 변경하지 않습니다.

---

## 요약

이 변경은 REST HTTP API 엔드포인트 신설·수정이 아니라 내부 `ButtonDef` 스키마에 `userMessage?: string` 옵션 필드를 추가하고, AI Agent `render_*` 버튼 클릭 시 user message 합성 로직을 확장한 작업입니다. 옵션 필드로 추가되었으므로 기존 클라이언트·WebSocket 페이로드·LLM tool parameter JSON Schema 와의 하위 호환성은 유지됩니다. `validateButtons` 에 `userMessage` 길이 제한이 없다는 점과 빈 문자열 처리가 Zod 레이어와 프론트엔드 간에 일관되지 않다는 점이 INFO 수준 개선 항목으로 식별되었으나, 즉각적인 API 계약 파괴 위험은 없습니다. 전체적으로 API 계약 관점에서 이 변경은 안전합니다.

## 위험도

NONE
