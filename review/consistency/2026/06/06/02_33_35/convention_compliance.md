# 정식 규약 준수 검토 — spec-draft-exec-park-b2-durable.md

> 검토 모드: spec draft (--spec)
> 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
> 검토 일시: 2026-06-06

---

## 발견사항

### 1. **[CRITICAL]** plan frontmatter 누락 — plan-lifecycle §4 의무 위반

- **target 위치**: `plan/in-progress/spec-draft-exec-park-b2-durable.md` 파일 최상단 (라인 1)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` + `spec/conventions/spec-impl-evidence.md §4.2 plan-frontmatter.test.ts`
- **상세**: `plan/in-progress/*.md` 는 `worktree`, `started`, `owner` 세 필드를 frontmatter 로 의무 보유해야 한다. build guard `plan-frontmatter.test.ts` 가 이를 강제(빌드 실패 차단). 대상 파일에는 YAML frontmatter(`---` 블록)가 전혀 없고 H1 제목으로 바로 시작한다. 이 파일이 현재 빌드에 포함되는 경우 CI 가 red 가 된다.
- **제안**: 파일 최상단에 아래 frontmatter 추가.
  ```yaml
  ---
  worktree: exec-park-durable-resume
  started: 2026-06-06
  owner: planner
  ---
  ```
  `worktree` 값은 현재 worktree 디렉토리명(`exec-park-durable-resume`)으로, `started` 는 작성일 ISO 날짜로 채운다.

---

### 2. **[WARNING]** 마이그레이션 번호 `V087` 단정 — 현재 max(V) 미확인 잠재 오류

- **target 위치**: `## 변경 요지 > C1` — "마이그레이션: `V087__execution_resume_call_stack.sql` (`ls migrations/V08*` 확인: 현재 최고 V086 #482 → next **V087** 확정)"
- **위반 규약**: `spec/conventions/migrations.md §5 새 마이그레이션 추가 절차` — "git fetch origin main && git rebase origin/main 후 `ls codebase/backend/migrations | tail -2` 로 현재 max V 확인" 의무
- **상세**: 현재 worktree 의 `codebase/backend/migrations/` 에서 확인한 실제 max V 는 `V086__agent_memory_scope_updated_index.sql` 이므로 next = V087 은 현재 정합하다. 그러나 spec draft 문서로서 PR 착수 시점에 다른 PR 이 V086 을 선행 머지할 경우 번호가 달라진다. migrations.md §5 는 "작성 시점 fetch+rebase 후 확인"을 규약으로 정하므로, spec draft 에 번호를 **확정형**으로 못박는 것은 §5 정신에 어긋난다.
- **제안**: spec draft 내 마이그레이션 번호 표기를 "현재 시점 V087 예정(PR 착수 직전 `ls migrations | tail -2` 재확인 필수, §5)" 형태로 조건부 표현으로 수정. 실제 파일 작성은 PR 착수 시점에 migrations.md §5 절차 후 확정.

---

### 3. **[WARNING]** 문서 구조 — spec draft 파일이 `plan/in-progress/` 에 위치하나 CLAUDE.md 의 정보 저장 위치 규약과의 정합 검토 필요

- **target 위치**: 파일 경로 `plan/in-progress/spec-draft-exec-park-b2-durable.md`
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항"은 `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`, "기술 명세"는 `spec/<영역>/*.md`, "결정의 배경·근거"는 해당 spec 문서 끝의 `## Rationale`
- **상세**: 대상 문서는 "spec 에 반영될 내용"을 기술한 **spec 변경 draft** 이고, 본문에 `## Rationale` 섹션까지 포함한다. 이 내용은 결국 `spec/5-system/4-execution-engine.md` 등에 병합될 것인데, 그 전 단계에서 `plan/in-progress/` 에 임시 보관하는 패턴은 project-planner SKILL 의 관행으로 허용 가능하다. 다만, 문서 자체가 spec 형식(Overview/본문/Rationale 3섹션 구성)을 따르고 있어 `spec/` 경로에 두는 게 더 적합해 보이는 모호함이 있다. `plan/in-progress/` 는 "진행 중 작업"이므로, "spec 으로 머지될 draft"를 임시 보관하는 용도로는 수용 범위 내이나 규약 원문이 이 패턴을 명시적으로 허용/금지하지 않는다.
- **제안**: 규약이 이 패턴을 명시적으로 다루지 않으므로, 현재 관행 자체를 규약 갱신(`plan-lifecycle.md` 또는 project-planner SKILL.md)에서 "spec draft 임시 보관 허용" 으로 명시하는 것을 검토. 지금 당장의 파일 위치는 WARNING 수준.

---

### 4. **[WARNING]** `## Rationale` 섹션 표기 — spec 문서 직접 반영용 내용임에도 "적용 시 §Rationale 에 추가" 간접 표기

- **target 위치**: `## Rationale (적용 시 §Rationale 에 추가)` 절 제목
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거"는 해당 spec 문서 끝의 `## Rationale` 에 위치. spec-impl-evidence 및 관련 SKILL 이 권장하는 spec 3섹션 구성(Overview/본문/Rationale).
- **상세**: 본 draft 의 Rationale 절은 실제 spec 문서(`4-execution-engine.md`)에 삽입될 내용이다. "적용 시" 라는 수식어가 붙은 draft 형식은 기능적으로 명확하지만, 해당 Rationale 내용이 최종적으로는 반드시 target spec 의 `## Rationale` 에 병합돼야 한다는 조건이 문서 밖에만 암묵적으로 존재한다. 규약은 Rationale 를 spec 문서 내에 두도록 정의하므로, draft 에서 Rationale 를 기술하더라도 spec 반영 시 누락 위험을 제어하는 명시적 체크리스트가 없다.
- **제안**: draft 내 적용 체크리스트(현재 C1~C5 항목) 에 "§Rationale D6 항목 삽입 확인" 항목을 추가해 누락을 명시적으로 관리.

---

### 5. **[INFO]** spec 변경 대상 파일 `1-data-model.md` — spec-impl-evidence 가드 면제 대상이나 컬럼 추가 시 frontmatter `code:` 갱신 필요 여부 확인

- **target 위치**: `C1 > data-model` 항목 — "`1-data-model.md §2.13 Execution` 컬럼 표에 `resume_call_stack jsonb NULL` 행 추가"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1 제외` — `basename 1-data-model.md` 는 `EXCLUDE_BASENAMES` 면제 대상이므로 frontmatter 의무 없음. 위반은 아님.
- **상세**: 면제 대상이라 spec-impl-evidence 가드는 적용되지 않는다. 다만 `spec/5-system/4-execution-engine.md` 의 frontmatter `code:` 가 `resume_call_stack` 관련 구현 경로를 포함하도록 갱신이 필요한지 확인이 필요하다(신규 컬럼은 마이그레이션 파일 + 실행 엔진 코드 변경을 동반하므로 `code:` glob 이 이미 커버하는지 점검).
- **제안**: PR 착수 시 `spec/5-system/4-execution-engine.md` frontmatter `code:` 의 glob 이 `codebase/backend/migrations/V087__*.sql` 을 커버하는지 확인. 커버 안 되면 갱신.

---

### 6. **[INFO]** 마이그레이션 파일명 descriptor 명명 — migrations.md §1 권장 문자집합 준수

- **target 위치**: `C1` — `V087__execution_resume_call_stack.sql`
- **위반 규약**: `spec/conventions/migrations.md §1 명명 규약` — "설명자는 `snake_case`. 권장 문자집합은 영문 소문자 + 숫자 + `_`"
- **상세**: `execution_resume_call_stack` 은 영문 소문자 + `_` 만 사용하여 권장 문자집합을 완전히 준수한다. 위반 없음, 확인 정보.
- **제안**: 해당 없음.

---

## 요약

`plan/in-progress/spec-draft-exec-park-b2-durable.md` 는 PR-B2 spec 변경 내용(멀티턴 AI turn-park, 중첩 call-stack 영속, fast-path 제거)을 명료하게 기술하고 있으며, 마이그레이션 번호·DTO 스키마·Rationale 분리 등 내용 수준의 규약 이해도는 높다. 그러나 **plan frontmatter(`worktree`/`started`/`owner`) 가 완전히 누락**되어 `plan-frontmatter.test.ts` build guard 를 위반하는 CRITICAL 결함이 존재한다. 마이그레이션 번호 V087 을 확정형으로 고정한 점은 PR race 시 번호 오류 위험이 있어 WARNING으로 분류했다. 나머지 사항은 관행·규약 경계의 모호성에 해당하는 WARNING/INFO 수준이다.

---

## 위험도

**CRITICAL** — plan frontmatter 누락으로 인한 build guard 위반이 존재하며, 이는 `plan-frontmatter.test.ts` 에 의해 빌드 실패(차단)로 이어진다.
