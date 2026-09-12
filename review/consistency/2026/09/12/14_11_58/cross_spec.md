# Cross-Spec 일관성 검토 — spec-update-chat-channel-adapter-status.md

## 검토 대상

`plan/in-progress/spec-update-chat-channel-adapter-status.md` — `spec/conventions/chat-channel-adapter.md`
frontmatter `pending_plans` 주석 + §1.1.2 콜아웃의 "미구현" 서술을 "구현 완료(v1 provider 3종)"로
정정하는 SPEC-DRIFT draft. 코드 변경 없음, `status: partial`·`pending_plans:` 리스트 항목 자체는 유지.

## 확인한 실측 (target 의 근거 재검증)

- `git blame spec/conventions/chat-channel-adapter.md:6-7` → author 커밋 `8964a7114`
  (`docs(spec): setupChannel 실패를 transport 대신 원인으로 분류한다`, diff 스코프 spec-only) —
  target 의 "developer 자신이 아니라 planner 턴 커밋" 판정과 일치.
- adapter 3종 `code` 부착 grep 확인: `TELEGRAM_CREDENTIAL_REJECTED_STATUSES`
  (`telegram.adapter.ts`) · `SLACK_CREDENTIAL_REJECTED_ERRORS` (`slack.adapter.ts`) ·
  `DISCORD_CREDENTIAL_REJECTED_STATUSES` (`discord.adapter.ts`) 3개 전부 존재, 각 `*.spec.ts`
  에 `code: 'BOT_TOKEN_INVALID'` 단언 존재.
- `spec/5-system/15-chat-channel.md:365-366` (§5.4 에러 표) — 400 `BOT_TOKEN_INVALID` / 502
  `CHAT_CHANNEL_SETUP_FAILED` 두 행 모두 "미구현" 표시 없이 현재형으로 이미 서술돼 있음.
  `spec/5-system/2-api-convention.md` §6 502 행도 `CHAT_CHANNEL_SETUP_FAILED` 를 현재형으로
  cross-link — 둘 다 target 이 주장하는 "구현 완료" 상태와 이미 일치. target 이 고치려는
  문장(`chat-channel-adapter.md` frontmatter·§1.1.2)만 낡아 있었고, **인접 SoT 는 이미 최신
  상태**였다는 뜻 — 정정 후 세 문서 간 서술이 수렴한다.
- `spec/5-system/15-chat-channel.md` 자신의 frontmatter `pending_plans`(discord-gateway ·
  slack-socket-mode · visual-ssr-png 3개)는 target 이 남기려는 `chat-channel-adapter.md` 의
  나머지 3개 항목과 동일 — 두 spec 파일의 미구현 surface 목록이 정합.
- `plan/in-progress/spec-draft-nullable-notation-followups.md:2818` 부근 확인 — "setupChannel
  실패 분류" 항목이 `✅ spec 은 닫혔다` 로 표시돼 있고 developer 후속 1~5(번역 함수 정정 ·
  slack/discord/telegram `code` 부착 · 캐너리 뒤집기)가 target 이 인용한 커밋
  (`a4f943f4b`·`455d1526f` + 후속 `a07c91b64`·`eda10e051`·`0adc3d577`·`15504662d`)으로 전부
  완료돼 있음 — target §3 의 cross-link 제안이 정확.
- provider 문서(`4-nodes/7-trigger/providers/{telegram,slack,discord}.md`)에 남은
  "미구현 (Planned)" 표시는 전부 이미지 전송·캐러셀 collage·rate-limit 큐 등 **다른 축**이고,
  `code`/`BOT_TOKEN_INVALID` 관련 서술은 이미 현재형 — target 정정과 충돌하는 잔존 문구 없음.
- `spec-impl-evidence.md §2.1/§3` 가드 관점: `pending_plans:` 리스트는 항목 삭제 없이 유지되므로
  `spec-pending-plan-existence.test.ts`·`spec-status-lifecycle.test.ts` 어느 것도 이 정정으로
  깨지지 않는다(주석 텍스트만 바뀌고 경로 목록은 불변).

## 발견사항

없음 — 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 target 이
신규로 도입하는 정의가 없다. 이 draft 는 이미 구현·문서화된 사실(3종 adapter `code` 부착,
400/502 분류)에 대해 한 파일의 낡은 상태 서술 두 곳(frontmatter 주석, §1.1.2 콜아웃)만
갱신하며, 그 갱신 내용은 이미 `15-chat-channel.md`·`2-api-convention.md`·provider 문서들이
서술하는 현재 상태와 정확히 수렴한다. `status: partial`·`pending_plans:` 4개 항목은 그대로
유지되어 나머지 미구현 surface(discord gateway v2·slack socket mode·visual SSR PNG·§1.1.2
fallback 제거 판정 등)의 추적도 끊기지 않는다.

## 요약

target 은 코드 변경이 없는 순수 spec 상태-서술 정정이며, 정정 대상 두 지점(frontmatter
주석·§1.1.2 콜아웃) 모두 실측(git blame·grep·commit 이력)으로 뒷받침된다. 인접 spec
(`15-chat-channel.md` §5.4 에러 표, `2-api-convention.md` §6 502 행, provider 3종 문서,
`spec-draft-nullable-notation-followups.md` 트래커)은 이미 "구현 완료" 상태를 전제로
서술돼 있어 이번 정정이 그 문서들과 새로 어긋날 지점이 없고, 오히려 지금까지 벌어져 있던
`chat-channel-adapter.md` 만의 지연된 서술을 나머지 SoT 와 맞추는 방향이다. `pending_plans`
리스트 항목을 삭제하지 않아 `spec-impl-evidence.md` frontmatter 가드에도 영향이 없다.
Cross-spec 충돌 없음.

## 위험도

NONE
