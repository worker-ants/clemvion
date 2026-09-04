# Rationale 연속성 검토

## 검토 범위

- scope 델타 2개 파일: `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`
- diff-base: `origin/main`, target: HEAD (Schedule 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` 교체, V110)
- 실제 확인 방법: `git diff origin/main...HEAD -- spec/1-data-model.md spec/data-flow/10-triggers.md`, `git log --all -S "next_run_at, is_active"`, `git show origin/main:spec/1-data-model.md` (변경 전 원문 대조), `codebase/backend/migrations/V056*`·`V110*` 대조. 프롬프트에 Rationale 발췌가 실려 있지 않아("관련 Rationale 섹션 없음") 직접 조회로 보강했다.

## 발견사항

없음. CRITICAL·WARNING·INFO 모두 발견되지 않았다.

### 점검한 4개 관점과 결과

1. **기각된 대안의 재도입** — target 은 오히려 이전에 채택됐던 안(부분 인덱스 `(next_run_at, is_active) WHERE is_active`)을 폐기하는 쪽이다. `git show origin/main:spec/1-data-model.md` 로 변경 전 원문을 확인한 결과, 그 옛 인덱스에는 애초에 **Rationale 섹션에 등재된 근거가 없었다** — §3 표의 한 줄 서술뿐이었다. 즉 target 이 되살리는 "기각된 대안"은 없다.
2. **합의된 원칙 위반** — `spec/1-data-model.md` 전체의 partial index 서술(Integration.install_token, NodeExecution 활성 행, Notification dismissed 제외 등)을 훑었으나 "항상 partial index 를 쓴다" 류의 전역 원칙은 존재하지 않는다 — 매 항목이 실제 쿼리 형태 기준 개별 근거로 정당화되는 것이 이 문서의 확립된 패턴이다. 이번 변경(`WHERE is_active` 제거)은 "이 목록 쿼리가 `is_active` 를 걸지 않는다"는 실측 근거로 그 패턴을 그대로 따른다 — 원칙 위반 아님.
3. **결정의 무근거 번복** — 정반대로, target 은 이 프로젝트가 요구하는 형식을 모범적으로 지켰다. 새 `## Rationale` 서브섹션(`spec/1-data-model.md` "Schedule 인덱스 `(next_run_at, is_active)` → `(workspace_id, next_run_at)` (2026-09-04)")이 **PostgreSQL 18.4 실측 표**와 함께 **기각한 대안 3개**(부분 조건만 제거 / `(workspace_id)` 단독 / 단순 DROP)를 각각 이유를 달아 명시했고, 출처(`#1277` 등재, `#1278` 전제 교체)도 `git log -S` 로 재검증되어 정정된 상태다(커밋 `99e1500af`). `data-flow/10-triggers.md` 미러도 동기화됐다.
4. **암묵적 가정 충돌** — 관련 invariant 는 `spec/conventions/migrations.md` §3 "Append-only 원칙"(이미 main 에 들어간 V<N> 수정 금지). 이번 변경은 새 파일 `V110__schedule_workspace_next_run_index.sql`/`.conf` 로만 이뤄지며 `V002`(옛 인덱스 생성)·`V106`을 수정하지 않는다 — invariant 준수. CONCURRENTLY 인덱스 교체 순서(CREATE 신규 → DROP 구) 도 선례 `V056`과 동일 패턴을 따른다. V110 이 추가한 `DROP ... IF EXISTS` 선행 스텝(재실행 안전성, 리뷰 `23_02_51` W1 반영)은 `V056`/`V106` 에는 없다는 비대칭을 마이그레이션 주석 자체가 명시적으로 인정하고, 규약화는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 후속 항목으로 등재해 두었다 — 은폐 없이 인지·추적됨.

## 요약

이번 diff 는 `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 의 Schedule 인덱스 전략을 교체하는 변경으로, 옛 결정에는 애초에 대응하는 Rationale 이 없었고(단순 표 서술) target 이 그 자리에 실측 기반의 신규 Rationale — 기각 대안 3종의 개별 근거 포함 — 을 채워 넣었다. 인용 오류(출처 PR 번호)까지 자체 재검증해 정정한 이력(`99e1500af`)이 있어 오히려 Rationale 연속성을 강화하는 방향의 변경이다. `migrations.md` §3 append-only invariant 도 새 V번호만 사용해 준수했고, CONCURRENTLY 스왑 순서는 선례(V056)와 일치한다. 저장소 전역에 "partial index 를 항상 써야 한다"는 합의 원칙이 없으므로 이번 변경이 그런 원칙과 충돌하지도 않는다. Rationale 연속성 관점에서 지적할 사항이 없다.

## 위험도

NONE
