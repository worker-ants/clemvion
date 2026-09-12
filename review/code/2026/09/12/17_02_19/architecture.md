# 아키텍처(Architecture) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 3 / 17_02_19)

## 점검 방법

`chat-channel-input-rules.ts`(전체 `Read`) · `chat-channel-input-rules.spec.ts` ·
`chat-channel-rejection-messages.const.ts` · `dto/chat-channel-config.dto.ts` ·
`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(신규) ·
`dto/trigger-dto-validation.spec.ts` · `triggers.controller.ts` · `triggers.service.ts`(981-1123행
부근) 를 직접 열어 대조했다. 이전 두 라운드(`16_17_57` CRITICAL 1·WARNING 3 → `16_39_18`
WARNING 3)의 `RESOLUTION.md`/`api_contract.md`/`documentation.md` 를 읽고, 그 조치가 **현재
워킹트리에 실제로 반영돼 있는지** 를 재검증했다(문서 주장을 그대로 받지 않음):

- `grep -n "class ChatChannelBotIdentityDto\|class ChatChannelRotateBotIdentityDto"` →
  `dto/chat-channel-config.dto.ts:149` (`ChatChannelBotIdentityDto`, 입력용) vs
  `dto/responses/chat-channel-rotate-bot-token-response.dto.ts:35`
  (`ChatChannelRotateBotIdentityDto`, 응답용) — **이름 분리 확인**.
- `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 가 `swagger.md §5-1` 관례대로
  실제로 `dto/responses/` 아래에 위치함을 확인 (이전 라운드 WARNING1 의 파일 이동 반영).
- `triggers.service.ts:994` 의 반환 타입이 `NonNullable<ChatChannelConfig['botIdentity']> | null`
  로 SoT(`ChatChannelConfig`)를 직접 참조함을 확인 — 손으로 다시 적은 리터럴 타입이 아님.
- `entities/trigger.entity.ts` 의 import 를 확인해 신규 응답 DTO → 엔티티 → 응답 DTO 순환
  import 가 없음을 확인.

## 발견사항

- **[INFO]** `chat-channel-input-rules.ts` 는 여전히 **입력 검증 도메인 규칙**과 **출력 에러
  변환**(`translateSetupChannelError`)이라는 서로 다른 두 책임을 한 파일에 가진다 — 파일을
  변경할 이유가 최소 두 축(입력 스펙 변경 vs 출력 계약 변경)이라 SRP 관점에서 완전하지 않다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — 헤더 주석
    34-39행(책임 두 개를 명시적으로 인정), `translateSetupChannelError` 함수 329-348행.
  - 상세: 이번 diff 가 만든 상태가 아니라 헤더 주석을 **넓혀서 두 책임을 명시**했을 뿐이다.
    분리를 미룬 근거(`plan/in-progress/chat-channel-rules-cleanup.md` §설계 판단 (2))는
    타당하다 — 분리하려면 `spec/5-system/15-chat-channel.md §7` 파일 트리 편집이 필요하고
    그건 developer 권한 밖(planner 축)이라, 이번 턴에 억지로 쪼개면 없는 필요를 만들어
    `ESCALATE=spec` 를 부른다. 다만 두 함수가 공유하는 것은 "같은 도메인(chat-channel)"·
    "같은 에러 봉투 형태" 뿐이고, 협력자(collaborator)는 완전히 다르다(입력측은 DTO 타입만,
    출력측은 adapter 에러 판별 로직만 본다) — 응집도가 이름(파일)만으로 유지되고 있어
    파일이 더 커지면 "입력 규칙 파일"이라는 이름이 오독을 유발할 위험이 남는다.
  - 제안: 조치 불요(이미 planner 축 트래커 항목 존재, 이번 PR 스코프 아님). 다음에 이 파일에
    입력 규칙이 하나 더 늘어나는 시점을 분리 트리거로 삼을 것을 권장(현재 파일 크기가
    아직 350행 내외라 급하지 않음).

- **[INFO]** 컨트롤러 반환 타입이 명목상 DTO 클래스이지만 실제로는 class-transformer 를 거치지
  않은 plain object 라 계층 간 계약이 컴파일 타임에만 강제된다(런타임 검증 없음).
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` —
    `rotateBotToken(...): Promise<ChatChannelRotateBotTokenDto>` 시그니처.
    `codebase/backend/src/modules/triggers/triggers.service.ts:986-1123` — `rotateBotToken` 의
    실제 반환문(리터럴 object, `new ChatChannelRotateBotTokenDto()` 아님).
  - 상세: 이번 diff 는 `Awaited<ReturnType<...>>` 을 명시적 DTO 타입으로 바꿔 **구조적으로는**
    타입 드리프트를 `tsc` 가 잡게 만들었다(좋은 방향, 아래 "확인했으나 문제 없음" 참고).
    다만 이 계약은 여전히 컴파일 타임 구조적 타이핑에만 의존한다 — `TransformInterceptor`
    (`common/interceptors/transform.interceptor.ts`)가 `{ data }` 로 감싸기만 하고 DTO 인스턴스
    변환/필드 화이트리스트를 하지 않으므로, 서비스가 DTO 에 없는 여분 필드를 반환값에 얹어도
    런타임에서는 그대로 새어 나간다. 이는 이 PR 이 만든 결함이 아니라 저장소 전역 패턴(같은
    세션의 `api_contract.md`/`documentation.md` 가 이미 "response-contract 런타임 배선
    부재(60 중 4 배선)"로 등재)의 연장선이라 이 PR 을 막을 사유는 아니다.
  - 제안: 조치 불요 — 이미 등재된 저장소 전역 갭. 이 엔드포인트만 별도로 `class-transformer`
    강제 변환을 추가하는 것은 오히려 일관성을 깨므로 전역 배선 작업에서 함께 처리 권장.

- **[INFO]** `assertInboundSigningPlaintextByProvider` 는 provider 분기를 `if/else` 사슬로
  하드코딩해 신규 provider 추가 시 OCP(개방-폐쇄) 상 이 함수 본문을 직접 편집해야 한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:262-306`.
  - 상세: 이번 diff 는 이 함수의 분기 로직을 바꾸지 않았다(내부 `throw` 3곳을
    `throwInvalidField` 호출로 치환했을 뿐, 판별 순서·조건은 동일). 함수 자체의 JSDoc
    (256-260행)이 "신규 provider 추가 시 본 함수에 명시적 분기 추가 의무"를 이미 경고해 두어,
    provider 3종이라는 낮은 카디널리티를 고려하면 전략 패턴(provider→validator 매핑 테이블)
    도입보다 지금의 명시적 분기 + 경고 주석이 더 읽기 쉬운 트레이드오프로 보인다 — 새 결함
    아님, 참고 기록.
  - 제안: 조치 불요. Provider 가 4종 이상으로 늘어나는 시점에 lookup 테이블 전환을 고려.

## 확인했으나 문제 없음

- **CRITICAL 재발 없음**: 라운드 1 이 지적한 `ChatChannelBotIdentityDto` 동명 클래스 충돌은
  개명(`ChatChannelRotateBotIdentityDto`) + `dto/responses/` 이동으로 실제 해소돼 있음을
  `grep` 으로 직접 재확인. 두 DTO 는 이름·자리·필드 형태(입력: 전 필드 optional, 응답: `botId`/
  `username` 필수 + `teamId`/`publicKey` optional) 모두 명확히 분리돼 있어 "같은 개념을 다른
  계약으로 보는 두 클래스는 합치지 않는다"(선례: `TriggerWorkflowRefDto` vs
  `ScheduleTriggerWorkflowRefDto`)는 이 저장소의 기존 설계 결정과 일관된다.
- **모듈 경계**: `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 가 여는 것은
  `entities/trigger.entity.ts` 의 타입 하나(`TriggerChatChannelHealth`)뿐이고, 엔티티 쪽은
  DTO 를 import 하지 않아 순환 의존성 없음.
  `chat-channel-input-rules.ts` ↔ `dto/chat-channel-config.dto.ts` 사이도 단방향(rules 가 DTO
  타입만 import)이라 순환 없음.
- **DIP/추상화 수준**: `hasField`/`throwInvalidField`/`rejectBlockedField` 3단 헬퍼 추출은
  적절한 추상화 계층이다 — `throwInvalidField(field: string, ...)` 가 넓은 `string` 을 받는
  것은 결함이 아니라 **의도된 일반화**다. 이 함수는 `rejectBlockedField` 의 5개 차단 필드뿐
  아니라 `chatChannel`/`provider` 처럼 차단 필드 유니언 밖의 이름도 받아야 하므로(210-227행
  `assertChatChannelAlreadySetUp`), 인자를 `ChatChannelBlockedField` 로 좁히면 오히려 그 두
  호출부가 깨진다. 반대로 `rejectBlockedField` 는 정확히 `ChatChannelBlockedField` 로 좁혀
  타입 안전을 얻는다 — 두 헬퍼가 서로 다른 일반성 레벨에 있는 것이 옳은 설계다.
- **오버로드에 의한 LSP/불변식 강제**: `assertChatChannelInputSafe` 의 `mode`↔DTO 타입 오버로드
  쌍(147-158행)은 문자열 판별자만 쓰는 것보다 강한 컴파일 타임 보장을 준다 — `mode:'update'`
  호출에 생성 전용 DTO 를 넘기는 짝 깨짐을 타입 에러로 만든다. 이는 §5.4.1 의 "두 경로 요구가
  정반대"라는 도메인 불변식을 타입 시스템으로 인코딩한 좋은 사례다.
- **SoT 일원화**: `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES: Record<ChatChannelBlockedField, string>`
  가 배열→타입→메시지 매핑을 양방향으로 컴파일러가 검증하게 만들어(누락·초과 둘 다 에러),
  이전의 `satisfies` 패턴이 갖던 편도 검증 갭을 없앴다. `triggers.service.ts` 의 반환 타입도
  `ChatChannelConfig['botIdentity']` 를 재참조해 같은 형태를 두 곳에 손으로 적는 문제를
  구조적으로 제거했다 — 둘 다 "정의를 한 곳에 둔다"는 이 세션의 반복 원칙과 일치한다.
- **레이어 책임**: 컨트롤러는 인증/요청 파싱/swagger 문서화만, 서비스는 오케스트레이션(secret
  rotate·adapter 호출·DB 갱신·감사로그), 도메인 규칙 파일은 순수 검증/변환만 — 이번 diff 가
  그 경계를 넘나드는 로직을 추가하지 않았다.

## 요약

이번 diff 는 `chat-channel-input-rules.ts` 의 반복 에러 봉투 생성을 `throwInvalidField`/
`hasField`/`rejectBlockedField` 세 헬퍼로 추출하고, `mode`/DTO 오버로드로 도메인 불변식을
타입 레벨에 인코딩했으며, `rotateBotToken` 응답을 위해 입력 DTO 와 명확히 분리된 응답 DTO
(`ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto`)를 `swagger.md` 관례 자리에
신설했다. 이전 두 라운드가 낸 CRITICAL(스키마 이름 충돌)·WARNING(문서-응답 간극·규약 위반
파일 위치)은 이번 워킹트리 상태를 직접 열어 재확인한 결과 실제로 해소돼 있다. 순환 의존성·
레이어 침범·불필요한 추상화는 발견되지 않았고, 헬퍼 추출은 단일 책임·정보 은닉 원칙에
부합한다. 유일하게 남는 구조적 관찰은 이 파일이 여전히 입력 검증과 출력 변환이라는 두 책임을
갖는다는 점인데, 이는 이 PR 이 만든 문제가 아니라 spec 파일 트리 편집 권한(planner 축) 제약
때문에 의도적으로 유예된 것이고 그 근거가 plan 문서에 명시돼 있어 이번 PR 을 막을 사유가
아니다. 새로운 CRITICAL/WARNING 급 아키텍처 결함은 발견하지 못했다.

## 위험도

LOW
