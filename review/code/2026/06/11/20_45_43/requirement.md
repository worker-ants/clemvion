# 요구사항(Requirement) Review

## 발견사항

### **[INFO]** `ListModelConfigsQueryDto` — spec 본문에 전용 DTO 명시 없음
- 위치: `codebase/backend/src/modules/model-config/dto/list-model-configs-query.dto.ts`
- 상세: `spec/2-navigation/6-config.md §Model Config API` 표는 `GET /api/model-configs?kind=chat|embedding|rerank (쿼리: kind, page, limit, sort, order, search)` 라고 필드만 나열한다. `ListModelConfigsQueryDto` 라는 전용 DTO 클래스나 `forbidNonWhitelisted` 화이트리스트 처리 방법은 spec 본문에 없다. 이는 구현 세부 사항(NestJS 파이프 동작)이므로 spec 누락이지 spec 위반이 아니다.
- 제안: 코드 유지. 해당 구현 세부를 spec 에 반영할 필요는 없으나, 향후 API 규약 spec(`spec/5-system/2-api-convention.md`)에 "전역 ValidationPipe whitelist/forbidNonWhitelisted 적용 대상 DTO" 패턴을 일반 지침으로 추가할 수 있다 (필수 아님).

---

### **[INFO]** `[SPEC-DRIFT]` 프론트엔드 `list()` 의 `limit: 100` — spec 이 아직 이전 값 기준
- 위치: `codebase/frontend/src/lib/api/model-configs.ts` L724
- 상세: `spec/5-system/2-api-convention.md §4.1` 은 limit 최대값을 100 으로 명시하므로, `limit: 9999 → limit: 100` 조정은 spec 계약을 준수하기 위한 수정이다. `spec/2-navigation/6-config.md` 및 관련 spec 에 구체적인 `limit` 값이 지정돼 있지 않으며, 코드 변경이 spec 을 어기지 않는다. 이미 spec 범위 내 동작이므로 spec drift 가 아닌 spec 을 올바르게 따르는 수정이다.
- 제안: 코드 유지. 추가 조치 불필요.

---

### **[INFO]** `MODEL_CONFIG_INVALID` 에러 코드 — `parseKind` 가 kind 값 검증에 사용하는 것은 spec 계약과 일치
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` L53-L61
- 상세: `spec/5-system/9-rag-search.md §374` 는 "`MODEL_CONFIG_INVALID` 은 설정 CRUD(`/api/model-configs`) 레이어 전용"이라 명시한다. `parseKind` 가 잘못된/누락된 `kind` 에 대해 `BadRequestException({ code: 'MODEL_CONFIG_INVALID' })` 를 throw 하는 것은 이 계약과 정확히 일치한다. `@IsIn` 을 쓰지 않고 `parseKind` 에서 직접 검증해 `MODEL_CONFIG_INVALID` 코드를 보존하는 설계도 spec 계약 에러 코드 보존 측면에서 올바르다.

---

### **[INFO]** `sort` / `order` / `search` 파라미터 — `ListModelConfigsQueryDto` 상속으로 자동 포함
- 위치: `codebase/backend/src/modules/model-config/dto/list-model-configs-query.dto.ts`
- 상세: `spec/2-navigation/6-config.md §Model Config API` 표에서 `GET /api/model-configs` 의 허용 쿼리 파라미터로 `kind, page, limit, sort, order, search` 가 명시된다. `ListModelConfigsQueryDto extends PaginationQueryDto` 상속으로 `page, limit, sort, order, search` 가 모두 포함되고, `kind` 를 추가로 선언해 6개 파라미터 모두 화이트리스트에 포함된다. 완전한 일치.

---

### **[INFO]** `findAll` 시그니처 — 서비스 계약과 일치
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` L544-L553
- 상세: `modelConfigService.findAll(workspaceId, kind, query)` 시그니처와 완전히 일치한다. `service.findAll` 은 `(workspaceId: string, kind: ModelConfigKind, query: PaginationQueryDto)` 를 받으며, `ListModelConfigsQueryDto extends PaginationQueryDto` 이므로 타입 호환성도 보장된다.

---

### **[INFO]** 테스트 — `kind` 미포함 객체로 `undefined` 케이스 검증
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts` L252-L256
- 상세: `{ page: 1, limit: 20 }` (kind 프로퍼티 없음)를 전달해 `parseKind(undefined)` → `BadRequestException` 흐름을 검증하는 테스트가 존재한다. 신규 시그니처 `findAll(workspaceId, query: ListModelConfigsQueryDto)` 에서 `query.kind` 가 `undefined` 인 경우를 올바르게 커버한다.

---

## 기능 완전성 평가

### 버그 수정 1: `kind` 화이트리스트 400 해소

`GET /api/model-configs?kind=chat` 요청이 전역 `ValidationPipe(forbidNonWhitelisted)` 에 의해 "property kind should not exist" 400 을 반환하던 회귀가 완전히 수정됐다.

- `ListModelConfigsQueryDto` 생성 → `kind` 화이트리스트 포함
- 컨트롤러의 `@Query() query: PaginationQueryDto` → `@Query() query: ListModelConfigsQueryDto` 교체
- `@Query('kind')` 개별 바인딩 제거 → `query.kind` 로 통합
- `parseKind(query.kind)` 로 기존 `MODEL_CONFIG_INVALID` 계약 유지
- `@IsIn` 대신 `@IsOptional @IsString` 사용으로 DTO 레벨에서 에러 코드 충돌 방지

### 버그 수정 2: `limit: 9999 → 100`

`PaginationQueryDto` 의 `@Max(100)` 제약(spec `§4.1` limit 최대 100)을 위반하던 `limit: 9999` 를 `limit: 100` 으로 수정. 코멘트에 "워크스페이스당 kind 별 모델은 관리자 큐레이션 항목이라 100개를 넘지 않는다" 근거 명시.

### 엣지 케이스 처리

- `kind` 미제공(`undefined`): `parseKind` 가 `MODEL_CONFIG_INVALID` throw — 커버됨
- `kind` 잘못된 값(`'unknown'`): `parseKind` 가 `MODEL_CONFIG_INVALID` throw — 커버됨
- 유효한 `kind` 3가지(`chat`, `embedding`, `rerank`) 각각: 테스트에서 검증됨
- 알 수 없는 쿼리 파라미터: whitelist 테스트로 거부 확인됨
- `limit` 문자열 `'100'` → 숫자 `100` 변환: `@Type(() => Number)` 상속으로 처리됨 (테스트 L312-L318 에서 `{ limit: '100' }` → `result.limit === 100` 검증)

### TODO/FIXME 확인

없음. 미완성 작업 시사 주석 없음.

---

## 요약

이번 변경은 PR #541(통합 모델 관리)에서 발생한 회귀 2건을 정확하게 수정한다. (1) `@Query() query: PaginationQueryDto` 에 `kind` 가 없어 전역 ValidationPipe가 400을 던지던 문제를 `ListModelConfigsQueryDto`(extends PaginationQueryDto, kind 추가) 로 해소하고, (2) 프론트엔드 `list()` 의 `limit: 9999` 가 DTO `@Max(100)` 위반으로 400을 던지던 문제를 `limit: 100` 으로 수정한다. 두 수정 모두 `spec/2-navigation/6-config.md §Model Config API` 의 엔드포인트 정의(kind, page, limit, sort, order, search 파라미터), `spec/5-system/2-api-convention.md §4.1` 의 limit 최대값 100, `spec/5-system/9-rag-search.md §374` 의 `MODEL_CONFIG_INVALID` 에러 코드 계약에 완전히 부합한다. 컨트롤러 테스트는 신규 시그니처로 전면 갱신되고, ValidationPipe 화이트리스트 회귀 테스트 2건이 추가되어 충분히 커버된다. spec 에 명시되지 않은 구현 세부(ListModelConfigsQueryDto 클래스명, forbidNonWhitelisted 처리 방법)는 모두 spec 을 위반하지 않는 구현 선택이다.

## 위험도

NONE
