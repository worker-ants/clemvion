# Architecture Review — rotate-bot-token-body

## 발견사항

- **[INFO]** 요청 본문의 "이중 선언"(shadow DTO) 구조 — 단일 진실 원천 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` 의 `@Body() body: { newBotToken?: string }` (게이트 없음 — 컨텍스트 미포함 구간, `Read` 로 확인. 실제 위치는 파일 내 `rotateBotToken(` 메서드 시그니처) vs `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:14-18`(`ChatChannelRotateBotTokenRequestDto.newBotToken: string`). 동일한 패턴이 `codebase/backend/src/modules/executions/executions.controller.ts` `continueExecution` 의 `@Body() body?: { formData?: unknown }` vs `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts:16`(`formData?: Record<string, unknown>`)에도 있다.
  - 상세: `@ApiBody({ type })` 가 가리키는 DTO 클래스와 핸들러가 실제로 받는 인라인 타입이 서로 다른 선언이다. 전역 `CustomValidationPipe` 진입(=계약 변경)을 피하려는 의도적 설계이고, 각 모듈의 캐너리 spec 이 ① 파라미터 설계 타입이 `Object` 로 남아 있는지 ② `@ApiBody` 가 올바른 DTO 를 가리키는지 ③ 렌더된 스키마 모양을 고정해 두어 드리프트를 행동 기준으로 가드한다. 다만 이 가드는 "형태가 컴파일 타임에 반드시 일치한다"는 구조적 보장이 아니라 스냅샷 성격의 테스트다 — 인라인 타입과 DTO 필드를 동시에 손으로 맞춰야 하는 지점이 이 PR 로 2곳(선례 `ExecuteWorkflowDto` 포함 3곳)에서 4곳으로 늘었다. 프로젝트 스스로 `plan/in-progress/rotate-bot-token-body.md` 와 각 DTO 머리 주석에서 이 트레이드오프를 명시하고 있어 결함이 아니라 알려진 설계 결정이다.
  - 제안: 조치 불요(이미 의도·테스트로 커버). 다만 5번째 유사 라우트가 생기면(이미 rule-of-three WARNING 으로 다른 리뷰어가 지적) 캐너리 팩토리화와 함께 "인라인 타입 필드 집합 == DTO 필드 집합"을 한 번에 점검하는 타입 레벨 보조 테스트(예: `expectTypeOf`)까지 같이 고려할 만하다.

- **[INFO]** 프레임워크 비공개 내부 API 의존이 한 지점으로 잘 격리됨 (긍정적 관측)
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts` (`bodyParamDesignType`, `ROUTE_ARGS_METADATA` / `RouteParamtypes` 사용부)
  - 상세: `@nestjs/common` 의 공개 진입점이 아닌 내부 export 에 의존하는 코드가 3개 모듈(triggers/executions/hooks) 스펙 파일에 중복되지 않고 `shared/testing` 한 곳에만 존재하며, 나머지는 그 헬퍼를 재사용만 한다. 이는 프레임워크 메이저 업그레이드로 인한 파급을 한 파일(및 그 파일의 에러 경로 테스트 `swagger-probe.spec.ts`)로 국한시키는 적절한 경계 설정이다. 프로덕션 코드는 이 취약한 의존과 완전히 분리되어 있다(테스트 전용 모듈에만 존재).
  - 제안: 없음 — 현재 구조 유지 권장.

- **[INFO]** 모듈 경계·응집도 양호, 순환 의존 없음
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`, `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts`
  - 상세: 신규 "문서 전용" DTO 는 각자의 소유 모듈 `dto/` 하위에 위치해 기존 응답 DTO 배치 관례를 따른다(교차 모듈 재사용 없음). `shared/testing/swagger-probe.ts` 는 `modules/*` 를 참조하지 않는 리프(leaf) 유틸리티라 역참조로 인한 순환이 생기지 않는다. `triggers.controller.ts` 내 "chat-channel↔triggers forwardRef 순환 해소" 주석은 이 diff 이전에 이미 해결된 이력을 가리키는 것으로, 이번 변경이 재도입한 순환은 없다.
  - 제안: 없음.

- **[INFO]** 레이어 책임 분리 — 프레젠테이션(OpenAPI 문서) 레이어만 수정, 비즈니스/검증 로직 불변
  - 위치: 9개 소스 파일 전체(DTO 2개 신규, 컨트롤러 3개에 `@ApiBody`/`@ApiConsumes` 추가, 테스트 헬퍼 1개 확장)
  - 상세: 핸들러 바디, 서비스 계층, `CustomValidationPipe` 로직 어느 것도 diff 에 포함되지 않는다. 변경은 전적으로 Swagger 메타데이터(프레젠테이션/계약 문서 레이어)에 국한되어 있고, 각 파일이 "런타임 불변" 임을 캐너리로 못박아 레이어 경계를 의도적으로 지킨다. SRP 관점에서도 신규 DTO 클래스는 "OpenAPI 스키마 제공"이라는 단일 책임만 가지며 검증 책임을 떠맡지 않는다.
  - 제안: 없음.

- **[INFO]** 확장성 — 컨벤션 미성문화로 인한 잠재적 드리프트 (이미 트래커에 등재됨)
  - 위치: `spec/conventions/swagger.md` §1-7(리뷰 대상 diff 밖, 참조만), `plan/in-progress/rotate-bot-token-body.md` "안 하는 것" 섹션
  - 상세: "인라인 `@Body()` 타입에는 반드시 `@ApiBody` 를 달아야 한다"는 규칙이나 `<Domain><Action>RequestDto` 명명 규약이 아직 `swagger.md` 에 성문화되어 있지 않다. 이번 PR 로 이 패턴을 따르는 라우트가 3곳(+선례 1곳)으로 늘었지만, 이를 강제하는 린트/정적 가드는 없고 코드 리뷰(사람의 기억)에 의존한다. 이미 plan 에 "전역 가드는 규칙 문단부터 planner 턴" 이라고 명시하고 트래커 후속 등재를 예정해 두었으므로 새로운 지적은 아니다.
  - 제안: 조치 불요(이미 계획됨). 후속 planner 턴에서 §1-7 에 규칙을 명문화할 때 정적 검사(예: 커스텀 ESLint 룰 또는 AST 스크립트로 "`@Body()` 파라미터가 클래스 타입이 아니면서 `@ApiBody` 가 없는 경우"를 탐지)까지 함께 검토할 가치가 있다.

## 요약

이번 변경은 3개 라우트(rotate-bot-token, execution continue, webhook)에 OpenAPI 요청 본문 스키마를 추가하는 순수 프레젠테이션(문서) 레이어 작업으로, 기존 `workflows.execute` 선례를 그대로 따른다. SRP·레이어 분리·모듈 경계가 명확하고 순환 의존도 없으며, 테스트 전용 프레임워크-내부 의존(`bodyParamDesignType`)도 `shared/testing` 한 곳으로 잘 격리되어 있다. 유일하게 주목할 구조적 특성은 "문서용 DTO"와 "실제 `@Body()` 인라인 타입"이 별개로 선언되어 컴파일러가 아닌 캐너리 테스트로만 동기화를 보장한다는 점인데, 이는 전역 검증 파이프 진입(계약 변경)을 피하기 위한 의도적이고 테스트로 뒷받침된 트레이드오프이며 프로젝트 문서에도 명시되어 있어 결함으로 보기 어렵다. 아키텍처 관점에서 차단 사유는 없다.

## 위험도
NONE
