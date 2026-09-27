# 아키텍처(Architecture) 리뷰 — patch-null-validation

## 발견사항

- **[INFO]** 신규 공용 검증기(`IsOptionalNonNull`)에 대한 회귀 표(golden list)가 소스와 별도로 손으로 유지되는 SoT 중복 — 새 필드 추가가 조용히 커버리지에서 빠질 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:33`(`const TABLE: Array<[DtoClass, string[]]> = [...]`) ~ `:83`(닫는 배열), 단언은 `:82`(`expect(CASES).toHaveLength(43)`)
  - 상세: `TABLE` 은 14개 DTO 파일 안에 실제로 선언된 `@IsOptionalNonNull()` 사용처를 손으로 옮겨 적은 것이다. 소스(각 `*.dto.ts` 의 데코레이터)와 테스트(`TABLE`)가 서로 다른 두 곳에서 같은 사실("이 필드는 null 을 거부해야 한다")을 각자 선언하는 구조라, 다음 두 방향의 drift 를 구조적으로 막지 못한다: ① 새 NOT NULL 필드에 데코레이터는 붙였는데 `TABLE` 에 추가하는 것을 잊으면 테스트는 계속 GREEN 이고 회귀 보호만 조용히 빠진다(리플렉션으로 소스를 훑어 `TABLE` 과 대조하는 장치가 없다). ② 반대로 `TABLE` 항목이 실제 데코레이터보다 먼저 삭제/누락돼도 개별 케이스 실패로만 드러나 전체 스캐폴딩의 신뢰도를 알기 어렵다. 이 한계는 코드 주석(`:28`~`:30` "새 필드는 자동으로 들어오지 않는다")에 이미 명시돼 있어 은폐된 문제는 아니지만, "테스트가 자기 완결성 부족을 스스로 경고"하는 구조라는 점에서 아키텍처적으로 약한 지점이다. `@IsOptionalNonNull()` 사용처를 AST/`reflect-metadata` 로 코드베이스 전수 스캔해 `TABLE` 과 대조하는 카나리아를 두면 이 프로젝트의 다른 곳(`workspace-reflection-canary.ts` 등)에서 이미 쓰는 "리플렉션 기반 drift 탐지" 패턴과 일관된다.
  - 제안: 즉시 조치 불요(문서화된 알려진 한계, PR 스코프 밖). 후속으로 리플렉션 기반 전수 스캔 카나리아를 고려할 만하다는 점만 기록.

- **[INFO]** 신규 class-validator PropertyDecorator 가 `common/utils/`(일반 함수 유틸)에 놓여, 이 저장소가 이미 갖고 있는 `common/decorators/` 폴더와 분리된다
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts` (신규 파일 전체)
  - 상세: `common/decorators/`(`current-user.decorator.ts`·`workspace.decorator.ts`·`public.decorator.ts`)는 현재 NestJS 프레임워크 레벨 데코레이터(파라미터/라우트 메타데이터)만 담고 있고, class-validator 프로퍼티 데코레이터는 기존에도 도메인-로컬(`modules/auth-configs/dto/is-ip-or-cidr.validator.ts`)이거나 `common/utils/`(선례 `omit-undefined.ts`)에 있었다. 이번 배치는 그 두 선례 중 후자를 따른 것이라 기존 관례를 깨지는 않지만, "데코레이터"라는 형태 자체는 `common/decorators/` 쪽 시맨틱에 더 가깝다. 폴더 경계가 "프레임워크 데코레이터 vs 검증 데코레이터"로 갈리는 것인지 우연인지가 불명확해질 수 있다.
  - 제안: 결함 아님, 조치 불요. 다음에 검증 데코레이터가 하나 더 생기면 `common/decorators/`(혹은 `common/validators/`)로의 통합을 고려할 만하다는 참고.

## 요약

핵심 변경(`IsOptionalNonNull` 데코레이터)은 SOLID·계층 책임 관점에서 깔끔하다 — `ValidateIf`+`IsDefined` 합성으로 "생략은 허용, null 은 거부"라는 단일 책임을 캡슐화해 43개 필드·14개 DTO 파일에 반복될 뻔한 보일러플레이트를 제거했고(DRY), class-validator 의 `Is*` 네이밍 관례·`omit-undefined.ts` 의 기존 임포트/배치 관례를 그대로 따라 응집도가 높다. 필터 레이어에 SQLSTATE 매핑을 넣는 대신 DTO(입구) 레벨에서 조기 거부하도록 한 설계는 `class-validator` 층에 이물을 남기지 않으면서 프레젠테이션(요청 검증)·비즈니스(서비스)·데이터(엔티티/컬럼) 레이어 경계를 정확히 지킨 결정이며, 이전 결정(`keyset-cursor-uuid-validation.md §A`, 필터-매핑 기각)과도 일관된다. `common/utils` → 14개 모듈 DTO 로의 의존 방향은 fan-in 구조로 순환 의존 위험이 없고(`optional-non-null.ts` 는 `class-validator` 외 아무것도 참조하지 않음), 모듈 경계 침범도 없다. 유일하게 남는 것은 `patch-null-rejection.spec.ts` 의 `TABLE` 이 소스 코드와 별도로 손으로 유지되는 SoT 중복이라는 점인데, 이는 developer 스스로 한계로 명시했고 이번 PR 스코프의 결함은 아니다.

## 위험도
LOW
