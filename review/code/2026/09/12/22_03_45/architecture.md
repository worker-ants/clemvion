# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** UUID 경로 파라미터 "두 축(런타임 파이프 + 문서 `format`)" 계약이 구조적으로 강제되지 않고, 매 호출부에서 두 데코레이터를 수동으로 짝지은 뒤 테스트-시점 가드로만 사후 검증된다. 이 저장소는 이미 같은 종류의 "여러 데코레이터를 항상 함께 쓴다" 문제를 `common/swagger`(`ApiOkWrappedResponse`, `ApiCreatedWrappedResponse` 등 합성 데코레이터)로 구조적으로 해소한 선례가 있다. 그런데 이번 변경은 `@Param('id', ParseUUIDPipe)` + `@ApiParam({ format: 'uuid' })` 를 여전히 두 개의 독립된 데코레이터로 유지하고, 둘이 항상 같이 있어야 한다는 불변식을 `param-uuid-pipe-guard.ts`(AST 스캔)로 사후 검증한다. "빠뜨리면 테스트가 잡는다" 구조는 "애초에 빠뜨릴 수 없다" 구조(예: `@UuidPathParam('id')` 같은 합성 데코레이터가 파이프와 `@ApiParam` 을 한 번에 적용)보다 약한 형태의 개방-폐쇄/DRY 준수다. 지금 베이스라인이 0 이라 당장 회귀는 없지만, 137번째 자리가 생길 때마다 "가드가 알려주면 그때 손으로 짝을 맞추는" 절차가 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:265`(`@ApiParam(...)`)·`:291`(`@Param('id', ParseUUIDPipe) triggerId: string,`), `codebase/backend/src/modules/auth/auth.controller.ts:436`~`440`(`@ApiParam({...})`), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` 의 `collectMethodViolations`(120~166줄)·`scanUuidParams`(192~229줄)
  - 상세: 가드 자체의 설계(순회/판정 분리, vacuity floor 를 같은 루프에서 계산, 허용목록 대신 구조적 예외)는 이번 PR 의 이전 라운드 지적을 반영해 이미 잘 정리되어 있다. 남은 것은 "위반을 사후에 탐지"에서 "위반이 애초에 표현 불가능"으로 한 단계 더 올릴 여지다.
  - 제안: (blocking 아님) 후속 작업으로 `common/swagger` 계열에 `@ApiUuidParam(name)` 같은 합성 데코레이터를 추가해 `@Param(name, ParseUUIDPipe)` + `@ApiParam({name, format:'uuid'})` 를 한 호출로 적용하는 것을 검토. 그러면 `param-uuid-pipe` 가드는 "합성 데코레이터를 우회해 개별 데코레이터를 쓰지 않았는가"만 확인하면 되어 감시 범위가 줄어든다.

- **[INFO]** 방어가 여전히 "호출부마다 반복 배치"된 형태이고, 공유 crosscutting 계층(`GlobalExceptionFilter`)은 SQLSTATE 22P02(`invalid_text_representation`)를 여전히 분류하지 않는다. `@Param(..., ParseUUIDPipe)` 축을 놓친 새 진입 경로(`@Query()`, body 필드 조회 등을 거쳐 같은 `findById` 류에 도달하는 경우)는 이번 변경 이후에도 500 마스킹을 그대로 받을 수 있다. 이는 계층 책임 관점에서 "프레젠테이션 계층 개별 방어" 대 "공통 예외 처리 계층의 단일 안전망" 사이의 진짜 아키텍처 트레이드오프이지만, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 필터 확장이 "저장소 전체 실패 분류를 바꾸는 변경이라 전수 선행 조사가 필요하다"는 근거와 함께 후속 항목으로 등재되어 있고, 직전 라운드(`review/code/2026/09/12/21_20_01`)의 architecture 리뷰가 이미 지적한 항목이다. 새로 반복 지적할 실익이 없어 정보성으로만 남긴다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` 및 `GlobalExceptionFilter`(diff 밖, `codebase/backend/src/common/filters/http-exception.filter.ts`) — 파일 자체는 이번 diff 에 포함되지 않음
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다" 항목(미해결, `[ ]`)이 정확히 이 갭을 기술하고 이번 배치 범위 밖으로 명시적으로 미뤄 두었다.
  - 제안: 조치 불필요(이미 추적 중). 후속 PR 에서 22P02 발생 지점 전수 조사 후 필터에 분기 추가.

- **[INFO]** `param-uuid-pipe-guard.ts`/`param-uuid-pipe.spec.ts` 는 프로덕션 런타임 모듈을 import 하지 않고 파일시스템 읽기 + TypeScript Compiler API AST 파싱만으로 판정한다(`ts.createSourceFile` 직접 사용, `TriggersController` 등 실제 클래스를 import 하지 않음). 이는 테스트/가드 코드가 프로덕션 모듈 그래프에 새로운 의존 엣지를 만들지 않는 바람직한 경계 유지이며, 같은 디렉터리의 형제 가드들(`dto-class-name-collision`, `swagger-dto-contract`, `nullable-type-lie-cast`)과 동일한 저장소 컨벤션을 따른다. 새로운 문제는 아니지만 모듈 경계 관점에서 특기할 만한 긍정적 설계다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` 전체
  - 상세: 없음(문제 아님)
  - 제안: 없음

## 요약

이번 변경은 `rotateBotToken` 엔드포인트 하나에 누락되어 있던 `ParseUUIDPipe`/`@ApiParam(format:'uuid')` 두 축을 채우고, 그 계약을 AST 기반 전수 가드로 고정하는 좁고 목적이 분명한 패치다. 레이어 책임 분리(입력 파싱은 NestJS 파이프, 문서화는 Swagger 데코레이터, 판정 로직은 순수 함수로 분리된 가드)는 이전 라운드들의 리뷰 피드백을 반영해 이미 잘 정돈되어 있고, 순환 의존성이나 레이어 침범, 과도한 추상화 같은 구조적 결함은 발견되지 않았다. 유일하게 실질적인 개선 여지는 "두 데코레이터가 항상 짝을 이뤄야 한다"는 불변식을 테스트가 아니라 합성 데코레이터로 구조적으로 강제할 수 있었다는 점이며, 이는 blocking 이 아닌 후속 개선 제안이다. GlobalExceptionFilter 의 22P02 미분류 갭은 이미 별도 항목으로 추적 중이므로 재지적하지 않았다.

## 위험도

LOW
