# 아키텍처(Architecture) 리뷰

**대상 PR**: kb-unsearchable-warning (PR #508)
**리뷰 일시**: 2026-06-06
**리뷰어**: architecture sub-agent

---

## 발견사항

### **[INFO]** 레이어 경계 준수 — 신호 변환 책임 분리가 명확함
- **위치**: `rag-search.service.ts` → `kb-tool-provider.ts` → `ai-agent.handler.ts`
- **상세**: `RagSearchService`는 검색 불가 원인을 도메인 언어(`KbUnsearchableReason`)로 반환하고, `KbToolProvider`는 이를 LLM이 소비할 `tool_result` 봉투(JSON)로 변환하며, `AiAgentHandler`/`RagAccumulator`는 노드 진단 메타(`skipReason`)로 집계한다. 각 레이어가 자기 레이어의 언어로 변환하는 책임 분리가 잘 되어 있다.
- **제안**: 현행 구조 유지.

---

### **[INFO]** 개방-폐쇄 원칙 — `SearchWithMetaResult`의 선택적 필드 확장 방식
- **위치**: `rag-search.service.ts` lines 161–170, `SearchWithMetaResult` 타입 정의
- **상세**: 기존 `SearchWithMetaResult`에 `unsearchable?: ...` 필드를 선택적으로 추가하여 기존 호출부(`KbToolProvider` 등)에 영향을 최소화했다. 호출부는 `undefined` 체크만으로 분기하므로 신규 상태를 인식하지 못하는 이전 코드가 안전하게 동작하는 개방-폐쇄 패턴이 적용됐다. `withUnsearchable` 헬퍼 함수도 결과 조합을 한곳에 집중해 중복을 제거한다.
- **제안**: 현행 구조 유지.

---

### **[WARNING]** `RagAccumulator`의 이중 카운터 — 상태 응집도 약화 징후
- **위치**: `ai-agent.handler.ts` lines 373–374, 395–398 (`diagnosticCount`, `unsearchableCount`)
- **상세**: `RagAccumulator`는 `skipReason` 판별을 위해 `diagnosticCount`와 `unsearchableCount` 두 개의 분리된 카운터를 유지한다. 현재는 단순하지만 이 패턴은 "모든 KB 호출이 unsearchable인 경우에만 `kb_unsearchable`" 이라는 비즈니스 규칙이 카운터 비교 연산(`unsearchableCount === diagnosticCount`)으로 암묵적으로 표현된다. 향후 skipReason 종류가 늘어나면 카운터가 추가로 증가하고 단일 `build()` 메서드의 조건 분기가 복잡해질 수 있다. 또한 `diagnosticCount`라는 이름이 "KB 호출 수"를 의미한다는 것이 직관적이지 않다 — `kbCallCount`가 더 명확하다.
- **제안**: 단기: `diagnosticCount` → `kbCallCount`로 이름 변경. 중기: KB 호출 결과를 별도 상태 객체(예: `kbResults: Array<{unsearchable: boolean, ...}>`)로 누적하면 `build()` 메서드가 카운터 비교 대신 선언적 필터로 판별 가능하다.

---

### **[WARNING]** `KbToolProvider`의 `unsearchable` 처리 — 단일 책임 경계 확장 부담
- **위치**: `kb-tool-provider.ts` lines 524–565 (`unsearchableHit` 분기)
- **상세**: `KbToolProvider`는 현재 (1) KB 메타 조회, (2) RAG 검색 실행, (3) 결과 포매팅, (4) 오류 처리, (5) rerank 진단 집계, (6) no-grounding 신호 처리, 그리고 이번 추가로 (7) unsearchable 봉투 생성까지 7개의 서브-책임을 `execute()` 메서드 안에 가진다. `unsearchableHit && results.length === 0` 조건이 `results.length === 0`인 경우에만 unsearchable 봉투를 반환하는 것은 혼합 결과(partial — 일부 searchable, 일부 unsearchable) 케이스를 현재 `RagSearchService`가 단일 KB 단위로 호출되는 구조에서는 문제 없지만, 향후 멀티-KB 배치 호출 구조로 확장될 때 이 조건이 잘못 동작할 수 있다.
- **제안**: 현 단계에서 리팩터링보다는 `// INVARIANT: KbToolProvider는 단일 KB로만 호출됨` 주석을 추가해 전제를 명시화하고, 멀티-KB 리랭크 후속(plan/in-progress/rag-rerank-followup.md)에서 레이어 재검토를 예약할 것을 권장한다.

---

### **[INFO]** 프론트엔드 레이어 — 표현 로직이 `page.tsx`에 인라인
- **위치**: `codebase/frontend/src/app/(main)/knowledge-bases/page.tsx` lines 866–886
- **상세**: `embeddingDimension == null` 조건과 `reembedStatus` 분기를 포함한 배지 렌더링 로직이 페이지 컴포넌트에 직접 인라인됐다. 현재 복잡도 수준에서는 허용 범위이나 동일 조건이 다른 뷰(예: KB 상세 페이지 배너, follow-up plan에서 언급된 CTA)에 재사용될 경우 중복이 발생한다. 또한 `kb.reembedStatus === "in_progress"` 가 두 번 반복 평가된다.
- **제안**: `UnsearchableKbBadge` 컴포넌트로 추출하여 재사용성을 확보할 것을 권장한다. 이는 follow-up plan(kb-model-change-reembed-followup)의 상세 페이지 배너 추가 시 자연스러운 재사용 지점이 된다.

---

### **[INFO]** 순환 의존성 — 없음
- **위치**: 전체 변경 범위
- **상세**: `rag-search.service.ts`가 export하는 `KbUnsearchableReason` 타입을 `kb-tool-provider.ts`가 `Awaited<ReturnType<...>>['unsearchable']` 구조 타입 참조로 소비하는 방식으로, 직접 타입 import 없이 타입 추론에 의존한다. 의존 방향은 `handler → tool-provider → rag-service`의 단방향이며 순환 없음.

---

### **[INFO]** `KbUnsearchableReason` 타입 배치 — 적절한 추상화 레벨
- **위치**: `rag-search.service.ts` lines 157–159
- **상세**: `KbUnsearchableReason` union 타입이 `rag-search.service.ts`에 정의되고 `export`된다. 이 타입의 소비자는 `kb-tool-provider.ts`(`unsearchable` 필드 접근)와 테스트 파일들이다. 검색 도메인의 상태 코드를 검색 서비스 파일에 정의하는 것은 응집도 측면에서 적절하다. 다만 `tool-provider`에서도 이 이유 문자열을 tool_result JSON의 `reason` 필드로 노출하므로 계약이 두 레이어에 걸쳐 중복된다 — `KbToolProvider`가 `unsearchableHit.reason`을 그대로 통과시키므로 중복은 최소화돼 있다.

---

## 요약

이번 변경은 "침묵하는 0건 결과" 문제를 "명시적 not_searchable 신호"로 전환하는 진단 인프라를 추가하며, 레이어 책임 분리(`RagSearchService` → `KbToolProvider` → `RagAccumulator`)가 전반적으로 명확하다. 개방-폐쇄 원칙이 `SearchWithMetaResult`의 선택적 필드 확장으로 잘 준수됐고 기존 코드에 대한 영향이 최소화됐다. 아키텍처 관점의 주요 약점은 두 가지다: (1) `RagAccumulator`의 이중 카운터가 비즈니스 규칙을 암묵적으로 인코딩해 향후 확장 시 부채가 될 수 있고, (2) `KbToolProvider.execute()`의 서브-책임 누적이 이번 변경으로 7개로 증가해 단일 책임 경계를 초과하기 시작한다. 프론트엔드의 배지 로직 인라인은 follow-up 시 컴포넌트 추출이 자연스럽게 요구될 것이다. 전체적으로 현 시점의 범위와 복잡도에서는 수용 가능한 수준이나 위의 WARNING 두 건은 후속 리팩터링 예약을 권장한다.

## 위험도

LOW
