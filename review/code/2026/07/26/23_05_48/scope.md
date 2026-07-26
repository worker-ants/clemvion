# 변경 범위(Scope) Review — ie-resume-signal-6e933d (2026-07-26 23:05)

## 발견사항

- **[INFO]** `plan/in-progress/cafe24-backlog-residual.md`, `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 편집이 본 티켓(park 짝 전이 lost-update / turn 경계 cancel 가드)과 무관한 주제(Cafe24 API 카탈로그 `mains_update`/`mains_delete` 모순, harness `--impl-done` scope 산정 버그)를 다룬다.
  - 위치: `plan/in-progress/cafe24-backlog-residual.md:220`~`253` (신규 절 "`mains_update`/`mains_delete` 제거 근거가 field-level 카탈로그와 모순"), `plan/in-progress/harness-consistency-summary-downgrade-rule.md:62`~`85` (신규 절 "`--impl-done` scope 가 실제 diff 와 무관한 번들을 싣는다")
  - 상세: 두 편집 모두 diff 자체에 "무관한 티켓의 `--impl-prep`/`--impl-done` 스코프에 딸려 나온 기존 결함이라 그 PR 범위 밖 — 유실 방지를 위해 여기 이관한다"는 근거가 명시돼 있고, 코드는 전혀 건드리지 않는다. `plan/in-progress/ie-resume-turn-boundary-cancel.md:127`~`139` ("impl-prep 결과") 절도 같은 취지로 "CRITICAL 전문은 `cafe24-backlog-residual.md` 로 이관"했음을 교차 기록해, 두 문서 간 사유가 일관된다. 프로젝트 컨벤션(발견을 코드로 즉시 고치지 않고 별도 백로그 문서로 격리·이관하는 방식)과 부합하며, 이전 라운드 scope 리뷰(`review/code/2026/07/26/22_11_22/scope.md`)도 동일하게 "scope 위반 아님, 올바른 격리 처리"로 판정한 바 있다.
  - 제안: 조치 불요 — 코드 스코프를 침범하지 않은 순수 문서 격리이므로 반복 지적하지 않는다.

- **[INFO]** `execution-engine.service.ts` `updateExecutionStatus` 의 else 분기(non-linked 전이)에서 `recordRunningSegmentStart` 호출 시점을 `persisted===true` 확인 이후로 옮긴 수정(ai-review WARNING #9)이, 본 티켓의 핵심(park 짝 전이 lost-update·turn 경계 cancel)과는 결이 다른 기존 로직 경로에도 적용됐다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `enteringRunning` 분리(게이트 8195~8196), else 분기 반영(게이트 8293~8296)
  - 상세: `updateExecutionStatus` 를 이번 PR 이 linkedNodeExec 분기 목적으로 어차피 수정하는 김에, 같은 함수 내 인접한 else 분기의 기존 버그(거부된 RUNNING 전이에도 `segmentStartMs` 가 무조건 기록되던 in-memory 유령 항목)까지 opportunistic 하게 함께 고쳤다. 같은 함수·같은 diff hunk 안이라 "무관한 파일 수정"은 아니며, 회귀 테스트(`execution-engine.service.spec.ts` else 분기용 케이스)로 고정돼 있고 ai-review 세션에서 명시적으로 승인·추적됐다.
  - 제안: 조치 불요 — 다만 RESOLUTION 표에 "본 PR 범위 밖 opportunistic fix" 로 명시된 선례(이전 라운드 scope.md)를 유지할 것.

- **[INFO]** `StubLlmClient` 에 e2e 전용 인위 지연 프로토콜(`__e2e_delay_ms:<n>` 마커 + 상한 `STUB_MAX_DELAY_MS`)이 신설됨 — 티켓의 핵심 수정 대상이 아니라 그 수정을 검증하는 e2e 에 필요한 테스트 하네스 확장이다.
  - 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts` 게이트 38~42(마커 정규식·상수 신설), 45~69(`chat()` 분기 로직)
  - 상세: `RESOLUTION.md`(`review/code/2026/07/26/21_08_01`) Warning #6 에 사전 승인 근거가 명시돼 있고, 기존 동작 보존 회귀 테스트(`stub.client.spec.ts` "마커가 없으면 지연 없이 즉시 응답")가 함께 추가돼 있으며, 상한 캡으로 프로덕션 미도달·무한 e2e hang 위험을 방어해 뒀다 — 요청 없는 기능 확장이라기보다 검증 필수 최소 테스트 인프라.
  - 제안: 조치 불요.

- **[INFO]** 코드 리뷰/plan 문서 다수(35개 파일 중 27개)가 이전 두 라운드(`review/code/2026/07/26/20_10_51`, `21_08_01`)의 RESOLUTION/로그/서브에이전트 산출물이다.
  - 위치: `review/code/2026/07/26/{20_10_51,21_08_01,22_11_22}/*`
  - 상세: `origin/main...HEAD` 전체 diff 가 이번 세션의 대상이라, 같은 브랜치에서 이미 수행된 선행 ai-review 라운드(3회)의 산출물이 그대로 포함된다. 이는 CLAUDE.md 가 지정한 코드 리뷰 산출물 SoT 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)이자 developer SKILL 이 강제하는 표준 워크플로 결과물이며, 코드 스코프를 벗어난 임의 추가가 아니다.
  - 제안: 조치 불요.

- **관측(부정 결과, 스코프 이탈 패턴 없음)**: 실측 `git diff origin/main...HEAD --stat -- codebase/` 결과 소스 변경은 정확히 8개 파일(`ai-turn-orchestrator.service.ts`/`.spec.ts`, `engine-driver.interface.ts`, `execution-engine.service.ts`/`.spec.ts`, `stub.client.ts`/`.spec.ts`, `execution-park-resume.e2e-spec.ts`)로, 전부 plan(`ie-resume-turn-boundary-cancel.md`)이 처음부터 명시한 두 결함(§A park 짝 전이 lost-update, §B turn 경계 cancel 가드)과 그 검증에 직접 대응한다. `markNodeCancelled`/`assertExecutionNotCancelled` 의 `private`→`public` 전환, `NON_TERMINAL_STATUSES_SQL` 상수 추출, `assertActiveExecutionAndSaveNodeExec` 신설 등은 전부 같은 choke point(`updateExecutionStatus`)·같은 소비 헬퍼(`assertLinkedTransitionApplied`)를 대상으로 한 3라운드 ai-review 의 누적 fix 이며, 각각 CHANGELOG/RESOLUTION/plan 에 근거가 투명하게 기록돼 있다. 무관한 임포트 추가, 포맷팅-only 변경, 설정 파일 변경, 불필요한 주석 정리 등 전형적인 스코프 이탈 패턴은 관측되지 않았다.

## 요약

diff 는 표면적으로 35개 파일에 걸치지만 실제 소스 코드 변경은 8개 파일로 좁고, 그 전부가 plan 이 명시한 두 결함(park 짝 전이 lost-update, AI multi-turn turn 경계 cancel 가드)과 3라운드에 걸친 ai-review 후속 fix 에 직접 대응한다. 나머지 27개 파일은 이전 review 라운드의 표준 산출물(RESOLUTION/로그/서브에이전트 리포트)이거나 plan 갱신 문서로, 코드 스코프 침범이 아니다. 유일하게 "티켓과 무관한 주제"를 언급하는 두 백로그 plan 문서(cafe24 카탈로그 모순, harness scope 버그) 편집은 코드를 건드리지 않고 발견을 격리·이관만 하는 프로젝트 표준 관행이며, 이전 라운드 scope 리뷰도 동일하게 문제없음으로 판정했다. else 분기 opportunistic fix(WARNING #9)와 stub 클라이언트 e2e 지연 마커는 티켓 범위를 근소하게 넘어서지만 둘 다 명시적으로 승인·문서화·회귀 테스트로 고정돼 실질 위험은 없다. 차단할 스코프 이탈 없음.

## 위험도
NONE
