파일 쓰기 권한이 필요합니다. 권한을 승인해 주시면 `review/2026-05-05_15-23-14/SUMMARY.md`에 저장하겠습니다. 그 전에 통합 결과를 먼저 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `resolve-dynamic-ports.spec.ts` 미업데이트와 text-fallback 경로 미커버로 인한 회귀 위험 존재. 나머지 발견사항은 LOW 이하이나, resolver↔handler `trim()` 불일치가 7개 이상 에이전트에서 공통 지적됨.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | **`resolve-dynamic-ports.spec.ts` 미업데이트** — 파일 헤더 주석이 "regression is covered by resolve-dynamic-ports.spec.ts"라고 명시하나 이번 diff에 해당 spec 변경이 없어, `classifierCategoriesPorts`의 `id` 기반 포트 발급 로직이 회귀 테스트로 보호되지 않음 | `resolve-dynamic-ports.ts` 전체 | `{ id: 'cat_refund', name: 'Billing' }` 포함 classifier-categories fixture 케이스 추가 |
| 2 | Testing | **JSON 파싱 실패(text fallback) 경로 + 커스텀 id 조합 미커버** — 단일·멀티 레이블 catch 블록에서 `buildCategoryPortIds` 호출 결과가 커스텀 id와 결합될 때의 동작이 검증되지 않음 | `text-classifier.handler.spec.ts` (fallback 경로) | 단일/멀티 레이블 각 describe에 text-fallback + 커스텀 id 조합 케이스 추가 |
| 3 | Consistency | **Resolver ↔ Handler `c.id.trim()` 불일치** — resolver는 `c.id` 원본을, handler의 `buildCategoryPortIds`는 `c.id.trim()`을 포트 id로 반환. 정상 경로는 스키마 regex가 보호하나, 스키마 우회 데이터(마이그레이션, 직접 DB 주입)에서 포트 id 불일치 발생. **7개 이상 에이전트 공통 지적** | `resolve-dynamic-ports.ts:89` vs `text-classifier.handler.ts:buildCategoryPortIds` | resolver도 `c.id.trim()`으로 통일. 공유 헬퍼 `resolveStablePortId(id, fallback)` 추출 시 `aiAgentConditionalPorts` trim 누락도 동시 해소 |
| 4 | Correctness | **`category.id` 중복 유효성 검증 부재** — 동일 `id` 카테고리 존재 시 resolver의 `dedupeById`가 두 번째 포트를 조용히 제거하고, handler는 `findIndex`로 첫 번째 포트로 라우팅해 silent 오분류 발생 | `validateTextClassifierConfig` | `Set` 기반 id 중복 검사 추가 또는 `.superRefine`으로 uniqueness 강제 |
| 5 | API Contract | **기존 워크플로우 엣지 파단 마이그레이션 안내 누락** — 기존에 `class_0`, `class_1` 포트 id로 저장된 엣지가 있는 워크플로우에서 카테고리에 `id` 추가 시 포트 id가 바뀌어 기존 엣지가 dangling 상태가 되는 silent breaking change | `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/3-ai-nodes.md` | 스펙에 "기존 `class_${i}` 엣지가 연결된 카테고리에 `id`를 추가하면 해당 엣지를 수동 재연결해야 한다" 명시 |
| 6 | Security | **포트 id 생성 지점의 포맷 재검증 부재** — 포맷 제약이 Zod 스키마에만 존재. 스키마를 거치지 않은 경로에서 임의 문자열이 라우팅 키로 사용될 수 있어 defense-in-depth 누락 | `text-classifier.handler.ts:buildCategoryPortIds`, `resolve-dynamic-ports.ts:84` | 두 곳 모두 `SAFE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/` 인라인 검증 추가 |
| 7 | Architecture | **3중 포트 id 결정 로직 복제** — 동일 비즈니스 규칙이 backend handler, backend resolver, frontend resolver 세 곳에 분산. 규칙 변경 시 세 곳 수동 동기화 필요 | `text-classifier.handler.ts:buildCategoryPortIds`, `resolve-dynamic-ports.ts:classifierCategoriesPorts`, frontend resolver | `shared/ports/` 공용 유틸 모듈에 순수 함수 추출 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | `name`/`description`에 `.default('')` 추가가 PR 목적과 무관한 부수 변경. schema 레이어 방어가 `validateTextClassifierConfig`에만 의존하게 됨 | `text-classifier.schema.ts:categoryDefSchema` | 별도 커밋 분리 또는 커밋 메시지 사유 명기. schema 레벨 `.min(1)` 가드 추가 검토 |
| 2 | Architecture | `aiAgentConditionalPorts`의 trim 정책 불일치 (기존 코드) — 같은 파일 내 세 함수가 모두 다른 패턴 | `resolve-dynamic-ports.ts:158` vs `:87` | 공유 헬퍼 `resolveStablePortId` 도입으로 세 함수 동시 통일 |
| 3 | Maintainability | PORT_ID_SLUG_REGEX 상수 미공유 — `switch.caseDefSchema`와 동일 regex를 주석으로만 연관 | `text-classifier.schema.ts:12` | 공통 위치에 `PORT_ID_SLUG_REGEX` 정의 후 참조 |
| 4 | Maintainability | `buildCategoryPortIds` JSDoc "Mirrors" 표현이 trim 동작 차이를 감춤 | `text-classifier.handler.ts:14-20` | "Applies the same fallback rule as `classifierCategoriesPorts`"로 완화 |
| 5 | Documentation | `spec §8` 주석 참조 모호 — 어느 문서의 §8인지 불명확 | `resolve-dynamic-ports.ts:86`, `text-classifier.schema.ts:9` | `// CONVENTIONS.md Principle 8 — stable port id` 형태로 명시 |
| 6 | Documentation | 공개 export된 `categoryDefSchema`에 JSDoc 없음 | `text-classifier.schema.ts:9` | `id` 필드 포맷 제약 및 포트 라우팅 관계 JSDoc 추가 |
| 7 | Documentation | `id` 필드 `hidden: true` — UI 접근 불가임이 스펙 미기술 | `spec/4-nodes/3-ai-nodes.md` CategoryDef 표 | "설정 UI에 노출되지 않으며 AI Assistant가 자동 지정" 문구 추가 |
| 8 | Documentation | 테스트 제목 `'class_${i}'` — single-quote 안의 `${i}`는 보간되지 않아 혼란 유발 | `text-classifier.handler.spec.ts:492, 507, 912, 927` | `'class_N (index-based)'`로 변경 |
| 9 | Documentation | `information_extractor` 예외 설명이 고밀도 테이블 셀 말미에 삽입되어 가독성 저하 | `spec/3-workflow-editor/4-ai-assistant.md` | 별도 문단으로 분리 또는 **bold** 강조 |
| 10 | Security | `config.passthrough()` 사용 사유 주석 없음 | `text-classifier.schema.ts:textClassifierNodeConfigSchema` | 사유 주석 추가. 불필요하면 `.strict()` 검토 |
| 11 | Security | 에러 경로에 `originalInput` 포함 (기존 코드) — PII 노출 가능 | `text-classifier.handler.ts:truncateForErrorDetails` 사용부 | 원문 입력 포함 필요성 재검토 |
| 12 | Testing | 빈 문자열 `id` 거부 케이스 미추가 | `text-classifier.schema.spec.ts` | `categoryDefSchema.safeParse({ id: '', name: 'A' }).success === false` 검증 추가 |
| 13 | Testing | 단일 레이블 커스텀 id 테스트가 기본 mock에 암묵적 의존 | `text-classifier.handler.spec.ts:493` | mock 명시적 설정 또는 주석으로 의도 명확화 |
| 14 | Performance | `buildCategoryPortIds` 내 `.trim()` 이중 호출 | `text-classifier.handler.ts:buildCategoryPortIds` | `const trimmed = c.id.trim()` 로컬 변수 추출 (영향도 극미) |
| 15 | Performance | fallback 경로에서 `buildCategoryPortIds` 불필요 전체 배열 순회 | `text-classifier.handler.ts:processSingleLabelResult` | `portIndex >= 0 ? buildCategoryPortIds(categories)[portIndex] : 'fallback'` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | MEDIUM | resolve-dynamic-ports.spec.ts 미업데이트, text-fallback + 커스텀 id 미커버 |
| Security | LOW | 포맷 재검증 defense-in-depth 부재, type casting 우회 |
| Maintainability | LOW | 3중 trim 패턴 중복, aiAgentConditionalPorts 불일치 |
| Architecture | LOW | 3-way mirror 구조, resolver↔handler trim 비대칭 |
| API Contract | LOW | category.id 중복 검증 부재, 기존 엣지 파단 마이그레이션 안내 누락 |
| Dependency | LOW | resolver↔handler trim 불일치, 3중 복제 구조 |
| Scope | LOW | name/description default 부수 변경, trim 비대칭 |
| Performance | LOW | trim 이중 호출, fallback 불필요 순회 (영향도 극미) |
| Side Effect | LOW | schema 레이어 방어 약화, resolver↔handler 불일치 |
| Requirement | LOW | trim 불일치, id 중복 검증 부재 |
| Documentation | LOW | spec §8 참조 모호, hidden:true 미기술, JSDoc 부재 |
| Concurrency | NONE | 해당 없음 |
| Database | NONE | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| Database | 변경 파일 전체가 인메모리 로직·스키마·테스트·문서로 DB 관련 코드 없음 |
| Concurrency | 순수 함수 + 불변 스키마 구조로 공유 가변 상태 없음 |

---

## 권장 조치사항

1. **[즉시] `resolve-dynamic-ports.spec.ts` 업데이트** — 파일 헤더의 "covered by" 선언과 실제 커버리지가 불일치. `classifierCategoriesPorts`의 `id` 기반 포트 발급을 검증하는 fixture 케이스 추가.

2. **[즉시] text-fallback + 커스텀 id 조합 테스트 추가** — `processSingleLabelResult`·`processMultiLabelResult` catch 블록에서 커스텀 id가 올바르게 라우팅되는지 단일·멀티 레이블 각각 검증.

3. **[단기] Resolver `c.id.trim()` 통일** — `resolve-dynamic-ports.ts:classifierCategoriesPorts`도 `c.id.trim()` 반환으로 수정. 공유 헬퍼 `resolveStablePortId` 추출 시 `aiAgentConditionalPorts` trim 누락도 동시 해소.

4. **[단기] `category.id` 중복 검증 추가** — `validateTextClassifierConfig`에 `Set` 기반 id 중복 검사 추가.

5. **[단기] 마이그레이션 주의 문구 스펙 명시** — 기존 `class_${i}` 엣지가 연결된 카테고리에 `id` 추가 시 엣지 재연결 필요함을 스펙 문서에 경고.

6. **[중기] `id` 필드 `hidden: true` 접근 방법 스펙 기술** — CategoryDef 표에 AI Assistant 통한 설정 방법 명시.

7. **[중기] PORT_ID_SLUG_REGEX 공유 상수화** — `switch.caseDefSchema`·`categoryDefSchema` 공통 regex를 단일 상수로 추출.

8. **[중기] `buildCategoryPortIds` defense-in-depth 강화** — 포트 id 생성 지점에 `SAFE_ID_RE` 인라인 검증 추가.