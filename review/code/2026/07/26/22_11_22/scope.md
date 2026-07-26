# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `StubLlmClient` 에 e2e 전용 인위 지연 프로토콜(`__e2e_delay_ms:<n>` 마커 + 상한 `STUB_MAX_DELAY_MS`)이 신설됨 — 원 티켓("turn 경계 cancel 체크 + park 짝 전이 lost-update 차단")의 핵심 수정 대상이 아니라, 그 수정을 검증하기 위한 e2e(파일 9)에 "관측 가능한 RUNNING 윈도우"를 만들어주는 테스트 인프라 확장이다.
  - 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts:38~42`(마커 정규식·상수 신설), `:49~69`(`chat()` 분기 로직 추가)
  - 상세: 공유 테스트 스텁에 새 미니 프로토콜(마커 파싱 → echo 제거 → `setTimeout` 지연 → 상한 캡)을 도입한 것은 기능 확장(관점 3)에 해당할 수 있는 변경이다. 다만 (a) `RESOLUTION.md`(`review/code/2026/07/26/21_08_01/RESOLUTION.md` Warning #6)에 사전 승인 근거가 명시돼 있고, (b) 기존 동작 보존 회귀 테스트(`파일 7:75~81` "마커가 없으면 지연 없이 즉시 응답")가 함께 추가돼 있으며, (c) 상한 캡으로 무한 e2e hang 위험까지 방어해 두어 — 전형적인 "요청 없는 기능 확장"이라기보다는 검증에 필요한 최소 테스트 하네스 확장에 가깝다.
  - 제안: 별도 조치 불요. 다만 이 스텁이 다른 e2e 스위트에서도 공유되므로, 향후 `__e2e_delay_ms` 프로토콜이 관련 없는 테스트에 우연히 매칭되지 않도록(예: 실제 사용자 입력에 이 리터럴이 포함되는 경우) 계속 주의.

- **[INFO]** `updateExecutionStatus` 의 `segmentStartMs` 기록 시점 버그(WARNING #9) 수정이, 본 티켓의 핵심(park 짝 전이 lost-update)과는 결이 다른 **else 분기(non-linked 전이)** 에도 적용됨 — else 분기의 거부된 RUNNING 전이 유령 항목 문제는 이번 PR 이전부터 존재하던 로직 경로다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8140~8147`(`enteringRunning` 계산 분리), `:8244~8247`(else 분기 `persisted` 확인 후 기록)
  - 상세: `updateExecutionStatus` 를 이번 PR 이 어차피 수정하는 김에 같은 함수 내 인접 로직(`recordRunningSegmentStart` 무조건 호출)의 기존 버그까지 함께 고쳤다. 같은 함수·같은 diff hunk 안이라 "무관한 파일 수정"은 아니지만, 티켓 범위(cancel 관측·park 짝 전이)를 엄밀히 넘어서는 opportunistic fix다.
  - 제안: 이미 회귀 테스트(`execution-engine.service.spec.ts:4901~4915` else 분기용, `:5000~5021` linked 분기용)로 고정돼 있고 별도 조치 불요 — 다만 향후 RESOLUTION 표에 "본 PR 범위 밖 opportunistic fix"로 명시해두면 추적성이 좋아진다.

- **[INFO]** 이번 diff에 `plan/in-progress/cafe24-backlog-residual.md`, `plan/in-progress/harness-consistency-summary-downgrade-rule.md` 두 개의 **무관한 백로그 plan 문서** 편집이 포함됨 — 둘 다 본 티켓(node-cancellation)과 무관한 주제(Cafe24 API 카탈로그 모순, harness `--impl-done` scope 산정 버그)다.
  - 위치: `plan/in-progress/cafe24-backlog-residual.md:220~253`(신규 섹션 전체), `plan/in-progress/harness-consistency-summary-downgrade-rule.md:62~85`(신규 섹션 전체)
  - 상세: 두 항목 모두 diff 자체에 "무관한 티켓의 스코프에 딸려 나온 기존 결함이라 그 PR 범위 밖 — 유실 방지를 위해 여기 이관한다" 는 근거가 명시돼 있다. `--impl-prep`/`--impl-done` 실행 중 발견된 사이드 이펙트를 코드로 고치지 않고 별도 백로그 문서로 옮겨 기록한 것으로, 실제 코드 스코프를 침범하지 않았다. 프로젝트 컨벤션(fix→review stale loop 교훈: "미룬 항목은 그 턴에 plan/ 에 적어라")과도 부합한다.
  - 제안: 조치 불요 — scope 위반이 아니라 올바른 격리 처리 사례로 판단.

## 요약

diff 는 표면적으로 19개 파일에 걸쳐 크지만, 핵심 코드 변경(`ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`, `engine-driver.interface.ts`와 각각의 스펙)은 plan(`ie-resume-turn-boundary-cancel.md`)이 처음부터 명시한 두 결함(§B turn 경계 cancel 가드, §A park 짝 전이 lost-update)에 직접 대응하며, 리뷰 라운드(`RESOLUTION.md` 20_10_51/21_08_01)에서 나온 Critical/Warning fix 들도 전부 같은 함수·같은 소비처를 대상으로 한다. e2e 검증을 위한 `StubLlmClient` 지연 마커 추가와 `updateExecutionStatus` else 분기의 부수적 버그 수정은 티켓 원 범위를 살짝 넘어서지만, 둘 다 리뷰 세션에서 명시적으로 승인·추적됐고 회귀 테스트로 고정돼 있어 실질적 위험은 낮다. `cafe24-backlog-residual.md`/`harness-consistency-summary-downgrade-rule.md` 편집은 무관한 주제이나 코드를 건드리지 않고 격리 문서화만 했으므로 스코프 침해로 보지 않는다. 포맷팅-only 변경, 미사용 임포트, 설정 파일 변경, 불필요한 주석 정리 등 전형적인 스코프 이탈 패턴은 관측되지 않았다.

## 위험도

LOW
