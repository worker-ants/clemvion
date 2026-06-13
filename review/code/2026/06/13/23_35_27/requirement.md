# 요구사항(Requirement) 리뷰 결과

리뷰 대상: refactor-05-database 변경 (파일 1~24)  
리뷰 기준: 기능 완전성 · 엣지 케이스 · 비즈니스 로직 · spec fidelity

---

## 발견사항

### [SPEC-DRIFT][WARNING] 파일 19 — `findByWorkflow` 목록에서 snapshot 제외 (m-3)
- **위치**: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `findByWorkflow()`, 파일 16 `WorkflowVersionListItemDto`, 파일 17 컨트롤러 ApiOperation 설명
- **상세**: spec/3-workflow-editor/5-version-history.md §7.1은 `응답: WorkflowVersion[] (version DESC). creator relation 포함.` 으로만 명시하며 snapshot 제외를 명시하지 않는다. 구현은 `select` 절에 snapshot 을 의도적으로 제외(m-3 — over-fetch 방지)하고 별도 `WorkflowVersionListItemDto` 를 추가했다. 코드의 동기(목록 UI 는 메타만 소비, snapshot 은 §7.2 상세에서만 필요)는 합리적이며 되돌리는 것이 오답이다. spec §7.1 응답 타입과 필드 설명이 `WorkflowVersion[]` 전체 엔티티로 표기되어 `snapshot` 필드가 목록에 포함된다는 오독을 유발한다.
- **제안**: 코드 유지 + spec/3-workflow-editor/5-version-history.md §7.1 응답 설명을 `WorkflowVersionListItemDto` (id, workflowId, version, changeSummary, createdBy, creator, createdAt — snapshot 제외)로 갱신. §7.2 상세와 대비 구조를 명문화.

---

### [SPEC-DRIFT][WARNING] 파일 23 — `computeChainDepth` 재귀 CTE 구현 (C-2)
- **위치**: spec/5-system/13-replay-rerun.md §9.1 불변식 라인 "chain 깊이 32 제한은 **애플리케이션 레벨** 에서 enforce (`computeChainDepth`, `re_run_of` walk)."
- **상세**: spec은 이미 갱신되어 "재귀 CTE 단일 쿼리, 사이클 방어 walk 상한 포함" 을 기술하고 있으므로 이 항목은 실제로 spec 이 코드를 따라잡은 것으로 보인다. 확인: 파일 23 변경(diff)이 해당 라인을 갱신했으므로 SPEC-DRIFT 는 이미 해소됨 — 추가 조치 불요.

---

### [SPEC-DRIFT][WARNING] 파일 22 — spec/1-data-model.md NodeExecution 인덱스 표 추가 (V095)
- **위치**: spec/1-data-model.md 인덱스 표 §3 (NodeExecution 행)
- **상세**: V095 partial index `(execution_id, status) WHERE status IN ('waiting_for_input','running')` 와 기존 인덱스 3개(V034, V012, V048, V047)가 인덱스 표에 새로 추가됐다. V034/V012/V048/V047 는 이미 구현됐으나 인덱스 표에 미등재 상태였던 것을 이번에 함께 추가했다. 이는 "인덱스 표가 구현보다 뒤처진" 오래된 gap 해소이므로 코드가 옳고 spec 이 이제 갱신됐다. 이 변경 자체가 spec 에 대한 fix 이므로 추가 조치 불요.

---

### [INFO] 파일 7 — `nonNegativeIntEnv` 에 leading-digit 문자열 허용
- **위치**: `database.config.ts` `nonNegativeIntEnv()` 함수
- **상세**: `DB_POOL_MAX='1abc'` 입력 시 `parseInt('1abc', 10)` = 1 이 반환된다(parseInt 가 선두 숫자를 파싱). 테스트는 순수 비숫자 (`'abc'`)와 음수(`-1`)만 검증하며 이 엣지 케이스는 커버하지 않는다. 운영 실수(잘못 붙인 단위 suffix 등)가 유효값으로 처리된다. 비즈니스 영향은 낮음(반환값이 여전히 양의 정수이므로 pg pool 동작 이상 없음).
- **제안**: 허용 가능한 수준이므로 차단 불요. 필요 시 `Number(raw)` 또는 strict integer 검사로 교체 고려.

---

### [INFO] 파일 9 — `updateExecutionStatus` else 분기 적용 범위 명시
- **위치**: `execution-engine.service.ts` line ~9249 주석: "else 분기 호출은 RUNNING / COMPLETED 전이뿐이며 FAILED/CANCELLED 직접 마감과 linkedNodeExec 짝 전이는 범위 밖."
- **상세**: guarded raw UPDATE 의 `status IN ('pending', 'running', 'waiting_for_input')` 가드가 RUNNING → COMPLETED 전이에 올바르게 적용된다. FAILED/CANCELLED 는 `linkedNodeExec` 를 통한 트랜잭션 분기로 처리돼 기존 원자성 보장이 유지된다. 설계 의도와 구현이 일치함.

---

### [INFO] 파일 13/12 — `resolveRecipientsForBatch` 에서 personal-scope 통합의 경우 owner/admin 대신 creator 반환
- **위치**: `integration-expiry-scanner.service.ts` `resolveRecipientsForBatch()` 내 `if (integration.scope === 'personal') byIntegration.set(id, [integration.createdBy])`
- **상세**: spec/2-navigation/4-integration.md §11.2 의 수신자 정책(personal → creator, workspace → owner/admin)과 일치. 옛 `resolveRecipients()` 와 동일한 로직이 batch 형태로 이전됐으며 의미 불변이 보존됐다.

---

### [INFO] 파일 15 — `reEmbedAll` `documentCount` 반환값 의미 변경
- **위치**: `knowledge-base.service.ts` `reEmbedAll()` 반환값 `documentCount: enqueued`
- **상세**: 이전 구현은 `documentCount: docs.length` (전체 문서 수)를 반환했으나, 변경 후 `documentCount: enqueued` (실제 큐 적재 성공 건수)를 반환한다. 청크 적재 일부 실패 시 `enqueued < reset.length` 가 되어 API 응답의 `documentCount` 가 실제 DB 대상 문서 수와 달라진다. spec/2-navigation/5-knowledge-base.md 에는 이 필드의 의미가 "큐 적재 성공 건수 vs. 전체 대상 건수" 로 명세되지 않아 회색지대이다. 실패가 발생한 경우 호출자가 실제 진행 상황을 파악하기에 유용한 쪽(enqueued)이 더 정확하지만, 기존 계약과의 호환성은 확인이 필요하다.
- **제안**: API 소비자(프런트엔드)가 `documentCount` 를 어떻게 표시하는지 확인. 실패 없는 경상 경로에서는 동일하므로 차단 불요.

---

### [INFO] 파일 4 — V095 migration: INVALID 인덱스 잔존 시나리오
- **위치**: `V095__node_execution_exec_status_active_index.sql` 주석: "실패 시 INVALID 인덱스가 잔존할 수 있다 → DROP INDEX 후 재시도"
- **상세**: `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 는 이미 VALID 인덱스가 있으면 no-op 이지만 INVALID 인덱스가 있으면 에러를 반환한다. 주석이 이를 정확히 언급하고 DOWN: 에 rollback SQL 을 제공해 운영 대응 경로가 명확하다. DOWN 에 `IF EXISTS` 가 포함되어 idempotent 하다.

---

## 요약

24개 파일에 걸친 refactor-05-database 변경은 의도한 기능 — DB 커넥션 풀 튜닝 env 노출(M-5), 실행 상태 전이 lost-update 방지 guarded UPDATE(M-3), computeChainDepth 재귀 CTE 단일 쿼리(C-2), integration expiry scanner keyset 페이징(m-1) + admin 조회 N+1 제거(M-2), reEmbedAll/retryFailedDocuments 청크 적재 통일(M-1), findByWorkflow snapshot 제외(m-3), V095 partial composite index — 을 완전히 구현하고 있다. 주요 비즈니스 규칙(chain depth 32, admin/personal 수신자 분리, guarded UPDATE의 비-terminal 가드, 청크 실패 시 rollback + lock 보상)이 코드에 정확히 반영됐다. 에러 시나리오(affected=0, 전 청크 실패, INVALID 인덱스, 음수/NaN 환경변수)에 대한 정의가 명확하고, 테스트가 경계값(depth 31/32, connectionTimeout=0, 빈 배치 등)을 포괄한다. spec fidelity 관점의 주요 발견은 §7.1 목록 응답에서 snapshot 제외가 spec 에 반영돼야 하는 SPEC-DRIFT 이며, 이는 코드 버그가 아니라 spec 갱신 누락이다. 나머지 발견사항은 INFO 수준이다.

---

## 위험도

LOW
