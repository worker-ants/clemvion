# Plan 정합성 검토 — target: `spec/conventions/spec-impl-evidence.md` (--spec)

## 발견사항

- **[CRITICAL]** target 초안이 문서화하려는 가드 구현이 **이 브랜치 자신에 의해 이미 되돌려졌다** — 지금 쓰면 spec-impl-evidence.md 가 스스로 막으려는 결함("spec 약속 vs 구현 부재")을 §4.2 자기 표에서 재현한다
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.2` 신규 두 행(`spec-plan-completion.test.ts` **2번째 invariant** — 완료 plan 미완 status 차단, `plan-link-integrity.test.ts` — plan 내부 링크 ratchet) + 신설 `### R-11`, 그리고 §4.2 서두 "build 차단 4건→5건" 개정
  - 관련 plan: `plan/in-progress/spec-draft-secret-store-verification-footnote.md §후속 (이 PR 밖)` 라인 120·151 — 이 target 초안이 문서화하려는 두 가드의 원 티켓("`complete/` 이동 시 `status:` 미갱신을 잡는 게이트 부재", "`plan/**` 내부 상대링크 무결성 게이트 부재")
  - 상세: 본 검토 세션 준비 직후(prompt 생성 10:36:44), **같은 브랜치의 HEAD 에** 커밋 `9f2755822`("revert: plan 라이프사이클 게이트 2종 — PR #1123 이 이미 구현했다 (중복 폐기)", 10:41:46)가 구현 커밋 `62084e807`("feat(harness): plan 라이프사이클 게이트 2종")을 통째로 되돌렸다. 되돌림 사유는 되돌림 커밋 자신이 이렇게 적는다 — "착수 전 병렬 작업 대조를 하지 않아 **내 자신의 미머지 PR #1123**(`claude/plan-lifecycle-gates`)과 통째로 중복됐다"·"#1123 은 이미 PROJECT.md·spec-impl-evidence.md §4.2·plan-lifecycle.md 세 SoT 에 전부 등록했다"·"티켓(`spec-draft-secret-store-verification-footnote`)은 #1123 이 종결한다 — 그 PR 이 해당 plan 을 `complete/` 로 옮긴다".
    실측(현재 워킹트리, 리버트 이후):
    - `git diff HEAD -- spec/conventions/spec-impl-evidence.md` → **0줄** (target 초안이 서술하는 §4.2 두 행·R-11 이 파일에 없음)
    - `find . -name plan-link-integrity.test.ts` → **없음** (가드 코드 자체가 이 브랜치에 더 이상 존재하지 않음)
    - `plan/in-progress/spec-draft-secret-store-verification-footnote.md` 라인 120·151 두 항목 모두 **체크박스 `[ ]`, "2026-08-10 구현 완료" 서술도 사라짐** — 리버트가 원 plan 의 "구현 완료" 서술까지 함께 되돌렸다.
    즉 지금 이 target 초안대로 `spec-impl-evidence.md` 를 쓰면, (a) 방금 저장소가 스스로 폐기한 구현을 다시 spec 에 약속하는 것이고, (b) 그 약속을 뒷받침할 `code:` 대상 파일이 실제로 없는 상태(§3 `spec-code-paths` 가 요구하는 "≥1 매치"조차 이 가드 파일에 대해서는 성립하지 않음)이며, (c) 서로 다른(충돌하는) 계약을 가진 두 구현(이쪽 `plan/**` 전체+56쌍 ratchet vs #1123 의 top-level `in-progress` only)이 같은 함수명·같은 SoT 자리를 두고 경합하는 상태를 그대로 반영하게 된다.
  - 제안: 이번 턴에서는 **이 target 초안대로 `spec-impl-evidence.md` 를 쓰지 말 것.** 대신 (1) `origin/main` 에 PR #1123 이 머지됐는지 확인하고, (2) 머지됐다면 그 결과(스코프: top-level `in-progress` only)와 이 브랜치가 남길 값이 있는지(예: `plan/**` 전체 스캔 + ratchet 이 #1123 스코프보다 넓은 불변식이라 별도로 유효한지)를 재평가한 뒤, (3) 유효하다면 `spec-draft-secret-store-verification-footnote.md §후속` 의 두 항목·`spec-impl-evidence.md`·`PROJECT.md §자동 가드`·`plan-lifecycle.md` 를 **#1123 이 이미 등록한 내용과 이름·계약이 겹치지 않도록** 조율해 다시 작성. 겹치지 않는다고 판단되면 이 target 자체가 이미 무효이므로 세션을 폐기하고 project-planner 에게 "PR #1123 대조 후 착수" 로 되돌릴 것.
  - 참고(범위 안내와의 관계): 이 발견은 "다른 worktree·branch 의 동시 작업 충돌"을 그쪽 상태를 조회해서 추정한 것이 아니라, **이 워크트리·이 브랜치 자신의 `git log`(로컬, 무비용, 확정적)**에서 나온 사실이다 — 되돌림 커밋이 이미 로컬 HEAD 에 존재하므로 "신뢰할 수 없는 원격 상태 추정"에 해당하지 않는다.

- **[INFO]** (위 CRITICAL 이 해소되기 전까지는 moot) target 초안이 유효하다고 가정할 경우에도 동반 갱신 누락 2건이 있었다
  - 상세: 리버트 전 상태(`62084e807`)를 기준으로 봤을 때도, `spec-draft-secret-store-verification-footnote.md §후속` 두 항목은 본문에 "2026-08-10 구현 완료"를 적으면서 체크박스는 `[ ]`로 남겨 두었고, target 초안 §6 Rollout 정책 4번째 항목("PROJECT.md §자동 가드 표에 해당 row 추가")이 스스로 요구하는 PROJECT.md 동기화도 이뤄지지 않은 상태였다(`PROJECT.md:278` 은 `spec-plan-completion.test.ts` 를 Gate C 로만 서술, 2번째 invariant·plan-link-integrity 신규 행 없음). 지금은 구현 자체가 되돌려져 두 문제 모두 대상이 사라졌지만, 위 CRITICAL 을 해소하고 이 작업을 다시 진행하게 되면 **체크박스 동기화 + PROJECT.md 동반 갱신**을 같은 PR 에 반드시 포함해야 한다(이 저장소가 `#1108`/`#1117` 로 이미 두 번 겪은 "체크박스 stale" 실패형과 같은 클래스).
  - 제안: 재작업 시 target 작성 PR 에 plan 체크박스 갱신 + PROJECT.md 행 추가를 같은 커밋에 동반.

## 요약

target(`spec/conventions/spec-impl-evidence.md` §4.2 확장 초안)이 문서화하려는 두 신규 가드(완료 plan 미완 status 차단·plan 내부 링크 ratchet)는, 이 리뷰 세션이 준비된 지 5분 만에 **같은 브랜치의 최신 커밋(`9f2755822`, 10:41:46)이 "미머지 PR #1123 과 중복"이라는 이유로 스스로 되돌렸다.** 현재 워킹트리는 이미 리버트 이후 상태(`spec-impl-evidence.md` diff 0줄, 가드 코드 파일 부재, 원 plan 체크리스트도 원상복구)이므로, 이 target 초안을 그대로 실행하면 저장소가 방금 폐기한 결정을 되살리는 동시에 spec-impl-evidence.md 자신의 핵심 invariant("spec 약속 vs 구현 부재 갭 차단")를 §4.2 스스로 위반하는 상태를 만든다. 이는 미해결 결정과의 충돌이라기보다 **선행 조건(이 구현의 유효성)이 검토 준비 시점과 검토 수행 시점 사이에 실측으로 뒤집힌 경우**이며, 통상적인 "다른 worktree/branch 병렬 작업" 조회 예외에 해당하지 않는다(같은 로컬 브랜치의 `git log` 로 무비용·확정적으로 관측됨). 이 target 은 지금 시점 기준 작성해서는 안 된다.

## 위험도

CRITICAL
