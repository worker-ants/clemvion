# 부작용(Side Effect) Review

## 발견사항

### [INFO] `findAll` 메서드 시그니처 변경 — 파라미터 수 감소
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` (변경 전 `findAll(workspaceId, kind, query)` → 변경 후 `findAll(workspaceId, query)`)
- 상세: `@Query('kind') kind: string` 독립 파라미터와 `@Query() query: PaginationQueryDto` 두 개가 `@Query() query: ListModelConfigsQueryDto` 단일 파라미터로 합쳐졌다. NestJS 컨트롤러 메서드는 HTTP 요청이 직접 호출하는 것이므로 애플리케이션 코드 내 직접 호출자는 없으나, 테스트 파일에서 직접 `controller.findAll(...)` 을 호출하는 곳이 있다. 이 변경은 테스트 파일에서 이미 반영되었으므로 실제 런타임 호출자 영향은 없다.
- 제안: 이슈 없음. 테스트 파일도 동기화 완료.

### [INFO] `modelConfigService.findAll` 세 번째 인자 타입 확장 — `PaginationQueryDto` → `ListModelConfigsQueryDto`
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` L88, `model-config.service.ts` L40
- 상세: 컨트롤러는 `ListModelConfigsQueryDto`(PaginationQueryDto 하위 타입)를 서비스의 `findAll(workspaceId, kind, query: PaginationQueryDto)` 에 전달한다. 서비스 시그니처는 여전히 `PaginationQueryDto`를 기대하므로 구조적 타입 호환성은 유지된다. `kind` 필드는 서비스에서 구조 분해(destructuring)하지 않으므로 서비스 쪽 상태 변경은 없다.
- 제안: 이슈 없음. 리스코프 치환 원칙 만족.

### [INFO] 프론트엔드 `list()` 에서 `limit: 9999` → `limit: 100` 으로 변경
- 위치: `codebase/frontend/src/lib/api/model-configs.ts` L809
- 상세: 이전에는 백엔드 `@Max(100)` 제약을 초과하는 `limit: 9999`를 전송하고 있었다. 이 값이 실제로 400을 발생시켰는지는 백엔드 구현 타임라인에 따라 다르나(예: 이전에는 다른 DTO를 사용했거나 whitelist 가 없었을 수 있음), 변경 후 `limit: 100`은 `@Max(100)` 상한 내에 있으므로 검증 통과가 보장된다. 의도하지 않은 부작용은 없으며 오히려 잠재적인 400 오류를 수정한다.
- 제안: 이슈 없음. 단, `limit: 100`이 실제 데이터 요구사항(kind별 최대 항목 수)을 충족한다는 운영 가정은 DTO 주석에 명시되어 있으므로 추가 조치 불필요.

### [INFO] 신규 DTO 파일 생성 (`list-model-configs-query.dto.ts`) — 파일시스템 부작용
- 위치: `codebase/backend/src/modules/model-config/dto/list-model-configs-query.dto.ts`
- 상세: 새 파일이 추가되었다. 이는 의도된 변경으로 의도하지 않은 파일시스템 부작용은 없다. 모듈 barrel(`index.ts`)이 있다면 자동 내보내기에 포함되지 않을 수 있으나, 컨트롤러가 직접 경로로 임포트하므로 동작에 영향이 없다.
- 제안: 이슈 없음.

### [INFO] `CustomValidationPipe`가 테스트에서 직접 인스턴스화됨
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts` L304–L308 (`const pipe = new CustomValidationPipe()`)
- 상세: `describe` 블록 내 `const pipe`는 `describe` 스코프에 선언되었다. Jest의 `describe`는 클로저를 통해 변수 공유가 발생하나, `CustomValidationPipe`는 stateless이므로 테스트 간 공유 상태 오염은 없다. `whitelist: true, forbidNonWhitelisted: true`가 내부적으로 하드코딩되어 있으므로 전역 파이프 설정과 일치하는지 확인이 필요하나 현재 구현에서는 일치한다.
- 제안: 이슈 없음.

## 요약

이번 변경은 `GET /model-configs` 엔드포인트에서 `kind` 쿼리 파라미터가 `forbidNonWhitelisted` ValidationPipe에 의해 거부되는 버그를 수정한다. 핵심 변경은 컨트롤러의 `@Query('kind') kind` 독립 파라미터를 `ListModelConfigsQueryDto`로 통합한 것이다. 전역/공유 상태 변경, 예상치 못한 파일시스템 조작, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경은 없다. `findAll` 시그니처 변경은 NestJS 라우터만이 실제 호출자이며 테스트 코드도 새 시그니처로 동기화되었다. 서비스 레이어(`modelConfigService.findAll`)는 `PaginationQueryDto` 타입을 유지하여 하위 호환성이 보존된다. 프론트엔드의 `limit: 9999 → 100` 수정은 백엔드 `@Max(100)` 제약과의 정합성을 확보하여 런타임 400 오류 가능성을 제거한다.

## 위험도

NONE
