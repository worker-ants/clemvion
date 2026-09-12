# 테스트(Testing) 코드 리뷰

## 검토 범위 및 검증 방법

`chat-channel-input-rules.{ts,spec.ts}` 리팩터, `dto/trigger-dto-validation.spec.ts` 신규 케이스,
신규 응답 DTO(`dto/responses/chat-channel-rotate-bot-token-response.dto.ts`) + 컨트롤러/서비스
타입 강화, 신규 `dto-class-name-collision` 가드(+대조군)를 검토했다. 저장소를 실제로 뮤테이션해
가설을 검증했다 — 절차:

- `hasField` 의 `typeof … !== 'undefined'` → `!!value` 뮤턴트를 스크래치 사본으로 백업 후 저장소
  파일에 적용 → `jest chat-channel-input-rules.spec.ts` 실행 → **4건 RED** 확인(`PATCH 는 null/빈
  문자열로 보낸 botToken`·`inboundSigningPlaintext` 각 2건) → `cp` 로 즉시 원복,
  `git status --short` 로 클린 확인 완료(diff 없음). `RESOLUTION.md` 가 주장한 "조치 전 아무
  테스트도 안 깨졌다 → 조치 후 14건 RED" 중 이 파일이 담당하는 4건이 실측과 일치함을 직접
  확인했다.
- `dto-class-name-collision` 가드의 스캔 범위 주장("`*.dto.ts` 114개가 `modules/`(111)·
  `common/`(3)에만 있다")을 `find src -name '*.dto.ts'` 로 재실측 — 정확히 일치(`repo-guards/`
  3개는 가드 자신의 fixture/guard 파일이라 스캔 대상에서 의도적으로 제외됨을 확인).
- `npx jest src/modules/triggers` 전체 재실행 — 9 suites, 273 passed / 1 skipped (RESOLUTION.md
  수치와 일치).

## 발견사항

- **[WARNING]** 이번 PR이 고친 "선언이 실제 반환보다 좁다" 결함(Discord `botIdentity.publicKey`
  누락)의 재발을 막는 회귀 테스트가 없다 — 타입만 넓혔고 값 전달을 단언하는 테스트는 추가되지
  않았다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rotateBotToken` 반환
    타입 선언, `botIdentity: NonNullable<ChatChannelConfig['botIdentity']> | null`),
    `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`
    (`ChatChannelRotateBotIdentityDto.publicKey`)
  - 상세: `triggers.service.spec.ts` 의 `rotateBotToken` describe (`§5.4 — 성공 응답에 …`,
    `§5.4 — setupChannel 이 botIdentity 미반환 시 …`)는 `botId`/`username` 두 필드만 있는
    fixture 로 성공 케이스와 null 케이스만 본다 — `publicKey` 가 포함된 `configUpdates.botIdentity`
    (Discord 경로)를 넣어 응답에 그대로 실리는지 확인하는 케이스가 이 spec 파일에 없다
    (`grep -n "rotateBotToken\|botIdentity\|publicKey" triggers.service.spec.ts` 로 전수 확인).
    이번 PR 은 타입 애노테이션을 `NonNullable<ChatChannelConfig['botIdentity']>` 로 바꿔 **다음에
    누군가 손으로 형태를 다시 적어 `publicKey` 를 빠뜨리는 것**은 `tsc` 가 막아 주지만, 서비스가
    실제로 그 필드를 스프레드해 전달하는지(런타임 동작)는 여전히 테스트가 아니라 코드 주석의
    주장("mergedChannel.botIdentity 를 그대로 돌려주므로")에만 의존한다. `dto-class-name-collision`
    쪽은 대조군까지 갖춘 견고한 가드를 새로 만들면서, 같은 세션에서 두 reviewer 가 독립적으로
    잡았던 다른 축의 결함(publicKey 누락)에는 상응하는 회귀 테스트를 안 남겼다 — 비대칭이다.
  - 제안: `triggers.service.spec.ts` 의 `rotateBotToken` describe 에 `configUpdates.botIdentity`
    에 `publicKey` 가 포함된 케이스(Discord 시나리오)를 추가해 응답 객체에 그대로 실리는지
    단언할 것. 여력이 되면 `response-contract`(`contractForDto`/`assertMatchesContract`)를 이
    신규 DTO 에 배선해 "선언 vs 실제 반환" 축을 구조적으로 고정하는 편이 이번 PR 이 고친 결함
    클래스와 정확히 대응한다.

- **[INFO]** 신규 응답 DTO(`ChatChannelRotateBotTokenDto`)가 `response-contract` 런타임 검증에
  배선되지 않았다
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`,
    `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken`)
  - 상세: `grep -rln "ChatChannelRotateBotTokenDto\|ChatChannelRotateBotIdentityDto" --include='*.spec.ts'` 결과 0건 —
    이 DTO 를 언급하는 스펙 파일이 전무하다. 저장소 전역에 이미 알려진 갭(응답 DTO 60개 중 4개만
    `response-contract` 배선, `project_response_contract_verifier_and_audit_leak` 참고)의 연장선이라
    이번 PR 이 새로 낸 결함은 아니다. 다만 이 DTO 는 **이번 PR 이 새로 만든 파일**이고, 정확히
    "문서가 실제 응답보다 좁았다" 는 결함을 이미 두 차례(라운드 `16_17_57` 두 reviewer) 겪은
    자리라, 신설 시점에 배선했다면 위 WARNING 이 코드 리뷰가 아니라 테스트 실행으로 잡혔을
    자리다. 조치 불요(스코프 밖)이지만 다음 배선 우선순위 후보로 기록.
  - 제안: 없음(기록만). 배선 우선순위를 매길 때 이 파일을 후보로 고려할 것.

- **[INFO]** 새 가드 테스트(`dto-class-name-collision.spec.ts`)는 대조군·vacuous 방지·AST 오탐
  방지 세 축을 모두 갖춘 견고한 설계다 — 직접 실측으로 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts` (전체),
    `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`
  - 상세: (1) "스캔 대상이 비어 있지 않다" 테스트로 vacuous 통과를 막고, (2) `[대조군]` 두 건이
    판정 함수를 실데이터와 분리해 직접 검증하며, (3) `decoy.dto.ts` fixture 로 정규식이었다면
    속았을 세 형태(주석·문자열·JSDoc 예제 속 `export class`)를 실제로 만들어 AST 파서가 그것들을
    무시함을 증명한다. 스캔 루트(`modules`+`common`)의 완전성 주장("114개 전부 이 두 폴더")도
    `find` 로 직접 재검증해 일치함을 확인했다. 조치 불요 — 긍정적 관찰.

- **[INFO]** `chat-channel-input-rules.spec.ts` 신규 케이스들은 실제로 뮤턴트를 잡는다 —
  `hasField` falsy-판별 뮤턴트로 직접 검증 완료(위 "검증 방법" 참조). PATCH null/빈 문자열
  botToken·inboundSigningPlaintext 4종, `update` 모드 내부 필드 3종 순서 테스트, provider
  label 스왑 검출 테스트 모두 fixture 가 실제로 판별 가능한 값(교차 길이, 서로 다른 label)을
  쓰고 있어 vacuous 하지 않다. `dto/trigger-dto-validation.spec.ts` 의 `provider` 필수 테스트도
  `cardBody` 에서 `provider` 를 명시적으로 destructure 로 제거한 뒤 override 하는 방식이라
  "이미 없는 값을 다시 없앤다"는 vacuous 함정을 피했다.

## 요약

이번 PR의 테스트 변경분은 전반적으로 높은 품질이다 — 새로 추가된 헬퍼(`hasField`)의 판별식
뮤턴트를 실제로 잡는 케이스, `update` 모드 내부 필드 우선순위 테스트, provider label 스왑 검출,
DTO 층 `provider` 필수 고정 테스트를 모두 뮤테이션/대조군 관점에서 검증했고 주장과 실측이
일치했다(4건 RED, 273 passed, 114개 dto.ts 스캔 범위). `dto-class-name-collision` 신규 가드는
vacuous 방지·대조군·AST 오탐 방지를 모두 갖춘 모범적 구조다. 유일한 갭은 이번 PR이 고친
"응답 DTO가 실제 반환보다 좁았다"는 결함 클래스(Discord `publicKey`)에 대해 타입만 넓히고
그 값이 실제로 전달되는지 확인하는 런타임 회귀 테스트를 남기지 않은 점이다 — 같은 세션에서
다른 결함(DTO 클래스명 충돌)에는 대조군까지 갖춘 가드를 만들면서 이 축만 비대칭적으로
비어 있다.

## 위험도

LOW
