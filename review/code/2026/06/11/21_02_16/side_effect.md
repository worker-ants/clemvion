# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] findAll 시그니처 변경 — 컨트롤러 내부 전용, 외부 호출자 없음
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` L82-91
- 상세: `findAll(@Query('kind') kind: string, @Query() query: PaginationQueryDto)` → `findAll(@Query() query: ListModelConfigsQueryDto)` 로 파라미터가 통합됐다. 이 메서드는 NestJS 라우터가 직접 호출하는 HTTP 핸들러이므로 TypeScript 코드에서 직접 호출하는 외부 호출자가 존재하지 않는다. 단, 컨트롤러 스펙 파일 내 단위 테스트는 이전 시그니처로 작성돼 있었으며, 이번 변경으로 스펙도 신규 시그니처(`query` 객체 하나)로 올바르게 갱신됐다.
- 제안: 추가 조치 불필요.

### [INFO] `ListModelConfigsQueryDto` 신규 파일 — 파일시스템 추가
- 위치: `codebase/backend/src/modules/model-config/dto/list-model-configs-query.dto.ts`
- 상세: 새 파일 생성. 기존 파일 변경 없음. `PaginationQueryDto` 를 상속하고 `@IsOptional @IsString kind?: string` 하나만 추가한다. 클래스 프로퍼티 기본값·`@ApiProperty`·`@IsIn` 을 의도적으로 생략한 결정이 주석으로 명시돼 있어 의도치 않은 누락이 아님이 확인된다.
- 제안: 추가 조치 불필요.

### [INFO] `kind` 값 유효성 검증 경로 유지 — parseKind 부작용 없음
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.ts` L53-61, L88
- 상세: 이전에는 `@Query('kind')` 로 이미 추출된 string 이 `parseKind` 에 전달됐다. 변경 후에는 `query.kind` 를 전달한다. `parseKind` 는 순수 함수(`throw` 아니면 `return`) 로 전역 상태, 파일시스템, 네트워크, 환경 변수 어느 것도 건드리지 않는다. 동작 변경 없음.
- 제안: 추가 조치 불필요.

### [INFO] `modelConfigsApi.list` limit 9999 → 100 변경 — 의도된 네트워크 요청 파라미터 축소
- 위치: `codebase/frontend/src/lib/api/model-configs.ts` L78
- 상세: 호출 빈도·대상 엔드포인트는 그대로이고 쿼리 파라미터 `limit` 값만 변경된다. 이 함수의 호출자(`knowledge-bases/[id]/page.tsx`, `use-default-embedding-model-config-id.ts`, `create-kb-form-dialog.tsx`) 는 모두 `ModelConfigData[]` flat 배열 반환에만 의존하며 limit 값을 직접 참조하지 않는다. 워크스페이스당 kind 별 설정이 100개 미만이라는 전제는 서비스 성격상 합리적이다. 다만, 미래에 설정이 100개를 초과할 경우 `list()` 가 조용히 잘린 결과를 반환하는 silent truncation 이 발생할 수 있다.
- 제안: 중요도는 낮으나, 장기적으로는 cursor/전체 페이지 순회 방식으로 전환하거나 서버 측에서 `kind` 별 설정 수를 제한하는 규칙을 명시하면 안전하다. 현 단계에서는 INFO 수준이다.

### [INFO] `modelConfigService.findAll` 서비스 시그니처 — 변경 없음
- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` L37-41
- 상세: 서비스 레이어의 `findAll(workspaceId, kind, query: PaginationQueryDto)` 는 그대로다. 컨트롤러가 `ListModelConfigsQueryDto` (PaginationQueryDto 상속체)를 `query` 인자로 넘기는 것은 타입 호환성에 문제없다. 서비스는 `query.kind` 를 읽지 않으므로 kind 필드 추가로 인한 예상치 못한 동작이 없다.
- 제안: 추가 조치 불필요.

### [INFO] 테스트 파일 격리 개선 — 공유 상태 제거
- 위치: `codebase/backend/src/modules/model-config/model-config.controller.spec.ts` L135-144
- 상세: `describe` 스코프 const 였던 `pipe`/`metadata` 가 `beforeEach` 내 인스턴스화로 이동했다. 이는 테스트 간 공유 상태를 제거하는 방향이므로 부작용 관점에서 긍정적인 변경이다. `CustomValidationPipe` 가 현재 상태를 내부에 보관하지 않더라도 향후 확장에 대해 안전하다.
- 제안: 추가 조치 불필요.

## 요약

이번 변경은 컨트롤러 `findAll` 핸들러의 `@Query` 바인딩을 분리 파라미터에서 단일 DTO로 통합하고, 프론트엔드의 잘못된 `limit:9999` 를 상한값인 `100` 으로 수정한 버그픽스다. 신규 도입된 `ListModelConfigsQueryDto` 는 `PaginationQueryDto` 를 상속하는 얇은 확장이며 전역/공유 상태를 변경하거나 환경 변수·네트워크·파일시스템에 예상치 못한 영향을 주는 코드가 없다. 기존 서비스·프론트엔드 호출자에 대한 계약 파손도 없다. `list()` 의 `limit:100` 제한으로 인한 잠재적 silent truncation 이 유일한 미래 위험 요인이나 현 운영 규모에서는 실질적 영향이 없는 수준이다.

## 위험도

LOW
