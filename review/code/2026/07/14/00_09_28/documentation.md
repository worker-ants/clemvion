# 문서화(Documentation) Review

대상: F-2 (`plan eia-command-waiting-surface-guard`) — 채팅 채널 inbound 명령이 대기 노드 표면과
맞지 않아 409 `STATE_MISMATCH` 로 거부됐을 때 사용자에게 `languageHints.surfaceMismatch` best-effort
안내를 발송하는 기능. 대상 파일 7개: `language-hint-defaults.{ts,spec.ts}`,
`hooks.service.{ts,spec.ts}`, `telegram{.en,}.mdx`, `spec/5-system/15-chat-channel.md`.

## 발견사항

- **[WARNING]** CHANGELOG 미갱신 — 동일 plan 의 기존 항목이 F-2 동작을 반영하지 못함
  - 위치: `CHANGELOG.md` (레포 루트) — 특히 74~78행 `## Unreleased — continuation 명령 ↔ 대기 노드 표면
    검증 (5-system/4-execution-engine §7.5.1)` 항목
  - 상세: 이 레포는 의미 있는 동작 변경마다 `## Unreleased — ...` 항목을 추가하는 관례가 매우 엄격하게
    지켜지고 있다(직전 10여 개 커밋 모두 SoT 포함 상세 항목 보유). 본 diff 가 구현하는 F-2 는 같은 plan
    (`eia-command-waiting-surface-guard`)의 F-1 로 이미 CHANGELOG 에 등재돼 있는데, 그 기존 문구가
    "chat-channel in-process forwarding 은 대기 표면을 모른 채 명령을 고정 매핑하므로 `STATE_MISMATCH`
    를 **warn 로그와 함께 삼킨다**" 라고만 서술한다. F-2 는 여기에 `sendSurfaceMismatchNotice` 사용자
    안내 발송을 추가했으므로, 이 문장은 이제 실제 동작보다 뒤처진(stale) 서술이 됐다. 이번 payload 에
    `CHANGELOG.md` 변경이 포함돼 있지 않아, 별도 갱신 없이 머지되면 이 문서만 F-1 상태로 고정된다.
  - 제안: 기존 항목에 F-2 서술("STATE_MISMATCH 는 이제 warn 로그 + `languageHints.surfaceMismatch`
    best-effort 안내를 함께 발송한다")을 추가하거나, F-2 전용 `## Unreleased — ...` 신규 항목을 만들어
    SoT(`spec/5-system/15-chat-channel.md` §4.1.1, plan 파일)를 링크한다.

- **[WARNING]** Telegram provider spec 에 `surfaceMismatch` 의 "비-escape" 예외가 문서화되지 않음
  - 위치: `spec/4-nodes/7-trigger/providers/telegram.md` (§5.6/§5.7 인근, 리뷰 대상 diff 에는 미포함)
  - 상세: 이 파일은 `execution.failed`(§5.6)·`sessionExpired`(§5.7) 등 봇이 사용자에게 보내는 다른 모든
    안내에 대해 "**MarkdownV2 escape 적용**"이라고 명시적으로 못박는다(175·190행). 그런데 F-2 의
    `surfaceMismatch` 는 코드/JSDoc(`language-hint-defaults.ts`, `hooks.service.ts`)과
    `spec/5-system/15-chat-channel.md` 의 Rationale 성격 문단에서 반복 강조하듯 **정확히 반대로
    escape 를 거치지 않고 raw 로 발송**된다 — 이 파일이 다루는 모든 provider-매핑 표의 관례를
    깨는 유일한 예외인데, `telegram.md` 자체에는 이 사실이 전혀 반영돼 있지 않다. 향후 누군가 "다른
    안내처럼 escape 를 적용해야 하는 것 아닌가"라고 판단해 되돌리면, 바로 이 기능이 막으려던 telegram
    400 거부·안내 유실 버그가 재발한다.
  - 제안: §5.6/§5.7 과 나란히 `surfaceMismatch` 항목(또는 §5.7 뒤에 §5.8)을 추가해 "MarkdownV2 escape
    미적용(raw 발송) — default 문구가 특수문자와 disjoint 이기 때문" 임을 명시한다. 최소한 §6 보안
    또는 §5.6 상단의 안내 문구에 한 줄 각주로라도 남기는 것을 권장.

- **[INFO]** `language-hint-defaults.ts` 모듈 상단 SoT 주석의 "12 문구 표" 카운트가 최신 키 목록과
  어긋날 가능성
  - 위치: `codebase/backend/src/modules/chat-channel/shared/language-hint-defaults.ts` 11~22행
    (본 diff 로 수정되지 않은 기존 블록)
  - 상세: 파일 최상단 docblock 이 `spec/5-system/15-chat-channel.md §4.1.1 (KO/EN default 12 문구 표)`
    를 SoT 로 인용하는데, 현재 §4.1.1 표에는 `help`/`formOpenLabel`/`sessionExpired`/`surfaceMismatch`
    (신규) + CCH-ERR-* 6종 = 9개 키(× KO/EN)가 있어 "12" 라는 숫자가 정확히 무엇을 가리키는지
    모호하다. 본 PR 이전부터 있던 문제일 수 있으나, 이번에 같은 파일에 새 default 상수를 추가하면서
    이 카운트를 갱신하지 않았다.
  - 제안: 우선순위는 낮음 — 다음에 이 블록을 만질 때 "12" 를 구체적 키 목록 또는 "CCH-ERR-* 6키" 로
    한정하는 문구로 정정 권장.

- **[INFO]** Slack / Discord 채널 문서에는 `sessionExpired`/`surfaceMismatch` 커스터마이즈 절이 없음
    (기존 패턴 — 이번 diff 의 신규 회귀 아님)
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/{slack,discord}.mdx` §6/§7
    "안내 메시지 커스터마이즈"
  - 상세: `HooksService.forwardToInteractionService`/`sendSurfaceMismatchNotice` 는 provider 에 무관하게
    (`adapter.sendMessage` 를 통해) 동작하므로, Slack·Discord 채널에서도 표면 불일치 시 동일하게
    `surfaceMismatch` 안내가 발송된다. 그러나 slack.mdx/discord.mdx 의 "안내 메시지 커스터마이즈"
    절은 `executionFailed*` 6키까지만 문서화하고 있고, `sessionExpired`(이전 기능)조차 문서화돼 있지
    않다 — 즉 이 diff 가 새로 만든 격차가 아니라 기존에 이미 있던 격차를 그대로 유지한 것뿐이다.
    telegram.mdx/telegram.en.mdx 만 최신 키 목록과 동기화돼 있다.
  - 제안: 이번 PR 스코프로 강제할 필요는 없으나, Slack/Discord 문서에 `sessionExpired`+`surfaceMismatch`
    절을 일괄 backfill 하는 후속 문서 작업을 백로그에 남기는 것을 권장.

## 평가 (긍정 요소)

- `language-hint-defaults.ts` 의 `SURFACE_MISMATCH_DEFAULTS`/`resolveSurfaceMismatchMessage` JSDoc 은
  단순 설명을 넘어 "왜 MarkdownV2 특수문자를 배제해야 하는가"(control-plane 발송 경로 vs EIA event 렌더
  경로의 escape 비대칭)까지 근거를 상세히 남겨, 코드만 봐서는 알기 어려운 설계 의도를 잘 보존한다.
- `hooks.service.ts` 의 `forwardToInteractionService` 기존 JSDoc 을 "후속 항목" 문구에서 F-2 구현 반영
  문구로 정확히 갱신했다 — 오래된 주석(stale comment) 없이 코드와 문서가 일치한다.
- 테스트(`language-hint-defaults.spec.ts`, `hooks.service.spec.ts`) 모두 describe/it 이름에 spec 조항
  번호(§4.1.1, F-2)와 의도를 명시하고, `MD_V2_SPECIALS` 정규식으로 "향후 default 문구가 실수로
  특수문자를 포함하면 테스트가 즉시 잡는다"는 회귀 가드까지 마련했다.
- `telegram.mdx`/`telegram.en.mdx` 는 KO/EN 두 언어 문서가 구조·순서·내용까지 완전히 대칭으로
  갱신됐고, `spec/5-system/15-chat-channel.md` 는 JSON 예시·표·서술 문단 3곳 모두를 갱신하며
  cross-reference(§7.5.1 publisher 사전 검증, CCH-ERR-04)까지 정확히 연결했다.

## 요약

기능 자체의 1차 문서화(JSDoc, 테스트 설명, 시스템 spec, 사용자 가이드 KO/EN)는 이례적으로 꼼꼼하고
정확하며 stale 주석도 없다. 다만 레포가 강하게 지키는 두 가지 2차 문서화 규약에서 공백이 있다:
(1) 같은 plan 의 기존 CHANGELOG 항목이 F-2 반영 없이 "로그만 남기고 삼킨다"는 낡은 서술로 남아 있고,
(2) Telegram provider spec(`providers/telegram.md`)에는 이 기능의 가장 위험한 특성 — 다른 모든 안내와
반대로 escape 를 적용하지 않는다는 사실 — 이 전혀 기록돼 있지 않아 향후 "일관성 있게 고친다"는 명목의
회귀 위험이 남는다. 나머지(Slack/Discord 문서 공백, SoT 카운트 문구)는 기존부터 있던 경미한 격차다.

## 위험도

MEDIUM
