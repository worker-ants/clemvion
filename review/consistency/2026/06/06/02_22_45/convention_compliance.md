# 정식 규약 준수 검토 — spec-draft-exec-park-b2-durable.md

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 기준: `spec/conventions/**`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] 마이그레이션 파일명 충돌 — V086 renumber 필요
- **target 위치**: C1 섹션 — "마이그레이션: `V086__execution_resume_call_stack.sql` (가칭). **주의**: main 에 이미 `V086` … → **V087+ 로 renumber 필수**"
- **위반 규약**: `spec/conventions/migrations.md §2` (V번호 정책 — 단조 증가, 중복 금지), `§1` (명명 규약)
- **상세**: 현재 main 에 `V086__agent_memory_scope_updated_index.sql` / `.conf` 가 이미 존재한다(직접 확인). spec draft 가 이 충돌을 인식하고 "V087+ renumber 필수" 라고 명기한 것은 올바르지만, draft 본문에 "가칭 `V086__execution_resume_call_stack.sql`" 를 정식 파일명처럼 서술한 채 renumber 를 조건부 주석으로만 남겨두는 방식은 이 draft 를 기반으로 spec 을 갱신할 때 오류를 유발할 위험이 있다. `spec/conventions/migrations.md §2` 는 "신규 V번호는 항상 현재 main 의 max(V) +1" 을 요구하며, draft 에서 미확정 번호를 정식 파일명으로 제시하면 후속 작업자가 혼동할 수 있다.
- **제안**: C1 의 마이그레이션 파일명을 `V087__execution_resume_call_stack.sql`(또는 `V087+` 라고 명기)으로 확정 표기하거나, "(renumber 후 실제 번호 결정)" 임을 명시해 "가칭 V086" 표기 자체를 제거한다. migrations.md §5 의 "작성 시 절차" 항목에 따라 `git fetch origin main; ls migrations | tail -2` 로 max V 를 확인한 뒤 번호를 확정하는 것이 정식 절차다.

---

### [INFO] spec draft 파일 자체의 frontmatter 없음
- **target 위치**: 파일 최상단 — frontmatter 블록 없이 `# Spec Draft — …` 로 시작
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` (적용 대상) + CLAUDE.md "정보 저장 위치"
- **상세**: 본 파일은 `plan/in-progress/` 에 위치하므로 spec 문서가 아니라 plan 문서다. `spec/conventions/spec-impl-evidence.md §1` 의 frontmatter 의무는 `spec/**` 경로에만 적용되므로 frontmatter 부재가 직접 위반은 아니다. 단, `plan/in-progress/*.md` 는 `plan-frontmatter.test.ts`(build 차단 가드) 가 `worktree` / `started` / `owner` 필드를 의무화한다. 현재 해당 파일에는 plan frontmatter(`worktree:` 등)가 없다.
- **제안**: `plan/in-progress/exec-park-durable-resume.md` 가 이 작업의 정식 plan 파일이고 spec draft 는 그 부속이므로, 별도 plan 파일로 관리하는 현 구조는 수용 가능하다. 단, `spec-draft-exec-park-b2-durable.md` 자체도 `plan/in-progress/` 하위에 top-level `.md` 로 존재한다면 `plan-frontmatter.test.ts` 의 대상이 될 수 있으므로 frontmatter(`worktree`, `started`, `owner`) 를 추가하거나, 파일 경로를 `plan/in-progress/exec-park-durable-resume/spec-draft-b2.md` 처럼 subfolder 로 이동해 가드 제외 대상(`subfolder 클러스터`)으로 만들어야 한다.

---

### [INFO] Rationale 섹션 위치 — spec draft 구조 관점
- **target 위치**: 파일 말미 `## Rationale (적용 시 §Rationale 에 추가)` 섹션
- **위반 규약**: CLAUDE.md "정보 저장 위치 — 결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 본 파일은 spec 이 아니라 spec 변경 draft 이므로, Rationale 을 "적용 시 추가될 내용"으로 분리해 서술한 것은 초안 관리 관행으로 이해된다. spec 문서 자체에 Rationale 이 있어야 한다는 규약을 위반하지는 않는다(본 파일이 spec 이 아니므로). 규약은 준수 상태.
- **제안**: 별도 조치 불필요. 다만, 이 draft 의 내용이 실제 spec 에 반영될 때 `## Rationale` 섹션이 `spec/5-system/4-execution-engine.md` 말미에 위치해야 함을 확인한다.

---

### [INFO] 대상 spec 파일 경로 기재 형식 — 교차 참조 anchor 없음
- **target 위치**: 파일 서두 "대상 spec: `spec/5-system/4-execution-engine.md` (주), `spec/5-system/1-data-model.md §2.13 Execution` …"
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` (in-repo `[..](path)` 타깃 존재 + anchor 대조)
- **상세**: `plan/in-progress/` 문서는 `spec-link-integrity.test.ts` 의 직접 검증 대상이 아닌 것으로 보인다(대상은 `spec/**.md`). 단, plan 문서 안의 링크도 가드 대상이 될 경우 `` `spec/5-system/4-execution-engine.md` `` 를 code span 으로만 표기하고 Markdown 링크(`[…](…)`)로 표기하지 않으면 링크 무결성 가드를 통과하지 못할 수 있다. 현재는 plan 문서이므로 직접 위반은 아님.
- **제안**: 별도 조치 불필요. 단, plan 내 참조를 Markdown 링크 `[spec/5-system/4-execution-engine.md](../../spec/5-system/4-execution-engine.md)` 형식으로 통일하면 클릭 가능 참조가 되어 가독성이 향상된다.

---

## 요약

`plan/in-progress/spec-draft-exec-park-b2-durable.md` 는 spec 문서가 아닌 plan 부속 draft 로, `spec/conventions/**` 의 주요 규약(frontmatter evidence, 문서 3섹션 구성, API 문서 규약 등) 의 직접 적용 대상이 아니다. 전반적으로 규약 위반 없이 작성되어 있으며, 실질적으로 주목할 사항은 하나다 — 신규 마이그레이션 V번호로 "가칭 V086" 을 그대로 남긴 점이다. `spec/conventions/migrations.md §2` 에 의해 V086 은 이미 main 에 점유된 번호이며 V087 이상으로 renumber 해야 한다고 draft 자체도 인식하나, 파일명을 `V086__` 으로 표기한 채 주석으로만 처리해 놓아 후속 작업에서 혼동·오기를 유발할 위험이 있다. 이를 WARNING 으로 분류한다. 나머지 두 항목(plan frontmatter 부재, anchor 없는 경로 표기)은 가드 회피 방법이 있으며 실제 build 차단 위험은 낮은 INFO 수준이다.

## 위험도

LOW
