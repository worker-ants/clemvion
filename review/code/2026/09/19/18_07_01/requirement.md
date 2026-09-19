# 요구사항(Requirement) 리뷰 — 엔티티 컬럼 선언 드리프트 정정 + 컬럼 층 가드

## 발견사항

- **[INFO]** `model_config.kind` 에 `default: 'chat'` 을 새로 선언 — spec 본문은 이 필드를 "판별자"로만 서술하고 기본값을 명시하지 않는다
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46`
  - 상세: `spec/1-data-model.md` §2.16 ModelConfig 표는 `kind` 를 `Enum` `chat`/`embedding`/`rerank` 로만 설명하고 기본값 서술이 없다. 다만 이 기본값은 새로 도입되는 것이 아니라 `V088__model_config_rename_kind.sql`(`ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'chat'`, 구 `llm_config`→`model_config` 마이그레이션 시 기존 chat 전용 행을 백필하기 위한 값)에 이미 존재하는 DB 사실을 엔티티 데코레이터가 뒤늦게 반영한 것이다 — DB·spec 어느 쪽도 바뀌지 않았고, TypeORM 선언만 실제 상태를 따라잡았다. 코드 변경은 옳다.
  - 제안: spec 표에 기본값을 명시할 정도로 세밀하지 않은 기존 관례라 조치 불요. 다음에 §2.16 을 편집할 사람이 궁금해할 수 있으니 여유가 되면 "kind (기본 `chat`, 레거시 chat 전용 시절의 백필 값)" 한 줄 보강을 고려할 수 있으나 이번 diff 의 결함은 아니다.

- **[INFO]** `spec/1-data-model.md` 에 이 여덟 곳 타입 정정을 반영하는 별도 변경이 diff 에 없다 — spec 은 이미 옳았다
  - 위치: `spec/1-data-model.md` §2.10.1(`node_execution_id`/`workflow_id` UUID), §2.24(`workspace_id` UUID), §2.25(`workspace_id` UUID) 등
  - 상세: 대조 결과 spec 표는 처음부터 이 필드들을 `UUID` 로 정확히 서술하고 있었다. 드리프트는 spec 이 아니라 TypeORM 엔티티 데코레이터(`@Column({ name })` 만 두고 `type` 생략 → TypeORM 이 `varchar` 로 오추론)에만 있었다. 이번 수정은 코드를 spec·실제 DB 양쪽에 맞춘 정확한 방향의 fix 다. SPEC-DRIFT 아님(spec 은 갱신할 필요가 없다) — 정상적인 "코드가 틀렸고 spec 이 옳았던" 사례로 기록한다.
  - 제안: 없음 (참고용 기록).

## 점검한 항목과 결과

1. **기능 완전성**: 트래커가 지목한 "아홉 곳"(파일 8개, alert_rule/workspace_invitation/integration_usage_log×2/llm_usage_log/node/edge/model_config/workflow_assistant_session) 전부가 diff 에 반영됨. `git diff origin/main...HEAD --stat -- codebase/` 로 재확인한 변경 파일 수(엔티티 8 + 테스트 1)가 plan 표의 항목 수와 정확히 일치.
2. **완결성 검증 방법론**: 사람 grep 이 아니라 TypeORM 스키마 비교기(`createSchemaBuilder().log()`)로 V001~V132 를 적용한 일회용 DB 전체를 대조해 "컬럼 층 문이 0인지"를 실측했다는 점이 이 fix 의 완전성 주장을 코드 리뷰어가 재현 가능한 형태로 뒷받침한다.
3. **DB 정합성 실측 재확인**: 마이그레이션 원본 대조 결과 — `V016__alert_rules.sql`/`V017__workspace_invitations.sql`(workspace_id UUID), `V014__llm_usage_logs.sql`(workspace_id UUID), `V001__initial_schema.sql`(`node_category`/`edge_type` 타입명), `V088__model_config_rename_kind.sql`(`kind DEFAULT 'chat'`), `V019__workflow_assistant.sql`(`last_interaction_at DEFAULT NOW()`) 모두 엔티티에 추가된 선언과 정확히 일치.
4. **`UNDECLARED_COLUMNS` 예외 목록의 완전성**: `grep -rl "vector("  migrations/*.sql` 결과 `vector` 컬럼을 갖는 테이블은 `document_chunk`·`agent_memory` 뿐 — 예외 목록 두 항목과 정확히 일치, 누락 없음.
5. **엣지 케이스**: 새로 추가된 컬럼 층 가드 테스트가 read-only 세션 미보호 상태에서 실제로 DDL 을 실행하려 시도하는 것을 (RO1 뮤턴트로) 검증했고, `installExtensions: false` 로 조용한 부작용(uuid-ossp 확장 설치 실패)까지 제거했다는 점이 꼼꼼함. `catalog()` 사전/사후 비교로 "컬럼 정의·enum 타입 불변"을 직접 단언.
6. **TODO/FIXME**: 변경된 9개 파일(엔티티 8 + e2e 파일) 전체에 TODO/FIXME/HACK/XXX 없음.
7. **의도와 구현 일치**: `describe()` 제목·헤더 주석이 "인덱스·제약은 단방향, 컬럼은 양방향"으로 정확히 갱신되어 실제 테스트 동작과 일치. 함수명(`isColumnLevel`, `dataSourceOptions`)과 동작이 일치.
8. **반환값/에러 시나리오**: `attempt()`/`inRolledBackTx()` 헬퍼가 SAVEPOINT/트랜잭션 예외 시에도 정리 경로를 보장. 신규 마지막 테스트의 `try/finally` 로 `readOnly` DataSource 가 초기화 실패해도 (`isInitialized` 가드) `destroy()` 를 건너뛰지 않음.
9. **spec fidelity**: 관련 SoT `spec/1-data-model.md` §2.6(Node)·§2.7(Edge)·§2.10.1(IntegrationUsageLog)·§2.16(ModelConfig)·§2.24(LlmUsageLog)·§2.25(AlertRule) 대조 — 모든 필드 타입 서술이 코드 변경과 정확히 일치. 이번 fix 이전에도 spec 은 옳았고 코드(TypeORM 데코레이터)만 틀렸던 것이므로 spec 자체의 수정은 필요 없다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 항목(Prisma→TypeORM 사실 정정 TODO)은 이번 diff 범위 밖의 별도 기존 drift 이며 트래커에 정확히 등재됨.
10. **프로세스 정합성**: `review/consistency/2026/09/19/16_54_09/SUMMARY.md` (`--impl-prep` 재실행) 이 Critical 0 · BLOCK:NO 로 확인됨. `plan/in-progress/entity-column-declaration-drift.md` 체크리스트 상 `/ai-review`·`--impl-done`·트래커 반영 세 항목이 아직 미완료 상태인 것은 결함이 아니라 이 리뷰 자체가 그 절차의 일부.

## 요약

트래커가 지목한 "엔티티 컬럼 선언이 실제 DB 와 다른 아홉 곳"을 마이그레이션 원본·TypeORM 스키마 비교기 실측 양쪽으로 교차 검증한 결과 전부 정확히 수정됐고, 새로 추가된 컬럼 층 가드 테스트(패턴 매칭 대조군 + 실거래 비교기 호출 + 읽기 전용 세션 이중 방어)도 다섯 정규식 패턴 각각의 하중을 표본으로 고정해 회귀를 잡을 수 있게 설계됐다. `UNDECLARED_COLUMNS` 예외 목록은 저장소 전체의 `vector` 컬럼과 정확히 1:1 대응해 누락이 없다. 관련 spec(`spec/1-data-model.md`)은 애초부터 정확한 타입·기본값을 서술하고 있었으므로 이번 변경은 "spec 을 따라잡은 코드 수정"이며 spec 자체의 갱신은 필요하지 않다(SPEC-DRIFT 아님). TODO/FIXME 잔존 없음, 반환값·에러 경로 누락 없음. CRITICAL/WARNING 급 결함을 발견하지 못했다.

## 위험도

NONE
