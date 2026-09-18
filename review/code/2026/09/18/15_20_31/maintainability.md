# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상
- `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.{conf,sql}`
- `codebase/backend/migrations/V118__relation_evidence_chunk_id_index.{conf,sql}`
- `codebase/backend/migrations/V119__relation_head_entity_id_index.{conf,sql}`
- `codebase/backend/migrations/V120__relation_tail_entity_id_index.{conf,sql}`
- `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (확장)
- `plan/in-progress/spec-draft-graph-fk-indexes.md`, `review/consistency/**` (산출물), `spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md`

애플리케이션 코드(서비스·컨트롤러·엔티티) 변경은 없다 — 순수 마이그레이션 추가 + e2e 확장 + spec/plan 문서. 따라서 함수 길이·중첩 깊이·순환 복잡도 관점은 대부분 해당 없음(SQL DDL·설정 파일에는 제어 흐름이 없다).

## 발견사항

- **[INFO]** V117~V120 네 `.sql` 파일의 헤더 주석 중 상당 블록이 파일 간 바이트 단위로 동일하다(실측 표·"800k 청크/400k 엔티티/800k 관계 규모 실측" 문단·비-트랜잭션 설명 문단). `diff`로 확인: 네 파일 모두 "800k 청크 / 400k 엔티티 / 800k 관계 규모 실측 …" 문단(대략 실측 3문단)과 "비-트랜잭션 (executeInTransaction=false, …) — CREATE/DROP INDEX CONCURRENTLY … 선례 V111~V116)." 문단이 완전히 동일 텍스트로 반복된다.
  - 위치: `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql:7~13`(공통 실측 문맥), `:20~23`(비-트랜잭션 설명) — 동일 블록이 `V118__relation_evidence_chunk_id_index.sql`, `V119__relation_head_entity_id_index.sql`, `V120__relation_tail_entity_id_index.sql`의 대응 위치에도 반복.
  - 상세: 각 파일이 20~29줄 중 절반 이상을 공용 컨텍스트 반복에 쓴다. 다만 이것은 새로 도입된 패턴이 아니라 이 저장소의 기존 컨벤션이다 — `V115__llm_usage_log_node_execution_id_index.sql`/`V116__llm_usage_log_execution_id_index.sql`도 "비-트랜잭션 …" 문단을 바이트 단위로 동일하게 반복하고, `migrations/README.md` §5는 "파일 = atomic forward step"을 명시적 이유로 든다(롤백 단위를 파일 하나로 자기완결시키기 위한 의도적 중복). 이번 PR은 그 선례를 정확히 따랐을 뿐이다.
  - 제안: 조치 불요(선례·README §5 근거와 일치). 다만 이 패턴이 이번까지 4개, 누적 V111~V120 총 10개 파일로 늘었으므로, 향후 같은 절이 더 늘어나면(예: 다음 FK 인덱스 묶음) 공용 서술을 `migrations/README.md`에 앵커로 옮기고 각 파일은 "근거: README §5 + `plan/complete/...md`" 한 줄만 남기는 리팩터를 고려할 시점을 저장소가 곧 넘길 수 있다 — 지금 당장의 차단 사유는 아니다.

- **[INFO]** `.conf` 파일 4개(`V117~V120`)도 파일명·V번호만 다르고 본문 3줄이 동일 템플릿이다.
  - 위치: `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.conf:1~4`, `V118__relation_evidence_chunk_id_index.conf:1~4`, `V119__relation_head_entity_id_index.conf:1~4`, `V120__relation_tail_entity_id_index.conf:1~4`.
  - 상세: `V111~V116`의 대응 `.conf` 파일과 동일한 3줄 템플릿 패턴을 그대로 따름 — 기존 컨벤션과 완전히 일관되고, `.conf`는 Flyway 설정 파일 특성상 문서화 목적 주석 외에 실질 내용이 `executeInTransaction=false` 한 줄뿐이라 추출할 여지도 적다.
  - 제안: 조치 불요.

- **[INFO]** `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`는 테이블 기반(`it.each`) 구조를 그대로 확장해 `EXPECTED` 배열에 4개 항목만 추가했다 — 새 분기·중첩·중복 로직 없이 기존 패턴을 재사용해 가독성·일관성이 좋다.
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:45~61`(신규 4항목), 헤더 주석 `:6~21`이 V112~V116/V117~V120 두 묶음을 명확히 구분해 서술.
  - 상세: 특기할 결함 없음. 확인 차 명시.

- **[INFO]** `spec/1-data-model.md` 신설 "그래프 RAG 삭제 연쇄의 FK 인덱스 넷" 절은 바로 아래 기존 "삭제 연쇄의 FK 인덱스 다섯" 절과 거의 동일한 구조(경로 표 → 실측 표 → 쓰기 비용 → 출처 인용)를 반복한다.
  - 위치: `spec/1-data-model.md` diff 상 968~1002행 부근(신설 절), 인접한 1004행 이하 기존 절.
  - 상세: 이 역시 저장소의 "Rationale 절 = 표준 4단 구조" 컨벤션을 그대로 따른 것으로, 일관성 관점에서는 오히려 바람직하다. 인접 절의 "32개 남음" 문장을 지우지 않고 정정 문장을 덧붙인 방식(1048~1049행)도 해당 PR의 consistency-check(WARNING 1건)가 이미 지적·반영한 사항이라 중복 지적하지 않는다.

발견된 모든 항목이 INFO 수준이며, WARNING·CRITICAL에 해당하는 가독성/네이밍/함수 길이/중첩/매직넘버/복잡도 결함은 없다. 인덱스 이름(`idx_<table>_<column>`)·마이그레이션 파일 명명·주석 구조 모두 기존 V111~V116 선례와 정확히 일치한다.

## 요약

이번 변경은 애플리케이션 로직 없이 순수 DDL 마이그레이션 4쌍(`.conf`+`.sql`) 추가, e2e 테스트 테이블에 4행 추가, spec/plan 문서 갱신으로 구성된다. 함수 길이·중첩 깊이·순환 복잡도 같은 절차적 복잡도 지표는 원천적으로 해당하지 않으며, 네이밍·주석 구조·테스트 확장 방식 모두 직전 PR(V111~V116, `6dbac1f53`)이 세운 컨벤션을 정확히 재사용해 저장소 전체와 높은 일관성을 보인다. 유일하게 짚을 만한 특징은 네 마이그레이션 파일 사이의 상당한 주석 중복인데, 이는 "파일 = 원자적 롤백 단위"라는 `migrations/README.md` §5의 명시적 설계 의도에 따른 것이라 결함이 아니라 의도된 트레이드오프로 판단한다. 전반적으로 유지보수성 관점에서 우수한 변경이다.

## 위험도
NONE
