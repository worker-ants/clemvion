# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 응답, 전문 확보 완료)

## 전체 위험도
**MEDIUM** — Critical 없음. `convention_compliance` 가 지적한 정책 문서 간 폭 불일치(S4 미적용 상태)가 이번 회차 최고 등급(WARNING)이며 차단 사유는 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `spec/conventions/migrations.md` §5 말미 콜아웃이 아직 "인덱스 **교체**"에만 한정된 문구로 남아 있어, 이미 확장된 `codebase/backend/migrations/README.md §5`(커밋 `51aef0107`/`ff7d79967`, 신규 추가에도 DROP-먼저 패턴 적용) 와 폭이 어긋난다. S4 는 이 갭을 닫는 계획일 뿐 아직 spec 본문에 미적용 | `spec/conventions/migrations.md:74~79` (현재 워킹트리 상태) | `codebase/backend/migrations/README.md §5`(이미 확장됨), `review/code/2026/09/18/12_54_44/SUMMARY.md` WARNING#2(미해소) | draft `## 변경안 > S4` 의 diff 문안을 그대로 `spec/conventions/migrations.md` §5 콜아웃에 적용. 적용 후 plan 체크리스트 1번을 "S1~S4 반영"으로 갱신하고 `--impl-done`(spec-linked scope) 으로 재확인 |
| 2 | convention_compliance (naming_collision 이 동일 사실을 INFO 로 중복 지적 — 더 강한 등급으로 통합) | S4 가 `migrations.md` 콜아웃을 "교체+신규 추가" 로 넓혀도, 자매 문서 `spec/data-flow/8-notifications.md:277` 는 여전히 "새로 쓰는 인덱스 **교체**는 README §5 를 따른다" 로 좁게 서술 — 같은 README §5 규칙을 두 spec 문서가 다른 폭으로 설명하게 됨 | draft `## 변경안 > S4` (scope 명시 없음, `8-notifications.md` 미포함) | `spec/data-flow/8-notifications.md:274~277` | 이번 PR 스코프 밖이어도, draft 의 "트래커 반영" 절 또는 S4 커밋 메시지에 "`8-notifications.md:277` 의 '교체' 한정 표현을 README §5 확장 폭에 맞춰 동행 갱신" 항목을 명시적으로 등재 (현재 draft 본문에는 이 항목이 없음) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | S4 의 1라운드 RESOLUTION 처분 번복은 실질 근거(2라운드 코드리뷰 WARNING#2 가 지적한 오독 위험)를 갖추고 있으나, 그 반박·재판정 서술이 `spec/conventions/migrations.md` 자체가 아니라 `plan/in-progress/spec-draft-trigger-workflow-index.md` 에만 남는다 | `spec/conventions/migrations.md` §5 콜아웃(변경 예정 자리) | 콜아웃 변경분 끝에 "적용 범위를 CONCURRENTLY 인덱스 생성 전체로 넓힌 이유는 README §5 참고(2026-09-18)" 1줄 포인터 추가 |
| 2 | rationale_continuity | S4 의 적용 범위를 "인덱스 생성 마이그레이션 전부"가 아니라 "`CREATE INDEX CONCURRENTLY` 를 쓰는 파일"로 좁게 유지한 것은 과잉 일반화를 피한 적절한 스코핑(위반 아님, 참고용) | draft `### S4` "`CONCURRENTLY` 로 한정하는 이유" 단락 | 조치 불요 |
| 3 | convention_compliance | `codebase/backend/migrations/V111__trigger_workflow_id_index.sql:5`, `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:196` 이 아직 `plan/in-progress/` 에 있는 draft 를 `plan/complete/...` 경로로 인용(현재 시점 거짓 참조). `review/code/2026/09/18/12_54_44` WARNING#1 로 이미 확인됨, draft 체크리스트가 이동 계획을 명시 | 위 두 `codebase/**` 파일 | draft 를 `plan/complete/` 로 이동하는 커밋에서 `grep -rn "plan/complete/spec-draft-trigger-workflow-index" spec/ codebase/` 로 전수 재확인 |
| 4 | cross_spec | `spec/conventions/migrations.md` §5 "3단계"(README §4·§5 참고) 문구와 새 콜아웃이 겹쳐 보일 수 있으나, draft Rationale 이 "3단계는 `.conf` 맥락" 이라고 구분해 둠. 이 구분이 spec 본문 자체에는 명시되지 않아 오독 소지는 기존부터 있던 구조(이번 draft 가 새로 만든 모호성 아님) | `spec/conventions/migrations.md` §5 | 등급 부여 대상 아님, 참고용 관찰 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | S1~S4 어느 것도 cross-spec 충돌 없음. S4 가 가리키는 README §5 최신 내용과 문구가 일치, 새 식별자(`idx_trigger_workflow_id`, `V111`) 충돌 없음 |
| rationale_continuity | LOW | S4 의 1라운드 처분 번복은 실질 근거 있음(무근거 번복 아님)이나 그 근거가 spec 이 아닌 plan 에만 남아 추적 진입점 부재 |
| convention_compliance | MEDIUM | S4 는 아직 계획 단계 — `spec/conventions/migrations.md` 와 `README.md §5` 사이 폭 불일치가 지금 이 순간 실재. 자매 문서(`8-notifications.md:277`) 도 좁은 표현으로 남아 정책 서술 불일치 재생산 소지 |
| plan_coherence | NONE | 미해결 결정 충돌·중복 트래커 항목·선행조건 미해소 없음. S4 번복은 같은 PR 내 정상 리뷰 재조정 |
| naming_collision | NONE | 신규 식별자 없음(S4 는 순수 산문 편집). `idx_trigger_workflow_id`·`V111` 재확인 결과도 충돌 없음 |

## 권장 조치사항
1. `spec/conventions/migrations.md` §5 콜아웃에 draft S4 diff 문안을 그대로 적용해 `codebase/backend/migrations/README.md §5`(이미 확장됨)와의 폭 불일치를 해소 (WARNING #1).
2. draft 의 "트래커 반영" 절 또는 S4 커밋 메시지에 `spec/data-flow/8-notifications.md:277` 의 "교체" 한정 표현을 README §5 확장 폭에 맞춰 동행 갱신하는 항목을 명시적으로 등재 (WARNING #2, 실행은 이번 PR 스코프 밖이어도 트래킹은 이번 PR 책임).
3. (선택) migrations.md §5 콜아웃 변경분 끝에 적용 범위 확장 근거를 가리키는 1줄 포인터(README §5, 2026-09-18) 추가 — 향후 `--spec` 리뷰가 RESOLUTION 이력을 다시 파지 않도록.
4. `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 반영(S1~S3), `V111` 마이그레이션(S3)은 이미 완료·정합 확인됨 — 추가 조치 불요.
5. draft 를 `plan/complete/` 로 이동하는 마무리 커밋에서 forward reference 3곳(spec 1 + codebase 2) 전수 재확인.
6. S4 적용 후 plan 체크리스트 1번을 "S1~S4 반영"으로 갱신하고, 해당 파일이 포함되는 scope 로 `--impl-done` 재실행.
