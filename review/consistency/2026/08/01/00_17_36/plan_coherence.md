### 발견사항

- **[WARNING]** `review-info-followups.md` §4 — 이관 서술이 원본 plan 에 반영되지 않음
  - target 위치: `plan/in-progress/spec-data-flow-structural-followups.md` ## Overview
    ("원 plan(`review-info-followups.md` §4)에서 이관. 그 plan 은 본 항목들이 분기됐으므로
    완료 처리한다.")
  - 관련 plan: `plan/in-progress/review-info-followups.md` §4 "impl-done 게이트가 드러낸 범위
    밖 항목" → "후속으로 남긴 것" 목록의 3개 항목(`12-workspace.md §3.2 위치`,
    `3-execution.md §3.3 SIGTERM 행 상호참조`, `"LLM Config"→"Model Config" 표기 통일` — 각각
    "**planner 턴 필요**" 로 명시)
  - 상세: target 은 이 3항목을 전부 [x] 완료로 처리했고 내용도 정확하다(§2 SIGTERM 각주는 실제로
    `spec/data-flow/3-execution.md:300-310` 에 중립적으로 반영돼 있고, (a)/(b) 결정을 선점하지
    않음을 실측 확인). 그런데 `review-info-followups.md` 자체는 **전혀 갱신되지 않았다** — 그
    문서의 §4 는 지금도 이 3항목을 "planner 턴 필요" 미착수 상태로 서술하고, target 의 존재나
    완료 사실을 가리키는 상호참조가 **0건**이다. `review-info-followups.md` 는 이미 `main` 에
    병합된 정적 파일이므로(마지막 커밋 `a6fb90526`, `#1040`, `origin/main` 조상 확인) 이는 "다른
    세션이 아직 진행 중이라 반영 안 됐을 뿐" 인 상황이 아니라, **지금 이 PR 이 두 plan 파일을
    동시에 인지하고 있으면서도 한쪽만 갱신**한 상태다. target 문서의 "완료 처리한다" 는 서술은
    실제로 수행된 조치가 아니라 **의도 선언에 그쳤다** — 이 저장소가 반복 지적받은 "plan 서술이
    실제 상태와 어긋난다" 클래스(체크리스트 두 군데 비동기화)와 같은 패턴이다. `review-info-followups.md`
    가 이 상태로 `plan/complete/` 로 이동하거나 push 되면, 동일 3항목이 한쪽엔 "미착수", 다른 쪽엔
    "[x] 완료" 로 동시에 존재하는 dangling 중복 추적이 영구화된다.
  - 제안: 이번 PR 범위에서 `plan/in-progress/review-info-followups.md` §4 의 3개 bullet 에
    "→ `spec-data-flow-structural-followups.md` 로 이관·완료(2026-07-31)" 각주를 추가할 것.
    `project-planner` 는 `plan/**` 쓰기 권한이 있으므로 이 PR 이 직접 처리 가능하고, 별도 세션을
    기다릴 이유가 없다(그 문서가 속한 브랜치는 이미 병합되어 더 이상 활성 편집 대상이 아니다).

- **[INFO]** `spec_impact` frontmatter 가 실제 변경 파일 중 하나를 누락
  - target 위치: `plan/in-progress/spec-data-flow-structural-followups.md` frontmatter `spec_impact:`
  - 관련 plan: 없음(target 자기 자신의 frontmatter 완결성 문제, 참고용)
  - 상세: frontmatter 는 `spec_impact: [spec/data-flow/12-workspace.md, spec/data-flow/3-execution.md]`
    두 파일만 나열하지만, 실제 `git diff` 확인 결과 `spec/data-flow/0-overview.md` 도 수정됐다
    (§3.6 "권한 요약 (선택)" 신설 + 도메인 인덱스 "LLM Config"→"Model Config"). 본문에는
    `0-overview.md` 가 여러 차례 명시적으로 언급되므로(예: "`spec/data-flow/0-overview.md §3.4`",
    "`0-overview.md:131`") `plan 본문 언급` 기반으로 대상을 잡는 하위 tooling(예:
    `harness-consistency-summary-downgrade-rule.md` 의 `prioritize_bundle_files` 계층 1)에는
    걸릴 가능성이 있어 실질 위험은 낮지만, `spec_impact` 자체는 Gate C 등 frontmatter 를 직접
    신뢰하는 경로에서 여전히 불완전하다.
  - 제안: `spec_impact` 리스트에 `spec/data-flow/0-overview.md` 추가.

### 검증 완료 항목 (참고 — 문제 없음)

- **§2 SIGTERM 상호참조**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
  (미결 (a)/(b) 결정, 사용자 몫으로 명시)와 `plan/in-progress/node-cancellation-residual-signal-propagation.md`
  (BLOCKED 항목 + "graceful shutdown 의 FAILED 를 가드가 감지 못한다" 백로그)를 직접 열람해
  대조한 결과, target 이 `spec/data-flow/3-execution.md` §3.3 에 실제로 적용한 각주("본 문서는
  어느 쪽도 선점하지 않는다")는 두 plan 의 현재 미결 상태를 정확히 반영하며 (a)/(b) 어느 쪽으로도
  기울지 않는다. 두 plan 은 이번 검토 시점의 예산 초과로 번들에서 생략됐으나(프롬프트 말미
  "컨텍스트 예산 초과로 생략된 파일 57개" 목록에 명시적으로 포함되어 있었음), 그 경고에 따라
  직접 `Read` 로 원문을 확인해 판정했다.
- **§1 RBAC 섹션 재배치**: `12-workspace.md`/`0-overview.md` 내부 섹션 번호(§3→§4→§5, `### 3.6`
  신설)와 자기참조(`§4`→`§5` 각주, Audit 도메인 행)가 실제로 정합되게 갱신됨을 확인. `plan/in-progress/`
  전수 검색 결과 `12-workspace.md` 의 구 섹션 번호(`§3.2`/`§4 외부 의존`)나 앵커를 가리키는 다른
  in-progress plan 은 `review-info-followups.md`(위 WARNING 대상) 외에 없다 — 재배치로 깨지는
  타 plan 참조 없음.
- **§3 명칭 통일 범위**: `plan/in-progress/marketplace-and-plugin-sdk.md` 등 타 plan 의 "LLM Config"
  언급은 코드 식별자나 plan 서술일 뿐 spec 본문이 아니라 target 의 "식별자·서술 구분, data-flow
  범위만" 결정과 충돌하지 않는다.

### 요약

target(`spec-data-flow-structural-followups.md`)이 §2 에서 직접 인용하는 두 미결 plan(SIGTERM
분류 (a)/(b) 결정, 취소 가드 관측 갭)에 대해서는 그 미결 상태를 정확히 파악하고 어느 쪽도 선점하지
않는 중립적 각주로 반영했다 — 이 검토의 핵심 위험(미해결 결정 우회)은 발생하지 않았다. 다만 target
이 스스로 "이관 완료 처리한다" 고 서술한 원 plan(`review-info-followups.md`)의 해당 섹션이 실제로는
갱신되지 않아, 이미 병합된 정적 문서에 동일 항목이 "미착수" 로 계속 남는 dangling 불일치가 생겼다.
이는 이번 PR 이 직접, 지금 고칠 수 있는 범위의 문제이며 별도 결정 없이 각주 한 줄로 해소 가능하다.
frontmatter `spec_impact` 누락은 부수적 완결성 이슈다.

### 위험도
LOW
