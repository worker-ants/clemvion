# Plan 정합성 검토 — spec/5-system (impl-done, impl-chat-channel-patch-token)

## 전제 확인

- `spec/5-system` 델타는 실측대로 0개 — 이번 PR 은 코드 전용(`codebase/backend/src/modules/triggers/**` 등)이고 spec 변경이 없다. 델타 0 자체는 CRITICAL 근거가 아니다.
- target 구현의 SoT plan 은 `plan/in-progress/impl-chat-channel-patch-token.md` (developer, in-progress). 이 plan 이 발견해 planner 로 넘긴 3건 중 2건(`SecretResolver.store()` vs `rotate()` 9곳, `details.field` 중첩/flat 분기)과 R-CC-21 산문 정정 1건을 실측 대조했다.
- R-CC-21 산문 정정: target plan 은 "planner PR #1313 으로 완료" 라 적는다 — `git log --all`/`git cat-file -t` 로 `df1962e25`(#1311)·`c0f2a885c`(#1313) 커밋 실재 확인, `origin/main` HEAD 가 `c0f2a885c` 임을 확인했다. **정합** — 미해결 결정 우회 아님.
- 두 CRITICAL 버그(chatChannel PATCH bot-token 우회, `ChatChannelCard` 저장 400)는 `spec-draft-nullable-notation-followups.md`(`spec-draft-chat-channel-patch-token.md` 계열 항목, 2026-09-10/11 등재)에 각각 "✅ 2026-09-11 해소" 주석과 함께 이 PR 을 근거로 인용하고 있고, target plan 의 D-1/D-2/D-3 설계·체크리스트와 내용이 일치한다. **정합**.

## 발견사항

- **[WARNING]** "검증 함수 분리" 후속 항목이 실제로는 해소됐는데 sibling plan 에 반영되지 않았다
  - target 위치: `plan/in-progress/impl-chat-channel-patch-token.md` 설계 절 "검증 경로 분리" 및 체크리스트 `[x] 구현 — DTO(...) · 검증 경로 분리 · 쓰기 게이팅 ①②`. 실제 코드: `codebase/backend/src/modules/triggers/triggers.service.ts:636-687`(`assertChatChannelInputSafe` mode 오버로드로 create/update 분기, update 는 `assertPatchCarriesNoSecrets`(:695-713)만 타고 `assertInboundSigningPlaintextByProvider` 는 create 경로(:684)에서만 호출)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2152-2158` — "**생성/수정 검증 함수를 분리해야 한다 — 안 하면 D-1 구현이 생성 경로를 깬다**" (developer, 2026-09-10 등재), 여전히 `[ ]` 미체크, 해소 주석 없음
  - 상세: 이 항목이 경고한 위험("`assertInboundSigningPlaintextByProvider` 를 create/update 가 공유하는 채로 D-1 을 적용하면 slack/discord 생성이 깨진다")은 실제 구현에서 함수 오버로드 + `assertPatchCarriesNoSecrets` 신설로 정확히 그 처방대로 해소됐다. 그런데 같은 문서의 바로 위 두 CRITICAL 항목(bot-token 우회, `ChatChannelCard` 400)은 "✅ 2026-09-11 해소" + PR 인용으로 갱신된 반면, 이 항목만 갱신 없이 미체크 상태로 남아 있다.
  - 제안: `spec-draft-nullable-notation-followups.md:2152` 항목에도 동일 패턴("✅ 해소, 근거: `assertChatChannelInputSafe` mode 오버로드 + `assertPatchCarriesNoSecrets` 신설")으로 체크·주석을 추가한다. developer 소유 항목이라 이 PR 의 마무리 커밋 범위에서 developer 가 직접 갱신 가능(spec 아님, plan).

- **[WARNING]** "트래커 기존 항목에 실측을 덧붙인다"는 약속이 이행되지 않았다
  - target 위치: `plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에 실측해 planner 로 넘길 것" 표 3행 — "`assertChatChannelInputSafe` 의 기존 3분기는 도달 불가에 가깝다 | 전역 파이프가 먼저 거부한다(...) 다만 서비스 직접 호출 경로는 남아 있어 삭제하지 않았다 | **트래커 기존 항목에 이 실측을 덧붙임**"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2073-2079` — "`assertChatChannelInputSafe` 의 세 분기가 dead code 일 수 있다" (developer, 2026-09-10 등재)
  - 상세: grep 결과 해당 tracker 항목 본문에는 "도달 가능성이 높다"는 추측성 서술만 남아 있고, target plan 이 이번 턴에 실제로 확보한 결론("전역 파이프가 먼저 거부 — HTTP 응답에 나가는 것은 파이프의 중첩 경로다. 서비스 직접 호출 경로는 남아 있어 가드를 유지한다")이 반영되지 않았다. 즉 target plan 은 "덧붙였다"고 말하지만 실제로는 덧붙이지 않은 상태다.
  - 제안: 위 실측 결과를 `spec-draft-nullable-notation-followups.md:2073` 항목 본문에 추가한다(추측 문구 "가능성이 높다"를 확정 실측으로 교체하거나 병기). 다음에 이 항목을 여는 사람이 같은 조사를 반복하지 않도록.

- **[INFO]** "9곳" vs "7곳" 개수 표기 불일치
  - target 위치: `plan/in-progress/impl-chat-channel-patch-token.md` 착수 전 실측 없음(이 표현은 "이 턴에 실측해 planner 로 넘길 것" 표 1행) — "spec 9곳이 `SecretResolver.store()` 라 적는데 chat-channel 경로는 `rotate()` 만 쓴다"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2105` — 항목 제목은 "**spec 7곳**이 `SecretResolver.store()` 라 적는데 실제 호출은 전부 `rotate()` 다"이지만, 같은 항목 본문의 "대상" 나열은 `15-chat-channel.md:200,201,373,390`(4) · `chat-channel-adapter.md:354,359`(2) · `providers/telegram.md:58,219`(2) · `providers/slack.md:278`(1) = 9곳이다
  - 상세: 두 plan 모두 같은 세션(2026-09-10~11)이 작성했고 실제 라인 나열은 9곳으로 일치하는데, sibling plan 의 제목 숫자만 7로 남아 있다. 결정 충돌은 아니고 단순 오기로 보이나, 다음 planner 턴이 제목만 보고 "7곳" 스코프로 착수하면 2곳을 놓칠 수 있다.
  - 제안: `spec-draft-nullable-notation-followups.md:2105` 제목의 "7곳"을 "9곳"으로 정정(또는 본문 나열을 7개로 좁힌 근거를 명시).

## 요약

이번 PR(`impl-chat-channel-patch-token`)이 닫은 두 CRITICAL(chatChannel PATCH 비밀 우회, `ChatChannelCard` 저장 400)과 R-CC-21 산문 정정은 target plan과 sibling plan(`spec-draft-nullable-notation-followups.md`) 사이에서 정확히 교차 인용되어 있고, PR 번호(#1311/#1313)도 git 이력으로 실재가 확인돼 미해결 결정을 우회하거나 선행 plan을 무시한 정황은 없다. 다만 이 PR 이 부수적으로 해소한 한 개의 방어적 리팩터(생성/수정 검증 함수 분리)와, target plan 이 스스로 "트래커에 덧붙였다"고 적은 실측 한 건이 실제로는 sibling tracker(`spec-draft-nullable-notation-followups.md`)에 반영되지 않아 두 건의 WARNING(plan 갱신 누락)이 있다. 그 외 3건 후속(planner 소관 spec 표기 정정 2건 + 9/7 개수 오기 1건 INFO)은 이미 적절히 planner 후속으로 등재돼 있어 이번 developer 턴이 권한 밖 결정을 대신 내리지는 않았다.

## 위험도

MEDIUM
