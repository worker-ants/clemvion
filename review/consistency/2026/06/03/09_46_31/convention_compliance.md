# 정식 규약 준수 검토 — spec-draft-channel-web-chat-gaps.md

검토 대상: `plan/in-progress/spec-draft-channel-web-chat-gaps.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-03

---

## 발견사항

### [WARNING] spec-impl-evidence.md §1 적용 대상 확장 제안이 규약 갱신을 수반하나, plan 문서가 규약 파일 변경 방법을 정확히 기술하지 않음

- target 위치: `## 섹션 2 — W3` ("§1 적용 대상(inclusive) 목록에 `- spec/7-channel-web-chat/**.md` 추가")
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — 현재 적용 대상 목록은 `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/conventions/` 5개 prefix 로 구성되어 있음. `spec/7-channel-web-chat/` 는 여기에 없음.
- 상세: W3 는 spec-impl-evidence.md §1 의 inclusive list 에 `spec/7-channel-web-chat/**.md` 를 추가하도록 지시한다. 이는 정식 규약 문서(`spec/conventions/spec-impl-evidence.md`) 자체를 수정하는 것이다. plan 문서에서는 "동반(developer)" 으로 `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 배열 추가만 명시하고 있으나, 실제로는 **spec-impl-evidence.md §1 의 inclusive list 텍스트도 동기 갱신이 필요**하다. 현재 plan 문서는 spec-impl-evidence.md §1 변경 자체를 명시하고 있으나, 규약 문서 변경이 project-planner 의 소관임과 codebase 변경이 developer 소관임을 명확히 구분하지 않고 단일 W3 항목으로 혼재했다.
- 제안: W3 항목을 (a) project-planner 가 수행할 spec-impl-evidence.md §1 텍스트 갱신과 (b) developer 가 수행할 `spec-frontmatter-parse.ts` INCLUDE_PREFIXES 배열 추가로 명시적으로 분리하여 역할 경계를 명확히 한다.

---

### [WARNING] plan 문서 내 `## 섹션 2` / `## 섹션 4` 제목이 CLAUDE.md 권장 3섹션 구조(Overview / 본문 / Rationale)와 다름

- target 위치: `## 섹션 2 — W1~W5`, `## 섹션 4 — show/hide/updateProfile 위젯 핸들러 설계`
- 위반 규약: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장. `spec/conventions/spec-impl-evidence.md §5` 예시에서도 spec 문서 구조는 Overview / 본문 / Rationale 패턴을 따름.
- 상세: plan 문서이므로 spec 문서 구조 규약이 직접 적용되지는 않는다. 그러나 본 문서는 "spec draft" 라는 제목을 달고 spec 변경 내용을 기술하는 성격을 가지며, 섹션 번호 체계(`## 섹션 2`, `## 섹션 4`)가 외부 보고서(consistency-check 2026-06-03) 의 항목 번호를 그대로 재사용하고 있다. 이 번호는 plan 문서 자체의 구조를 나타내지 않아 독립 문서로서 가독성이 낮다. `## 영향 spec / 동반 codebase` → `## 병합 순서 주의` → `## 섹션 2` → `## 섹션 4` → `## Rationale` 순서는 Overview 섹션 없이 바로 본문으로 진입하고 있다.
- 제안: 이 문서가 plan 문서이므로 규약 위반이라기보다 스타일 불일치다. spec draft plan 성격상 `## Overview`(배경·범위) 섹션을 서두에 두거나, 서두의 blockquote 를 Overview 섹션으로 격상하는 것이 권장된다. 또는 규약 차원에서 plan 문서 구조 가이드가 없으므로 현 상태 용인 가능하며, 규약 갱신 시 plan 문서 구조 가이드를 추가하면 된다.

---

### [WARNING] W3 에서 `_product-overview.md` 를 "underscore prefix 로 §1 제외" 로 설명하나, spec-impl-evidence.md §1 의 실제 제외 근거와 표현이 다름

- target 위치: `### W3 — spec-impl-evidence.md §1 INCLUDE_PREFIXES 에 spec/7 추가` ("전제: ... `_product-overview.md` 는 underscore prefix 로 §1 제외(spec/6 단순 overview 제외 기준과 동일 계열)")
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` — 제외 항목 표현: "`spec/_*.md` 및 `spec/<영역>/_*.md` (밑줄 prefix — leaf 가 아닌 layout/index 성격)". 또한 `spec/6-brand.md` 의 제외 근거는 "단순 overview 성격"이지 "underscore prefix" 가 아님.
- 상세: plan 문서는 `_product-overview.md` 제외 근거를 "spec/6 단순 overview 제외 기준과 동일 계열"이라 설명했으나, spec/6(`6-brand.md`) 의 제외 근거는 "단순 overview 성격"이고 `_product-overview.md` 의 제외 근거는 "underscore prefix" 다. 이 두 근거는 다른 규칙이다. 근거 혼용이 규약 이해 오류로 이어질 수 있다.
- 제안: W3 설명에서 `_product-overview.md` 제외 근거를 "underscore prefix (`spec/<영역>/_*.md` 패턴, spec-impl-evidence.md §1 제외 규칙)"로만 표현하고, spec/6 제외와의 비교를 삭제하거나 "별도 근거(단순 overview)"로 정확히 구분한다.

---

### [INFO] plan 문서의 frontmatter 가 plan-lifecycle.md §4 스키마를 준수하나, `worktree` 값이 현재 워크트리와 일치하는지 확인 권장

- target 위치: 문서 상단 frontmatter (`worktree: feat-web-chat-demo`)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — frontmatter 스키마 `worktree: <task_name>-<slug>`.
- 상세: `worktree: feat-web-chat-demo`, `started: 2026-06-03`, `owner: project-planner` 모두 형식 준수. 단, 현재 작업 워크트리가 `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo` 이므로 `worktree` 값은 정확히 일치한다. INFO 수준으로만 기록.
- 제안: 이상 없음.

---

### [INFO] W4 에서 `4-security.md` 에 `## Rationale` 추가를 제안하는데, 현재 파일에 Rationale 섹션이 없음을 확인 — 규약 준수 방향으로 올바른 변경

- target 위치: `### W4 — 4-security.md ## Rationale 추가`
- 위반 규약: CLAUDE.md "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`" 규약.
- 상세: 현재 `spec/7-channel-web-chat/4-security.md` 에는 `## Rationale` 섹션이 없음을 확인했다. W4 는 이를 추가하는 것으로 규약 준수 방향으로 올바른 변경이다.
- 제안: 이상 없음. W4 진행 시 `0-architecture.md`(이미 Rationale 있음) 와 같이 문서 끝에 `## Rationale` 추가.

---

### [INFO] 문서가 자립 문서가 아님을 서두에 명시했으나, plan 문서 내 §2/§4 번호 참조가 외부 보고서 의존적이어서 단독 이해가 어려움

- target 위치: 문서 서두 blockquote ("본 draft 는 ... 자립 문서 아님 — §2/§4 번호는 그 보고서 항목 그룹을 가리킨다")
- 위반 규약: 특정 정식 규약 직접 위반 없음. CLAUDE.md 단일 진실 원칙 관련 참고 사항.
- 상세: plan 문서가 외부 보고서(`review/consistency/2026/06/03/08_56_55`) 의 §2/§4 항목 번호를 섹션 제목으로 재사용하는 점은 plan 문서 자체의 이해 가능성(standalone readability)을 낮춘다. 규약 위반은 아니나, 이 plan 문서의 수명이 보고서보다 길어질 경우 맥락을 잃을 수 있다.
- 제안: 현 상태로 진행 가능. 향후 이런 패턴이 반복되면 plan 문서 구조 가이드에 "외부 보고서 번호를 섹션명으로 직접 사용 금지, 의미 있는 제목 사용" 가이드를 추가할 수 있다.

---

## 요약

`plan/in-progress/spec-draft-channel-web-chat-gaps.md` 는 frontmatter 스키마(`worktree`/`started`/`owner`)를 준수하고, `## Rationale` 섹션이 문서 끝에 위치하며, 참조된 spec 파일 경로들이 실제로 존재한다. 주요 규약 준수 문제는 두 가지다: (1) W3 에서 spec-impl-evidence.md §1 규약 문서 갱신과 codebase 가드 파일 갱신의 역할 분리가 plan 문서에 명시되지 않아 project-planner/developer 경계가 모호하고, (2) `_product-overview.md` 와 `spec/6-brand.md` 의 제외 근거를 "동일 계열"로 혼용해 규약 §1 의 두 독립 제외 규칙을 잘못 병합하는 설명이 있다. 두 항목 모두 기능 동작에 영향을 주는 critical 오류는 아니나, 규약 이해 오류 전파를 막기 위해 수정이 권장된다.

---

## 위험도

LOW
