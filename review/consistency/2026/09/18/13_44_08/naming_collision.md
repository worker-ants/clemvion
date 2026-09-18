# 신규 식별자 충돌 검토 — spec-draft-deletion-cascade-indexes.md

## 검토 대상 신규 식별자

- 마이그레이션 버전: `V112`~`V116`
- 인덱스 이름: `idx_node_execution_node_id` · `idx_integration_usage_log_node_execution_id` ·
  `idx_integration_usage_log_workflow_id` · `idx_llm_usage_log_node_execution_id` · `idx_llm_usage_log_execution_id`
- 신규 파일: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`
- spec 문서 신규 Rationale 절 제목: «삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)»
- 신규 엔티티/DTO/endpoint/이벤트/ENV 는 도입하지 않음 (기존 `NodeExecution`·`IntegrationUsageLog`·`LlmUsageLog` 엔티티의 인덱스만 추가)

## 확인 절차·결과

1. **마이그레이션 버전 충돌** — `codebase/backend/migrations/` 최대 버전은 `V111__trigger_workflow_id_index.{sql,conf}` (HEAD 및 `origin/main` 동일, `git fetch` 후 대조). `V112`~`V116` 은 디렉터리·`spec/**`·`plan/**` 전수 grep 0건 — target 의 "grep 0건" 주장과 일치, 단조 증가 규약([`spec/conventions/migrations.md`](spec/conventions/migrations.md) `V<max+1>`)에도 부합한다.
2. **인덱스 이름 충돌** — 다섯 이름 모두 `*.sql`/`*.md`/`*.ts` 전수 grep 시 target 문서 자신과 이번 리뷰의 `_target` 스냅샷 사본 두 곳에서만 발견. 기존 마이그레이션·spec 본문(`spec/1-data-model.md` §3 인덱스 표)에는 동명 인덱스가 없다.
3. **파일 경로 충돌** — `codebase/backend/test/` 에 `deletion-cascade-indexes.e2e-spec.ts` 는 존재하지 않는다(가장 가까운 기존 파일은 `trigger-deletion-releases-resources.e2e-spec.ts` — 이름 패턴 일관, 겹치지 않음). `plan/in-progress/spec-draft-deletion-cascade-indexes.md` 자체도 `spec-draft-*` 네이밍 컨벤션을 지키며 기존 3개(`spec-draft-eia-62-waiting-payload.md` 등)와 겹치지 않는다.
4. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 도입 없음. 기존 `NodeExecution`/`IntegrationUsageLog`/`LlmUsageLog` 필드명(`node_id`·`node_execution_id`·`workflow_id`·`execution_id`)은 `spec/1-data-model.md` §2.10.1·§2.24 필드 정의와 대조해 그대로 일치.
5. **API endpoint / 이벤트 / ENV var 충돌** — target 은 이 범주의 신규 식별자를 도입하지 않는다 (해당 없음).
6. **삽입 지점 텍스트 앵커 충돌 여부** — S2·S4 가 뒤에 덧붙이려는 기존 문장(`spec/1-data-model.md` §2.24 "(통계용 partial)." · `spec/data-flow/3-execution.md` sink 표 "활성 노드 조회/전이" · `spec/data-flow/5-integration.md` "V008 `(integration_id, at DESC)`.") 을 직접 Read 로 대조한 결과 문자열이 정확히 일치 — 다른 절/행에 잘못 삽입될 여지 없음.
7. **Rationale 절 제목 충돌** — 신규 절 «삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)» 을 `## Rationale` 맨 위, 기존 «Trigger `(workflow_id)` 인덱스 (2026-09-18)» 바로 위에 삽입한다. 두 절은 날짜는 같지만 제목이 다르므로 동일 식별자 충돌은 아니다 (다만 같은 날짜의 절이 두 개가 되어 가독성 상 근접함 — INFO 수준, 아래 발견사항 참고).

## 발견사항

- **[INFO]** Rationale 절 날짜 중복 (충돌 아님)
  - target 신규 식별자: `### 삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)`
  - 기존 사용처: `spec/1-data-model.md:959` `### Trigger (workflow_id) 인덱스 (2026-09-18)`
  - 상세: 두 절이 같은 날짜 타이틀을 가지고 바로 인접 배치된다. 식별자(제목 문자열) 자체는 다르므로 CRITICAL/WARNING 급 충돌은 아니지만, 이후 다른 spec 문서가 "2026-09-18 절" 을 날짜만으로 인용하면 모호해질 수 있다.
  - 제안: 필수는 아니나, 두 절 제목에 소재(트리거 vs 삭제 연쇄 FK 인덱스 다섯)가 이미 구분되어 있어 실질적 위험은 낮다. 별도 조치 불요.

## 요약

target 이 새로 도입하는 식별자(마이그레이션 버전 `V112`~`V116`, 인덱스 이름 다섯, e2e 스펙 파일 경로, plan 파일 경로)는 `codebase/backend/migrations/`·`spec/**`·`plan/**` 전수 grep 과 `origin/main` 대조에서 모두 0건 — 기존 사용처와의 실질적 충돌은 발견되지 않았다. target 은 신규 엔티티·API endpoint·이벤트명·ENV var 를 도입하지 않으며, 기존 엔티티(`NodeExecution`/`IntegrationUsageLog`/`LlmUsageLog`)의 필드명·spec 삽입 지점 앵커 텍스트도 실제 문서와 정확히 일치함을 확인했다. 유일한 관찰 사항은 신규 Rationale 절과 기존 절이 같은 날짜 타이틀을 공유한다는 점이나 제목 문자열 자체는 달라 충돌로 보기 어렵다.

## 위험도

NONE
