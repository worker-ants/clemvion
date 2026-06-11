# Testing Review — model-config.controller.spec.ts

## 발견사항

### [INFO] 테스트 존재 여부 — 핵심 변경 경로 충분히 커버됨
- 위치: 전체 파일
- 상세: `parseKind` 회귀(undefined/invalid/empty string), `ListModelConfigsQueryDto` 화이트리스트 통과, `update`/`remove`의 `clearClientCache` 호출, `previewModels` 위임, `@Roles` 메타데이터 확인까지 신규 변경의 핵심 경로를 모두 커버한다.
- 제안: 특이사항 없음.

### [INFO] `findOne` / `setDefault` / `testConnection` / `listModels` 핸들러 미테스트
- 위치: controller.ts `findOne`, `setDefault`, `testConnection`, `listModels`
- 상세: 컨트롤러에 위 4개 핸들러가 존재하지만 spec 파일에는 대응 테스트가 없다. 이번 변경 범위(parseKind 버그 / cache 무결성 / DTO whitelist)와 직접 관련이 없어 critical 은 아니지만 커버리지 공백이 존재한다.
- 제안: 최소한 `setDefault` 의 `@Roles('editor')` 메타데이터 확인과 `listModels`의 `type` 쿼리 전달 확인 테스트를 추가 고려.

### [INFO] `update` — service.update 실패 시 clearClientCache 미호출 검증 없음
- 위치: spec.ts `describe('update')`, controller.ts line 138-140
- 상세: `remove` describe 에는 "service 실패 시 clearClientCache 미호출" 케이스(spec.ts line 244-248)가 있으나, `update` describe 에는 동일 시나리오 테스트가 없다. 두 핸들러의 구조는 동일하므로 `update` 에도 같은 방어 테스트가 필요하다.
- 제안: `update` describe 에 `mockModelConfigService.update.mockRejectedValue(...)` → `clearClientCache` 미호출 케이스 추가.

### [WARNING] `previewModels` — `@Roles('editor')` 메타데이터 누락
- 위치: spec.ts `describe('previewModels')`, controller.ts line 163
- 상세: `@Roles decorator presence` describe 블록이 `create`/`update`/`remove`의 'editor' 메타데이터를 검증하지만 `previewModels` 핸들러(line 163: `@Roles('editor')`)는 포함되지 않는다. `@Roles` 검증 그룹이 불완전해 향후 데코레이터 삭제 시 회귀 탐지 불가.
- 제안: `@Roles decorator presence` 블록에 `previewModels` / `setDefault` 메타데이터 확인 케이스 추가.

### [INFO] `ListModelConfigsQueryDto` 파이프 테스트 — `limit` 기본값 미검증
- 위치: spec.ts line 162-168
- 상세: `page`의 기본값 1은 테스트하지만(line 162-168), `limit`의 기본값 20은 검증하지 않는다. 두 기본값 모두 `PaginationQueryDto` 에 정의되어 있어 같은 규칙이 적용된다.
- 제안: 기존 'defaults page to 1' 테스트와 같은 fixture에서 `expect(result.limit).toBe(20)` 추가.

### [INFO] `sort` 필드 — SQL 인젝션 방어 패턴(`@Matches`) 미검증
- 위치: spec.ts `ListModelConfigsQueryDto whitelist` describe
- 상세: `PaginationQueryDto.sort` 에는 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` 제약이 있어 `sort='; DROP TABLE`과 같은 입력을 차단한다. 이 경계값 테스트가 없어 DTO 레벨 SQL 인젝션 방어가 회귀될 수 있다.
- 제안: `{ kind: 'chat', sort: 'created_at; drop' }` → 파이프 거부, `{ kind: 'chat', sort: 'created_at' }` → 통과 케이스 추가.

### [INFO] `testConnection` 핸들러 — workspaceId 전달 검증 없음
- 위치: controller.ts line 193-197
- 상세: `testConnection` 은 `llmService.testConnection(id, workspaceId)` 로 workspaceId 를 넘기는데 테스트가 없다. 향후 signature 변경 시 무언의 regression이 발생할 수 있다.
- 제안: `testConnection` describe 추가 — `mockLlmService.testConnection` 호출 인자에 workspaceId 포함 검증.

### [INFO] Mock 적절성 — `ServiceMethods` Pick 타입으로 실제 서비스 interface 와 동기화
- 위치: spec.ts line 37-40
- 상세: `Pick<ModelConfigService, ...>` 방식은 서비스 실제 signature 변경 시 TypeScript 컴파일 단계에서 잡혀 mock 이탈을 방지한다. 구조적으로 적절하며 별도 조치 불필요.
- 제안: 특이사항 없음.

### [INFO] 테스트 격리 — `beforeEach` mock/pipe 재생성으로 격리 양호
- 위치: spec.ts line 53-75, 138-144
- 상세: mock 객체와 파이프 인스턴스가 `beforeEach` 에서 매번 재생성되어 테스트 간 상태 누출이 없다. 특히 spec.ts comment(line 133)에서 향후 상태 변이 가능성까지 고려한 설명이 있다.
- 제안: 특이사항 없음.

### [INFO] 테스트 가독성 — describe 계층과 comment 명확
- 위치: 전체 파일
- 상세: `describe` 제목이 핸들러/픽스 번호(WARNING#1, WARNING#2, WARNING#3)를 명시하고, 인라인 주석이 "왜 이 테스트가 필요한가"를 설명한다. 가독성 우수.
- 제안: 특이사항 없음.

---

## 요약

이번 spec 파일은 `kind` 쿼리 파라미터 HTTP 400 회귀 버그 수정의 핵심 경로(parseKind 검증, ListModelConfigsQueryDto 화이트리스트, cache 무효화 무결성)를 충실하게 커버하며 격리·가독성 모두 양호하다. 다만 두 가지 경미한 공백이 있다: (1) `update` 핸들러에 service 실패 시 cache 미호출 방어 케이스가 없고(remove 에는 있음), (2) `@Roles` 메타데이터 검증 블록이 `previewModels`를 누락한다. `sort` 의 SQL 인젝션 방어 패턴 및 `limit` 기본값 테스트는 없으나 `PaginationQueryDto` 가 공유 DTO 이므로 해당 레이어의 자체 테스트가 존재할 가능성이 높아 이번 파일 단독 기준으로는 낮은 위험도다.

## 위험도

LOW
