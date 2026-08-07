# Plan 정합성 검토

## 검토 범위 확정 (선행 확인)

`--impl-done spec/conventions` 세션이지만, 실측 결과 이 diff-base(`origin/main...HEAD`)에서
`spec/conventions/**` 변경은 **0건**이다 (prompt 에 diff hunk 자체가 존재하지 않음 — `diff --git`
라인 전무). 실제 변경분은:

- `.claude/tests/test_packages_prepare_contract.py` (신규)
- `.github/workflows/harness-checks.yml` (paths trigger 1줄 추가)
- `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` (`prepare` 스크립트 개정)
- `review/code/2026/08/06/18_55_02/**` (직전 라운드 리뷰 산출물)

즉 target 으로 배정된 `spec/conventions` 전체 스냅샷(Cafe24 카탈로그 대용량 dump 포함)은 이
PR 의 실제 변경과 **무관한 번들**이다. 아래 발견사항은 이 사실을 전제로 한다.

## 발견사항

- **[INFO]** `--impl-done` scope 산정이 diff 부재를 확인하지 않음 — 이미 추적 중인 결함의 재발
  - target 위치: `## Target 문서` 전체 (`spec/conventions/**` 스냅샷, diff 0건)
  - 관련 plan: `plan/in-progress/harness-consistency-summary-downgrade-rule.md` §"관련 관측 —
    `--impl-done` scope 가 실제 diff 와 무관한 번들을 싣는다" 의 미체크 항목:
    `- [ ] orchestrator 의 --impl-done/--impl-prep scope 산정이 그 경로에 실제 diff 가 있는지
    사전 확인하도록 보강. diff 0건이면 (a) 관련 spec 을 diff 에서 역산하거나 (b) 번들을 비우고
    그 사실을 프롬프트에 명시.`
  - 상세: 같은 plan 문서에서 자연스러운 정렬(natural sort)·계층 우선순위(tier 0/1/2/3)·누락
    고지(OMITTED_FILES_HEADING) 3개 하위 항목은 2026-07-31 "구현 완료" 로 표기돼 있으나, 위
    "diff 유무 사전 확인" 항목은 여전히 미체크다. 이번 세션이 정확히 그 미해결 케이스를
    재현한다 — diff 가 없는 `spec/conventions` 를 scope 로 받아 전체 폴더(Cafe24 API 카탈로그
    자동생성 문서 다수 포함, tier 3 강등 대상)를 번들링했다. tier 시스템은 "번들 안에서 무엇을
    먼저 넣나" 문제이지 "애초에 이 scope 를 번들링해야 하는가" 문제를 풀지 않는다는 것이 이번
    관측으로 재확인된다.
  - 제안: target 문서 자체보다 plan 갱신 대상 — 위 미체크 항목을 신규 관측으로 보강하거나
    (2026-08-06 재발 사례 추가), orchestrator 의 scope 결정 로직에 "diff 0건이면 이 경로를
    scope 로 채택하지 않는다" 사전 검사를 추가해야 한다. target 문서(`spec/conventions`) 자체는
    수정 대상이 아니다 — 내용 문제가 아니라 scope 선정 문제.

- **[INFO]** 이 작업(worktree)의 governing plan 이 예산 초과로 번들에서 생략됨 — 직접 Read 로 검증, 충돌 없음
  - target 위치: `plan/in-progress/harness-review-gate-ci-backstop.md` (번들 끝단
    "⚠️ 컨텍스트 예산 초과로 생략된 파일 55개" 목록에 파일명만 존재, 본문 없음)
  - 관련 plan: 위 동일 파일. 실제 worktree(`harness-review-ci-backstop-91f379`)가 바로 이
    plan 의 작업 대상이다.
  - 상세: 프롬프트 지시(생략 파일은 관련되면 직접 Read)에 따라 디스크에서 전문을 직접 읽었다.
    이 plan 은 review-gate CI 백스톱(관측 모드 배포 완료, `--enforce` 전환은 미결 — §"결정이
    필요한 지점" (a)/(b)/(c) 미확정, 사실상 기본값 (c))과 16개 defer 후속 항목을 추적 중이다.
    이번 세션의 실제 diff(`packages/*/package.json` `prepare` 스크립트 개정,
    `harness-checks.yml` paths trigger 추가, `test_packages_prepare_contract.py` 신규)는
    이 plan 이 다루는 review-gate/CI 백스톱 주제와 **직교**하며, plan 의 미결 결정 지점
    어느 것과도 충돌하지 않는다. `harness-checks.yml` 의 paths trigger 추가는 review-gate.yml
    을 건드리지 않으므로 이 plan 의 §마찰(SUMMARY 커버리지 18%)·§in-flight TTL scope 어느
    항목에도 영향이 없다.
  - 제안: 조치 불요 — 확인 목적의 기록. plan 갱신 필요 없음.

- **[INFO]** `spec/conventions/chat-channel-adapter.md` 의 `pending_plans` 는 현재도 정합
  - target 위치: `spec/conventions/chat-channel-adapter.md` frontmatter (`status: partial`,
    `pending_plans: [chat-channel-discord-gateway.md, chat-channel-slack-socket-mode.md,
    chat-channel-visual-ssr-png.md]`)
  - 관련 plan: 위 3개 plan 전부 (`plan/in-progress/chat-channel-*.md`, 번들에서는 예산 초과로
    생략돼 디스크에서 직접 확인)
  - 상세: 3개 plan 모두 `status: backlog` / `worktree: (unstarted)` 이며 "진입 조건(사용자
    결정 필요)" 이 미체크 상태다. convention 문서의 `status: partial` + `pending_plans` 선언과
    3개 plan 의 backlog 상태가 서로 모순 없이 정합한다 — 이번 세션의 diff 도 이 영역을 건드리지
    않는다.
  - 제안: 조치 불요.

## 요약

이번 `--impl-done spec/conventions` 세션은 target 으로 배정된 `spec/conventions` 전체가 실제
diff(`origin/main...HEAD`)와 **0건 겹침**이라, target 문서 내용 자체에 대해 plan 과 충돌하는
"일방적 결정"이나 "누락된 후속 항목"을 발견할 근거가 없다 — 검토 대상 자체가 이번 PR 이 만든
변경을 반영하지 않는다. 실제 변경(packages `prepare` 계약 수정 + `harness-checks.yml` 트리거
보강 + 신규 계약 테스트)은 이 worktree 의 governing plan(`harness-review-gate-ci-backstop.md`)
이 다루는 review-gate/CI 백스톱 주제와 직교하며, 그 plan 의 미결 결정 지점과 충돌하지 않는다.
유일하게 의미 있는 관측은 harness 자체의 결함(scope 산정이 diff 부재를 사전 확인하지 않음)이
이미 `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 에 미체크 항목으로 추적
중이라는 사실의 재확인이다 — 신규 결정 충돌이 아니라 기존에 알려진 harness 한계의 재발이므로
INFO 로만 기록한다.

## 위험도

NONE
