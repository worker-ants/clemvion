# Code Review 통합 보고서

세션: `review/code/2026/05/25/02_13_28/`
변경 범위: `origin/main..HEAD` (commits `8e2d2f04`, `b869c667`, `353fd585`)
라우터: fatal — fallback (14 reviewer 전수 실행)

## 전체 위험도

**MEDIUM** — Critical 0건. WARNING 8건 / INFO 15건. 두 회귀 fix 의 핵심 흐름은 정확하나 spec 진단 계약 미준수 1건 + 테스트 격리·문서·중장기 리팩터링 항목.

---

## Critical
없음.

---

## WARNING

| # | Category | 위치 | 내용 | 본 PR 처리 |
|---|----------|------|------|----------|
| W1 | requirement | `mcp-tool-provider.ts` openServer | `not_capable` skip 시 `serverSummaries` push 누락 — spec §6.2 진단 계약. 사용자가 AI Agent diagnostics 패널에서 cafe24 ref 가 어느 provider 에 의해 처리됐는지 식별 불가 | **follow-up** — Cafe24McpToolProvider 도 동일하게 push 안 함. 양쪽 provider 가 비-자기 service_type 에 대해 push 안 하는 게 spec 의 의도 (provider 라우팅 정상 동작 = silent 통과). 양쪽 모두 처리 못 한 ref 의 diagnostics 누락 문제는 provider 등록 시스템 자체 책임 — 별 plan |
| W2 | requirement | plan 영향 영역 vs 코드 | plan 본문이 `executeInline`/`executeSync`/`executeAsync` 변경 의도 시사한다고 reviewer 해석 | **부정확 해석** — plan 의 "영향 영역" 절은 변경 파일 리스트일 뿐. `HooksService.handleChatChannelWebhook` 가 `execute()` 만 호출 (검증). plan 본문이 코드와 일치 |
| W3 | architecture (cross) | `spec/5-system/15-chat-channel.md §3.2 / CCH-AD-05` | "NotificationDispatcher EventEmitter" 표현이 실제 `WebsocketService.executionEvents$` 와 괴리 (consistency-check I1 와 동일 항목) | **follow-up** — spec 표현 정정은 별 PR 책임. 본 PR 의 코드 동작은 spec implicit 의도와 정합 |
| W4 | architecture | `ExecutionRoutingContext` export 위치 | infrastructure layer 의 타입을 execution-engine 가 import (역방향 의존) | **유지** — register API 의 입력 타입은 API 정의 위치 (WebsocketService) 가 적합. 장기 리팩터링 시 재고 |
| W5 | architecture | `WebsocketService` 2 Map (`seqCounters` + `executionRouting`) 동기화 | 두 Map 의 lifecycle 페어가 코드 여러 곳에 분산 | **follow-up** — 현 동작 정확. 통합 리팩터링은 별 PR (관련 follow-up plan 후보) |
| W6 | maintainability | `openServer` 반환 계약 | throw / null sentinel 혼용 — JSDoc 부재 시 비직관적 | **즉시 fix** — JSDoc 보강 (RESOLUTION fix #1) |
| W7 | testing | `execution-engine.service.spec.ts` mock | `registerExecutionRouting` / `releaseExecutionRouting` mock 의 `mockClear()` 누락 | **즉시 fix** — beforeEach 보강 (RESOLUTION fix #2) |
| W8 | maintainability | `execute().catch` 블록 release | release 의 페어 관계 주석 부재 | **즉시 fix** — pair 주석 추가 (RESOLUTION fix #3) |

---

## INFO (15건)

| # | Category | 위치 | 내용 | 본 PR 처리 |
|---|----------|------|------|----------|
| I1 | security | `extractChatChannelFromInput` | raw 객체 통과 — CREDENTIAL_KEY_PATTERN 공백 (bot_token / signing_secret 등) | **부분 fix** — JSDoc 정정 (I13 과 함께), 패턴 보강은 별 PR (security pattern audit 범위) |
| I2 | performance | `attachRoutingContext` sanitize 재호출 | emit 마다 sanitize → register 시점 pre-compute 권장 | **follow-up** — long-running AI Agent 최적화 별 plan |
| I3 | architecture | `ExecutionEventEmitter` facade 의 register/release | "이벤트 발행" facade 범위를 약간 벗어남 | **즉시 fix** — JSDoc 에 facade 범위 제약 명시 (RESOLUTION fix #4) |
| I4 | testing | WS spec failed/cancelled/waiting_for_input terminal 테스트 누락 | 본 PR 핵심 = AI_MESSAGE 라 가장 중요한 경로 커버. 나머지 terminal 은 spec §6.2 의 동일 패턴 | **유지** — 본 PR 의 9개 spec 으로 핵심 동작 충분 검증 |
| I5 | testing | `emitNodeEvent` 경로 routing 첨부 검증 누락 | `attachRoutingContext` 가 동일 호출 — 코드 path 공유 | **즉시 fix** — 단위 테스트 1개 추가 (RESOLUTION fix #5) |
| I6 | testing | runExecution throw 시 releaseExecutionRouting 호출 assertion 누락 | 안전망 검증 | **즉시 fix** — 단위 테스트 1개 추가 (RESOLUTION fix #6) |
| I7 | testing | extractChatChannelFromInput 빈 문자열 경계값 | 함수 자체에 검증 로직 있음 | **즉시 fix** — 단위 테스트 1개 추가 (RESOLUTION fix #7) |
| I8 | testing | private static logger spy 패턴 취약 | spy 설치 실패 시 assertion 거짓 통과 | **유지** — 본 PR 의 spy 패턴은 통상적, DI logger 전환은 별 PR |
| I9 | security | executionRouting 동일 executionId 재호출 덮어쓰기 | 단일 인스턴스 위험 낮음 | **유지** — 분산 환경 follow-up |
| I10 | architecture | `materializeServer` null 시 inflight 정리 | `.finally` 가 항상 delete 호출 (null/throw 무관) | **검증 완료** — 코드 path 확인. 추가 조치 불필요 |
| I11 | maintainability | execute() 단계 번호 `// 2.5.` | 향후 발산 위험 | **즉시 fix** — 주석 정리 (RESOLUTION fix #8) |
| I12 | maintainability | `ExecutionRoutingContext.chatChannel` 타입이 너무 느슨 | shape 미반영 | **즉시 fix** — named interface 도입 (RESOLUTION fix #9) |
| I13 | documentation | `extractChatChannelFromInput` JSDoc 부정확 | "sub-property 모두 string" 표현 vs 실제는 provider+conversationKey 만 검증 | **즉시 fix** — JSDoc 정정 (RESOLUTION fix #10) |
| I14 | documentation | 테스트 spec 참조 형식 불통일 | 표기법 혼용 | **유지** — 본 PR 외부 컨벤션 사항 |
| I15 | concurrency | fanout payload 미등록 시 wireEnvelope 동일 참조 반환 | 구독자 mutate 시 wire 오염 | **유지** — 현 구독자 read-only. 향후 규약 명시 follow-up |

---

## 즉시 fix 항목 요약 (RESOLUTION 대상)

- fix #1 (W6): `openServer` JSDoc — throw/null 계약 명시
- fix #2 (W7): `execution-engine.service.spec.ts` mockClear 보강
- fix #3 (W8): `execute().catch` release pair 주석
- fix #4 (I3): `ExecutionEventEmitter.register/releaseExecutionRouting` JSDoc 범위 제약
- fix #5 (I5): `emitNodeEvent` routing 첨부 단위 테스트
- fix #6 (I6): runExecution throw → release 호출 assertion 테스트
- fix #7 (I7): `extractChatChannelFromInput` 경계값 단위 테스트
- fix #8 (I11): execute() 단계 번호 정리
- fix #9 (I12): `ExecutionRoutingContext` named chatChannel 타입
- fix #10 (I13): `extractChatChannelFromInput` JSDoc 정정

## Follow-up (별 PR / plan)

- W1: provider 등록 시스템의 diagnostics 책임 정의 — 양쪽 provider 모두 처리 못 한 ref 의 not_capable 진단
- W3: spec §3.2 / CCH-AD-05 / §7 "NotificationDispatcher EventEmitter" 표현 → "WebsocketService.executionEvents$ RxJS Subject" 정정 (project-planner 위임)
- W4: ExecutionRoutingContext 타입 이동 (장기 리팩터링)
- W5: seqCounters + executionRouting 단일 ExecutionSession Map 통합 리팩터링
- I1 / I2 / I8 / I9 / I15: 보안 패턴 보강 / 성능 최적화 / DI logger / 분산 환경 / fanout payload 규약

---

## 라우터 결정

라우터 STATUS=success 반환했으나 `_routing_decision.json` 미생성 → orchestrator 가 fallback (14 reviewer 전수 실행) 으로 진행. router 의 결정 JSON 출력 형식 누락이 원인. router prompt/agent 정의의 별 follow-up 사안.
