# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `V110` 마이그레이션이 이 diff 안에서 이미 구현됐는데, 소스 plan 의 체크박스·종결조건 표는 여전히 "잔여 작업"으로 남아 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:379`, `:430`
  - 상세: L379 는 `- [ ] idx_schedule_next_run — 실측 완료, 답은 (c). **V110 적용만 남았다**` 라고 적고, L430 종결조건 표도 `잔여는 V110 마이그레이션 적용뿐` 이라고 적는다. 그런데 이 diff 자체가 `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql`/`.conf` 를 신규 생성하고 `schedule-trigger.e2e-spec.ts` 에 그 인덱스를 검증하는 e2e 테스트까지 추가했다 — 즉 "V110 적용" 이 이미 이 커밋 묶음 안에서 끝났다. 체크박스는 `[ ]` 그대로이고 두 자리 서술 모두 "적용만 남았다" 는 이제 사실과 어긋난다. `plan/in-progress/spec-draft-schedule-index.md` 의 frontmatter `status: in-progress` 와 §6 "구현(V110)은 같은 PR 의 developer 단계에서 이어서 수행한다" 도 같은 이유로 동일하게 stale 하다. 이 저장소가 이미 "체크박스는 실제 상태를 반영해야 하고, 체크와 `complete/` 이동은 한 동작" 이라는 규율을 명시해 둔 영역이라(동일 세션에서 반복된 실패 패턴), 리뷰/머지 전에 정정하지 않으면 다음 사람이 "V110 이 아직 안 됐다"고 오판해 중복 작업하거나, 반대로 (a)/(b) 로 직접 마이그레이션을 만들 위험(§`spec-draft-nullable-notation-followups.md` L379 원문이 이미 이 위험을 지적)이 여전히 문서상 열려 있는 것처럼 보인다.
  - 제안: 이 diff 의 마무리 커밋에서 L379 체크박스를 `[x]` 로, L379-397 본문·L430 표 셀을 "V110 적용 완료(2026-09-04)" 로 갱신한다. `spec-draft-schedule-index.md` 의 frontmatter `status` 도 갱신하고, 두 plan 이 planner+developer 트랙 모두 종료됐다면 `plan/complete/` 이동 대상인지 함께 판단한다(plan-lifecycle 판단은 이 리뷰의 범위를 벗어나므로 별도 확인 권장).

- **[WARNING]** `spec/1-data-model.md` 의 `## Rationale` 섹션에 이번 인덱스 교체 결정에 대한 항목이 없다
  - 위치: `spec/1-data-model.md:914` (변경된 Schedule 인덱스 행), `## Rationale` 섹션(같은 파일, 예: `### alert_rule 을 §2.25 로 등재`, `### WorkflowVersion.snapshot 구성 서술 정정` 항목들)
  - 상세: 이 저장소의 CLAUDE.md 는 "결정의 배경·근거"의 SoT 위치를 "해당 spec 문서 끝의 `## Rationale`" 로 명시한다. `spec/1-data-model.md` 자신도 이 관행을 이미 여러 차례 따르고 있다 — 표의 다른 행(예: `alert_rule`, `WorkflowVersion.snapshot`)이 변경될 때마다 같은 파일 하단 `## Rationale` 에 날짜가 박힌 항목을 추가해 두었다. 그런데 이번 Schedule 인덱스 교체는 (a) DROP / (b) 부분조건 제거 / (c) `(workspace_id, next_run_at)` / (d) `(workspace_id)` 단독 네 후보를 실측으로 비교하고 (d) 대신 (c) 를 택한, 표 한 줄로 요약하기엔 근거가 두터운 결정인데도 spec 자체의 `## Rationale` 에는 항목이 추가되지 않았다. 그 상세 근거는 `plan/in-progress/spec-draft-schedule-index.md` 에만 있는데, plan 문서는 라이프사이클상 결국 `plan/complete/` 로 이동하거나 archive 되는 "작업 추적" 문서이지 spec 의 "결정 근거" SoT 가 아니다(같은 CLAUDE.md 표가 이 둘을 별개 행으로 분리해 둔 이유이기도 하다). 표 셀 자체의 인라인 설명(예: "선두가 workspace_id 라 다른 정렬 컬럼에서도 진입을 준다")은 훌륭하지만, "왜 (d) 가 아니라 (c) 인가", "왜 (a)/(b) 는 기각됐는가" 같은 트레이드오프 서술은 spec 문서 자체에는 남지 않는다.
  - 제안: `spec/1-data-model.md` `## Rationale` 에 `### Schedule 인덱스 (next_run_at, is_active) → (workspace_id, next_run_at) 교체 (2026-09-04)` 류의 짧은 항목을 추가하고, 실측 상세는 지금처럼 `plan/in-progress/spec-draft-schedule-index.md` 를 가리키는 식으로 요약+링크 패턴을 쓴다(기존 `install_token 형식` 항목이 이미 이 패턴을 쓰고 있다).

- **[INFO]** e2e 스펙 파일 상단 JSDoc 의 "검증 대상" 목록이 새로 추가된 스키마 테스트를 반영하지 못해 불완전하다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:8-18`
  - 상세: 파일 최상단 모듈 docstring 은 "검증 대상" 6개 불릿(cron preview, trigger 동반 생성, PATCH 재계산, run-now, delete, 비활성 동기화)을 나열해 이 파일이 검증하는 범위를 요약한다. 이번 diff 는 새 `it('schema: schedule 인덱스가 (workspace_id, next_run_at) 로 교체됨 (V110)', ...)` 를 추가했는데(파일 내 자체 JSDoc 은 상세하고 정확함), 이 축은 "cron 라이프사이클" 이 아니라 별개의 "스키마/인덱스 drift 방지" 축이라 상단 요약 불릿에 없다. 틀린 내용은 아니지만 목록이 이제 파일이 실제로 검증하는 것의 완전한 요약이 아니다.
  - 제안: 상단 docstring 불릿에 "V110: schedule 인덱스가 (workspace_id, next_run_at) 로 실재하는지(스키마 drift 방지)" 한 줄 추가.

## 요약

핵심 산출물(`V110__*.sql`/`.conf`, e2e 스키마 테스트, `spec-draft-schedule-index.md`)의 문서화 밀도는 이 저장소 평균을 크게 웃돈다 — 마이그레이션 헤더 주석이 실측 수치·기각된 대안·재실행 안전성·수동 롤백 절차까지 갖췄고 V056 선례와 정확히 정합하며, e2e 테스트의 JSDoc 도 "왜 양방향을 다 거는지"를 근거와 함께 설명한다. 다만 이 diff 가 실제로 V110 을 구현·검증까지 끝냈는데도 소스 plan(`spec-draft-nullable-notation-followups.md`)의 체크박스·종결조건 표는 "V110 적용만 남았다"는 이제-거짓인 서술을 그대로 갖고 있고, 인덱스 선택 근거(실측 기반 트레이드오프 판단)가 spec 자신의 `## Rationale`(같은 파일이 이미 반복해 온 관행)에는 남지 않고 plan draft 에만 있다는 두 가지 갭이 있다. 둘 다 코드 동작에는 영향이 없으나 향후 독자가 "아직 안 끝났다"고 오판하거나 "왜 이 인덱스를 골랐는가"를 spec 안에서 못 찾게 만들 수 있다.

## 위험도

MEDIUM
