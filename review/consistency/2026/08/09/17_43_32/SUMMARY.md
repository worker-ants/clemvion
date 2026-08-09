# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 없음 (Critical 0건)

## 전체 위험도
**LOW** — spec/conventions/ 는 이번 diff 에서 전혀 변경되지 않음(순수 backend CI/typecheck 인프라 작업). 유일한 실질 이슈는 plan 간 skip-job 전환 트리거 넘버링 불일치(WARNING) 하나.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `backend-checks.yml` 신설로 skip-job 패턴 "3번째 전환" 트리거가 실측상 충족됐는데(`CONVERTED` 리스트 실측 3건), 이번 diff 가 새로 쓴 후속 메모는 스스로 "세 번째"임을 인지하면서도 근거 없이 "4번째"로 트리거를 미루고, 그 결정을 원 소유 plan 에는 반영하지 않음 | `plan/in-progress/backend-lint-gate-broken-on-main.md` §"후속 (타입체크 갭 PR 밖)" | `plan/in-progress/ci-required-check-skip-jobs.md` §"후속 — 나머지 8개 워크플로" (3번째 전환 시 `changes` 잡 reusable workflow 추출을 이미 확정, reviewer 권고 인용까지 근거로 남긴 상태) | (a) 이번 또는 즉시 후속 PR 에서 `changes` 잡 + 5단계 셋업을 composite/reusable workflow 로 추출해 W7 원안 이행, 또는 (b) 트리거를 4번째로 미루기로 확정한다면 `ci-required-check-skip-jobs.md` 의 "3번째 전환 시점" 문구를 "4번째"로 정정 + 근거 명기 + 두 plan 상호 링크로 동기화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance / plan_coherence / cross_spec / naming_collision (공통 관찰) | harness prompt 조립 갭 — 실제 diff 가 컨텍스트 예산 초과로 프롬프트에서 생략되고 target 이 `spec/conventions/` 전체로 오치환됨. 5개 checker 모두 target 워킹트리에서 `git diff origin/main...HEAD` 를 직접 재실행해 이 갭을 메움(spec/ 변경 0건 확인) | prompt_file 상단 "Target 문서" ~ 파일 말미 "컨텍스트 예산 초과로 생략된 파일" 목록의 `<git diff origin/main...HEAD -- code_areas>` 플레이스홀더 | 조치 불요 — `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 가 이미 이 orchestrator scope 산정 결함을 추적 중. 같은 날 16:45 세션에서도 동일 패턴 재확인됨 |
| 2 | plan_coherence | `spec/conventions/cafe24-api-catalog/_overview.md` §Rationale 의 `mains_update`/`mains_delete` 제거 근거(공식 docs 부재)가 field-level 카탈로그와 모순되는 기존 CRITICAL — 이번 diff 와 무관, 여전히 미해소 상태만 재확인 | `spec/conventions/cafe24-api-catalog/_overview.md` §Rationale | `plan/in-progress/cafe24-backlog-residual.md` 에 CRITICAL 로 이미 등재, 처리 체크박스 전부 미체크 — 이번 PR 범위 밖이므로 조치 불요 |
| 3 | plan_coherence / naming_collision (공통) | `secret-resolver.service.ts` `deleteByPrefix()` 의 신규 LIKE 메타문자(`%`/`_`/`\`) 거부 invariant 가 `spec/conventions/secret-store.md §2.1` 호출 규약 표에 아직 미문서화 — 그러나 이미 planner 권한으로 후속 이관 명시(내부 전용 계약, spec 충돌 없음으로 스스로 판정) | `spec/conventions/secret-store.md §2.1` | 조치 불요 — `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속에 이미 등재·담당 지정됨 |
| 4 | naming_collision | 신규 CI/스크립트 파일 경로(`.github/workflows/backend-checks.yml`, `scripts/check-backend-typecheck-ratchet.py`, `scripts/backend-typecheck-baseline.json`, `.claude/tests/test_backend_typecheck_ratchet.py`) 및 job id(`changes`/`lint`/`unit`/`typecheck-ratchet`) 전수 대조 결과 기존 명명 컨벤션(`<영역>-checks.yml`/`check-<대상>.py`/`test_<대상>.py`) 준수, 충돌 없음 | 신규 4개 파일 + `backend-checks.yml` job 정의 | 조치 불요 (확인 완료) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/**` 변경 0건 — cross-spec 충돌 대상 자체가 없음. 유일한 프로덕션 변경(`deleteByPrefix` 가드)도 `secret-store.md` 기존 호출부와 충돌 없음 |
| rationale_continuity | NONE | 기각된 대안 재도입/원칙 위반/무근거 번복/invariant 우회 4관점 모두 미관측. `deleteByPrefix` 가드는 결정 번복이 아닌 미명시 여백의 방어적 보강이며, ratchet CI 는 `hardcoded-korean-ratchet` 선례와 일관 |
| convention_compliance | NONE | 명명/출력 포맷/문서 구조/API 문서/금지 항목 5관점 모두 N/A 또는 준수. prompt diff 누락 갭을 INFO 로 기록 |
| plan_coherence | LOW | skip-job 패턴 3번째 전환 트리거 넘버링 불일치 WARNING 1건. cafe24 mains 모순(기존, 무관)·secret-store 후속(정상 추적)은 INFO |
| naming_collision | NONE | `spec/` diff 0건이라 신규 spec 식별자 없음. 신규 CI 파일 경로·job id 는 기존 컨벤션 준수, 충돌 없음 |

## 권장 조치사항
1. skip-job 패턴 트리거 넘버링을 `plan/in-progress/backend-lint-gate-broken-on-main.md` 와 `plan/in-progress/ci-required-check-skip-jobs.md` 사이에서 동기화 — `changes` 잡 reusable workflow 추출을 이번/즉시 후속 PR 에서 이행하거나, 트리거를 4번째로 명시 정정하고 두 문서를 상호 링크 (WARNING 해소).
2. (참고, 조치 불요) cafe24 `mains_update`/`mains_delete` 모순은 `cafe24-backlog-residual.md` 에서 기존 추적대로 진행.
3. (참고, 조치 불요) `deleteByPrefix` invariant 의 `secret-store.md §2.1` 문서화는 이미 이관된 planner 후속 항목대로 진행.