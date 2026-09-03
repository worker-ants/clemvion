# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

**참고**: 5개 checker 전원의 보고서 전문을 확보했습니다(`convention_compliance` 는 STATUS 라인이 `no_status` 로 보고됐으나 인라인 전문이 완전하여 정상 반영, 재시도 불요 — 누락돼 있던 `convention_compliance.md` 파일은 인라인 전문 그대로 디스크에 영속화했음). 전문 미확보 checker 없음.

## 전체 위험도
**LOW** — 실질 코드 diff(엔티티 nullable 타입 정합화 배치 2, 11파일/361줄)는 CRITICAL/WARNING 없이 전 checker에서 정합 확인됨. `plan_coherence` 가 LOW 를 부여한 사유는 이 diff 자체의 결함이 아니라, 같은 plan 문서가 이미 "developer 권한 밖·planner 턴 필요"로 정확히 등재해 둔 **선행 미해소 항목**(`spec/5-system/2-api-convention.md §2.2` 의 `/api/auth/*` 네임스페이스 예외 미반영)이 target scope 안에 여전히 남아 있다는 추적 목적의 표시임.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> Critical 이 없으므로 해당 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| — | (없음) | — | — | — |

## 경고 (WARNING)

(없음 — 5개 checker 전원 WARNING 0건 보고)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | — | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `Schedule.next_run_at` 이 `spec/1-data-model.md:260` 에서 nullable(`?`) 표기 누락 (같은 표 바로 아래 `last_run_at` 은 정확히 `Timestamp?`). 이 diff 는 원인이 아니고 해당 필드도 변경 범위 밖 | `spec/1-data-model.md:260` | 별도 조치 불요 — `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 이미 planner-turn 후속으로 등재됨. 이 PR 병합을 막을 사유 아님 |
| 2 | rationale_continuity | 유사 "엔티티 nullable 배치" 작업이 이어질 경우(코드 주석이 "배치 2"로 명명 — 후속 배치 가능성), `spec/1-data-model.md` `## Rationale` 에 "엔티티 TS 타입은 `nullable: true` 컬럼과 동기화한다" 관례를 한 줄 명문화하면 다음 배치 리뷰 반복을 줄일 수 있음 | `spec/1-data-model.md` `## Rationale` | 강제 아님. 후속 배치 착수 시 고려 |
| 3 | convention_compliance | `spec/conventions/error-codes.md` §5 "Rename 이력" 표의 `PR` 컬럼 표기가 신규 `INVALID_PASSWORD` 행(L175)만 마크다운 링크 형태이고 나머지 행은 plain 식별자(`PR4b`·`#1193` 등)라 표현 방식이 갈림 | `spec/conventions/error-codes.md:175` | PR 번호로 통일하거나, §5 서두에 이 열을 "PR 또는 근거 문서"로 명문화하는 한 줄 추가 (규약 갱신 쪽 권장 — 이 행은 PR 번호 없는 plan-driven 결정이라 링크가 정보량이 더 큼) |
| 4 | plan_coherence | `spec/5-system/2-api-convention.md §2.2` 명명 규칙에 `/api/auth/{verb}` 계열 15개 이상이 현재 등재된 두 예외(RPC-style `{id}` 필수 / `/api/external/*`) 어디에도 포섭되지 않음. 이전 `--impl-done` 라운드(W2)에서 이미 발견돼 developer 권한 밖으로 표시됨 | `spec/5-system/2-api-convention.md §2.2` | 별도 planner 턴에서 `/api/auth/*` 액션 네임스페이스 예외 행 추가. `plan/in-progress/entity-nullable-column-type-mismatch.md` §할 일 에 이미 "이 작업과 무관"으로 정확히 기록돼 있어 이번 세션 액션 불요 — 추적만 유지 |
| 5 | plan_coherence | `spec/5-system/1-auth.md` L1419 부근 자기-반증형 소정정이 참조하는 `plan/complete/auth-change-password-oauth-only-code-split.md` 링크 정합성 확인 — broken link 아님 (실제로 `plan/complete/` 이동 완료, `origin/main` 반영됨) | `spec/5-system/1-auth.md:1419` | 조치 불요. 확인 기록으로만 남김 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 엔티티 9개 nullable 타입 정합화가 `spec/1-data-model.md` 기존 nullable(`?`) 서술과 완전히 일치. 유일 관련 항목(`Schedule.next_run_at` 문서 오기)은 이 diff 무관, 이미 추적 중 |
| rationale_continuity | NONE | `## Rationale` 기각 대안·합의 원칙과 충돌 없음. `redact-stored-error.ts` 주석 자기정정이 취소선 보존+실측 패턴을 모범적으로 따름 |
| convention_compliance | NONE | 명명·출력 포맷(§5.4 nullable DTO)·문서 구조·Swagger·금지 항목 전부 준수. `error-codes.md` §5 PR 열 표기만 사소한 형식 비일관 |
| plan_coherence | LOW | diff 자체는 spec 과 정합. plan 이 정확히 기록해 둔 선행 미해소 항목(§2.2 `/api/auth/*` 예외)이 target scope 안에 여전히 남아 있어 추적 표시 |
| naming_collision | NONE | 신규 식별자(요구사항 ID·엔티티/타입명·endpoint·이벤트명·환경변수·파일 경로) 도입 없음 — 전부 기존 필드 타입 정밀화 |

## 권장 조치사항

1. (이번 PR 병합에 영향 없음) 별도 planner 턴에서 `spec/5-system/2-api-convention.md §2.2` 에 `/api/auth/*` 액션 네임스페이스 예외 행을 추가하고, 같은 턴에 `spec/1-data-model.md:260` `Schedule.next_run_at` nullable(`?`) 표기 누락도 함께 정정 — 두 항목 모두 이미 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 developer 권한 밖 후속으로 등재돼 있어 신규 결정 아님.
2. (선택) `spec/conventions/error-codes.md` §5 표 `PR` 열의 표기 관례를 명문화(PR 번호 또는 근거 문서 링크 허용을 명시).
3. (선택, 향후 배치 착수 시) `spec/1-data-model.md` `## Rationale` 에 "엔티티 TS 타입은 `nullable: true` 컬럼과 동기화" 관례 한 줄 추가.