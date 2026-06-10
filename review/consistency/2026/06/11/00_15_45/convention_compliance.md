# 정식 규약 준수 검토 결과

**검토 대상**: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
**검토 일시**: 2026-06-11
**적용 규약**: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/error-codes.md`, `spec/conventions/swagger.md`, CLAUDE.md, `.claude/skills/project-planner/SKILL.md`

---

## 발견사항

### [WARNING] `spec/2-navigation/14-execution-history.md` — 문서 구조 중복 (Overview 내부 번호체계 vs 본문 번호체계 충돌)
- **target 위치**: `spec/2-navigation/14-execution-history.md` 라인 18~91 (`## Overview (제품 정의)`) 및 라인 92 (`## 1. 개요`)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — 3섹션 구조는 "Overview / 본문 / Rationale" 이며, Overview 안에 `### 1. 개요` · `### 2. 페이지 구조` · `### 3. 요구사항` 로 하위 번호를 열고, 본문부에서 다시 `## 1. 개요` · `## 2. 실행 내역 목록 페이지` … 를 시작해 **섹션 번호 1이 두 번 등장**한다.
- **상세**: `## Overview (제품 정의)` 안에 `### 1~3` 요구사항 블록이 있고, 이어서 본문이 `## 1. 개요`부터 다시 시작하므로 같은 파일 안에 "1번 섹션"이 두 개 존재한다. 이는 내비게이션·앵커 링크 충돌 위험을 낳으며 3섹션 권장 구조와 어긋난다 — Overview 가 제품 정의(요구사항)를 담고 이후 본문이 기술 명세를 담는 패턴은 올바르나, Overview 내부 번호가 본문 번호와 겹치는 구조가 문제다.
- **제안**: Overview 내부 소절을 `### 개요` · `### 페이지 구조` · `### 요구사항` (번호 없이) 혹은 `### O-1` 등 별도 prefix 로 구분하거나, Overview 블록 전체를 `_product-overview.md` 로 분리하는 방식을 고려한다. 본문의 `## 1. 개요`는 그대로 유지.

---

### [WARNING] `spec/2-navigation/14-execution-history.md` — `## Rationale` 섹션 누락
- **target 위치**: `spec/2-navigation/14-execution-history.md` 말미 (라인 500 이후 없음)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — "Overview / 본문 / Rationale" 3섹션 권장. 동일 영역 다른 파일(예: `0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md`)은 모두 `## Rationale` 를 보유.
- **상세**: 파일 끝이 `## 7. 라우팅` 코드블록으로 마무리되며 Rationale 절이 없다. Re-run 체인, LLM Usage 탭 평탄화(`3.4.2` 기술), 중복 섹션 번호 구조 등 결정 근거가 본문에 인라인으로 일부 설명되어 있지만 별도 Rationale 절로 정리되지 않았다. (비교: 동일 영역에서 `7-statistics.md`·`8-marketplace.md` 도 Rationale 누락이나, 이번 diff scope 에 포함된 파일은 `14-execution-history.md`가 핵심)
- **제안**: `## Rationale` 섹션을 파일 말미에 추가하고, Re-run chain 표시 결정·LLM Usage 탭 구조 평탄화·`## Overview (제품 정의)` 를 두게 된 배경 등 주요 설계 근거를 옮겨 기록한다.

---

### [WARNING] `spec/2-navigation/16-agent-memory.md` — `id` 가 파일 basename 과 불일치
- **target 위치**: `spec/2-navigation/16-agent-memory.md` 라인 2 (`id: nav-agent-memory`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id`: string (kebab-case). 파일 basename(확장자 제외) **기반 권장**"
- **상세**: 파일명은 `16-agent-memory` 이나 frontmatter `id` 는 `nav-agent-memory` 로 다르다. 동일 영역의 다른 spec 파일은 모두 basename 기반 id를 사용(`0-dashboard` → `id: dashboard`, `15-system-status` → `id: system-status` 등). `spec-frontmatter.test.ts` 의 id 고유성 가드가 통과하더라도, 일관성 측면에서 basename 기반 권장 규칙에서 이탈한다.
- **제안**: `id: agent-memory` 또는 `id: 16-agent-memory` (수치 prefix 포함 여부는 기존 파일 패턴과 맞추되, `dashboard`·`workflow-list` 등 전부 prefix 없이 의미명 사용 → `agent-memory` 가 자연스럽다). 규약 자체가 "권장"임을 감안하면 의도적 이탈(네임스페이스 구분 목적)이었다면 Rationale 에 근거를 남기는 것이 바람직하다.

---

### [INFO] `spec/2-navigation/7-statistics.md`, `spec/2-navigation/8-marketplace.md` — `## Rationale` 섹션 누락
- **target 위치**: 두 파일의 말미
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)`
- **상세**: 이번 diff scope(`spec/2-navigation/`)에 속하지만 이번 구현의 직접 대상이 아닌 파일들로, 기존부터 Rationale 절이 없다. 이번 검토 scope 내 파일이므로 기록한다.
- **제안**: 향후 해당 파일을 수정할 때 Rationale 섹션을 추가한다. 즉각 차단 사항은 아님.

---

### [INFO] `spec/2-navigation/13-user-guide.md` — 문서가 `## Overview (제품 정의)` 섹션 없이 `## 1. 목적`으로 시작
- **target 위치**: `spec/2-navigation/13-user-guide.md` 라인 23
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview 섹션 권장
- **상세**: 영역 내 대부분 파일이 `## 1.` 으로 바로 시작(Overview 섹션 없음)하는 것이 현황이므로, `13-user-guide.md` 단독 문제라기보다 영역 전반 패턴이다. 이번 diff scope 파일로서 언급하나 이번 PR 구현과 직접 관련 없다. 영역 전체에서 Overview 는 `_product-overview.md` 로 위임하는 패턴을 이미 사용하고 있으므로, 개별 파일에 Overview 절이 없는 것이 의도적일 수 있다.
- **제안**: 의도적 패턴이라면 규약에 "다중 spec 영역의 Overview 는 `_product-overview.md` 가 대체한다"는 명시를 추가하여 3섹션 권장과의 관계를 문서화한다.

---

## 요약

`spec/2-navigation/` 전체적으로 frontmatter 스키마(`id`/`status`/`code`) 준수 및 파일 명명(`_product-overview.md`, `_layout.md`, 번호 prefix) 측면에서는 규약을 잘 따른다. `spec-impl-evidence.md` 요구 가드(`status:partial`의 `pending_plans:`, `code:` glob 존재 등)도 확인된 파일에서 준수된다.

다만 `14-execution-history.md`에서 두 가지 구조적 문제가 확인된다: (1) `## Overview (제품 정의)` 하위 번호(`### 1~3`)와 본문 번호(`## 1~7`)가 중복되어 3섹션 구조를 모호하게 만드는 점, (2) `## Rationale` 섹션이 없어 설계 근거가 본문 인라인에만 분산된 점. 또한 `16-agent-memory.md`의 `id` 값이 basename 기반 권장에서 이탈한다. 이상 두 WARNING 사항은 채택 시 링크/앵커·관리 일관성에 영향을 줄 수 있으나 즉각적인 invariant 파괴는 아니다.

---

## 위험도

LOW
