# PLAN 문서 라이프사이클 (상세)

> CLAUDE.md 본문에는 "`plan/in-progress/` ↔ `plan/complete/`" 한 줄 요약만. 본 문서는 라이프사이클·이동 규칙·frontmatter 스키마·자가 점검의 SSOT.

## 1. 폴더 구조

`plan/` 하위는 다음 두 폴더 중 하나에 위치한다. 최상위(`plan/*.md`)에는 plan 문서를 두지 않는다.

- **`plan/in-progress/`** — 처리할 항목이 하나라도 남아있는 plan. 새 plan 은 항상 여기에서 생성. 하위 그룹핑(예: `stages/`) 무방.
- **`plan/complete/`** — 모든 작업·체크리스트·후속 항목까지 끝난 plan. 미완 항목이 단 하나라도 남으면 옮기지 않는다.
- **`plan/complete/archive/from-*/`** — 옛 `memory/`·`user_memo/` 의 1회성·역사 문서 보관. 신규 생성 금지.

## 2. 분류 기준

미체크 체크박스(`[ ]`), "TODO", "남은 작업", "다음 단계", "결정 필요", 미해결 follow-up 항목이 **하나라도** 있으면 `in-progress/`.

## 3. 이동 규칙

- **이동 방식**: 프로젝트가 [`PROJECT.md`](../../PROJECT.md) 에서 지정한 이동 방식을 따른다. 미명시 시 `git mv` 로 history 보존 (단순 복사·삭제 아님).
- **이동 시점**: 작업 단계가 끝날 때마다 plan 갱신, 모든 항목이 완료된 순간 `complete/` 로 이동.
- **이동은 마지막 작업 PR 안에서**: 모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에 `chore(plan): mark <name> complete` 형태의 별 commit 으로. **plan 이동만 담은 별 PR 분리 금지** (PR 증식 + 이동 누락 패턴 차단).
- **revert 패턴**: review 중 follow-up 으로 빠지면 `[ ]` 복원 + 이동(PROJECT.md 지정 방식, 미명시 시 `git mv`)도 `in-progress/` 로 revert.
- **인입 참조**: `review/**` 같은 시점 기록 문서는 옛 경로 유지. `spec/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신.

### PR 전 plan 갱신·이동 강제 (push gate)

"코드를 바꿨으면 PR 전에 처리하던 plan 을 갱신하거나(진행 메모·체크박스) 완료 시 `complete/` 로 이동" 은 hook 으로 강제된다. 판정은 `.claude/hooks/_lib/plan_guard.py`, 게이트는 review gate 와 같은 지점에 얹힌다.

| 시점 | hook | 효과 |
|---|---|---|
| PreToolUse(`git push`) | `guard_review_before_push.py` (plan gate) | **차단** — branch 가 `codebase/**` 를 바꿨는데 연결된 in-progress plan 이 갱신·이동 흔적이 전혀 없으면 push 거부 |
| Stop | `guard_review_before_stop.py` (plan-complete nudge) | 연결된 plan 의 체크박스가 모두 `[x]` 인데 아직 `in-progress/` 에 있으면 "complete/ 로 이동" 1회 nudge (차단 아님) |

- **연결 판정**: in-progress plan frontmatter 의 `worktree:` 가 현재 worktree 디렉토리(또는 `claude/` 뗀 branch)와 매칭되는 plan 이 대상. 연결된 plan 이 없는 ad-hoc/hotfix 작업은 차단되지 않는다(자연스러운 escape).
- **만족 조건**: branch diff 에서 그 plan 이 **같은 경로로 수정**됐거나 **`plan/complete/` 로 이동**(같은 파일명, archive 제외)됐으면 push gate 통과. 단순 동일 파일명 매칭이 아니라 정확 경로/완료-이동만 인정하므로, plan/ 내 다른 위치의 동명 파일로는 우회되지 않는다. 이미 `complete/` 로 옮겨 in-progress 에 없는 plan 은 연결 대상에서 빠지므로 역시 통과.
- **복수 연결**: 한 worktree 에 여러 in-progress plan 이 연결돼 있으면, 그중 **하나라도** 갱신·이동되면 gate 를 통과한다(한 worktree 가 여러 plan 을 정당하게 다룰 수 있으므로). 다만 한 worktree 에 다수 plan 을 묶는 것은 data quality 상 권장하지 않는다.
- **우회**: `BYPASS_PLAN_GUARD=1` (연결 plan 오판 등 드문 경우의 의식적 단발 우회).
- **scope**: review gate 와 동일하게 `codebase/**` 변경이 있을 때만 발화. spec/plan/docs-only branch 는 대상 아님. review/plan 두 게이트는 서로 독립이라 한쪽 모듈 import 실패가 다른 쪽을 침묵시키지 않는다.

## 4. Frontmatter 스키마

`plan/in-progress/<name>.md` 상단:

```markdown
---
worktree: <task_name>-<slug>     # 이 plan 이 살아있는 worktree 디렉토리 이름
started: 2026-05-13              # ISO 날짜 (YYYY-MM-DD)
owner: <역할/이름>                 # planner / developer / 사용자 본인 등
---
```

세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수** — build guard `plan-frontmatter.test.ts` 가 강제한다. 하위 그룹 폴더의 작업 material(예: `node-output-redesign/*.md`)은 클러스터 index 아래 부속 문서이므로 면제. `priority`/`status`/`title` 등 추가 필드는 허용.

- **`worktree` sentinel**: 아직 worktree 가 없는 미착수 plan 은 placeholder(`TBD`·`(assigned at impl-start)` 등) 대신 명시 sentinel `(unstarted)` 를 쓴다. placeholder 는 죽은 worktree 처럼 보여 `plan_coherence` 충돌 검출을 오염시키므로 guard 가 거부한다. 착수 시 실제 `<task>-<slug>` 로 교체.
- **`spec_impact` (완료 시점 필드, Gate C)**: 완료(`complete/` 이동) plan 은 frontmatter 에 `spec_impact` 를 선언한다 — spec path 목록 또는 `none`. 스키마·강제 규칙은 [§5 Gate C](#gate-c--완료-plan-의-spec-정합-결정-spec_impact). in-progress 단계에선 의무 아님(완료 시점에만 `spec-plan-completion.test.ts` 가 강제).

`complete/` 로 옮긴 후에도 frontmatter 유지 (history 보존).

용도:
- 동시 작업 추적 (plan ↔ worktree 귀속. `plan-stale-audit.sh` 가 plan 의 worktree 존재 여부 확인에 사용)

> 참고: 과거 `plan_coherence` checker 가 이 필드로 "다른 worktree 와의 동시 작업 충돌" 을 검출했으나, 병렬 작업이 다른 머신/세션에 있으면 로컬 미반영이라 신뢰할 수 없고 토큰만 소모해 제거됨. 동시 작업 직렬화는 사용자/`/merge-coordinate` 의 책임.

## 5. 이동 commit 자가 점검

commit 전 확인:

- [ ] 본 PR 의 변경으로 plan 의 모든 체크박스가 `[x]` 인가
- [ ] 미해결 follow-up·"TODO"·"결정 필요" 항목이 0건인가
- [ ] PROJECT.md 지정 방식(미명시 시 `git mv`)으로 옮겼는가 (단순 복사·삭제 아님)
- [ ] frontmatter 에 `spec_impact` 가 선언됐는가 (**Gate C** — 아래)
- [ ] commit 메시지가 `chore(plan): mark <name> complete` 형식인가

한 항목이라도 `[ ]` 이면 이동 skip — 이번 PR 은 plan 의 일부만 처리한 것이고 plan 은 `in-progress/` 에 남는다.

### Gate C — 완료 plan 의 spec 정합 결정 (`spec_impact`)

완료 시 spec↔코드 정합 결정을 암묵에 두지 않고 frontmatter 에 명시한다:

```markdown
spec_impact: none                       # spec 변경 불요 (의식적 no-op)
spec_impact:                            # 또는: 본 작업이 건드린 spec 파일들
  - spec/5-system/4-execution-engine.md
```

리스트 항목은 실존 spec 파일이어야 한다(dangling 금지 — `spec-pending-plan-existence` 와 동형). build guard `spec-plan-completion.test.ts` 가 강제하되, **`started` 가 2026-06-04 이후인 plan 만** 대상(그 전 시작 plan 은 grandfather — 기존 백로그 소급 면제). SoT: [`spec/conventions/spec-impl-evidence.md`](../../spec/conventions/spec-impl-evidence.md).

## 6. Audit 도구 (운영 보조)

> 본 절은 stale plan 탐지 및 spec-impl 갭 발견을 위한 운영 도구 참조. 규약 변경 아님 — `plan/in-progress/` 폴더 자체의 라이프사이클은 §1-§5 그대로.

### 6.1 `plan-stale-audit.sh` — stale in-progress plan 검출

구현 위치: `.claude/tools/plan-stale-audit.sh` (구현은 후속 plan `plan-stale-audit.md`).

```bash
.claude/tools/plan-stale-audit.sh
```

산출 — stdout 표:
- 30일 이상 갱신 없는 `plan/in-progress/*.md` 목록
- 각 plan 의 checkbox 진행률 (예: `7/12 done`) + 마지막 commit 일자
- 어느 spec frontmatter `pending_plans:` 에 등록됐는지 cross-link ([`spec/conventions/spec-impl-evidence.md`](../../spec/conventions/spec-impl-evidence.md) §2 참조)

**fail 안 함** — 정보 출력만. 사용자가 수동 grooming (`complete/` 이동, 추가 작업 picking, 또는 `archived` 격하 결정).

### 6.2 `/spec-coverage` — spec-impl 갭 standing audit

신규 slash command (구현은 후속 plan `spec-coverage-slash-command.md`):

```bash
/spec-coverage
```

산출 위치: `review/spec-coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` ([`CLAUDE.md §정보 저장 위치`](../../CLAUDE.md) 참조).

sub-agent (`spec-impl-coverage-auditor`) 가 `spec/**` walk:
1. spec 본문 UI 키워드 (page, dialog, card, button, drawer, modal) 등장 + frontmatter `code:` 에 frontend 경로 매칭 없음 → 후보
2. spec API endpoint 명세 (`POST /api/...`) + backend controller route 매칭 없음 → 후보
3. spec e2e 약속 시나리오 + e2e spec 파일 매칭 없음 → 후보

confidence (high/medium/low) 분류한 SUMMARY.md 산출.

**CI 차단 아님** — NLP 휴리스틱 기반 false-positive 부담 > 검출 가치. 보고만 산출, 사용자가 picking 해 후속 plan 으로 이동.
