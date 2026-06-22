# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] schemaCache 변이 — 의도된 설계, 부작용 없음
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` `dispatchNodeSchema` (L136)
- 상세: `cached.hits += 1` 및 `ctx.schemaCache.set(typeArg, { result, hits: 1 })`은 `ExploreDispatchContext` 파라미터로 전달된 turn-scoped 맵을 변이시킨다. 이 변이는 의도된 설계이며, `schemaCache`는 `streamMessage` 호출마다 `new Map()`으로 생성되므로 요청 간 상태 오염이 없다. `AssistantToolRouter` 자체는 무상태 singleton이므로 클래스 레벨 전역 상태 변경은 발생하지 않는다.
- 제안: 조치 불필요.

### [INFO] `dispatchNodeSchema` 추출 — 동작 보존 확인
- 위치: `assistant-tool-router.service.ts` L108–L167 (변경 전후 비교)
- 상세: 이번 변경에서 `get_node_schema` 캐시/하드스톱 로직이 `dispatchExplore` 인라인에서 `private dispatchNodeSchema()` 메서드로 이동했다. 로직 자체는 전혀 바뀌지 않았고(hits 카운터·캐시 키·하드스톱 임계값·반환 객체 구조 동일), 외부 호출자(`dispatchExplore`)의 위임 경로도 `return this.dispatchNodeSchema(args, ctx)` 1줄로 명확히 유지된다. 의도치 않은 상태 변경 없음.
- 제안: 조치 불필요.

### [INFO] `asString` 통일 — 완전 동치, 동작 변경 없음
- 위치: `assistant-tool-router.service.ts` L133 (`dispatchNodeSchema` 내 `typeArg` 추출)
- 상세: 변경 전 `typeof args.type === 'string' ? args.type : ''`와 변경 후 `asString(args.type, '')` 는 완전히 동치다(`asString` 구현: `typeof v === 'string' ? v : fallback`). 비문자열 type 인자에 대한 캐시 우회 동작도 동일하게 유지된다. 부작용 없음.
- 제안: 조치 불필요.

### [INFO] 신규 테스트 파일(`coerce.spec.ts`, 라우터 spec 추가) — 부작용 없음
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/coerce.spec.ts` (신설), `assistant-tool-router.service.spec.ts` L62–L116 (추가)
- 상세: 테스트 파일과 spec 보강은 런타임 동작에 영향을 주지 않는다. 테스트 내 `exploreTools.getNodeSchema.mockResolvedValue`, `router.dispatchExplore` 호출 등은 jest mock 범위 내에서만 동작하며 전역 상태나 외부 서비스에 영향을 미치지 않는다.
- 제안: 조치 불필요.

### [INFO] `review/` 산출물 파일 신설 — 의도된 파일시스템 부작용
- 위치: `review/code/2026/06/23/01_00_21/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `architecture.md`, `concurrency.md`, `documentation.md`, `maintainability.md` (신설)
- 상세: 코드 리뷰 산출물 파일 생성은 프로젝트 규약(CLAUDE.md §정보 저장 위치)에 명시된 의도된 파일시스템 동작이다. 애플리케이션 런타임 코드나 공유 상태와 무관하다.
- 제안: 조치 불필요.

### [INFO] `private dispatchNodeSchema` 시그니처 — 공개 API에 영향 없음
- 위치: `assistant-tool-router.service.ts` L129–L167
- 상세: `dispatchNodeSchema`는 `private` 접근자이므로 외부 호출자·공개 인터페이스에 영향을 주지 않는다. `dispatchExplore` 공개 메서드의 시그니처(`toolName`, `args`, `ctx` → `Promise<ExploreDispatchResult>`)는 변경되지 않았다. 기존 호출자(`workflow-assistant-stream.service.ts`)에서 서명 불일치 없음.
- 제안: 조치 불필요.

## 요약

이번 변경(M-3 1단계 review fix)은 `get_node_schema` 캐시/하드스톱 로직을 `private dispatchNodeSchema()` 메서드로 순수하게 이동하고, `asString` 사용을 통일하며, 테스트를 보강한 behavior-preserving 리팩터링이다. 의도치 않은 전역 상태 변경, 새 전역 변수 도입, 환경 변수 읽기/쓰기, 예상 외 파일시스템 부작용, 공개 API 시그니처 변경, 외부 네트워크 호출, 이벤트/콜백 변경이 일체 없다. `schemaCache` 변이는 turn-scoped 파라미터 범위 내 의도된 동작이며, `AssistantToolRouter` 자체가 무상태 singleton으로 설계돼 요청 간 상태 오염 경로도 없다.

## 위험도

NONE
