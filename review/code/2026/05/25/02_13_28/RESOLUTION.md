# RESOLUTION — fix-chat-channel-dispatcher-and-cafe24-warn

세션: `review/code/2026/05/25/02_13_28/`

## 조치 항목

| # | SUMMARY 항목 | 조치 | commit |
|---|---|---|---|
| 1 | W6 — `openServer` JSDoc throw/null 계약 부재 | JSDoc 보강 (반환 계약 3분기 명시) | (예정 — refactor commit) |
| 2 | I3 — `ExecutionEventEmitter` register/release facade 범위 노트 | JSDoc 에 "facade 범위 노트" 단락 추가 | (동일 commit) |
| 3 | W8 — `execute().catch` release pair 주석 부재 | catch 블록에 pair: WS terminal 분기 ↔ catch 안전망 명시 | (동일 commit) |
| 4 | I11 — `execute()` 단계 번호 `// 2.5.` | 1/2/3/4 정수 번호로 재정렬 | (동일 commit) |
| 5 | I12 — `ExecutionRoutingContext.chatChannel` 타입 너무 느슨 | `ChatChannelRoutingInfo` named interface 도입 (provider/conversationKey 필수, channelUserKey 선택, index signature) + `extractChatChannelFromInput` 반환 타입 좁힘 | (동일 commit) |
| 6 | I13 — `extractChatChannelFromInput` JSDoc 부정확 | "필수 두 필드만 검증, 나머지는 통과" 로 정정 | (동일 commit) |
| 7 | mcp-tool-provider `inflight` 필드 주석 보강 | null sentinel 동작 + 누수 없음 명시 | (동일 commit) |
| 8 | I5 — `emitNodeEvent` routing 첨부 검증 누락 | WebsocketService spec 에 1 테스트 추가 | (동일 commit) |
| 9 | I7 — `extractChatChannelFromInput` 경계값 미검증 | engine spec 에 2 테스트 추가 (provider 빈 string / conversationKey 빈 string) | (동일 commit) |
| 10 | I6 — runExecution throw 시 release 호출 assertion | engine spec 에 1 테스트 추가 (runExecution spy reject + .catch → release 호출 검증) | (동일 commit) |

### 검토 결과 미적용 항목 (정당화)

| # | SUMMARY 항목 | 미적용 사유 |
|---|---|---|
| W2 | plan vs 코드 executeInline/Sync/Async 경로 불일치 | plan 의 "영향 영역" 절은 변경 파일 리스트일 뿐. `HooksService.handleChatChannelWebhook` 가 `execute()` 만 호출하므로 코드와 plan 본문 일치. reviewer 의 해석 오류 |
| W7 | mock `mockClear()` 누락 | spec 의 `beforeEach` 가 매 it 마다 `Test.createTestingModule(...).compile()` 으로 새 mock 객체 생성 (line 222). 기존 emit mock 도 `mockClear()` 없이 동작 — TestingModule 재생성 격리가 spec 의 default 패턴. `mockClear` 추가는 불필요 |
| I4 | failed/cancelled/waiting_for_input terminal 테스트 누락 | AI_MESSAGE 가 본 PR 의 핵심 경로 — 가장 중요한 emit 종류 커버. `attachRoutingContext` 는 emit 종류에 무관한 단일 코드 path, terminal release 도 `TERMINAL_EXECUTION_EVENTS` set 기준으로 일괄 적용 (이미 다른 spec 으로 검증됨) |
| I8 | private static logger spy 패턴 취약 | 일반적인 NestJS Logger spy 패턴. spy 설치 실패는 `mockImplementation` returning undefined 가 던지므로 silent false-positive 위험 낮음. DI logger 전환은 별 리팩터링 |
| I14 | 테스트 spec 참조 형식 불통일 | 본 PR 외부의 컨벤션 사항. 기존 spec 들도 표기법 혼용 — 본 PR 에서 통일 시도하면 scope creep |

### Follow-up plan 으로 이관

| # | 항목 | 위임 대상 |
|---|---|---|
| W1 | `not_capable` skipReason 의 serverSummaries push 책임 — 양쪽 provider 모두 처리 못 한 ref 의 diagnostics 누락 문제 | 신규 plan: provider 등록 시스템의 diagnostics 책임 정의 |
| W3 | spec/5-system/15-chat-channel.md §3.1 CCH-AD-05 / §3.2 / §7 의 "NotificationDispatcher EventEmitter" 표현 → "WebsocketService.executionEvents$ RxJS Subject" 정정 | project-planner 위임 (consistency-check I1 와 동일 항목) |
| W4 | `ExecutionRoutingContext` 타입 이동 (infra → engine layer) | 장기 리팩터링 plan |
| W5 | `seqCounters` + `executionRouting` 단일 `ExecutionSession` Map 통합 | 리팩터링 plan |
| I1 | `CREDENTIAL_KEY_PATTERN` 보강 (`bot_token`/`signing_secret`/`webhook_secret`/`bearer`/`credential`/`passphrase`/`pem` 추가) | 보안 패턴 audit 별 PR |
| I2 | `attachRoutingContext` 의 chatChannel sanitize pre-compute (register 시 1회) | 성능 최적화 별 PR (long-running AI Agent) |
| I9 | `executionRouting` Map atomic set-if-absent (분산 환경) | 멀티 인스턴스 follow-up |
| I15 | fanout payload 미등록 시 wireEnvelope 동일 참조 반환 — 구독자 mutate 규약 명시 | 규약 명시 별 PR |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | 통과 (`stage=lint status=PASS duration=26s`) — 본 fix 와 무관한 기존 41 warnings (0 errors) 만 잔존 |
| unit | 통과 (`stage=unit status=PASS duration=25s tests=4753 passed`) — 본 PR 추가 spec 14개 (WebsocketService routing 10, engine register 6) 포함 |
| build | 통과 (`stage=build status=PASS duration=39s`) — backend + frontend nest/next + docker 검증 모두 PASS |
| e2e | 통과 (REVIEW WORKFLOW 후 재실행: `stage=e2e status=PASS duration=44s tests=119 passed`) — review 적용 코드 변경분도 검증 완료 |

## 보류·후속 항목

위 표 "Follow-up plan 으로 이관" 8건은 본 PR 머지 후 별 PR/plan 으로 추적. 본 PR 의 핵심 회귀 fix (Issue 1 outbound 발송 + Issue 2 WARN 노이즈) 와 직교한 사항.
