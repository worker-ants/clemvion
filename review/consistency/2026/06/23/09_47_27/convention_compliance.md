# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/2-navigation` 전체 + 연관 `spec/conventions/` 파일

---

## 발견사항

### [INFO] 대부분의 spec 파일에 `## Overview` 섹션 미사용 — 권장 3섹션 불완전

- **target 위치**: `spec/2-navigation/0-dashboard.md`, `1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`, `4-integration.md`, `5-knowledge-base.md`, `6-config.md`, `7-statistics.md`, `9-user-profile.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `15-system-status.md`, `16-agent-memory.md`
- **위반 규약**: `spec/conventions/` 에서 직접 정의하지 않으나, `project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` 이 `## Overview (제품 정의)` 섹션을 권장함. `CLAUDE.md §정보 저장 위치` 도 "진입 문서의 `## Overview`" 를 언급.
- **상세**: 위 파일들은 `## Overview` 가 없고 `## 1. 개요` (또는 `## 1. 화면 구조` 등)로 시작한다. `14-execution-history.md` 와 `6-config.md` 는 `## Overview` 가 있어 모범이나, 나머지는 없음. 제품 정의(사용자 가치·요구사항)와 기술 명세가 혼합되어 구분이 모호한 경우가 있음 (`15-system-status.md`, `16-agent-memory.md` 는 제목 바로 아래에 한 줄 제품 설명을 두고 바로 기술 명세로 진입).
- **제안**: 이 패턴은 오랜 기간 사용돼 왔고 `Rationale` 섹션 존재는 100% 준수 중이므로 개별 파일 수정보다는 현 상태를 INFO 수준으로 기록. 구현 착수 전 spec 읽기에 지장 없음.

---

### [INFO] `spec/2-navigation` 파일 번호 12 누락

- **target 위치**: `spec/2-navigation/` 디렉토리 (파일 목록: 0,1,2,3,4,5,6,7,8,9,10,11,13,14,15,16)
- **위반 규약**: `project-planner/SKILL.md §명명 컨벤션` — "`spec/<영역>/N-name.md` — 정렬 보장된 상세 spec"
- **상세**: 12번 파일이 없다. 폐기·삭제된 spec 의 번호 재활용 금지(append-only numbering)는 명시적으로 규약에 없으나, 번호가 연속적이지 않아 인덱스 참조 시 혼란 가능성이 있음.
- **제안**: 신규 spec 추가 시 17번부터 연속 할당하면 충분. 소급 번호 정정 불필요.

---

### [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` 에 frontmatter 없음 (의도된 패턴)

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — conventions/*.md 는 frontmatter 적용 대상이나, `spec/<영역>/_*.md` (밑줄 prefix)는 면제
- **상세**: `_overview.md` 는 밑줄 prefix 규칙에 따라 frontmatter(id/status) 의무에서 면제된다. 현재 파일에 frontmatter 가 없는 것은 **의도된 패턴**이며 규약 위반이 아님. 확인 차원에서 INFO 로 기록.
- **제안**: 변경 불필요.

---

### [INFO] `spec/2-navigation/_layout.md` 가 면제 대상임에도 frontmatter 보유

- **target 위치**: `spec/2-navigation/_layout.md` (frontmatter: `id: layout`, `status: implemented`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — `spec/<영역>/_*.md` 는 frontmatter 의무 면제 대상
- **상세**: `_layout.md` 는 면제 대상이지만 자발적으로 frontmatter 를 보유하고 있다. 이것은 초과 준수(over-compliance)이며 가드 테스트 위반이 아님. 다만 면제 대상 파일이 `spec-impl-evidence` lifecycle(backlog→implemented)로 추적될 경우 추후 관리 부담이 생길 수 있음.
- **제안**: 변경 불필요. 현 상태 유지.

---

## 요약

`spec/2-navigation` 전체 및 연관 `spec/conventions/` 파일은 정식 규약의 핵심 요건을 모두 충족한다. 모든 대상 파일(underscore prefix 면제 대상 제외)에 `id` / `status` frontmatter 가 존재하고, `status: partial` 3건(`1-workflow-list.md`, `3-schedule.md`, `9-user-profile.md`) 모두 `pending_plans:` 를 선언하고 해당 plan 파일이 실존한다. `status: backlog` 1건(`8-marketplace.md`)의 `id: marketplace` 는 `spec/0-overview.md` 본문에 참조된다. API 응답 봉투 형식(`{ data: ... }`, `{ data: [], pagination: {} }`)은 `spec/5-system/2-api-convention.md §5` 규약을 준수한다. 에러 코드 표기는 해당 파일(10-auth-flow.md)에서 `lower_snake_case` 사용 이유를 `spec/conventions/error-codes.md §3 historical-artifact 레지스트리`에 등재 사실로 명시해 규약 위반이 아님을 선언하고 있다. API 경로는 케밥 케이스를 일관 적용 중이다. 발견된 사항은 모두 INFO 수준의 구조적 제안으로, 구현 착수를 차단할 Critical/Warning 위반은 없다.

---

## 위험도

NONE

STATUS: OK
