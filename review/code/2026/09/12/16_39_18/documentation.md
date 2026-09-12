# 문서화(Documentation) Review — chat-channel-rules-cleanup (round 16_39_18)

## 검토 방법

`codebase/backend/src/modules/triggers/{chat-channel-input-rules.ts,chat-channel-input-rules.spec.ts,
chat-channel-rejection-messages.const.ts,triggers.controller.ts,triggers.service.ts,
dto/chat-channel-config.dto.ts,dto/chat-channel-rotate-bot-token.dto.ts,
dto/trigger-dto-validation.spec.ts}` 를 `Read` 로 전체 열어 diff 뿐 아니라 파일 전체 맥락에서
JSDoc·인라인 주석과 실제 코드를 대조했다. `plan/in-progress/chat-channel-rules-cleanup.md` ·
`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 서술도 실제 코드 상태와 대조했다.
`spec/5-system/15-chat-channel.md` 에서 R-CC-21·R-CC-22·R-CC-23 인용이 실재함을 grep 으로 확인했다.
`npx tsc -p tsconfig.json --noEmit | grep -c "error TS"` 로 "197건" 주장을 재현해 정확히 일치함을
확인했다. 저장소 파일은 쓰지 않았다(`Read`/`Bash` grep·tsc 조회만).

**관측된 이상 상태(내가 만들지 않음)**: 리뷰 도중 `git status --short` 가
`M codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 를 보였다. `git diff` 로
확인한 내용은 `hasField` 의 `typeof … !== 'undefined'` 를 `!!value` 로 바꾸는 뮤턴트였다 —
정확히 이 PR 의 RESOLUTION.md/testing.md 가 서술하는 "W3 이 막은 뮤턴트" 그 자체다. 세션 시작
직후 `Read` 로 열었을 때는 원본(`typeof … !== 'undefined'`)이었으므로, 이 변경은 세션 중 **다른
병렬 reviewer** 가 만든 것으로 보인다. 프로토콜에 따라 되돌리지 않았다 — 이 상태를 진짜 결함으로
오인하지 말 것.

## 발견사항

- **[WARNING]** plan 문서 안에서 뮤테이션 개수가 두 가지로 다르게 서술된다 — "3종" vs "5종"
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md` — "## 증거" 섹션(3개 뮤턴트만 나열),
    "## 체크리스트" 의 `뮤테이션 3종` 항목, vs "## 실측 기록 — 뮤테이션 5종 (예측/실측)" 섹션
    제목과 그 아래 5행 표
  - 상세: "증거" 섹션은 착수 전에 쓴 예고문으로 `details.code` 제거·`field` 고정·label 스왑
    3종만 든다. 그런데 실제로 실행하고 기록한 "실측 기록" 표는 제목부터 **"5종"** 이고 행도
    5개다 — 4번째(차단 필드 메시지 고정)와 5번째(`incoming.provider &&` 제거, 의도적으로
    GREEN 이 정상인 네거티브 컨트롤)가 추가로 들어갔다. "체크리스트" 는 이 확장을 반영하지
    않고 여전히 "뮤테이션 **3종**" 이라 적는다. 이 문서 하나 안에서 같은 작업 항목을 가리키는
    세 자리(증거/체크리스트/실측 기록) 중 두 곳이 실제 수행 내역보다 좁다 — 다음 사람이
    "체크리스트" 만 보고 재현하면 4번·5번(특히 5번째 "GREEN 이 정상" 인 네거티브 컨트롤, §설계
    판단 (3) 의 핵심 증거)을 빠뜨린다.
  - 제안: "체크리스트" 의 `뮤테이션 3종` 을 `뮤테이션 5종`(또는 "5종 — §설계 판단 (3) 의
    네거티브 컨트롤 1건 포함")으로 정정하고, "증거" 섹션도 4·5번을 추가하거나 "실측 기록" 표를
    가리키도록 넓힌다.

- **[INFO]** plan 체크리스트가 전부 미체크 상태인데, 같은 파일 본문은 해당 작업들이 이미
  수행·검증됐음을 구체적 실측으로 기록하고 있다
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md` "## 체크리스트" (전 항목 `- [ ]`)
    vs "## 작업" 표(1~6번, 이번 diff 의 코드 변경과 1:1 대응 확인됨) · "## 실측 기록"(5/5 뮤턴트
    실행 완료) · `review/code/2026/09/12/16_17_57/RESOLUTION.md`("run-test-all: ALL PASS —
    조치 후 재실행")
  - 상세: 작업 1~6 은 이 diff 의 `chat-channel-input-rules.ts`/`triggers.controller.ts` 등
    변경으로 실제 반영돼 있고, 뮤테이션 5종도 결과까지 표에 적혀 있다. 그런데 체크리스트의
    `1~4`·`5`·`6`·`뮤테이션 3종`·`run-test-all.sh 4단계` 항목은 전부 `[ ]` 다. 프로젝트 관례
    ("plan 체크박스 = 실제 상태 — 수행 후에만 체크")를 따르면 이 시점에 이미 체크됐어야 할
    항목들이다. 이번 라운드가 아직 수렴 전(추가 라운드 가능성)이라 최종 커밋 전에 정리될
    여지는 있으나, 현재 diff 스냅샷만 보면 본문과 체크리스트가 서로 다른 완료 상태를 말하고
    있다.
  - 제안: 이 세션이 수렴("`codebase/**` 수정 0" 라운드)하는 시점에 체크리스트를 실제 완료
    상태로 갱신하고 `plan/complete/` 이동과 함께 마무리할 것 — plan 자체의 "정지 규칙" 이
    이미 그 절차를 명시하고 있으므로 새 규칙을 만들 필요는 없다.

## 확인했으나 문제 없음 (전회 라운드 지적사항의 해소 검증)

이전 라운드(`16_17_57`)의 documentation/api_contract CRITICAL 1건·WARNING 2건이 이번 diff 에서
전부 해소됐음을 diff 가 아니라 **현재 파일 전체**를 직접 읽어 확인했다:

- **C1 (클래스명 충돌)** — 신규 DTO 클래스가 `ChatChannelRotateBotIdentityDto` 로 개명돼
  `chat-channel-config.dto.ts` 의 `ChatChannelBotIdentityDto` 와 더 이상 충돌하지 않는다
  (`dto/chat-channel-rotate-bot-token.dto.ts:30`). 파일 헤더 주석이 왜 이름이 달라야 하는지,
  왜 합치지 않는지(입력 검증 DTO vs 응답 DTO, 필수/옵셔널 축이 다름) 근거를 구체적으로 남겼고
  저장소 내 선례(`TriggerWorkflowRefDto` vs `ScheduleTriggerWorkflowRefDto`)까지 인용한다.
- **W1 (`publicKey` 누락)** — `ChatChannelRotateBotIdentityDto.publicKey?: string` 이 추가됐고
  (`:55-56`), 서비스 반환 타입도 손으로 다시 적지 않고 `NonNullable<ChatChannelConfig['botIdentity']>`
  로 SoT 를 한 곳(`chat-channel/types.ts:55-61`)에 모았다(`triggers.service.ts:997`). 실제 반환문
  `mergedChannel.botIdentity ?? null`(`triggers.service.ts:1124`)과 주석의 설명이 일치한다.
- **W2 (`@ApiUnauthorizedResponse` 누락)** — `rotateBotToken` 에 추가돼 컨트롤러의 다른 8개
  메서드와 일관성이 맞다(`triggers.controller.ts:265`).
- **W3 (두-층 등가성 서비스측 미검증)** — `chat-channel-input-rules.spec.ts` 에 `botToken`/
  `inboundSigningPlaintext` 의 `null`/`''` 케이스 4건이 추가됐고, 각 `it.each` 블록의 JSDoc 이
  왜 이 테스트가 필요한지(두-층 설계의 절반이 미고정이었다는 실측 근거)를 정확히 설명한다.
- **INFO(botId 해시 주석)** — `botId` 필드 JSDoc 이 "Slack 만 해시" 에서 "Telegram 만 네이티브
  정수 — Slack·Discord 는 해시" 로 정정됐다(`:32-36`), 어댑터 실제 구현과 일치.
- **stale `TriggersService` 귀속 3곳** — `chat-channel-rejection-messages.const.ts:8-10`,
  `dto/chat-channel-config.dto.ts:36-37`·`:284` 전부 "module-level 함수" 로 정확히 정정됐다.
  `chat-channel-input-rules.ts` 실제로 `export function`(클래스 아님)이라 서술과 일치.
- **신규 헬퍼 JSDoc** (`throwInvalidField`/`hasField`/`rejectBlockedField`) — 실측 근거("11곳"
  "2곳")와 설계 트레이드오프("왜 3번째 인자를 안 두나" "왜 `never` 인가")가 코드로 검증
  가능한 형태로 적혀 있다. `throwInvalidField(field, message)` 시그니처·11곳 치환·`never`
  반환 전부 실제 코드와 일치한다.
- **"`as never` 제거" 주석의 "197건 불변" 주장** — `npx tsc -p tsconfig.json --noEmit | grep -c
  "error TS"` 로 재현해 정확히 197건임을 확인(baseline, 이 파일과 무관한 기존 오류들).
- **spec 인용** (R-CC-21/22/23, §5.4/§5.4.1/§5.4.1.2, §7) — `spec/5-system/15-chat-channel.md`
  에 grep 으로 실재함을 확인. 존재하지 않는 규칙 ID 인용 없음.
- **`OmitType` 기반 "PATCH 에서도 provider 필수" 주장** — `dto/chat-channel-config.dto.ts` 를
  직접 대조해 `OmitType(ChatChannelConfigDto, ['botToken','inboundSigningPlaintext'])` 이
  `provider` 의 `@IsIn(CHAT_CHANNEL_PROVIDERS)` 를 실제로 상속함을 확인 — `chat-channel-input-rules.ts`
  의 "도달 불가" 주석과 `trigger-dto-validation.spec.ts` 신규 테스트의 근거가 vacuous 하지 않다.
- **README/CHANGELOG** — 이번 변경은 내부 리팩터 + 기존 엔드포인트 swagger 보강뿐이라 신규
  공개 기능·설정·환경변수가 없다. 업데이트 필요성 없음(전회 라운드 판단과 동일하게 유지).

## 요약

전회 라운드가 지적한 CRITICAL 1건·WARNING 3건(DTO 클래스명 충돌·`publicKey` 누락·
`@ApiUnauthorizedResponse` 누락·두-층 등가성 서비스측 미검증)이 diff 상의 서술뿐 아니라 실제
파일 상태로도 정확히 해소됐음을 확인했다. 신규/변경 JSDoc 은 실측 근거와 설계 트레이드오프를
구체적으로 남겨 전반적으로 모범적이다. 다만 `plan/in-progress/chat-channel-rules-cleanup.md`
자체의 문서 품질에서 한 가지 실질적 불일치를 발견했다 — 같은 문서 안에서 뮤테이션 개수를
"3종"(증거·체크리스트)과 "5종"(실측 기록)으로 다르게 서술해, 체크리스트만 보고 재현하면 설계
판단 (3)의 핵심 증거인 5번째(네거티브 컨트롤) 뮤턴트를 놓칠 수 있다. 체크리스트 전항목 미체크는
이 라운드가 아직 진행 중일 가능성을 고려하면 낮은 우선순위다. 리뷰 도중 공유 워크트리에서
`hasField` 뮤턴트가 관측됐으나 이는 병렬 reviewer 의 산물로 보이며 이 리포트가 만든 것이 아니다.

## 위험도

LOW
