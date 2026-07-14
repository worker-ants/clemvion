# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md` (--impl-done)

## 검토 대상 diff 요약
- `@nestjs/swagger` `^11.2.7` → `^11.4.5` (package.json 버전 범프)
- `codebase/backend/src/common/swagger/api-wrapped.ts`: deep-import
  `@nestjs/swagger/dist/interfaces/open-api-spec.interface`의 `SchemaObject`를
  공개 타입 파생 `type SchemaObject = ApiResponseSchemaHost['schema']`로 교체
  (11.4.x `exports` 맵이 deep-import 차단)
- `execution-status-response.dto.spec.ts`, `interact-ack-response.dto.spec.ts`:
  동일한 타입 소스 교체 (테스트 파일, import 경로만 변경)
- `codebase/backend/Dockerfile`: `prod-deps` 스테이지를 `pnpm deploy`(injected,
  self-contained) 방식으로 교체 — 배포 산출물 격리/용량 최적화 목적

## 확인한 근거
- `spec/5-system/14-external-interaction-api.md`, `spec/conventions/swagger.md` 어디에도
  `@nestjs/swagger` 특정 버전, `SchemaObject` import 경로, deep-import 여부를 명시하지 않음
  (grep 결과 매칭 없음).
- `spec/0-overview.md`의 `Dockerfile` 언급은 Flyway 마이그레이션 전용 Dockerfile
  (`migrations/Dockerfile`)뿐이며, backend 앱 Dockerfile 의 스테이지 구조·`pnpm deploy`
  여부는 spec 어디에도 계약으로 박제되어 있지 않음.
- 타입 파생식(`ApiResponseSchemaHost['schema']`)은 `SchemaObject & Partial<ReferenceObject>`와
  구조적으로 동등 — 정적 타입 소스만 바뀌었고 런타임 스키마 생성 로직·값은 변경 없음
  (context 진술: 28개 DTO 회귀 테스트 통과, OpenAPI 출력 불변).

## 발견사항

없음. 이 변경은 (1) devDependency 버전 범프, (2) 컴파일 타임 타입 alias 의 소스만
공개 API 로 치환한 리팩터, (3) 프로덕션 이미지 빌드 스테이지 최적화로, 셋 다
`spec/5-system/14-external-interaction-api.md`가 규정하는 데이터 모델·API 계약·상태
전이·RBAC·계층 책임 중 어느 것도 값·shape·의미로 다루지 않는다. 따라서 아래 6개 관점
모두 해당 없음(N/A):

1. 데이터 모델 충돌 — 없음 (DTO 필드·타입 값 불변, 타입 alias 소스만 교체)
2. API 계약 충돌 — 없음 (OpenAPI 스키마 출력 불변 확인됨, 회귀 테스트로 검증)
3. 요구사항 ID 충돌 — 없음 (신규 요구사항 ID 부여 없음)
4. 상태 전이 충돌 — 없음 (실행 상태 값·enum 무관)
5. 권한·RBAC 충돌 — 없음 (인증/인가 로직 미접촉)
6. 계층 책임 충돌 — 없음 (Dockerfile 배포 스테이지 재구성은 인프라 관심사이며 spec 이
   backend 앱 Dockerfile 내부 구조를 계약으로 규정하지 않음. `codebase/backend`
   외부 산출물 경로(`WORKDIR /app/codebase/backend`)·EXPOSE 3011 등 compose/운영 참조
   호환 계약은 diff 주석에서 유지 명시됨)

## 요약

`@nestjs/swagger` 11.2.7→11.4.5 범프와 `SchemaObject` 타입 소스를 deep-import 에서
공개 타입(`ApiResponseSchemaHost['schema']`) 파생으로 교체한 것은 순수 컴파일 타임
type-source 변경이며, 관련 spec(`spec/5-system/14-external-interaction-api.md`,
`spec/conventions/swagger.md`, `spec/0-overview.md`) 어디에도 버전·import 경로·
Dockerfile 스테이지 구조를 계약으로 고정한 바 없어 대조할 모순 지점 자체가 존재하지
않는다. OpenAPI 스키마 출력 불변이 회귀 테스트로 확인되었으므로 API 계약·데이터
모델 관점 drift 는 없다고 판단한다.

## 위험도
NONE
