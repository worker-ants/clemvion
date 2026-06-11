# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/2-navigation/14-execution-history.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-11

---

## 발견사항

### **[WARNING]** 목록 API 응답 JSON 샘플에 집계 카운트 필드 누락
- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 (목록 API 응답 형식 JSON 샘플)
- **충돌 대상**: 동일 문서 §2.4 Nodes 열 본문 및 §R-1 (Rationale)
- **상세**: §2.4 와 §R-1 은 `ExecutionDto` 가 `totalNodeCount` / `completedNodeCount` / `failedNodeCount` 세 배치 집계 필드를 응답한다고 명시한다. 그러나 §5 의 목록 API 응답 JSON 예시에는 이 세 필드가 빠져 있다. 예시만 보고 DTO 를 구현하면 Nodes 열 렌더링이 깨진다.
- **제안**: JSON 샘플에 `"totalNodeCount": 5, "completedNodeCount": 5, "failedNodeCount": 0` 세 필드를 추가한다.

---

### **[WARNING]** 목록 API 응답 JSON 샘플에 `executionPath` 필드 잔존 — DB 컬럼은 V036 에서 DROP 됨
- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 JSON 샘플 내 `"executionPath": []`
- **충돌 대상**: `spec/1-data-model.md` §2.13 Execution 및 §Execution.execution_path → ExecutionNodeLog (V035/V036 마이그레이션 이력)
- **상세**: `spec/1-data-model.md` 는 `execution_path UUID[]` 컬럼이 V036 에서 DROP 됐고, `findById` 가 `ExecutionNodeLog` 의 정렬 쿼리로 `executionPath: string[]` 응답 시그니처를 채운다고 명시한다. 문제는 이 `executionPath` 가 상세 API(`GET /api/executions/:id`) 응답에 해당하는 파생 필드인데, target 의 **목록 API** 응답 JSON 샘플에도 동일하게 노출되어 있다는 점이다. 목록 API 에서 `ExecutionNodeLog` 를 N+1 없이 응답하려면 별도 배치 조회가 필요하나, §R-1 은 목록 API 에서 노드 실행 데이터를 제외하는 것이 설계 의도임을 명시한다. `executionPath` 를 목록 응답에 포함할 것인지, 상세 전용으로 둘 것인지 명시적 결정이 필요하다.
- **제안**: (a) 목록 API 응답 JSON 샘플에서 `executionPath` 를 제거하거나, (b) 목록 API 에서도 `ExecutionNodeLog` 배치 조회로 제공함을 §R-1 에 명시한다. 현재 코드(`executions.service.ts`)의 실제 동작 기준으로 정합성을 맞출 것.

---

### **[INFO]** `sort` 쿼리 파라미터 값이 snake_case — API 규약상 일반 파라미터 케이스 안내 부재
- **target 위치**: `spec/2-navigation/14-execution-history.md` §5 목록 API 쿼리 파라미터 (`sort` 값: `started_at`, `finished_at`, `status`, `duration_ms`)
- **충돌 대상**: `spec/5-system/2-api-convention.md` §4.1 목록 조회 쿼리 파라미터
- **상세**: API 규약 §4.1 은 `sort` 예시로 `created_at`(snake_case) 을 보여주고, target 도 snake_case 값을 사용해 표면적으로 일치한다. 그러나 다른 영역의 API 목록 엔드포인트와 `sort` 필드 값의 케이스 규약이 명시된 곳이 없어 불일치 위험이 있다. 현재로서는 충돌 없음이나, 향후 camelCase 로 마이그레이션 시 여기서 먼저 정의된 값이 기준이 될 수 있다.
- **제안**: `spec/5-system/2-api-convention.md` §4.1 에 `sort` 파라미터 값의 케이스(DB column 이름 그대로 snake_case) 를 한 줄 명시해 전체 일관성을 보장한다. target 은 현재 그대로 유지 가능.

---

### **[INFO]** 필터 레이블 `Waiting` vs 요구사항 ID 표의 `Waiting for Input` — 약어 불일치
- **target 위치**: `spec/2-navigation/14-execution-history.md` §2.3 필터 표 (필터 열: `Waiting`) vs EH-LIST-03 요구사항 표 (`Waiting for Input`)
- **충돌 대상**: 동일 문서 내부 (외부 충돌 아님)
- **상세**: EH-LIST-03 에는 필터 이름이 "Waiting for Input" 으로 기재되어 있고, §2.3 필터 표에서는 "Waiting" 으로 단축되어 있다. UI 라벨 기준인지, 필터 버튼 텍스트 기준인지 명확하지 않아 구현자 혼란 가능. 심각한 충돌은 아니나 요구사항과 명세 간 표기를 통일할 것이 권장된다.
- **제안**: §2.3 필터 표의 필터 열 값을 "Waiting for Input" 으로 통일하거나 EH-LIST-03 을 "Waiting" 으로 맞춘다.

---

### **[INFO]** `Execution.status` enum: target 필터에 `pending` 상태 없음
- **target 위치**: `spec/2-navigation/14-execution-history.md` §2.3 필터 버튼 목록
- **충돌 대상**: `spec/1-data-model.md` §2.13 `Execution.status` Enum (`pending / running / completed / failed / cancelled / waiting_for_input`)
- **상세**: 데이터 모델의 `Execution.status` 에는 `pending` 이 포함되어 있으나, target 의 필터 버튼 및 테이블 Status 열 아이콘 목록에는 `pending` 이 없다. `pending` 은 큐 등록 직후 매우 짧게 유지되는 상태로 사용자에게 노출할 필요성이 낮을 수 있으나, 명시적으로 필터 제외 이유를 기술하지 않아 구현 시 누락 여부를 알기 어렵다.
- **제안**: §2.3 또는 §Rationale 에 `pending` 상태를 필터 및 테이블에서 노출하지 않는 이유(예: 순간적 전이 상태, 사용자 진단 불필요)를 한 줄 명시한다.

---

### **[INFO]** `spec/0-overview.md` §4 영역 진입 문서 표의 "실행 이력" 행 — `_product-overview.md` 없이 단독 spec 파일 구조 표기
- **target 위치**: `spec/0-overview.md` §4 영역별 진입 문서 표 (실행 이력 행: `(Overview 섹션 통합)` | `./2-navigation/14-execution-history.md`)
- **충돌 대상**: `spec/0-overview.md` §8 문서 맵 컨벤션 설명
- **상세**: `14-execution-history.md` 는 `## Overview (제품 정의)` 섹션을 직접 포함하는 단일 파일 구조를 취한다. 이는 `0-overview.md` §8 컨벤션("단일 spec 파일 영역은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다")과 일치한다. 충돌은 아니나, `spec/0-overview.md` 의 문서 맵 표가 이 구조를 정확히 반영하고 있는지(현재 반영됨) 확인이 필요했다. 실제로는 일관됨.
- **제안**: 변경 불필요. 현재 일치함.

---

## 요약

`spec/2-navigation/14-execution-history.md` 는 전반적으로 `spec/1-data-model.md`, `spec/5-system/13-replay-rerun.md`, `spec/3-workflow-editor/_product-overview.md`, `spec/5-system/2-api-convention.md` 와 큰 모순 없이 정합성을 유지한다. 다만 두 가지 WARNING 이 주목된다. 첫째, §5 목록 API 응답 JSON 샘플에 §2.4 및 §R-1 이 명시하는 `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 집계 필드가 빠져 있어 DTO 구현 시 오해를 유발할 수 있다. 둘째, 같은 JSON 샘플에 `executionPath` 필드가 포함되어 있는데, 이 필드가 목록 API 응답에서도 내려지는지 아니면 상세 API 전용인지 §R-1 의 N+1 회피 원칙과 모순 없이 명확히 정의되어 있지 않다. 두 항목 모두 target 문서 내 JSON 샘플을 실제 DTO 계약에 맞게 교정하면 해소된다.

---

## 위험도

**LOW**
