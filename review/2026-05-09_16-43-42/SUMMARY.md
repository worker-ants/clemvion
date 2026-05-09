# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `rendered` HTML이 1MB cap 외부에서 생성되어 DB JSONB 실효 보호가 무력화될 수 있으며, Presentation → Integration 크로스 도메인 의존이 구조적 부채를 누적시킨다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / DB / Side Effect | **`rendered` HTML이 `truncateArrayForOutput` 적용 전 전체 배열로 생성됨** — `output.items`/`output.rows`는 1MB로 잘리지만 `output.rendered`는 cap 외부에서 생성되어 그대로 JSONB에 적재된다. 6개 × 200KB 아이템 기준 총 payload가 ~2.2MB에 달할 수 있어 1MB cap의 실효성이 부분적으로 무력화된다. spec의 "items가 잘리면 rendered도 자동으로 함께 작아진다"는 기술과 구현이 불일치한다. | `carousel.handler.ts:168`, `table.handler.ts:136` | `renderHtml` 호출 순서를 `truncateArrayForOutput` 이후로 변경(`this.renderHtml(cappedItems.value, layout)`)하거나, spec에서 "rendered는 전체 items 기준이며 cap 대상이 아님"으로 정확히 수정하고 rendered에 별도 cap 적용을 추가한다. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Dependency / Maintainability | **`presentation` 핸들러가 `integration/_base/` 내부 유틸을 직접 import** — `PRESENTATION_MAX_BYTES`와 `truncateArrayForOutput`이 integration 전용 네임스페이스에 정의되어 있으며, 상수 이름과 위치가 불일치한다. `integration` 모듈 리팩토링 시 silent break 위험이 있다. | `carousel.handler.ts:7`, `table.handler.ts:12` | `nodes/_shared/truncate-output.util.ts` 또는 `nodes/presentation/_base/truncate.util.ts`로 파일을 이동하거나, 현재 위치 유지 시 파일명을 `truncate.util.ts`로 변경하고 "cross-domain 공용 유틸" 의도를 명시한다. |
| 2 | Maintainability / Requirement | **`conditions` vs `knowledgeBases` 가드 불일치** — `conditions`는 `Array.isArray() && length > 0` 체크로 빈 배열을 echo에서 제외하지만, `knowledgeBases`는 `!== undefined` 체크만 수행한다. 사용자가 명시적으로 `conditions: []`를 설정해도 echo에서 누락된다. | `ai-agent.handler.ts` `buildMultiTurnConfigEcho` | 두 필드에 동일한 guard 패턴을 적용하거나, 의도적 차이라면 인라인 주석으로 정책을 명시한다. |
| 3 | Architecture / Maintainability | **`rawConfig`의 `Record<string, unknown>` 타입으로 타입 안전성 소실** — `as string | undefined`, `as unknown[]` 등 unsafe cast가 `buildMultiTurnConfigEcho` 내에 8회 이상 반복된다. 필드명 오타나 타입 변경이 컴파일 타임에 감지되지 않는다. | `ai-agent.handler.ts:1285`, `information-extractor.handler.ts:84` | 핸들러별 `RawAiAgentConfig`, `RawInformationExtractorConfig` 인터페이스를 정의하고 `rawConfig` 파라미터 타입을 구체화한다. |
| 4 | Architecture / Database / Maintainability | **`totalRows`와 `rowsTotalCount`가 truncation 시 항상 동일한 값을 이중 저장** — Table은 cap 이전 행 수를 `totalRows`(기존)와 `rowsTotalCount`(신규) 두 필드에 중복 노출한다. Carousel의 `itemsTotalCount`는 truncation 시에만 포함되어 두 핸들러 간 API가 비대칭이다. | `table.handler.ts:142`, `carousel.handler.ts:178` | `totalRows`를 cap 이후 `rows.length`와 동기화하고 cap 이전 수는 `rowsTotalCount`만 사용하거나, 두 핸들러의 truncation 플래그 API를 통일(`*TotalCount` 패턴)한다. |
| 5 | Performance / Side Effect | **`truncateArrayForOutput` 이진탐색에서 O(N log N) 전체 재직렬화** — 매 반복마다 `arr.slice(0, mid)` 생성 후 `JSON.stringify`를 호출한다. cap 트리거 시나리오에서 수 MB의 단기 힙 할당이 집중되어 GC 일시 정지를 유발할 수 있다. | `truncate-body.util.ts:115-135` | 원소 단위 누적 방식(각 element를 개별 직렬화해 byte 합산, 첫 초과 인덱스에서 중단)으로 전환하면 O(k)로 개선 가능하다. |
| 6 | Testing | **`hydrateState`의 `rawConfig` 복원 경로 미테스트** — multi-turn resumed 경로에서 DB state를 역직렬화할 때 `rawConfig`가 올바르게 복원되는지 검증하는 테스트가 없다. | `information-extractor.handler.ts:1279` | `hydrateState`에 `rawConfig`가 포함된 state row를 넣어 반환 객체의 `rawConfig` 필드를 직접 검증하는 단위 테스트를 추가한다. |
| 7 | API Contract | **`config.model` 등 config 필드의 의미(semantics) silent 변경** — 이전에는 engine-resolved 값(`"gpt-4o"`)을 반환했으나, 이제 `rawConfig` 존재 시 raw 템플릿(`"{{ vars.model }}"`)을 반환한다. `$node["X"].config.model`을 LLM 식별·로깅 용도로 참조하는 다운스트림 노드에 silent breaking change로 작용할 수 있다. | `ai-agent.handler.ts` `buildMultiTurnConfigEcho`, `information-extractor.handler.ts` `buildMultiTurnFinalOutput` | spec §7에 이 변경이 breaking임을 명시적으로 기재하거나, `rawModel`/`resolvedModel`을 병치하는 방안을 검토한다. |
| 8 | Documentation | **JSDoc에 `plan/` 문서 경로가 하드코딩되어 곧 구식이 됨** — `truncateArrayForOutput` JSDoc의 `plan/in-progress/engine-raw-config-followups.md` 참조는 이번 리뷰 완료 후 `plan/complete/`로 이동 시 즉시 구식이 된다. 기존 `truncateBodyForOutput` JSDoc의 `plan/in-progress/engine-raw-config-exposure.md`는 이미 `complete/`로 이동된 상태로 구식이다. | `truncate-body.util.ts` JSDoc 2곳 | 경로 대신 결정 요지만 인라인으로 서술하거나, 날짜·의사결정 근거만 남기고 경로 참조를 제거한다. |
| 9 | Testing | **Carousel dynamic 모드에서 1MB cap 미검증** — 신규 cap 테스트는 carousel `mode: 'static'`만 검증하며, dynamic 모드(배열 소스 → items 생성 후 cap 적용 경로)는 누락되어 있다. | `carousel.handler.spec.ts` | carousel dynamic 모드로 대량 배열 입력 시 truncation 동작 케이스를 추가한다. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Spec | **AI Agent spec에서 `mode` 필드 누락** — `$node["X"].config` 열거 목록에 `mode`가 빠져 있으나 구현체 `buildMultiTurnConfigEcho`는 항상 `echo.mode`를 포함한다. | `spec/4-nodes/3-ai/1-ai-agent.md` §7 | 필드 목록 선두에 `mode`를 추가한다. |
| 2 | Architecture | **`rawConfig ?? config` 폴백 패턴 분산** — `context.rawConfig ?? config` 또는 `state.rawConfig ?? {}` 폴백이 핸들러 4곳에 분산되어 있다. | `ai-agent.handler.ts:622`, `information-extractor.handler.ts:288`, `carousel.handler.ts:168`, `table.handler.ts:132` | `ExecutionContext`에 `rawConfig` 접근 헬퍼를 추가하거나 엔진이 항상 `context.rawConfig`를 채우도록 보장한다. |
| 3 | Testing | **`conditions: []` 빈 배열 echo 제외 케이스 미테스트** — `buildMultiTurnConfigEcho`가 빈 conditions 배열을 필터링하는 분기를 검증하는 테스트가 없다. | `ai-agent.handler.spec.ts` | `conditions: []` rawConfig로 호출 시 `config.conditions === undefined`를 검증하는 케이스를 추가한다. |
| 4 | API Contract / Testing | **`truncateArrayForOutput` 비배열 입력 시 `truncated: false` 의미론적 모호성** — 비배열 입력에 대해 `{ value: [], truncated: false }` 반환. 실제로는 값이 빈 배열로 교체되었으나 `truncated: false`로 데이터 손실이 은폐된다. | `truncate-body.util.ts:107-109` | 현재 호출 경로에서는 배열이 보장되므로 실질 위험 없음. 향후 재사용을 위해 별도 `invalidInput: true` 플래그 또는 호출 전 방어 코드 고려. |
| 5 | Scope / Documentation | **멀티라인 주석 블록 — CLAUDE.md 정책 위반** — `truncate-body.util.ts`의 JSDoc 블록, `information-extractor.handler.ts`의 CONVENTIONS 6줄 주석, `ai-agent.handler.ts`의 `buildMultiTurnConfigEcho` JSDoc이 "Never write multi-paragraph docstrings or multi-line comment blocks" 규약에 위반된다. | 해당 파일들 상단/함수 주석 | 각 주석을 한 줄로 압축하거나 spec 문서 참조 포인터로 대체한다. |
| 6 | Maintainability | **`defined()` vs 조건부 할당 패턴 불일치** — Information Extractor는 `defined()` 헬퍼를, AI Agent는 `if (raw.X !== undefined) echo.X = raw.X` 패턴을 사용한다. | `ai-agent.handler.ts` vs `information-extractor.handler.ts` | `defined()` 헬퍼가 의도를 더 명확히 드러내므로 `buildMultiTurnConfigEcho`도 동일 헬퍼 사용으로 통일한다. |
| 7 | Testing | **truncation 시 `rendered` HTML 완전성 미검증** — items가 잘릴 때 `rendered`가 잘리지 않은 전체 HTML을 포함하는지 보장하는 테스트가 없다. | `carousel.handler.spec.ts` truncation 테스트 | `expect(result.output.rendered).toBeDefined()` 및 capped items보다 많은 슬라이드가 rendered에 포함됨을 검증하는 assertion을 추가한다. |
| 8 | Documentation | **`0-common.md` §4 Output size cap 설명이 단일 장문 문장으로 가독성 저하** — cap 값, 초과 동작, array 형태 유지, rendered 제외, integration cap 비교가 한 문장에 집약되어 파싱이 어렵다. | `spec/4-nodes/6-presentation/0-common.md` §4 | 핵심 규칙 1행 + 하위 bullet 3~4개로 분리한다. |
| 9 | Security | **rawConfig echo로 워크플로우 설정 구조 노출** — `systemPrompt`, `knowledgeBases`, `conditions` 등 저자 전용 설정 템플릿이 `output.config`에 echo되어 최종 사용자에게 노출될 수 있다. | `ai-agent.handler.ts`, `information-extractor.handler.ts` | `output.config`에 대한 접근제어 레이어(author/admin 전용 필터링) 적용 여부를 확인한다. |
| 10 | Testing | **`userPrompt`, `responseFormat` echo 검증 누락** | `ai-agent.handler.spec.ts` | rawConfig에 해당 필드를 추가하고 `config.userPrompt`, `config.responseFormat` assertion을 포함한다. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Architecture | MEDIUM | `rendered`/`items` 의미 불일치 (CRITICAL로 상향 제기), presentation→integration 크로스 도메인 import |
| Database | MEDIUM | `rendered` HTML이 cap 적용 전 생성되어 JSONB row 크기 보장 실패 |
| Side Effect | MEDIUM | `rendered` HTML이 1MB cap을 우회, `truncateArrayForOutput` GC 압력 |
| Requirement | MEDIUM | `rendered`/items 불일치로 spec 기술과 구현 괴리, `conditions: []` 에코 누락 |
| Performance | LOW | `truncateArrayForOutput` O(N log N) 직렬화, rendered 전체 배열 렌더링 낭비 |
| API Contract | LOW | `config.model` 등 silent semantic breaking change (raw template으로 변경) |
| Testing | LOW | `hydrateState` rawConfig 복원 미테스트, carousel dynamic cap 미검증 |
| Maintainability | LOW | `conditions`/`knowledgeBases` 가드 불일치, presentation 유틸 위치 오류 |
| Documentation | LOW | JSDoc의 plan 경로 하드코딩, AI Agent spec `mode` 필드 누락 |
| Security | LOW | rawConfig echo로 설정 구조 노출, 화이트리스트 없는 rawConfig 전체 저장 |
| Dependency | LOW | presentation→integration 내부 경로 직접 참조 |
| Concurrency | NONE | 변경 범위 내 동시성 위험 없음 |
| Scope | LOW | 멀티라인 주석 CLAUDE.md 정책 위반, 범위 내 결정 존중 |

---

## 발견 없는 에이전트

**Concurrency** — 변경된 코드 전체가 순수 함수 또는 단일 스레드 이벤트 루프 내 동기 경로만 변경하여 동시성 위험이 없음.

---

## 권장 조치사항

1. **[즉시 수정]** `rendered` HTML 생성 순서 교정 — `carousel.handler.ts`와 `table.handler.ts`에서 `renderHtml` 호출을 `truncateArrayForOutput` 이후로 이동(`cappedItems.value`/`cappedRows.value` 기준). spec의 "자동으로 함께 작아진다" 기술과 구현을 일치시키거나, 의도적 설계라면 spec을 정확히 수정하고 `rendered`에 별도 크기 보호를 추가한다.

2. **[단기 수정]** `conditions: []` 가드 불일치 해소 — `buildMultiTurnConfigEcho`에서 `conditions`와 `knowledgeBases`의 guard 패턴을 통일한다.

3. **[단기 수정]** JSDoc 내 `plan/` 경로 참조 제거 — `truncateBodyForOutput` JSDoc의 이미 구식이 된 경로를 `plan/complete/engine-raw-config-exposure.md`로 수정하거나 결정 요지로 대체한다. `truncateArrayForOutput` JSDoc도 동일하게 처리한다.

4. **[단기 수정]** AI Agent spec `mode` 필드 추가 — `spec/4-nodes/3-ai/1-ai-agent.md` §7의 config 필드 열거 목록에 `mode`를 추가한다.

5. **[중기 개선]** `truncate-body.util.ts` 위치 이동 — `nodes/_shared/truncate-output.util.ts` 등 중립 경로로 이동해 presentation→integration 크로스 도메인 의존을 해소한다. `PRESENTATION_MAX_BYTES` 상수도 함께 이동한다.

6. **[중기 개선]** `truncateArrayForOutput` 성능 개선 — 이진탐색 대신 원소 단위 누적 방식으로 전환해 O(N log N) → O(k) 직렬화 비용을 절감한다.

7. **[중기 개선]** `hydrateState` rawConfig 복원 테스트 추가 — multi-turn resumed 경로에서 rawConfig가 DB 왕복 후 올바르게 echo되는지 보장하는 단위 테스트를 작성한다.

8. **[중기 개선]** `rawConfig` 타입 구체화 — `RawAiAgentConfig`, `RawInformationExtractorConfig` 인터페이스를 정의해 `Record<string, unknown>` unsafe cast를 제거한다.

9. **[장기 개선]** `totalRows`/`rowsTotalCount` 중복 해소 — Carousel/Table 간 `*TotalCount` 패턴을 통일하고 `totalRows` 의미를 cap 이후 길이로 재정의하거나 필드를 제거한다.