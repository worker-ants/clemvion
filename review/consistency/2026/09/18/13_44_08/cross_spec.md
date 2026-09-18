# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-deletion-cascade-indexes.md`

## 검토 방법

target draft(§S1~S4, 실측·변경안·비대상·트래커 반영)를 `spec/1-data-model.md`(§2.10.1·§2.24·§3·`## Rationale`), `spec/data-flow/{3-execution,5-integration,7-llm-usage}.md`, `codebase/backend/migrations/README.md` §5, `spec/conventions/migrations.md`, 실제 엔티티(`node-execution.entity.ts`·`llm-usage-log.entity.ts`·`integration-usage-log.entity.ts`·`edge.entity.ts`)와 마이그레이션(V008·V014·V111)을 직접 열어 대조했다. 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)의 «여섯» 항목 원문과 선례(`plan/complete/spec-draft-trigger-workflow-index.md`, V111)도 대조했다.

## 발견사항

- **[WARNING]** 로그 테이블 두 곳의 쓰기 비용은 "추론"이며, 같은 문서 안의 선행 Rationale 이 요구한 별도 실측을 충족하지 못한다
  - target 위치: `## 실측 > 쓰기 비용` 문단, `## Rationale > 왜 llm_usage_log 두 인덱스만 partial 인가`
  - 충돌 대상: `spec/1-data-model.md` `## Rationale > ### Trigger (workflow_id) 인덱스 (2026-09-18)` 의 «같은 클래스 전수» 문단 — "**특히 `integration_usage_log` 는 로그 테이블이라 행 수가 가장 클 수 있지만, INSERT 가 잦은 테이블에 인덱스를 더하는 것은 쓰기 비용과 맞바꾸는 판단이라 따로 잰다.**"
  - 상세: target 이 새로 추가하는 다섯 인덱스 중 `node_execution(node_id)` 는 10만 행 INSERT 5회로 쓰기 비용을 직접 쟀지만(있음 median 1,060 ms · 없음 975 ms), `integration_usage_log(node_execution_id)` · `integration_usage_log(workflow_id)` · `llm_usage_log(node_execution_id)` · `llm_usage_log(execution_id)` 네 인덱스의 쓰기 비용은 "두 로그 테이블은 외부 호출 한 번에 1행이라 상대 비용이 더 작다 — **이것은 추론이고 로그 테이블 INSERT 는 따로 재지 않았다**" 로 명시적으로 대체됐다. 그런데 target 이 S3 에서 그대로 옮기겠다고 밝힌 바로 그 인접 Rationale 절이 "로그 테이블 인덱스 추가는 쓰기 비용을 **따로 잰다**" 는 방법론을 이미 세워 두고 있고, `integration_usage_log.workflow_id` 는 그 절이 "따로 재기 전까지는" 이라는 이유로 이전 PR(V111) 범위에서 **제외**했던 바로 그 컬럼이다. target 은 이 컬럼을 이번 PR 에서 인덱싱하면서 그 실측 전제를 충족하지 않고 추론으로 넘어간다.
  - 제안: 두 로그 테이블 각각에 대해 `node_execution` 과 동일한 절차(10만 행 INSERT ×5, 인덱스 있음/없음 median)로 실측을 추가하거나, 실측 대신 추론으로 대체하는 것 자체를 그 근거(단발성 외부 호출당 1행이라 상대 비중이 작다)와 함께 S3 의 새 Rationale 절에 "추론이며 실측 아님" 을 명시적으로 옮겨 적어 다음 독자가 이 절의 다른 실측(있음/없음 median)과 같은 신뢰도로 오인하지 않게 한다. (draft 본문은 이미 이 문장을 담고 있으므로, S3 이관 시 **누락하지 않는 것**이 실질적 조치다.)

- **[INFO]** 캔버스 노드 삭제의 `node_execution` CASCADE 삭제가 "실행 이력 보존" 원칙과 대비된다 — target 이 이미 비대상으로 명시했으나 상호 참조가 없다
  - target 위치: `## 비대상` 표 3번째 행 — "캔버스 저장이 노드를 지울 때 그 노드의 실행 이력까지 CASCADE 로 사라지는 것"
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` §2.1 — "`execution.trigger_id` | SET NULL (**실행 이력은 보존**) — 트리거 삭제로 과거 실행 통계·감사 추적이 끊기지 않게 함"
  - 상세: 트리거 삭제 경로는 실행 이력을 보존하도록(SET NULL) 설계된 반면, 캔버스에서 노드를 빼는 경로는 그 노드의 `node_execution` 행 자체를 CASCADE 로 지운다(기존 FK 설계, target 이 새로 만든 것은 아님). target 은 이를 "데이터 보존 정책 질문이지 인덱스 문제가 아니다" 로 정확히 비대상 처리했으나, 그 판단의 근거가 되는 대비되는 기존 원칙(트리거 삭제 시 실행 이력 보존)을 인용하지 않는다.
  - 제안: 필수 아님 — 이미 올바르게 스코프 밖으로 뺐다. 다음에 이 비대상 항목을 실제 트래커 항목으로 승격할 때 `spec/2-navigation/2-trigger-list.md §2.1` 의 "실행 이력 보존" 원칙을 대비 근거로 인용하면 그 후속 논의가 왜 지금 이 CASCADE 가 예외인지(또는 예외가 아니라 결함인지)를 더 빨리 판정할 수 있다.

- **[INFO]** `spec/data-flow/5-integration.md` sink 표 삽입 지점의 앵커 문구가 셀 전체가 아니라 셀의 앞부분만 가리킨다
  - target 위치: `## 변경안 > S4` 두 번째 불릿 — "`V008 \`(integration_id, at DESC)\`.` 뒤에 …"
  - 충돌 대상: `spec/data-flow/5-integration.md` 338행의 실제 셀 값 — `V008 \`(integration_id, at DESC)\`. 보존 90일 일일 배치 정리`
  - 상세: 앵커로 지목한 문자열은 그 셀의 앞부분이고, 뒤에 "보존 90일 일일 배치 정리" 가 이어진다. 지정한 위치대로 삽입하면 결과가 `… (FK CASCADE). 보존 90일 일일 배치 정리` 가 되어 문장 순서 자체는 자연스럽지만, 다른 두 파일(`3-execution.md`·`7-llm-usage.md`)의 앵커가 각각 그 셀의 **끝** 문구(`… (활성 노드 조회/전이)`, `… 통계용`)인 것과 달리 이 앵커만 셀 중간이라 developer 가 "뒤에" 를 셀 맨 끝으로 오독할 여지가 작게 있다.
  - 제안: 실질적 영향은 없음(문자열 자체는 grep 으로 유일하게 특정된다) — developer 턴에서 실제 파일을 열어 최종 셀 값이 두 문장의 자연스러운 이어붙임인지만 한 번 확인하면 충분하다.

## 검증된 사실 관계 (충돌 아님 — 근거만 기록)

- 다섯 FK 의 `ON DELETE` 방향(`node_execution.node_id` CASCADE, `integration_usage_log.{node_execution_id,workflow_id}` CASCADE, `llm_usage_log.{node_execution_id,execution_id}` SET NULL)은 각각 `node-execution.entity.ts`·`V008__integration_usage_log_and_metadata.sql`(엔티티 아닌 raw SQL)·`llm-usage-log.entity.ts` 실물과 정확히 일치한다.
- 새 식별자 5개(`idx_node_execution_node_id` 등)와 `V112~V116` 은 `codebase/`·`spec/`·`plan/` 전수 grep 0건이며, `origin/main` 최신 마이그레이션은 V111 까지다(방금 머지된 트리거 인덱스 PR과 번호 충돌 없음).
- "애플리케이션 코드 변경 없음"(TypeORM `@Index` 데코레이터 미추가)은 선례 V111(`trigger.entity.ts` 에도 `@Index` 없음, 순수 SQL 마이그레이션 + spec 갱신)과 같은 패턴 — 계층 책임 충돌 아님.
- 실행 이력 보존 배치는 `integration_usage_log` 90일 배치(`integration-expiry-scanner.service.ts` `USAGE_LOG_RETENTION_DAYS = 90`) 하나뿐이고 `node_execution`/`execution` 자체를 지우는 배치는 `execution-engine.service.ts`·`executions.service.ts` 어디에도 없다 — target 의 "실행 이력 보존 정리는 없다" 주장과 일치.
- 트래커 원문(`plan/in-progress/spec-draft-nullable-notation-followups.md` 4609~4617행)의 «여섯» 목록과 그 근거(29개 카탈로그 대조)가 target 의 인용과 정확히 일치하며, target 이 닫는 다섯 인덱스 중 이 «여섯» 목록에 속하는 것은 `integration_usage_log.workflow_id` 하나뿐이다(37−5=32, 산술 정합).
- `alert_rule.workflow_id`(CASCADE, §2.25)·`edge.target_node_id`(CASCADE, `edge.entity.ts`)를 소형 테이블로 비대상 처리한 판단은 두 FK 의 `ON DELETE` 방향과 일치한다.

## 요약

target 은 실측 수치(FK 트리거 비용·인덱스 크기·쓰기 비용)를 코드·마이그레이션과 대조했을 때 사실관계가 일관되고, 새로 부여하는 인덱스 이름·마이그레이션 버전(V112~V116)도 전수 grep 0건으로 충돌이 없다. 트래커의 «여섯» 항목에 대한 "전제 정정"(부모를 workflow·workspace 로 한정한 것이 좁았다)도 트래커 원문·선례 문서와 정확히 부합하며 산술도 맞는다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 여섯 관점 중 구조적 충돌은 발견되지 않았다. 유일한 실질 지적은 로그 테이블 두 곳(4개 인덱스 중)의 쓰기 비용이 target 자신이 인용하려는 같은 문서의 선행 Rationale 이 요구한 "따로 잰다" 는 실측 기준을 충족하지 못하고 추론으로 대체된 점이며, target 은 이 사실을 스스로 밝히고 있어 은폐된 결함은 아니다 — S3 로 옮길 때 그 disclosure 문장이 누락되지 않도록 하는 절차적 확인이 필요하다.

## 위험도

LOW
