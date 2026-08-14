### 발견사항

- **[INFO]** 재귀 strip 이 얕은 복사(depth-1)에서 트리 전체 순회로 바뀌면서, `emitExecutionEvent`/`emitNodeEvent`/`getStatus` 모두에서 **동기(synchronous) CPU 비용이 payload 크기에 비례**하게 됐다 — 이벤트 루프 블로킹 관점에서 정보 제공.
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:84`(`stripDeep`, 재귀 트리 순회) — 호출부: `codebase/backend/src/modules/websocket/websocket.service.ts`(`emitExecutionEvent`/`emitNodeEvent` 내 `stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` 호출), `codebase/backend/src/modules/external-interaction/interaction.service.ts`(`stripAndRedact` → `stripExternalOnlyFields(value, MAX_REDACT_DEPTH)`)
  - 상세: `stripDeep`은 `await` 없는 순수 동기 함수이므로 실행 중 Node 이벤트 루프는 다른 콜백을 처리할 수 없다. 종전 구현은 최상위 필드만 검사하는 O(필드 수) 얕은 삭제였지만, 이번 변경은 `maxDepth`(=`MAX_SANITIZE_DEPTH`=10, `MAX_REDACT_DEPTH`)까지 전체 서브트리를 내려가는 O(payload 크기) 순회다. AI 대화 payload 기준 실측(+20.2 µs/emit, JSDoc 명시)은 이벤트 루프를 유의미하게 막지 않는 수준이지만, `node 이벤트는 현재 llmCalls 를 포함하지 않으나… 방어심층화`로 **모든 node 이벤트**(대용량 HTTP 응답 JSON 등 `llmCalls`를 가질 수 없는 페이로드 포함)에도 동일 순회가 걸린다. 이 worst-case(대용량 non-AI `nodeOutput`)는 아직 벤치마크되지 않았다고 JSDoc/PLAN 이 이미 밝히고 있다(`14_30_35` WARNING 3, `spec-draft-eia-62-waiting-payload.md` 백로그 등재). 동시성 관점에서는 이 미측정 worst-case 가 곧 "단일 이벤트 루프를 얼마나 오래 점유하는가"의 질문과 정확히 겹친다 — 순회 시간이 커지면 그 시간만큼 같은 프로세스의 다른 요청/이벤트 처리가 지연된다(다중 사용자 fan-out 환경이므로 영향이 요청 1건에 그치지 않는다).
  - 제안: 신규 조치 요구 아님(이미 성능 리뷰어가 지적·추적 중인 항목과 동일 근본 원인). 다만 후속 측정 시 "이벤트 루프 점유 시간"을 지표로 명시해 두면 이 항목(동시성 관점 이벤트 루프 블로킹)과 성능 항목(처리량)을 같은 데이터로 동시에 닫을 수 있다.

- **[INFO]** (Positive) 신규 `stripExternalOnlyFields`는 module-level 공유 가변 상태(캐시·락)를 두지 않는 순수 함수이며, 기존 `SANITIZE_CACHE`(WeakMap, 동기 get/set)와도 상호작용하지 않는다 — race condition 표면이 없다.
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:84`(`stripDeep`) vs `codebase/backend/src/modules/websocket/websocket.service.ts:237`(`SANITIZE_CACHE`)
  - 상세: `stripDeep`은 인자로 받은 값만 읽고 `depth`/`maxDepth`/지역 변수 `out`만 사용하는 lazy clone-on-write 순수 함수다. `await` 지점이 없어 실행 도중 다른 태스크가 끼어들어 부분 상태를 관측할 수 없고(단일 스레드 JS 실행 특성상 원자적), 입력을 변형하지 않으므로(JSDoc 명시 계약) 같은 객체를 여러 호출부(WS fanout, REST `getStatus`)가 동시에(다른 매크로태스크에서) 넘겨도 서로 간섭하지 않는다. 이전 라운드(`11_02_16` WARNING 2)에서 identity 캐시(WeakMap) 추가를 **의도적으로 유예**한 이유도 "sanitize 는 캐시 적중인데 strip 은 아닌 조합"처럼 **두 캐시의 무효화 시점이 갈리는 조합 버그**를 막기 위한 것으로, 동시성/일관성 관점에서 합리적인 판단이다.
  - 제안: 없음(확인용 positive finding). 추후 identity 캐시를 도입한다면 `SANITIZE_CACHE`와 동일 키(입력 identity)·동일 무효화 시점을 공유하는 설계를 권장 — 두 캐시가 서로 다른 시점에 무효화되면 "한쪽만 stale"인 조합이 재발할 수 있다.

- **[INFO]** `getStatus`(REST)의 `stripAndRedact` 호출은 `repo.findOne`/`nodeRepo.findOne` 결과(비동기 DB 조회 결과)에 대해 동기적으로 적용되며, 두 조회 사이·조회와 strip 사이에 `await` 로 인한 재진입 지점이 있지만 각 요청은 독립적인 로컬 변수(`nodeExec`, `execution`)만 다루므로 요청 간 경쟁 조건은 없다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts`(`stripAndRedact` 함수 및 `getStatus` 내 waiting/terminal 세 호출부)
  - 상세: 확인 목적의 기록 — 구조적으로 문제 없음. 세 출구를 한 헬퍼로 통합한 것(`14_30_35` CRITICAL 처방)은 오히려 "출구를 각자 조립하면 한 번에 하나씩만 고쳐진다"는 동시-편집 휴먼 에러를 구조적으로 차단하는 효과가 있어 동시성 리뷰 관점에서도 긍정적이다.
  - 제안: 없음.

### 요약
이번 diff 는 `llmCalls` raw 프롬프트 유출을 막는 depth-무관 필드 strip 로직으로, 신규 코드(`stripDeep`/`stripExternalOnlyFields`/`stripAndRedact`)는 공유 가변 상태·락·비동기 조합이 없는 순수 동기 함수이고 기존 `SANITIZE_CACHE`(WeakMap)·`ExecutionSeqAllocator`(Redis atomic INCR) 등 동시성에 민감한 기존 메커니즘은 손대지 않았다. 진짜 동시성 카테고리(경쟁 조건·데드락·원자성·스레드 세이프티)에서 새로 도입된 위험은 없다. 유일하게 언급할 가치가 있는 것은 depth-1 얕은 삭제에서 depth-bound 전체 트리 순회로 바뀌며 이벤트 루프 점유 시간이 payload 크기에 비례하게 됐다는 점인데, 이는 이미 성능 리뷰어가 이전 라운드에서 지적·측정·plan 백로그 등재까지 마친 항목과 동일 근본 원인이라 신규 발견으로 상신하지 않고 동시성 관점의 보강 설명(INFO)으로만 남긴다.

### 위험도
NONE
