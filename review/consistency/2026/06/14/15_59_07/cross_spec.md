### 발견사항

---

- **[WARNING]** `data-flow/15-external-interaction.md` — EIA-RL-06 reconciliation sweep BullMQ 큐 미등재
  - target 위치: `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-06, §9.3 "Terminal token revoke 의 at-least-once", §Rationale R15
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §2.2 Redis / BullMQ 표
  - 상세: target spec §9.3 은 BullMQ repeatable scheduler 워커(분 단위 `* * * * *`)가 `execution_token` 을 terminal `execution` 과 join 해 잔존 토큰을 일괄 revoke 하는 reconciliation sweep 을 필수 durable 보강으로 정의한다(EIA-RL-06, R15). 그러나 대응 data-flow 문서 §2.2 BullMQ 표에는 `notification-webhook` 큐와 `notification-secret-rotator`(hourly repeatable)만 등재되어 있고, 이 sweep 큐(이름 미정)와 upsertJobScheduler 멱등 패턴이 누락되어 있다. data-flow §1.4 시퀀스 다이어그램도 live fast-path(`revokeAllForExecution`)만 표현하며 reconciliation 경로가 없다. spec 본체(14-EIA)가 at-least-once 를 보장하는 두 경로를 규정하는데 data-flow 는 한 경로만 묘사하므로, 구현자가 data-flow 를 참조할 때 sweep 워커를 누락할 위험이 있다.
  - 제안: `data-flow/15-external-interaction.md` §2.2 BullMQ 표에 `token-revoke-sweep`(또는 확정 큐명) 행 추가. §1.4 시퀀스 다이어그램 또는 별도 §1.4.1 로 reconciliation sweep 흐름(BullMQ repeatable → execution_token JOIN terminal execution → revokeAllForExecution) 기술. §3.1 `iext_*` 상태 전이 다이어그램에 "sweep revoke" 경로 추가.

---

- **[INFO]** `spec/1-data-model.md` — `execution_token` 엔티티 §2.x 미등재
  - target 위치: `spec/5-system/14-external-interaction-api.md` §7.3 (`execution_token` 테이블 V060 정의)
  - 충돌 대상: `spec/1-data-model.md` §2 핵심 엔티티 목록 및 §1 ERD
  - 상세: target spec §7.3 은 `execution_token` 테이블(V060 — `jti PK`, `execution_id FK→execution ON DELETE CASCADE`, `issued_at`, `exp_at`, `idx_execution_token_execution_id`)을 EIA 인증 핵심 엔티티로 정의한다. 그러나 `spec/1-data-model.md` §1 ERD 의 `Execution` 하위 트리와 §2 핵심 엔티티 섹션에 `execution_token` 엔티티가 없다(data-flow §2.1 스키마 표에는 기술됨). `spec/1-data-model.md` §3 인덱스 전략 표에도 `execution_token` 인덱스(`idx_execution_token_execution_id`) 행이 없다. 작동 불가 충돌은 아니지만 데이터 모델 SoT 가 분산되어 있다.
  - 제안: `spec/1-data-model.md` §2 에 §2.13.2 또는 §2.14.x 로 `ExecutionToken` 엔티티(필드·인덱스·라이프사이클 요약) 추가. §1 ERD 의 `Execution` 하위에 `└── ExecutionToken (1:N)` 행 추가. §3 인덱스 표에 `execution_token (execution_id)` 행 추가.

---

- **[INFO]** `data-flow/15-external-interaction.md` — EIA-RL-06 at-least-once 보장 범위 기술 불일치
  - target 위치: `spec/5-system/14-external-interaction-api.md` §3.4 EIA-RL-06 (필수), §9.3 EIA-RL-06 섹션
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §Rationale "Fail-open 정책의 일관 표기"
  - 상세: data-flow Rationale 는 "토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 Redis/DB 미가용 시 fail-open" 이라 단언한다. target spec §9.3 R15 는 reconciliation sweep 이 live 경로 누락을 보강해 worst-case revoke latency 를 TTL(1h) → sweep 간격(≤1분)으로 축소한다고 기술한다. sweep 자체가 data-flow 에 없으므로 "fail-open + TTL(1h)까지 토큰 잔존"이 현 data-flow 기준 worst-case 인데 target spec 은 "≤1분"을 보장한다고 명시한다. 보장 범위가 어긋난다.
  - 제안: data-flow §Rationale 의 fail-open 단언을 "live 경로 단독 worst-case = TTL(1h), sweep 경로 추가 시 ≤1분"으로 보완하거나, sweep 기술 추가 후 해당 Rationale 절을 갱신.

---

### 요약

Cross-Spec 일관성 관점에서 target 문서(`spec/5-system/14-external-interaction-api.md`)가 기존 spec 과 직접 모순되는 CRITICAL 항목은 없다. 데이터 모델(`spec/1-data-model.md`), Trigger 엔티티 확장 컬럼(notification_health 등), Workspace.settings.interactionAllowedOrigins, 에러 코드 컨벤션(TOKEN_* 계열 401 통일, STATE_MISMATCH·MESSAGE_TOO_LONG EIA 네임스페이스) 모두 기존 정의와 정합한다. 주요 간극은 target spec 의 핵심 신규 기능인 **EIA-RL-06 reconciliation sweep**(BullMQ repeatable, `execution_token` durable outbox 역할)이 대응 `data-flow/15-external-interaction.md` 에 완전히 반영되지 않은 것이다. 구현자가 data-flow 만 참조할 경우 sweep 워커를 누락해 at-least-once 보장이 단경로(live fast-path)로만 구현될 위험이 있다. 이 점을 WARNING 으로 등록하며, data-flow 문서 갱신이 필요하다.

### 위험도

MEDIUM
