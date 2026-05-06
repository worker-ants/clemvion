# Code Review 조치 (RESOLUTION)

## 본 PR 의 범위

`refactor(ai-agent): toolNodeIds/toolOverrides feature out — schema 숨김 + 핸들러 무시` (`83ea538c`)

목표: AI Agent 노드의 **도구 연결 입력 경로**(`toolNodeIds`, `toolOverrides`) 를 일시 비활성. 사용자가 명시한 "도구 연결은 나중에 다시 정리해서 재작성"의 사전 단계. 핸들러 전체 리팩토링·신규 기능·기존 결함 보강은 본 PR 의 목표가 아니다.

리뷰 발견사항을 다음 3 가지로 분류해 처리한다:

- **(A) 본 PR 에서 조치** — feature-out 변경 자체에서 파생되거나 직접 관련된 항목
- **(B) 재작성 plan 의 backlog 로 이관** — 도구 연결 재작성 시 함께 다뤄야 자연스러운 항목 (`plan/in-progress/ai-agent-tool-connection-rewrite.md`)
- **(C) 별도 PR 필요** — 본 변경과 무관한 광범위 기존 결함. 단일 feature-out PR 안에서 처리하면 사용자 의도와 충돌하고 PR 의 단위성을 깬다

---

## (A) 본 PR 에서 조치한 항목

| 발견사항 | 위치 | 조치 |
|---------|------|------|
| INFO #1 — `normalTools` 가 feature-out 으로 도달 불가한 dead code | `handler.ts:1340–1352` | `.map()` 변환 블록 제거하고 `const normalTools: ToolDef[] = []` 로 명시. `toolNodeIds`/`toolOverrides` 로컬 변수도 함께 제거. `toolName()` 헬퍼는 underscore prefix(`_toolName`) 로 변경하여 재작성 시 복원 용이성 유지 + lint 통과 |
| INFO #15 — `turnConfig` 에 feature-out 된 `toolNodeIds`/`toolOverrides` 가 여전히 전달됨 | `handler.ts:836–844` | `turnConfig` 에서 두 키 제거. state 자체에는 빈 배열로 보존(다중 배포 환경에서 이전 state shape 와의 호환을 위해). 사유 주석 추가 |

추가 수정:

- `handler.ts:1313–1319` 의 로컬 빈 배열 선언 제거. `normalTools = []` 로 직접 표현하여 의도 명확화 (검토 의견 INFO #1 의 본 취지 반영)

위 조치 후 backend lint·unit(167 suite, 297/300 AI suite, 3 skipped feature-out)·build 모두 green.

---

## (B) 재작성 plan 으로 이관한 항목

`plan/in-progress/ai-agent-tool-connection-rewrite.md` 의 "재작성 시 함께 검토할 backlog" 섹션에 추가. 도구 연결 재작성과 직접 맞물려 다루는 것이 정합적인 항목들이다.

| # | 카테고리 | 발견사항 | 이관 사유 |
|---|---------|---------|----------|
| WARN #9 | Architecture / Maintainability | `executeSingleTurn` 과 `processMultiTurnMessageInner` 의 tool loop ~130줄 구조적 중복 | 도구 입력 경로 재설계 시 `runToolLoop` 추출 자연스러움. 본 PR 에서 추출하면 곧 폐기·변경될 영역에 churn |
| WARN #11 | Architecture | `_resumeState: { ...state, ... }` 스프레드로 미지 필드 암묵 전파 | feature-out 시 노출된 결함. state 타입 명시화는 도구 connection 재작성과 같이 가는 게 정합적 |
| WARN #20 | Testing | single_turn(미증가) vs multi_turn(증가) 의 `toolCallCount` 정책 비대칭 미테스트 | 도구 호출 카운팅 정책 자체가 재작성 시 재정립 대상 |
| INFO #5 | Requirement | `endReason: 'out' as const` 가 multi_turn endReason 유니온에 미포함 | multi_turn 종료 사유 정합 — 재작성 함께 |
| INFO #15 (이관 부분) | Scope | feature-out 잔재 정리는 재작성 PR 에서 완전 정리 | 본 PR 에서 1차 정리, 재작성 시 2차 정리 |

`plan/in-progress/ai-agent-tool-connection-rewrite.md` 에 backlog 섹션을 추가하여 누락 방지.

---

## (C) 별도 PR 로 유도하는 항목

feature-out 과 무관하고 광범위한 기존 결함. 단일 PR 에서 모두 다루면 사용자 의도(feature-out → 나중 재작성)와 충돌하며, 각 항목이 자체적으로 설계 결정·테스트 보강을 요구한다. 별도 PR 로 진행하기 위해 본 RESOLUTION 에 명시.

### 즉시 별도 PR 권장 (우선순위 높음)

| # | 카테고리 | 발견사항 | 별도 PR 사유 |
|---|---------|---------|-------------|
| CRIT #1 | Testing | `endMultiTurnConversation` 메서드 테스트 전무 | 4가지 endReason × 경계값 시나리오 테스트 보강은 자체 PR 가치 |
| CRIT #2 | Documentation / API Contract | `aiAgentNodeOutputSchema` 주석 / 필드명(`metadata`) 가 실제 출력 구조 (`output.result.*` / `meta`) 와 불일치 | 프론트 자동완성에 직접 영향. 스키마-실제 정합 PR 단독 |
| WARN #1 | Requirement / Side Effect | `buildConditionOutput` 이 `executeSingleTurn` 경로에서도 `config.mode: 'multi_turn'` 하드코딩 | 단일 turn 조건 라우팅 mode 오염 — 명백한 버그 fix PR |
| WARN #2 | Requirement | `conversationHistory` UI 노출 / 핸들러 미구현 silent gap | 구현 PR 또는 hidden 처리 PR 어느 쪽이든 자체 결정 필요 |
| WARN #4 | Security | `workspaceId` falsy 시 `''` fail-open | fail-closed 변경은 회귀 영향 검토 필요 (테스트 케이스 광범위) |
| WARN #5 | Security | `maxToolCalls` / `maxTurns` 상한 부재 | 운영 비용 정책 결정 필요 — `project-planner` 영역과 맞닿음 |

### 중기 (성능 / 아키텍처)

| # | 카테고리 | 발견사항 | 별도 PR 사유 |
|---|---------|---------|-------------|
| WARN #6 | Security | Condition prompt 미이스케이프 — 워크플로 작성자의 prompt injection 가능 | 신뢰 경계 정책 결정 필요 (`project-planner`) |
| WARN #7 | Security | `tool_call_started` WS 이벤트의 raw arguments 길이 제한 미적용 | WS 이벤트 표면적 PR |
| WARN #8 | Security | `aiAgentNodeConfigSchema.passthrough()` | 화이트리스트 정책 결정 필요 |
| WARN #10 | Architecture | `ConditionDef` SSOT 위반 (handler interface vs schema z.infer) | 단순 정리 PR |
| WARN #13 | Architecture | `AiAgentHandler` 1,370줄 God Object | `project-planner` 와 함께 설계 후 분할 |
| WARN #14 | Architecture | `WebsocketService` 직접 의존 (DIP 위반) | 어댑터 도입 PR |
| WARN #15 / #16 | Performance | KB 도구 / provider buildTools 순차 처리 | `Promise.all` 병렬화 PR (벤치마크 동반) |
| WARN #17 | Performance | `condNameToCondition` Map 매 이터레이션 재구성 | tool loop 추출과 함께 (B 의 WARN #9 와 같이) |
| WARN #18 | Requirement | `conditions` 중복 ID 미검증 | 스키마 validate 강화 PR |
| WARN #19 | Requirement | `maxToolCalls` 도달 후 `response: null` 반환 가능 | fallback 정책 결정 후 PR |
| WARN #21 | Testing | Provider `buildTools` 예외 시 동작 미테스트 | 테스트 추가 PR |
| WARN #22 | Testing | `adaptHandlerReturn` 회귀 테스트 부분 커버 | 테스트 추가 PR |
| WARN #23 | Testing | 단일 `it` 에서 `handler.execute` 2회 + 비독립 assertion | 리팩토링 PR |
| WARN #24 | Concurrency | MCP provider 세션 동시성 위험 | per-request factory 도입 PR (설계 검토) |

### INFO 항목 — 별도 정리 PR 일괄 처리

INFO #2 (`indexOf` Map 동시 저장), #3 (`[...messages]` 스프레드), #4 (`turnDebugHistory` 스프레드), #6 (`ragThreshold/ragTopK` 범위), #7 (userMessage 길이 검증), #8 (`getSources` 참조 노출), #9–#13 (Documentation), #14 (Maintainability — 테스트 픽스처).

---

## 요약

- **본 PR 조치**: INFO #1 + INFO #15 — feature-out 코드 명료화. `normalTools = []` 직접 표현, `turnConfig` 에서 누설 제거, `toolName` → `_toolName` 으로 lint-safe 보존
- **재작성 plan 이관 (B)**: 5건 — `ai-agent-tool-connection-rewrite.md` 에 backlog 추가
- **별도 PR 유도 (C)**: 25건 — 카테고리·우선순위 명시. 본 RESOLUTION 이 인덱스 역할

본 PR 의 단위성을 보존하기 위해 (C) 항목을 일괄 처리하지 않는다. 사용자가 명시한 "도구 연결은 나중에 다시 정리해서 재작성" 방향과 정합한다.
