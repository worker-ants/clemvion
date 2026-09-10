# Rationale 연속성 검토 — chat-channel PATCH 토큰 우회 수정, 3라운드 fix 반영 (impl-done, spec/5-system)

## 검토 범위

이번 라운드의 target 델타는 직전 검토(`review/consistency/2026/09/11/00_21_57`, 기준 커밋
`83d5f3f94`) 이후 추가된 커밋 `5976587c7`(`/ai-review --route=all` `review/code/2026/09/11/00_21_55`
WARNING 3건 중 2건 조치) 하나다. `git diff 83d5f3f94..HEAD --stat` 로 확인한 변경 파일은:

- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (테스트 단언 강화 8줄, production 로직 무변경)
- `codebase/frontend/src/content/docs/06-integrations-and-config/{discord,slack}{,.en}.mdx` (사용자 가이드 신설 62줄)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (트래커 각주)
- `review/code/2026/09/11/00_21_55/**`, `review/consistency/2026/09/11/00_21_57/**` (리뷰 산출물)

`spec/5-system/**` 자체는 이번 커밋에서도 델타가 0이다(scope 델타 0, 정상 — 코드/문서 전용 PR).
`git diff --name-only 83d5f3f94 -- codebase` 에서 `.spec.ts`·`.mdx` 를 뺀 production 파일은 0건임을
커밋 메시지 자체가 명시하고, 실측(`git diff`)으로도 확인된다.

## 발견사항

없음. CRITICAL/WARNING 대상 없음.

- **[INFO]** 신설된 slack/discord 사용자 가이드가 R-CC-10 / R-CC-21 / §5.4.1.1 telegram carve-out 을 정확히 반영함 (정합 확인)
  - target 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` §6.5,
    `discord.en.mdx` §6.5, `slack.mdx` §5.5, `slack.en.mdx` §5.5 (신설)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `R-CC-10`(bot token single-path, rotate API
    전용) · `R-CC-21`(PATCH 는 비밀을 쓰지 않는다 — botToken·slack/discord `inboundSigningPlaintext`
    두 축 차단) · §5.4.1.1 telegram carve-out(telegram server-issued 서명은 이 결정 범위 밖)
  - 상세: 신설 문서는 "Bot Token 은 rotate API 로만" · "Signing Secret/Public Key 는 v1 에서 PATCH 로
    변경 불가, 재발급 시 트리거 삭제·재생성" · "카드에서 표시 옵션/rate limit 만 바꾸는 저장은 이
    제한과 무관(그 PATCH 는 비밀을 안 건드림)" 세 가지를 명시한다. 이는 R-CC-10(bot token
    single-path)·R-CC-21(slack/discord `inboundSigningPlaintext` 전면 차단, telegram 서명은 별도
    축)이 정한 처방과 문자 그대로 일치하며, 이전 라운드(`23_54_09`)가 telegram 문서에만 반영하고
    slack/discord 를 빠뜨렸던 비대칭("축은 대칭인데 한쪽만 고쳤다", 커밋 메시지 자체가 자인)을 이번
    커밋이 해소한 것이다. 새 Rationale 이나 결정 변경은 없고, 기존 Rationale 을 사용자 문서 층에
    뒤늦게 전파한 것뿐이라 "결정의 무근거 번복"에 해당하지 않는다.
  - 제안: 없음 (이미 올바르게 반영됨).

- **[INFO]** 테스트 단언 강화(`details.field: 'chatChannel'` 추가)는 기존 실측(`details.field` 는
  중첩 경로)을 재확인할 뿐 새 결정을 도입하지 않음
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3151` 부근
  - 과거 결정 출처: 직전 라운드(`00_21_57`)가 기록한 "`details.field` 형식은 값의 형태에 따라
    중첩/flat 두 갈래" 실측, 및 `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 의 "미확정" 표기
  - 상세: 이번 diff 는 기존 통과 테스트의 판별력을 `code: 'VALIDATION_ERROR'` 단독에서
    `details.field: 'chatChannel'` 병기로 좁힌 것으로, 이 저장소가 반복 겪은 "인접 가드가 같은
    입력을 다른 이유로 거부해도 GREEN" 형태의 vacuous 단언을 닫는 조치다. 정책 자체(어떤 필드가
    차단되는가)는 바뀌지 않았고, §5.4.1/§5.4.1.1 이 이미 "미확정 — 후속 e2e/planner 확인 대기"로
    열어 둔 자리를 정밀화하는 방향이라 Rationale 의 "근거 실측" 원칙에 부합한다.
  - 제안: 없음. 다음 planner 턴이 §5.4.1/§5.4.1.1 의 `details.field` 표기를 확정할 때 이 최신
    단언(중첩 경로 `chatChannel.<field>` 및 최상위 `chatChannel`)을 반영하면 된다 — 이미 트래커
    (`spec-draft-nullable-notation-followups.md`)에 등재돼 있다.

## 그 외 재확인 (변경 없음, 문제 없음)

- **R-CC-21 「기각한 대안」 3종**(botToken optional+침묵 무시 / `SecretResolver.rotate` 빈값 가드만
  추가 / telegram 전용 별도 rotate API 신설) — 이번 커밋도 어느 것도 재도입하지 않는다
  (`triggers.service.ts` production 코드 자체가 이번 델타에 없음).
- **telegram carve-out**(§5.4.1.1 telegram 행, server-issued 서명 매 `setupChannel` 무조건 재저장) —
  이번 커밋이 손댄 파일 목록에 `triggers.service.ts`·`chat-channel-config.dto.ts` 가 없어 게이팅
  로직 자체는 3라운드 전 상태(`771801fca`)에서 불변.
- **R-CC-10 single-path** — 신설 문서도 "Bot Token 은 rotate API 전용"을 재확인할 뿐 PATCH 경로를
  다시 열지 않는다.
- **동시 PATCH lost-update**(CCH-SE-01) — 이번 라운드 트래커 각주가 재확인만 하고 처분(defer 확정,
  사전 존재 설계)을 바꾸지 않았다.

## 요약

이번 라운드(커밋 `5976587c7`)는 `spec/5-system/15-chat-channel.md` 의 핵심 Rationale(R-CC-10 bot
token single-path, R-CC-21 PATCH 비밀 차단 2축 + telegram carve-out)을 구현하는 production 코드를
전혀 건드리지 않았다 — 변경은 테스트 단언 판별력 강화(기존 실측의 재확인)와 이전 라운드가 비대칭으로
남겨 둔 slack/discord 사용자 가이드 신설(telegram 문서와 대칭 맞춤)뿐이다. 신설 가이드 문구는
R-CC-10/R-CC-21/§5.4.1.1 이 정한 처방과 정확히 일치하며 새로운 결정이나 예외를 만들지 않는다. 기각된
대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지 않았고, 직전 두
라운드(`23_54_09`, `00_21_57`)가 이미 NONE 으로 수렴시킨 상태가 이번 라운드에서도 유지된다.

## 위험도
NONE
