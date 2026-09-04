# Rationale 연속성 검토 — schedule 인덱스 전략 정정 (follow-up)

## 검토 범위 확정

프롬프트의 target 은 `spec/` 전체(386개 파일 생략)로 포괄 지정돼 있었으나, 실측 결과 이번
브랜치(`claude/schedule-next-run-index`, worktree `plan-in-progress-items-b0c80b`)가
`origin/main` 대비 실제로 변경한 spec/plan 파일은 다음 3개뿐이었다 (`git diff origin/main --stat`):

- `spec/1-data-model.md` (§3 인덱스 전략 표, Schedule 행 2건)
- `spec/data-flow/10-triggers.md` (§2.1 Schema 매핑 표, `schedule` 발사 후 행)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (열린 developer 항목 1건 + 종결조건 표 1행)

이 3개 파일과 이들이 참조하는 `plan/in-progress/spec-draft-schedule-index.md` 를 target 으로
검토했다. 또한 같은 세션의 **직전 라운드**(`review/consistency/2026/09/04/22_34_55/`)가 이미
이 동일 diff 를 검토해 WARNING 2건을 냈고, 지금 diff 는 그 WARNING 을 해소하는 수정을
포함하고 있어 — 이번 라운드는 **그 수정이 실제로 correctness 를 회복했는지 재검증**하는
성격이다.

## 사전 확인 (실측)

- `git log --all --oneline -S "next_run_at, is_active" -- spec/1-data-model.md spec/data-flow/10-triggers.md`
  → 가장 오래된 히트가 초기 PRD/spec 일괄 작성 커밋(`05089d5a6`, `ca227cc36`)뿐. 즉 종전
  `(next_run_at, is_active)` 부분 인덱스 설계는 **명시적으로 심의·기각 대안을 남긴 Rationale
  결정이 아니라 초안 단계 서술**이었다 — "기각된 대안의 재도입" 판정 기준이 되는 선행
  Rationale 항목 자체가 존재하지 않는다.
- `spec/1-data-model.md` `## Rationale` 4개 기존 항목(alert_rule / WorkflowVersion.snapshot /
  Execution.execution_path / install_token) 어디에도 Schedule 인덱스 설계를 다룬 결정 없음 —
  확인.
- `spec/data-flow/10-triggers.md` `## Rationale` 4개 항목(Schedule sub-type화 / webhook URL
  표기 / endpoint_path UNIQUE 범위 / 역방향 동기화) 어디에도 이 인덱스 관련 결정 없음 — 확인.
- `grep -rln "idx_schedule_next_run\|schedule.*next_run_at.*is_active\|부분 조건" plan/in-progress/ spec/`
  → 정확히 4개 파일(`spec/1-data-model.md`, `spec/data-flow/10-triggers.md`,
  `plan/in-progress/spec-draft-schedule-index.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md`)만 히트. 모두 최신 결론
  `(workspace_id, next_run_at)` 로 일치 — 구 값을 현재형으로 여전히 주장하는 잔존 위치 없음.
- `plan/complete/refactor/05-database.md` 실재 확인 — target 이 "이 저장소는 인덱스 실측을
  문서에 남기는 관례" 라고 인용한 선례가 실제로 `EXPLAIN`·인덱스 트레이드오프 표를 담고 있어
  **지어낸 선례가 아님**을 확인.
- `codebase/backend/migrations/` 최신 버전은 V109 — target 이 예약한 `V110` 미점유 확인(직전
  라운드와 동일 결론 재확인).

## 직전 라운드 WARNING 재검증

| # | 직전 라운드 발견(22_34_55) | 이번 diff 반영 여부 |
|---|---|---|
| 1 | `spec/1-data-model.md` 만 고치고 미러 `spec/data-flow/10-triggers.md:175` 는 놓침 — 두 spec 이 같은 물리 인덱스에 대해 서로 다른 값을 주장 | **해소**. `spec/data-flow/10-triggers.md:175` 도 `(workspace_id, next_run_at)` 로 갱신됨, "종전 `(next_run_at, is_active)`" 로 과거형 명시 |
| 2 | 소스 plan(`spec-draft-nullable-notation-followups.md` L379-397, 434)이 target 결론을 반영 못한 채 "EXPLAIN 필요, 미해결"로 남음 | **해소**. 항목 본문이 "실측 완료, 답은 (c)"로 갱신되고 (a)/(b) 모두 취소선+기각 사유 명시, 종결조건 표 트랙이 `developer/DBA`→`developer`(V110 적용만 잔여)로 정정됨 |

두 WARNING 모두 **같은 커밋**(`6143b8c9f`) 안에서 대상 파일을 모두 함께 갱신하는 방식으로
해소됐다 — 이는 `spec/1-data-model.md` 자신의 기존 Rationale(`WorkflowVersion.snapshot`
항목)이 경고한 "한 문서만 고치고 미러를 놓치는" drift 패턴을 이번에는 재현하지 않았다는
뜻이다. `spec-draft-schedule-index.md` §5 자체에도 "왜 이걸 놓쳤나"라는 자기 반성 섹션이
있어 같은 클래스의 재발을 명시적으로 경계하고 있다.

## 발견사항

관점 1(기각된 대안 재도입)·2(합의된 원칙 위반)·3(무근거 번복)·4(암묵적 가정 충돌) 전부에서
CRITICAL/WARNING 급 위반을 찾지 못했다. 세부:

- **관점 1 — 기각된 대안 재도입**: 없음. 종전 `(next_run_at, is_active)` 는 명시적으로
  심의·채택된 Rationale 결정이 아니라 초안 서술이었으므로 이를 교체하는 것은 "기각된 대안의
  재도입"에 해당하지 않는다. 오히려 target 자신이 소스 plan 이 등재했던 두 대안 (a) DROP,
  (b) 부분조건 제거 각각을 실측으로 기각하고, 제3의 대안("두 인덱스 병설")도 검토·기각한
  근거를 `## Rationale`에 명시했다.
- **관점 2 — 합의된 원칙 위반**: 없음. `1-data-model.md` §3 표의 기존 관례(부분 인덱스는
  `WHERE` 절 명시, 마이그레이션 버전 접미사 부착, `CONCURRENTLY` 표기)를 그대로 따랐다.
  spec/코드/마이그레이션이 같은 PR 안에서 함께 가야 한다는 이 저장소의 반복 원칙도
  `spec-draft-schedule-index.md §6`에서 명시적으로 인용하며 준수(구현은 developer 트랙으로
  이연하되 spec 서술만 이번에 완결).
- **관점 3 — 결정의 무근거 번복**: 없음. 번복 대상 자체가 formal decision 이 아니었을 뿐 아니라,
  이번 번복은 실측 데이터(EXPLAIN, 두 규모 벤치마크, 인덱스 크기)와 함께 `spec-draft-schedule-index.md`
  `## Rationale`(3개 하위 항목: 왜 삭제로 멈추지 않았는가 / 왜 (d) 아닌 (c) / 기각한 대안 —
  두 인덱스 병설)에 온전히 기록됐다.
- **관점 4 — 암묵적 가정 충돌**: 없음. "Schedule 인덱스는 발사 경로가 아니다 (BullMQ 가
  발사한다)"라는 기존 invariant 서술은 이번 편집에서도 두 파일 모두 그대로 유지됐다 —
  변경은 인덱스 컬럼 구성뿐이고 발사 메커니즘에 대한 기존 서술을 건드리거나 우회하지 않는다.

## 요약

이번 diff(`spec/1-data-model.md`, `spec/data-flow/10-triggers.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md` + 근거 문서
`plan/in-progress/spec-draft-schedule-index.md`)는 직전 라운드(22_34_55)가 지적한 두 WARNING
— 미러 문서 drift·소스 plan 미동기화 — 를 같은 커밋 안에서 모두 해소했다. 종전
`(next_run_at, is_active)` 부분 인덱스는 애초에 명시적 Rationale 심의를 거친 결정이 아니었으므로
이를 `(workspace_id, next_run_at)` 로 교체하는 것은 "기각된 대안의 재도입"이나 "무근거 번복"에
해당하지 않으며, 오히려 실측 기반 결정과 기각한 대안(등재된 (a)/(b) 및 검토하지 않은 "두 인덱스
병설")을 빠짐없이 자체 `## Rationale`에 남긴 모범 사례에 가깝다. 인용된 선례("인덱스 실측을
문서에 남기는 관례", `plan/complete/refactor/05-database.md`)도 실제로 존재해 근거 날조 없음을
확인했다. 기존 spec Rationale 항목(발사 경로는 BullMQ 라는 invariant, WorkflowVersion.snapshot
이 경고한 미러 drift 패턴)과 충돌하는 지점도 없다.

## 위험도

NONE
