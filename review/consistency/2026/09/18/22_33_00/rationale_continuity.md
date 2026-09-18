# Rationale 연속성 검토 — `plan/in-progress/spec-draft-fk-remaining-dispositions.md`

## 발견사항

- **[INFO]** `Trigger (workflow_id) 인덱스` 절의 "나머지 여섯" 목록이 이번 draft 로 부분적으로 갱신되는데 상호 참조가 없음
  - target 위치: `## 처분 — 31개` 표(`auth_config.workspace_id` → V127, `knowledge_base.workspace_id` → V128), `## 변경안` S3
  - 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → `### Trigger (workflow_id) 인덱스 (2026-09-18)` 의 "같은 클래스 전수 — 나머지 여섯은 이 결정에 넣지 않았다" 목록(`auth_config.workspace_id` · `knowledge_base.workspace_id` · `integration_oauth_state.workspace_id` · `integration_oauth_preview.workspace_id` · `alert_rule.workflow_id` · `integration_usage_log.workflow_id`)
  - 상세: 그 절은 "이 결정(트리거 삼중 스캔 해소)에는 넣지 않았다" 는 **스코프 한정** 진술이라 이번 draft 가 같은 두 컬럼(`auth_config.workspace_id` · `knowledge_base.workspace_id`)을 **다른 근거**(조회 경로 비용, 처분 기준 "다")로 인덱스화해도 논리적 모순은 아니다. 다만 그 절만 단독으로 읽는 독자는 "여섯 다 미인덱스 상태" 로 오인할 수 있다 — S3 의 "앞 절 정정 세 곳" 이 `삭제 연쇄의 FK 인덱스 다섯` 절만 갱신하고 `Trigger (workflow_id) 인덱스` 절은 건드리지 않는다.
  - 제안: S3 에 네 번째 각주를 추가해 `Trigger (workflow_id) 인덱스` 절의 "나머지 여섯" 문장 뒤에 "그중 `auth_config.workspace_id`·`knowledge_base.workspace_id` 는 조회 경로 비용으로 이후 인덱스화됐다(V127·V128, 위 «쓸 인덱스가 없는 FK 서른하나의 처분» 절)" 를 덧붙이면 완전해진다. 필수는 아님 — 두 절의 결론이 실제로 충돌하지 않기 때문(WARNING 아님).

- **[INFO]** 취소선(strikethrough) 관례와의 형식 불일치
  - target 위치: `## 변경안` S3 "앞 절 정정 세 곳" — `edge.target_node_id`/`alert_rule.workflow_id` 문장, "전수 37" 문장, "나머지 32개" 문장 뒤에 각각 텍스트를 **추가**만 함
  - 과거 결정 출처: 같은 문서 `spec/data-flow/6-knowledge-base.md` `## Rationale` → `### 폐기·정정된 과거 서술 (이력)` (`~~Stuck 회수가 cron 으로…~~ → 실제 구현은…` 형태), `spec/data-flow/11-workflow.md` → `### duplicate 는 캔버스 전체를 복제한다 (메타-only 였던 서술의 철회)` 는 원 서술을 명시적으로 "철회" 로 표시
  - 상세: 이 저장소는 완전히 뒤집힌 결정에는 취소선/철회 표기를, 원 서술이 "그 범위 안에서는 여전히 참" 인 경우엔 범위를 좁히는 각주만 붙이는 두 관례가 공존한다(`Trigger (workflow_id) 인덱스` 절의 "그 절의 문장은 그 범위에서 참이라 고치지 않는다" 가 후자 선례). target 의 `edge.target_node_id` 케이스는 "그 측정은 1만 행 규모에서는 옳았다" 는 범위-한정 정정이라 후자 관례(각주만)를 따른 것으로 보이며, 이는 실제로 기존 선례와 정합한다 — CRITICAL/WARNING 아니고 순수 스타일 확인.
  - 제안: 현재 방식 유지 가능. 다만 "작은 테이블이라 넣지 않았다" 라는 결론 자체는 40MB/90만 행 규모에서 더 이상 참이 아니므로, 각주가 아니라 결론 문장 자체에 "(1만 행 기준)" 같은 범위 한정어를 인라인으로 넣으면 각주를 안 읽는 독자에게도 오도 소지가 줄어든다.

## 요약

target 초안은 Rationale 연속성을 이례적으로 신경 써서 작성됐다 — `## 변경안` S3 가 과거 두 절(`삭제 연쇄의 FK 인덱스 다섯`, 그리고 암묵적으로 `Trigger (workflow_id) 인덱스`)의 결론을 뒤집는 지점을 스스로 특정해 "무근거 번복이 되지 않도록" 새 근거(측정 구성의 산물이었다는 실측적 설명, 부분 인덱스 셈법 오류)를 명시적으로 함께 기록했고, `### 왜 FK 항목에서 조회 경로 인덱스까지 넣나` 절은 스코프 확장 자체가 지적당할 수 있음을 예상해 선제적으로 해명한다. 처분 기준(가~바)은 기존 절들이 세운 공식("자식 테이블 크기 × 연쇄로 지워지는 부모 행 수")과 부분 인덱스 규약(V115~V118 선례)을 그대로 계승하며, 31개 카운트 산식(10+13+3+4+1)도 앞선 37→40→28→31 산출과 정합한다. 발견된 것은 실질적 모순이 아니라 두 인접 절 사이의 교차 참조 누락과 취소선 관례의 경미한 형식 편차뿐이며 둘 다 결론의 정합성 자체는 해치지 않는다.

## 위험도
LOW
