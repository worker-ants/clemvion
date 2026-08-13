# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음. 유일한 실질 발견은 plan_coherence 의 WARNING 1건(MEDIUM).

## 전체 위험도
**MEDIUM** — 이번 diff(`update-returning-rows` 헬퍼 도입 + 7개 소비 지점 교체, `spec/` 문서 변경 0건) 자체는 견고한 버그 수정이나, 같은 결함(2026-06-14 도입 `persisted` 계산 버그)이 `ie-resume-turn-boundary-cancel.md` 가 7~8라운드에 걸쳐 "레이스를 닫았다"고 CRITICAL 종결 처리한 바로 그 코드 경로였다는 사실이 두 plan 사이에 교차 참조 없이 방치되어 있다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 검토에서 CRITICAL 발견이 없어 인계 대상 자체가 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `updateExecutionStatus` else 분기(`persisted` 계산) 수정이, `ie-resume-turn-boundary-cancel.md`(2026-07-26~28, 아직 `plan/in-progress/`)가 6~8차 라운드에 걸쳐 "동시 cancel 레이스를 닫았다"고 CRITICAL 종결한 바로 그 코드의 전제(`persisted`=매치 행 수 반영)를 소급 무효화하는데, 이 diff/plan 어디에도 그 사실이 언급되지 않는다. `git log -S` 실측: 버그는 2026-06-14 도입돼 해당 plan 의 전체 작업 기간(2026-07-26~28) 내내 살아 있었다 — 6차 라운드 CRITICAL #1(`finalizeFailedExecution` guarded UPDATE 경유 전환), 7차 WARNING #1(`failFirstSegmentSetup`/timeout catch 전환), 8차 "6/6 RED" 종결 근거 모두 거짓 전제 위에 있었다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `updateExecutionStatus` else 분기 (`updateReturningRows<{id:string}>(updated).length > 0`, 구: `updated.length > 0`, 도입 커밋 `1657c0435` 2026-06-14) | `plan/in-progress/ie-resume-turn-boundary-cancel.md` (6~8차 라운드 CRITICAL/WARNING 종결 근거), 부모 `plan/in-progress/node-cancellation-residual-signal-propagation.md` | (1) `update-returning-tuple-shape.md` 의 "이미 두 번 겪은 목록"(agent-memory-admin·stuck-document-recovery)에 이 else 분기를 세 번째 사례로 추가. (2) `ie-resume-turn-boundary-cancel.md`에 소급 주석 추가: "6~8차 라운드가 닫았다고 기록한 guarded-UPDATE 기반 레이스 차단은 `updateReturningRows` 수정(커밋 `8332d9a20`, 2026-08-13) 이전에는 `persisted` 계산 버그로 실효되지 않았다." (3) `spec/5-system/4-execution-engine.md` §1.1 인근에 이미 있는 2026-07-30 유사 사례(retry-reentry opt-in 미전파)와 대칭되는 한 줄 Rationale 각주 추가 — `developer` 권한 밖이므로 planner 위임 필요. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 동일 결함 클래스(agent-memory-admin NotFound 미변환·stuck-document-recovery 가짜 job 2개)가 이미 Rationale 에 두 번 기록된 선례가 있음. 이번 건은 §8 admission gate·§7.5 케이스 분리·KB CAS 락 3문서·빈 KB idle 복귀까지 영향 범위가 넓음 | `spec/5-system/4-execution-engine.md`, `spec/5-system/8-embedding-pipeline.md` | 다음 spec 갱신 사이클에 Rationale 한 줄 추가 검토(선택, 이번 PR 필수 아님) |
| 2 | rationale_continuity | 동일 결함(TypeORM UPDATE/DELETE 튜플 shape)이 세 번째 개별 발생(agent-memory-admin·stuck-document-recovery·이번 7곳)인데도 invariant 가 `spec/conventions/`에 정본 문서로 없음. plan 은 `plan/complete/` 이동 시 이 reviewer 상시 범위(spec/)에서 이탈 | `spec/conventions/` (신규 문서 없음) | 동일 결함 4번째 재발 방지를 위해 conventions 문서(또는 관련 spec 데이터 접근 절)에 정식 등재 권고 |
| 3 | convention_compliance | 위와 동일 결함 클래스 규약화 여지. `spec/conventions/`에 raw TypeORM UPDATE/DELETE 결과 소비 패턴을 규율하는 문서 부재 | `codebase/backend/src/common/utils/update-returning-rows.ts` 상단 JSDoc | "raw query 로 UPDATE/DELETE RETURNING 을 소비하는 모든 신규 지점은 `updateReturningRows` 헬퍼를 거친다"는 규칙을 `project-planner`에게 정식 규약 승격 후속 검토로 제안 |
| 4 | plan_coherence | `update-returning-tuple-shape.md` frontmatter `spec_impact: none` 은 "spec 텍스트 변경 불요" 로는 타당하나, WARNING #1 이 제안하는 소급 Rationale 각주까지 포함하면 `spec_impact: - spec/5-system/4-execution-engine.md` 로 좁게 승격하는 편이 §1.1 인근 2026-07-30 유사 사례와 일관적. `developer` 는 `spec/` 쓰기 권한 없어 이번 plan 만으로는 반영 불가 | `plan/in-progress/update-returning-tuple-shape.md` frontmatter | 후속 절에 planner 위임 항목으로 명시 권고 |
| 5 | plan_coherence | admission 분기 수정으로 `EXECUTION_ADMISSION_RETRY_DELAY_MS`(2s) 지연·stalled 재배달 오인 rehydration 경로가 사라짐. `plan/in-progress/exec-intake-followups.md`(2026-07-04, 이미 `[x]` 완료)의 타이밍/디스패치 관측이 달라질 수 있으나 재현 실패 위험 낮음(신규 테스트가 비-튜플 mock 과 하위호환 실측 확인) | `plan/in-progress/exec-intake-followups.md` | 별도 조치 불요, 참고용 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 문서 변경 0건. 오히려 §8 admission gate·KB CAS 락 4문서·빈 KB idle 복귀 등 기존 spec 문언과 코드가 어긋나 있던 지점을 코드 쪽에서 바로잡음 |
| rationale_continuity | NONE | §8 advisory lock+조건부 UPDATE, KB CAS 패턴 보존. 과거 기각 대안(조건부 UPDATE 단독) 재도입 없음. `spec_impact: none` 타당 |
| convention_compliance | NONE | `spec/conventions/**` 5개 관점(명명·출력 포맷·문서 구조·API 문서·금지 항목) 전원 위반 없음. 신규 파일명 기존 선례와 일치 |
| plan_coherence | MEDIUM | `ie-resume-turn-boundary-cancel.md` 6~8차 라운드 CRITICAL 종결 근거가 이번 fix 대상 버그로 인해 소급 무효화되는데 교차 참조 누락 (WARNING) |
| naming_collision | NONE | 신규 식별자 `updateReturningRows` 함수 + 파일 경로 2개뿐, repo 전역 유일, 컨벤션·자매 헬퍼와 충돌 없음 |

## 권장 조치사항
1. `plan/in-progress/ie-resume-turn-boundary-cancel.md` 에 소급 주석 추가 — 6~8차 라운드 CRITICAL/WARNING 종결이 `persisted` 계산 버그(커밋 `1657c0435`, 2026-06-14~`8332d9a20`, 2026-08-13) 로 인해 그 작업 기간 내내 실효되지 않았음을 명시. `plan/complete/` 이동 전 필수.
2. `plan/in-progress/update-returning-tuple-shape.md` 의 "이미 두 번 겪은" 목록에 이 else 분기 사례(세 번째)를 추가.
3. `spec/5-system/4-execution-engine.md` §1.1 인근 Rationale 에 2026-07-30 유사 사례와 대칭되는 소급 각주 추가 검토 — `spec/` 쓰기 권한은 planner 소관이므로 후속 planner 턴으로 위임.
4. (선택, 비차단) `spec/conventions/`에 "raw UPDATE/DELETE RETURNING 소비 지점은 `updateReturningRows` 헬퍼 경유" 규칙 정식 등재 검토.
