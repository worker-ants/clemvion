## 발견사항

### [INFO] `spec/3-workflow-editor/5-version-history.md §7.1` — 버전 목록 응답 타입명 변경, `data-flow/11-workflow.md` 미동기화
- target 위치: `spec/3-workflow-editor/5-version-history.md` §7.1 (line 95)
- 충돌 대상: `spec/data-flow/11-workflow.md` (line 57–59)
- 상세: target 은 `GET /workflows/:wfId/versions` 응답을 `WorkflowVersionListItemDto[]` 로 갱신하고 snapshot 필드를 제외했다. `spec/data-flow/11-workflow.md` §1.1 은 두 GET 엔드포인트의 이름만 언급하고 응답 shape 을 명시하지 않아 모순은 없지만, `WorkflowVersionsController` 설명 블록이 snapshot 포함 여부를 기술하지 않아 둘 사이 일관성 신호가 없다.
- 제안: `spec/data-flow/11-workflow.md §1.1` 의 `WorkflowVersionsController` 설명 블록에 "목록(`GET /versions`) 응답은 `WorkflowVersionListItemDto` (snapshot 제외), 상세(`GET /versions/:id`) 응답은 snapshot 포함" 1줄을 추가해 동기화한다.

---

### [INFO] `spec/5-system/13-replay-rerun.md §9.1` — `computeChainDepth` 구현 설명 갱신, 체인 깊이 32 관련 다른 spec 항목에는 미반영
- target 위치: `spec/5-system/13-replay-rerun.md` line 281
- 충돌 대상: `spec/5-system/13-replay-rerun.md` line 510 (E1/E2 trade-off 설명), `spec/1-data-model.md §2.13` (`Execution.chain_id` 설명 말미)
- 상세: target 이 `computeChainDepth` 를 "재귀 CTE 단일 쿼리" 로 갱신했다. 같은 파일 line 510 은 "E1(`re_run_of` 만) 은 직계 부모는 빠르지만 chain 전체 조회는 recursive CTE 가 필요해 SELECT 가 느려진다" 라고 기술하며 재귀 CTE 가 느리다는 뉘앙스로 남아 있다. 이제 `computeChainDepth` 가 재귀 CTE 로 단일 쿼리 처리되므로 "SELECT 가 느려진다" 표현이 오해를 줄 수 있다. 직접 모순은 아니나 동일 문서 내 서술 방향이 일관성 있게 조정되지 않았다.
- 제안: `spec/5-system/13-replay-rerun.md` line 510 의 E1 설명에서 "SELECT 가 느려진다" 표현을 "재귀 CTE 단일 쿼리로 처리되므로 직렬 walk 대비 latency 가 개선됐다" 로 보정하거나, trade-off 논의가 결정 이전 비교임을 명시해 현재 구현과 혼동되지 않게 한다.

---

### [INFO] `codebase/backend/migrations/README.md §6` — ALTER COLUMN TYPE 규약 신설, `spec/conventions/migrations.md` 와 `spec/0-overview.md §2.8` 미동기화
- target 위치: `codebase/backend/migrations/README.md §6` (신규 섹션 "테이블-rewrite 형 ALTER COLUMN TYPE")
- 충돌 대상: `spec/conventions/migrations.md` (§3 Append-only 원칙), `spec/0-overview.md §2.8` (Flyway 운영 테이블)
- 상세: README.md §6 은 (a) binary-coercible vs rewrite 구분, (b) shadow column 3-step 패턴, (c) CONCURRENTLY 인덱스 분리 규칙을 신규 정식 규약으로 승격했다. `spec/conventions/migrations.md` 는 "실제 작성 가이드는 README.md 가 담당"이라고 위임했으나 이 새 규약이 추가됐음을 반영하는 언급이 없다. `spec/0-overview.md §2.8` 마이그레이션 테이블 역시 이 패턴을 언급하지 않는다. 직접 모순은 아니나 향후 개발자가 spec/conventions/migrations.md 만 읽고 ALTER TYPE 패턴을 누락할 수 있다.
- 제안: `spec/conventions/migrations.md` 의 실제 작성 가이드 위임 문장 뒤에 "ALTER COLUMN TYPE 안전 절차는 `migrations/README.md §6` 참조" 1줄을 추가한다. `spec/0-overview.md §2.8` 의 Flyway 테이블에 "운영 안전 DDL 패턴 (ALTER TYPE shadow-column 3-step 등)" 행을 선택적으로 추가할 수 있다.

---

### [INFO] `spec/1-data-model.md §3` 인덱스 테이블 — NodeExecution 기존 인덱스 항목 보강 추가, `spec/data-flow/3-execution.md` 와의 표기 일관성
- target 위치: `spec/1-data-model.md §3` NodeExecution 인덱스 행 (4개 신규 행)
- 충돌 대상: `spec/data-flow/3-execution.md` §1.1 `node_execution` 테이블 행 (인덱스 열)
- 상세: `spec/1-data-model.md §3` 에 NodeExecution 의 V034·V047·V048 인덱스가 새롭게 문서화됐다. `spec/data-flow/3-execution.md` §1.1 `node_execution` 행의 인덱스 열은 `(execution_id)`, V034, V095 만 언급하며 V047·V048 인덱스는 해당 컬럼 기술에 포함되지 않는다. 직접 모순은 아니나(data-flow 는 hot-path 중심으로만 언급), 다른 독자는 §1-data-model 의 full 인덱스 목록과 data-flow 의 선택적 언급 사이에서 혼선을 겪을 수 있다.
- 제안: data-flow 에서 "인덱스 전체 목록은 `spec/1-data-model.md §3` 참조" 각주 추가 또는 현재 패턴 유지(data-flow 는 hot-path만 언급이 의도라면 명시). 충돌이 아닌 범위 차이임을 주석으로 명시하면 충분하다.

---

### [INFO] `spec/0-overview.md §2.8` — `DB_POOL_*` env 신설 내용이 spec 에 미반영
- target 위치: `codebase/backend/.env.example` (DB_POOL_MAX / DB_POOL_IDLE_TIMEOUT_MS / DB_POOL_CONNECTION_TIMEOUT_MS 신규 추가)
- 충돌 대상: `spec/0-overview.md §2.6` Data Layer, `spec/5-system/_product-overview.md` (비기능 요구사항)
- 상세: 구현에서 DB 커넥션 풀 env 변수 3개를 노출했으나 `spec/` 어디에도 이 설정 변수의 존재 또는 기본값이 언급되지 않는다. `spec/0-overview.md §2.6` 의 PostgreSQL 항목이나 운영 설정 관련 spec 에 이 변수들이 누락돼 있다. 충돌은 아니나 운영자·셀프 호스터 입장에서 튜닝 가능 파라미터를 spec 에서 발견할 수 없다.
- 제안: `spec/0-overview.md §2.6` 또는 `spec/5-system/_product-overview.md` 비기능 요구사항의 "데이터 레이어" 항목에 "DB 커넥션 풀 튜닝: `DB_POOL_MAX` (기본 10), `DB_POOL_IDLE_TIMEOUT_MS` (기본 10000), `DB_POOL_CONNECTION_TIMEOUT_MS` (기본 0=무제한 대기)" 항목 추가를 권장한다.

---

## 요약

refactor-05-database 의 spec 변경 범위는 좁다 — `spec/3-workflow-editor/5-version-history.md §7.1` (응답 타입 갱신), `spec/5-system/13-replay-rerun.md §9.1` (computeChainDepth 설명 갱신), `spec/1-data-model.md §3` (인덱스 목록 보강), `spec/data-flow/3-execution.md §1.1` (V095 인덱스 annotation 추가) 4개 파일이다. 이 변경들 사이에 상호 모순은 없으며, 다른 spec 영역과도 직접 충돌하지 않는다. 미동기화 항목 4건 모두 INFO 수준으로, 별도 spec 문서(data-flow/11-workflow.md, spec/conventions/migrations.md, spec/0-overview.md)가 신규 사실을 언급하지 않는 누락이다. 구현 측 추가사항인 DB 풀 env(spec 미반영)와 migrations README §6 ALTER TYPE 규약(spec/conventions 미반영)도 같은 수준의 동기화 gap 이다. 전체적으로 cross-spec 충돌 위험은 낮다.

## 위험도

LOW

STATUS: SUCCESS
