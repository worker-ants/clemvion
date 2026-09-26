# 신규 식별자 충돌 검토 — canvas-save-typed (`spec/2-navigation/` scope, impl-done)

## 검토 요약

- **scope 델타**: `spec/2-navigation/` 는 이 PR 에서 **0개 파일 변경** — spec 자체가 새 식별자를 도입하지 않는다.
- **구현 diff**: 4개 파일(`CHANGELOG.md`, `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`, 같은 디렉터리의 신규 `.spec.ts`, `codebase/backend/test/workflow-crud.e2e-spec.ts`).
- 코드 diff 를 절대경로로 직접 확인한 결과, 이 PR 은 **새 식별자를 하나도 도입하지 않는다.** `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore` 의 응답에서 이미 존재하던 `CanvasSaveResultDto.nodes` / `.edges` 필드의 OpenAPI 선언 타입을 `Record<string, unknown>[]` → 기존 `NodeDto[]` / `EdgeDto[]` 참조로 좁힌 것뿐이다.

## 확인한 식별자 재사용 (신규 아님)

`git -C <워크트리>` 로 직접 확인:

```
codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts:5:export class NodeDto {
codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts:5:export class EdgeDto {
codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:71:export class CanvasSaveResultDto {
```

- `NodeDto` / `EdgeDto` — 이번 diff 이전부터 `nodes`/`edges` 모듈의 조회 응답 DTO로 이미 존재. 이번 변경은 그 기존 클래스를 `import` 해 `workflow-response.dto.ts` 의 `$ref` 대상으로 재사용할 뿐, 새 클래스를 선언하지 않는다.
- `CanvasSaveResultDto` — 이번 diff 이전부터 존재하던 클래스(`workflows.controller.ts` 에서 이미 `@ApiOkWrappedResponse(CanvasSaveResultDto, …)` 로 두 endpoint 에 참조 중). 이번 변경은 그 안의 두 필드 타입만 좁힌 것이고 클래스명·API endpoint·엔드포인트 경로는 그대로다.

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 해당 없음. 새 요구사항 ID 부여 없음(diff 에 ID 패턴 없음).
2. **엔티티/타입명 충돌** — 새 타입명 없음. `NodeDto`/`EdgeDto`/`CanvasSaveResultDto` 모두 기존 정의 재사용이며, 의미도 그대로(노드/엣지 조회 응답 스키마와 동일 형태로 광고) — 다른 의미로 쓰이는 곳 없음.
3. **API endpoint 충돌** — 새 endpoint 없음. `POST /workflows/:id/save`, `POST /workflows/:id/versions/:versionId/restore` 는 기존 endpoint 그대로이며 이번 PR 은 그 응답 DTO 의 필드 타입만 바꾼다.
4. **이벤트/메시지명 충돌** — 해당 없음. webhook/queue/sse 이벤트 이름 변경·신설 없음.
5. **환경변수·설정키 충돌** — 해당 없음. diff 에 ENV/config key 변경 없음.
6. **파일 경로 충돌** — 신규 파일은 `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts` 1개뿐. `find codebase/backend/src -name "*response.dto.spec.ts"` 로 확인한 결과 `execution-response.dto.spec.ts` · `execution-status-response.dto.spec.ts` · `interact-ack-response.dto.spec.ts` 등 동일 컨벤션(`<name>.dto.ts` ↔ `<name>.dto.spec.ts`, 같은 디렉터리)이 이미 확립돼 있어 명명 컨벤션과 정확히 일치하고 기존 파일과 겹치지 않는다.

## 발견사항

없음 — 이 PR 이 도입하는 새 식별자가 없어 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 요약

이번 canvas-save-typed 변경은 `spec/2-navigation/` 를 건드리지 않았고(델타 0, 정상), 실제 구현 diff 도 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키를 하나도 신설하지 않는다. 핵심 식별자(`NodeDto`, `EdgeDto`, `CanvasSaveResultDto`)는 모두 diff 이전부터 존재하던 것을 그대로 재사용했고, 유일한 신규 파일(`workflow-response.dto.spec.ts`)도 저장소 전역에 이미 확립된 `*.dto.ts`/`*.dto.spec.ts` 동일 디렉터리 페어링 컨벤션을 정확히 따른다. 신규 식별자 충돌 관점에서 위험 요소를 찾지 못했다.

## 위험도

NONE
