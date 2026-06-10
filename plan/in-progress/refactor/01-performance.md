# Refactor 백로그 — 성능 (2026-06-10 전수 감사)

> 인덱스: [README.md](./README.md). Critical 3 / Major 8 / Minor 4 — **spec 대조(2026-06-10) 후 유효 14건 / 철회 1건(#9)**.
> **spec 대조 판정 분포**: A 0 / B 6 / C 0 / D 8 / E 1. (A=의도된 설계, B=spec 무언급, C=spec 괴리, D=부분 언급—본 쟁점 미커버, E=철회)
> **중복 참조**: #1 은 [05-database.md](./05-database.md) M-4(동일 근원)와 같은 항목이며 본 파일이 본문 소유.
> 옵션 비교·권장안 보강 (2026-06-10)

## Critical

- [ ] **#1 [C] resume rehydration N+1 쿼리** — `backend/src/modules/execution-engine/execution-engine.service.ts:1303-1330`
  `resumeFromCheckpoint` 계열이 이전 실행 노드의 각 nodeId 마다 `nodeExecutionRepository.findOne` 을 루프 내 직렬 `await`. ForEach/Loop 워크플로 재개 지연의 직접 원인.
  - **spec 대조**: D — `4-execution-engine.md §7.5` 는 rehydration 의미만 규정, 쿼리 전략 무언급. Rationale "turn 마다 rehydration 비용은 사람-페이스라 수용" 은 rehydration 자체의 trade-off 수용이지 N+1 까지 수용한 게 아니며, §7.4 가 "rehydration setup latency" 를 운영 리스크로 직접 지목 — **개선이 오히려 spec 정합적**.
  - **개선 방안**:
    1. `seenNodeIds` 수집 후 `find({ where: { executionId, nodeId: In([...]), status: COMPLETED }, order: { startedAt: 'DESC' } })` 단일 쿼리 → `Map<nodeId, NodeExecution>` 인덱싱(nodeId 당 최신 1건 = DESC 첫 등장). 또는 `DISTINCT ON (node_id) ... ORDER BY node_id, started_at DESC` raw 쿼리로 DB 측 dedup — V034 `(execution_id, node_id, started_at DESC)` 인덱스가 정확히 커버(추가 인덱스 불요).
    2. log 순서(`id ASC`) 기준 순회는 유지하고 Map lookup 으로 대체. waiting node outputData 복원 분기 무변경.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 단일 `In([...])` 쿼리 + 앱측 Map dedup (DESC 첫 등장) | 쿼리 N+1→2. TypeORM repository API 유지(엔티티 매핑·타입 보존). log 순회(`id ASC`)·waiting node outputData 복원 분기 무변경이라 회귀 면 최소 | "nodeId 당 최신 COMPLETED 1건" dedup 을 앱 코드가 재구현 — DESC 첫 등장 규칙이 어긋나면 loop iteration 출력이 옛 값으로 복원 |
    | B. `DISTINCT ON (node_id) ... ORDER BY node_id, started_at DESC` raw 쿼리 | dedup 을 DB 가 수행 — 전송 row 수 최소. V034 `(execution_id, node_id, started_at DESC)` 인덱스가 정확히 커버(추가 인덱스 불요) | raw SQL 로 TypeORM 엔티티 매핑 이탈 + PG 전용 문법 의존. 왕복 수는 A 와 동일(2회)라 추가 이득은 전송량뿐 |
    | C. 보류(현상 유지) | 변경 비용 0 | §7.4 가 "rehydration setup latency" 를 운영 리스크로 직접 지목 — ForEach/Loop 재개 지연 지속, 개선이 오히려 spec 정합적인 상태 방치 |
  - **권장**: A — 왕복 수가 B 와 같고(2회), repository API 안에서 기존 순회 구조(`id ASC` + Map lookup)를 그대로 유지해 회귀 면이 가장 좁다. "최신 COMPLETED 1건" 의미론은 unit test 로 고정 가능하며, B 의 raw 쿼리는 전송량 절감 대비 PG 전용 문법·매핑 이탈 비용이 더 크다.
  - 검증: park→worker kill→무손실 재개 dockerized e2e + 노드 50개 재개 시 쿼리 수 2건 측정(TypeORM logger). / 회귀 위험: "nodeId 당 최신 COMPLETED 1건" 의미론이 어긋나면 loop iteration 출력이 옛 값으로 복원. / spec 갱신: 불요.

- [ ] **#2 [C] KB 삭제 시 S3 직렬 삭제 루프** — `backend/src/modules/knowledge-base/knowledge-base.service.ts:678-684`
  문서 N건의 S3 객체를 `for...of await` 직렬 삭제 (100건 × ~100ms ≈ 10초 블로킹).
  - **spec 대조**: D — `data-flow/4-file-storage.md` 흐름표가 "for 루프로 호출" 을 code-sync 로 기록하나, Rationale 이 정당화하는 것은 **best-effort/warn 정책이지 직렬 실행이 아님**. 병렬화는 best-effort 의미론과 완전 호환.
  - **개선 방안**:
    1. 20건 청크 `Promise.allSettled(chunk.map(d => s3Service.delete(d.fileUrl)))` 로 교체, rejected 는 fileUrl 목록 일괄 warn.
    2. (선택) `s3.service.ts` 에 `deleteMany(keys[])` — AWS `DeleteObjectsCommand`(1000키/요청)로 왕복 1회. MinIO 호환 확인 필요.
    3. `removeDocument` 단건 경로는 무변경.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 20건 청크 `Promise.allSettled` + 기존 `s3Service.delete` | `s3.service.ts` 무변경(현재 단건 `DeleteObjectCommand` 만 존재). best-effort/warn 정책 — Rationale 이 정당화하는 유일한 의미론 — 과 완전 호환. rejected 일괄 warn 으로 관측성 유지 | 왕복 수는 N 그대로(동시화만, 지연 ~1/20). 청크 상한이 rate-limit 완화 장치라 튜닝 여지 |
    | B. `deleteMany(keys[])` — `DeleteObjectsCommand`(1000키/요청) | 왕복 1회로 최소 — 100건 ≈ 10초 → 1 RTT | `s3.service.ts` 신규 표면 추가 + MinIO 호환 확인 선행 필요. 부분 실패가 응답 body `Errors` 배열로 와서 best-effort warn 파싱 로직 별도 구현 |
    | C. 보류(현상 유지) | 변경 비용 0 | 100건 × ~100ms ≈ 10초 직렬 블로킹 지속 |
  - **권장**: A — best-effort 의미론을 무손상 유지하면서 지연을 청크 폭만큼 줄이고, 기존 단건 delete mock 을 재사용해 검증 면이 좁다. B 는 MinIO 호환 검증이라는 외부 의존이 있어 후속 최적화로 분리한다. 어느 쪽이든 `data-flow/4-file-storage.md` "for 루프" code-sync 문구 갱신(planner) 동반은 동일.
  - 검증: S3 mock 부분 실패 시 KB row 삭제 진행 + warn 확인, 100건 삭제 소요시간 측정. / 회귀 위험: 병렬화 rate-limit — 청크 상한으로 완화. / **spec 갱신: 필요** — `data-flow/4-file-storage.md` 의 "for 루프" code-sync 문구 갱신 (project-planner).

- [ ] **#3 [C] `sortByStartedAt` — WS 이벤트마다 전체 재정렬 O(N² log N)** — `frontend/src/lib/stores/execution-store.ts:328-335,482-485`
  `addNodeResult` 마다 전체 정렬 + comparator 내 `new Date()` 반복 생성. 대형 실행에서 메인 스레드 블로킹.
  - **spec 대조**: D — `3-workflow-editor/3-execution.md §10.5` 의 "시간순 컴팩트 리스트" 는 spec 약속이나 per-event 전체 재정렬 전략은 무언급. iteration 별 행 요구로 N 이 커질 수 있음을 spec 이 함의.
  - **개선 방안**:
    1. `NodeResult` 에 `startedAtEpoch` 캐시(수신 시 1회 `Date.parse`), comparator 를 숫자 비교로.
    2. append 분기: startedAt 단조 증가 가정 — "마지막보다 크면 push, 아니면 binary-search 삽입" 으로 전체 sort 제거. update 분기는 startedAt 변경 시에만 재삽입.
    3. 대안(더 단순): store 비정렬 유지 + 타임라인 `useMemo` selector 에서 정렬 (렌더 프레임당 1회 amortize). #8 과 한 PR 권장.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. epoch 캐시 + append/binary-insert 로 store 내 정렬 유지 (방안 1-2) | 읽기 측(컴포넌트) 무변경. 이벤트당 O(log N) — per-event 전체 sort 제거 | "startedAt 단조 증가" 가정의 append 분기 + update 시 재삽입 분기 추가. 동률 항목 stable-sort 상대 순서를 직접 관리해야 함 |
    | B. store 비정렬 + 타임라인 `useMemo` selector 정렬 (방안 3) | store 의 정렬 책임 자체를 제거 — 렌더 프레임당 1회 amortize. #8 의 전면 Map 전환과 구조적으로 결합(plan 명시: 한 PR 권장) | 타임라인 외 소비처가 정렬을 가정하면 selector 경유로 강제 필요. 렌더마다 O(N log N)(단 이벤트당이 아니라 프레임당 1회) |
    | C. 보류(현상 유지) | 변경 비용 0 | per-event 전체 재정렬 + comparator 내 `new Date()` 반복 생성 지속 — iteration 별 행 요구로 N 증가를 spec(§10.5)이 함의 |
  - **권장**: B — plan 스스로 "#8 과 한 PR 권장" 으로 묶은 경로이고, #8 의 전면 Map 전환이 단독으로는 정렬 로직과 충돌한다고 명시돼 있어 두 항목을 selector 패턴으로 함께 풀면 충돌 면이 한 번에 정리된다. A 의 startedAtEpoch 캐시(방안 1)는 B 에서도 comparator 비용 절감용으로 병용 가능하다.
  - 검증: 노드 500행 합성 실행 addNodeResult 1000회 프로파일 + 타임라인 순서 e2e 스냅샷 무변화. / 회귀 위험: startedAt 동률 항목의 stable-sort 상대 순서. / spec 갱신: 불요.

## Major

- [ ] **#4 [M] Dashboard `getSummary` 동일 범위 4+ 회 왕복** — `backend/src/modules/dashboard/dashboard.service.ts:58-135` (실측 6쿼리 5왕복)
  - **spec 대조**: B — `2-navigation/0-dashboard.md` Rationale 은 의미론(분모 정의 등)만 기록, 쿼리 전략 무언급.
  - **개선 방안**: 1. workflow count 2건 → `COUNT(*) FILTER (WHERE is_active)` 단일 쿼리. 2. execution 4건 → `COUNT(*) FILTER` + `AVG(...) FILTER` 단일 raw 쿼리(7d/prev7d/success/avg). 3. 파생 계산(반올림·changePercent)은 기존 로직 유지 — unit test 가 의미론 고정.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `COUNT(*) FILTER` / `AVG FILTER` raw 쿼리 통합 (5왕복→2) | 왕복 최소. 파생 계산(반올림·changePercent)은 기존 로직 유지라 unit test 가 의미론을 그대로 고정 | raw SQL 전환 — FILTER 조건 누락 시 분모 의미론(status 무관, Rationale 명시) 훼손 위험. 리포지토리 API 이탈 |
    | B. 기존 6쿼리 유지 + `Promise.all` 동시화 | 쿼리 텍스트 무변경이라 의미론 회귀 위험 0, diff 최소 | 왕복 수 그대로 6 — 지연만 max(쿼리)로 단축. 요청당 DB 커넥션 동시 점유 증가 |
    | C. 보류(현상 유지) | 변경 비용 0 | 동일 범위 6쿼리 5왕복 직렬 지속 |
  - **권장**: A — `dashboard.service.spec.ts` 기대값 무변화 검증이 계획에 이미 있어 FILTER 누락 회귀를 테스트가 잡고, 분모 의미론이 SQL 두 건 안에 모여 가독성도 오히려 좋아진다. B 는 커넥션 점유 증가 대비 이득이 부분적(왕복 수 불변)이다.
  - 검증: `dashboard.service.spec.ts` 기대값 무변화 + 왕복 2회 확인. / 회귀 위험: FILTER 조건 누락 시 분모 의미론(status 무관 — Rationale 명시) 훼손. / spec 갱신: 불요.

- [ ] **#5 [M] `assertNoContainerCycle` 전체 선형 순회 + Map 중복 생성** — `execution-engine.service.ts:7869-7884` (`planContainerBody` 의 `nodeMap`:7897 과 이중)
  - **spec 대조**: D — 런타임 사이클 검사(`CONTAINER_CYCLE` 거부)는 `1-data-model.md`·`0-canvas.md` 의 spec 의무, 알고리즘/비용은 무언급.
  - **개선 방안**: 1. `nodeMap` 선빌드 후 인자로 전달 — Map 이중 생성 제거. 2. `allNodes` 전수 스캔을 사전 계산된 children 배열(:7899)로 대체 — children 빌드를 cycle 검사 앞으로 이동. 3. (선택) ancestor-chain walk memoize.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `nodeMap` 선빌드 전달 + children 선계산 재사용 (방안 1-2) | Map 이중 생성(:7897)과 `allNodes` 전수 스캔 제거. `planContainerBody` 의 기존 children 배열(:7899)을 재사용하므로 신규 자료구조 없음 | children 빌드를 cycle 검사 앞으로 이동 — 검증 순서 변화로 에러 우선순위가 달라질 수 있어 테스트로 고정 필요 |
    | B. A + ancestor-chain walk memoize (방안 3 포함) | 깊은 중첩 컨테이너에서 추가 절감 | memoize 캐시 수명/무효화 관리 추가 — 컨테이너 중첩이 통상 얕아 실익이 측정되지 않은 선최적화 |
    | C. 보류(현상 유지) | 변경 비용 0 | 사이클 검사는 spec 의무(`CONTAINER_CYCLE` 거부)라 제거 불가 — 비용만 지속 |
  - **권장**: A — CONTAINER_CYCLE unit(자기/상호/자손 참조)이 이미 있어 순서 변화 회귀를 고정할 수 있고, 기존 자료구조 재사용만으로 이중 비용이 사라진다. B 의 memoize 는 측정 근거 없는 복잡도 추가라 보류.
  - 검증: CONTAINER_CYCLE unit(자기/상호/자손 참조) 전부 통과. / 회귀 위험: 검증 순서 변화로 에러 우선순위 달라질 수 있음 — 테스트로 고정. / spec 갱신: 불요.

- [ ] **#6 [M] `planParallelBody` BFS `queue.shift()` O(N²)** — `execution-engine.service.ts:8226-8239`
  - **spec 대조**: B — `10-parallel.md` 는 분기 의미론만 규정, 도달성 계산 알고리즘 무언급. 분기 그래프는 통상 수십 노드라 실효 낮음 — 저비용 정리.
  - **개선 방안**: 1. `let head = 0; while (head < queue.length)` 인덱스 포인터로 교체. 2. 엔진 내 다른 BFS 의 `.shift()` 도 grep 후 일괄 적용 검토.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `planParallelBody` 의 `queue.shift()` 만 인덱스 포인터로 교체 | 순회 순서 동일 — 회귀 위험 사실상 없음, diff 최소 | 엔진 내 다른 BFS 의 동일 패턴 잔존 |
    | B. grep 으로 엔진 내 `.shift()` BFS 일괄 교체 | 동일 안티패턴 일괄 종결 | 지점별 순회 의미 확인·검증 범위 확대 — 분기 그래프가 통상 수십 노드라 항목 자체의 실효가 낮은데 검증 비용만 커짐 |
    | C. 보류(현상 유지) | 변경 비용 0 | 저비용·무위험 정리 기회 상실 (spec 대조도 "저비용 정리" 로 분류) |
  - **권장**: A — "실효 낮음, 저비용 정리" 라는 항목 성격에 맞게 해당 지점만 교체하고, 다른 BFS 는 grep 결과만 기록해 후속 판단한다. 실효가 낮다고 판정된 항목에서 검증 범위를 키울 이유가 없다.
  - 검증: parallel ownership unit 무변화. / 회귀 위험: 사실상 없음(순회 순서 동일). / spec 갱신: 불요.

- [ ] **#7 [M] `buildSystemPrompt` 매 턴 노드 카탈로그 재직렬화** — `workflow-assistant/prompts/system-prompt.ts:52-83`
  - **spec 대조**: D — `4-ai-assistant.md §5` 가 "정적 콘텐츠 앞 배치로 prefix cache hit 향상" 을 설계 의도로 명시 + expression reference 캐시를 spec 에 기록 — node catalog 캐시는 **spec 이 채택한 동일 패턴의 미적용 잔여**.
  - **개선 방안**: 1. `expressionReferenceCache` 패턴 복제 — 모듈 스코프 캐시 + `resetNodeCatalogCacheForTesting`. 2. 테스트가 다른 defs 를 주입하므로 defs 배열 reference 를 무효화 키로(`WeakMap<NodeDefinitionView[], string>`). 3. (선택) 정적 블록 1~3+카탈로그 전체를 단일 prefix 문자열로 합쳐 캐시.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `expressionReferenceCache` 패턴 복제 + `WeakMap` defs-키 (방안 1-2) | spec §5 가 이미 채택한 동일 패턴 — 전례 코드·reset 헬퍼 규율 존재. 테스트의 다른 defs 주입과 호환(reference 키 무효화) | 모듈 스코프 캐시라 테스트 간 오염 가능 — `resetNodeCatalogCacheForTesting` 리셋 규율 필요 |
    | B. 정적 블록 1~3 + 카탈로그 전체를 단일 prefix 문자열로 캐시 (방안 3) | 직렬화·블록 결합 비용까지 1회로 — §5 의 prefix cache hit 의도에 최대 부합 | "5-block structural layout" describe 가 블록 단위 구조를 검증 — 합치는 범위에 따라 테스트 수정 동반 가능 |
    | C. 보류(현상 유지) | 변경 비용 0 | spec 이 채택한 캐시 패턴의 미적용 잔여 상태 유지 — 매 턴 카탈로그 재직렬화 지속 |
  - **권장**: A — 기존 expressionReferenceCache 와 동일한 캐시+리셋 규율을 복제하는 최소 경로이며, 기존 describe 무수정 통과가 검증 기준이라 회귀 면이 좁다. B 는 A 적용 후에도 직렬화 비용이 남는다는 프로파일 근거가 생길 때 확장.
  - 검증: "5-block structural layout" describe 통과 + 동일 defs 2회 호출 시 render 1회 spy. / 회귀 위험: 테스트 간 캐시 오염 — 리셋 규율로 차단. / spec 갱신: 불요(원하면 §5 에 한 줄 — planner 재량).

- [ ] **#8 [M] `nodeResults` Array 선형 탐색 — 이벤트마다 O(N)** — `use-execution-events.ts:763,853,918,963` + `execution-store.ts:441-450`
  - **spec 대조**: B — WS 이벤트 계약·표시 요건만 spec 규정, store 자료구조 무언급.
  - **개선 방안**: 1. `nodeResultIndex: Map<nodeExecutionId, number>` 파생 인덱스를 state 와 동기 유지 + `latestIndexByNodeId` 보조 인덱스. 2. 4곳 `.find()` 를 lookup selector 로 교체. 3. 전면 Map 전환은 #3 의 selector 정렬 전환과 **한 PR 로** — 단독 전환 시 정렬 로직과 충돌.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 파생 인덱스 Map(`nodeResultIndex` + `latestIndexByNodeId`) 추가 (방안 1-2) | Array 구조 유지로 #3 정렬 로직과 충돌 없음 — 단독 PR 가능. 4곳 `.find()` 교체만 | 인덱스-state 동기 유지 코드가 모든 변이 경로에 필요 — 어긋나면 ghost row 류 버그 재발. 배열+인덱스 이중 자료구조 상시 부담 |
    | B. 전면 Map 전환 + #3 selector 정렬과 한 PR (방안 3) | 이중 자료구조 동기화 부담 자체가 없음. plan 이 명시한 결합 경로(#3 과 한 PR)로 구조를 한 번에 정리 | "nodeExecutionId 없으면 해당 nodeId 최신 행" fallback(ghost row fix) 의미론을 Map 위에서 재현해야 함 — 회귀 테스트 필수. PR 범위 확대 |
    | C. 보류(현상 유지) | 변경 비용 0 | 이벤트마다 O(N) 선형 탐색 4곳 지속 |
  - **권장**: B — plan 자체가 "전면 Map 전환은 #3 의 selector 정렬 전환과 한 PR 로(단독 전환 시 정렬 로직과 충돌)" 라고 명시했고 #3 권장이 selector 정렬(B)이므로, 결합하면 A 의 이중 자료구조 동기화 리스크를 처음부터 제거한다. ghost row 회귀 테스트가 이미 검증 항목에 포함돼 있어 fallback 의미론 재현을 고정할 수 있다.
  - 검증: iteration dedup·Carousel ghost row 회귀 테스트 포함 통과 + 500노드 스트림 프로파일. / 회귀 위험: "nodeExecutionId 없으면 해당 nodeId 최신 행" fallback 의미론(ghost row fix) 재현 필수. / spec 갱신: 불요.

- [x] ~~**#9 [M] 통계 페이지 useQuery 5개 `staleTime` 미설정**~~ — **철회 (2026-06-10 spec 대조)**
  - **사유**: E — `frontend/src/lib/providers.tsx:14-19` 에 **글로벌 default `staleTime: 60_000` 이 이미 존재** (`workflows/page.tsx:137` 주석으로 교차 확인). "리포커스마다 재발화" 전제가 사실관계 오류. 60초 경과 후 재발화는 default 설계의 의도적 동작.
  - (선택 잔여) 통계는 `staleTime: 5분` + `refetchOnWindowFocus: false` 가 더 적합할 수 있으나 측정된 문제 없음 — 필요 시 별건.

- [ ] **#10 [M] 워크플로 임포트 — 트랜잭션 내 개별 save 루프 N+P+M 왕복** — `workflows.service.ts:270-337`
  - **spec 대조**: B — import 는 spec 에 엔드포인트 한 줄(`1-workflow-list.md:126`)만, 삽입 전략 무언급.
  - **개선 방안**: 1. 노드 UUID 앱 측 사전 생성 → `nodeIdMap` 을 insert 전 확정. 2. containerIndex/toolOwnerIndex 를 사전 매핑해 **insert 한 번에 포함** — 2차 update 루프 제거. 3. `manager.insert(Node, [...])` + `insert(Edge, [...])` 배치. 4. **주의**: `insert` 는 `@BeforeInsert` hook·cascade 건너뜀 — entity hook 부재 확인 후 적용(있으면 배열 `save` 로 대체).
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. UUID 사전 생성 + 사전 매핑 + `manager.insert` 배치 (방안 1-3) | 쿼리 N+P+M+1 → ~3, 2차 update 루프 제거. 방안 4 의 hook 우려는 실측 해소 — Node/Edge 엔티티에 `@BeforeInsert` 부재(코드베이스 전체에서 `user.entity.ts` 만 사용) | UUID 앱측 생성·remap 사전 확정 로직 추가. cascade 미동작 전제를 향후 엔티티 변경 시에도 유지해야 함(hook 추가 시 깨짐) |
    | B. 배열 `save(Node, [...])` 로 배치 | hook/cascade 의미론 보존 — 엔티티 변경에 둔감. 기존 remap 흐름 유지 | `save` 는 영속성 검사·entity reload 동반이라 `insert` 대비 왕복 절감 폭이 작음 — 사전 생성 UUID 와 결합 시 존재 확인 쿼리 추가 |
    | C. 보류(현상 유지) | 변경 비용 0 | 트랜잭션 내 개별 save 루프 — import 노드/엣지 수에 비례한 N+P+M 왕복 지속 |
  - **권장**: A — 차단 조건이던 entity hook 부재가 확인됐고, import unit 이 remap·invalid index·default LLM 주입 의미론을 이미 고정하므로 insert 전환의 회귀를 잡을 수 있다. 단, Node/Edge 에 hook 이 추가되면 깨지는 전제이므로 코드 주석으로 명시할 것.
  - 검증: import unit(컨테이너/toolOwner remap, invalid index, default LLM 주입) 통과 + 쿼리 수 N+P+M+1 → ~3 측정. / 회귀 위험: UUID 사전 생성·hook 우회. / spec 갱신: 불요.

- [ ] **#11 [M→m 강등] `clearLlmDefaultConfigCache` — 전체 키 선형 스캔** — `execution-engine.service.ts:7449-7456`
  - **spec 대조**: B — ai-review INFO 산물(코드 주석 명시), spec 표면 아님. **실효 낮음**: 키 수 상한이 "동시 실행 수 × workspace(실질 1)" 라 스캔 비용 무시 가능 — 우선순위 최하/wontfix 후보로 강등.
  - **개선 방안**: 적용한다면 `Map<executionId, Map<workspaceId, Promise<boolean>>>` 이중 Map 으로 O(1) delete + single-flight 의미론 유지. 또는 현 구조 유지 종결.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `Map<executionId, Map<workspaceId, Promise<boolean>>>` 이중 Map | O(1) delete + single-flight 의미론 유지 | 키 수 상한이 "동시 실행 수 × workspace(실질 1)" 라 절감이 측정 불가 수준 — 구조 변경 비용만 발생 |
    | B. 측정 후 결정 | 절차적 정합 | 키 수 상한이 코드 구조상 확정이라 측정으로 갈릴 결론이 없음 — 측정 자체가 낭비 |
    | C. 현 구조 유지 종결(wontfix) | ai-review INFO 산물이고 spec 표면 아님 — 비용 0. 개선 방안 자체가 "현 구조 유지 종결" 을 병기 | 백로그에서 종결 기록 필요(실질 단점 없음) |
  - **권장**: C(보류/wontfix 종결) — spec 대조가 이미 "우선순위 최하/wontfix 후보 강등" 으로 판정했고, 스캔 대상 키 수가 실질 1 workspace 로 상한이 확정돼 있어 A 의 이득도 B 의 측정도 의미가 없다.
  - 검증: parallel 브랜치 single-flight unit 통과. / 회귀 위험: 사실상 없음. / spec 갱신: 불요.

## Minor

- [ ] **#12 [m] RAG graph-traversal — 동일 재귀 CTE 2회 실행** — `rag-search.service.ts:630-656` **(조건부 — seed 동등성 검증 선행)**
  - **spec 대조**: D — `traversedEntityCount` 메타데이터는 `10-graph-rag.md` KB-GR-SR-06 의 spec 약속, 2회 왕복 전략은 무언급. 코드 주석의 "LIMIT 후라 부정확" 우려는 절반만 타당 — PG 재귀 CTE 는 항상 materialize 되므로 통합 가능.
  - **개선 방안**: 1. **선행 조건**: 메인 CTE 와 2차 CTE 의 seed 모집합 동등성 검증(2차는 LIMIT 적용 후 seed 기준 — 다르면 현 2회 왕복이 정확한 의미론). 2. 동등 시 메인 쿼리에 `traversal_stats AS (SELECT COUNT(DISTINCT entity_id) FROM expanded)` CTE + CROSS JOIN 으로 1 왕복화.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. seed 동등성 검증 선행 → 동등 시 `traversal_stats` CTE + CROSS JOIN 1왕복화 | 동등 확인 시 왕복 1회 절감하면서 KB-GR-SR-06 표면 수치 불변 보장. PG 재귀 CTE materialize 특성상 통합 자체는 안전 | 검증 작업 선행 비용. 비동등 판명 시 산출이 "현 구조 유지 결정" 으로 끝남 |
    | B. 검증 생략 통합 강행 | 즉시 1왕복 | 2차 CTE 가 LIMIT 적용 후 seed 기준이면 `traversedEntityCount` 의미가 바뀌어 KB-GR-SR-06 표면(UI) 수치 변경 — spec 약속 위반 위험 |
    | C. 보류(현상 유지) | 현 2회 왕복은 의미론적으로 정확 — 위험 0 | graph-traversal 검색마다 동일 재귀 CTE 2회 실행 지속 |
  - **권장**: A — 항목 자체가 "조건부(seed 동등성 검증 선행)" 로 등재돼 있고 통합의 정당성이 전적으로 동등성에 달려 있다. 비동등 판명 시 현 2회 왕복이 정확한 의미론이므로 C 로 종결하면 되고, B 처럼 spec 표면 수치를 흔드는 도박을 할 이유가 없다.
  - 검증: 동일 fixture before/after `traversedEntityCount` 동일성. / 회귀 위험: 카운트 의미 변경 시 KB-GR-SR-06 표면 수치 변경(UI 영향). / spec 갱신: 의미 변경 시에만 §4.3 (planner).

- [ ] **#13 [m] Undo 스택 — 변경마다 전체 nodes/edges shallow copy** — `editor-store.ts:531-532` **(측정 선행 — wontfix 가능)**
  - **spec 대조**: D — Undo 기능은 `0-canvas.md §6` spec 약속, 저장 방식(스냅샷 vs diff)은 무언급. shallow copy + MAX_UNDO=50 cap 으로 실효 낮음.
  - **개선 방안**: 1. **측정 먼저**: 노드 300/엣지 400 에서 snapshot push 가 16ms 프레임 예산 침범 없으면 wontfix 종결. 2. 침범 시 zundo(temporal) 또는 immer `produceWithPatches`. 3. 중간 대안: 연속 드래그 1 gesture = 1 snapshot 디바운스 확인.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 측정 후 결정 (노드 300/엣지 400, 16ms 프레임 예산 기준) | shallow copy + MAX_UNDO=50 cap(editor-store.ts:116) 구조상 실효가 낮아 wontfix 종결 가능성이 높음 — 불필요한 라이브러리 전환 회피 | 측정 셋업 비용 1회 |
    | B. 측정 없이 zundo(temporal) / immer `produceWithPatches` 전환 | 스냅샷 push 비용 구조적 제거 + gesture 디바운스 등 부가 기능 | patches 방식이 외부 배열 교체 경로(임포트/버전 복원)와 어긋나면 이력 오염 — 미측정 가설 대비 회귀 위험만 확정적으로 인수 |
    | C. 현상 유지 종결 | 비용 0 | 대형 캔버스에서의 프레임 침범 여부가 미확인인 채 종결 — 가설 미검증 |
  - **권장**: A(측정 후 결정) — Undo 는 `0-canvas.md §6` 의 spec 약속이라 회귀 비용이 큰 반면 문제 자체는 미측정 가설이다. MAX_UNDO=50 cap 이 메모리 상한을 이미 제공하므로, 프레임 예산 측정 1회로 wontfix(예산 내)와 전환(침범)을 가르는 것이 가장 싸다.
  - 검증: undo/redo unit(컨테이너 소속 복원, manual_trigger 삭제 차단) 무변화. / 회귀 위험: patches 방식은 외부 배열 교체 경로(임포트/버전 복원)와 어긋나면 이력 오염. / spec 갱신: 불요.

- [ ] **#14 [m] `MAX_NODE_ITERATIONS`/`PARALLEL_ENGINE` 매 실행 configService 조회** — `execution-engine.service.ts:1387,3025,1549,3665`
  - **spec 대조**: D — §1.6 은 읽기 시점 무규정이나 §11 의 자매 env 들이 "모듈 로드 시 1회 읽음" 패턴으로 기성 규약 — read-once 전환이 spec 패턴과 정합.
  - **개선 방안**: 1. `onModuleInit` 에서 필드로 1회 적재(`resolveExecutionRunWorkerConcurrency` 의 sanitize 패턴 준용). 2. 4개 호출처 필드 참조로 교체. 3. env 런타임 변경에 의존하는 테스트는 init-시점 주입으로 마이그레이션.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. `onModuleInit` read-once 필드 적재 (sanitize 패턴 준용) | §11 자매 env 들의 "모듈 로드 시 1회" 기성 규약과 정합 — 읽기 시점 규약 단일화. `resolveExecutionRunWorkerConcurrency` 전례로 구현 비용 낮음 | env 런타임 변경에 의존하는 테스트의 init-시점 주입 마이그레이션 필요. PARALLEL_ENGINE 의 런타임 토글(rollback) 가능성 상실 — off rollback 테스트로 의도 고정 필요 |
    | B. 보류(현상 유지) | `configService.get` 은 in-memory 조회라 절대 비용 자체는 낮음. 테스트 무변경 | 동일 성격 env 가 두 가지 읽기 시점 규약으로 공존 — §11 패턴과 비일관 지속 |
  - **권장**: A — 이 항목의 본질은 성능 이득(미미)이 아니라 spec §11 패턴 정합(spec 대조 D 판정 사유)이며, sanitize 전례가 있어 구현이 싸다. 적용 시 §1.6 에 read-once 문구 추가(planner)를 동반해 규약을 문서로도 고정한다.
  - 검증: MAX_NODE_ITERATIONS=1 가드·PARALLEL_ENGINE=off rollback 테스트. / 회귀 위험: 테스트 env 주입 방식. / spec 갱신: 적용 시 §1.6 에 read-once 문구 추가가 일관적 (planner).

- [ ] **#15 [m] 대화 메시지 단건 갱신에 전체 `.map()` 재순회** — `execution-store.ts:646,694,708` **(측정 선행 — wontfix 후보)**
  - **spec 대조**: B — 대화 항목 의미론만 spec 규정. **실효 최저**: `.map()` 은 shallow 순회이고 toolCallId 검색은 어차피 O(N) — 이득이 할당 1회 절감뿐.
  - **개선 방안**: 1. 측정 후 병목 아니면 wontfix 종결 권고. 2. 적용 시 idx 확정 경로(:646)만 `messages.with(idx, updated)` (ES2023 — tsconfig lib 확인), toolCallId 기반은 파생 인덱스 동반 시에만.
  - **옵션 비교**:
    | 옵션 | 장점 | 단점 / 트레이드오프 |
    | --- | --- | --- |
    | A. 측정 후 결정 (방안 1) | 절차적 정합 — 병목 확인 시에만 손댐 | 이득 상한이 "할당 1회 절감" 으로 코드 구조상 이미 확정 — 측정으로 갈릴 결론이 사실상 없음 |
    | B. `messages.with(idx, updated)` 즉시 적용 (:646 한정) | idx 확정 경로는 저위험 단순 치환 | toolCallId 검색이 어차피 O(N) 이라 점근 복잡도 불변 — 할당 1회 절감뿐. ES2023 lib 의존(tsconfig 확인 필요) |
    | C. 현상 유지 종결(wontfix) | 실효 최저 항목에 비용 0 — 회귀 위험도 "사실상 없음" | 실질 단점 없음 |
  - **권장**: C(보류/wontfix 종결) — 적용해도 지배 비용(toolCallId O(N) 검색)이 그대로라 점근 개선이 없고 이득이 shallow `.map()` 할당 1회뿐임이 코드 구조에서 확정적이다. #13 과 달리 측정으로 결론이 갈리지 않으므로 측정 비용조차 들일 이유가 없다.
  - 검증: optimistic reconcile/tool dedup unit 무변화. / 회귀 위험: 사실상 없음. / spec 갱신: 불요.
