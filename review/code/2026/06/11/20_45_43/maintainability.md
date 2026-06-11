# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `ListModelConfigsQueryDto`의 `kind` 필드에 `@ApiPropertyOptional` 누락
  - 위치: `codebase/backend/src/modules/model-config/dto/list-model-configs-query.dto.ts`, line 51–53
  - 상세: 코드베이스 내 동일한 패턴의 다른 Query DTO(`QueryNotificationDto`, `QueryAuditLogDto`)는 확장 필드마다 `@ApiPropertyOptional`을 선언해 Swagger 문서화가 DTO 단에서 자가완결된다. `ListModelConfigsQueryDto`는 JSDoc에서 "Swagger 문서화는 컨트롤러의 `@ApiQuery`가 단일 소스"라고 의도를 설명하고 있어 의식적인 결정임은 명확하다. 그러나 이 패턴이 두 곳(DTO vs 컨트롤러)에 분산된 책임으로 읽힐 수 있고, 향후 필드 추가 시 컨트롤러 `@ApiQuery` 추가를 잊는 실수가 생길 수 있다. 다른 Query DTO와 스타일이 다른 점은 JSDoc으로 충분히 설명되어 있으므로 심각도는 낮다.
  - 제안: 현재 의도(단일 소스 = 컨트롤러)를 유지할 경우 JSDoc 설명은 충분하므로 변경 불필요. 다만 프로젝트 관례를 DTO 자가완결로 통일하려면 `@ApiPropertyOptional({ enum: MODEL_CONFIG_KINDS, required: true })` 를 추가하고 컨트롤러 `@ApiQuery`를 제거하는 것이 일관성 측면에서 더 낫다.

- **[INFO]** 테스트 블록 `ListModelConfigsQueryDto whitelist`에서 `pipe`·`metadata` 변수가 `describe` 스코프 변수로 선언됨
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts`, lines 168–172
  - 상세: `const pipe = new CustomValidationPipe()` 와 `const metadata = { ... }` 가 `describe` 바디에서 직접 초기화되어 있다. Jest에서 `describe` 스코프 최상단 초기화는 `beforeEach`와 달리 테스트 격리가 없다. 파이프 자체가 stateless이고 인스턴스 공유가 문제 없으므로 현재 코드는 올바르게 동작한다. 그러나 다른 테스트 그룹은 `beforeEach` 패턴을 일관되게 사용하고 있어 스타일 불일치가 생긴다.
  - 제안: 인스턴스 공유가 의도적이라면 주석으로 명시하거나, 일관성을 위해 `beforeEach` 안에서 재생성하는 방식을 사용한다.

- **[INFO]** 프론트엔드 `model-configs.ts`의 `list()` 메서드에서 `limit: 100` 하드코딩
  - 위치: `codebase/frontend/src/lib/api/model-configs.ts`, line 809
  - 상세: 숫자 100은 백엔드 `PaginationQueryDto`의 `@Max(100)` 상한과 동기화된 값이다. 인라인 주석으로 이유를 충분히 설명하고 있어 매직 넘버는 아니지만, 백엔드 상한값이 변경될 경우 프론트엔드 코드도 같이 수정해야 한다는 암묵적 결합이 존재한다. API 코드 레이어에 상수가 없어서 단일 변경 지점이 없다.
  - 제안: `const PAGINATION_MAX_LIMIT = 100` 와 같은 파일 수준 상수로 추출하거나, 현재처럼 주석으로 근거를 명시하면 충분하다. 현재 수준은 수용 가능하다.

- **[INFO]** `parseKind` 함수가 모듈 수준 자유 함수로 선언되어 있고 `export` 없음
  - 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts`, lines 514–522
  - 상세: 변경 전 코드에서도 동일한 구조였으므로 이번 PR이 도입한 문제가 아니다. 단지 이번 리팩터링 후에도 `parseKind`가 컨트롤러 내부 로직으로 적절히 캡슐화되어 있는지 확인 차원에서 언급. 현재 비공개 함수이므로 유닛 테스트는 `findAll`을 통해 간접 검증하는 방식이 명확하게 유지되고 있다.
  - 제안: 현행 유지가 적절하다.

## 요약

이번 변경은 `kind` 쿼리 파라미터를 전용 `ListModelConfigsQueryDto`로 분리해 NestJS `whitelist + forbidNonWhitelisted` 파이프 문제를 해소한 작은 버그픽스 PR이다. 코드 의도는 명확하고 JSDoc이 설계 결정의 근거를 충분히 설명한다. DTO 패턴은 코드베이스 관례(`PaginationQueryDto` 상속 + `@IsOptional @IsString`)를 잘 따른다. 테스트는 회귀 케이스를 실제 파이프 인스턴스로 검증해 신뢰성이 높다. 발견된 사항은 모두 INFO 수준으로, 유지보수를 저해하는 중대한 문제는 없다.

## 위험도

NONE
