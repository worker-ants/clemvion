# Plan 정합성 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

> 프롬프트 번들에서 `spec/5-system/14-external-interaction-api.md` 본문과 `<git diff
> origin/main...HEAD -- code_areas>` 가 예산 초과로 절단돼 있어, 워크트리 절대경로
> (`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
> `git diff origin/main...HEAD --stat` / `-- <path>` 를 직접 재실행해 실제 변경 범위를
> 재구성했다. 본 라운드는 동일 세션의 3번째 `plan_coherence` 실행이다 — 앞선
> `02_50_39`·`09_20_48` 라운드가 이미 발견한 항목은 재확인만 하고, 그 이후 커밋
> (`4b46be711`·`e207ff62e`) 과 아직 어느 라운드도 다루지 않은 인접 plan 을 추가로 조사했다.

## 검토 대상 diff 요약

실질 변경은 `CCH-SE-02`(chat-channel inbound update dedup) 신규 구현 1건이다 (`origin/main`
대비 `4b1f899b7` 이후 `HEAD` 까지 축적).

- `spec/5-system/15-chat-channel.md` — CCH-SE-02 표 행 재작성, CCH-NF-03 배선 순서 갱신,
  `R-CC-20` Rationale 신설(+ R-CC-12 앵커 정정, `4b46be711`)
- `spec/4-nodes/7-trigger/providers/telegram.md` — "미구현 (Planned)" → "구현됨"
- `spec/data-flow/14-chat-channel.md` — `cc:dedup:{triggerId}:{idempotencyKey}` 키 행 추가
- `spec/conventions/redis-keys.md` — `cc:dedup:<triggerId>:<updateId>` 인벤토리 등재 (`4b46be711`)
- 코드: `ChatChannelDedupService` 신설, `hooks.service.ts` 배선(rate-limit 앞 게이트)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 해당 체크박스 완료 처리 + 절차 기록
  갱신(실측 파일 수 2→3→4 정정 이력 포함)

## 발견사항

- **[WARNING]** `spec-draft-redis-key-registry.md` 체크리스트가 검증 가능한 완료 상태를
  반영하지 않는다 — 이번 diff 가 그 산출물(`redis-keys.md`) 위에 직접 얹힌다
  - target 위치: `spec/conventions/redis-keys.md`(diff 가 `cc:dedup:` 행을 추가한 바로 그
    파일) · `spec/5-system/4-execution-engine.md` §9.1(같은 diff 계열이 앞서 재작성)
  - 관련 plan: `plan/in-progress/spec-draft-redis-key-registry.md` `## 체크리스트`
    (L169-191, `owner: project-planner`, `worktree: eia-r8-cache-scope-4ae434` — 이번
    diff 와 동일 worktree)
  - 상세: 체크리스트 9개 항목 중 8개(`consistency-check --spec` 재실행 · `redis-keys.md`
    신설(+ 하위 7개 세부 항목) · `4-execution-engine.md` §9.1 범위 한정 · §9.2 phantom 제거 ·
    `14-external-interaction-api.md` §8.4 리터럴 추가 · `data-flow/15` §2.2 역참조 ·
    `backend-lint-gate-broken-on-main.md` 원 항목 종결 · L1179/1183 각주 갱신)이 전부
    `[ ]` 미체크 상태다. 그러나 워킹트리를 직접 열어 실측하면 전부 이미 완료돼 있다:
    `spec/conventions/redis-keys.md` 는 frontmatter(`id`/`status: implemented`/`code` 6모듈
    glob) 를 포함해 완전한 형태로 존재하고, `4-execution-engine.md` §9.1 은 "종전 서술
    정정(2026-08-13)" 각주와 함께 규약 문서를 가리키도록 재작성됐으며, L1186 각주는
    `conventions/redis-keys.md §2` 를 참조하고, `14-external-interaction-api.md` §8.4 에는
    `eia:rl:interact:*`/`eia:rl:status:*` 리터럴이 등재돼 있고, `data-flow/15-external-interaction.md`
    L255 에 역참조 한 줄이 있다. `backend-lint-gate-broken-on-main.md` L772-804 는 이
    작업을 "**완료 (2026-08-13, planner 턴 `eia-redis-key-registry`)**" 로 이미 서술한다.
    `consistency-check --spec` 재실행도 `review/consistency/2026/08/13/02_13_17/SUMMARY.md`
    (`BLOCK: NO`)로 실측 확인된다 — 1차 `02_01_16` 은 `BLOCK: YES` 였고 그 재검증이 이
    체크박스가 요구하는 바로 그 절차였다. 즉 **plan 문서의 체크박스 상태 ≠ 실제 상태**다.
    (마지막 두 항목 — "후속 항목 등재" 세부 두 갈래 중 webhook 케이스 — 은 실제로도 아직
    미완료이며 `backend-lint-gate-broken-on-main.md` L805/L812 에 `[ ]` 로 정확히 남아있다.
    이번 지적은 그 항목을 제외한 8개에 한정된다.)
  - 제안: `spec-draft-redis-key-registry.md` 체크리스트의 완료된 8개 항목을 `[x]` 로
    갱신하고, 아직 열린 "webhook 빈 포인터" 항목만 미체크로 남긴다. 이번 PR 을 막을 사안은
    아니다(diff 가 딛고 선 산출물 자체는 실측상 이미 안정적으로 존재) — 다만 미체크 상태를
    방치하면 다음 세션이 이미 끝난 작업(`redis-keys.md` 신설 등)을 다시 planner 턴으로
    착수하거나, 반대로 이 diff 가 만든 `cc:dedup:` 등재분을 "아직 확정 안 된 draft 위 임시
    변경"으로 오판할 위험이 있다.

- **[INFO]** "planner 결정" 게이팅 항목의 developer 턴 자체 결정·spec 수정 — 이미 두 라운드
  연속 자체 시정 확인됨(재확인)
  - target 위치: `spec/5-system/15-chat-channel.md` CCH-SE-02 행 · `providers/telegram.md`
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L679-764
  - 상세: `02_50_39`·`09_20_48` 두 라운드가 이미 지적했고, plan 문서 자체에 "⚠️ 절차 이탈
    기록" 문단(RESOLUTION 포인터 포함)이 반영돼 있다. 이번 라운드에서 재확인한 결과 그
    상태가 유지되며, `4b46be711`/`e207ff62e` 두 커밋도 같은 절차(developer 턴에서 spec 3→4개
    파일 직접 수정)를 반복했지만 그 사실 자체를 plan 에 정직하게 추가 기록했다(실측값
    2→3→4 정정 이력). 새로 escalate 할 근거 없음.
  - 제안: 추가 조치 불요.

- **[INFO]** 잔여 chat-channel 후속 2건 — 이미 plan 에 정확히 등재돼 있음(재확인)
  - target 위치: `spec/5-system/15-chat-channel.md` R-CC-20 · `spec/conventions/redis-keys.md`
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L805-834(`[ ]` 미체크)
  - 상세: (1) `chat-channel:<triggerId>`·`chat-channel-lock:<triggerId>` 2계열이 여전히
    `redis-keys.md` 인벤토리 미등재, (2) dedup 구현 완료 주석이 `telegram.md` 에만 반영되고
    `slack.md`/`discord.md` 에는 비대칭. 둘 다 `09_20_48` INFO 로 최초 지적된 뒤 plan 본문에
    실측 근거와 함께 정확히 옮겨져 있고 스코프도 좁혀졌다(`cc:dedup:` 은 이 PR 이 이미 등재해
    전제가 갱신됨). 새 diff 가 두 항목을 만들지 않았고 기존 기록도 정확하다.
  - 제안: 추가 조치 불요 — 다음 planner 턴에서 집행.

- **[INFO]** `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 가 이미 완료된
  plan 을 가리킴 — 본 diff 와 무관한 선재 상태(재확인)
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` L23
  - 관련 plan: `plan/complete/spec-sync-chat-channel-gaps.md`(이미 이동됨, 본 PR 이전)
  - 상세: `02_50_39`·`09_20_48` 두 라운드에서 동일하게 지적된 선재 상태. 이번 diff 는 본문
    CCH-SE-02 행만 건드리고 frontmatter 는 손대지 않았다.
  - 제안: 다음에 이 파일을 planner 가 편집할 때 목록에서 제거(하우스키핑).

## 요약

이번 diff(CCH-SE-02 chat-channel update dedup 구현)가 plan(`backend-lint-gate-broken-on-main.md`)이
"planner 결정 필요"로 남겨둔 항목을 실제로 해소한 것, 그 절차 이탈이 이미 자체 기록된 것,
잔여 후속 2건(chat-channel 키 인벤토리 2계열·slack/discord 문서 비대칭)이 정확히 등재된 것은
`02_50_39`·`09_20_48` 두 선행 라운드가 이미 확인했고 이번 라운드에서도 재확인 결과 동일하다.
이번 라운드에서 새로 발견한 것은 이 diff 가 직접 딛고 선 인접 산출물 — `spec/conventions/redis-keys.md`
와 `4-execution-engine.md §9.1` — 을 만든 선행 plan(`spec-draft-redis-key-registry.md`)의
체크리스트가 실제로는 (webhook 항목 하나를 빼고) 전부 완료됐는데도 문서상 전항목 미체크로
남아 있다는 점이다. 내용 충돌은 없다(코드/spec 실측 결과 완료 항목들이 실제로 정확히 반영돼
있다) — 순수하게 plan 체크박스가 실제 상태를 못 따라간 케이스이며, 방치 시 이 diff 가 확장한
`redis-keys.md` 를 "미확정 draft"로 오판하거나 완료된 작업을 재착수할 위험이 있다. 이번 PR 을
막을 사안은 아니다. 그 외 chat-channel 계열 다른 in-progress plan(discord-gateway/slack-socket-mode/
visual-ssr-png, eia-context-schema-followups)은 이번 변경의 영향을 받지 않으며, target 이 새로
일방적으로 내린 미해결 결정이나 무시한 선행 plan 은 추가로 발견되지 않았다.

## 위험도
LOW
