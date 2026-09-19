# Rationale 연속성 검토 — spec-draft-data-model-fk-actions

## 발견사항

- **[INFO]** «77개» 셈이 26+49=75 와 어긋난다 — Rationale 서술 자체의 내부 정합
  - target 위치: `plan/in-progress/spec-draft-data-model-fk-actions.md` `## 방법` 절 "§2 의 «FK →» 행 **77개**: … 맞게 적은 곳 26 · **적지 않은 곳 49**"
  - 과거 결정 출처: 없음(이 PR 이 처음 제시하는 집계)
  - 상세: 이 문서가 최종적으로 `spec/1-data-model.md` 의 `## Rationale` 에 편입될 근거 서술인데, 26+49=75 로 인용한 총계 77 과 2 가 어긋난다. Rationale 연속성 관점에서 문제는 아니지만(과거 결정과 충돌하지 않음), 이 문서 스스로가 "새 Rationale" 로 기능하려는 서술이라 산술 정합이 나중에 그대로 spec 에 박히면 다음 사람이 "77개 중 나머지 2개는 뭔가" 를 추적해야 한다.
  - 제안: merge 전 77 의 구성(예: FK 로 적었지만 테이블명이 틀린 `re_run_of` 류가 "FK →" 로는 세었지만 "맞음/틀림/누락" 삼분류 어디에도 안 들어가는지)을 한 줄 보충하거나 숫자를 재검산. Rationale 연속성 자체를 막는 사안은 아니므로 INFO.

- **[INFO]** 노션 불통일을 의도적으로 남긴 결정 — 향후 checker 재지적 소지
  - target 위치: `## 비대상` "표기 통일" 항
  - 과거 결정 출처: 해당 없음(이 문서가 처음 만드는 스코프 경계)
  - 상세: 기존 26행의 `(CASCADE)` / `(ON DELETE CASCADE)` / `(cascade 삭제)` / `**SET NULL** — …` 4가지 표기가 혼재하는 것을 "사실이 맞으므로" 그대로 두고 새 49행만 짧은 형으로 통일한다고 명시. 결정 자체는 합리적이고 새 Rationale(§Rationale 세 번째 항목)도 갖췄으나, `spec/1-data-model.md` 에는 "표기 컨벤션은 이렇다" 를 규정하는 기존 `## Rationale` 항목이 없어 이 결정이 향후 유일한 근거가 된다.
  - 제안: 이대로 진행해도 무방. 다만 병합 시 이 비대상 결정 문장을 `spec/1-data-model.md` 의 `## Rationale` 에도 그대로 옮겨, 다음 사람이 표기 혼재를 "정리 안 된 drift" 로 오인해 재작업하지 않도록 한다(이미 draft 자체에 그 의도로 작성돼 있어 실질적으로는 충분).

## 정합성이 확인된 지점 (참고)

- **«user 참조 FK 13개 재처분» 게이트 준수**: `spec/1-data-model.md` 기존 Rationale "쓸 인덱스가 없는 FK 서른하나의 처분" 은 "사용자 삭제를 더하는 변경은 이 13개의 처분부터 다시 정해야 한다" 는 게이트를 못박았다. target 은 사용자 삭제 경로를 추가하지 않고 기존 DB 사실(NO ACTION 여섯 · 전부 User 참조)만 서술로 채우며, 그 사실이 "같은 문서 Rationale … 이 적은 «user 참조 FK» 의 삭제 동작과 같은 사실" 이라고 각주로 명시 교차 참조한다(§A 표 아래 문단). 게이트를 재해석·우회하지 않고 오히려 강화 인용한다 — 위반 없음.
- **닫힌 enum 완결성 원칙과의 정합**: 기존 Rationale "`alert_rule` 을 §2.25 로 등재" 는 `Notification.type` 의 "이 enum 이 전부다" 서술이 실제 값 누락으로 거짓이었던 사례를 이미 정정한 선례다. target §D(`finish_reason` 값 목록에 `error`·`auto_resume_pending` 추가)는 같은 클래스의 결함을 같은 원칙으로 고친다 — 원칙 재도입이 아니라 일관 적용.
- **그래프 RAG·삭제 연쇄 Rationale 과의 사실 일치**: target §A 의 `Entity.last_seen_chunk_id`·`Relation.evidence_chunk_id`(SET NULL), `Relation.head_entity_id`·`tail_entity_id`(CASCADE), `NodeExecution.execution_id`·`node_id`(CASCADE), `IntegrationUsageLog.node_execution_id`(CASCADE) 는 기존 Rationale "그래프 RAG 삭제 연쇄의 FK 인덱스 넷"·"삭제 연쇄의 FK 인덱스 다섯" 이 이미 전제하고 서술한 삭제 동작과 정확히 일치한다 — 새 설계가 아니라 이미 합의된 사실의 뒤늦은 표기.
- **§11.2 변경은 설계 번복이 아니라 사실 정정**: `integration_expiry_dispatch` 의 실제 UNIQUE 컬럼으로 교체하는 변경은 존재하지 않는 `threshold_key` 컬럼을 존재하는 세 컬럼으로 바꾸는 것으로, `data-flow/5-integration.md`·`8-notifications.md` 가 이미 맞게 적은 서술과 맞추는 정정이다. 이 우선순위(임계·재인증 시 재발사 의미)를 규정한 기존 `## Rationale` 항목은 이 번들에서 확인되지 않았고, target 이 새 정책을 만드는 것이 아니라 이미 존재하는 타 spec 서술에 맞추는 것이라 "무근거 번복" 에 해당하지 않는다.
- 그 외 CASCADE/SET NULL/NO ACTION 라벨은 실제 DB(pg_constraint)를 근거로 한 사실 기술이며, 검토 대상 Rationale 번들 안에서 이와 다르게 규정한 기존 결정문은 발견되지 않았다.

## 요약

target 문서는 spec 이 실제 DB 와 다르게 적은 사실을 메우는 정정 PR 로, 기존 `## Rationale` 이 세운 원칙(닫힌 enum 완결성·User 참조 FK 13개 재처분 게이트·그래프 RAG/삭제 연쇄 FK 동작)을 위반하거나 무단으로 뒤집는 지점이 없다. 오히려 게이트 문구를 각주로 명시 인용하고, 새 표기 결정에 대해 자체 `## Rationale` 을 함께 작성하는 등 연속성 절차를 잘 지켰다. 발견된 두 건은 모두 문서 내부 산술·표기 정합 보완 제안(INFO) 수준이며 과거 결정과의 충돌은 없다.

## 위험도
NONE
