# 아키텍처 리뷰 — EIA `getStatus.context` 스키마화 (`responses.dto.ts` 등)

diff base: `origin/main` (a02db4f9a spec + 0302bd7ea impl)

## 발견사항

### (Q1) `responses.dto.ts` → `shared/conversation-thread/conversation-thread.types` 의존
- **[INFO]** 프레젠테이션 계층 DTO가 shared 도메인 타입을 `import type`
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts:7` (`import type { ConversationThread } from '../../../shared/conversation-thread/conversation-thread.types'`)
  - 상세: 의존 방향은 "presentation(외곽) → shared kernel(내곽)" 로 정상 방향이다(Clean Architecture 의 Dependency Rule 과 일치, 역방향인 "domain → DTO" 였다면 문제). 게다가 (a) `import type` 이라 컴파일 타임에 완전히 소거되고 런타임 번들·순환 의존 위험이 없다, (b) 실제 OpenAPI 노출 계약은 이 타입을 반영하지 않고 의도적으로 `type: 'object', additionalProperties: true` 로 열어둔다 — 즉 SDK 코드젠 소비자는 내부 `ConversationThread` 구조 변경에 전혀 영향받지 않는다. 이 import 의 유일한 효과는 `interaction.service.ts` 가 조립하는 `conversationThread` 값이 DTO 필드 타입과 구조적으로 맞는지 컴파일 타임에 검증하는 것뿐이다. `ConversationThreadDto` 를 별도로 만들지 않기로 한 결정(SoT = `conversation-thread.md §1.3`)은 "두 곳에 같은 shape 을 유지"하는 이중 SoT 안티패턴을 피한 것으로, 이 대안(shared 타입 재사용)이 오히려 더 건전하다. `shared/conversation-thread` 는 이름 그대로 여러 모듈(engine, node handler, DTO)이 공유하도록 설계된 kernel 이며(순환 참조 없음 — 아래 확인), `execution-engine` 내부 엔티티나 서비스처럼 특정 모듈이 소유하는 진짜 "내부" 타입을 끌어오는 것과는 다르다.
  - 검증: `grep -rn "external-interaction" shared/conversation-thread/` → 0건, `conversation-thread.types.ts` 자체는 import 가 전혀 없는 순수 타입 모듈 → 순환 의존 없음.
  - 제안: 현재로선 조치 불요. 다만 이 타입이 향후 mutable 헬퍼(`rehydrateConversationThread` 등 런타임 함수)와 같은 파일에 계속 함께 살면, 실수로 `import type` 대신 값 import 로 바뀌는 회귀가 생기지 않도록 (예: eslint `consistent-type-imports` 규칙이 이미 있다면 이를 신뢰, 없다면 도입 검토) 정도만 참고.

### (Q2) `interaction.service.ts` 가 DTO 파생 타입 `WaitingContextBase` 를 로컬 변수 주석에 사용
- **[INFO]** 서비스 계층 → DTO 계층 타입 참조, 기존 패턴의 연장선
  - 위치: `interaction.service.ts:34` (`type WaitingContextBase` import), `:523` 부근 `const base: WaitingContextBase = {...}`
  - 상세: 엄밀한 계층 순수성 관점에서는 서비스가 프레젠테이션 계약 타입에 의존하는 것이 이상적이지 않다(정석은 서비스가 도메인 형태를 반환하고 컨트롤러/매퍼가 DTO 로 변환). 그러나 이 프로젝트/모듈은 diff 이전부터 이미 그 패턴이 아니다 — `interaction.service.ts` 는 diff 이전부터 `ExecutionStatusDto`/`InteractAckDto`/`RefreshTokenResponseDto` 를 서비스 메서드의 **반환 타입 그 자체**로 직접 import 해 사용 중이다(`:31-35`). 즉 "서비스가 DTO 클래스를 직접 다룬다"는 경계 흐림은 이 PR 이 새로 도입한 것이 아니라 이미 확립된 모듈 컨벤션이다. 이번 변경은 그 위에 3개 필드(`interactionType`/`waitingNodeId`/`conversationThread`)만 뽑은 `Pick` 타입을 **로컬 변수 주석 목적으로만** 추가한 것으로, 스코프가 매우 좁고(`type` import, 런타임/데코레이터 메타데이터 전혀 안 실림), object spread 의 literal-widening 버그를 컴파일 타임에 잡기 위한 명확한 기술적 근거가 주석으로 남아 있다. 새로운 종류의 결합을 만들었다기보다 기존 컨벤션을 일관되게 따른 것으로 판단한다.
  - 참고(설계 관찰, 조치 불요): `WaitingContextBase` 는 정작 공통 필드를 정의하는 `WaitingContextBaseDto`(비-export, module-private abstract class)가 아니라 `NodeOutputContextDto`(구체 variant)에서 `Pick` 한다 — `WaitingContextBaseDto` 가 export 되지 않아 외부에서 직접 참조할 수 없기 때문에 우회한 것으로 보인다. 동작상 문제는 없으나(두 variant 모두 base 필드 구조가 동일), 읽는 사람이 "왜 공통 필드 타입 이름에 NodeOutput 이 등장하나" 의아할 수 있는 아주 경미한 가독성 nit.
  - 제안: 조치 불요(현 스코프에서 과설계). 팀이 향후 서비스/DTO 분리를 정식 정책으로 격상하려면 별도 리팩터 트랙으로 논의할 사안이며 이번 diff 의 책임 범위는 아니다.

### (Q3) `abstract class WaitingContextBaseDto` 상속 시 `@nestjs/swagger` 데코레이터 메타데이터 상속 — 실증 검증
- **[INFO]** 정상 동작 확인(경험적 검증 완료), 우수한 회귀 테스트 설계
  - 위치: `responses.dto.ts:85-137` (`WaitingContextBaseDto` → `ButtonsContextDto`/`NodeOutputContextDto`), 검증 테스트 `responses.dto.spec.ts`
  - 상세: `WaitingContextBaseDto` 는 클래스 데코레이터가 없을 뿐, 각 필드(`interactionType`/`waitingNodeId`/`conversationThread`)는 프로퍼티 데코레이터(`@ApiProperty`/`@ApiPropertyOptional`)로 정상 데코레이트돼 있다. `@nestjs/swagger` 는 프로토타입 체인을 따라 부모 클래스의 프로퍼티 메타데이터를 병합하는 것이 공식 지원 기능(NestJS 공식 문서의 DTO 상속/`PartialType` 계열과 동일 메커니즘)이며, 본 리뷰에서 실제로 `SwaggerModule.createDocument()` 를 호출해 생성된 문서를 직접 덤프해 확인했다:
    - `ButtonsContextDto.required` = `["interactionType","waitingNodeId","buttonConfig"]` — 상속 필드(`interactionType`/`waitingNodeId`) + 고유 필드(`buttonConfig`) 모두 포함.
    - `NodeOutputContextDto.required` = `["interactionType","waitingNodeId","nodeOutput"]` — 동일하게 정상 상속.
    - `components.schemas` 에 `ButtonsContextDto`/`NodeOutputContextDto`/`CurrentNodeDto`/`ExecutionStatusDto` 4개 모두 정상 등재, `ExecutionStatusDto.properties.context.oneOf` 가 두 variant `$ref` 로 정확히 구성됨을 확인.
    - `responses.dto.spec.ts` 15건 전부 통과 재확인(`npx jest --clearCache` 후 3회 연속 재실행으로 안정성 확인). *(1차 실행에서 13건 실패가 관측됐으나 이는 본 리뷰 환경의 stale jest 캐시(이 PR 이전 버전의 컴파일 산출물)로 인한 아티팩트였고, `--clearCache` 후 재현되지 않아 코드 결함이 아님을 확인했다.)*
  - 평가: `abstract` + module-private(비-export) 로 base 를 두고 `@ApiExtraModels` 에는 두 concrete subclass 만 등록한 설계는 phantom 스키마(등록 안 된 base 가 컴포넌트에 새는 것)를 막는 좋은 관례다. 또한 이 테스트 자체가 "데코레이터 메타데이터만 읽지 않고 실제 OpenAPI 문서를 빌드해 검증"하는 방식을 택한 것은 `@ApiExtraModels` 누락 같은 統合(integration) 수준 결함을 잡아내는 데 필요한 정확한 검증 레벨이다 — 단위 수준(클래스 프로퍼티 존재 여부)만 봤다면 놓쳤을 종류의 문제(dangling `$ref`)를 계약 수준에서 가드한다.
  - 제안: 조치 불요.

### 기타 관찰 (요청 범위 밖, 참고용)
- **[INFO]** 판별자 없는 `oneOf` 설계는 타당한 결정
  - 위치: `responses.dto.ts:192-208` (`context?: ButtonsContextDto | NodeOutputContextDto | null`, `discriminator` 미선언)
  - 상세: `interactionType==='buttons'` 인데 `buttonConfig` 복원 실패 시 `NodeOutputContextDto` 로 fallthrough 하는 런타임 경로(`interaction.service.ts`)가 실제로 존재하므로(`interaction.service.spec.ts` 신규 테스트로 고정), OpenAPI `discriminator.propertyName` 을 선언하면 "필드값 → variant 전단사" 라는 스펙 계약을 위반해 SDK 코드젠이 `buttons` 를 항상 `ButtonsContextDto` 로 오판(narrowing)하게 된다. `discriminator` 를 의도적으로 생략하고 `oneOf` 만 쓴 것은 잘못된 계약을 만드는 대신 정직하게 "판별자 없음"을 명시한 올바른 판단이며, JSDoc·Rationale·회귀 테스트(`context 는 discriminator 를 선언하지 않는다`)로 3중 고정돼 있어 향후 실수로 discriminator 가 추가되는 것도 방지된다.
- **[INFO]** "봉투만 스키마화, 내부 payload 는 열린 map" — 추상화 레벨 선택이 적절
  - 위치: `responses.dto.ts:112-137` (`buttonConfig`/`nodeOutput` 은 `additionalProperties: true` 유지)
  - 상세: 노드 타입별로 자유 형식인 하위 payload 까지 전부 클래스로 고정하면 `node-output.md` 컨벤션과 SoT 가 이중화되는 과잉 추상화가 된다. 구조가 안정적으로 보장되는 부분(봉투: `interactionType`/`waitingNodeId`/`conversationThread`/variant 키)만 닫고 나머지는 열어두는 경계 선택이 두 문서(swagger 계약 vs node-output 계약)의 책임 분리와 정확히 일치한다.
  - 참고: `channel-web-chat/src/lib/eia-types.ts` 는 백엔드 DTO 를 직접 import 할 수 없는 독립 SPA 라 손수 타입을 유지하며, 이번 diff 로 `currentNode` 의 스칼라→객체 드리프트가 정정됐으나 `context` 필드는 여전히 `Record<string, unknown> | null` 로 backend 만큼 정밀화되지 않은 비대칭이 남는다. 이는 이미 plan 파일(`spec-draft-eia-context-schema-absence-convention.md` "후속" 섹션)에 후속 항목으로 명시 추적되고 있어 이번 diff 의 결함이 아니라 알려진 스코프 경계다.

## 요약

세 초점 질문 모두 아키텍처적으로 건전하다: (1) DTO의 shared 타입 참조는 `import type` 으로 런타임 결합이 전혀 없고 의존 방향도 outer→inner 로 정상이며 실제 OpenAPI 계약은 내부 타입에 묶이지 않는다, (2) 서비스의 DTO 파생 타입 참조는 이 모듈이 diff 이전부터 이미 취해온 "서비스가 DTO 를 직접 다룬다" 컨벤션의 좁은 연장이라 새로운 계층 위반이 아니다, (3) abstract base 로부터의 `@ApiProperty` 상속은 실제로 `SwaggerModule.createDocument()` 를 빌드해 `required` 배열까지 직접 확인한 결과 정상 동작하며 회귀 테스트(15건, 3회 반복 실행 안정)로 견고하게 가드돼 있다. 전반적으로 닫힌 union(`oneOf`, discriminator 의도적 생략) · 열린 payload(additionalProperties) 의 경계 설정이 근거와 함께 명확히 문서화돼 있고, 순환 의존·모듈 경계 침해도 발견되지 않았다. 유일한 아쉬운 점은 `WaitingContextBase` 가 비-export 인 공통 base 대신 구체 variant 에서 `Pick` 하는 사소한 가독성 nit 뿐이며 이는 차단 사유가 아니다.

## 위험도

NONE
