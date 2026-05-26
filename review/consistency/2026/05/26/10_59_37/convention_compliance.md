# 정식 규약 준수 검토 결과

검토 범위: `spec/2-navigation/` (구현 착수 전 검토 --impl-prep)  
검토 기준: `spec/conventions/` 정식 규약

---

## 발견사항

### **[WARNING]** `spec/2-navigation/14-execution-history.md` — frontmatter `status` 가 실제 구현 상태와 불일치

- target 위치: `14-execution-history.md` frontmatter `status: spec-only` + 본문 §3.1~§3.3 요구사항 표
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클`
- 상세: 요구사항 표에서 EH-LIST-01~08, EH-DETAIL-01~09, EH-NAV-01~04 이 모두 `✅` (구현 완료) 로 표시되어 있다. `spec-only` 는 "작성됐고 구현 의도 결정됨" 을 의미하는데, 대부분의 surface 가 이미 구현되었으므로 실제 상태는 `partial` (EH-DETAIL-10 / EH-DETAIL-11 이 `🚧 구현 PR2`) 또는 `implemented` (PR2 완료 시) 이다. `partial` 로 변경하면 `pending_plans:` 필드가 의무화된다. `spec-impl-evidence.md §3` 의 전이 규칙: "최초 코드 머지 시점에 `partial` 로 승격".
- 제안: `status: partial` 로 변경하고, EH-DETAIL-10 / EH-DETAIL-11 을 책임지는 plan 파일 경로를 `pending_plans:` 에 등재. 해당 plan 이 `plan/in-progress/` 에 존재해야 `spec-pending-plan-existence.test.ts` 가드를 통과한다. 또한 이미 구현 완료된 surface 의 코드 경로를 `code:` 에 채워야 `spec-code-paths.test.ts` 가 검증 가능해진다.

---

### **[WARNING]** `spec/2-navigation/14-execution-history.md` — 중복 섹션 구조 (`## Overview` + `## 1. 개요` 병존)

- target 위치: `14-execution-history.md` 13번째 줄 `## Overview (제품 정의)` 와 89번째 줄 `## 1. 개요`
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 — Overview / 본문 / Rationale"
- 상세: 문서가 최상위 레벨에서 `## Overview (제품 정의)` → `### 1. 개요 / ### 2. 페이지 구조 / ### 3. 요구사항` 을 포함한 뒤, 별도로 `## 1. 개요` 가 다시 등장한다. 두 번의 "개요" 섹션이 다른 내용(PRD 통합 원문 vs 스펙 본문 개요)을 각각 담고 있어 독자 혼란 및 앵커 충돌을 유발한다. 권장 3섹션 구조는 Overview → 본문(하위 섹션들) → Rationale 이지, Overview 안에 본문 개요가 중첩되는 구조가 아니다.
- 제안: `## Overview (제품 정의)` 섹션을 `_product-overview.md` 로 분리하거나 제목을 `## 배경 및 목표` 로 변경해 본문 `## 1. 개요` 와 의미 충돌을 제거한다. 또는 PRD 통합 원문(§1~§3 요구사항 표)을 Overview 안으로 완전히 흡수하고 `## 1. 개요` 를 삭제하는 방향도 가능하다.

---

### **[WARNING]** `spec/2-navigation/0-dashboard.md` — API 응답 예시가 `{ data: ... }` 래퍼 없이 flat 객체로 정의됨

- target 위치: `0-dashboard.md §7 API 엔드포인트` — `/api/dashboard/summary` 응답 예시 JSON
- 위반 규약: `spec/conventions/swagger.md §2-5` ("프로젝트는 `TransformInterceptor`로 모든 성공 응답을 `{ data: ... }`로 감쌉니다") 및 `spec/5-system/2-api-convention.md §5.1` 단일 리소스 응답 형식
- 상세: 응답 예시가 `{ "totalWorkflows": 12, "activeWorkflows": 10, ... }` 처럼 최상위에 직접 필드를 나열한다. 실제 서버는 `TransformInterceptor` 가 모든 응답을 `{ data: ... }` 로 래핑하므로, 실제 응답은 `{ "data": { "totalWorkflows": 12, ... } }` 이어야 한다. 스펙과 실제 응답 형식이 일치하지 않으면 구현자가 다른 형식으로 클라이언트를 작성할 위험이 있다.
- 제안: 응답 예시를 아래와 같이 수정한다.
  ```json
  {
    "data": {
      "totalWorkflows": 12,
      "activeWorkflows": 10,
      "inactiveWorkflows": 2,
      "runs7d": 87,
      "successRate": 94.2,
      "avgExecutionTime": 4.3
    }
  }
  ```

---

### **[WARNING]** `spec/2-navigation/0-dashboard.md` — API 엔드포인트 경로가 복수형 명사 규약과 거리가 있음

- target 위치: `0-dashboard.md §7` — `/api/dashboard/summary`, `/api/dashboard/recent-workflows`, `/api/dashboard/recent-executions`
- 위반 규약: `spec/5-system/2-api-convention.md §2.2` ("리소스는 복수형 명사")
- 상세: `/api/dashboard` 는 단수형이며 CRUD 리소스가 아닌 집계 endpoint 이다. API 규약 §2.2 는 리소스 식별자는 복수형 명사를 사용하도록 규정하고 있으나, 별도의 집계 endpoint 예외 조항이 명시되어 있지 않다. 현재 존재하는 예외는 "RPC-style sub-channel action" 만이다. 대시보드 집계 endpoint 가 이 규약과 긴장 관계에 있음을 명시적으로 처리할 필요가 있다.
- 제안: (a) API 규약 `spec/5-system/2-api-convention.md §2.2` 에 "집계·비-CRUD 요약 endpoint (예: `/api/dashboard/*`) 는 복수형 적용 예외" 항목을 추가해 규약 자체를 갱신하거나, (b) 엔드포인트를 `/api/dashboards/summary` 처럼 복수형으로 변경한다. 양쪽 모두 일관성 갱신이 필요하므로 한쪽을 선택해 규약과 스펙을 동기화해야 한다. 집계 endpoint 특성상 (a) 가 현실적이다.

---

### **[INFO]** `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/11-error-empty-states.md`, `spec/2-navigation/12-workflow-version-history.md`, `spec/2-navigation/13-user-guide.md` — `## Rationale` 섹션 없음

- target 위치: 각 파일 전체
- 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" / "Spec 문서 3섹션 구성 — Overview / 본문 / Rationale"
- 상세: `0-dashboard.md` 는 집계 API 엔드포인트 설계나 반응형 레이아웃 기준에 대한 의사결정 배경이 없다. `11-error-empty-states.md` 는 에러 코드 분류(5종)나 사이드바 표시/숨김 규칙에 대한 근거가 없다. `12-workflow-version-history.md` 는 버전 불변성(immutable snapshot) 정책, 복원이 새 버전을 생성하는 이유 등 의사결정 근거가 없다. `13-user-guide.md` 는 IA 구조, MDX 컴포넌트 선택 등에 대한 근거가 없다. 3섹션 구성은 "권장" 이나 의사결정이 포함된 spec 에서는 Rationale 부재가 미래 변경 시 배경 분실로 이어진다.
- 제안: 주요 설계 결정이 포함된 spec 에 `## Rationale` 섹션을 추가한다. INFO 등급이므로 블로킹 조건은 아니지만, `10-auth-flow.md` 와 `1-workflow-list.md`, `2-trigger-list.md` 가 Rationale 을 포함하는 것에 비해 일관성이 낮다.

---

### **[INFO]** `spec/conventions/cafe24-api-catalog/application.md` 외 catalog 파일들 — `status: spec-only` 이나 실제로는 catalog 내용이 구현 완료됨

- target 위치: `spec/conventions/cafe24-api-catalog/application.md`, `category.md`, `collection.md` 등 frontmatter
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클`
- 상세: `_overview.md §5 Coverage Matrix` 에 따르면 18개 resource 가 전부 0-planned (모두 `supported`) 이다. 즉 backend 메타데이터에 이미 구현되어 있는데, 개별 catalog 파일들의 frontmatter 는 `status: spec-only, code: []` 를 유지하고 있다. 이는 `spec-impl-evidence.md §3` 의 `spec-only` 정의("작성됐고 구현 의도 결정됨")와 맞지 않는다 — 이미 구현까지 완료된 상태다. 단, cafe24 catalog 파일의 특수성(Cafe24 외부 API 메타데이터 SoT로서의 역할)을 고려하면 `implemented` 로 변경하기보다 별도 처리가 적절할 수 있다.
- 제안: `spec-impl-evidence.md` 에 "cafe24-api-catalog 디렉토리는 `catalog-sync.spec.ts` 가 별도 동기 가드를 수행하므로 spec-impl-evidence 가드에서 제외" 항목을 추가하거나, 각 catalog 파일에 `status: implemented, code: ["codebase/backend/src/nodes/integration/cafe24/metadata/*.ts"]` 를 채우는 방식으로 실제 상태와 frontmatter 를 일치시킨다.

---

## 요약

`spec/2-navigation/` 영역의 정식 규약 준수 수준은 전반적으로 양호하나, 두 가지 주의 항목이 구현 착수 전에 정정이 필요하다. 첫째, `14-execution-history.md` 는 대부분 surface 가 이미 구현되어 있음에도 `status: spec-only` 를 유지하고 있어 `spec-impl-evidence` 가드가 요구하는 `partial` 전이 및 `pending_plans` 등록이 누락되었다 — 이 상태로 구현 착수 시 spec-frontmatter 가드가 향후 fail 할 수 있다. 둘째, `0-dashboard.md` 의 API 응답 예시가 `TransformInterceptor` 래퍼(`{ data: ... }`)를 생략하고 있어, 클라이언트 코드 작성 시 구현자가 규약과 다른 응답 형식을 기대할 위험이 있다. 나머지 항목은 문서 구조 일관성(Rationale 부재, Overview 중복) 과 API 명명 규약 예외 처리 관련 INFO/WARNING 이며, CRITICAL 항목은 없다.

---

## 위험도

**MEDIUM**

`{ data: ... }` 래퍼 누락은 구현자가 실제 API 응답 형식을 잘못 이해하게 만들 수 있는 출력 포맷 규약 위반이며, `status` 불일치는 build-time 가드 fail 의 원인이 된다. 두 항목 모두 구현 착수 전 정정 권장.
