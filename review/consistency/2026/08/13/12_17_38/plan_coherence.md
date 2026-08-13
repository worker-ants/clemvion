# Plan 정합성 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

## 검토 방법 메모

프롬프트에 번들된 `git diff origin/main...HEAD` 가 컨텍스트 예산 초과로 생략되어 있어
(`<git diff origin/main...HEAD -- code_areas>` 가 "예산 초과로 생략된 파일" 목록에 등재),
워크트리에서 직접 `git diff origin/main...HEAD --stat` 및 파일별 diff 를 재실행해 실제 변경분을
확인했다. 실제 diff-base 는 `origin/main` 대비 **커밋 1개**(`5d4655ceb`, "인벤토리가 가리키는
절에 키가 없었다 — 빈 포인터가 하나가 아니라 둘")뿐이며, 변경 파일은 다음과 같다:

- `spec/5-system/12-webhook.md` (target 범위 내 — §6 에 `wh:rl:min:<ip>`·`wh:rl:hour:<ip>` Redis 키 표 신설)
- `spec/conventions/redis-keys.md` (인벤토리 포인터 정정 — cafe24 §5.8→§9.8, chat-channel verbose 2계열 등재)
- `spec/4-nodes/4-integration/4-cafe24.md` (규약 역참조 추가)
- `spec/data-flow/14-chat-channel.md` (규약 역참조 추가)
- `spec/4-nodes/7-trigger/providers/discord.md` / `slack.md` (dedup 서술을 "구현됨" 으로 갱신 + slack 은 envelope 3종 키 도출 명시)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (같은 커밋에서 대응 체크리스트 갱신)

## 발견사항

없음. 이 diff 는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 미해결 항목 4건
(`wh:rl:*` 빈 포인터·규약 역참조 확산·chat-channel 키 인벤토리 누락·slack/discord dedup 서술
비대칭)을 **정확히 1:1 로 해소**하며, 같은 커밋 안에서 해당 plan 문서의 체크박스를 `[x]` 로
갱신하고 실측 기반 자기 정정 2건(① chat-channel 키에 `:<conversationKey>` 꼬리 누락 발견 ②
cafe24 포인터가 가리키던 `2-navigation/4-integration.md §5.8` 자체가 키 리터럴 0건인 "빈 포인터"
였음을 추가 발견해 `4-cafe24.md §9.8` 로 이설)까지 남겼다. `plan/in-progress/cafe24-backlog-residual.md`
가 이미 §9.8 을 SoT 로 인지하고 있어 이설 대상과 충돌하지 않는다.

이 turn 이 새로 발견한 잔여 결함(코드 docstring 이 "슬라이딩 윈도우" 라 부르지만 구현은
`INCR`+`EXPIRE NX` 기반 fixed window — spec 은 이미 정확히 "fixed-window" 로 기술)은
`backend-lint-gate-broken-on-main.md` 에 새 미체크 항목으로 정확히 등재됐다(developer 턴,
코드 주석 2줄). target spec 문서가 정확한 서술을 이미 채택했으므로 target 쪽엔 정정이 필요
없다 — plan 쪽 후속 항목만 열려 있으면 되는 상태이고 실제로 그렇다.

수해결 결정 우회 여부: `chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md`
의 "사용자 결정 필요" 항목(Gateway/Socket Mode 도입)은 본 diff 의 dedup 서술 갱신과 전혀 다른
축(연결 방식 vs 중복 억제)이라 충돌하지 않는다. `spec/conventions/redis-keys.md` 의 "접두 셋
공존을 강제 통일하지 않는다" 결정도 본 diff 가 그대로 준수한다(verbose `chat-channel:` 와 약어
`cc:` 를 통일하지 않고 병기 등재).

참고(target 범위 밖, 정보성): `plan/in-progress/spec-draft-eia-r8-alignment.md`
(`spec/data-flow/15-external-interaction.md`, `spec/5-system/14-external-interaction-api.md`
대상)는 체크리스트 전항목이 `[x]` 이고 사후 기록까지 남겼는데도 `status: in-progress` 로
남아 있다. 본 diff 는 이 파일들을 건드리지 않아 이번 검토의 직접 대상은 아니지만, 다음
lifecycle 정리 시 `plan/complete/` 이동 후보로 눈에 띈다.

## 요약

diff-base 의 실제 변경분은 spec/5-system/12-webhook.md 를 포함한 Redis 키 인벤토리 포인터
정합화 + chat-channel dedup 서술 갱신 한 세트이며, `plan/in-progress/backend-lint-gate-broken-on-main.md`
의 대응 항목 4건을 같은 커밋에서 정확히 체크오프하고 새로 발견한 잔여 결함(docstring 오기)도
빠짐없이 새 항목으로 등재했다. 미해결 결정을 우회하거나, 선행 조건이 안 갖춰진 채 전제하거나,
후속 항목을 누락한 사례를 찾지 못했다.

## 위험도
NONE
