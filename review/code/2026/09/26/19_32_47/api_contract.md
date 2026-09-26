# API 계약(API Contract) 리뷰 — request-body-guard

## 개요

이번 변경은 실제 REST 엔드포인트의 라우팅·요청/응답 스키마·에러 코드·인증을 수정하지 않는다. 핵심은 (1) 저장소 정적 가드
(`request-body-advertised`) 신설 — `@Body()` 파라미터의 설계 타입이 클래스가 아닌데 `@ApiBody` 로 스키마를 광고하지 않는 라우트를
Jest 테스트로 잡는다, (2) `spec/conventions/swagger.md` §5-4 에 그 규칙을 문서화, (3) `CustomValidationPipe` 에서 기존 인라인 배열을
`UNVALIDATED_METATYPES` 상수로 추출(순수 리팩터)한 것이다. 그럼에도 "API 응답/요청 스키마 문서화 완전성"은 점검 관점 3·5 번에 정면으로
해당하므로 전체를 검토했다.

## 발견사항

- **[INFO]** `CustomValidationPipe.toValidate` 리팩터는 런타임 동작 불변임을 diff 대조로 확인
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:15` (`UNVALIDATED_METATYPES` 선언), `:90` (`toValidate`)
  - 상세: 기존 `toValidate` 내부의 지역 배열 `[String, Boolean, Number, Array, Object]` 을 모듈 top-level `export const
    UNVALIDATED_METATYPES` 로 승격하고 `.includes` 호출만 그 상수를 참조하도록 바꿨다. 원소·순서·비교 방식(참조 동등성 `.includes`)이
    동일하므로 기존에 검증을 통과/우회하던 요청 바디의 실제 런타임 처리(400 여부, `whitelist`/`forbidNonWhitelisted` 적용 여부)는
    바뀌지 않는다 — 기존 API 클라이언트에 대한 breaking change 없음.
  - 제안: (조치 불요) 프로덕션 파이프 모듈에서 테스트 전용 가드가 소비할 상수를 export 하는 결합은 의도된 단일 진실 설계(파이프가 건너뛰는
    타입 목록과 가드가 세는 타입 목록을 물리적으로 하나의 배열로 묶음)이며 `spec/conventions/swagger.md` Rationale·CHANGELOG 에도
    명시돼 있다.

- **[INFO]** 신설 가드는 "광고의 존재"만 검사하고 "광고의 정확성"·"런타임 검증 충분성"은 검사 범위 밖
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` — 함수 `advertisesBody`(가장 가까운 게이트
    59), `scanRequestBodyAdvertised`(게이트 72)
  - 상세: `@Body() body: unknown` + `@ApiBody({ schema: {} })` 인 라우트(예: 웹훅 수신)는 가드를 통과하지만, 실제 요청 바디에 대한
    런타임 검증은 여전히 없다(`CustomValidationPipe` 가 `Object`/`Array` 등 비클래스 설계 타입을 건너뛰므로). 이는 "요청 검증
    충분성" 관점에서 남는 갭이지만, `spec/conventions/swagger.md`(게이트 517-522, 750-766)의 Rationale 이 이를 명시적으로
    스코프 밖으로 선언하고("`@ApiBody` 가 **맞는** DTO 를 가리키는지는 라우트별 캐너리가 본다") 그 이유(외부 발신 웹훅은 형태를 강제할
    수 없음)까지 근거를 대고 있어 이번 변경이 새로 만든 갭이 아니라 기존에 이미 있던 설계 결정을 문서화·가드화한 것이다.
  - 제안: (조치 불요, 참고용) 향후 라우트별 요청 바디 스키마 정합성(§ "못 보는 것")까지 저장소 가드로 승격할지는 별도 트래커 항목으로
    남겨 둘 만하다.

- **[INFO]** 소급 적용 시 하위 호환성 리스크를 의식적으로 회피한 설계
  - 위치: `spec/conventions/swagger.md:754-759` (Rationale "클래스로 받게 강제하지 않는다")
  - 상세: 인라인 타입 파라미터를 DTO 클래스로 승격하면 `CustomValidationPipe` 가 진입해 `whitelist`/`forbidNonWhitelisted` 가 켜지고,
    에러 코드가 도메인 특화 코드(예: `INVALID_BOT_TOKEN`)에서 일반 `VALIDATION_ERROR` 로 바뀌며 여분 키를 보내던 기존 클라이언트
    요청이 400 이 되는 실제 breaking change 시나리오를 명시적으로 식별하고, 그 대안(문서 전용 DTO + `@ApiBody`)을 택했다. 가드는
    베이스라인 0(실측 78개 `@Body()` 중 위반 0)으로 소급 적용되므로 기존 라우트의 런타임 계약을 건드리지 않는다.
  - 제안: (조치 불요) API 계약 관점에서 바람직한 설계 판단으로 평가한다.

## 요약

점검 관점 8개 중 실질적으로 걸리는 것은 3(응답/요청 스키마 문서화)·5(요청 검증) 뿐이며, 그마저도 이번 변경은 라우트의 런타임 동작(검증
로직·에러 코드·상태 코드·인증)을 하나도 바꾸지 않고 OpenAPI 문서화 완전성을 강제하는 정적 가드 + 컨벤션 문서 추가에 그친다. 유일한
프로덕션 코드 diff(`validation.pipe.ts`)는 동일 배열을 상수로 추출한 순수 리팩터로 동등성을 확인했다. 버전 관리·응답 형식·에러 응답
형식·URL/경로 설계·페이지네이션·인증/인가는 이번 변경의 대상이 아니다(해당 없음). Critical/Warning 급 계약 위반은 발견되지 않았다.

## 위험도

LOW
