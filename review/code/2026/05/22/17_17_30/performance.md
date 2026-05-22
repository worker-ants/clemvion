# 성능(Performance) 코드 리뷰 결과

**대상**: AI Agent Presentation Tools (`render_*` tool family)
**리뷰 일시**: 2026-05-22
**주요 파일**:
- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx`
- `codebase/frontend/src/lib/conversation/conversation-utils.ts`

---

## 발견사항

### [WARNING] `applyOneMbCap` — O(n) tail-pop 루프의 반복 비용
- **위치**: `render-tool-provider.ts` lines 174–206, `applyOneMbCap` 함수
- **상세**: table/carousel 의 행/아이템 1MB 초과 시, 배열 끝에서 한 행씩 `pop()` 하며 매 반복마다 `approxByteSize({ ...payload, items/rows })` 를 호출한다. `approxByteSize` 내부에서 `JSON.stringify` 를 수행하므로, 2,000행짜리 테이블이 경계 부근에 있으면 최악 O(n) 번 `JSON.stringify` 가 호출된다. 테이블 스펙 기준 1행 ~1KB 시 ~2,000회 × 전체 페이로드 직렬화가 발생할 수 있다. 실제 테스트 케이스(`'A'.repeat(1024)` × 2,000행 = ~2MB) 가 바로 이 경로를 검증하며, 처리 시간은 LLM 응답 latency 에 숨겨지지만 CPU 폭증이 발생한다.
- **제안**: 이진 탐색(binary search)으로 남길 행 수 상한을 O(log n) 번의 `JSON.stringify` 호출로 구하고, 한 번에 잘라내는 방식으로 교체한다. 또는 행 하나의 평균 byte 크기를 먼저 샘플링해 목표 행 수를 추정한 후 한 번에 slice 하고 최종 검증 1회만 수행하는 근사 접근도 효과적이다.

### [WARNING] `approxByteSize` — 루프 내 중복 직렬화
- **위치**: `render-tool-provider.ts` lines 146–152, `applyOneMbCap` 내 루프 (lines 176, 195)
- **상세**: `applyOneMbCap` 는 루프 진입 전 `approxByteSize(payload)` 를 1회 호출(line 165), 루프 안에서 매 반복마다 `approxByteSize({ ...payload, items/rows })` 를 또 호출한다. `...payload` spread 는 나머지 필드(columns, title 등)를 매번 복사·직렬화하며, items/rows 배열만 변하는 상황임에도 전체 payload 를 반복 직렬화한다. 행 수가 클수록 낭비가 크다.
- **제안**: 루프에서 `items/rows` 만 따로 직렬화하거나, 나머지 필드의 base byte 크기를 루프 시작 전 1회 계산해 캐싱한다.

### [INFO] `execute` 내 마지막 `approxByteSize` 이중 호출
- **위치**: `render-tool-provider.ts` lines 361–365, 399, 422
- **상세**: `applyOneMbCap(type, validatedPayload)` 호출 후 `capped.payload` 가 반환되면, chart/template/form 경계 검사에서 `approxByteSize(capped.payload)` 를 한 번, `presentationCall.bytes` 기록에서 또 한 번 호출한다. 동일 객체에 대해 `JSON.stringify` 가 2회 실행된다.
- **제안**: `approxByteSize` 결과를 지역 변수에 저장하고 두 곳에서 재사용한다.

### [INFO] `overlayDefaults` — 깊은 재귀 호출 가능성
- **위치**: `render-tool-provider.ts` lines 108–133
- **상세**: LLM 이 생성한 payload 또는 `defaults` 가 깊이 중첩된 객체인 경우 재귀 스택이 깊어진다. 일반적인 presentation payload 는 얕은 구조라 실제 문제로 이어질 가능성은 낮지만, `defaults` 입력이 사용자 정의 JSON이므로 이론적으로 깊이 제한이 없다.
- **제안**: 현실적인 payload depth(5~10 수준)에서는 문제 없음. 다만 방어적으로 depth guard 를 추가하거나, 재귀 대신 반복(iterative BFS/DFS) 방식으로 전환하는 것을 고려할 수 있다.

### [INFO] `jsonSchemaCache` — 모듈 수준 변경 가능 전역 상태
- **위치**: `render-tool-provider.ts` lines 89–98
- **상세**: `jsonSchemaCache` 는 모듈 수준 `Partial<Record<...>>` 객체로, 5종 타입 각각의 JSON Schema 를 최초 1회 빌드 후 캐싱한다. 캐시 전략 자체는 올바르나(읽기 전용이고, 앱 생명주기 동안 내용이 변하지 않음), 변경 가능한 전역 상태로 선언되어 있어 테스트 간 오염 가능성이 있다.
- **제안**: `const` + `Object.freeze` 로 캐시 객체를 불변으로 만들거나, 5종 모두를 모듈 로드 시점에 즉시 초기화(eager initialization)해 런타임 분기를 제거한다. 5종은 고정이므로 lazy 이점이 없다.

### [INFO] `buildTools` — LLM 등록 도구 수 증가 시 반복 `getJsonSchemaFor` 호출
- **위치**: `render-tool-provider.ts` lines 225–238, `buildTools`
- **상세**: `buildTools` 는 `presentationTools` 배열을 `.map()` 으로 순회하며 각 type 별 `getJsonSchemaFor` 를 호출한다. 캐시가 있으므로 이미 O(1) 이지만, 동일 config 로 `buildTools` 가 여러 번 호출될 경우(예: multi-turn resume 시 매 turn 마다 `buildTools` 재호출) 에 대한 결과 캐싱이 없다.
- **제안**: multi-turn 경로에서 `buildTools` 재호출 빈도를 확인한다. `_resumeState` 에 이미 `presentationTools` 가 저장되어 매 resume 시 `buildTools` 가 실행된다면, 결과 `ToolDef[]` 를 `_resumeState` 에 캐싱하거나 `RenderToolProvider` 인스턴스 내부에 memoize 하는 것을 고려한다.

### [INFO] `AssistantPresentationsBlock` — `key` 생성에 `idx` fallback 사용
- **위치**: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` line 1084
- **상세**: `key={${p.toolCallId || p.type}-${idx}}` 에서 `toolCallId` 가 없으면 `p.type` + `idx` 조합을 사용한다. `toolCallId` 가 항상 존재하는 명세라면 `idx` fallback 이 불필요하고, 없을 경우 동일 type 이 두 번 나오면 key 충돌이 발생한다. React reconciliation 관점에서 stable, unique key 가 필요하다.
- **제안**: backend 가 `toolCallId` 를 항상 채우는 것이 보장되므로 `key={p.toolCallId}` 만으로 충분하다. 방어적으로 유지하려면 `key={p.toolCallId ?? `${p.type}-${p.renderedAt}-${idx}`}` 처럼 더 유니크한 fallback 을 사용한다.

### [INFO] `conversation-utils.ts` — `presentations` 필터링 시 매 turn 새 배열 참조 생성
- **위치**: `codebase/frontend/src/lib/conversation/conversation-utils.ts` lines 505–508
- **상세**: `turn.presentations && turn.presentations.length > 0 ? turn.presentations : undefined` 패턴은 turn 이 presentations 를 갖지 않을 경우 `undefined` 를 리턴하므로 새 객체 생성이 없다. 다만 `turn.presentations` 배열 참조를 그대로 전달하기 때문에 상위 컴포넌트에서 memoization 의존 시 레퍼런스 동등성은 유지된다. 이는 올바른 패턴이다.
- **제안**: 현재 구현은 메모리 관점에서 적절하다. 추가 변경 불필요.

---

## 요약

이번 변경은 AI Agent에 5종의 `render_*` 가상 도구를 추가하는 신규 기능으로, 전반적인 설계는 성능 측면에서 무리가 없다. JSON Schema 캐싱, 동기 실행으로 인한 불필요한 async 회피, `Promise.all` 병렬 실행 등 핵심 패턴은 적절히 적용되어 있다. 주된 성능 우려는 `applyOneMbCap` 함수의 tail-pop 루프로, 대용량 table/carousel payload 에서 `JSON.stringify` 를 O(n)회 반복 호출하는 구조가 CPU 집약적이다. 실제 서비스 트래픽에서 LLM이 수천 행짜리 테이블을 emit하는 경우 해당 경로가 병목이 될 수 있으며, 이진 탐색 또는 단일-step slice로 개선하는 것이 권장된다. 나머지 발견사항은 INFO 수준으로 실제 운영 부하에 영향을 미칠 가능성이 낮다.

---

## 위험도

**LOW**

> `applyOneMbCap` 의 O(n) 루프가 WARNING 이지만, LLM이 생성하는 payload 크기에 현실적 상한이 있고 LLM I/O latency 뒤에 숨겨지는 경우가 대부분이다. 즉각적 장애로 이어질 가능성은 낮으나, 대용량 table rendering 시나리오에서 CPU 스파이크 원인이 될 수 있다.
