# 정식 규약 준수 분석 — `spec/4-nodes/6-presentation/0-common.md`

검토 모드: `--impl-prep` (구현 착수 전 검토)  
검토 일시: 2026-05-25  
대상: `spec/4-nodes/6-presentation/0-common.md`

---

## 발견사항

### [WARNING] 섹션 번호 순서 역전 — §10 이 §9 보다 앞에 위치

- **target 위치**: 파일 본문 — `## 10. AI Tool 모드 (render_*)` (line 263) 이 `## 9. CHANGELOG` (line 423) 보다 앞에 배치됨
- **위반 규약**: `spec/conventions/` 직접 위반은 아니나, CLAUDE.md 의 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 원칙 및 `project-planner/SKILL.md §Spec 문서 구조` 권장 구조와 어긋남. 문서 내비게이션·anchor 링크의 논리적 순서가 깨짐
- **상세**: 문서 내 섹션 순서가 §1→§2→§3→§4→§4.6→§5→§6→§7→§8→**§10**→**§9**→Rationale 임. §9 CHANGELOG 가 §10 뒤에 위치해 있어 섹션 번호와 물리적 순서가 불일치. 이 상태에서 새 섹션을 추가할 때 삽입 위치 혼란 야기 가능
- **제안**: `## 9. CHANGELOG` 블록을 `## 8. 출력 구조 색인` 과 `## 10. AI Tool 모드` 사이로 이동. 또는 §9 와 §10 번호를 물리적 순서와 일치하도록 교환

---

### [WARNING] `## 4.6` 의 heading 레벨이 상위 구조와 불일치

- **target 위치**: line 135 — `## 4.6 Conversation Thread opt-out (공통)`
- **위반 규약**: `project-planner/SKILL.md §Spec 문서 구조` 의 계층 구조 원칙. `## 4.` (H2) 의 하위 절인 `§4.1` / `§4.2` 는 `###` (H3) 으로 작성되어 있음에도, `§4.6` 은 `##` (H2) 로 마킹되어 있음
- **상세**: `### 4.1 Waiting` (H3), `### 4.2 Resumed` (H3) 과 달리 `## 4.6 Conversation Thread opt-out` 은 H2 이므로 섹션 계층이 깨짐. Markdown 파서·자동 TOC 생성기가 §4.6 을 §1~§10 과 동급 최상위 절로 취급함
- **제안**: `## 4.6` → `### 4.6` 으로 heading 레벨 변경. 또는 §4 와 완전히 분리된 독립 섹션으로 의미를 명확히 하려면 `## 5.` 이후로 재번호 부여 (이하 기존 섹션 번호 일괄 조정 필요)

---

### [WARNING] `## Overview` 섹션 부재 — 3섹션 권장 구조 불충족

- **target 위치**: 파일 전체 — `## Overview (제품 정의)` 절이 존재하지 않음
- **위반 규약**: `project-planner/SKILL.md §Spec 문서 구조` — "3섹션 권장: `## Overview (제품 정의)` / 본문 / `## Rationale`". CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: `## Rationale` 은 존재하나, `## Overview` 가 없음. 영역 내 다중 spec 파일이 있는 경우 `_product-overview.md` 별도 파일로 대체 가능하지만, `spec/4-nodes/6-presentation/_product-overview.md` 파일이 현재 존재하지 않음. 결과적으로 이 하위 영역에 제품 정의·사용자 가치·요구사항을 담은 Overview 진입 문서가 어디에도 없음
- **제안**: 두 가지 선택지 중 하나 적용:
  1. `spec/4-nodes/6-presentation/_product-overview.md` 를 신규 생성하여 Presentation 카테고리 노드 전체의 제품 정의·사용자 가치를 기재 (CLAUDE.md 의 `spec/<영역>/_product-overview.md` 패턴)
  2. `0-common.md` 본문 서두에 `## Overview (제품 정의)` 절을 추가하고 Carousel/Table/Chart/Form/Template 노드 전체의 사용자 가치·요구사항 요약 수록

---

### [INFO] `frontmatter.id` 가 파일 basename 과 완전 일치하지 않음

- **target 위치**: 파일 상단 frontmatter — `id: common`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id` 는 파일 basename(확장자 제외) 기반 권장". 파일명은 `0-common.md` 이므로 basename 은 `0-common`
- **상세**: 현재 `id: common` 으로 선언되어 있어 `0-` prefix 가 없음. `spec-impl-evidence.md §2.1` 이 "기반 권장 (recommended)" 이라 표현하므로 규범적 위반은 아니나, 다른 `0-` prefix 파일이 동일한 basename 없는 패턴을 쓰면 id 충돌 가능성이 생김. 실제로 `spec/4-nodes/3-ai/0-common.md` 가 `id: common` 을 사용 중이면 두 파일의 id 가 동일해 build-time 가드 오탐 야기 가능
- **제안**: `id: common` → `id: 0-common` 으로 정정하거나, 영역 prefix 를 포함한 `id: presentation-common` 을 사용. 또는 프로젝트 전체에서 0- prefix 파일의 id 처리 방식을 일관 정책으로 명문화

---

### [INFO] `status: spec-only` + `code: []` — 구현이 실질적으로 존재하는데 frontmatter 미갱신

- **target 위치**: 파일 상단 frontmatter — `status: spec-only`, `code: []`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — "`partial`: 일부 구현됨 → code ≥1 매치 의무". CHANGELOG 를 보면 §10.5 backfill 함수 (`backfillButtonUuids`, `backfillFormOptionValues`), §10.6 form inline render, §10.8 user-message 합성, §10.9 form submission sentinel 등 다수가 이미 구현된 것으로 기록 (PR #279, #285, #273~#288 등)
- **상세**: 문서 본문과 CHANGELOG 에 이미 구현 완료된 코드 경로가 다수 열거되어 있음에도 `status: spec-only` + `code: []` 는 "구현 의도만 결정, 아직 코드 없음" 을 선언하는 상태. 이는 `spec-impl-evidence.md §3` 라이프사이클 상 `partial` 또는 `implemented` 로 승격돼야 할 시점이 지난 것으로 판단됨
- **제안**: 실제 구현 코드 경로 (예: `codebase/backend/src/nodes/presentation/**`, `codebase/frontend/src/components/editor/run-results/**`) 를 `code:` 목록에 등재하고 `status` 를 `partial` 또는 `implemented` 로 승격. `pending_plans:` 는 미구현 surface 의 plan 파일 경로와 함께 기재. 단, spec-impl-evidence 의 TTL 가드 (`spec-only` 90일) 는 CHANGELOG 최종 기재일 기준 아직 미초과이므로 build fail 은 아님

---

## 요약

`spec/4-nodes/6-presentation/0-common.md` 는 Presentation 노드 공통 규약의 핵심 내용(ButtonDef, 포트 토폴로지, 블로킹 흐름, 출력 포맷, AI Tool 모드)을 상세하고 일관되게 기술하고 있으며, `spec/conventions/node-output.md` 의 5필드 Principle, interaction type 토큰, 에러 코드 케이싱 등 핵심 출력 포맷 규약과 정합한다. 그러나 문서 구조 측면에서 세 가지 WARNING 이 발견됐다: (1) 섹션 번호 순서 역전(§10 이 §9 앞에 위치), (2) `§4.6` 의 heading 레벨이 H2 로 잘못 승격되어 계층 구조 불일치, (3) CLAUDE.md/SKILL.md 가 권장하는 `## Overview` 섹션 및 `_product-overview.md` 진입 파일이 모두 부재. 추가로 INFO 수준에서 frontmatter `id` 의 basename 불일치와 `status: spec-only` 가 실제 구현 상태를 반영하지 않을 가능성이 있다. 이 발견들은 채택 시 invariant를 즉각 깨지는 CRITICAL 수준은 아니나, 문서 내비게이션·신규 기여자 이해·build-time 가드 정합성에 지속적인 마찰을 유발할 수 있다.

---

## 위험도

MEDIUM
