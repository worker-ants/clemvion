# 정식 규약 준수 검토 결과

- **대상 문서**: `plan/in-progress/nav-spec-doc-fix.md`
- **검토 모드**: spec draft 검토 (--spec)
- **검토 일시**: 2026-06-27

---

## 발견사항

### [INFO] 체크박스 없는 미완 작업 서술 — 자동 추적 가능성 저하
- **target 위치**: `plan/in-progress/nav-spec-doc-fix.md` > `## 대상` 섹션 항목 1·3
- **위반 규약**: `.claude/docs/plan-lifecycle.md §2` (분류 기준)
- **상세**: 항목 1(`10-auth-flow.md` §2.5/§2.6 swap)과 항목 3(`14-execution-history.md §2.1` 주석 추가)은 아직 미완료인 실제 작업이지만, `[ ]` 체크박스가 아닌 prose 서술로만 기재돼 있다. plan-lifecycle §2 의 분류 기준은 "미체크 체크박스·TODO·남은 작업 중 하나라도 있으면 `in-progress/`"이므로 체크박스가 없으면 push-gate(`plan_guard.py`)와 `plan-stale-audit.sh` 가 자동으로 완료 여부를 판단하기 어렵다. 규약이 체크박스를 강제하지는 않으나, 수동 판단에 의존하게 된다.
- **제안**: 항목 1과 항목 3 각각을 `- [ ] ...` 형식으로 전환해 자동 도구가 완료 상태를 기계적으로 판독할 수 있도록 한다. 항목 2(FALSE POSITIVE, 수정 안 함)는 완료 확인된 항목이므로 `- [x]` 로 표기하거나 별도 완료 메모로 둔다.

---

## 준수 확인 항목 (이상 없음)

| 점검 항목 | 결과 | 근거 |
|---|---|---|
| **frontmatter 필수 3필드** (`worktree`·`started`·`owner`) | 통과 | 모두 존재·형식 정합. `worktree: nav-spec-doc-fix` = 실제 디렉토리명과 일치 |
| **`started` ISO 형식** | 통과 | `2026-06-27` (YYYY-MM-DD) |
| **추가 필드** (`status`·`base`·`source`) | 통과 | plan-lifecycle §4: "추가 필드는 허용" |
| **파일 위치** | 통과 | `plan/in-progress/nav-spec-doc-fix.md` — 미완 plan 의 정상 위치 |
| **`spec_impact` 부재** | 통과 | in-progress 단계에서는 의무 없음 (Gate C: 완료 시점만 강제) |
| **`worktree` sentinel 오용** | 해당 없음 | 실제 착수 worktree 이므로 `(unstarted)` sentinel 불필요 |
| **3섹션 구조 (Overview/본문/Rationale)** | 해당 없음 | 이 규약은 spec 문서 대상. plan 문서에는 미적용 |
| **`별도 발견` swagger 버그 처리** | 정상 | "→ 별 트랙" 으로 deferred — 현 plan 범위 밖임을 명시 |
| **owner 권한** | 통과 | `owner: project-planner` — CLAUDE.md Skill 표 상 `spec/**` 쓰기 권한 보유 |
| **consistency-check --spec 의무 언급** | 통과 | `## 제약·프로세스` 에 "spec 쓰기 직전 consistency-check --spec 의무" 자가 선언 |

---

## 요약

`plan/in-progress/nav-spec-doc-fix.md` 는 plan-lifecycle.md §4 의 필수 frontmatter 3필드(worktree·started·owner)를 모두 정확히 포함하고, 파일 위치·이름·추가 필드 모두 규약에 부합한다. spec 문서 3섹션 구조나 spec frontmatter(`id`/`status`)는 plan 문서에 적용되지 않으며, Gate C(`spec_impact`)도 in-progress 단계에서는 의무가 없다. 유일한 개선 여지는 미완 작업 2건을 prose 가 아닌 체크박스 형식으로 전환해 자동 추적 가능성을 높이는 것으로, 이는 하드 규약 위반이 아닌 INFO 수준이다.

## 위험도

LOW
