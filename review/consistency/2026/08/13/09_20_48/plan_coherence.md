# Plan 정합성 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

> 프롬프트 번들에서 `spec/5-system/14-external-interaction-api.md` 본문과 `<git diff
> origin/main...HEAD -- code_areas>` 가 예산 초과로 절단돼 있어, 워크트리 절대경로에서
> `git diff origin/main...HEAD --stat` / `-- <path>` 를 직접 재실행해 실제 변경 범위를
> 재구성했다.

## 검토 대상 diff 요약

실질 변경은 `CCH-SE-02`(chat-channel inbound update dedup) 신규 구현 1건이다.

- `spec/5-system/15-chat-channel.md` — CCH-SE-02 표 행 재작성(EIA `Idempotency-Key` 자동
  발급 서술 → `ChatChannelDedupService` 메커니즘 서술), CCH-NF-03 배선 순서 갱신(dedup 게이트
  이후 rate-limit), `R-CC-20` Rationale 신설
- `spec/4-nodes/7-trigger/providers/telegram.md` — "미구현 (Planned)" → "구현됨 (2026-08-13)"
- `spec/data-flow/14-chat-channel.md` — `cc:dedup:{triggerId}:{idempotencyKey}` Redis 키 행 추가
- 코드: `ChatChannelDedupService` 신설, `hooks.service.ts` 배선(rate-limit 앞 게이트)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` 해당 체크박스 완료 처리 + 절차 기록

## 발견사항

- **[INFO]** "planner 결정" 게이팅 항목의 developer 턴 자체 결정·spec 수정 — 이미 자체 시정됨
  - target 위치: `spec/5-system/15-chat-channel.md` CCH-SE-02 행 · `providers/telegram.md`
    L232-236
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L679-726
  - 상세: plan 은 이 항목을 "dedup 을 구현할지, CCH-SE-02 를 현실에 맞게 고칠지가 **planner
    결정**" 으로 등재해 뒀는데, developer 턴이 구현과 같은 커밋에서 그 결정을 내리고
    `spec/` 3개 파일을 직접 고쳤다(CLAUDE.md `developer` spec read-only 규칙 위반). 다만 이번
    라운드에서 확인한 결과, 직전 `02_50_39` plan_coherence 라운드가 이미 이 사실을 WARNING 으로
    지적했고, 그 제안(plan 파일 자체에 절차 이탈 사실 + RESOLUTION 포인터를 남길 것)이
    실제로 반영돼 있다 — L707-726 에 "⚠️ 절차 이탈 기록" 문단이 `02_38_41`·`09_09_58`
    RESOLUTION.md 로의 포인터와 함께 명시돼 있다. 내용(구현 선택) 자체도 `--impl-done`
    consistency 가 두 라운드 연속 BLOCK:NO 로 확인했다.
  - 제안: 추가 조치 불요 — 기록으로서 재확인만 남긴다. 향후 유사 상황에서는 이번처럼
    "결정 내용 + 절차 이탈 사실" 을 plan 본문에 함께 남기는 패턴을 유지할 것.

- **[WARNING]** 신규 Redis 키 `cc:dedup:*` 가 §9.1 키 레지스트리 미비 backlog 의 스코프 밖
  - target 위치: `spec/data-flow/14-chat-channel.md` §2.2 표 (`cc:dedup:{triggerId}:{idempotencyKey}`
    신규 행) · `spec/5-system/15-chat-channel.md` R-CC-20
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L727-735 (미해결,
    `[ ]`)
  - 상세: `4-execution-engine.md §9.1`(워킹트리 실측 L1146)은 여전히 "**모든** Redis 키는
    `{service}:{workspaceId}:{resource}:{id}:{sub}` 를 따른다" 고 선언한 채다(완화 PR
    `#1160` 은 `gh pr view 1160` 실측 결과 아직 `state=OPEN`·`mergedAt=null` — 미병합). 이번
    diff 가 추가한 `cc:dedup:{triggerId}:{idempotencyKey}` 는 이 패턴을 따르지 않는다
    (`workspaceId` 세그먼트 없음, 실행 엔진 §9.2 표에도 미등재) — 기존에 이미 같은 처지였던
    `cc:rl:*`(CCH-NF-03, origin/main 선재) · `chat-channel:*` · `chat-channel-lock:*` 와
    같은 부류다. 이 gap 을 추적하는 로컬 plan 항목(L727-735)은 스코프를 **"EIA 계열"**
    (`interaction:idempotency:*`, `iext:blacklist:<jti>`, `data-flow/15` §2.2)로만 적어 뒀고
    `data-flow/14`(chat-channel) 의 Redis 키는 항목 본문에 한 번도 언급되지 않는다 — 이 backlog
    항목이 나중에 (`#1160` 병합 후 이어지는 planner 작업으로) 처리될 때 chat-channel 계열
    키들이 스코프 밖으로 누락될 위험이 있다. `data-flow/14-chat-channel.md` 자체에도
    (`4-execution-engine.md` §9.1 각주가 `exec:recover:lock` 등에 두는 것과 달리) 이 비정합을
    설명하는 각주가 전혀 없다.
  - 제안: `backend-lint-gate-broken-on-main.md` L727-735 의 스코프 서술에 chat-channel 계열
    키(`chat-channel:*`/`chat-channel-lock:*`/`cc:rl:*`/`cc:dedup:*`)를 명시적으로 추가하거나,
    (대안) 이번 PR 에서 `data-flow/14-chat-channel.md` §2.2 표 하단에 §9.1 비정합 각주 한 줄을
    추가해 최소한 코드 리뷰에서 이미 INFO 로 유예된 사실이 spec 자체에도 드러나게 할 것. 이번
    PR 을 막을 사안은 아니다(기존 관례 연장이고 fail-open 등 안전 정책은 동일) — 다음에 §9.1
    레지스트리를 정리하는 planner 턴(`#1160` 후속)에서 놓치지 않도록 plan 갱신만 권고한다.

- **[INFO]** `spec/5-system/15-chat-channel.md` frontmatter `pending_plans` 가 이미 완료된
  plan 을 가리킴 — 본 diff 와 무관한 선재 상태
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` (L23)
  - 관련 plan: `plan/complete/spec-sync-chat-channel-gaps.md`(이미 `complete/` 로 이동, `git
    log` 확인 결과 커밋 `88ab25bcc` 에서 이동 — 본 PR 이전)
  - 상세: frontmatter 는 여전히 `plan/in-progress/spec-sync-chat-channel-gaps.md` 를 가리키지만
    실제 파일은 `complete/` 아래 있다. 이번 diff 는 같은 파일의 본문(CCH-SE-02 행)만 건드리고
    frontmatter 는 손대지 않았다. 직전 라운드(`02_50_39`)에서도 동일하게 지적·비차단 처리됨.
  - 제안: 이번 PR 의 blocking 사유 아님. 다음에 이 spec 파일을 planner 가 편집할 때
    `pending_plans` 목록에서 제거(하우스키핑).

- **[INFO]** `plan/in-progress/spec-draft-eia-r8-alignment.md` 체크리스트 전항목 완료 —
  lifecycle 이동 대상
  - target 위치: 해당 plan 파일 frontmatter `status: in-progress`
  - 관련 plan: 동 파일 `## 체크리스트` (전항목 `[x]`, 마지막 항목은 `eia-r8-cache-scope`
    developer 턴의 §2.2 caveat 삭제에 대한 사후 확인까지 포함해 완료)
  - 상세: 본 target(`spec/5-system/`) 변경과 직접 충돌은 없으나, 이 plan 이 다루던 "선행
    조건"(§R8 캐시 대상 서술 정합)은 이미 `eia-r8-cache-scope` 작업으로 소비·완료됐다.
    `plan/in-progress/**` 에 남아 있으면 다음 세션이 미해결 작업으로 오인할 수 있다.
  - 제안: `plan-lifecycle.md` 절차에 따라 `plan/complete/` 로 이동(본 PR 의 book-keeping 범위
    밖이면 별도 후속 커밋으로).

## 요약

이번 diff(CCH-SE-02 chat-channel update dedup 구현)는 plan(`backend-lint-gate-broken-on-main.md`)
이 "planner 결정 필요" 로 남겨둔 항목을 실제로 해소했고, 그 절차 이탈은 이미 두 차례 code
review 라운드와 직전 plan_coherence 라운드를 거쳐 plan 파일 자체에 정직하게 기록돼 있어
추가 조치가 필요 없다. 새로 확인된 것은 이 diff 가 추가한 Redis 키 `cc:dedup:*` 가 아직
병합되지 않은 §9.1 키 레지스트리 정리 backlog(로컬 plan 항목, PR #1160 후속)의 스코프
서술("EIA 계열")에 들지 않아, 그 backlog 가 나중에 처리될 때 chat-channel 계열 키가 누락될
가능성이 있다는 점이다 — 병합을 막을 사안은 아니고 plan 스코프 서술 보강을 권고한다. 그 외
chat-channel 계열 다른 in-progress plan(discord-gateway/slack-socket-mode/visual-ssr-png)은
이번 변경의 영향을 받지 않으며, target 이 새로 일방적으로 내린 미해결 결정이나 무시한 선행
plan 은 추가로 발견되지 않았다.

## 위험도
LOW
