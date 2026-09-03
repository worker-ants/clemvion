# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — `spec/5-system/` 자체는 무변경(델타 0)이고 diff 는 `User`/`Schedule` 엔티티의 `null as unknown as X` 이중 캐스트 8건 제거 + nullable 컬럼 타입 정합화 + 회귀 방지 가드 신설. 유일한 실질 발견은 `Schedule.next_run_at` 이 스택 전체(DB·backend·frontend)에서 이미 nullable 로 다뤄지고 있었는데 `spec/1-data-model.md` §2.9 표기만 non-null 로 남아있던 선재 간극이며, 이번 diff 는 그 간극을 새로 만든 게 아니라 테스트로 영구 고정했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity(INFO로 병기) | `Schedule.next_run_at` 이 코드·테스트에서 nullable 로 공식 고정됐는데 데이터모델 문서는 여전히 non-null 표기 | `codebase/backend/src/modules/schedules/entities/schedule.entity.ts`(`nextRunAt: Date \| null`), `schedule-runner.service.ts` catch 분기, `schedules.service.ts`, 신규 테스트 2건(`schedule-runner.service.spec.ts`, `schedules.service.spec.ts`) | `spec/1-data-model.md` §2.9 Schedule 표 `next_run_at \| Timestamp`(물음표 없음 = 이 문서 관례상 non-nullable; 바로 아래 `last_run_at \| Timestamp?` 와 대조됨). 부수: `spec/data-flow/10-triggers.md` §3.2 도 cron 파싱 실패 시 NULL 케이스 미언급 | `spec/1-data-model.md` §2.9 의 `next_run_at` 행을 `Timestamp?` 로 정정. 가능하면 `spec/data-flow/10-triggers.md` §3.2 에 "cron 파싱 실패 시 `next_run_at` 은 NULL 로 대입되며 발사에는 영향 없음(정보성 컬럼)" 한 줄 보강. DB 제약(`nullable: true`)은 이 PR 이전부터 존재했고 동작 변경은 없어 코드 자체를 막을 사유는 아님 — 문서 동기화만 필요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | TypeORM `nullable: true` + union 타입 조합 시 `design:type` 함정(타입만 넓히면 `DataTypeNotSupportedError` 로 e2e 부팅 실패) 이 정식 convention 문서에 없고 가드 코드 주석·plan 문서에만 존재 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`/`.spec.ts`; `spec/conventions/`(해당 규칙 부재) | 선택 사항 — 잔여 배치(38건) 완료 후 안정화되면 `spec/conventions/`에 TypeORM 엔티티 컬럼 타입 관례로 승격 권고. 이번 PR 을 막을 사유 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `Schedule.next_run_at` nullable 확정과 `spec/1-data-model.md` §2.9 non-null 표기 간 선재 간극(WARNING) + TypeORM 컬럼 타입 관례 convention 미등재(INFO). `User` 7필드는 오히려 spec 과의 기존 불일치를 해소하는 방향 |
| rationale_continuity | NONE | CRITICAL/WARNING 없음. 이 저장소 선례(`Execution.error`, `llm-usage-log.*`)를 따르는 점진적 조치, 기각된 대안 재도입·원칙 위반·무근거 번복 없음. `next_run_at` 문서-DB 간극은 INFO 로 병기(이 PR 이 만든 번복 아님) |
| convention_compliance | NONE | 명명·출력포맷·문서구조·API문서 규약 위반 없음. 유일하게 API 노출되는 `Schedule.nextRunAt` 응답 DTO 는 diff 이전부터 이미 `swagger.md` nullable 패턴 준수. 민감 필드(`passwordHash` 등) DTO 미노출 확인 |
| plan_coherence | NONE | diff 가 자신을 추적하는 `plan/in-progress/entity-nullable-column-type-mismatch.md` "배치 1" 서술과 1:1 일치. 다른 in-progress plan 과 충돌·stale 유발 없음. plan 이 남긴 두 미결 항목(walker 추출, 배치 2 기준)은 diff 범위 밖으로 명시 유보 |
| naming_collision | NONE | spec 델타 0 이라 신규 spec 식별자 없음. 신규 코드 식별자(가드 함수/상수, 파일 경로 2개)는 형제 가드 파일과 이름 충돌 없이 기존 관례(`<주제>-guard.ts`+`.spec.ts`) 준수 |

## 권장 조치사항
1. `spec/1-data-model.md` §2.9 Schedule 표의 `next_run_at` 행을 `Timestamp` → `Timestamp?` 로 정정 (WARNING #1 해소). 이 PR 을 막을 필요는 없으나 문서-코드 간극이 이번 diff 로 테스트에 영구 고정됐으므로 가까운 시일 내 별도 커밋으로 동기화 권장.
2. (선택) `spec/data-flow/10-triggers.md` §3.2 에 cron 파싱 실패 시 `next_run_at` NULL 대입 케이스 한 줄 보강.
3. (선택, 비긴급) 잔여 배치(38건) 완료 후 TypeORM nullable 컬럼 타입 관례를 `spec/conventions/`에 정식 등재.
