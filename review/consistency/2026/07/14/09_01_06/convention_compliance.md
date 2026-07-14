# 정식 규약 준수 검토 — `codebase/backend/src/common/swagger/api-wrapped.ts` (SchemaObject 공개 타입 파생)

## 검토 대상

- 코드 변경: `codebase/backend/src/common/swagger/api-wrapped.ts` (+ 동형 변경 2곳: `execution-status-response.dto.spec.ts`, `interact-ack-response.dto.spec.ts`) + `@nestjs/swagger` `^11.2.7` → `^11.4.5` (package.json) + Dockerfile `pnpm deploy` 슬림화(별개 관심사, swagger 규약과 무관).
- 규약: `spec/conventions/swagger.md` (frontmatter `code:` 에 `codebase/backend/src/common/swagger/**` 포함 — scope 일치).
- 관련 커밋: `3f1df0dcd` `refactor(backend): @nestjs/swagger 11.2.7 핀 제거 + deep-import 공개 타입 파생 교체 (§2)`.
- 변경 내용 요약: 기존 `import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'` (deep-import) 를 제거하고, `@nestjs/swagger` root 공개 export `ApiResponseSchemaHost` 에서 `type SchemaObject = ApiResponseSchemaHost['schema']` 로 파생. `@nestjs/swagger` 11.4.x 부터 `exports` 맵이 `dist/interfaces/...` deep-import 를 차단하기 때문(버전 상향의 직접 동기).

## 확인 절차

- `spec/conventions/swagger.md` 전문(§0~§6 + Rationale) 을 읽고 "SchemaObject" / "deep-import" / "dist/" 관련 언급 유무를 `grep` 으로 재확인 — **0건**. 즉 본 문서는 애초에 내부 타입 임포트 경로에 대한 규칙을 규정하고 있지 않다.
- `spec/conventions/*.md` 전체(다른 conventions 포함)에서 "deep import"/"dist/"/"node_modules 내부" 관련 금지 규칙 검색 — **0건**. 프로젝트 전역에도 이 패턴을 다루는 정식 규약이 없다.
- `codebase/backend` eslint 설정에 `no-restricted-imports` 류 규칙 존재 여부 확인 — 없음.
- `git -C <worktree> grep` 으로 `dist/interfaces/open-api-spec` 잔존 여부 확인 — 코드베이스 전체에서 **잔존 0건** (주석 설명문 1건 제외). 3곳 모두 정확히 치환됨.
- `api-wrapped.ts` 의 export 목록(`wrapDataSchema`/`wrapOneOfDataSchema`/`wrapItemsSchema`/`wrapPaginatedSchema`/`ApiOkWrappedResponse`/`ApiOkWrappedOneOfResponse`/`ApiCreatedWrappedResponse`/`ApiAcceptedWrappedResponse`/`ApiOkWrappedArrayResponse`/`ApiOkPaginatedResponse`) 를 swagger.md §5-2 헬퍼 표와 대조 — 함수 시그니처·이름·반환 스키마 shape 모두 **변경 없음**. `SchemaObject` 타입 alias 자체는 `export` 되지 않는 파일-로컬 타입이라 외부 소비자 관점에서 breaking 이 아니다.
- `api-wrapped.spec.ts` 회귀 테스트(28 tests, 커밋 메시지 명시)가 `wrapDataSchema`/`wrapOneOfDataSchema`/`wrapItemsSchema`/`wrapPaginatedSchema` 산출 스키마 shape 를 그대로 검증 — §5(응답 wrapping)·§6(레거시 패턴 제거)이 규정하는 출력 포맷(`{ data: ... }`, `{ data: [...], pagination }`) 은 이번 변경으로 흔들리지 않음.

## 발견사항

- **[INFO]** deep-import 회피 원칙의 문서화 여부
  - target 위치: `codebase/backend/src/common/swagger/api-wrapped.ts` L14-21 (JSDoc 주석으로 사유 설명)
  - 위반 규약: 없음 — `spec/conventions/swagger.md` 는 애초에 내부 구현의 import 출처(공개 export vs deep-import)에 대한 규칙을 정의하지 않는다. 따라서 이 항목은 "위반"이 아니라 "문서화 공백" 제안이다.
  - 상세: 이번 변경은 `@nestjs/swagger` 11.4.x 의 `exports` 맵이 `dist/interfaces/...` deep-import 를 차단하면서 발생한 실제 빌드 장애를 해소한 것으로, 코드 내 JSDoc 에 사유가 잘 남아 있다(§Rationale 스타일과 유사한 톤). 다만 swagger.md 자체에는 "helper 내부 타입은 공개 export 에서만 파생하고 `@nestjs/swagger/dist/**` 딥임포트는 쓰지 않는다" 는 일반 원칙이 없어, 향후 다른 개발자가 유사한 이유(타입 확보 편의)로 다시 딥임포트를 도입해도 규약 문서만으로는 저지되지 않는다.
  - 제안: swagger.md 에 새 항목을 강제할 필요는 낮다(코드 레벨 JSDoc 으로 이미 사유가 남아 있고, eslint `no-restricted-imports` 로 전역 강제하는 편이 문서보다 효과적). 원한다면 swagger.md §5-2 헬퍼 표 뒤에 한 줄 메모("`SchemaObject` 등 내부 타입은 `@nestjs/swagger` 의 공개 export 에서만 파생하고 `dist/**` deep-import 는 쓰지 않는다 — 근거: 11.4.x `exports` 맵 차단")로 승격하는 것도 가능하나 필수는 아니다.

## 요약

`api-wrapped.ts` 의 `SchemaObject` 딥임포트 → `ApiResponseSchemaHost['schema']` 공개 타입 파생 교체는 `spec/conventions/swagger.md` 가 규정하는 그 어떤 항목(DTO 데코레이터 패턴 §1, Controller 패턴 §2, 응답 DTO·공용 래퍼 헬퍼 인벤토리 §5, 레거시 패턴 제거 §6)도 건드리지 않는다 — 헬퍼 함수 이름·시그니처·반환 스키마 shape(`{ data: ... }` 계열)는 그대로이고, 변경된 것은 파일-로컬(비-export) 타입 alias 의 import 출처뿐이다. swagger.md 자체도 이 종류의 내부 import 경로를 규율 대상으로 삼지 않으므로 "규약 위반"도 "규약이 다뤄야 할 신규 패턴 누락"도 아니다. 3곳 모두 deep-import 가 완전히 제거됐고 회귀 테스트(28 tests)로 스키마 산출물 불변이 확인됐다는 점에서 오히려 실제 응답 포맷 규약(§5/§6)을 안정적으로 보존한 변경이다. 위 INFO 는 향후 재발 방지를 위한 선택적 문서화 제안일 뿐 차단 사유가 아니다.

## 위험도

NONE
