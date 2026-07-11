# 테스트(Testing) 리뷰 — EIA 응답 DTO `dto/responses/` 서브디렉토리 정규화

## 컨텍스트

`external-interaction` 모듈의 flat `dto/responses.dto.ts` 를 `dto/responses/*-response.dto.ts` 컨벤션(swagger §5-1)에 맞춰 3개 파일로 분리한 순수 리팩터(런타임/OpenAPI wire 무변경, import 표면만 갱신)이다. `execution-status-response.dto.ts`/`.spec.ts` 는 git rename 으로 이동, `interact-ack-response.dto.ts`/`refresh-token-response.dto.ts` 는 같은 원본 파일에서 분리 신설. `interaction.controller.ts`/`interaction.service.ts`/`interaction.controller.spec.ts` 는 import 경로만 변경.

실측: `cd codebase/backend && npx jest src/modules/external-interaction` → **16 suites / 228 tests 전부 pass**. 신규 `execution-status-response.dto.spec.ts` 가 `--listTests` 로 jest 매처에 정상 포함됨을 확인(orphan 테스트 아님). 구 `dto/responses.dto*` 경로에 대한 잔존 import 는 `grep -rn "dto/responses\.dto" codebase/backend/src` 0건으로 확인(stale import 없음).

## 발견사항

- **[INFO]** `CurrentNodeDto` 스키마의 필드 단위 검증 부재
  - 위치: `dto/responses/execution-status-response.dto.spec.ts` L95-99 (`variant DTO 가 components.schemas 에 등재된다`)
  - 상세: 이 테스트는 `schemas.CurrentNodeDto` 가 `toBeDefined()` 인지만 확인하고, `id`/`type`/`interactionType`(nullable enum) 등 개별 property 스키마는 검증하지 않는다. `WaitingContextBaseDto` variant(`ButtonsContextDto`/`NodeOutputContextDto`) 대비 `CurrentNodeDto` 만 스키마 형태 회귀 가드가 얕다. `CurrentNodeDto.interactionType` 은 `'form'|'buttons'|'ai_conversation'|null` 로, 인식 불가 노드 타입일 때 `null` 이 되는 의미 있는 분기(`interaction.service.ts` L1794-1801 `rawInteractionType`)라 스키마 nullable 회귀는 실익이 있다.
  - 제안: `it('CurrentNodeDto.interactionType 은 nullable enum 이다', ...)` 1건 추가 고려. 저위험(현재도 `interaction.service.spec.ts` 가 런타임 값 산출은 커버) — 필수는 아님.

- **[INFO]** `InteractAckDto`/`RefreshTokenResponseDto` 는 전용 OpenAPI 스키마 spec 이 없음
  - 위치: `dto/responses/interact-ack-response.dto.ts`, `dto/responses/refresh-token-response.dto.ts`
  - 상세: `ExecutionStatusDto` 만 `oneOf`/discriminator-없음/nullable 등 복잡한 스키마 규약이 걸려 있어 전용 `.spec.ts` 를 뒀다. 두 DTO 는 flat property 나열(`ApiProperty`/`ApiPropertyOptional`)뿐이라 상대적으로 회귀 위험이 낮다. 다만 `InteractAckDto.currentStatus` 가 `ApiPropertyOptional` + optional TS 타입인데 실제로는 `interaction.service.ts` 의 `interact()`/`cancel()` 양쪽에서 항상 값을 채워 반환(코드상 사실상 required)한다는 점은 스키마와 런타임 계약 사이 미세한 괴리이나, 이는 DTO 설계 관점이지 테스트 갭은 아니다.
  - 제안: 필수 조치 아님. 타 24개 모듈도 동일 수준(전용 스키마 spec 없음)이라 일관성 있음.

- **[INFO]** `context.oneOf` 배열 순서에 대한 엄격 동치(`toEqual`) 검증의 브리틀함
  - 위치: `dto/responses/execution-status-response.dto.spec.ts` L101-107
  - 상세: `oneOf` 는 순서 무관 집합 의미이지만 테스트는 정확한 배열 순서(`ButtonsContextDto` 먼저)까지 강제한다. 구현이 의미상 동일하게 순서만 바꾸면(예: `NodeOutputContextDto` 를 먼저 선언) 테스트가 깨진다.
  - 상세: 이 파일이 "회귀 가드" 목적임을 감안하면 의도된 엄격함일 수 있으나, false-positive 실패 가능성은 존재.
  - 제안: 필요 시 `expect.arrayContaining` + length 검증으로 완화 가능. 우선순위 낮음(현재 방식이 실서비스에 문제를 일으키지 않음).

## 회귀 테스트 확인

- `interaction.controller.spec.ts` / `interaction.service.ts` 는 import 경로만 바뀌었고 로직 변경 없음 — 기존 동작 테스트(`interaction.service.spec.ts` 의 `getStatus` describe 블록, buttons→nodeOutput fallthrough·conversationThread 키 생략·2단계 조회·secret 마스킹 등)가 그대로 유효함을 실행으로 확인(228/228 pass).
- 신규 `execution-status-response.dto.spec.ts` 는 실제 `SwaggerModule.createDocument()` 로 OpenAPI 문서를 빌드해 검증한다 — 데코레이터 메타데이터만 읽는 방식(선행 PR #904 에서 실제로 `@ApiExtraModels` 누락 dangling `$ref` 를 놓쳤던 known pitfall)을 재발하지 않는 올바른 패턴.
- 스키마 레벨 가드(`discriminator` 미선언, `conversationThread` present-when-available)와 `interaction.service.spec.ts` 의 동일 불변식에 대한 행위 레벨 테스트(예: L530 "buttons 인데 buttonConfig 부재면 nodeOutput 변형으로 fallthrough")가 서로 보완적으로 이중화되어 있어 계약 드리프트 조기 발견에 유리함.

## Mock / 격리 평가

- `execution-status-response.dto.spec.ts` 는 mock 을 쓰지 않고 실제 NestJS 모듈 컴파일 + `SwaggerModule.createDocument()` 로 진짜 산출물을 검증 — 적절.
- `beforeAll` 로 문서를 1회 빌드해 공유하지만 이후 테스트들은 읽기 전용 접근만 하므로 테스트 간 상태 오염 없음. 각 `it` 은 독립 실행 가능.
- `interaction.controller.spec.ts` 는 `Partial<InteractionService>` mock 을 controller 레벨에 주입해 라우팅/가드-바인딩만 검증하고 실제 서비스 로직 검증은 별개 `interaction.service.spec.ts` 로 분리 — 책임 경계가 명확해 가독성/유지보수성이 좋음.

## 테스트 용이성

- DTO 를 파일 단위로 쪼갠 구조 자체가 테스트 대상 축소·명확화에 기여(모놀리식 `responses.dto.ts` 대비 `execution-status-response.dto.spec.ts` 가 정확히 그 파일의 계약만 검증). 순수 리팩터라 신규 DI/의존성 이슈 없음.

## 요약

이번 변경은 순수 파일 분리 리팩터로 런타임 동작에 영향이 없으며, 신규로 추가된 `execution-status-response.dto.spec.ts` 는 데코레이터 메타데이터가 아닌 실제 OpenAPI 문서 생성 결과를 검증해(과거 dangling `$ref` 미탐지 사고를 교훈 삼은 패턴) `oneOf`/discriminator 부재/nullable/`additionalProperties` 등 계약의 핵심 불변식을 실효성 있게 가드하고, 기존 `interaction.service.spec.ts`(228 테스트 전량 pass 확인)의 행위 레벨 커버리지와 상호 보완적으로 겹친다. Import 경로 변경이 유일한 실 코드 변경분인 `interaction.controller.ts`/`interaction.service.ts`/`interaction.controller.spec.ts` 는 회귀 위험이 사실상 없고 실측으로도 확인됐다. 발견된 갭은 모두 INFO 수준(부가 스키마 필드 검증 강화 여지, 저위험 DTO 의 전용 스펙 부재, `oneOf` 순서 브리틀함)으로 병합을 막을 사유가 아니다.

## 위험도

LOW
