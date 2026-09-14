# Plan 정합성 검토 — target: `spec/conventions/`

검토 모드: `--impl-done` (scope=`spec/conventions/`, diff-base=`origin/main`). 이 브랜치의
실질 구현 diff(6파일/434줄)는 `plan/in-progress/trigger-canary-hardening.md` 가 정의한
"2026-09-10 그루밍 배치의 잔여 4건"을 닫는 작업이며, `spec/conventions/` 자체 델타는 0(정상 —
코드+plan-only PR). 이전 라운드(`review/consistency/2026/09/14/10_44_37`)의 plan_coherence
WARNING 2건이 이번 diff 로 해소됐는지를 1차로 검증하고, 동시 진행 중인 다른 in-progress plan과의
충돌 여부를 2차로 확인했다.

## 발견사항

이번 라운드에서 신규 CRITICAL/WARNING 발견 없음. 이전 라운드 WARNING 2건의 해소 여부와 잔여
등재 항목의 정합성만 기록한다.

- **[INFO] 이전 WARNING "tracker 체크박스 미반영" — 해소 확인**
  - target 위치: (간접) `spec/conventions/secret-store.md` §1.1 이 참조하는 트리거 비밀 컬럼
    스트립 서사 — 실질은 `plan/in-progress/trigger-canary-hardening.md` 전체
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (2026-09-10 등재
    4건, 이전 라운드 시점 전부 `[ ]`)
  - 상세: 이번 diff(`git diff origin/main...HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md`)
    에서 4건(비밀 컬럼 3중 사본·`workflow` 양성 커버리지·캐너리 주석·e2e teardown) 전부
    `[ ]` → `[x]` 로 갱신되고, 각 항목에 "✅ 2026-09-14 해소 — `trigger-canary-hardening` 배치"
    각주와 실측 표(뮤턴트 결과·경계별 측정값)가 첨부됐다. `trigger-canary-hardening.md` 의
    체크리스트에도 "트래커 4건 `[x]` + 실측 각주" 단계가 추가되어, 이전 라운드가 지적한
    "자기 체크박스만 채우고 tracker 는 stale 로 남는" 위험이 실제로 발생하지 않았다.
  - 제안: 없음(조치 완료 확인).

- **[INFO] 이전 WARNING "캐너리 주석 세 번째 지적 누락" — 해소 확인**
  - target 위치: (관련 없음 — `spec/conventions/` 자체는 이 항목을 언급하지 않음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (캐너리 주석 항목,
    표의 3번 행: `"keys [] ≠ ['id','name']"` 인용이 의역이라는 지적)
  - 상세: `trigger-canary-hardening.md` §B.3 이 이번 diff 에서 ①②③ 세 지적을 전부 명시하고
    (①표기 통일, ②리뷰 이력 서술 제거, ③의역 표시), 체크리스트에도 "③ 은 --impl-prep
    WARNING#5 로 수용, §B.3 에 추가" 라 기록했다. tracker 쪽 해당 항목도 `[x]` +
    "세 지적 전부" 각주로 갱신됐다. 코드 diff(`trigger-workflow-ref.spec.ts` 등)를 직접
    확인하지는 않았으나 plan 서술과 tracker 각주가 일치하며 커밋 메시지(`efb0e4b36`)도
    동일 내용을 재확인한다.
  - 제안: 없음(조치 완료 확인).

- **[INFO] 신규 등재 3건(harness 번들 절단·`_overview.md` frontmatter·`__` 표기)은 developer
  권한 밖으로 올바르게 등재만 됨 — 미해결 결정 우회 아님**
  - target 위치: 없음(`spec/conventions/` 미변경)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 3항목
    (harness 1건 · planner 2건, 전부 2026-09-14 등재)
  - 상세: `trigger-canary-hardening.md` §B 말미 "하지 않는 것" 에 "`spec/` 편집(권한 밖)"
    이 명시돼 있고, 실제로 이 세 항목은 `[ ]` 상태로 tracker 에 등재만 되고 `spec/`
    파일은 건드리지 않았다(diff 확인 — `spec/conventions/**` 변경 0). CLAUDE.md 의
    "`developer` 는 `spec/` read-only" 원칙과 일치하며, 미해결 결정을 우회한 것이 아니라
    올바르게 다음 planner 턴으로 넘겼다.
  - 제안: 없음(조치 완료 확인).

- **[INFO] "커서 디코더 클러스터" 미해결 제품 결정 — 명시적으로 배제, 우회 아님**
  - target 위치: 없음
  - 관련 plan: `plan/in-progress/keyset-cursor-uuid-validation.md`,
    `plan/in-progress/spec-draft-nullable-notation-followups.md` (2026-09-12 등재, "두 keyset
    커서 디코더의 실패 계약이 다르다 — 무시 vs 400" 등 3항목, 제품 결정 필요로 명시)
  - 상세: `trigger-canary-hardening.md` §B 말미가 "커서 디코더 클러스터(계약 통일이 **제품
    결정** 선행)" 를 명시적으로 스코프 밖에 두었다. 이 PR 의 diff 는 커서 디코더 관련 파일을
    전혀 건드리지 않아 실질 충돌 없음 — 미해결 결정에 대해 일방적 판단을 내리지 않고 정확히
    배제했다.
  - 제안: 없음.

## 요약

이번 라운드는 이전 `--impl-prep` plan_coherence 가 지적한 WARNING 2건(tracker 체크박스 미반영,
캐너리 주석 세부 누락)이 실제 diff·plan·tracker 3자 대조로 모두 해소됐음을 확인했다. 새로 등재된
3건(harness 번들 절단 실측·`_overview.md` frontmatter·`__` 표기 규약)은 developer 권한 밖 항목을
정확히 tracker 등재로만 처리하고 `spec/` 을 건드리지 않아 권한 경계를 지켰다. 별도 진행 중인
"커서 디코더 클러스터" 제품 결정 미해결 항목과도 명시적으로 스코프를 분리해 우회하지 않았다.
다른 in-progress plan(`harness-review-gate-followups.md` 등)에 남은 "trigger-workflow-ref-canary"
관련 항목들은 harness 번들링 메커니즘 자체에 대한 것으로 이번 코드 diff 와 독립적이며 충돌하지
않는다. 미해결 결정 우회·선행 plan 미해소·후속 항목 누락 어느 관점에서도 CRITICAL/WARNING 급
문제를 발견하지 못했다.

## 위험도

NONE
