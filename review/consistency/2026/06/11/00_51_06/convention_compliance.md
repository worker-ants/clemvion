# 정식 규약 준수 검토 결과

검토 범위: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### [WARNING] `spec/2-navigation/16-agent-memory.md` — id 필드가 파일 basename 패턴 미준수
- **target 위치**: `/Volumes/project/private/clemvion/spec/2-navigation/16-agent-memory.md` frontmatter `id: nav-agent-memory`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "id: spec 식별자. 파일 basename(확장자 제외) 기반 권장"
- **상세**: 같은 영역의 다른 모든 spec 파일은 파일명에서 숫자 prefix를 제거한 값을 `id`로 사용한다 (예: `0-dashboard.md` → `id: dashboard`, `14-execution-history.md` → `id: execution-history`). `16-agent-memory.md`의 basename은 `agent-memory`이지만 `id: nav-agent-memory`로 선언돼 영역 prefix `nav-`가 추가됐다. 이는 동일 영역 내 명명 일관성을 깨고 가드(`spec-frontmatter.test.ts`)가 basename 기반 권장을 강제하지 않더라도 관리 부담을 높인다.
- **제안**: `id: nav-agent-memory` → `id: agent-memory`로 수정. 만약 타 영역 spec과 id 충돌 우려라면 규약에 cross-area uniqueness 요구사항을 명시 추가하는 것이 적절하다.

---

### [WARNING] `spec/2-navigation/14-execution-history.md` — Rationale 섹션 누락
- **target 위치**: `/Volumes/project/private/clemvion/spec/2-navigation/14-execution-history.md` 전체 구조
- **위반 규약**: `CLAUDE.md` — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
- **상세**: 같은 `spec/2-navigation/` 영역의 `0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `15-system-status.md`, `16-agent-memory.md`, `2-trigger-list.md` 등 모든 다른 spec 문서는 `## Rationale` 섹션을 포함한다. `14-execution-history.md`만 Rationale이 없다. 본 파일은 Re-run chain 모델, 노드 카운트 N+1 회피 전략, Overview 섹션과 §1 개요의 중복 구조 채택 등 설계 결정이 다수 포함되어 있어 Rationale 부재로 의도·근거 추적이 어렵다.
- **제안**: 문서 끝에 `## Rationale` 섹션을 추가하고 최소한 (1) Overview/§1 이중 섹션 구조 채택 근거, (2) 노드 실행 목록 API에서 nodeExecutions 제외(N+1 회피) 결정 근거를 기록한다.

---

### [WARNING] `spec/2-navigation/14-execution-history.md` — 목록 API 응답 예시에 공통 래퍼 명시 누락
- **target 위치**: `/Volumes/project/private/clemvion/spec/2-navigation/14-execution-history.md` §5 "목록 API 응답 형식" 코드블록
- **위반 규약**: `spec/conventions/swagger.md §2-5` — "프로젝트는 TransformInterceptor로 모든 성공 응답을 `{ data: ... }`로 감쌉니다"; `spec/5-system/2-api-convention.md §5.2` — 목록 응답은 `{ data: [], pagination: {} }` 형태
- **상세**: `spec/2-navigation/0-dashboard.md §7`은 응답 예시 앞에 "응답 본문은 공통 래퍼(`{ \"data\": ... }`)로 감싸진다. 아래 예시는 `data` 내부 형태다"라는 주석을 명시한다. `14-execution-history.md` §5는 동일한 내부 형태 예시(`{ "data": [...], "pagination": {} }`)를 보여주면서 이 주석이 없다. `swagger.md §5-2`의 `ApiOkPaginatedResponse`는 외부 wire 포맷이 `{ data: { data: Dto[], pagination: {} } }`임을 명시한다. 래퍼 설명 없이 `data`와 `pagination`을 최상위로 보여주면 독자가 이것이 outer wire format인지 inner shape인지 혼동할 수 있다.
- **제안**: §5 목록 API 응답 코드블록 바로 위에 0-dashboard.md와 동일한 형태의 래퍼 명시 주석을 추가한다: "`> 응답 본문은 공통 래퍼(`{ \"data\": ... }`)로 감싸진다. 아래 예시는 `data` 내부 형태다.`"

---

### [WARNING] `spec/2-navigation/14-execution-history.md` — Overview 섹션 내용 부재 (비어있는 H2)
- **target 위치**: `/Volumes/project/private/clemvion/spec/2-navigation/14-execution-history.md` 18번 줄 `## Overview (제품 정의)` — 바로 다음이 `---` 구분선이고 내용이 없음
- **위반 규약**: `CLAUDE.md` 정보 저장 위치 — "제품 정의·요구사항 → spec/<영역>/_product-overview.md 또는 진입 문서의 `## Overview`"; `spec/conventions/spec-impl-evidence.md §2` — Overview 섹션은 제품 정의를 담아야 한다
- **상세**: `## Overview (제품 정의)` 섹션이 선언되어 있으나 바로 뒤에 `---` 구분선만 있고 실질적 내용이 없다. PRD 수준의 요구사항(§3 요구사항 테이블)은 바로 아래 `### 1. 개요` ~ `### 3. 요구사항`에 담겨 있는데, 이것들은 `## Overview`의 하위 섹션이 아니라 형제 섹션처럼 보이도록 `##`가 아닌 `###`로 시작된다. 결과적으로 `## Overview`는 껍데기 H2로만 존재하며 이 구조가 §1 개요와 중복·혼선을 야기한다.
- **제안**: `## Overview (제품 정의)` 섹션을 완전히 제거하고, `### 1. 개요` ~ `### 3. 요구사항`을 `## Overview` 본문으로 올려 `## 1. 개요`, `## 2. 요구사항` 등 표준 3섹션 구조로 재정렬한다. 또는 `## Overview` 아래 한 줄 요약 문단을 추가해 빈 섹션을 해소한다.

---

### [INFO] `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — `order` 래퍼 필드 설명 오류 (파싱 아티팩트)
- **target 위치**: `/Volumes/project/private/clemvion/spec/conventions/cafe24-api-catalog/application/appstore-orders.md` 응답 파라미터 표 `| order | | 정렬 순서 asc : 순차정렬 · desc : 역순 정렬 |`
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md §7.2` — "어디에도 없거나 공통 base 없이 의미가 충돌하는 generic 명은 빈칸으로 둔다(추측 주입 금지)"
- **상세**: 응답 래퍼 객체 `order`의 설명이 "정렬 순서 asc : 순차정렬 · desc : 역순 정렬"로 기입되어 있다. 이는 HTML 파싱 시 다른 필드(`order` 쿼리 파라미터)의 설명이 잘못 매핑된 아티팩트다. `order` 래퍼는 appstore 주문 데이터 객체이므로 이 설명은 의미가 완전히 다르다. `_overview.md`의 추측 주입 금지 원칙상 빈칸이어야 한다. 참고로 동일 파일에서 두 곳(GET/POST 응답 표) 모두 동일하게 오기재되어 있다.
- **제안**: `| order | | 정렬 순서 ... |` → `| order | | (응답 객체) |`로 수정하거나, 설명이 확인 불가능하면 빈칸으로 둔다.

---

### [INFO] `spec/2-navigation/` 전체 — `_product-overview.md` 및 `_layout.md` 파일은 정식 규약 점검 대상 외
- **target 위치**: `/Volumes/project/private/clemvion/spec/2-navigation/_product-overview.md`, `_layout.md`
- **위반 규약**: 없음 — 점검 대상 제외 확인
- **상세**: `spec-impl-evidence.md §1`에 따라 밑줄 prefix 파일(`_*.md`)은 frontmatter 의무에서 제외된다. 해당 파일들에 `id`/`status` frontmatter가 없는 것은 정상이다.

---

## 요약

`spec/2-navigation/` 영역의 정식 규약 준수 상태는 전반적으로 양호하다. frontmatter `id`/`status`/`code:` 패턴은 `16-agent-memory.md`를 제외한 모든 파일에서 규약을 준수한다. 주요 문제는 두 가지다: (1) `16-agent-memory.md`의 `id` 값이 basename 기반 권장 패턴을 벗어나 `nav-` prefix가 추가돼 있고, (2) `14-execution-history.md`가 Rationale 섹션이 없고 `## Overview` 섹션이 내용 없는 빈 껍데기로 선언돼 3섹션 구조 권장을 충족하지 못하며, 목록 응답 예시에 공통 래퍼 설명이 빠져 있다. Cafe24 API 카탈로그 필드 파일(`appstore-orders.md`)에는 파싱 아티팩트로 인한 잘못된 필드 설명이 있으나 이 파일은 spec-impl-evidence 가드 대상 외 생성기 산출물이므로 INFO로 분류한다.

## 위험도

MEDIUM
