# 코드 리뷰 조치 내역

> 리뷰 대상 세션: `2026-04-16_12-43-33` (Complex node config auto-form 마이그레이션)
> 본 조치는 AiAgent/Carousel의 auto-form 마이그레이션 PR에 대한 리뷰 피드백 처리.

## CRITICAL 조치

| # | 항목 | 조치 |
|---|------|------|
| 1 | Condition `id` 자동생성 누락 — `FieldArrayWidget`이 새 항목 추가 시 `id: undefined`로 삽입되어 `conditionDefSchema.id` 필수 검증 실패 | `FieldArrayWidget.buildNewItem()` 함수 신설. 아이템 스키마의 `required` 필드 중 `id` 또는 `*Id`로 끝나는 문자열 타입 필드에 `crypto.randomUUID()` 자동 생성. 스키마 `default`도 함께 적용. 이 방식은 AI Agent뿐 아니라 향후 모든 구조화된 배열에 일관된 동작 제공 |
| 2 | `widgets.tsx` ↔ `widget-registry.ts` 순환 의존성 | `widget-resolver.ts` 모듈 신설. `registerWidgets()` / `resolveWidget()` 런타임 API로 의존성 단방향화:<br>- `widgets.tsx` → `utils.ts` → `widget-resolver.ts` (no cycle)<br>- `widget-registry.ts` → `widgets.tsx` + `registerWidgets(...)` 호출 (terminal)<br>- `pickWidget`에서 registry 접근은 `resolveWidget()`으로 lazy 조회하여 모듈 init 순서 독립성 확보 |
| 3 | 핵심 로직 단위 테스트 전무 | 신규 테스트 5종 추가:<br>· `auto-form/__tests__/visibility.test.ts` — `isFieldVisible` 3가지 규칙 (equals/notEquals/oneOf) + 엣지케이스<br>· `auto-form/__tests__/utils.test.ts` — `humanize`, `applyClearFields` (프로토타입 오염 방어 포함)<br>· `auto-form/__tests__/schema-form.test.ts` — `groupEntries`, `countGroupValues` (visibility 필터링 포함)<br>· `backend/src/nodes/ai/ai-agent/ai-agent.schema.spec.ts` — default 파싱, visibleWhen, group 메타데이터 검증<br>· `backend/src/nodes/presentation/carousel/carousel.schema.spec.ts` — **`mode.clearFields`가 `items`/`itemButtons`를 포함하지 않는지 regression test**<br>→ 기존 `nodes.integration.spec.ts`의 `defaultConfig ↔ configSchema` 정합성 테스트와 함께 총 35개 테스트 추가 |
| 4 | 표현식 인젝션 / SSTI 위험 | **본 PR 범위 외** — 기존 `ExpressionInput` 컴포넌트와 서버 evaluation 레이어의 기존 문제로, 모든 override 컴포넌트에서도 동일하게 사용 중. auto-form 이관과 무관하게 표현식 엔진 샌드박스 레이어에서 일괄 처리 필요 (후속 과제로 이관) |
| 5 | `.passthrough()`로 인한 임의 필드 주입 | **본 PR 범위 외** — 프로젝트 전체 25개 스키마 공통 패턴으로, 별도 리뷰(2026-04-15)에서 "handler 내부 runtime validate 수행, 기능 퇴행 없음"으로 결론. 일괄 `.strip()` 전환은 별도 스프린트 필요 |

## WARNING 조치

| # | 항목 | 조치 |
|---|------|------|
| 1 | Carousel `clearFields` 데이터 손실 회귀 | `carousel.schema.ts`의 `mode.clearFields`에서 `items`, `itemButtons` 제거 + 회귀 방지 regression test 추가. 나머지 필드(`source`, `titleField` 등)는 파생 설정이므로 clear 유지. 사용자 authored 콘텐츠는 `visibleWhen`으로 숨기만 하고 데이터 보존 |
| 2 | `TableGridWidget` 계약 불일치 (미연결 dead code) | `table-grid-widget.tsx` 파일 삭제. `widget-registry.ts`에서 `"table-grid": UnsupportedWidget`로 매핑하여 향후 스키마가 실수로 사용해도 안전한 fallback. Table은 column-row sync 복잡성으로 override 유지 결정 |
| 3 | `CarouselConfig` dead code 잔존 | `presentation-configs.tsx`에서 `CarouselConfig`, `ItemButtonsConfig`, `CarouselItem`, `carouselItemId` 전체 삭제 (+ 마이그레이션 주석 추가). 사용하지 않는 `GripVertical` import도 함께 제거 |
| 4 | `pickWidget` / `humanize` 중복 정의 | `auto-form/utils.ts` 신설하여 공유. `schema-form.tsx`와 `widgets.tsx` 양쪽에서 `import { humanize, pickWidget } from "./utils"` 참조. `pickWidget`은 primitives를 DI 패턴으로 받아 any 모듈에서 사용 가능 |
| 5 | `countGroupValues` 숨겨진 필드 집계 | `isFieldVisible(e.ui, value)` 및 `e.ui?.hidden` 체크 추가. 숨겨진/비가시 필드는 배지 카운트에서 제외 |
| 6 | `AiAgentConfig` dead code 추정 | 제거 완료. `ai-configs.tsx`에서 `AiAgentConfig`, `ConditionsSection` 삭제 + 사용하지 않는 `KbSelector` import 제거 |
| 7 | `clearFields` 프로토타입 오염 가능성 | `applyClearFields()` 함수에 `UNSAFE_KEYS` 화이트리스트 (`__proto__`, `constructor`, `prototype`) 적용. 단위 테스트로 검증 |
| 8 | JSON 비검증 파싱 (`FieldArrayWidget`) | **본 PR 범위 외** — 기존 FieldArrayWidget의 unstructured item 폴백 경로로, 구조화된 스키마가 있는 경우(이번 PR의 주 용례) 구조화 서브폼으로 전환되어 해당 경로가 거의 미사용. 향후 JSON fallback 제거 시 처리 |
| 9 | `jsonSchema` 임의 스키마 주입 | **본 PR 범위 외** — AI Agent의 기존 `responseFormat: json` 기능으로, LLM 출력 validation 레이어의 기존 이슈. 후속 과제 |
| 10 | `clearFields`, `FieldArrayWidget`, 백엔드 스키마 테스트 누락 | CRITICAL #3와 함께 처리 완료 |
| 11 | `collapsible` 필드-레벨/그룹-레벨 혼재 | 현재 디자인: 첫 필드의 `collapsible: true`가 그룹 전체에 적용 (`groupEntries`의 전파 로직). 단위 테스트로 계약 문서화. 그룹 수준 메타데이터 분리는 추가 변경 없이 향후 리팩터로 이관 |
| 12 | `clearFields` 백엔드 DSL — 레이어 책임 혼재 | 설계상 의도적: `ui` 메타데이터는 frontend-only 영역으로 zod `.meta({ ui: ... })`를 통해 선언. 백엔드에서 보유하되 실행 시 무시. SDD 원칙상 스키마가 단일 소스이므로 유지 |
| 13 | `StructuredItemForm` 매 렌더 정렬 재계산 | `useMemo([itemSchema])` 적용 — 스키마 변경 시만 재계산 |
| 14 | `groupEntries` 이중/삼중 순회 | 현재 구현은 `O(n)` 단일 패스 (groupEntries는 단일 for-loop). 리뷰어가 `sort + map + filter` 체인을 착각한 것으로 판단. 성능 영향 없음 |
| 15 | `selector-widgets.tsx` stale 주석 | 전체 재작성. "placeholder", "UnsupportedWidget" 잔존 주석 제거. `ButtonListWidget`, `TableGridWidget` re-export도 제거 (해당 위젯은 각자 파일에서 직접 import) |
| 16 | `setExpanded(!expanded)` stale closure | `setExpanded((prev) => !prev)` 함수형 업데이트로 교체 |

## INFO 조치

| # | 항목 | 조치 |
|---|------|------|
| 1 | `table-grid-widget.tsx` JSDoc 부정확 | 파일 삭제로 해소 |
| 2 | `override-registry.ts` 마이그레이션 주석 미기술 | `// ai_agent migrated to auto-form (schema-driven)`, `// carousel migrated to auto-form (schema-driven)` 주석 추가 |
| 3 | 백엔드/프론트엔드 `UiHint` JSDoc 미동기화 | 양쪽 모두 동일 구조로 확장 + 주석 갱신 |
| 4 | `selector-widgets.tsx` 파일명과 역할 불일치 | 현재 LLM/KB 셀렉터 2종만 포함하므로 파일명 유지. 향후 셀렉터 추가 시 재검토 |
| 5 | `as` 타입 단언 | `KbSelectorWidget`에서 `filter((v): v is string => typeof v === "string")`로 런타임 검증 추가 |
| 6 | `key={i}` 배열 인덱스 | 구조화 아이템의 경우 `item.id`가 있으면 `id` 사용, 없으면 `_idx_${i}` 로 fallback. 구조화된 id 기반 렌더링으로 reorder 안정성 확보 |
| 7 | `conditionDefSchema.prompt` textarea→text 변경 | 기존 override 컴포넌트의 `Input` (single-line)과 동작을 유지하기 위해 `text` 유지. 스펙에서 multiline 프롬프트 요구 시 변경 고려 |
| 8 | `CollapsibleSection` 초기 상태 항상 expanded | 기존 override 동작과 일치. 초기 collapsed 필요 시 `ui.collapsedByDefault` 추가 가능 (후속) |
| 9 | `visibleWhen` 복합 조건 (AND/OR) 미지원 | 현재 nodes에서 필요 없음. 필요 시 `{ allOf: [...] }`, `{ anyOf: [...] }` 확장 (후속) |
| 10 | `clearFields` `delete` 대신 선언적 접근 | `applyClearFields`에서 `delete` 사용 중이나 unsafe keys 필터링으로 충분히 안전. immutable 패턴으로의 리팩터는 이점 대비 불필요 |

## 아키텍처 변경 요약

### 모듈 의존성 (순환 해소)
```
widget-resolver.ts  (독립)
  ↑
  ├─ utils.ts  (humanize, pickWidget, applyClearFields)
  │   ↑
  │   └─ widgets.tsx  (primitives + FieldArrayWidget + StructuredItemForm)
  │       ↑
  │       └─ widget-registry.ts  (calls registerWidgets at init)
  │            ↑
  │            └─ schema-form.tsx  (entry point)
  │
  └─ selector-widgets.tsx, button-list-widget.tsx
       ↑
       └─ widget-registry.ts
```

### 주요 신규 파일
- `frontend/src/components/editor/settings-panel/auto-form/utils.ts` — humanize, pickWidget, applyClearFields
- `frontend/src/components/editor/settings-panel/auto-form/widget-resolver.ts` — 순환 의존성 해소용 lazy resolver
- `frontend/src/components/editor/settings-panel/auto-form/selector-widgets.tsx` — llm/kb selector 래퍼
- `frontend/src/components/editor/settings-panel/auto-form/button-list-widget.tsx` — button-list 위젯
- `frontend/src/components/editor/settings-panel/node-configs/shared/button-list-editor.tsx` — 공유 ButtonListEditor

### 삭제된 파일
- `frontend/src/components/editor/settings-panel/auto-form/table-grid-widget.tsx` (dead code)

### 삭제된 dead code
- `presentation-configs.tsx`: `CarouselConfig`, `ItemButtonsConfig`, `CarouselItem`, `carouselItemId`
- `ai-configs.tsx`: `AiAgentConfig`, `ConditionsSection`

## 테스트 결과

- **Frontend**: `npm test` — 44 suites, **591 tests passed** (기존 566 + 신규 25)
- **Frontend**: `npm run lint` — 0 errors, 0 warnings
- **Frontend**: `npm run build` — 성공
- **Backend**: `npm test` — 85 suites, **1214 tests passed** (기존 1204 + 신규 10)
- **Backend**: `npm run lint` — 468 problems (baseline 유지, 신규 이슈 없음)
- **Backend**: `npm run build` — 성공
