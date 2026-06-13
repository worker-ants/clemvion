# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`
**Mode**: spec draft 검토 (--spec)
**Date**: 2026-06-13

---

## 발견사항

### [CRITICAL] Plan 파일 frontmatter 전체 누락
- **target 위치**: 파일 첫 줄 — YAML frontmatter 블록 없음
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `plan/in-progress/<name>.md` 상단에 `worktree`·`started`·`owner` 세 필드가 **필수**이며 build guard `plan-frontmatter.test.ts` 가 강제
- **상세**: 파일이 `# Spec draft — …` 제목으로 시작하며 `---`/YAML 블록이 전혀 없다. 동일 경로의 다른 spec-draft 파일(예: `spec-draft-cch-nf-03-rate-limit.md`)은 모두 `worktree`/`started`/`owner` frontmatter를 보유한다. 이 상태는 `plan-frontmatter.test.ts` build guard 에 걸려 CI 차단을 유발한다.
- **제안**: 파일 상단에 다음을 추가한다.
  ```yaml
  ---
  worktree: audit-user-actions-5a037b
  started: 2026-06-13
  owner: planner
  ---
  ```
  착수 전이었다면 `worktree: (unstarted)` sentinel을 사용한다.

---

### [WARNING] spec/data-flow/1-audit.md 는 frontmatter-evidence 적용 범위 외 경로
- **target 위치**: 섹션 `## B-1` — "대상 spec: `spec/data-flow/1-audit.md`"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — frontmatter 의무 대상은 `spec/2-navigation/**`, `spec/3-workflow-editor/**`, `spec/4-nodes/**`, `spec/5-system/**`, `spec/7-channel-web-chat/**`, `spec/conventions/**` 이며 `spec/data-flow/**` 는 열거에 없음. 실제로 `spec/data-flow/1-audit.md` 에는 frontmatter(`id`/`status`/`code:`) 가 없다.
- **상세**: draft 자체가 이 파일을 수정 대상으로 지목하지만 `spec-impl-evidence.md §1` 적용 범위가 `spec/data-flow/` 를 포함하지 않는다. 이는 draft 문서가 직접 위반한 사항이 아니라, 수정 대상 spec 파일이 frontmatter-evidence 가드 적용 범위 밖임을 인지해야 한다는 점을 알린다. 만약 `spec/data-flow/1-audit.md` 가 `implemented` 또는 `partial` 인 실질 spec 이라면, `spec-impl-evidence.md §1` 의 적용 범위 열거를 `spec/data-flow/**` 로 확장해 규약과 파일 위치를 동기해야 한다.
- **제안**: (a) 이번 draft 범위에서 규약 갱신이 필요하다면 `spec/conventions/spec-impl-evidence.md §1` 에 `spec/data-flow/**` 를 추가하고 `1-audit.md` 에 frontmatter를 부여한다. (b) data-flow 폴더가 설계상 frontmatter 비대상이라면 현 상태 유지 — 단 draft 문서에 이를 명시해 두는 것이 혼동을 줄인다.

---

### [INFO] draft 문서 자체의 문서 구조 — Rationale 섹션은 있으나 Overview 섹션 없음
- **target 위치**: 파일 전체 구조
- **위반 규약**: CLAUDE.md "정보 저장 위치" 및 spec SKILL.md 권장 — Overview / 본문 / Rationale 3섹션 구성 권장
- **상세**: 본 파일은 plan draft(spec 에 반영할 변경 지시서)이므로 정식 spec 문서와 동일한 3섹션 구성이 강제되지 않는다. 단, 현재 `## Rationale (draft 자체 근거)` 는 있으나 `## Overview` 에 해당하는 섹션이 없고 목적·배경이 헤더 blockquote(`> refactor 04 후속…`)로만 표현돼 있다. plan 문서 규약상 강제 사항은 아니므로 INFO로 분류한다.
- **제안**: 파일 성격(spec 반영 지시서)상 현행 구조도 무방하나, 상단 blockquote를 `## 배경` 또는 `## 목적` 섹션으로 격상하면 가독성이 개선된다. 선택 사항.

---

### [INFO] 링크 경로 표기 — 상대 경로 사용 적합성
- **target 위치**: 섹션 `## B-1` 본문 — `[인증 spec §2.3 / Rationale 2.3.B](../5-system/1-auth.md)`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` 는 `spec/**.md` 의 in-repo 링크 타깃 존재를 강제하며, `plan/in-progress/` 파일의 링크는 이 가드 대상에서 언급되지 않음
- **상세**: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md` 파일에서 `../5-system/1-auth.md` 는 `plan/5-system/1-auth.md` 를 가리키게 되어 파일 시스템 상 잘못된 경로다(`spec/` 가 아니라 `plan/` 기준 상대경로). `spec-link-integrity.test.ts` 가 `spec/**.md` 만 검사하므로 build 차단은 발생하지 않지만, 링크 자체는 끊겨 있다.
- **제안**: plan 파일에서 spec 문서를 참조할 때는 레포 루트 기준 절대 경로(`spec/5-system/1-auth.md`) 또는 올바른 상대 경로(`../../spec/5-system/1-auth.md`)를 사용한다. 현행 `../5-system/1-auth.md` 는 plan 디렉토리 기준으로 끊긴 경로다.

---

## 요약

정식 규약 준수 관점에서 가장 심각한 문제는 `plan/in-progress/` 최상위 파일에 의무화된 frontmatter(`worktree`/`started`/`owner`)가 완전히 누락된 점이다. 이는 `plan-frontmatter.test.ts` build guard 에 직접 위반되는 CRITICAL 사항이다. 추가로 B-1 섹션의 대상 spec 파일(`spec/data-flow/1-audit.md`)이 frontmatter-evidence 적용 범위(`spec-impl-evidence.md §1`)에 열거되지 않은 폴더에 위치하는 점은 WARNING 수준의 규약 정합 검토가 필요하다. 본문 내용(세션 revoke 정책·ipAddress 동반 명세) 자체는 기존 규약(`error-codes.md`·`swagger.md`·출력 포맷 규약)과 충돌하지 않으며, Rationale 섹션이 변경 근거를 명확히 서술하고 있다.

## 위험도

**HIGH** — CRITICAL 1건(frontmatter 누락, build guard 위반) + WARNING 1건(적용 범위 외 spec 파일 경로)
