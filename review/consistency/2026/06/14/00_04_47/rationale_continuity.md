# Rationale 연속성 Check — refactor-05-database

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/, diff-base=HEAD~12)

---

## 발견사항

### [INFO] spec/3-workflow-editor/5-version-history.md §7.1 snapshot 제외 변경 — Rationale 미작성

- **target 위치**: `spec/3-workflow-editor/5-version-history.md` §7.1 버전 목록
- **과거 결정 출처**: 같은 파일 §7.1 의 기존 텍스트 (`응답: WorkflowVersion[]`) — snapshot 포함 여부에 대한 명시적 결정 기록은 없었으나, `WorkflowVersion[]` 전체를 반환하는 것이 묵시적 설계였다. 해당 섹션에 Rationale 항목 없음.
- **상세**: 이번 변경으로 목록 API 응답 타입이 `WorkflowVersion[]` → `WorkflowVersionListItemDto[]` 로 바뀌면서 `snapshot` 필드가 의도적으로 제외됐다. SUMMARY m-3 SPEC-DRIFT 발견으로 코드→spec 방향의 동기화다. 이 변경 자체는 over-fetch 방지 목적의 합리적 최적화이며, 과거 Rationale 에서 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. 단, 변경 근거가 본문 인라인 ("목록 over-fetch 방지, m-3") 으로만 기록돼 있고, 명시적 Rationale 항목으로 승격되지 않았다.
- **제안**: `spec/3-workflow-editor/5-version-history.md` 말미에 `## Rationale` 섹션을 추가하고 "목록 vs 상세 DTO 분리 — snapshot 제외" 결정 근거(목록에서 snapshot 을 포함할 경우의 over-fetch 비용, 상세 조회(§7.2)를 통한 단건 접근으로 충분)를 기록하는 것을 권장한다. 필수는 아니나 향후 재검토 시 결정의 연속성을 유지할 수 있다.

---

### [INFO] spec/5-system/13-replay-rerun.md §9.1 `computeChainDepth` 구현 상세 갱신 — Rationale 연속성 정합

- **target 위치**: `spec/5-system/13-replay-rerun.md` §9.1 chain 깊이 불변식 항목
- **과거 결정 출처**: 같은 파일 `## Rationale — 왜 E3 (re_run_of + chain_id 둘 다) 인가` 및 chain 깊이 32 제한 결정.
- **상세**: 기존 텍스트 "애플리케이션 레벨에서 enforce (`computeChainDepth`, `re_run_of` walk)" 가 "재귀 CTE 단일 쿼리, 사이클 방어 walk 상한 포함" 으로 구체화됐다. 이는 E1 대안(직계 부모만) 에 대한 기각 이유("chain 전체 조회는 recursive CTE 가 필요해 SELECT 가 느려진다") 와 정합한다 — 깊이 계산에 recursive CTE 를 쓰는 것은 E3 채택의 연장선이다. Rationale 을 번복하지 않는다.
- **제안**: 없음. 기존 Rationale 에 부합하는 명확화다.

---

### [INFO] spec/1-data-model.md NodeExecution 인덱스 표 — 기존 인덱스 문서화 + V095 신규 추가

- **target 위치**: `spec/1-data-model.md` §3 인덱스 표 NodeExecution 행
- **과거 결정 출처**: 기존 `## Rationale` 의 `Execution.execution_path → ExecutionNodeLog` 항목. NodeExecution 인덱스에 대한 과거 명시적 기각 결정 없음.
- **상세**: V034/V012/V047/V048 등 기존에 구현됐으나 spec 표에 누락됐던 인덱스들을 문서화했고, V095 partial 인덱스 `(execution_id, status) WHERE status IN ('waiting_for_input','running')` 가 신규 추가됐다. V095 의 채택 근거("completed 계열은 기존 composite 가 커버, partial 로 활성 행만 인덱싱해 크기·write amplification 최소화")가 인라인으로 기록돼 있다. 과거 Rationale 와 충돌 없다.
- **제안**: 없음.

---

### [INFO] migrations/README.md §6 ALTER COLUMN TYPE 규약 추가 — spec/0-overview.md §2.8 forward-only 원칙과 정합 여부

- **target 위치**: `codebase/backend/migrations/README.md` §6 (신규 섹션)
- **과거 결정 출처**: `spec/0-overview.md` §2.8 / Rationale "forward-only 채택" — "별도 undo 스크립트(`U{version}__...sql`)는 두지 않는다" + `spec/conventions/migrations.md` §7 폐기 대안.
- **상세**: shadow column 3-step 규약(`ADD → backfill → switch & drop` 를 별도 V번호 마이그레이션으로 분리)은 forward-only 원칙과 완전히 정합한다 — 되돌리는 게 아니라 테이블 rewrite 없이 온라인으로 전진하는 절차다. `spec/conventions/migrations.md` 의 폐기 대안(타임스탬프 prefix·outOfOrder·Merge Queue·branch protection)과도 충돌하지 않는다. README 에 추가된 shadow column 패턴은 `spec/conventions/migrations.md` 에는 아직 언급이 없다.
- **제안**: shadow column 3-step 패턴이 운영 규약으로 승격됐으므로 `spec/conventions/migrations.md` 에도 동일 내용을 추가해 단일진실 원칙을 유지하는 것을 권장한다. 현재 README ↔ spec 이중 기록 위험이 있다.

---

### [INFO] DB pool env 노출 (`DB_POOL_MAX` 등) — spec 미기재

- **target 위치**: `codebase/backend/src/common/config/database.config.ts` + `codebase/backend/.env.example`
- **과거 결정 출처**: `spec/0-overview.md` §2.6 Data Layer (PostgreSQL 기술 스택 선택). DB 풀 튜닝 환경변수에 대한 과거 Rationale 항목 없음.
- **상세**: `DB_POOL_MAX` / `DB_POOL_IDLE_TIMEOUT_MS` / `DB_POOL_CONNECTION_TIMEOUT_MS` 환경변수가 노출됐다. 과거 spec 에서 이 환경변수를 기각하거나 하드코딩을 유지하기로 결정한 Rationale 항목이 없으므로, 기각된 대안의 재도입도 합의 원칙 위반도 아니다. 단, `.env.example` 에만 노출되고 `spec/` 에는 해당 환경변수 목록이 기록되지 않아 spec-impl 간 비가시성이 있다. CRITICAL/WARNING 수준은 아니다.
- **제안**: 운영에 직접 영향을 주는 DB 풀 튜닝 변수이므로 `spec/0-overview.md` §2.6 또는 `spec/conventions/` 에 환경변수 목록(SoT)을 한 줄이라도 기재하면 셀프호스팅 운영자 가시성이 높아진다.

---

## 요약

refactor-05-database 의 spec 변경 4건(NodeExecution 인덱스 표 보강, version-history §7.1 DTO 분리 명시, computeChainDepth CTE 상세화, data-flow 인덱스 주석 추가)은 모두 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 사례가 없다. version-history §7.1 의 `WorkflowVersion[]` → `WorkflowVersionListItemDto[]` 변경은 SPEC-DRIFT 동기화(코드가 먼저 구현된 over-fetch 방지 최적화)로, 과거 결정의 무근거 번복이 아니다. 보완 제안은 (1) version-history Rationale 항목 부재 — 인라인 한 줄 이상의 명시 권장, (2) shadow column 3-step 규약이 README 에만 있고 `spec/conventions/migrations.md` 에 미반영 — 단일진실 보강 필요, (3) DB 풀 env 변수 spec 미기재 — 운영 가시성 목적의 기재 권장 등 INFO 수준 3건이다.

---

## 위험도

LOW
