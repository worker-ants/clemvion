# Performance Review

## 발견사항

### 파일 16: spec/data-flow/4-file-storage.md

- **[WARNING]** KB 삭제 시 S3 객체를 for 루프로 순차 삭제 — N+1 외부 I/O 패턴
  - 위치: `file-storage.md` 변경 라인 (`knowledge-base.service.ts:644-658`)
  - 상세: spec 이 명시하듯 `remove(id, workspaceId)` 는 소속 document 전체를 조회한 뒤 각 `s3Service.delete(doc.fileUrl)` 를 for 루프로 개별 호출한다. S3/MinIO 는 Bulk Delete API (`DeleteObjects`) 를 지원하므로 문서 수가 늘어날수록 RTT 가 선형으로 증가한다. KB 규모에 따라 수십~수백 건의 순차 HTTP 호출이 발생할 수 있다.
  - 제안: `s3Service` 에 `deleteMany(keys[])` 메서드를 추가하고 AWS S3 SDK `DeleteObjectsCommand` (최대 1000개 batch) 로 구현한다. spec 에도 "for 루프 개별 호출" 대신 "batch DELETE" 로 기술을 수정해야 한다.

### 파일 20: spec/data-flow/9-observability.md

- **[WARNING]** AlertsEvaluator 가 enabled rule 전체를 단일 쿼리로 로드한 뒤 rule 수 × 평가 쿼리를 루프 실행 — N+1 DB 호출 패턴
  - 위치: `9-observability.md` §1.3, `alerts-evaluator.service.ts:58-103`
  - 상세: `Eval->>PG: SELECT alert_rule WHERE enabled=true (전체 직접 로드)` 후 `loop each rule` 안에서 각 rule 마다 별도 집계 쿼리를 날린다. rule 이 R개면 1 + R번의 DB 쿼리가 실행된다. 5분마다 실행되며, rule 수가 증가할수록 평가 주기 내 DB 부하가 선형으로 증가한다.
  - 제안: `type` 별로 쿼리를 묶어 한 번에 모든 rule 을 평가하는 `GROUP BY rule_id` 배치 집계 쿼리로 전환하거나, 최소한 동일 `type` 의 rule 들을 단일 window 집계로 통합해 쿼리 수를 O(type_count) 로 줄인다.

- **[INFO]** AlertsEvaluator 가 5분마다 `enabled=true` rule 전체를 full scan — 인덱스 의존 확인 필요
  - 위치: `9-observability.md` §2.1 스키마 매핑
  - 상세: spec 이 `idx_alert_rule_enabled (enabled) WHERE enabled=true` partial 인덱스를 신규 기술하고 있다. 이 인덱스가 실제 마이그레이션에 반영되어 있는지 확인이 필요하다 — spec 갱신은 됐으나 대응 마이그레이션 파일이 누락되면 full table scan 이 발생한다.
  - 제안: 해당 인덱스가 포함된 마이그레이션(V번호)을 spec 에 명시하고, `migrations.spec.ts` 가드로 인덱스 존재를 검증한다.

### 파일 11: spec/data-flow/10-triggers.md

- **[INFO]** Schedule 생성이 단일 트랜잭션이 아닌 순차 save — 고아 trigger 발생 가능
  - 위치: `10-triggers.md` §1.4 Schedule ↔ Trigger 동기화
  - 상세: spec 이 "INSERT trigger save **후** INSERT schedule save (순차 — 단일 트랜잭션 아님; 중간 실패 시 고아 trigger 가능)" 을 명시했다. 트랜잭션이 없으면 trigger INSERT 성공 + schedule INSERT 실패 시 고아 trigger row 가 DB 에 남는다. 이는 직접적 성능 문제는 아니나, 고아 row 누적이 장기적으로 쿼리 성능에 영향을 준다.
  - 제안: trigger·schedule INSERT 를 단일 트랜잭션으로 묶는다. spec 에도 "단일 트랜잭션 아님" 대신 트랜잭션 보장을 기술하는 방향을 권장한다.

### 파일 12: spec/data-flow/11-workflow.md

- **[INFO]** `POST /:id/save` 의 "엣지 전부 교체 (기존 삭제 후 재삽입)" 패턴 — 대규모 워크플로우에서 불필요한 쓰기 증폭
  - 위치: `11-workflow.md` §1.1 sequenceDiagram
  - 상세: spec 이 엣지 전체를 매 save 마다 DELETE + re-INSERT 하는 것을 명시한다. 노드가 많은 워크플로우(수십~수백 노드)에서는 변경되지 않은 엣지까지 전부 교체되어 불필요한 WAL 기록과 인덱스 갱신이 발생한다.
  - 제안: upsert 기반 diff 적용(변경된 엣지만 INSERT/UPDATE/DELETE)으로 전환하거나, 현재 패턴을 유지한다면 이를 정책으로 명시하고 워크플로우 최대 노드 수 제한을 spec 에 포함시켜 쓰기 증폭 상한을 관리한다.

### 파일 18: spec/data-flow/7-llm-usage.md

- **[INFO]** LLM 호출마다 `resolveConfig` + `chat` 2단계 분리 — 호출자마다 별도 DB 쿼리 발생
  - 위치: `7-llm-usage.md` §1.2 sequenceDiagram
  - 상세: 개편된 API 는 호출자가 `resolveConfig()` 로 config 를 얻은 뒤 별도로 `chat(config, ...)` 를 호출한다. 동일 실행 컨텍스트 안에서 동일 `llmConfigId` 로 여러 번 LLM 을 호출하는 경우(예: AI Agent 의 multi-turn) `resolveConfig` 가 매번 `SELECT llm_config` DB 쿼리를 날릴 수 있다. spec 에 캐싱 보장이 기술되어 있지 않다.
  - 제안: `resolveConfig` 결과를 호출자가 재사용하는 패턴이 맞다면 spec 에 "호출자가 config 를 캐시한다" 는 지침을 추가한다. 또는 `LlmService` 내부에서 request-scoped 캐싱을 적용해 동일 config 에 대한 중복 DB 조회를 방지한다.

---

## 요약

이번 변경은 전부 spec 문서(마크다운) 동기화로, 실행 가능한 코드 자체의 변경은 없다. 따라서 이 PR 이 직접 신규 성능 회귀를 유발하지는 않는다. 그러나 spec 이 새로 명시한 구현 사실 중 두 가지가 주목된다. 첫째, `knowledge-base.service.ts` 의 KB 삭제가 for 루프 순차 S3 DELETE 임이 명시되었는데, 이는 문서 수 기준 O(n) 외부 I/O 이며 S3 Bulk Delete API 로 개선 가능하다. 둘째, `AlertsEvaluatorService` 가 5분마다 실행하면서 rule 수만큼 DB 집계 쿼리를 순차 실행하는 N+1 패턴이 명시되었는데, rule 이 늘어날수록 평가 주기 내 DB 부하가 선형 증가한다. 나머지 발견사항(schedule 트랜잭션 미보장, 엣지 전체 교체, LLM config 재조회)은 중규모 이상에서 누적될 수 있는 성능 트레이드오프로, 해당 도메인의 규모 가정을 spec 에 명확히 기술하거나 개선 plan 을 연계하는 것을 권장한다.

## 위험도

LOW
