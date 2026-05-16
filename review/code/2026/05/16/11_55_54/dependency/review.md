# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 새 외부 의존성 추가 없음 — 변경 범위 전체가 기존 패키지 내에서의 리팩토링·문서화·테스트 수정
  - 위치: 전체 24개 파일 (backend/migrations, backend/src)
  - 상세: `package.json` / `package-lock.json` 변경 없음. `git diff main...HEAD --name-only` 에 패키지 매니페스트 파일이 포함되지 않음.
  - 제안: 해당 없음.

- **[INFO]** `@nestjs/swagger` 내부 경로 직접 import 사용 확인
  - 위치: `backend/src/common/swagger/api-wrapped.ts` line 3 — `import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'`
  - 상세: 이 import 는 기존 코드 이전부터 존재하며 이번 diff 에서 신규 추가된 것이 아님. `@nestjs/swagger` 의 공개 API 가 아닌 `dist/` 경로를 직접 참조하므로 패키지 마이너 업그레이드 시 경로가 바뀔 수 있는 잠재적 취약점이다. 단, `SchemaObject` 타입은 OpenAPI 3.0 스펙 기반으로 안정적이므로 즉각적 위험은 낮음.
  - 제안: 장기적으로 `@nestjs/swagger` 가 `SchemaObject` 를 public export 에 포함할 경우 공개 경로로 전환. 현재 버전에서 공개되지 않는 타입이라면 허용 범위 내.

- **[INFO]** 내부 모듈 의존 관계 — `common/swagger` 에서 `@nestjs/swagger` 의존도 확대
  - 위치: `backend/src/common/swagger/api-wrapped.ts` — `wrapOneOfDataSchema`, `ApiOkWrappedOneOfResponse` 추가
  - 상세: 기존 `wrapDataSchema` / `ApiOkWrappedResponse` 패턴을 그대로 따르는 신규 헬퍼 2개를 동일 파일에 추가함. 공통 Swagger 유틸리티가 `api-wrapped.ts` 단일 파일로 집중되는 구조이므로 내부 응집도는 높아짐. `integrations.controller.ts` 가 `../../common/swagger` barrel export 를 통해 사용하는 의존 구조도 기존 패턴과 동일.
  - 제안: 해당 없음. 현재 구조가 일관됨.

- **[INFO]** 내부 모듈 의존 관계 — DTO 분리에 따른 import 확산
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` — `OAuthBeginResultDto` 단일 import 를 `OAuthBeginCafe24PendingResultDto`, `OAuthBeginPopupResultDto` 두 개로 교체
  - 상세: `integration-response.dto.ts` 에서 단일 클래스가 두 클래스로 분리됨. 이에 따라 controller 와 service spec 양쪽에서 import 가 명시적으로 분산됨. 이는 DTO 정확성을 높이는 올바른 방향이며 향후 다른 consumer 가 생길 경우에도 구체적인 분기 DTO 를 직접 참조할 수 있음.
  - 제안: 해당 없음.

## 요약

이번 변경 세트(24개 파일)는 외부 패키지 추가·제거 없이 순수하게 내부 리팩토링, 테스트 강화, 주석·문서화 개선으로 구성된다. `package.json` / `package-lock.json` 이 변경되지 않았으므로 새 의존성·버전 변경·라이선스·취약점 관련 위험이 전무하다. 신규 코드(`wrapOneOfDataSchema`, `ApiOkWrappedOneOfResponse`)는 이미 프로젝트에 존재하는 `@nestjs/swagger` / `@nestjs/common` 범위 안에서만 구현되어 있고, DTO 분리(`OAuthBeginPopupResultDto`, `OAuthBeginCafe24PendingResultDto`)도 내부 모듈 경계를 훼손하지 않는다. `@nestjs/swagger/dist/` 내부 경로 직접 참조는 기존 코드에서 이어진 패턴으로 이번 변경의 결과가 아니다.

## 위험도

NONE
