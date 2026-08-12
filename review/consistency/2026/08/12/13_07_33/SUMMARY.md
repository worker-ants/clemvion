# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, CRITICAL 0건)

## 전체 위험도
**LOW** — 순수 lint-warning(타입 전용) 처분 PR. spec/data-flow/ 자체는 diff 대상이 아니며, 발견된 항목은 모두 이번 PR 이전부터 있던 spec-내부 서술 불일치·plan frontmatter 정확도 문제로 차단 대상이 아님.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity (통합) | `spec/data-flow/15-external-interaction.md` 의 idempotency 캐시 제외 조건 서술("4xx 전체 캐시 제외")이 SoT 인 `spec/5-system/14-external-interaction-api.md` §R8("400 VALIDATION_ERROR 만 제외, 그 외 2xx/409/410 은 캐시")과 불일치. 이번 diff 가 이 gap 을 코드·테스트(`idempotency.interceptor.ts`/`.spec.ts`)에 캐너리로 명시적으로 고정하면서도 data-flow 문서 서술은 갱신하지 않음 | `spec/data-flow/15-external-interaction.md` §1.2 시퀀스 다이어그램, §2.1/§2.2 Schema 매핑 표 | `spec/5-system/14-external-interaction-api.md` `## Rationale` → R8 | §1.2·§2.1/§2.2 의 "4xx 캐시 제외" 문구를 "`400 VALIDATION_ERROR` 만 캐시 제외 (2xx/409/410 은 캐시 — 단, 현재 구현은 `statusCode>=400` 전체를 제외하는 선재 결함 있음, `plan/in-progress/backend-lint-gate-broken-on-main.md` 참조)" 로 정정. 또는 `spec/5-system/14-external-interaction-api.md` R8 항목 말미에 구현 갭 한 줄 추가. planner 턴에서 처리 가능한 문서 정합 항목(이번 lint-only PR 스코프 밖) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | plan_coherence | plan frontmatter `worktree:` 가 실제 작업 worktree(`lint-warning-triage`)와 불일치 — `backend-lint-gate-b72fdd` 그대로 남아 있어 이번 브랜치의 산출물(§잔여/§후속 처분 완료 기록)이 plan↔worktree 귀속 기록에 반영 안 됨. 차단성 아님 | `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter | `worktree:` 값을 `lint-warning-triage` 로 갱신(+ 필요시 한 줄 메모). `deps-peer-gating-and-eslint10.md` 가 동일 상황을 처리한 선례 있음 |
| 2 | rationale_continuity | 위 WARNING #1 의 R8 gap 이 코드 docstring·plan 에는 문서화됐지만 spec `## Rationale` 쪽 callout(§1.5 구현 갭과 같은 형식)에는 아직 미러링되지 않음 — WARNING #1 과 동일 근본 원인, 별도 조치 불요(WARNING #1 정정 시 함께 해소) | `spec/data-flow/15-external-interaction.md` `## Rationale` | WARNING #1 제안과 병합 처리 |
| 3 | convention_compliance | 규약 번들 조립 시 컨텍스트 예산 초과로 `spec/data-flow/` 10개 파일·`spec/conventions/` 상당수가 본문 생략됨(diff 와 직접 연관된 부분은 절대경로 재확인 완료) | N/A (검토 절차 메모) | 이번 PR 은 타입 전용이라 실질 리스크 낮음. `spec/data-flow/` 본문이 실제로 바뀌는 향후 PR 재검토 시 예산 상향 또는 청크 분할 재실행 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | data-flow/15 §R8 서술이 system/14 §R8 원문보다 넓게("4xx 전체") 요약 — 선재 불일치, 이번 diff 는 코드 레벨에서 이를 캐너리로 고정만 함 |
| rationale_continuity | LOW | 동일 R8 gap — Rationale 미러링(§1.5 구현 갭 선례) 미적용, 동작 변경 없어 INFO |
| convention_compliance | NONE | 명명·출력 포맷·문서 구조·API 문서 규약 위반 없음. 컨텍스트 예산 초과로 일부 미검토(INFO) |
| plan_coherence | LOW | 지배 plan(`backend-lint-gate-broken-on-main.md`)과 diff 완전 정합. frontmatter `worktree:` 미갱신만 발견 |
| naming_collision | NONE | spec/data-flow/ 는 diff 대상 아님. 신규 코드 식별자(`HttpResponseLike` 등) 전부 파일-로컬 또는 기존 타입 재사용, 충돌 없음 |

## 권장 조치사항
1. (WARNING 해소, planner 턴 권장) `spec/data-flow/15-external-interaction.md` §1.2·§2.1/§2.2 의 idempotency 캐시 제외 조건 서술을 `spec/5-system/14-external-interaction-api.md` §R8 원문과 정합하도록 정정(2xx/409/410 캐시, 400 VALIDATION_ERROR 만 제외 + 현재 구현 갭 명시). 이번 lint-only PR 스코프 밖이므로 즉시 조치는 아님.
2. `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter `worktree:` 를 `lint-warning-triage` 로 갱신.
3. (선택) 향후 `spec/data-flow/` 본문이 실제로 바뀌는 PR 재검토 시 convention_compliance 컨텍스트 예산 상향 검토.
