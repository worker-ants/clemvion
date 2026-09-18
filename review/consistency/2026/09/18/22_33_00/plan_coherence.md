# Plan 정합성 검토 — `plan/in-progress/spec-draft-fk-remaining-dispositions.md`

## 방법
- 대상 draft 가 "닫는다" 고 선언한 트래커 항목 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 **「선두 인덱스가 없는 FK — 부모를 한정하지 않은 전수 37개 중 28개 남음」** (라인 4616~4630) 을 직접 열어 대조.
- 그 항목이 SoT 로 가리키는 `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록(37행 카탈로그, ✅ 9행 기해소)을 열어 draft 의 「처분 — 31개」 표와 **행 단위 1:1 매핑**을 전수 검증(28행 + 「셈법이 놓친 셋」 = 31, 누락·중복 없음 확인).
- `plan/in-progress/**` 전체에서 `V12[1-9]|V130`, `migrations/README`, `model_config`/`AssistantSession`/`last_interaction_at`, `1-data-model.md:숫자` 인용을 grep 하여 (a) 마이그레이션 버전 충돌, (b) 인접 in-progress plan 의 line-anchor 인용이 이 draft 의 `spec/1-data-model.md` 편집(§3 표 삽입 지점 898행+, Rationale 신설 966행+)과 겹치는지, (c) 이 draft 의 「라」(부모를 지우는 앱 경로 없음) 전제와 충돌하는 계정 삭제류 계획이 있는지 확인.
- 실제 `codebase/backend/migrations/` 최신 파일(V120)을 확인해 V121~V130 슬롯이 비어 있음을 검증.

## 발견사항

- **[INFO]** 「라」 비대상 판정(부모를 지우는 앱 경로 없음)의 재개 트리거가 명시되어 있지 않음
  - target 위치: `## 처분 — 31개` 표 · `## Rationale` §처분 기준 「라」 항목
  - 관련 plan: 없음(신규 기능 plan 부재를 grep 으로 확인 — `탈퇴`/`계정 삭제`/`account deletion` 0건)
  - 상세: 13개 컬럼(`user.*` 11개 + 「셈법이 놓친 셋」 중 2개)의 비대상 판정이 "지금 스키마가 사용자 삭제를 받아주지 않는다"는 관측에 의존한다. 이는 현재로선 참이고 다른 in-progress plan 과도 충돌하지 않지만, 향후 사용자 탈퇴/계정 삭제 기능이 생기면 이 13개가 조용히 다시 열려야 하는데 그 재개 조건이 트래커 어디에도 캐너리로 박혀 있지 않다.
  - 제안: 이번 draft 범위 밖이라 지금 처리할 필요는 없음. 사용자 삭제 기능이 실제로 계획될 때 그 plan 이 이 draft(또는 `spec/1-data-model.md` Rationale 신설 절의 「라」 근거)를 참조하도록 만드는 것으로 충분 — 지금 이 draft 에 조치를 요구할 정도는 아님.

검토한 나머지 항목은 모두 정합적이었다:
- 트래커의 「다음 후보」(3개: `model_config→llm_usage_log`, `user→audit_log.user_id`, `user→execution.executed_by`)를 측정 후 처분했고, "재기 전에는 우선순위가 없다"는 트래커의 유보 조건을 실측으로 해소한 것이므로 미해결 결정 우회가 아니다.
- 트래커 부록의 28행 잔여 전부(`auth_config→trigger` ~ `workspace→knowledge_base`)가 draft 의 31행 처분표에 정확히 1회씩 매핑되어 누락·중복이 없다(전수 대조 완료).
- 「V112~V116 PR 이 `edge.target_node_id`·`alert_rule.workflow_id` 를 작은 테이블이라 넣지 않았다」는 이미 완료된 plan 의 결론을 규모 차이(엣지 1만 vs 10만)로 뒤집는데, 이를 조용히 덮지 않고 draft 자체가 `spec/1-data-model.md` Rationale 의 해당 문장 옆에 정정 각주를 추가하도록 S3 에 명시했다(무근거 번복 방지).
- 인접 미해결 결정(「캔버스 저장 시 노드 삭제로 실행 이력이 CASCADE 소실 — 보존 정책 결정 필요」, 「웹훅 트리거 조회 인덱스 — 유일성 범위 결정」)은 이 draft 가 손대지 않고 트래커에 남기거나 새 항목으로 넘겼다 — 일방적 결정 없음.
- `spec/1-data-model.md` 편집 지점(§3 표: 898행+, Rationale 신설: 966행+)이 다른 in-progress plan(`spec-update-node-cancellation-shutdown-classification.md` 등)의 line-anchor 인용(`:230`, `:546`)보다 뒤에 있어 그 인용들을 낡게 만들지 않는다. draft 자신도 §3 삽입을 줄번호가 아니라 의미 앵커("표 맨 앞", "`Workflow | (workspace_id, name)` 행 뒤" 등)로 지정해 이 문제를 스스로 회피한다.
- V121~V130 마이그레이션 번호는 실제 저장소 최신(V120)과 다른 in-progress plan 전부를 대조해도 충돌 없음.
- DROP-먼저 `CREATE INDEX CONCURRENTLY` 패턴은 트래커에서 이미 「규약화 완료」로 닫힌 결정이므로, 이를 그대로 따르는 것은 미해결 결정 우회가 아니라 기결 규약 준수다.

## 요약
대상 draft 는 트래커 `spec-draft-nullable-notation-followups.md` 의 단일 열린 항목(FK 인덱스 28개 잔여)을 겨냥하며, 그 항목이 SoT 로 지정한 부록 37행 카탈로그와 완전히 1:1 대조되는 31행 처분표를 만들어 트래커의 유보 조건("다음 후보"·"재기 전에는 우선순위 없음")을 실측으로 해소한다. 인접한 미해결 결정(보존 정책, 웹훅 인덱스 유일성 범위)에는 손대지 않고 트래커로 위임했으며, 이전 완료 plan 의 결론을 뒤집는 부분(엣지 인덱스 필요성 재평가)도 무근거 번복이 아니라 spec Rationale 에 정정 각주를 명시적으로 남기도록 설계되어 있다. 마이그레이션 버전·line-anchor 충돌도 실측으로 배제했다. Plan 정합성 관점에서 구조적 결함은 발견되지 않았고, 유일한 관찰(사용자 삭제 기능 부재에 의존하는 비대상 판정의 재개 트리거 부재)은 추적 성격의 INFO 로 지금 조치가 필요한 수준은 아니다.

## 위험도
LOW
