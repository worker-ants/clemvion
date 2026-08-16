# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `ExecutionsService.stop()` 공개 시그니처·런타임 정체성 변경 — 호출자 3곳 실측 확인, 영향 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `stop()` (약 821번째 줄 부근, `async stop(id: string): Promise<ResponseExecution>`)
  - 상세: `stop(id): Promise<Execution>` → `Promise<ResponseExecution>` 로 반환 타입이 좁아지고, 반환 객체의 **정체성도 함께 바뀐다** — 종전엔 재조회한 엔티티 참조를 그대로 돌려줬지만(`findById`/`getChain` 과 달리 strip 관문을 거치지 않던 유일한 공개 경로), 이제 `toResponseExecution()` 이 매번 새로 만든 **마스킹된 복사본**을 돌려준다. 호출자를 전수 grep 했다: `executions.controller.ts:145`(응답으로 직렬화 — `ApiOkWrappedResponse(ExecutionDto, …)` 계약과 구조적으로 호환), `external-interaction/interaction.service.ts:226,248`, `hooks/hooks.service.ts:407` — 이 세 곳 모두 `await this.executionsService.stop(...)` 결과를 **사용하지 않고 버린다**(직접 읽음으로 확인). `trigger`/`executor` 가 타입에서 사라졌지만 이 경로의 `findOne` 은 애초에 그 관계를 로드하지 않아(실측, JSDoc 에도 명시) 값이 사라지는 필드는 없다. 이 항목은 이미 1~2라운드 리뷰(`review/code/2026/08/16/17_12_34/` side_effect W1)에서 지적·문서화·실측이 끝난 상태이고, 이번 검토에서 독립적으로 재확인한 결과 잔여 리스크는 낮다.
  - 제안: 조치 불필요 — 다만 향후 이 메서드를 새 소비자가 재사용할 때 "엔티티 참조가 아니라 매번 새 복사본" · "trigger/executor 는 타입에 없음" 두 가지를 놓치기 쉬우니 JSDoc(이미 있음)을 유지할 것.

- **[INFO]** `ExecutionsService` 내부 private 메서드 개명(`stripPrivateRelations`→`toResponseExecution`, 신규 private `stopInternal` 분리) — 외부 참조 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `toResponseExecution()`, `stopInternal()`
  - 상세: 둘 다 `private` 이고 저장소 전체를 grep 한 결과 클래스 밖에서 이름으로 참조(스파이·리플렉션 포함)하는 코드가 없다. Nest 데코레이터(`@UseInterceptors` 등)도 서비스 메서드가 아니라 컨트롤러 메서드에만 걸려 있어, 메서드 분리·개명이 프레임워크 메타데이터 배선에 영향을 주지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 공개 export 타입 2개(`ResponseExecution`, `ResponseNodeExecution`) 도입 — 인터페이스 표면 확장, 파괴적 변경 아님
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (파일 상단, `export type ResponseExecution`/`export type ResponseNodeExecution`)
  - 상세: 이 서비스 모듈의 공개 표면에 `export type` 2개가 추가된다. 저장소 전체에서 아직 이 타입을 import 하는 다른 파일은 없다(grep 확인). 기존 export `ExecutionDetailWithTrigger` 의 필드 타입이 `Execution`/`NodeExecution[]` 에서 `ResponseExecution`/`ResponseNodeExecution[]` 로 narrowing 되지만, 이는 `error` 의 nullability 를 정직하게 드러내는 것뿐이고 이 타입을 소비하는 곳(WS gateway·controller)은 구조적으로 호환된다.
  - 제안: 조치 불필요.

- **[INFO]** 응답 wire 페이로드 바이트 변화 — 4개 REST 표면 + WS `execution.snapshot` (문서화·의도된 변경)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`findById`/`findByWorkflow`→`toExecutionDto`/`getChain`/`stop`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `toNodeExecutionDto`, 소비처 `codebase/backend/src/modules/websocket/websocket.gateway.ts:399-404`(`findById` 재사용)
  - 상세: `Execution.error`/`NodeExecution.error` 의 `message`/`details` 안에 자격증명 형태 부분문자열(`Bearer …`, `postgres://user:pw@host` 등)이 있으면 응답 바이트가 `***` 로 치환된다. 이는 egress-only 마스킹(DB 원문은 유지, 테스트 `'DB 원문은 건드리지 않는다 — egress-only (§R17)'` 로 고정)으로 의도된 보안 수정이며 CHANGELOG·spec §R17·DTO JSDoc·plan 트래커에 전부 명시돼 있다. WS `execution.snapshot` 이벤트는 `findById` 를 그대로 재사용하므로 별도 코드 변경 없이 함께 마스킹된다 — 이는 이 PR 이 명시적으로 의도한 결과(종전 갭: emit 경로만 마스킹되고 읽기 경로는 원문이었던 결함)다.
  - 제안: 조치 불필요. 인터페이스 소비자(프런트엔드)가 이 바이트 변화에 의존한 파싱을 하지 않는지는 이미 documentation/user_guide_sync 리뷰어가 별도 라운드에서 확인했다(그레이존 INFO, 조치 불요 판정).

- **[INFO]** 기존 전역 캐시(`DEEP_REDACT_CACHE` WeakMap, `sanitize-error-message.ts`)에 신규 소비 표면 추가 — 새 side effect 아님
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:4`(`import { deepRedactSecrets }`), 정의부 `codebase/backend/src/shared/utils/sanitize-error-message.ts`(module-level `const DEEP_REDACT_CACHE = new WeakMap<object, unknown>();` — 이번 diff 밖, 무변경)
  - 상세: 이번 diff 로 신설된 `redactStoredErrorForResponse` 가 기존 `deepRedactSecrets` 를 호출하면서, 이미 존재하던 module-level WeakMap 캐시의 호출 표면이 하나 늘어난다. 캐시 키가 object identity(WeakMap)라 요청 간 데이터 오염 경로는 없고, 캐시 자체는 이번 diff 의 수정 대상이 아니다. 새로운 전역 변수 도입은 아니지만 "전역 가변 상태를 건드리는 코드 경로가 늘었다"는 사실은 기록해 둔다.
  - 제안: 조치 불필요.

- **[INFO]** 인스턴스 `snapshotCache`(`findById` LRU, 기존 무변경 구조)가 캐싱하는 내용물이 이제 마스킹된 값 — 마스킹이 캐시 적재 **이전**에 적용됨을 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `findById()` 본문(트랜잭션 콜백 반환 → `this.writeSnapshotCache(id, snapshot)` 호출, 트랜잭션 콜백 밖 마지막 줄들)
  - 상세: `writeSnapshotCache` 호출은 `toResponseExecution`/`reconciledNodeExecutions` 마스킹이 이미 적용된 `snapshot` 객체를 저장한다 — 즉 캐시 자체에 원문이 남는 경로는 없다. 테스트 `①-b findById 의 마스킹은 캐시 안쪽이다`가 이를 캐시 히트 2회차까지 단언해 고정한다. `readSnapshotCache`/`writeSnapshotCache` 함수 정의 자체(LRU 크기·eviction 정책)는 이번 diff 대상이 아니다(grep 으로 diff 밖 확인).
  - 제안: 조치 불필요.

- **[INFO]** `plan/` 문서 6건의 `in-progress/` → `complete/` 파일시스템 이동(`git mv`) — 정책 부합, 코드 부작용 아님
  - 위치: `plan/complete/eia-stalled-atomicity.md`, `eia-terminal-emit-facade.md`, `eia-terminal-error-sanitize.md`, `spec-draft-eia-error-masking-catalog.md`, `spec-draft-eia-r8-alignment.md`, `spec-draft-ws-types-canonical-location.md` (신규 생성, `plan/in-progress/` 동명 파일 삭제)
  - 상세: 예상치 못한 파일시스템 부작용이 아니라 `.claude/docs/plan-lifecycle.md §3`(같은 diff 로 갱신됨)가 명시하는 "완료 plan 은 작업 PR 안의 별도 commit 으로 이동" 관행을 그대로 따른 것이다. 코드 실행 경로에는 영향이 없다.
  - 제안: 조치 불필요.

- **[INFO]** DB write 경로 비오염 확인 — `redactStoredErrorForResponse` 는 입력을 변이하지 않고, 마스킹된 값이 DB 로 역류하는 경로 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` (`export function redactStoredErrorForResponse`, 약 28~35번째 줄), 소비처 4곳
  - 상세: `deepRedactSecrets` 는 copy-on-change(변경 없으면 같은 참조, 있으면 새 객체)라 입력 엔티티를 in-place 변이하지 않는다. 마스킹 적용 지점(`toResponseExecution`/`toExecutionDto`/`findById` 의 `nodeExecutions` map)은 모두 조회 이후·응답 조립 직전이며, 이후 이 값을 다시 `save()`/`update()` 하는 코드 경로는 diff·주변 코드 어디에도 없다(테스트 `'DB 원문은 건드리지 않는다 — egress-only (§R17)'` 로 고정).
  - 제안: 조치 불필요.

- **[INFO]** 환경 변수·네트워크 호출·이벤트 emit 신규 도입 없음
  - 위치: 변경된 backend 소스 전체(`redact-stored-error.ts`, `executions.service.ts`, `background-runs.service.ts`, DTO 2개)
  - 상세: `process.env`, `fetch`/`axios`/`http.request`, `.emit(` 패턴을 diff 추가 줄 전체에서 검색한 결과 0건. 순수 in-memory 정규식 기반 변환 함수와 그 4개 호출부 배선만 추가됐다.
  - 제안: 조치 불필요.

## 요약

실질 코드 변경은 신규 leaf 유틸 `redact-stored-error.ts`(순수 함수, 입력 비변이, 전역 상태 미도입) 와 그 소비처 4곳(`ExecutionsService.findById/findByWorkflow/getChain/stop`, `BackgroundRunsService.toNodeExecutionDto`)에 egress 마스킹을 배선하는 리팩터로 좁혀진다. 가장 부작용 관점에서 무게가 있는 지점은 `stop()` 의 공개 시그니처·반환 정체성 변경(엔티티 참조 → 마스킹 복사본)인데, 호출자 3곳을 직접 grep·실측한 결과 응답 표면 하나(HTTP 컨트롤러)만 영향을 받고 나머지 둘은 반환값을 쓰지 않아 파괴적 영향이 없다. 이 지점은 이미 이전 라운드(`17_12_34`)의 side_effect 리뷰에서 지적·해소됐고, 이번 독립 검토에서도 같은 결론으로 재확인됐다. 전역 변수 신설, 환경 변수 접근, 네트워크 호출, 예기치 않은 이벤트 emit, DB write 경로 오염은 발견되지 않았다. `plan/**` 파일 이동은 프로젝트 정책이 명시한 관행이라 부작용이 아니라 정상 워크플로다.

## 위험도

LOW
