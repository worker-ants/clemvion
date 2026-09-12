# 문서화(Documentation) Review — chat-channel-rules-cleanup (round 17_02_19)

## 검토 방법

이번 라운드는 3라운드째다(`16_17_57` → `16_39_18` → 이번). 두 RESOLUTION.md(각각 CRITICAL 1·WARNING 3,
WARNING 3 전량 조치)를 먼저 읽어 무엇이 이미 고쳐졌는지 파악한 뒤, 실제 코드 파일 전체
(`chat-channel-input-rules.ts`/`.spec.ts`, `chat-channel-rejection-messages.const.ts`,
`dto/chat-channel-config.dto.ts`, `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`,
`dto/trigger-dto-validation.spec.ts`, `triggers.controller.ts`, `triggers.service.ts`)를 `Read`로
직접 열어 diff 서술과 대조했다. `chat-channel/types.ts`의 `ChatChannelConfig['botIdentity']`,
`discord.adapter.ts`/`slack.adapter.ts`의 `hashStringToInt` 사용, `spec/5-system/15-chat-channel.md`의
`code:` glob, `spec/conventions/swagger.md §5-1`, `spec/2-navigation/2-trigger-list.md`의 `dto/**`
glob, `plan/in-progress/spec-draft-nullable-notation-followups.md`의 해당 트래커 항목을 grep으로
실측 대조했다. 저장소 파일은 쓰지 않았다(Read/Bash grep만 사용, 뮤테이션 없음).

## 발견사항

- **[INFO]** `plan/in-progress/chat-channel-rules-cleanup.md`의 체크리스트가 라운드 3에서도
  여전히 전항목 미체크 상태다
  - 위치: `plan/in-progress/chat-channel-rules-cleanup.md`의 `## 체크리스트` 섹션
    (`- [ ] /consistency-check --impl-prep` 부터 `- [ ] plan/complete/ 이동`까지 전부 `[ ]`,
    `- [x]`는 뮤테이션 6종 한 줄뿐)
  - 상세: 이 항목은 `16_39_18` 라운드의 documentation 리뷰가 이미 INFO로 지적했고("이번
    라운드가 아직 진행 중일 가능성을 고려하면 낮은 우선순위") 그때는 "수렴 시점에 정리"를
    권고했다. 그런데 이번 라운드(17_02_19) 시점까지 실제로는 `1~4`(프로덕션 변경)·`5`(테스트
    보강)·`6`(swagger) 모두 코드에 반영됐고, `run-test-all.sh`도 두 RESOLUTION.md가 각각
    "ALL PASS — 조치 후 재실행"을 기록했으며, `/ai-review`는 이미 두 라운드가 완주했다. 즉
    본문(작업 표·실측 기록·RESOLUTION.md)이 증언하는 완료 상태와 체크리스트가 계속 어긋난 채
    한 라운드를 더 넘겼다. 이 라운드가 "`codebase/**` 수정 0"으로 수렴한다면 그 직후가
    체크리스트를 갱신하고 `plan/complete/`로 옮길 시점이라는 점을 재확인한다.
  - 제안: 이번 라운드가 수렴 판정을 받는 즉시(다른 리뷰어가 CRITICAL/코드 변경을 요구하지
    않는 경우) 체크리스트 전항목을 실제 완료 상태로 갱신하고 `plan/complete/`로 이동할 것.
    새 규칙은 필요 없다 — plan 자신의 "정지 규칙" 섹션이 이미 그 절차를 명시한다.

## 확인했으나 문제 없음 (전회 라운드 지적사항의 해소 검증)

- **뮤테이션 개수 서술 불일치(`16_39_18` WARNING, "3종" vs "5종")** — 완전히 해소됐다.
  `## 증거`("실제로는 여섯을 돌렸다") · `## 체크리스트`("뮤테이션 6종") · `## 실측 기록 —
  뮤테이션 6종 (예측/실측)` 표(6행) 세 자리가 전부 "6종"으로 일치한다.
- **응답 DTO 파일 위치(`16_39_18` W1)** — `dto/chat-channel-rotate-bot-token.dto.ts`(평평한
  자리)에서 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`로 옮겨졌다.
  `swagger.md:387`의 `dto/responses/*-response.dto.ts` 규약과 정확히 일치하는 자리·이름이다.
  `triggers.controller.ts:40`의 import 경로도 새 위치를 정확히 가리킨다.
- **orphan JSDoc(`16_39_18` W3)** — `chat-channel-input-rules.spec.ts`에서 "대칭 필드도
  막는다" 주석(128행 부근)이 새로 삽입된 두 `it.each` 블록 뒤, 원래 자신이 설명하던
  `it('PATCH 는 inboundSigningPlaintext 도 거부한다', …)` 테스트 바로 위로 정확히
  되돌아와 있다. 주석-테스트 인접성이 깨지지 않았다.
- **`15-chat-channel.md` glob 미스매치 서사** — 새 DTO 파일 헤더 주석의 "glob의 `*`는 `/`를
  안 넘어 `responses/` 하위를 못 잡는다"는 주장을 `code:` frontmatter로 직접 대조했다
  (`dto/chat-channel-*.dto.ts`는 실제로 `responses/` 하위에 도달하지 못함, `2-trigger-list.md`의
  `dto/**`는 도달함). "glob을 `dto/**/chat-channel-*.dto.ts`로 넓힌다"는 planner 트래커
  항목도 `spec-draft-nullable-notation-followups.md:3057-3068`에 실재한다.
- **C1(클래스명 충돌)·W1(`publicKey` 누락)·W2(`@ApiUnauthorizedResponse` 누락) — `16_17_57`
  라운드 지적** — 전부 유지된 채 해소돼 있다. `ChatChannelRotateBotIdentityDto`로 개명,
  서비스 반환 타입이 `NonNullable<ChatChannelConfig['botIdentity']>`로 `types.ts:55-61`의
  실제 필드(`botId`/`username`/`teamId?`/`publicKey?`)와 정확히 일치, 컨트롤러에
  `@ApiUnauthorizedResponse({ description: '인증 실패' })`가 다른 8개 메서드와 같은 문구로
  추가돼 있다.
- **`botId` 해시 서술 정정** — "Telegram만 네이티브 정수 — Slack·Discord는 `hashStringToInt`로
  해시"라는 서술이 `discord.adapter.ts:158`·`slack.adapter.ts:114`의 실제 `hashStringToInt`
  호출과 정확히 일치한다.
- **`chat-channel-input-rules.ts`의 신규 헬퍼(`throwInvalidField`/`hasField`/
  `rejectBlockedField`) JSDoc** — 실측 근거("11곳"/"2곳")·설계 이유(3번째 인자를 안 두는
  이유, `never` 반환 이유)가 코드로 검증 가능한 구체적 형태로 남아 있다.
  `incoming.provider &&` falsy-guard에 대한 "HTTP 경로에서는 도달 불가" 서술도
  `dto/chat-channel-config.dto.ts`의 `OmitType(ChatChannelConfigDto, ['botToken',
  'inboundSigningPlaintext'])`를 직접 대조해 근거가 성립함을 확인했고, 그 주장을 고정하는
  `trigger-dto-validation.spec.ts`의 신규 `it.each`(provider 미지정/빈 문자열)도 실제로
  `chatChannel.provider` 필드를 단언해 vacuous하지 않다.
- **stale `TriggersService` 귀속 주석 정정** — `chat-channel-rejection-messages.const.ts:8-10`,
  `dto/chat-channel-config.dto.ts:36-37,283-284` 모두 "module-level 함수"로 정확히 정정됐고,
  남아 있는 `TriggersService` 언급(예: 헤더의 "TriggersService 에서 떼어낸")은 전부 이력·호출
  관계 서술이라 stale이 아니다.
- **README/CHANGELOG** — 내부 리팩터 + 기존 엔드포인트의 swagger 응답 문서 보강뿐이며 신규
  공개 기능·환경변수·설정이 없어 업데이트 필요성 없음(전회 판단과 동일하게 유지).

## 요약

3라운드에 걸쳐 CRITICAL 1건·WARNING 6건이 순차적으로 조치됐고, 이번 라운드에서 실제 파일
전체를 직접 열어 대조한 결과 전부 실측으로 확인된 대로 정확히 해소돼 있다 — DTO 클래스명 개명,
`publicKey` 필드 추가와 반환 타입 SoT 단일화, `@ApiUnauthorizedResponse` 추가, 응답 DTO 파일을
`swagger.md` 규약 자리로 재배치, orphan JSDoc 복원, 뮤테이션 개수 서술 통일까지 모두 코드·spec과
정합한다. 새 헬퍼·테스트의 JSDoc은 실측 근거와 설계 트레이드오프를 구체적으로 남겨 문서화
품질이 높다. 유일하게 남은 것은 `plan/in-progress/chat-channel-rules-cleanup.md`의 체크리스트가
본문이 증언하는 완료 상태를 아직 반영하지 않은 점인데, 이는 이전 라운드에서도 INFO로 지적된
바 있고 "라운드 수렴 시 정리"라는 plan 자신의 정지 규칙으로 이미 처리 경로가 정해져 있어
차단 사유는 아니다.

## 위험도

NONE
