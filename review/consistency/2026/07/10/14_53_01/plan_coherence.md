# Plan 정합성 검토 — catalog-residual-codes.md

## 발견사항

- **[WARNING]** `error-codes-catalog-sot.md` 잔여 체크박스 갱신이 target 워크플로에 반영 안 됨
  - target 위치: `plan/in-progress/catalog-residual-codes.md` — `## 워크플로 (project-planner)` 섹션 (spec 반영 + plan complete 이동 2단계뿐), `## 범위 밖` 섹션
  - 관련 plan: `plan/in-progress/error-codes-catalog-sot.md` `## 후속 (비차단, 별도 완결성 pass)` — `- [ ] NOT_A_MEMBER(403, workspace switch)·INVALID_PASSWORD(change-password) 도 §1 미등재 — 동일 완결성 pass 에서 흡수. (이번 PR 은 spec 에 이미 문서화된 8코드만 등재 — dangling SoT 방지.)`
  - 상세: target 은 정확히 이 미해결 항목(`NOT_A_MEMBER`·`INVALID_PASSWORD`, 여기에 `PASSWORD_REQUIRED` 를 추가)을 완결하는 작업이지만, target 문서 어디에도 `error-codes-catalog-sot.md` 를 참조하거나 그 체크박스를 갱신하겠다는 단계가 없다(grep 결과 "error-codes-catalog-sot" 문자열 자체가 target 에 없음). 반면 target 이 스택 기반으로 삼는 선행 plan `auth-reauth-spec-accuracy.md`(#887, 이미 `plan/complete/`로 이동·origin/main 스쿼시 커밋 `318642003` 확인)는 동일한 `error-codes-catalog-sot.md` 의 다른 잔여 체크박스(재인증 세부 코드)를 완결하면서 `## 변경 3 — plan/in-progress/error-codes-catalog-sot.md 후속 체크박스 갱신 (plan_coherence WARNING)` 을 정식 워크플로 단계로 명시했다 — 즉 이 프로젝트에는 이미 "다른 plan 의 잔여 체크박스를 닫는 것도 자신의 변경 목록에 포함시킨다" 는 선례가 있다. `plan-lifecycle.md` §1 은 "미완 항목이 단 하나라도 남으면 [complete 로] 옮기지 않는다" 고 명시하므로, target 이 이 단계를 누락하면 `error-codes-catalog-sot.md` 는 실질적으로 모든 항목이 해소됐음에도 `plan/in-progress/` 에 영구 잔류하게 되어, 이후 spec-coverage/consistency 감사가 동일 갭을 다시 "미해소"로 재보고할 위험이 있다.
  - 제안: target 의 "변경" 목록에 `error-codes-catalog-sot.md` 의 해당 줄을 `[x]` 로 갱신하는 단계(선례의 "변경 3" 패턴)를 추가하고, 그 결과 해당 plan 의 모든 항목이 완료되면 `plan/complete/` 로 이동하는 단계도 target 워크플로에 명시한다.

- **[WARNING]** "#887 머지 후 rebase" 전제가 이미 충족됐으나 target 이 반영하지 않음(stale base 위험)
  - target 위치: `plan/in-progress/catalog-residual-codes.md` `## 범위 밖` — "스택 의존: #887 머지 후 이 브랜치를 origin/main 에 rebase."
  - 관련 plan: `plan/complete/auth-reauth-spec-accuracy.md` (worktree `auth-reauth-spec-accuracy-0daae3`, PR #887)
  - 상세: `git fetch origin main` 으로 확인한 결과 PR #887 은 이미 origin/main 에 스쿼시 커밋(`318642003 docs(spec): auth §2.3 재인증 흐름 정합화 + 카탈로그 세부 코드 등재 (drift 정정, #878 후속 B·C) (#887)`)으로 머지돼 있다. 그러나 `catalog-residual-codes-9f2a1c` 워크트리는 여전히 머지 전 개별 커밋(`abf313731`/`0232d5e5b`/`1e6e9451a`/`afc016507`) 위에서 분기된 상태이고, origin/main 은 그 이후로도 `#888`~`#892` 5개 PR 이 추가로 머지되어 더 앞서 있다(로컬 `main` ref 자체도 `#877` 까지만 반영돼 stale — `ensure-worktree.sh` 생성 시점 이후 로컬 main 이 갱신되지 않은 전형적 패턴). target 의 워크플로는 "spec 반영" 을 곧바로 진행하도록 돼 있어, 이 상태로 진행 후 PR 을 내면 이미 머지된 #887 변경분을 stale base 기준으로 재작성해 silent revert 할 위험이 있다(과거 유사 사례 존재).
  - 제안: target 워크플로의 첫 단계로 `git fetch origin main && git rebase origin/main` 수행을 명시적으로 추가하고, rebase 후 target 이 참조하는 라인/앵커(§2.3.C, §5, §1.2.1 등)를 재확인하는 단계를 넣는다. "범위 밖" 에 수동적으로만 적어두면 실행 시 누락되기 쉽다.

## 요약

Target(`catalog-residual-codes.md`)이 내리는 결정(코드값·status·SoT 배치·3중 근접명명 disambiguation) 자체는 선행 plan `error-codes-catalog-sot.md`·`auth-reauth-spec-accuracy.md`(완료)가 이미 확립한 ground truth 와 완전히 정합하며, 미해결 결정을 우회하거나 충돌하는 새 결정을 내리는 지점은 없다(CRITICAL 없음). 다만 target 은 `error-codes-catalog-sot.md` 가 명시적으로 남겨둔 잔여 체크박스(`NOT_A_MEMBER`·`INVALID_PASSWORD`)를 정확히 완결하는 작업임에도 그 plan 을 전혀 참조·갱신하지 않아 완료 후에도 해당 plan 이 in-progress 에 stale 잔류할 소지가 있고(WARNING), 스택 전제였던 #887 머지가 이미 실제로 완료됐음에도 target 문서가 이를 능동적 첫 단계로 반영하지 않아 stale-base 로 진행할 위험이 있다(WARNING). 두 항목 모두 target 문서에 몇 줄 추가로 해소 가능한 수준이다.

## 위험도
MEDIUM
