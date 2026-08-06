# Plan 정합성 검토 — plan_coherence

## 발견사항

- **[WARNING]** target scope(`spec/4-nodes`)가 이 PR 의 실제 diff 와 무관 — plan 정합성 검증이 이 세션에서 사실상 불가능
  - target 위치: 프롬프트 전체 (`## Target 문서` 경로: `spec/4-nodes`, `--impl-done`, diff-base=`origin/main`)
  - 관련 plan: `plan/in-progress/harness-review-gate-ci-backstop.md` (이 브랜치 `harness-review-ci-backstop-91f379` 의 실제 governing plan — 본 프롬프트 번들에서는 "컨텍스트 예산 초과로 생략된 파일" 목록에만 이름이 있고 본문은 없음)
  - 상세:
    - 직접 실측: `git diff origin/main...HEAD --stat -- spec/4-nodes codebase/backend/src/nodes codebase/frontend/src/lib/api/node-definitions.ts codebase/frontend/src/lib/stores/node-definitions-store.ts` → **출력 0바이트**. 이 브랜치는 `spec/4-nodes` 나 그 코드 영역을 전혀 건드리지 않는다.
    - 실제 diff(`git diff origin/main...HEAD --stat`)는 `.claude/tests/test_packages_prepare_contract.py`(신규 216줄) · `.github/workflows/harness-checks.yml`(+5줄, trigger path 1건 추가) · `codebase/packages/*/package.json` 6개(의존성 protocol 버전) · `review/code/2026/08/06/18_55_02/**`(직전 ai-review 산출물) 뿐이다.
    - 프롬프트 자체도 이를 자인한다 — "### ⚠️ 컨텍스트 예산 초과로 생략된 파일" 목록 마지막 항목이 `<git diff origin/main...HEAD -- code_areas>` 다. 즉 이 세션은 실제 코드 diff 를 **한 줄도 프롬프트에 받지 못한 채** `spec/4-nodes` 전체 번들 + `plan/in-progress` 7개 plan 전문만 받았다.
    - 이 브랜치의 실제 governing plan `plan/in-progress/harness-review-gate-ci-backstop.md` 에는 지금도 살아있는 미해결 결정이 있다 — "⛔ `--enforce` 전환의 선행 조건" (선택지 (a) CI 서명 트레일러 검증 / (b) PR check·label 이원화 / (c) 위조 가능성 명시적 수용, 현재 관측 모드에서는 (c) 가 사실상 기본값). 이 세션의 target 지정(`spec/4-nodes`)으로는 이번 diff 가 그 미해결 결정과 정합한지 전혀 검증할 수 없다.
  - 제안: orchestrator 가 이 세션의 `--impl-done` scope 인자를 재확인해야 한다. 실제 변경 영역(`.github/workflows/harness-checks.yml`, `.claude/tests/`, `codebase/packages/*/package.json`) 또는 `plan/in-progress/harness-review-gate-ci-backstop.md` 를 target 으로 잡아 재실행해야 이 PR 에 대한 유효한 plan-coherence 판정이 나온다. **이 세션의 "충돌 없음" 결과를 이 PR 의 plan 정합성 근거로 사용하지 말 것** — 위양성 PASS 위험(harness-consistency-summary-downgrade-rule.md 가 이미 유사 클래스의 번들 누락을 8회 기록한 바 있음).

- **[INFO]** `marketplace-and-plugin-sdk.md` 의 죽은 "상위 인덱스" 참조가 자매 plan 과 달리 미정정
  - target 위치: `spec/4-nodes/0-overview.md` §4 (노드 플러그인 인터페이스 — 이 plan 이 §4/§5 초안 근거로 인용됨)
  - 관련 plan: `plan/in-progress/marketplace-and-plugin-sdk.md` 헤더 (`> 상위 인덱스: 0-unimplemented-overview.md §A`)
  - 상세: 같은 계열 자매 plan `plan/in-progress/ai-agent-tool-connection-rewrite.md` 는 2026-07-17 자로 "`0-unimplemented-overview.md` 는 저장소에 존재하지 않는다(전수 검색 0건) — 폐기된 문서 구조의 잔재이며 상위 인덱스는 현재 없다" 로 이미 정정했다. `marketplace-and-plugin-sdk.md` 는 같은 죽은 링크를 그대로 갖고 있어, 이 plan 을 여는 다음 작업자가 존재하지 않는 상위 문서를 찾아 헤맬 수 있다. target(spec/4-nodes) 내용과 직접 충돌하는 것은 아니며 낮은 우선순위.
  - 제안: `marketplace-and-plugin-sdk.md` 헤더에도 동일한 취소선 정정을 반영. `spec/` 쓰기 권한은 없으나 이 plan 은 `plan/in-progress/**` 이므로 developer 트랙에서 바로 고칠 수 있는 범위.

## 확인 사항 (충돌 없음)

주어진 target 번들(`spec/4-nodes` 전체 — §1 노드 아키텍처 ~ §5 샌드박싱 + Rationale) 과 `plan/in-progress` 에 전문 번들된 7개 plan(`ai-agent-tool-connection-rewrite.md` · `cafe24-backlog-residual.md` · `eia-context-schema-followups.md` · `execution-engine-residual-gaps.md` · `harness-consistency-summary-downgrade-rule.md` · `ie-resume-turn-boundary-cancel.md` · `marketplace-and-plugin-sdk.md`) 을 대조한 결과:

- `spec/4-nodes/0-overview.md` §4(노드 플러그인 인터페이스)·§5(샌드박싱 "파일 시스템" 행)는 일관되게 "미구현 (Planned)" 로만 표기하고 어떤 구체적 설계도 확정하지 않는다 — `marketplace-and-plugin-sdk.md` §0 의 미해결 결정(단계 분할·마켓 호스팅·수익화·검증 정책·셀프호스팅)을 선점하는 서술이 없다. `NodeCategory` enum 이 `custom` 을 아직 포함하지 않는다는 서술도 두 문서가 일치한다.
- AI Agent "Tool Area" 는 target 쪽 참조(§1.3 각주)에서도 "재작성 예정" 으로만 언급되고, `ai-agent-tool-connection-rewrite.md` 의 TBD 결정(도구 등록 모델 a/b/c 등)을 침해하지 않는다.
- `execution-engine-residual-gaps.md` G2(errorPolicy `continue` on SIGTERM, BLOCKED/defer)는 target §4 "에러 정책 (errorPolicy)" 의 정상 실행 경로 `continue` 값과 레이어가 다르다(target 스스로 "컨테이너 전용 config.errorPolicy vs 일반 노드 config.errorHandling.policy 는 별개 레이어" 로 명시 구분) — 충돌 아님.
- `cafe24-backlog-residual.md` 가 언급한 과거 WARNING("`4-cafe24.md` 예시 필드명 stale", planner 태스크 `task_28baf9cb`)은 커밋 `3e6dcf47a` 로 이미 해소됐음을 `git log`/`grep` 으로 직접 확인(현재 `spec/4-nodes/4-integration/4-cafe24.md` 에 해당 stale 표현 0건).

## 요약

이번 세션에 실제로 주어진 target(`spec/4-nodes`)과 `plan/in-progress` 번들 사이에서는 미해결 결정을 우회하는 CRITICAL 충돌을 찾지 못했다 — 두 축 모두 "미구현/Planned" 상태와 TBD 결정을 정합적으로 유지하고 있다. 그러나 이 세션의 근본 문제는 **target/scope 자체가 이 PR(`harness-review-ci-backstop-91f379`)의 실제 diff 와 무관하다**는 점이다. 실측(`git diff origin/main...HEAD --stat`)으로 이 브랜치는 `spec/4-nodes` 나 그 코드 영역을 전혀 건드리지 않으며, 실제 변경은 harness CI 트리거 배선(`.github/workflows/harness-checks.yml`)과 신규 계약 테스트(`.claude/tests/test_packages_prepare_contract.py`) 뿐이다. 프롬프트 자체도 실제 code diff 섹션을 예산 초과로 완전히 생략했음을 자인한다. 따라서 이 세션의 "충돌 없음" 판정은 이 PR 의 진짜 governing plan(`plan/in-progress/harness-review-gate-ci-backstop.md`, 살아있는 `--enforce` 전환 미해결 결정 보유)에 대해서는 아무것도 검증하지 못했다 — orchestrator 가 scope 를 바로잡아 재실행하기 전까지 이 결과를 이 PR 의 plan 정합성 근거로 채택하면 안 된다.

## 위험도

MEDIUM — 발견된 콘텐츠 자체의 충돌은 없으나(그 부분은 LOW), scope 불일치로 이 PR 에 대한 실질 검증이 이뤄지지 않은 채 "통과" 로 읽힐 위험이 있어 하향하지 않았다.
