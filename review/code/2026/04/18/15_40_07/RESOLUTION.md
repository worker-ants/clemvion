# Code Review Resolution — 2026-04-18 15:40

리뷰 범위: `HEAD~2..HEAD` (commits `7a5a9cf` 노드 변수 자동완성 개선, `0fb0492` 엣지 자동 정리).

---

## CRITICAL — 모두 해결

### C1. `enrichInfoExtractorOutputSchema` 단위 테스트 누락 → **해결**
- 해당 함수를 범용 훅에서 분리해 `frontend/src/components/editor/expression/node-output-schema-enrichers.ts`로 이동.
- 신규 테스트 파일 `__tests__/node-output-schema-enrichers.test.ts` 추가 — 11개 케이스:
  - `undefined baseSchema`, `undefined config`, 빈 배열, 비-배열
  - 사용자 필드 정상 주입, 기존 `extracted.properties` 병합, 기본 타입 폴백
  - 이름 누락/비문자열/비문자열 스킵
  - `__proto__`/`constructor`/`prototype` 차단 (프로토타입 오염 방지)
  - 공백·하이픈·숫자시작 등 식별자 규칙 위반 스킵
  - `output.properties` 부재 시 경고 로그 + 클론 반환
  - `output` 노드에 `properties` 없을 때 자동 초기화

### C2. `getSchemaKeys` / `resolveSchemaNode` / `schemaTypeLabel` 테스트 누락 → **해결**
- `frontend/src/components/editor/expression/__tests__/resolve-nested-path.test.ts`에 `describe("getSchemaKeys")` 블록 추가 — 10개 케이스:
  - undefined 스키마 / 루트 / 중첩 / items 배열 unwrap / 브래킷 인덱스
  - 미존재 경로 / primitive leaf / type 배열 (`["string","null"]`)
  - `MAX_DEPTH` 초과 / type·properties 없을 때 `"unknown"` / properties-only object 추론

---

## WARNING — 모두 해결

### W1. `dropStaleEdges` 묵시적 삭제 → **해결**
- 함수 시그니처를 `{ edges, dropped }` 튜플 반환으로 변경.
- `editor-loader.tsx`에서 dropped 개수가 있을 때 `toast.warning(...)`로 사용자에게 노출. 메시지: "N개의 엣지가 현재 노드 설정과 맞지 않아 제거되었습니다. 저장 시 워크플로우에 반영됩니다."

### W2. `insertText` 변경과 `isExpandable` 소비자 정합성 → **확인 완료**
- `Suggestion.isExpandable`은 `expression-input.tsx:handleSelect`에서만 소비됨 (line 126-160). 공백/dot 자동 추가 로직이 이미 존재하여 신규 필드와 호환. `variable-picker.tsx`의 `isExpandable`은 독립적인 지역 변수로 무관.

### W3. IE enricher OCP/SRP 위반 → **해결**
- 신규 파일 `frontend/src/components/editor/expression/node-output-schema-enrichers.ts`로 로직 분리.
- `use-expression-context.ts`는 `enrichInfoExtractorOutputSchema`를 import만 수행. 향후 노드 타입별 enricher 추가 시 이 파일에 함수만 추가하면 됨.

### W4. 빈 Set wildcard 의미론 모호성 → **해결**
- `dropStaleEdges`에서 "포트 없음"과 "알 수 없는 타입"을 구분하도록 `Set<string> | null` 타입으로 변경. `null` = permissive skip, `Set` = 엄격 검증.

### W5. `getExpressionToken` 경계 조건 버그 (`between[-1]`) → **해결**
- 명시적 `isUnescapedQuoteAt(k)` 헬퍼 도입. `k === 0 || between[k-1] !== "\\"` 조건으로 경계 안전성 보장.

### W6. `JSON.parse(JSON.stringify(...))` → **해결**
- `structuredClone`으로 교체 (없는 환경 대비 폴백 유지).

### W7. 백엔드 Zod 출력 스키마 `safeParse` 테스트 누락 → **해결**
- `ai-agent.schema.spec.ts`에 `describe("aiAgentNodeOutputSchema")` 추가 — 6개 케이스 (single/multi waiting/multi final/condition/passthrough/reject wrong type).
- 신규 `text-classifier.schema.spec.ts` — 5개 케이스.
- 신규 `information-extractor.schema.spec.ts` — 6개 케이스.

### W8. `$node["X"].meta.<path>` 폴스루 미검증 → **해결**
- `use-expression-suggestions.test.ts`에 `describe("$node.meta path fallthrough")` 추가하여 의도된 빈 결과 반환 문서화.

### W9. `sourceHandle: null` 케이스 미테스트 → **해결**
- `edge-utils.test.ts`에 null 핸들 케이스 테스트 추가 (단일 기본 핸들 노드 지원).

### W10. `beforeAll` 상태 오염 → **해결**
- `dropStaleEdges` describe 블록이 이전 `definitions`를 스냅샷으로 받아 합성하여 서로 간섭하지 않도록 수정.

### W11. 이스케이프 따옴표 포함 노드 키 → **해결 (제한 문서화)**
- 토크나이저는 `\"`를 올바르게 처리하지만 매처 regex(`[^"]+`)가 이스케이프를 인식하지 못하는 pre-existing 한계. 테스트로 현재 동작을 고정하고 limitation으로 명시. 실제 사용 빈도가 극히 낮아 추후 과제로 남김.

### W12. 프로토타입 오염 방지 → **해결**
- `SAFE_IDENTIFIER_RE`와 `UNSAFE_KEYS` 블록리스트로 사용자 필드명 검증. `__proto__`/`constructor`/`prototype`, 공백/하이픈/숫자 시작 등을 차단. 저장소는 `Object.create(null)` 사용으로 이중 방어.

### W13. `.passthrough()` 과도 사용 → **해결 (문서화)**
- 세 개 스키마의 JSDoc에 "AUTOCOMPLETE HINT SCHEMA — not used for runtime validation" 명시. 해당 스키마는 프론트엔드 자동완성 힌트 목적이며, `z.toJSONSchema()`로 직렬화되어 UI에서만 사용됨. 런타임 핸들러 리턴 검증에는 사용하지 않으므로 허용성(permissiveness)이 안전.

### W14. `ai_agent`(플랫) vs `information_extractor`(중첩) 구조 불일치 → **해결 (문서화)**
- 세 스키마의 JSDoc에 flat vs nested 차이 명시 및 원인 설명 (handler contract 차이 — bare object vs legacy port-selector). 통일은 breaking handler refactor가 필요하므로 향후 과제.

### W15. `enrichInfoExtractorOutputSchema` silent fail → **해결**
- `output.properties` 부재 시 `process.env.NODE_ENV !== "production"` 가드 하에 `console.warn` 출력하여 백엔드 스키마 드리프트를 개발 중 인지 가능.

### W16. `useExpressionContext` 선형 탐색 → **해결**
- 훅 시작부에 `nodeById = new Map(nodes.map((n) => [n.id, n]))` 사전 구성. `nodes.find()` 두 곳 호출을 `nodeById.get()`으로 교체.

---

## 검증

- **Frontend**: `pnpm test` 784/784 통과 (신규 31개 테스트 추가), `pnpm lint` / `pnpm build` 통과.
- **Backend**: `pnpm test` 1318/1318 통과 (신규 17개 테스트 추가), `pnpm lint` / `pnpm build` 통과.

---

## 미해결 INFO 사항 (후속 과제)

리뷰의 INFO 항목은 이번 라운드에서 처리하지 않음:

1. 프론트엔드 `INFO_EXTRACTOR_TYPE_MAP`과 백엔드 타입 열거 중복 — 추후 공통 모듈로 추출 고려
2. `getSchemaKeys`의 `resolve-nested-path.ts` 혼재 — 파일 규모 증가 시 `json-schema-utils.ts`로 분리
3. `Promise.all` 구조분해 주석 보강 — 가독성 미세 개선
4. `spec/` 및 frontend `/docs` 갱신 — 사용자 설명서 차원 갱신 필요
5. `WorkflowEditorLoader` `dropStaleEdges` 통합 테스트 — 현재 유닛 레벨로 충분히 검증, E2E/통합은 별도 라운드

위 항목은 다음 리팩터링 사이클에서 검토 예정.
