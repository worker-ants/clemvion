# Convention Compliance Review
검토 모드: 구현 착수 전 (--impl-prep)
대상: `spec/2-navigation` + `spec/conventions/cafe24-api-catalog/application.md` + `spec/conventions/cafe24-api-catalog/application/apps.md` + `spec/conventions/cafe24-api-catalog/_overview.md`

---

## 발견사항

### 1. **[WARNING]** `spec/conventions/cafe24-api-catalog/application.md` — `webhooks_update` id가 경로 sub-resource `setting`을 생략
- target 위치: `application.md` 표, `webhooks_update` 행 (`PUT webhooks/setting`)
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §2` — id 형식 `<resource>_<sub>_<verb>` (예: `product_options_create`)
- 상세: 경로가 `webhooks/setting`이므로 sub-resource는 `setting`이다. 동일 파일의 다른 복합 경로 항목들(`databridge_logs_list` = `databridge/logs`, `appstore_orders_get` = `appstore/orders/{id}`, `webhooks_logs_list` = `webhooks/logs`)은 모두 sub를 id에 포함한다. `webhooks_update`만 `setting`을 생략해 `<resource>_<verb>` 패턴으로 처리함으로써 다른 행과 명명 일관성이 깨진다. 올바른 id는 `webhooks_setting_update`.
- 제안: `webhooks_update` → `webhooks_setting_update` 로 변경. backend 메타데이터(`application.ts`)의 operation id도 동시에 갱신 필요 (catalog-sync.spec.ts 연동). 단, 이 id가 이미 클라이언트-노드 계약에 포함되어 있다면 §2 안정성 정책과 동일하게 파급 범위를 먼저 확인할 것.

---

### 2. **[WARNING]** `spec/2-navigation/14-execution-history.md` — `## Overview (제품 정의)`와 `## 1. 개요` 이중 구조
- target 위치: `14-execution-history.md` 18행 (`## Overview (제품 정의)`) + 75행 (`## 1. 개요`)
- 위반 규약: `spec/conventions/spec/project-planner SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션. "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 권장
- 상세: `spec/2-navigation`은 이미 `_product-overview.md`를 보유한다. 개별 spec 파일에서 `## Overview (제품 정의)` 절과 별도의 `## 1. 개요` 절을 동시에 두는 것은 3섹션 권장 구조에서 Overview 역할이 중복된다. 동일 영역의 다른 spec 파일들(0-dashboard, 1-workflow-list, 10-auth-flow 등)은 `## Overview` 없이 `## 1.` 번호 절로 시작하는 단일 패턴을 따른다. `14-execution-history.md`만 두 패턴을 혼재한다.
- 제안: `## Overview (제품 정의)` 절의 배경·목표·요구사항 내용을 `_product-overview.md`로 이관하거나, `## 1. 개요`를 삭제하고 Overview를 기술적 개요로 통합. 또는 현재 혼재가 의도적이라면 conventions 갱신으로 영역 내 패턴을 허용 명시.

---

### 3. **[INFO]** `spec/2-navigation/15-system-status.md` · `spec/2-navigation/16-agent-memory.md` — `## Overview` 절 없이 본문 직접 시작
- target 위치: `15-system-status.md` 14행 (`## 1. 화면 구조`), `16-agent-memory.md` 17행 (`## 1. 화면 구조`)
- 위반 규약: `spec/conventions/project-planner SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션
- 상세: 두 파일 모두 제목 아래 한 문장 설명만 있고 `## Overview` 절 없이 `## 1.` 번호 절로 시작한다. 영역 내 다수 spec이 Overview를 가지지 않으므로 이 패턴은 영역 내 norm이며 규약은 "권장" 이다. `_product-overview.md`가 영역 전체 Overview를 커버하므로 치명적 위반은 아니나, 이 두 spec은 상대적으로 독립적 surface(`/system-status`, `/agent-memory`)라 product 정의 절을 추가하면 명확성이 높아진다.
- 제안: 의무 수정은 아님. 다음 spec 편집 기회에 기능 목적·요구사항을 `## Overview (제품 정의)` 절로 앞에 두는 것을 고려.

---

### 4. **[INFO]** `spec/2-navigation/2-trigger-list.md` — `## Overview` 절 없이 본문 시작 (영역 norm과 일치하나)
- target 위치: `2-trigger-list.md` 21행 (`## 1. 화면 구조`)
- 위반 규약: 위 §3과 동일 — 3섹션 권장
- 상세: 위 §3과 동일한 패턴. 단 `2-trigger-list.md`는 237행으로 비교적 상세한 Rationale 절(R-1 ~ R-16)을 갖추어 3섹션 중 Rationale은 충분히 구현됨.
- 제안: §3과 동일.

---

### 5. **[INFO]** `spec/conventions/cafe24-api-catalog/application/apps.md` — `entity: apps` 단어가 단수형이고 operation id `applications_list`와 복수형 불일치
- target 위치: `apps.md` frontmatter `entity: apps`, `application.md` 표의 `id: applications_list`
- 위반 규약: `spec/conventions/cafe24-api-catalog/_overview.md §7.1` — `<entity_id>`는 Cafe24 docs sub-resource anchor 식별자와 동일 형식(kebab-case)
- 상세: entity id `apps`(단수)와 operation id `applications_list`(복수 "applications")가 혼재한다. 형태 자체는 convention 위반이 아니나(단어 형태는 docs anchor 기준이므로) 내부 참조 일관성 관점에서 minor 불일치. `applications_list`의 라벨 "설치된 앱 목록 조회"와 English title "Retrieve an app information"(단수)도 docs 원문 불일치를 그대로 전사하는데 이는 §7.3 "docs 출처 결정적 파싱" 원칙에 따라 올바른 처리임.
- 제안: docs 원문 불일치는 본 카탈로그 변경 대상이 아님. `plan/in-progress/cafe24-backlog-residual.md §G-2` 트랙이 이미 추적 중.

---

## 요약

`spec/2-navigation` 대상 spec 파일들은 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) 준수, 에러 코드 `UPPER_SNAKE_CASE` 표기, API 응답 래퍼 `{data:...}` 형식, 페이지네이션 포맷(`page`/`limit`/`totalItems`/`totalPages`) 등 핵심 출력 형식 규약을 준수한다. `partial` 상태 3개 파일 모두 `pending_plans`가 작성되어 있고 해당 plan 파일이 실존하여 `spec-pending-plan-existence` 가드를 통과한다. `spec/conventions/cafe24-api-catalog/application.md`에서 `webhooks_update` id가 경로 sub-resource(`setting`)를 생략해 동일 파일의 복합 경로 명명 패턴과 불일치하는 점(WARNING)이 주요 발견사항이다. `14-execution-history.md`에서 `## Overview`와 `## 1. 개요`가 이중 구조로 공존해 3섹션 권장 구조의 일관성이 낮아진다(WARNING). 나머지는 3섹션 Overview 절 부재로 영역 norm과 일치하는 INFO 수준이다.

## 위험도

MEDIUM
