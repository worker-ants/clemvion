# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `chat-channel-input-rules.ts` 는 입력 검증(`assertChatChannelInputSafe` 등)과 출력
  에러 변환(`translateSetupChannelError`)이라는 서로 다른 책임을 여전히 한 파일에 갖는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (헤더 주석
    `// **입력만 있는 파일이 아니다**` 블록) · `translateSetupChannelError` 함수 정의부.
  - 상세: 이번 diff 는 새 결함이 아니라 그 사실을 헤더 주석으로 **의도적으로 명문화**했다
    (plan §설계 판단 (2) — 분리는 `15-chat-channel.md §7` 파일 트리를 손대야 하는 planner 축
    결정이라 이번 developer 턴에서는 보류). SRP 관점에서는 여전히 두 책임이 섞여 있지만,
    분리 비용·권한 경계를 근거로 명시적으로 유예한 상태이고 트래커에도 등재돼 있어 재지적할
    필요는 낮다.
  - 제안: 조치 불요 — 이미 트래커의 planner 항목으로 추적 중. 그 항목이 집행될 때 이 파일도
    함께 쪼갤 것.

- **[INFO]** `TriggersController.rotateBotToken` 의 반환 타입 `Promise<ChatChannelRotateBotTokenDto>`
  는 컴파일 타임 구조적 계약일 뿐, 런타임에 `plainToInstance` 등으로 실제 DTO 인스턴스를
  생성/검증하지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 시그니처
    (반환 타입 주석 바로 위 줄들) 및 `return this.triggersService.rotateBotToken(...)` 문.
  - 상세: `TriggersService.rotateBotToken()` 이 돌려주는 일반 객체가 구조적으로
    `ChatChannelRotateBotTokenDto` 와 호환되므로 `tsc` 는 필드 이름·타입 불일치를 잡아준다(이번
    PR 의 의도이자 실제 효과 — 서비스 반환 타입을 `NonNullable<ChatChannelConfig['botIdentity']>`
    로 domain 타입에 고정한 것과 맞물려 잘 작동한다). 다만 이것은 **구조적 타입 검사**이지
    `TransformInterceptor` 가 실제로 DTO 클래스 인스턴스화·화이트리스트 strip 을 수행하는 것은
    아니다(이미 이 저장소가 "response-contract 런타임 배선 부재, 60개 엔드포인트 중 4개만 배선"
    으로 알고 있는 전역 갭이며 이번 PR 이 새로 만든 결함은 아니다).
  - 제안: 조치 불요(기존에 인지된 저장소 전역 갭). 다만 다음에 `response-contract` 런타임
    배선을 넓힐 때 이 엔드포인트도 후보에 포함할 것.

- **[INFO]** `botIdentity` 개념이 세 곳에서 독립적으로 선언되어 있다 — 도메인 타입
  (`ChatChannelConfig['botIdentity']`, `chat-channel/types.ts`), 입력 DTO
  (`ChatChannelBotIdentityDto`, `dto/chat-channel-config.dto.ts`), 응답 DTO
  (`ChatChannelRotateBotIdentityDto`, 신규 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`).
  - 위치: 위 세 파일의 각 클래스/인터페이스 선언부.
  - 상세: 이 자체는 계약이 서로 다르다는 명확한 근거(입력=optional·클라이언트 제공,
    응답=필수 필드+provider 별 부가 필드)와 저장소 선례(`TriggerWorkflowRefDto` vs
    `ScheduleTriggerWorkflowRefDto`)를 diff 헤더 주석에 명시적으로 남겨 뒀고, 서비스 반환
    타입을 도메인 타입에 직접 고정(`NonNullable<ChatChannelConfig['botIdentity']>`)해 두
    선언 중 적어도 하나는 손으로 다시 적지 않도록 만들었다. 레이어 분리 원칙(입력 계층/도메인
    계층/응답 계층)에 부합하는 의도된 구조이며 새 결함으로 보지 않는다.
  - 제안: 조치 불요. 다만 응답 DTO(`ChatChannelRotateBotIdentityDto`)의 필드가 셋째 표현이므로,
    도메인 타입에 필드가 추가될 때(예: 4번째 provider 부가 필드) 응답 DTO 도 손으로 따라가야
    한다는 사실을 계속 인지하고 있을 것 — `dto-jsdoc-citation`/`swagger-dto-contract` 같은
    기존 정적 가드가 이 드리프트의 일부(필수/optional·null 축)는 잡지만 "새 필드 추가 누락"
    자체는 정적 가드 대상이 아니다.

- **[INFO]** 신규 `dto-class-name-collision` 가드(`repo-guards/__tests__/dto-class-name-collision-guard.ts`
  + `.spec.ts` + fixtures 3개)는 이번 PR 이 스스로 만들었다가 리뷰에서 잡힌 스키마 이름 충돌
  (CRITICAL, `ChatChannelBotIdentityDto` 재사용)을 회귀 방지용 정적 검사로 승격한 것이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`,
    `dto-class-name-collision.spec.ts`.
  - 상세: 기존 형제 가드들(`dto-jsdoc-citation-guard.ts`, `swagger-dto-contract-guard.ts`)과
    동일한 "순수 로직 파일 + 소비 spec 파일" 분리 관례, AST(정본 파서) 기반 스캔, 대조군(decoy)
    fixture 를 통한 vacuous-test 방지까지 기존 컨벤션을 정확히 따른다. 모듈 경계·응집도
    관점에서 잘 맞는 추가다 — 이번 PR 이 만든 결함을 "1회성 grep 스크립트"로 확인만 하고
    끝내지 않고, 저장소가 계속 지니는 자산으로 전환한 점은 아키텍처 위생 측면에서 긍정적이다.
  - 제안: 없음(긍정적 관찰).

## 요약

이번 diff 는 (1) `chat-channel-input-rules.ts`/`.spec.ts` 의 순수 구조 정리(에러 봉투 헬퍼화,
이중 캐스팅 제거, stale 주석 정정), (2) `rotateBotToken` 엔드포인트의 swagger 응답 계약 보강
(신규 `ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto`, 서비스 반환 타입을
도메인 타입에 고정), (3) 이전 라운드가 잡은 DTO 클래스명 충돌 CRITICAL 을 영구적인 정적 가드로
전환하는 작업으로 구성된다. 모듈 경계는 이미 이전 커밋들(#1319/#1320)이 정리해 둔 대로 잘 지켜진다
— 입력 규칙은 외부 협력자 0개인 순수 함수 모듈로 남아 있고, 신규 응답 DTO 는 기존 `dto/responses/`
관례와 `entities/trigger.entity.ts` import 패턴을 그대로 따르며, 새 가드는 `repo-guards/__tests__`
의 기존 순수-로직/spec 분리·AST-우선 관례를 정확히 재사용한다. 순환 의존성이나 레이어 침범은
발견되지 않았고, DTO 이름 충돌이라는 이번 PR 자신의 CRITICAL 결함(이전 라운드에서 이미 개명으로
수정됨)을 재발 방지 가드로 승격한 점은 구조적으로 바람직하다. 남은 관찰(입력/출력 책임 분리 보류,
런타임 DTO 계약 미배선, botIdentity 3중 선언)은 전부 이미 트래커에 등재되었거나 저장소 전역에서
이미 인지된 갭이며 이번 diff 가 새로 만든 아키텍처 결함은 없다.

## 위험도

NONE
