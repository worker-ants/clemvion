# 동시성(Concurrency) 리뷰 결과

## 발견사항

해당 없음 — 이 변경에는 실질적인 동시성 위험이 없습니다.

아래는 검토 과정에서 확인한 주요 패턴과 그 안전성 근거입니다.

### [INFO] schemaCache `hits += 1` 비원자적 연산
- 위치: `assistant-tool-router.service.ts` — `dispatchExplore`, `get_node_schema` 캐시 히트 분기
- 상세: `cached.hits += 1`은 읽기-변경-쓰기 복합 연산이나, Node.js 단일 이벤트 루프에서 해당 분기는 `await` 없이 동기 실행됨. `schemaCache`는 `streamMessage` 호출마다 `new Map()`으로 생성되어 턴 단위 독립 객체이며, 동일 턴 내 도구 dispatch는 sequential loop 구조이므로 경쟁 조건 없음.
- 제안: 현재 구조(single-thread event loop + sequential dispatch)에서는 변경 불필요.

### [INFO] AssistantToolRouter singleton의 무상태성 검증
- 위치: `assistant-tool-router.service.ts` — `@Injectable()` 클래스
- 상세: 인스턴스 변수가 `readonly exploreTools` DI 의존성 하나뿐이며 변경되지 않음. 모든 turn-scoped 상태(`schemaCache`, `shadow`, `workspaceId`, `currentWorkflowId`)는 `ExploreDispatchContext` 파라미터로만 전달되어 동시 요청 간 상태 공유가 없음. 무상태 singleton 설계 의도가 구현에 정확히 반영됨.
- 제안: 해당 없음.

### [INFO] buildVerifyWorkflowResult의 shadow.snapshot() 호출 타이밍
- 위치: `assistant-tool-router.service.ts` — `buildVerifyWorkflowResult`
- 상세: `shadow.snapshot()` 반환값을 즉시 소비(filter, map)하고 `await` 없이 return 완료. 동일 turn 내 edit 도구가 shadow를 변경하더라도 sequential dispatch 루프 구조상 `dispatchExplore` 실행 중 shadow가 변경되는 interleaving이 없음.
- 제안: 해당 없음.

## 요약

이 변경(M-3 1단계 AssistantToolRouter 추출)은 NestJS + Node.js 단일 이벤트 루프 환경의 순수 refactor다. 신설된 `AssistantToolRouter`는 완전 무상태 singleton으로 turn-scoped 상태를 모두 `ExploreDispatchContext` 파라미터로 위임받아 처리하며, `schemaCache`의 `hits` 변경 연산은 `await` 경계 없이 동기 실행되어 실질적 경쟁 조건이 없다. `async/await` 패턴은 모두 올바르게 사용되고 있으며(`await` 누락 없음), 이벤트 루프 블로킹 우려도 없다. 동시성 관점에서 지적할 이슈가 없는 변경이다.

## 위험도

NONE
