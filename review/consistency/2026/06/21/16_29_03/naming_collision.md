## 발견사항

- **[WARNING]** `W-6` 식별자 이중 의미 사용
  - target 신규 식별자: `W-6` — `uuid.ts` 주석과 `background-run-channel-authorizer.ts`, `kb-channel-authorizer.ts` 에서 "채널 가드의 비-UUID 입력 DB 쿼리 전 선차단" 의미로 사용
  - 기존 사용처: `spec/4-nodes/2-flow/1-workflow.md` §2·§6 표, `spec/5-system/3-error-handling.md` §1.4, `spec/5-system/4-execution-engine.md` Rationale, `spec/4-nodes/2-flow/0-common.md`, `spec/conventions/chat-channel-adapter.md` — 모두 "sub-workflow cross-workspace 격리 차단 (`assertSameWorkspace` / `WORKFLOW_FORBIDDEN_WORKSPACE`)" 의미. 코드에서도 `execution-engine.service.ts:539`, `workflow-errors.ts:72`, `workflow.handler.ts:101/286`, `error-codes.ts:62/65` 가 같은 의미로 사용
  - 상세: spec 전체에서 W-6 은 "sub-workflow 워크스페이스 격리 fail-closed"를 뜻하는 단일 요구사항 ID 로 고정되어 있다. 이번 구현에서 `uuid.ts` 의 JSDoc 과 두 개의 channel authorizer 파일이 W-6 을 "채널 구독 시 비-UUID 입력 사전 차단"이라는 완전히 다른 보안 제어에 대한 추적 태그로 추가로 사용한다. 리뷰어나 spec 검색 시 W-6 으로 추적하면 혼선이 발생한다. (`continuation-dlq-monitor.config.ts:22` 의 "review W-6"는 코드 리뷰 내부 번호로 보여 scope가 다름.)
  - 제안: 채널 가드 UUID 사전 검증에 대해 `W-6` 대신 별도 태그(예: `WS-UUID-GUARD` 또는 websocket-protocol spec 의 기존 `W-6b` / `W-7` 슬롯)를 부여하거나, 해당 주석의 `(W-6)` 괄호 표기를 제거하고 "비-UUID 입력 차단 (채널 구독 인가 일관성)" 과 같이 서술형으로만 기술한다.

- **[WARNING]** `M-7` 계획 ID 이중 사용
  - target 신규 식별자: `refactor M-7` — `plan/in-progress/refactor/02-architecture.md` §M-7 항목 및 해당 worktree 명(`m7-channel-authorizer-inversion`)에서 "WebsocketGateway authorizer 도메인 역전(forwardRef 3개 제거 + OCP)"을 의미
  - 기존 사용처: `spec/5-system/11-mcp-client.md:140`("refactor 04 M-7 — MCP_ALLOW_INSECURE_URL production fail-closed 부팅 거부"), `spec/5-system/7-llm-client.md:361`("refactor 04 C-1·M-4·M-7"), `spec/5-system/1-auth.md`("refactor 04 C-1·M-4·M-7 — JWT/ENCRYPTION_KEY/MCP 가드"), `plan/in-progress/refactor/README.md:45`("04 M-7: MCP insecure flag, production fail-closed")
  - 상세: `04 M-7`(이미 완료·spec 에 기록됨)은 MCP insecure URL production 부팅 거부 가드이고, 이번 task 의 `M-7`(plan 내부 태그, worktree 명)은 WS authorizer 역전이다. 두 M-7 은 다른 refactor batch(`04` vs `02`)에 속하므로 spec/plan 검색 시 "M-7"만으로 필터링하면 두 항목이 동시에 조회된다.
  - 제안: 현재 태스크를 plan/코드 주석에서 참조할 때 `02 M-7` 로 batch 번호를 포함해 일관성을 확보한다(README.md:62 는 이미 `02 M-7`로 표기하고 있으나 코드 주석의 `refactor M-7`은 batch 번호 없이 기술됨). 또는 `refactor M-7` 대신 `refactor 02 M-7`로 통일한다.

- **[INFO]** `isValidUuid` 함수명 — `UUID_V4_RE` 패턴과의 범위 불일치
  - target 신규 식별자: `isValidUuid` (`codebase/backend/src/common/utils/uuid.ts`) — v1~v5 허용
  - 기존 사용처: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.spec.ts` 의 `UUID_V4_RE` (spec-test 전용, v4 전용 정규식) — 함수가 아닌 테스트-local 상수
  - 상세: `isValidUuid` 는 v1~v5 를 수락하는 반면, 기존 spec 파일 내 일부 표기는 "UUID v4" 로 한정되어 있다. 이름만 보면 "UUID 어떤 버전이든 OK" 인지 혼동 가능하나, `render-tool-provider.spec.ts` 의 상수는 충돌하는 exports 가 아니라 별도 test-local 상수이므로 실제 런타임 충돌은 없다. 다만 `isValidUuid` 를 가져다 쓰는 개발자가 v4 전용인 줄 오해할 수 있으므로 JSDoc 에 "v1–v5 모두 수락" 명시는 이미 되어 있어 충분하다.
  - 제안: 현 상태 유지 가능. 필요 시 함수명을 `isValidUuidV1ToV5` 로 더 구체화하거나 JSDoc 첫 줄에 "UUID v1–v5 (not v4-only)" 를 명시하면 혼선을 완전히 제거할 수 있다.

- **[INFO]** `CHANNEL_AUTHORIZER` Symbol 토큰 신규 도입 — 기존 `CHANNEL_AUTHORIZER` 문자열 토큰 없음 확인
  - target 신규 식별자: `export const CHANNEL_AUTHORIZER = Symbol('CHANNEL_AUTHORIZER')` (`codebase/backend/src/modules/websocket/channel-authorizer.ts`)
  - 기존 사용처: 해당 이름의 기존 DI 토큰, 상수, 환경변수 없음 (전수 검색 확인)
  - 상세: 충돌 없음.

- **[INFO]** 신규 클래스명 (`ExecutionChannelAuthorizer`, `BackgroundRunChannelAuthorizer`, `KbChannelAuthorizer`, `WorkflowChannelAuthorizer`, `NotificationsChannelAuthorizer`) — 기존 충돌 없음
  - 전수 검색 결과, 이 이름들을 이미 사용하는 기존 클래스·인터페이스·DI 프로바이더 없음.

- **[INFO]** 신규 파일 경로 충돌 없음
  - 도입된 모든 파일(`channel-authorizer.ts`, `*-channel-authorizer.ts`)은 각 도메인 모듈 디렉터리 내에 새로 생성되었으며, 기존 파일과 경로 중복 없음.

---

### 요약

이번 변경에서 도입되는 코드 레벨 식별자(클래스명·DI 토큰·함수명·파일 경로)는 기존 코드베이스와 실질적 충돌이 없다. 단, 주석/JSDoc 내 트래킹 태그 `W-6` 을 spec 전반에서 "sub-workflow 워크스페이스 격리"를 의미하는 기존 요구사항 ID 와 동일하게 사용하고 있어, 관리자나 검색자에게 의미 혼동을 야기할 수 있다. 또한 `refactor M-7` 이라는 배치 태그가 이미 완료·spec 기록된 `04 M-7`(MCP insecure URL 가드)과 같은 번호를 공유하므로, 주석에서 배치 번호(`02 M-7`)를 명시해 구분을 명확히 할 것을 권고한다. 런타임·컴파일 타임 충돌은 없으며, 두 WARNING 모두 문서/주석 레벨의 명명 명확화 사안이다.

### 위험도

LOW
