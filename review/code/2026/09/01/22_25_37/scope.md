# 변경 범위(Scope) 리뷰 — `easy-a-harness-hygiene`

## 조사 방법

`git diff --stat origin/main...HEAD` 로 실제 changeset 전체(68 files, 3794(+)/17(-))를 확인하고,
`git log -1 --format=%B` 로 커밋(`b5d2e6972`) 본문을 읽어 저자가 스스로 명시한 작업 범위와
diff 를 대조했다. 저장소에는 아무 것도 mutate 하지 않았다(읽기 전용 확인만 수행).

## 발견사항

- **[WARNING]** 브랜치/커밋이 "harness hygiene" 로 명명·프레이밍됐는데, 관련 없는 **spec 내용
  결정 작업**(`EngineErrorCode`/`ErrorCode` 두 surface 병기) 전체 라이프사이클이 같은 커밋에
  번들돼 있다.
  - 위치: 커밋 `b5d2e6972`(`fix(harness): 가드 사각지대 3곳 + plan 이동 절차의 빠진 방향`)의
    `## \`error-codes.md\` 두 surface 병기 — \`--spec\` 6라운드` 섹션. 파일로는
    `spec/conventions/error-codes.md`(§Overview, +10줄),
    `plan/in-progress/spec-conventions-engine-error-code-surface.md`(+62줄),
    `plan/complete/spec-draft-error-code-two-surfaces.md`(신규 150줄), 그리고
    `review/consistency/2026/09/01/{21_30_10,21_36_28,21_39_47,21_46_05,21_49_21,21_56_30}/**`
    6개 세션 디렉터리(9개 파일 × 6 = 54개 파일, 약 2,600줄).
  - 상세: 커밋 본문이 스스로 "백로그에서 '쉽게 진행할 수 있는' 다섯 항목" 이라 밝히고 있어
    은닉된 변경은 아니지만, 다섯 항목 중 넷(① stray-tool-tag 가드 ② `_CHECKBOX` blockquote
    정규식 ③ 링크 가드 통합층 line 전파 ④ `plan-lifecycle.md` outgoing 링크 절차)은 실제로
    "harness/gate 버그 수정"이라는 하나의 결(結)로 묶이는 반면, 다섯 번째 `error-codes.md`
    병기는 **성격이 다른 축**이다 — CLAUDE.md 가 명시적으로 "`spec/` 변경 → `project-planner`,
    `codebase/`(harness 포함) 변경 → `developer`" 로 역할·쓰기 권한을 가른 바로 그 경계를
    한 커밋 안에서 동시에 건넌다. 이 다섯째 항목은 harness 코드/가드를 전혀 건드리지 않고,
    오히려 6라운드에 걸친 `/consistency-check --spec` 논쟁(층 프레이밍 반증·목적지 필드 재선언
    WARNING·Rationale 유보 등)을 필요로 한 독립적인 spec 저작 결정이다. 이 항목이 앞의 네
    harness 수정과 같은 diff/커밋에 섞이면서 diff 크기가 68파일 중 68→54파일(≈80%)이 이
    다섯째 항목의 부산물(consistency-check 세션 아티팩트)로 채워졌고, harness 수정 본체(14
    파일, ≈230줄)를 리뷰어가 독립적으로 검토·revert 하기 어렵게 만든다.
  - 참고: `--spec` draft·consistency-check 세션 산출물을 커밋해 보존하는 것 자체는 이 저장소의
    기존 계약이다(`a0e6034e2`) — 그 보존 관행 자체는 지적 대상이 아니다. 지적 대상은 "그
    산출물을 낳은 작업 항목이 harness 수정과 **한 커밋/한 PR**에 함께 들어간 것"이다.
  - 제안: 다섯째 항목(`error-codes.md` 두 surface 병기 + 그 plan·consistency 아티팩트)을 별도
    커밋 또는 별도 PR 로 분리한다. 이미 두 항목이 서로 다른 plan 문서(harness 쪽은 전용 backlog
    plan 없음, spec 쪽은 `spec-conventions-engine-error-code-surface.md`)로 추적되고 있어 분리
    비용은 낮다. 부득이 한 커밋에 유지해야 한다면 최소한 PR 설명/커밋 메시지에서 두 축의 리뷰
    책임자(harness reviewer vs spec/project-planner reviewer)가 다르다는 점을 명시할 것.

- **[INFO]** "harness hygiene" 네 항목(①~④) 자체는 diff 가 각 문제 서술과 정확히 1:1로
  대응하고, 무관한 리팩토링·포맷팅·주석·임포트 변경이 섞여 있지 않다.
  - 위치: `.claude/hooks/_lib/plan_guard.py`(13줄, `_CHECKBOX` 정규식 1곳만),
    `.claude/tests/test_plan_guard.py`(+38줄, 신규 테스트 3개만 추가),
    `.claude/docs/plan-lifecycle.md`(+2줄, 이동 절차 문단 1개 추가),
    `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`(+27줄, 멀티라인 anchor
    fixture + 통합 테스트 1개),
    `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 파일, 새 가드
    전용),
    `plan/complete/{agent-memory-model-config,agent-memory-model-select,fix-model-select-label,
    webchat-session-apibase-binding}.md` + `plan/in-progress/webchat-usewidget-extraction.md`
    (각 1~2줄, 잔재 태그 `</content>`/`</invoke>` 삭제만),
    `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md`(체크박스 상태
    갱신 + 취소선 정정, 실제 절차 반영과 일치).
  - 상세: `git diff --stat`으로 각 파일의 변경 라인 수를 확인했고, 파일 전체를 다시 열어봐도
    커밋 서술("① stray tag ② blockquote 정규식 ③ line 전파/멀티라인 ④ outgoing 링크 절차")과
    어긋나는 손질(예: 관련 없는 함수 리팩토링, 스타일 재정렬, 미사용 임포트 정리)이 없다.
    `plan_guard.py` 의 정규식 변경에 붙은 긴 주석(≈12줄)은 스코프 이탈이 아니라 이 저장소의
    기존 관례(변경 근거·반증 실측을 코드 옆에 남기는 문서화 습관)와 일치한다.
  - 결론: 이 네 항목만 놓고 보면 스코프 이탈 없음(NONE 수준).

- **[INFO]** `spec/conventions/error-codes.md` 자체의 편집은(다섯째 항목 안에서도) 최소·집중돼
  있다.
  - 위치: `spec/conventions/error-codes.md:26` 부근, §Overview "적용 범위" 문단 뒤에 10줄
    추가.
  - 상세: 추가된 내용은 driving plan(`spec-conventions-engine-error-code-surface.md`)이 최종
    합의한 범위(존재·자매 관계·키 disjoint·비대칭 경계 서술, 목적지 필드는 미기술)와 정확히
    일치하고, §1/§2/§3/§4 등 다른 절은 건드리지 않는다. `EngineErrorCode` 4종 완전 열거
    같은 앞선 라운드의 스코프 확장 시도는 최종판에서 빠져 있다(6라운드 consistency-check 가
    이미 잡아낸 문제). 다섯째 항목 **내부**의 스코프는 깨끗하다 — 문제는 그 항목이 harness
    수정과 같은 커밋에 있다는 상위 스코프 판단(첫 WARNING)이다.

## 요약

harness 관련 네 항목(스트레이 태그 가드, blockquote 체크박스 정규식, 링크 가드 line 전파,
plan 이동 절차 문서화)은 각각 자기 문제에 정확히 대응하는 최소 diff로, 스코프 이탈·불필요한
리팩토링·포맷팅 잡음이 없다. 그러나 같은 커밋에 성격이 전혀 다른 다섯째 항목 —
`spec/conventions/error-codes.md` 의 `EngineErrorCode`/`ErrorCode` 두 surface 병기라는 spec
내용 결정과 그 6라운드 `--spec` consistency-check 라이프사이클 전체(54개 산출물 파일,
diff 의 대부분을 차지)가 함께 실려 있다. 커밋 메시지가 이를 "다섯 항목" 배치 작업으로 스스로
밝히고 있어 은폐된 변경은 아니지만, CLAUDE.md 가 명시한 `spec/`(project-planner) vs
`codebase/`·harness(developer) 역할 경계를 한 커밋에서 동시에 넘고, harness 수정의 독립
검토·revert 가능성을 해친다는 점에서 분리가 바람직하다.

## 위험도

MEDIUM
