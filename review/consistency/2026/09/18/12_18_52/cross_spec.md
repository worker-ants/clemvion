# Cross-Spec 일관성 검토 — `trigger (workflow_id)` 인덱스 draft

## 검토 대상

`plan/in-progress/spec-draft-trigger-workflow-index.md` (spec_impact: `spec/1-data-model.md`,
`spec/data-flow/10-triggers.md`)

## 대조 방법

target 이 편집을 예고하는 세 지점(S1~S3)을 실제 `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`,
`spec/2-navigation/2-trigger-list.md`, `spec/data-flow/11-workflow.md` 원문 및 `codebase/backend/migrations/`
와 대조했다 (번들 파일의 `spec/data-flow/10-triggers.md` 부분은 컨텍스트 예산 초과로 절단되어 있어
worktree 원본을 직접 읽었다).

## 발견사항

- **[INFO]** `notification_health` 부분 인덱스가 §3 인덱스 전략 표에서 이미 누락되어 있다 (target 도입 아님)
  - target 위치: S1 — `spec/1-data-model.md` §3 인덱스 전략, `Trigger | (workspace_id, endpoint_path) UNIQUE`
    행 바로 다음에 새 `Trigger | (workflow_id) | …` 행을 추가
  - 충돌 대상: 같은 문서 §3 인덱스 전략 표 (Trigger 행 2개만 존재) vs `codebase/backend/migrations/V061__trigger_notification_health_degraded_index.sql`
    (`idx_trigger_notification_health_degraded ON trigger(notification_health) WHERE notification_health = 'degraded'`, 실재)
  - 상세: target 자신의 "실측" 절이 이미 "`trigger` 의 인덱스는 `(workspace_id, type)` · `(workspace_id, endpoint_path) UNIQUE` ·
    `notification_health` 부분" 셋이라고 정확히 적고 있는데, §3 표는 앞의 둘만 갖고 있고 `notification_health` 부분 인덱스
    행이 없다(V061 이후 등재 누락, 이 draft 가 만든 갭이 아니라 사전 존재 갭). 같은 Trigger 섹션을 이번에 편집하므로 표가
    실제와 완전히 일치할 좋은 기회다.
  - 제안: S1 편집 시 `notification_health` 부분 인덱스 행도 함께 추가(또는 최소한 트래커에 별도 등재)하면
    §3 표가 실제 DB 상태와 완전히 일치한다. 이번 draft 의 스코프를 넓히라는 뜻은 아니며, 누락 자체를 인지하지
    못한 채 넘어가지 않도록 트래커 등재만이라도 권장.

- **[INFO]** S2 Rationale 이 언급할 `integration_oauth_state`/`integration_oauth_preview` 는 `spec/1-data-model.md`
  자체에는 엔티티로 등재돼 있지 않다
  - target 위치: S2 — `spec/1-data-model.md` `## Rationale` 맨 위에 새 절, "같은 클래스 전수" 표에
    `workspace → integration_oauth_state.workspace_id`, `workspace → integration_oauth_preview.workspace_id` 를 옮김
  - 충돌 대상: `spec/1-data-model.md` §2 엔티티 목록(§2.1~§2.25, 두 테이블 없음) 및 §3 인덱스 전략 표(두 테이블 행 없음) vs
    `spec/data-flow/5-integration.md` §2.1 (두 테이블의 스키마 정의 SoT)
  - 상세: 두 테이블은 `data-flow/5-integration.md` 가 스키마 SoT 이고 `1-data-model.md` 를 정의처로 잘못 가리키고
    있지는 않아(§2.25 `alert_rule` 사례처럼 "정의가 여기 있다"는 거짓 링크는 아님) 직접적인 모순은 아니다. 다만
    `1-data-model.md` Rationale 에 이 두 테이블명이 처음 등장하면, 그 문서만 읽는 사람은 §2 에서 대응 엔티티를
    찾지 못한다.
  - 제안: 새 Rationale 절에서 두 테이블을 언급할 때 `[data-flow/5-integration.md §2.1](./data-flow/5-integration.md#21-postgres)`
    링크를 동행하면 충분 — 두 테이블을 `1-data-model.md` 에 새로 등재하라는 뜻은 아니다(스코프 밖).

## 정합성 확인 (충돌 없음, 참고용)

- S1 문구("Postgres 는 FK 에 인덱스를 자동 생성하지 않는다", `CONCURRENTLY, V1xx` 표기)는 §3 표의 기존
  `Schedule | (trigger_id) | … V106` 행과 동일한 관용구·형식을 재사용해 정합적이다.
- S3 이 정확히 이어 붙이려는 원문(`spec/data-flow/10-triggers.md` §2.1 `trigger` 생성 행의
  "… 인덱스는 V002.")을 worktree 원본에서 grep 으로 대조 완료 — 문자열이 정확히 일치한다.
- `trigger.workflow_id` 로 트리거를 찾는 세 자리(외부 해제·비밀 정리 열거·FK CASCADE)에 대한 target 의 서술은
  `spec/data-flow/11-workflow.md` :153 ("트리거 자원 정리: 외부 자원을 트랜잭션 전에 해제…그 워크플로의 트리거 id 를
  열거한 다음 삭제") 및 `spec/2-navigation/2-trigger-list.md` §4.3 의 최근(#1345~#1348) 반영 내용과 일치한다 — 새로
  주장을 만드는 것이 아니라 이미 반영된 서술을 재확인·수치화하는 draft다.
- "같은 클래스 전수" 표의 나머지 항목들(`alert_rule.workflow_id`, `integration_usage_log.workflow_id`,
  `auth_config.workspace_id`, `knowledge_base.workspace_id`)에 대해 §2.25/§2.10.1/§2.17/§2.11 및 §3 인덱스 표를
  대조한 결과 실제로 선두 인덱스가 없다는 target 의 주장과 일치한다.
- 신규 식별자 `idx_trigger_workflow_id` · 마이그레이션 번호 `V111` 모두 저장소 grep 0건(`V110` 이 최신)으로,
  요구사항 ID/마이그레이션 번호 충돌 없음.
- RBAC·상태 전이·계층 책임 축은 이 draft 의 변경 범위(DB 인덱스 + 문서 서술) 밖이라 해당 없음.

## 요약

target 은 인덱스 현황·비용·"같은 클래스 전수" FK 스캔 결과를 실측으로 뒷받침하고, 편집 대상 세 지점(S1~S3)의
삽입 위치·인접 문구를 worktree 원문과 대조한 결과 정확히 일치한다 — 직접적인 CRITICAL/WARNING 급 모순은
발견되지 않았다. 다만 target 이 편집하는 바로 그 테이블(§3 Trigger 인덱스 행들)에 이미 사전 존재하는
`notification_health` 부분 인덱스 미등재 갭이 있고, Rationale 이 인용할 두 테이블(`integration_oauth_state`/
`integration_oauth_preview`)이 `1-data-model.md` 자체에는 엔티티로 없어 상호참조 링크가 없으면 추적이 끊긴다 —
둘 다 동기화 권장 수준의 INFO다.

## 위험도

LOW
