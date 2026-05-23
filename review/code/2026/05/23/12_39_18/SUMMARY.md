# Code Review 통합 보고서

리뷰 대상: AI Agent `render_*` 버튼 클릭 user-message 합성 (`button.userMessage` 필드 신설)
세션: `review/code/2026/05/23/12_39_18`
실행 reviewer: 9명 (security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract)

---

## 전체 위험도

**MEDIUM** — LLM-authored 자유 문자열이 길이 제한·이스케이프 없이 채팅 user message로 직행하는 경로(간접 프롬프트 인젝션 포함)와 테스트 갭(render-tool-provider 보존 미검증)이 핵심 우려사항. 기능 정확성과 하위 호환성은 양호.

---

## Critical 발견사항

Critical 수준의 발견사항은 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | LLM-authored `userMessage` 콘텐츠 미검증 — XSS·프롬프트 인젝션 경로 | `assistant-presentations-block.tsx` `composeUserMessage` / `handlePortButtonClick` | `onSendMessage` 호출 전 최대 길이 제한, HTML 특수문자 이스케이프, `javascript:`/`data:` 스킴 필터링 적용 또는 순수 평문 텍스트 경로만 허용하도록 아키텍처 보장 |
| 2 | Security | `userMessage` 길이 무제한 — DoS·프롬프트 인젝션 | `button.types.ts` `ButtonDef`, 각 노드 `buttonDefSchema` | Zod 스키마에 `.max(500)` 추가; `validateButtons`에도 길이 검사 추가 |
| 3 | Security | `userMessage`가 `link` 타입 버튼 파싱 시 경고 없이 통과 — 정책 불일치 잠재 | `button.types.ts` `validateButtons`, `carousel.schema.spec.ts` | `validateButtons`에 `type:"link"` + `userMessage` 조합 non-blocking 경고 추가 또는 Zod `.refine()`으로 명시적 배제 |
| 4 | Security | `__item_{idx}` 배열 경계 검증 부재 — 범위 초과 접근 | `assistant-presentations-block.tsx` `findButtonContext` `dynamicIdx` 처리 | `dynamicIdx >= 0 && dynamicIdx < items.length` 범위 검사 명시적 추가 |
| 5 | Architecture | `buttonDefSchema` 4개 파일 중복 정의 — DRY 위반·drift 위험 | `carousel.schema.ts`, `chart.schema.ts`, `table.schema.ts`, `template.schema.ts` | `_shared/button.schema.ts`에 단일 공유 `buttonDefSchema` 정의 후 각 노드에서 import |
| 6 | Architecture | `ButtonDef` 인터페이스 + Zod 스키마 이중 진실 — 수동 동기화 상태 | `button.types.ts` `ButtonDef` 인터페이스, 각 노드 로컬 `buttonDefSchema` | `export type ButtonDef = z.infer<typeof buttonDefSchema>`로 파생하여 수기 인터페이스 삭제 |
| 7 | Maintainability | `buttonDefSchema` 4개 파일 반복 — 향후 필드 추가마다 산포 편집 필요 | carousel/chart/table/template 각 schema 파일 | `_shared/button.schema.ts`로 추출 통합 (Architecture #5와 동일 조치) |
| 8 | Maintainability | `carousel.schema.ts`와 나머지 3개 파일의 `placeholder` 불일치 — 무언의 분기 | carousel `placeholder`: `"{item.title} → {label}"`, 나머지: `label` | 공유 스키마 추출 후 carousel 전용 placeholder를 명시적 파라미터로 override |
| 9 | Maintainability | `findButtonContext` 반환 타입 인라인 익명 타입 — 재사용 불가 | `assistant-presentations-block.tsx` `findButtonContext` 반환 타입 | `ButtonContext` named 타입으로 추출하여 `findButtonContext`·`composeUserMessage` 모두 동일 타입 참조 |
| 10 | Testing | `render-tool-provider.spec.ts`에 `userMessage` 보존 테스트 누락 — plan 명시 항목 미이행 | `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts` | `render_carousel` execute 시 `userMessage` 보존 검증, `backfillButtonUuids`가 필드를 삭제하지 않는 회귀 테스트 추가 |
| 11 | Testing | `button.types.spec.ts`에 `validateButtons` + `userMessage` 통과 테스트 누락 | `codebase/backend/src/nodes/presentation/_shared/button.types.spec.ts` | `type:"port"` + `userMessage` 통과, `type:"link"` + `userMessage` 경고 없이 통과 테스트 각 1건 추가 |
| 12 | Testing | `findButtonContext` 우선순위 충돌 케이스 미검증 — `items[].buttons`와 `config.itemButtons` 동시 정의 시 | `assistant-presentations-block.test.tsx` | 동일 buttonId가 두 경로에 존재할 때 step 1이 우선 반환됨을 확인하는 테스트 1건 추가 |
| 13 | Testing | `AssistantPresentationsBlock` — `onSendMessage` 미전달 시 early-return 방어 로직 미검증 | `assistant-presentations-block.test.tsx` | `onSendMessage` prop 없이 버튼 클릭 시 예외 발생하지 않는 smoke 테스트 1건 추가 |
| 14 | Documentation | 백엔드 schema spec 파일군 — 모듈 레벨 주석 부재 (프론트엔드 테스트와 비일관) | `carousel.schema.spec.ts`, `chart.schema.spec.ts`, `table.schema.spec.ts`, `template.schema.spec.ts` | 신규 describe 블록 앞에 spec §10.8 참조 단락 주석 추가 또는 스타일 통일 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `.passthrough()` 스키마 — 미정의 필드 무제한 허용(프로토타입 오염 잠재) | 4개 노드 `buttonDefSchema` | `.strip()` 또는 `.strict()` 전환 검토 |
| 2 | Security | URL 스킴 검증이 `validateButtons`에만 존재, Zod 파싱 레벨 미흡 | `button.types.ts`, 각 노드 `buttonDefSchema.url` | `url` 필드 Zod에 `.refine()` 추가하여 `javascript:`·`data:` 파싱 시점 차단 |
| 3 | Requirement | table/chart/template global 버튼 클릭 — user-message 발화 경로 미구현 (현 단계 scope 제한) | `assistant-presentations-block.tsx` `PresentationItem` switch 분기 | plan 문서에 "단계별 구현" 명기; table/chart/template 버튼 클릭 경로를 후속 task로 추적 |
| 4 | Requirement | spec §10.8 — `userMessage` 빈 문자열 처리 규칙 명문화 부재 | `spec/4-nodes/6-presentation/0-common.md §10.8` | `project-planner`가 spec에 빈 문자열 처리 규칙 보충 |
| 5 | Requirement | carousel global `buttons` placeholder가 per-item 합성 공식으로 표시 — global fallback(`label`)과 불일치 | `carousel.schema.ts` `userMessage.placeholder` | global 버튼 전용 placeholder를 `label` 단독으로 수정 검토 |
| 6 | Architecture | `findButtonContext` 3-단계 검색 로직 — 캐러셀 내부 데이터 구조 지식 집중 | `assistant-presentations-block.tsx` `findButtonContext` | 향후 button lookup 로직을 별도 헬퍼로 분리 (현재는 수용 가능) |
| 7 | Architecture | `findButtonContext`·`composeUserMessage` `@internal`이지만 `export` — 모듈 경계 모호 | `assistant-presentations-block.tsx` 61행, 470행 | JSDoc에 `@internal — exported for testing only; not part of the public API` 보충 |
| 8 | Architecture | `validateButtons` — Zod와 병렬 imperative 검증 이중 경로 유지 | `button.types.ts` `validateButtons` | cross-field 검증만 `validateButtons`에 남기고 나머지는 Zod 스키마로 이관 검토 |
| 9 | Scope | `review/consistency/` 산출물 파일군이 커밋에 포함 | `review/consistency/2026/05/23/12_00_09/` | 조치 불필요 — 프로젝트 규약 준수 |
| 10 | Side Effect | `findButtonContext` static 모드 1단계에서 `__item_` 접미사 ID 완전 일치만 시도 — 기존 `startsWith` 매칭에서 변경 | `assistant-presentations-block.tsx` `items[].buttons` 루프 | static 모드에서 `__item_` 접미사 ID가 발생하지 않음을 테스트로 명시적 보장 |
| 11 | Maintainability | `findButtonContext` — `dynamicMatch`/`dynamicIdx`/`dynamicItem` 계산이 함수 상단에 선제 실행 | `assistant-presentations-block.tsx` `findButtonContext` | 실제 사용 분기 직전으로 이동 또는 lazy getter 패턴 적용 |
| 12 | Maintainability | 테스트 파일 `as unknown as { ... }` 타입 단언 패턴 4회 반복 | chart/table/template/carousel `schema.spec.ts` | 공통 헬퍼 `expectButtonUserMessageInSchema()` 추출 (선택적 개선) |
| 13 | Maintainability | `validateButtons`에 `userMessage` 검증 생략 — 명시적 주석 부재 | `button.types.ts` `validateButtons` | "빈 문자열은 frontend에서 무시, backend는 검증하지 않음(의도적)" 한 줄 주석 추가 |
| 14 | Testing | carousel schema spec — `userMessage: ""` parse 시 `""` 보존 동작 명시적 테스트 없음 | `carousel.schema.spec.ts` | `userMessage: ""` → `""` 보존 테스트 1건 추가 (현행 동작 고정 회귀 기준선) |
| 15 | Testing | chart/table/template spec — 단일 `it` 블록에 두 가지 assertion 혼합 | 각 `schema.spec.ts` `buttonDefSchema — userMessage` 블록 | carousel처럼 `it` 블록 분리 |
| 16 | Testing | `userMessage` 최대 길이 경계값 테스트 없음 | 4개 노드 schema spec | 현행 정책을 spec에 명시하고, 제한 추가 시 테스트 동시 추가 |
| 17 | Documentation | `ButtonDef` 인터페이스 — `userMessage`만 JSDoc, 나머지 필드 주석 부재 (불일관) | `button.types.ts` `ButtonDef` | 다른 필드에 한 줄 주석 추가하거나 인터페이스 레벨 JSDoc에 전체 필드 설명 집약 |
| 18 | Documentation | 4개 schema 파일 로컬 `buttonDefSchema` — mirror-point 주석 누락 | carousel/chart/table/template `schema.ts` | 각 `buttonDefSchema` 상단에 `// Mirror: ButtonDef in _shared/button.types.ts` 한 줄 추가 |
| 19 | Documentation | plan 파일 TDD 체크리스트 — 전체 `- [ ]` 미완료 상태, 실제 구현과 불일치 | `plan/in-progress/ai-agent-render-button-user-message.md` | 완료된 단계를 `- [x]`로 업데이트 |
| 20 | API Contract | `userMessage` 빈 문자열 처리 — Zod 레이어(허용)와 frontend(무시) 간 비일관 | Zod `z.string().optional()`, frontend `composeUserMessage` | `z.string().min(1).optional()` 전환 또는 frontend-only 처리를 계약으로 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | LLM-authored `userMessage` 길이 무제한·이스케이프 없음, 간접 프롬프트 인젝션 경로, `dynamicIdx` 경계 검증 부재 |
| architecture | LOW | `buttonDefSchema` 4개 파일 중복·TypeScript 인터페이스와 Zod 스키마 이중 진실 |
| requirement | LOW | table/chart/template global 버튼 클릭 경로 미구현(현 단계 scope 제한 명시), spec §10.8 빈 문자열 규칙 미명문화 |
| scope | NONE | 변경 범위가 단일 작업에 집중, 기존 패턴 준수, 의도하지 않은 이탈 없음 |
| side_effect | LOW | `findButtonContext` 검색 우선순위 변경(기존 `startsWith` → 완전 일치), 신규 export로 인한 공개 API 주의 |
| maintainability | MEDIUM | `buttonDefSchema` 4파일 중복, `findButtonContext` 반환 타입 익명 인라인, `placeholder` 무언의 분기 |
| testing | MEDIUM | `render-tool-provider.spec.ts` `userMessage` 보존 테스트 누락(plan 명시 항목), `validateButtons` + `userMessage` 통과 테스트 없음, 우선순위 충돌 케이스 미검증 |
| documentation | LOW | plan 체크리스트 미완료, mirror-point 주석 누락, `@internal` + `export` 의도 불분명 |
| api_contract | NONE | 옵션 필드 추가로 완전 하위 호환, 기존 계약 파괴 없음 |

---

## 라우터 결정

`routing_status=done` (router 선별):

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (9명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | UI 텍스트 필드 추가 + 옵션 UI metadata — I/O나 반복 성능 영향 없음 |
| dependency | package.json / requirements.txt / go.mod 등 의존성 파일 변경 없음 |
| database | DB migrations / SQL / Prisma schema 변경 없음 |
| concurrency | async/await, Promise, 락, 워커, 타이머 등 동시성 코드 변경 없음 |
| user_guide_sync | presentation node schema 내 필드 추가로 제한적 — 문서 sync 트리거 판단은 reviewer 의 PROJECT.md SoT 적재 평가에서 선별 제외 |
