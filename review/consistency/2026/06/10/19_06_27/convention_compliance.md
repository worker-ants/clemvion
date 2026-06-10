# Convention Compliance Review — refactor/01-performance.md (--impl-prep)

- **mode**: `--impl-prep` (구현 착수 직전)
- **target**: `plan/in-progress/refactor/01-performance.md` (성능 백로그, 유효 13건)
- **검토 기준**: `spec/conventions/**` — 특히 `execution-context.md`, `node-output.md`, `error-codes.md`, `migrations.md`
- **STATUS**: PASS (Critical 0 / Warning 2 / Info 3)

> 본 보고는 이전 BLOCKED 보고(payload 결함으로 target 경로 미해석)를 덮어쓴 정정본이다. 정정 파라미터로 target 을 직접 Read 하여 평가했다.

---

## 검토 범위 판정 (선결론)

본 plan 의 13개 항목은 **전부 내부 리팩토링**(쿼리 통합, 자료구조·캐시·배치화)이며, 다음을 **신설/변경하지 않는다**:

- 신규 에러 코드 문자열 (`error-codes.md` §1 명명 비해당)
- 신규 Flyway 마이그레이션 (`migrations.md` §1~6 비해당 — #1 은 기존 V034 인덱스를 **소비만** 하고 추가 인덱스 불요라고 명시)
- `NodeHandlerOutput` 5필드 envelope·port·meta 형식 (`node-output.md` Principle 0~11 비해당)
- API endpoint·DTO·swagger 데코레이터 (해당 항목 없음)

따라서 정식 규약 **직접 위반(CRITICAL) 은 없다**. 아래 발견은 규약과의 정합성을 명시적으로 점검한 결과의 WARNING/INFO 다.

---

## 발견사항

### [WARNING] #1 — outputData 복원 분기의 `node-output.md` 보존필드 의미론 명시 누락

- **target 위치**: #1 개선 방안 2 / 옵션 A 단점 / 회귀 위험 ("waiting node outputData 복원 분기 무변경", "loop iteration 출력이 옛 값으로 복원")
- **관련 규약**: `spec/conventions/node-output.md` Principle 4.2.1 (`_resumeCheckpoint` / `_retryState` 보존 예외), Principle 0 (5필드 + internal top-level 필드 예외)
- **상세**: #1 은 rehydration 시 `nodeExecutionRepository.findOne` N+1 을 단일 `In([...])` 쿼리 + `Map<nodeId, NodeExecution>` dedup 으로 교체한다. 이때 복원 대상인 `NodeExecution.outputData` 안에는 단순 비즈니스 output 만 있는 게 아니라 **`node-output.md` §4.2.1 이 strip 예외로 보존하는 `_resumeCheckpoint`(§7.5 rehydration 용 DB JSONB) 와 `_retryState`** 가 들어 있을 수 있다. plan 은 "DESC 첫 등장 = nodeId 당 최신 COMPLETED 1건" 의미론만 회귀 위험으로 적시하는데, **dedup 으로 선택되는 row 가 `_resumeCheckpoint` 를 보유한 row 와 일치하는지**(예: 같은 nodeId 에 COMPLETED row 와 waiting/다른 status row 가 공존할 때 `status: COMPLETED` 필터 + DESC 선택이 checkpoint 보유 row 를 누락시키지 않는지)는 명시되지 않았다. 현행 직렬 `findOne` 이 잡던 특정 row 를 배치 dedup 이 다른 row 로 바꾸면 rehydration 재진입(`buildRetryReentryState` 류 경로)이 깨질 수 있다.
- **제안**: 개선 방안에 "복원 대상 row 선택이 `_resumeCheckpoint`/`_retryState`(node-output §4.2.1) 보유 row 와 일치함" 을 명시 불변식으로 추가하고, #1 검증 항목의 "park→worker kill→무손실 재개 dockerized e2e" 가 이 보존필드 경로를 실제로 통과하는지 단언 케이스로 고정. 규약 자체 갱신은 불요(이미 §4.2.1 가 SoT).

### [WARNING] #14 — read-once 필드 적재와 `execution-context.md` 정신(엔진 전용 상태 표면) 정렬 권고

- **target 위치**: #14 개선 방안 1 (`onModuleInit` 필드 1회 적재), 옵션 A
- **관련 규약**: `spec/conventions/execution-context.md` 원칙 1(Stable core)·원칙 4(`_`-prefix 엔진 내부 필드)
- **상세**: #14 는 두 env(`MAX_NODE_ITERATIONS`/`PARALLEL_ENGINE`)를 `onModuleInit` 에서 **서비스 인스턴스 필드**로 적재한다. 이는 노드 핸들러 주입 객체 `ExecutionContext` 가 아니라 `ExecutionEngineService` 자체 필드이므로 `execution-context.md` God Object 규약의 **직접 대상은 아니다(위반 아님)**. 다만 plan 이 인용한 `resolveExecutionRunWorkerConcurrency` sanitize 패턴이 동일 클래스에 read-once 필드를 누적시키는 방향이라, env 적재 필드가 늘수록 "엔진 전용 상태"의 응집/명명 일관성이 흐려질 여지가 있다. 같은 정신(엔진 전용 상태의 표면 관리)에서 일관 명명이 바람직하다.
- **제안**: read-once 필드를 `resolveExecutionRunWorkerConcurrency` 와 동일한 sanitize·명명 컨벤션(예: `private readonly maxNodeIterations` 류)으로 정렬. plan 이 이미 적은 "§1.6 에 read-once 문구 추가(planner)"는 spec 본문 갱신으로 적절 — 규약(`execution-context.md`) 갱신은 불요.

### [INFO] #2 — `S3Service.deleteMany` 명명은 기존 메서드 컨벤션과 정합 (확인 통과)

- **target 위치**: #2 개선 방안 1 (`deleteMany(keys: string[]): Promise<{ errored: string[] }>` 신설)
- **관련 규약**: 명명 일관성 (전용 conventions 파일 없음 — 코드베이스 컨벤션 점검)
- **상세**: `codebase/backend/src/common/services/s3.service.ts` 의 기존 공개 메서드는 `upload`/`download`/`delete`. `deleteMany` 는 단건 `delete` 의 복수형 sibling 으로 자연스럽고, 반환형 `{ errored: string[] }` 은 best-effort warn 의미론을 명시적으로 표면화한다. 위반 없음 — 명명 OK 확인. `node-output.md` 와 무관(핸들러 output 경로 아님)임을 plan 이 정확히 분리.
- **제안**: 없음(정합).

### [INFO] #2 — `data-flow/4-file-storage.md` code-sync 문구 갱신은 spec 본문(planner) 사안이며 conventions 무관

- **target 위치**: #2 "spec 갱신: 필요 — data-flow/4-file-storage.md 의 'for 루프' code-sync 문구 갱신"
- **관련 규약**: 해당 없음 (정식 conventions 파일이 아니라 spec 본문 data-flow 문서)
- **상세**: plan 이 유일하게 "spec 갱신 필요"로 표시한 항목. 이는 `spec/conventions/**` 규약이 아니라 spec 본문 흐름표의 code-sync 정확성 문제로, project-planner 책임으로 정확히 위임돼 있다. conventions 준수 관점에서 추가 제약 없음.
- **제안**: 없음. (planner 위임이 정식 phase 로 포함됐는지는 plan-lifecycle 관점 — 본 convention 검토 범위 밖.)

### [INFO] #12 — `traversedEntityCount` 출력 수치 보존(KB-GR-SR-06)은 출력 계약 정합

- **target 위치**: #12 회귀 위험 / 옵션 B 단점 ("KB-GR-SR-06 표면(UI) 수치 변경 — spec 약속 위반 위험"), 권장 A + 비동등 판정 시 C 종결
- **관련 규약**: 출력 포맷 정합 일반 원칙 (메타데이터 수치 = spec 약속값 = 클라이언트 계약). `node-output.md` 직접 조항은 아니나 동일 정신(출력 의미 안정성).
- **상세**: plan 은 CTE 통합이 `traversedEntityCount` 표면 수치를 바꾸면 KB-GR-SR-06 spec 약속 위반이라고 명확히 인지하고 seed 동등성 검증을 선행 조건으로 걸었다. 구현 진행 메모에서 이미 **비동등 판정(외부 LIMIT 가 seed evict) → C(현 2회 왕복 유지) 종결 예정**으로 결론 — 출력 계약을 흔들지 않는 보수적·정합적 선택.
- **제안**: 없음(C 종결이 출력 계약 보존 측면에서 정합). 종결 시 백로그에 비동등 근거 기록만 유지.

---

## 규약 비해당 확인 (점검 완료, 위반 없음)

- **error-codes.md**: 신규 에러 코드 발행 항목 없음. #2 의 S3 `Errors[].Key` 수집은 내부 `logger.warn` 로깅이며 클라이언트 노출 `error.code` 문자열이 아님 → §1 명명·§2 안정성 비해당.
- **migrations.md**: 신규 V번호 마이그레이션 없음. #1 은 기존 `V034 idx_node_execution_exec_node_started_desc (execution_id, node_id, started_at DESC)` 가 배치 쿼리를 정확히 커버하므로 추가 인덱스 불요라고 plan 이 단언 — 실파일 확인 결과 인덱스 정의 일치(`V034__node_executions_composite_index.sql`). §1~6 비해당.
- **node-output.md Principle 5/6/9 (port·동적 포트·container override)**: #5(CONTAINER_CYCLE)·#6(BFS) 는 알고리즘 비용만 바꾸고 `CONTAINER_CYCLE` 거부 의미론·port 활성화·container output 오버라이트 계약을 무변경 → 비해당. plan 이 "사이클 검사는 spec 의무라 제거 불가, 검증 순서만 테스트로 고정"으로 정확히 보존.
- **execution-context.md 원칙 1~4**: #1/#5/#6/#10/#14 모두 핸들러 주입 `ExecutionContext` **필드 추가·재배치 없음**. 엔진 내부 자료구조(nodeMap, queue 포인터, Map 인덱스)·서비스 필드만 변경 → God Object 규약 비해당.
- **frontend (#3/#8/#15)**: execution-store 자료구조(비정렬+selector 정렬, 파생 인덱스 Map, `.with()` 갱신)는 WS 이벤트 계약·표시 요건을 무변경(plan 의 spec 대조 B 판정과 일치). conventions 표면 아님.

---

## 요약

본 plan 의 13개 유효 항목은 전부 내부 성능 리팩토링으로, 정식 규약(`spec/conventions/**`)이 규율하는 출력 envelope·에러 코드 명명·마이그레이션 V번호·ExecutionContext 필드 분류 중 **어느 것도 신설하거나 형식을 바꾸지 않는다**. 따라서 규약 직접 위반(CRITICAL)은 없다. 다만 #1 의 rehydration 배치 dedup 은 `node-output.md §4.2.1` 이 strip 예외로 보존하는 `_resumeCheckpoint`/`_retryState` 보유 row 와 선택 row 가 일치하는지를 불변식으로 명시·테스트해야 하고(WARNING), #14 의 read-once 필드 적재는 `execution-context.md` 정신에 맞춰 기존 sanitize 패턴과 명명 정렬이 바람직하다(WARNING). #2 의 `deleteMany` 명명·#12 의 출력 수치 보존(C 종결)·#2 의 data-flow 본문 갱신(planner 위임)은 모두 규약 정합으로 확인됐다(INFO). 구현 착수를 차단하는 규약 사유는 없다.

## 위험도

LOW
