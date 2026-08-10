# Plan 정합성 검토 — `spec/7-channel-web-chat` (--impl-done)

## 검토 방법

`git diff origin/main...HEAD -- codebase`(`git diff --stat` 로 교차검증, code_areas 스코프와 동일)는
`use-widget.ts` + `use-widget-eager-start.test.ts` 단 2파일 — `openStream()` 스트림 소유권 게이트를
호출부 복제 3줄에서 함수 내부 단일 게이트(`StreamClaim` 명명 union, 부정 비교 fail-closed)로 옮기는
리팩터뿐이다. 이 diff 를 다음과 대조했다:

- target 6개 spec 문서(`0-architecture`·`1-widget-app`·`2-sdk`·`3-auth-session`·`4-security`·
  `5-admin-console`·`_product-overview`) 전문.
- target 을 직접 참조/생산하는 in-progress plan 5건 전문: `webchat-reload-rest-error-branches.md`
  (bundle) · `webchat-usewidget-extraction.md`(bundle) · `spec-update-webchat-evidence-pointers.md`
  (bundle) · `webchat-command-failure-is-not-termination.md`(bundle) · `webchat-boot-apibase-scheme-validation.md`
  (예산 절단 → 저장소에서 직접 `Read`) · `webchat-spec-rationale-followup.md`(예산 절단 → 직접 `Read`).
- 같은 날 앞선 두 라운드(`review/consistency/2026/08/10/12_56_30`, `.../13_12_16`)의 `plan_coherence.md`
  산출물 — 이번 라운드가 그 후속인지, 지적이 해소됐는지 실측 대조.
- 절단된 나머지 plan(cafe24/AI Agent/marketplace/node-output-redesign/harness 인프라 등, 53개)은
  파일명·헤더로 target(`spec/7-channel-web-chat`) 과 무관한 도메인임을 확인.

## 앞선 두 라운드 지적의 해소 여부 (실측 대조)

- **`12_56_30` WARNING** ("§3.1 REST 오류 분기 잔여를 소유하는 plan 없음") — **해소**.
  `webchat-reload-rest-error-branches.md` 가 신설돼 §3.1 이 자인한 3개 잔여(`404`·복구불가 `401`·
  낙관적 refresh)를 1:1 로 옮겨 적었고, target frontmatter `pending_plans:` ↔ plan 양방향 링크가
  정합함을 확인했다(`3-auth-session.md` frontmatter `status: partial` + `pending_plans:` 단일 항목).
- **`12_56_30` INFO** (`code:` 증거 포인터가 `use-session-generations.ts` 이동을 못 따라감) — **해소**.
  `3-auth-session.md`·`2-sdk.md` frontmatter `code:` 양쪽에 `use-session-generations.ts` 가 추가되고
  역할 구분 주석까지 붙어 있음을 확인 (`spec-update-webchat-evidence-pointers.md` 의 "지금 고친다" 결정과 일치).
- **`13_12_16` WARNING** (`webchat-reload-rest-error-branches.md` 의 "결정이 필요한 항목" 3개 중 2개가
  target `## Rationale` §R4 가 이미 확정한 것을 "미결"로 되돌림) — **해소**. 해당 plan 이 같은 날
  스스로 정정한 이력이 문서에 남아 있다 ("최초 작성(2026-08-10)에서 이 절을 '결정이 필요한 항목' 이라
  적었다가 같은 날 정정했다. 재판정 라운드(`13_12_16`) `plan_coherence` WARNING 이 잡았고, 지적이
  옳다") — 절 제목이 "미구현 항목 (developer 트랙 — 동작은 이미 결정돼 있다)" 로 바뀌었고 3항목 모두
  `[ ]` (구현 대기)로만 남아 사용자 판단 게이트가 제거됐다.
- **`13_12_16` INFO #1** (`webchat-usewidget-extraction.md` 에 `webchat-reload-rest-error-branches.md`
  로의 역방향 링크 없음) — **해소**. "남은 slice" 절 말미에 "**순서 주의** — `webchat-reload-rest-error-branches.md`
  와 같은 함수를 건드린다... 어느 쪽을 먼저 하든 나중 것이 앞선 것의 결과 위에서 재판정돼야 한다"가
  추가됨을 확인했다.
- **`13_12_16` INFO #2** (termination 축을 두 plan 이 독립적으로 결정 — 아래 재보고, 미해소).

## 발견사항

- **[INFO]** "무엇이 대화의 종료(termination)인가" 축을 다루는 두 plan 이 여전히 서로를 인지하지 못한다
  (13_12_16 INFO #2 의 재보고 — 미해소)
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1-3 (storage 정리 조건 열거)
  - 관련 plan: `plan/in-progress/webchat-reload-rest-error-branches.md`(REST 상태조회 경로의 종료
    판정: `404`/복구불가 `401`) ↔ `plan/in-progress/webchat-command-failure-is-not-termination.md`
    (명령 실패 경로의 종료 판정: 비-410 `interact` 실패)
  - 상세: 두 plan 모두 궁극적으로 §3.1-3 의 같은 storage-정리 조건 목록에 항목을 추가하게 될
    결정이지만, `grep -n "reload-rest-error-branches" webchat-command-failure-is-not-termination.md`
    와 `grep -n "command-failure" webchat-reload-rest-error-branches.md` 모두 0건 — 실측으로
    재확인했다(이번 라운드에서 새로 생긴 gap 아님, 방치된 기존 gap). `webchat-reload-rest-error-branches.md`
    는 이번 라운드에서 상당히 정교하게 개정됐음에도(§"결정 필요" 프레이밍 정정, 소유권 명확화) 이
    상호 링크는 여전히 추가되지 않았다. 두 결정 축이 다르다는 근거(REST 조회 실패="행 자체가
    없다/자격이 없다" vs 명령 실패="일시적 vs 영구")는 여전히 유효하므로 모순은 아니지만, §3.1-3
    최종 조건 목록이 일관된 서사로 수렴하려면 나중에 결정되는 쪽이 먼저 결정된 쪽을 참조하는 것이
    안전하다.
  - 제안: 두 plan 중 어느 한쪽(가급적 아직 "결정 필요" 상태로 남아 있는 `webchat-command-failure-is-not-termination.md`)
    §관련/참조 절에, "§3.1-3 storage 정리 조건에 항목을 추가하는 형제 결정 — `webchat-reload-rest-error-branches.md`
    (REST 상태조회 경로)와 조율할 것" 한 줄을 추가할 것. 차단 사유는 아니므로 INFO 유지.

- **[정보, 조치 불요]** 이번 diff(`openStream` 게이트 이동)는 사용자 결정 대기 중인 두 plan(비-410
  명령 실패 종료 여부, `wc:boot` `apiBase` 스킴 검증)을 우회하지 않는다
  - `webchat-command-failure-is-not-termination.md` 가 다루는 `sendCommand`/`ERROR`/`ended` 전이
    경로와, 이번 diff 가 다루는 `openStream`(SSE 연결 소유권) 경로는 코드상 분리돼 있다 —
    diff 는 `sendCommand`·`widget-state.ts`·ERROR 디스패치를 건드리지 않는다.
  - `webchat-boot-apibase-scheme-validation.md` 가 다루는 `wc:boot` 경로의 `apiBase` 스킴 검증
    미결정도 이번 diff 와 무관한 축(스트림 소유권 vs 입력 검증)이다.
  - `webchat-usewidget-extraction.md` 의 "seed 게이트 + openStream 게이트 짝의 구조적 강제" 체크리스트
    항목(2026-08-10 완료로 표기)과 `webchat-spec-rationale-followup.md` 의 §R7 신설 완료 표기 모두
    이번 diff 의 실제 코드 변경(`StreamClaim` union, `openStream` 내부 게이트, 호출부 부정 비교
    `claim !== "opened" && claim !== "no_client"`)과 정확히 일치함을 대조했다 — 문서·plan·코드
    삼자 정합.

## 요약

이번 라운드의 실제 코드 diff 는 `openStream` 스트림 소유권 게이트 이동뿐인 좁은 리팩터이고, 그
변경을 서술하는 spec Rationale(§R7)·plan 체크리스트(`webchat-usewidget-extraction.md`,
`webchat-spec-rationale-followup.md`)가 diff 내용과 코드 레벨까지 정확히 일치했다. 같은 날 앞선 두
라운드(`12_56_30`→`13_12_16`)가 지적한 결함 4건(WARNING 2 + INFO 2) 중 3건은 이번 라운드 사이에
실제로 정정됐음을 문서 자기서술과 실측 grep 양쪽으로 확인했다. 유일하게 남은 것은 "종료(termination)"
축을 다루는 두 형제 plan(`webchat-reload-rest-error-branches.md`/`webchat-command-failure-is-not-termination.md`)
간 상호 참조 누락으로, 두 라운드째 미해소 상태이나 결정 우회나 실질 모순은 아니라 INFO 로 유지한다.
미해결 결정(비-410 명령 실패 종료 여부, `wc:boot` apiBase 스킴 검증)을 target 이 우회하는 사례,
새로 생겨난 선행 plan 미해소, 새로 발생한 후속 항목 누락은 발견하지 못했다.

## 위험도

LOW
