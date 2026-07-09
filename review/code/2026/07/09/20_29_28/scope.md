# 변경 범위(Scope) 리뷰

## 대상 요약

회귀(#501) — 멀티턴 AI 대화의 2번째 이후(resume) 턴에서 `workflowId`/`nodeExecutionId`
가 재구성 `resumeState` 에 재주입되지 않아, cafe24/makeshop/mcp provider-tool 의
usage-log 게이트(`if (ctx.nodeExecutionId && ctx.workflowId)`)가 false 가 되고
`integration_usage_log` 기록이 조용히 누락되던 문제를 수정. `buildRetryReentryState`
(AI resume + retry-last-turn 공유 재구성기)가 두 필드를 재주입하도록 신규
`opts.nodeExecutionId` 파라미터를 스레딩한다.

## 발견사항

- **[INFO]** 스코프 외 사전 결함 fix 1건 포함 (`execution-engine.service.spec.ts`)
  - 위치: `execution-engine.service.spec.ts` — `NF-OB-07 BusinessMetrics` describe 블록의
    `reentryWorkflowInput` 헬퍼, `service` → `svcMetrics` 참조 교체
  - 상세: 본 커밋의 핵심 스코프(#501 attribution 회귀)와 무관한 영역 — 별도 PR
    (#868, manual-trigger defaultValue)에서 유입된 out-of-scope `service` 참조로
    `ReferenceError` 가 나던 사전 결함(HEAD 에서도 실패)의 수정이다. 변경 자체는
    1줄 변수 교체로 최소이고, `plan/in-progress/fix-resume-turn-usage-log-attribution.md`
    의 "부수 발견 (TEST WORKFLOW 중 조치)" 섹션에 명시적으로 근거·정책("ISSUE FIX
    정책 — 발견 시 조치")과 함께 기록돼 투명하다. 프로덕션 동작에는 영향 없는
    test-only 변경.
  - 제안: 별도 조치 불필요 — 이미 문서화·정당화됐고 위험도 낮음. 팀 컨벤션상 발견된
    선행 결함을 같은 TEST WORKFLOW 사이클에서 조치하는 것이 허용되는 패턴이라면
    그대로 유지 가능.

## 스코프 정합성 분석

- **의도 이상의 변경**: 없음. 7개 변경 파일(`ai-turn-orchestrator.service.ts`,
  `engine-driver.interface.ts`, `execution-engine.service.spec.ts`,
  `execution-engine.service.ts`, `retry-turn.service.ts`,
  `utils/resume-state.schema.ts`, 신규 plan 문서) 전부가 "resume/retry 재구성기에
  `nodeExecutionId` 를 스레딩해 usage-log attribution 을 복원한다"는 단일 목적으로
  수렴한다. 인터페이스(`opts` 타입) → 구현(엔진의 `buildRetryReentryState`) → 3개
  호출부(`ai-turn-orchestrator`/`retry-turn.service`/테스트 mock 타입) → 스키마
  문서화(`resume-state.schema.ts`)까지가 한 필드 추가에 필연적으로 동반돼야 하는
  동기화 세트이며 과잉이 아니다.
- **불필요한 리팩토링**: 없음. 각 diff hunk 가 최소 라인 변경(주석 + 1~2 줄 코드)에
  그친다. 기존 로직·구조 재작성 없음.
- **기능 확장**: 없음. 새 기능이 아니라 기존에 의도된 필드 2개(`workflowId`,
  `nodeExecutionId`) 중 누락된 재주입을 복원하는 결함 수정. over-engineering 징후 없음.
  `resumeStateSchema`/`CREDENTIAL_CONTEXT_FIELDS` 갱신도 기존 allow-list 패턴을 그대로
  따라 필드 1개를 추가하는 대칭적 변경.
- **무관한 수정**: 위 INFO 1건(테스트 파일의 선행 버그 수정)을 제외하면 전부 관련
  영역. plan 문서 신설도 이번 작업 추적용으로 정상 범위(`plan/in-progress/`).
- **포맷팅 변경**: 눈에 띄는 의미 없는 공백/줄바꿈 변경 없음. diff 가 모두 실질
  코드/주석 라인에 집중.
- **주석 변경**: 추가된 모든 주석이 `#501 회귀` 컨텍스트를 직접 설명 — 근거 없는
  주석 첨삭 없음. `resume-state.schema.ts` 신규 필드 주석도 필드 목적(재개 시 재유도,
  persist 금지)을 정확히 문서화.
- **임포트 변경**: 관찰된 diff 에 임포트 추가/삭제 없음.
- **설정 변경**: 없음. `plan/in-progress/*.md` 는 작업 추적 문서이지 설정 파일이
  아니며 frontmatter(`spec_impact: none`)도 이번 변경 성격(백엔드 결함 수정, spec
  영향 없음)과 일치.

## 요약

이번 변경은 #501 회귀(멀티턴 AI resume 턴의 usage-log attribution 누락) 수정에
필요한 필드(`nodeExecutionId`) 스레딩으로 정확히 국한돼 있으며, 인터페이스·구현·
호출부·스키마·테스트·plan 문서가 모두 단일 목적에 직접 기여한다. 유일한 경계 사례는
`execution-engine.service.spec.ts` 에 포함된 무관 영역(선행 PR #868 유입 버그)의
1줄 수정으로, 스코프 이탈이긴 하나 plan 문서에 사유와 함께 투명하게 기록돼 있고
위험도가 낮아 CRITICAL/WARNING 급 문제로 보지 않는다.

## 위험도

LOW
