### 발견사항

- **[WARNING]** `backend-checks.yml` 신설로 skip-job 패턴 "3번째 전환" 트리거가 충족됐는데, 새 후속 메모가 이를 "4번째"로 밀어내며 트리거 소유 plan 을 갱신하지 않음
  - target 위치: 이번 diff 가 편집한 `plan/in-progress/backend-lint-gate-broken-on-main.md` §"후속 (타입체크 갭 PR 밖)" — "4번째 워크플로가 skip-job 패턴을 따를 때 `changes` 잡 + 5단계 셋업 보일러플레이트를 composite action / reusable workflow 로 추출 (ai-review INFO 4) — `ci-required-check-skip-jobs.md` 의 W7 과 같은 항목. `backend-checks.yml` 이 세 번째다." (해당 절 자체가 이 diff 로 신설됨)
  - 관련 plan: `plan/in-progress/ci-required-check-skip-jobs.md` §"후속 — 나머지 8개 워크플로" — "**3번째 전환 시점에 `changes` 잡을 reusable workflow(`workflow_call`)로 추출**(ai-review W7·W8). … reviewer 자신이 '3번째 시점에 검토' 를 권고했고, 2개 시점에 추상화하면 아직 안 드러난 변형을 추측으로 설계하게 된다." — 이 plan 은 이번 diff 에서 **전혀 수정되지 않았다** (`git diff origin/main...HEAD -- plan/in-progress/ci-required-check-skip-jobs.md` 결과 없음).
  - 상세: `.claude/tests/test_required_check_skip_jobs.py` 의 `CONVERTED` 리스트를 실측하면 이번 diff 가 `backend-checks.yml` 을 추가해 `["backend-checks.yml", "deps-security-checks.yml", "frontend-checks.yml"]` — 정확히 3개가 됐다. `git log --oneline -- .claude/tests/test_required_check_skip_jobs.py` 로 확인하면 `deps-security-checks.yml`/`frontend-checks.yml` 두 건은 선행 PR(`#1106`, 커밋 `6e5a54816`)에서 함께 전환됐고, `ci-required-check-skip-jobs.md` 의 Rationale "왜 2개만 전환하나" 도 그 시점 기준 서술이다. 즉 `backend-checks.yml` 은 그 plan 이 명시한 **"3번째 전환"** 바로 그것이며, plan 은 이 시점에 `changes` 잡 추출을 하라고 이미 결정해 두었다(reviewer 권고까지 인용해 근거를 남긴 확정 항목이지 "결정 대기" 상태가 아니다). 그런데 이번 diff 는 그 추출을 하지 않았고, 새로 쓴 후속 메모는 스스로 "backend-checks.yml 이 세 번째" 임을 인지하면서도 트리거를 "4번째"로 한 칸 미뤘다 — 왜 3번째가 아니라 4번째로 미루는지 근거가 없고, 트리거를 바꾸는 결정이면 원 소유 plan(`ci-required-check-skip-jobs.md`)의 W7 항목도 함께 갱신돼야 하는데 그러지 않아 두 plan 이 서로 다른 트리거 숫자를 주장하는 상태로 남았다.
  - 제안: 둘 중 하나. (a) 이번 PR 또는 즉시 후속 PR 에서 `changes` 잡 + 5단계 셋업을 reusable workflow 로 추출해 `ci-required-check-skip-jobs.md` W7 을 원안대로 이행. (b) 트리거를 4번째로 미루기로 한다면 `ci-required-check-skip-jobs.md` §후속의 "3번째 전환 시점" 문구를 "4번째"로 정정하고 왜 한 시점을 더 미뤘는지 근거를 그 자리에 남긴 뒤, `backend-lint-gate-broken-on-main.md` 의 새 후속 항목에서 상호 링크. 두 plan 문서가 같은 숫자를 가리키도록 동기화할 것.

- **[INFO]** 이번 checker 세션의 target scope(`spec/conventions/`)와 실제 diff 가 무관 — 앞선 16:45 세션과 동일한 harness 갭 재발
  - target 위치: 프롬프트 헤더 "검토 모드: --impl-done, scope=spec/conventions/" / "Target 문서 경로: spec/conventions/" 및 파일 목록 말미의 `<git diff origin/main...HEAD -- code_areas>` — 실제로는 컨텍스트 예산 초과로 diff 자체가 프롬프트에 실리지 못하고 생략 목록의 마지막 항목으로만 등장한다.
  - 관련 plan: `plan/in-progress/harness-consistency-summary-downgrade-rule.md` — "orchestrator 의 scope 산정이 '그 경로에 실제 diff 가 있는지' 확인하지 않는 문제"가 이미 `[ ]` 로 추적 중이며, 같은 날 16:45 세션(`review/consistency/2026/08/09/16_45_26/plan_coherence.md` INFO 3)이 동일 패턴을 이미 지적했다.
  - 상세: 직접 실측(`git diff origin/main...HEAD --stat`)한 실제 변경분은 `.github/workflows/{backend,harness}-checks.yml`·`.claude/tests/*`·`scripts/backend-typecheck-baseline.json`·`scripts/check-backend-typecheck-ratchet.py`·`PROJECT.md`·backend `*.spec.ts` 5건·`secret-resolver.service.ts`·`plan/in-progress/backend-lint-gate-broken-on-main.md` 다 — `spec/conventions/**` 파일은 단 1건도 없다. 프롬프트에 산입된 diff 플레이스홀더가 예산 초과로 잘려 checker 가 "diff 없음"을 스스로 확인할 수 없는 형태로 전달됐다.
  - 제안: 조치 불요(이미 별도 plan 이 추적). 다만 이 세션의 결과를 SUMMARY 에서 "spec/conventions/ 정합성 확인 완료"로 해석하지 말 것 — 실제로는 target 영역에 대응하는 diff 가 없어 본 checker 는 target 스냅샷 자체의 기존 결함(아래)만 재확인했다.

- **[INFO]** target(`spec/conventions/cafe24-api-catalog/_overview.md`) 의 mains 제거 근거 모순은 이번 diff 와 무관하게 여전히 미해소 (재확인, 신규 아님)
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §Rationale "미문서화 seed 9개 outright 제거 (G-3l, 2026-06-27)" — `mains_update`/`mains_delete` 를 공식 docs 부재로 선언.
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` §"`mains_update`/`mains_delete` 제거 근거가 field-level 카탈로그와 모순" — CRITICAL 로 등재, "처리 (착수 시)" 체크박스 전부 미체크.
  - 상세: 이번 diff 는 cafe24 카탈로그를 전혀 건드리지 않아 이 모순은 진행에 영향이 없다. 16:45 세션이 이미 WARNING 으로 상세 보고했으므로 여기서는 "오늘까지도 미해소"라는 사실만 재확인한다 — 신규 발견이 아니다.

- **[INFO]** `deleteByPrefix` LIKE 메타문자 가드의 spec 반영 후속은 정상적으로 추적됨 (문제 없음, 확인 목적)
  - target 위치: `spec/conventions/secret-store.md` §2.1 — 이번 diff 로 코드에 추가된 "prefix 에 `%`/`_`/`\` 거부" invariant 가 아직 문서화돼 있지 않다.
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` §"후속 (타입체크 갭 PR 밖)" — "`spec/conventions/secret-store.md §2.1` 호출 규약 표에 `deleteByPrefix` 의 새 invariant 각주 (ai-review INFO 11) — **planner 권한**. 내부 전용 계약이라 spec 충돌은 없다."
  - 상세: target 미반영은 사실이지만 plan 이 이미 명시적으로 등재하고 담당(planner)까지 지정해 뒀다 — "후속 항목 누락"에 해당하지 않는다.
  - 제안: 조치 불요.

### 요약

target scope 로 지정된 `spec/conventions/`는 이번 diff(백엔드 typecheck ratchet + `backend-checks.yml` 신설)에서 실질적으로 변경되지 않았고, 프롬프트의 diff 첨부 자체가 컨텍스트 예산 초과로 생략돼 있어(기존에 추적 중인 harness 갭 재발) target 대 diff 직접 비교의 신뢰도는 낮다. 대신 diff 가 `plan/in-progress/backend-lint-gate-broken-on-main.md`를 직접 수정하며 남긴 새 후속 항목이 `plan/in-progress/ci-required-check-skip-jobs.md`가 이미 확정해 둔 "skip-job 패턴 3번째 전환 시점에 `changes` 잡을 reusable workflow 로 추출" 결정과 충돌한다 — `backend-checks.yml`이 그 3번째 전환 자체인데(실측: `CONVERTED` 리스트 3건), 새 메모는 이를 스스로 인지하면서도 "4번째"로 미루고 원 plan 은 갱신하지 않았다. 그 외 cafe24 mains 모순(기존 WARNING, 무관)과 `secret-store.md` 후속(정상 추적)은 참고용으로만 남긴다. CRITICAL 급의 "미해결 결정 우회"는 없다.

### 위험도

LOW
