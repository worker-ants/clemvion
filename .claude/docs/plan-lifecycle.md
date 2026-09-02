# PLAN 문서 라이프사이클 (상세)

> CLAUDE.md 본문에는 "`plan/in-progress/` ↔ `plan/complete/`" 한 줄 요약만. 본 문서는 라이프사이클·이동 규칙·frontmatter 스키마·자가 점검의 SSOT.

## 1. 폴더 구조

`plan/` 하위는 다음 세 폴더 중 하나에 위치한다. 최상위(`plan/*.md`)에는 plan 문서를 두지 않는다.

- **`plan/in-progress/`** — 처리할 항목이 하나라도 남아있는 plan. 새 plan 은 항상 여기에서 생성. 하위 그룹핑(예: `stages/`) 무방.
- **`plan/complete/`** — 모든 작업·체크리스트·후속 항목까지 끝난 plan. 미완 항목이 단 하나라도 남으면 옮기지 않는다.
- **`plan/research/`** — **작업 plan 이 아닌 리서치·분석 산출물** (경쟁 분석, 기술 조사, 시장 조사 등). §2 참조.
- **`plan/complete/archive/from-*/`** — 옛 `memory/`·`user_memo/` 의 1회성·역사 문서 보관. 신규 생성 금지.

## 2. 분류 기준

먼저 **작업 plan 인가 리서치 산출물인가**를 가른다.

- **작업 plan** — "무엇을 만들/고칠 것인가" 의 실행 체크리스트. `in-progress/` ↔ `complete/` 라이프사이클을 탄다.
  - 미체크 체크박스(`[ ]`), "TODO", "남은 작업", "다음 단계", "결정 필요", 미해결 follow-up 항목이 **하나라도** 있으면 `in-progress/`.
  - 전부 끝나면 `complete/` (§3 이동 규칙).
- **리서치 산출물** (`plan/research/`) — "현황이 어떤가 / 무엇을 알아냈나" 의 분석·조사 문서. 실행이 아니라 **참조**되기 위해 존재하므로 완료라는 종착점이 없다. 판별 신호:
  - 문서가 스스로 성격을 "리서치/분석/조사 산출물" 로 규정한다.
  - 체크리스트가 있어도 그것은 실행 작업이 아니라 **다른 plan 으로의 위임 인덱스**다.
  - `owner` 가 실행 역할(developer/planner)이 아니라 전략 주체인 경우가 많다.

> **왜 `research/` 를 나누나**: 리서치 문서는 `in-progress/` 정의("처리할 항목이 남은 진행 중 작업")에 맞지 않으면서도 `complete/`("모든 항목 종료")에도 못 간다 — 위임 인덱스에 미착지 항목이 남아있기 때문. 그 결과 `in-progress/` 에 영구 정체하며 **실제 진행 중 작업 목록을 오염**시키고 `plan-stale-audit.sh` 의 30일 stale 신호를 상시 발화시킨다. 세 번째 자리를 주어 라이프사이클 축과 분리한다.
>
> **research 문서가 낳은 실행 항목**은 `research/` 에 남기지 않고 별 plan 으로 분기해 `in-progress/` 로 보낸다 — research 문서는 그 분기를 가리키는 인덱스 역할만 한다.

### 2.1 `plan/research/` 규약

- **frontmatter**: `worktree`/`started`/`owner` 3필드 스키마는 동일하게 쓴다(§4). 다만 build guard `plan-frontmatter.test.ts` 의 강제 범위는 `plan/in-progress/*.md` 이므로 `research/` 는 **가드 대상 아님** — 규약상 권장이되 빌드가 막지 않는다. 미착수 리서치는 `worktree: (unstarted)`.
- **Gate C(`spec_impact`)**: 대상 아님 — `spec-plan-completion.test.ts` 는 `plan/complete/` 만 본다.
- **`plan-frontmatter.test.ts`**: 3-필드 스키마 검사는 top-level `plan/in-progress/*.md` 한정이나, §4 가 추가한 두 검사는 스코프가 다르다 — `status` 종료값은 `plan/complete/**`, 상대링크는 top-level `in-progress`.
- **stale audit**: `plan-stale-audit.sh` 의 30일 신호 대상이 아니다(완료를 향해 가는 문서가 아니므로).
- **`research/` → `complete/` 이동은 하지 않는다**. 리서치가 낡으면 문서 안에 갱신 노트를 달거나(권장), 완전히 무효가 되면 삭제한다.

## 3. 이동 규칙

- **이동 방식**: 프로젝트가 [`PROJECT.md`](../../PROJECT.md) 에서 지정한 이동 방식을 따른다. 미명시 시 `git mv` 로 history 보존 (단순 복사·삭제 아님).
- **이동 시점**: 작업 단계가 끝날 때마다 plan 갱신, 모든 항목이 완료된 순간 `complete/` 로 이동.
- **이동은 마지막 작업 PR 안에서**: 모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에 `chore(plan): mark <name> complete` 형태의 별 commit 으로. **plan 이동만 담은 별 PR 분리 금지** (PR 증식 + 이동 누락 패턴 차단).
- **revert 패턴**: review 중 follow-up 으로 빠지면 `[ ]` 복원 + 이동(PROJECT.md 지정 방식, 미명시 시 `git mv`)도 `in-progress/` 로 revert.
- **인입 참조**: `review/**` 같은 시점 기록 문서는 옛 경로 유지. `spec/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신.
- **이동하는 문서 *자신의* outgoing 링크도 재계산**: 위 항목은 *인입* 참조만 말한다. `in-progress/` 에서 형제를 `./name.md` 로 가리키던 링크는 `complete/` 로 옮기는 순간 **반대 방향으로 깨진다** — 그 형제는 아직 `in-progress/` 에 있기 때문이다(`../in-progress/name.md` 로 정정). 자기 디렉터리를 되짚는 `../complete/` 도 이동 후엔 `./` 로 정리한다.
  > **가드가 안 잡는다**: `findBrokenPlanLinks` 는 `plan/complete/**` 를 **의도적으로 제외**한다 — 거기 시점 기록의 깨진 링크는 정상 상태라 넓히면 대량 실패가 된다(그 함수 JSDoc 에 근거). 그 면제는 *원래 거기 있던* 문서를 위한 것이지, **지금 옮기는** 문서의 새 오류까지 덮으라는 뜻이 아니다. 실제로 2026-09-01 `#1261` 이 그 자리를 밟았고 docs 가드는 초록이었다.
- **흡수 시 삭제 (좁은 예외)**: 아직 착수되지 않은(`worktree` 가 `(unstarted)` 이거나 아예 없는) in-progress plan 이 다른 plan 이나 코드에 **완전히 흡수돼 남은 항목이 0** 이 되면, `complete/` 이동 대신 삭제할 수 있다. 조건 넷을 **모두** 만족해야 한다 — (a) 미착수 (b) 항목이 전부 다른 곳에서 실제로 해소됨(코드/문서로 지목 가능해야 한다) (c) 살아있는 문서에 인입 참조 0건 (d) **삭제 커밋 메시지에 흡수처와 사유를 남긴다**.
  > **왜 좁게 쓰는가**: 이 예외가 넓어지면 "완료 이동 의식(`spec_impact` 선언 · Gate C)을 건너뛰려는 삭제" 가 같은 문장으로 정당화된다. 조건 (b)(d)가 그 경계다 — 흡수처를 지목하지 못하면 삭제가 아니라 이동이다. 선례: `1493b5ae9`(중복 흡수), `bc10e215e`(같은 PR 안에서 항목 전부 해소).

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

- **`worktree` sentinel**: 아직 worktree 가 없는 미착수 plan 은 placeholder(`TBD`·`(assigned at impl-start)` 등) 대신 명시 sentinel `(unstarted)` 를 쓴다. placeholder 는 `plan-stale-audit.sh` 에는 죽은 worktree 로 보이고 §3 연결 판정에서는 **어떤 worktree 와도 매칭되지 않아** plan 이 게이트에서 사라지므로 guard 가 거부한다(공백만 있는 값도 같은 이유로 거부). 착수 시 실제 `<task>-<slug>` 로 교체.
  > 종전 이 자리는 `plan_coherence` 충돌 검출 오염을 근거로 들었는데, 그 기능은 아래 §소비처 각주대로 제거됐다. 근거를 현재 소비처로 교체한다.
- **`spec_impact` (완료 시점 필드, Gate C)**: 완료(`complete/` 이동) plan 은 frontmatter 에 `spec_impact` 를 선언한다 — spec path 목록 또는 `none`. 스키마·강제 규칙은 [§5 Gate C](#gate-c--완료-plan-의-spec-정합-결정-spec_impact). in-progress 단계에선 의무 아님(완료 시점에만 `spec-plan-completion.test.ts` 가 강제).
- **`pending_plans` (선택, plan 레벨 — spec 레벨과 의미가 다르다)**: 이 plan 이 착수·완료하기 위해
  **먼저 닫혀야 하는 선행/의존 plan** 의 경로 목록. 아래 표가 두 용법의 차이다.

| 선언 위치 | 의미 | 방향 | SoT | build guard |
|---|---|---|---|---|
| `spec/**` frontmatter | 이 spec 의 **미구현 surface 를 책임지는** plan (`status: partial` 시 의무) | spec → plan | [`spec/conventions/spec-impl-evidence.md §2.1`](../../spec/conventions/spec-impl-evidence.md) | `spec-pending-plan-existence.test.ts` · `spec-status-lifecycle.test.ts` |
| `plan/**` frontmatter | 이 plan 의 **선행/의존** plan (먼저 닫혀야 하는 것) | plan → plan | 본 문서 §4 | **없음** — 선언적 cross-link 전용 |

  실측(2026-08-16 스냅샷): spec 레벨 **17건** · plan 레벨 **4건**. 같은 키가 두 의미로 쓰이는 것을 금지하지는
  않되(이미 관행이 됐다), **어느 의미인지는 선언 위치가 정한다** — 읽는 쪽이 파일 위치를 보고
  판정하면 되므로 키를 나누지 않는다.

  > **재현 방법을 함께 적는다 — 수치만 적으면 세는 방법이 갈린다.** 위 값은 각 파일의
  > **frontmatter 블록만 파싱**해 `pending_plans:` 키를 센 것이다. `grep -rl '^pending_plans:'`
  > 로 세면 **본문 코드블록 안의 예시까지 잡혀 과다 계상**된다 — 실제로
  > `spec/conventions/spec-impl-evidence.md`(스키마 예시 2곳)와
  > `plan/complete/spec-draft-web-chat-console.md:158`(제안된 spec 의 frontmatter 를 보여주는
  > 펜스 블록)이 그 방식에서 오탐으로 잡힌다.
  >
  > 이 수치는 처음에 3 이라 적었다가 4 로 정정했다 — 같은 PR 의 **뒷 커밋**이 plan 레벨
  > `pending_plans` 문서를 하나 더 만들었기 때문이다. **PR 안의 정량 기록은 "PR 이 닫히는
  > 시점" 기준으로 재야 한다.** 그리고 위 스냅샷은 병행 작업으로도 늘어나므로 **시간이 지나면
  > 어긋나는 것이 정상**이다 — 요점은 정확한 건수가 아니라 *"두 레벨이 모두 실재한다"* 이니,
  > 다시 셀 때는 반드시 위 파싱 기준으로 재라.

  > **plan 레벨에는 가드가 없다** — 경로 오기·이동 후 stale 경로가 빌드에서 검출되지 않는다.
  > `user_guide:`(§2.1) 와 같은 성격이다. 가드를 붙이지 않는 이유는 plan 레벨 값이 "완료
  > 판정" 에 쓰이지 않기 때문이다 — spec 레벨은 `partial → implemented` 승격을 **강제**하지만,
  > plan 레벨은 사람이 읽는 순서 힌트다. 그래도 §3 "인입 참조" 규칙은 그대로 적용된다:
  > 가리키던 plan 을 `complete/` 로 옮기면 이 값도 같은 commit 에서 갱신한다.

`complete/` 로 옮긴 후에도 frontmatter 유지 (history 보존).

- **`status` 를 선언했다면 이동 시 함께 갱신한다.** `plan/complete/**` 에서 허용되는 값은
  종료 상태뿐이다 — `complete` · `implemented` · `applied` · `superseded`. 선언 자체가 없는
  것은 정상이다(선택 필드). build guard `plan-frontmatter.test.ts` 가 강제하며, 새 종료 어휘가
  필요하면 `plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES` 에 등재한다.
  > 2026-08-09 신설. 이 저장소가 **두 번** 놓친 실패다(`#1108`·`#1117`) — 그때까지 이 필드는
  > 어떤 게이트도 보지 않고 사람의 규율에만 기대고 있었다(문서 가드 18파일 / 2821 tests 를
  > 뮤테이션으로 돌려 확인).
- **살아있는 plan 의 상대링크는 깨지면 안 된다.** top-level `plan/in-progress/*.md` 의
  마크다운 상대링크가 실재 파일을 가리키는지 같은 guard 가 검사한다. 이동 시 형제 plan 을
  가리키던 링크는 `../complete/<name>` 으로 정정한다.
  > `plan/complete/**` 는 **대상이 아니다** — §3 "인입 참조" 가 시점 기록 문서의 옛 경로
  > 유지를 규정하고, 실측상 그쪽 깨진 링크 135건이 대부분 그 성격이다.

용도:
- 동시 작업 추적 (plan ↔ worktree 귀속. `plan-stale-audit.sh` 가 plan 의 worktree 존재 여부 확인에 사용)

> 참고: 과거 `plan_coherence` checker 가 이 필드로 "다른 worktree 와의 동시 작업 충돌" 을 검출했으나, 병렬 작업이 다른 머신/세션에 있으면 로컬 미반영이라 신뢰할 수 없고 토큰만 소모해 제거됨. 동시 작업 직렬화는 사용자/`/merge-coordinate` 의 책임.

## 5. 이동 commit 자가 점검

commit 전 확인:

- [ ] 본 PR 의 변경으로 plan 의 모든 체크박스가 `[x]` 인가
- [ ] 미해결 follow-up·"TODO"·"결정 필요" 항목이 0건인가
- [ ] PROJECT.md 지정 방식(미명시 시 `git mv`)으로 옮겼는가 (단순 복사·삭제 아님)
- [ ] frontmatter 에 `spec_impact` 가 선언됐는가 (**Gate C** — 아래)
- [ ] `status` 를 **선언했다면** 종료 상태로 갱신했는가 (§4 — `complete`/`implemented`/
      `applied`/`superseded`). 선언 자체가 없으면 해당 없음
- [ ] 형제 plan 을 가리키던 상대링크를 `../complete/<name>` 으로 정정했는가 (§4).
      **인입 링크**(다른 살아있는 plan → 이 plan)도 함께 본다
- [ ] commit 메시지가 `chore(plan): mark <name> complete` 형식인가

> 위 두 항목(§4 신설분)은 `plan-frontmatter.test.ts` 가 사후에도 잡는다. 그래도 여기 적는
> 이유는 **체크리스트만 보고 이동하는 사람**이 실패를 겪고 나서야 아는 것을 피하기
> 위해서다 — 두 항목 다 이 저장소가 실제로 놓쳤던 것이다(ai-review WARNING).

한 항목이라도 `[ ]` 이면 이동 skip — 이번 PR 은 plan 의 일부만 처리한 것이고 plan 은 `in-progress/` 에 남는다.

### Gate C — 완료 plan 의 spec 정합 결정 (`spec_impact`)

완료 시 spec↔코드 정합 결정을 암묵에 두지 않고 frontmatter 에 명시한다:

```markdown
spec_impact: none                       # spec 변경 불요 (의식적 no-op)
spec_impact:                            # 또는: 본 작업이 건드린 spec 파일들
  - spec/5-system/4-execution-engine.md
```

**흔한 실패형 (build fail — 주의)**: 판정은 `hasValidSpecImpact` 이다 (`plan-scan.ts` — 게이트 자체는 `spec-plan-completion.test.ts`) — **문자열이면 `none`/`없음`/`n/a`/`na` 어휘만**, 배열이면 비어있지 않고 **모든 원소가 `spec/` 하위의 실존 파일**이어야 한다.
  > 2026-08-11 에 판정 함수들이 테스트 파일에서 `plan-scan.ts` 로 옮겨졌다 — 다른 스크립트가 같은 판정을 쓰려면 `.test.ts` 를 import 해야 했기 때문이다. **게이트(`describe`)와 SoT 표가 가리키는 대상은 그대로** `spec-plan-completion.test.ts` 다.
  > 2026-08-10 이전 서술은 `ok = (string && 비어있지 않음) || (배열 && length>0)` 이었는데, 그건 문서가 아니라 **당시 실제 동작**이었다 — `spec_impact: maybe` 도, `[123]` 도, `["CLAUDE.md"]` 도 통과했다. 게이트를 계약에 맞춰 조이면서 이 서술도 함께 정정한다.
- **단일 경로를 bare string 으로** (`spec_impact: spec/5-system/4-...md`) → "string spec_impact must be none/없음" 으로 fail. 단일 경로라도 **반드시 리스트(`- path`)** 로 쓴다.
- **빈 배열 `spec_impact: []`** (behavior-preserving 리팩터에 무심코) → `length>0` 위반으로 "미선언" 처리돼 fail. spec 무변경이면 `[]` 가 아니라 **`none` 리터럴**.
- spec-only PR 은 TEST WORKFLOW(unit)를 안 돌려 이 회귀가 그 PR 에서 안 잡히고 main 에 샌다 — `complete/` 이동 직후 최소 `pnpm --filter frontend test -- spec-plan-completion` 로 Gate C 만이라도 확인.

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
