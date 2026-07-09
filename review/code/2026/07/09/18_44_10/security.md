# 보안(Security) 코드 리뷰 결과

> 대상: `webchat-session-history-0e9639` 워크트리 변경분 — EIA `getStatus()` durable `conversationThread`
> REST 노출(백엔드) + 웹채팅 위젯 헤더 세션 컨트롤(새 대화/대화 종료) + `roleOf` source→role 매핑 정정(프런트).

## 발견사항

- **[INFO]** durable `conversationThread` REST 노출은 "노드 핸들러가 민감정보를 안 남긴다"는 컨벤션에만 의존(런타임 강제 없음)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` (라인 ~221-233 JSDoc, ~256-307 구현), `Execution.conversation_thread` (jsonb)
  - 상세: 이번 변경으로 `waiting_for_input` 상태의 execution 은 `context.conversationThread` 를 통해 **durable** 대화 히스토리 전체를 REST 단발 조회로도 노출한다. JSDoc 은 "이미 SSE `waiting_for_input` 으로 공개 중인 데이터라 신규 민감 표면이 아니다"라고 명시하는데, 이는 정확하다 — 노출 여부 자체는 회귀가 아니다. 다만 이 안전성은 순전히 **문서화된 컨벤션**("노드 핸들러는 conversation turn 텍스트에 API 키·PII 를 기록하면 안 된다")에만 의존하고, `conversation_thread` 를 쓰는 시점이나 `getStatus`/SSE 가 반환하는 시점에 서버 측 검증·redaction 레이어가 없다. 이번 diff 로 이 데이터의 **노출 시간창이 "SSE 구독 중" 에서 "waiting_for_input 지속되는 동안 언제든 REST 재조회 가능"으로 확장**된 것은 사실이므로, 컨벤션 위반(노드 핸들러 버그·프롬프트 인젝션으로 LLM 이 민감정보를 turn 텍스트에 반영하는 등) 이 발생했을 때의 노출 창구·재현성이 넓어진다.
  - 제안: 필수 차단 사유는 아니나, 방어심화(defense-in-depth) 관점에서 conversation turn 저장/노출 경로에 최소한의 allowlist 기반 필드 검증이나 명백한 시크릿 패턴(API 키 형태 등) 스캔을 추가하는 백로그를 고려할 것. 현재는 리스크 수용(문서화된 컨벤션)으로 충분히 판단됨.

- **[INFO]** 헤더 "새 대화" 반복 사용 시 고아 `waiting_for_input` Execution 누적 가능 (자원 소진 관점)
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` (새 대화/대화 종료 헤더 버튼), `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat`/`endConversation`
  - 상세: 신규 헤더 "새 대화" 컨트롤은 진행 중 대화(booting/streaming/awaiting_user_message)에서도 **이전 execution 에 종료 명령을 보내지 않고** 새 `POST /api/hooks/:path` 로 신규 execution 을 시작한다(스펙에도 명시됨). 실행 엔진은 `waiting_for_input` execution 을 TTL 없이 무기한 DB 보존하므로, 익명·공개 위젯 사용자가 확인 다이얼로그를 반복 확정해 "새 대화"를 다회 클릭하면 매번 고아 `waiting_for_input` Execution/NodeExecution row 가 하나씩 영구히 남는다. 이는 이미 `review/consistency/.../cross_spec.md` WARNING#1 로 스펙 표현 정밀도 관점에서 지적됐으나, 보안(가용성) 관점에서도 저위험 자원 소진(OWASP A04 Insecure Design 인접) 벡터로 볼 수 있다. 완화 요인: (1) webhook 트리거 자체에 rate-limit + origin 검증이 이미 걸려 있음(`3-auth-session.md` §1), (2) confirm 다이얼로그가 자동화 스크립트가 아닌 사람의 클릭을 요구, (3) 익명 위젯 특성상 이 패턴은 "새 대화" 버튼 없이도 페이지 새로고침/재open 반복만으로도 이미 존재했던 리스크(이번 PR 이 신규로 만든 취약점은 아니고, 사용자에게 더 쉬운 트리거를 제공한 것).
  - 제안: 필수 차단 사유는 아님. 후속 백로그로 (a) 오래 방치된 `waiting_for_input` Execution 에 대한 배치 GC/아카이브 정책, 또는 (b) "새 대화" 클릭 시에도 이전 execution 에 대해 best-effort `cancel` 을 함께 보내는 방안(단, 그 경우 스펙이 명시한 "명시 종료 없이 잔존" 의도와 충돌하므로 planner 결정 필요)을 검토할 것.

- **[INFO]** `endConversation` 실패 시 `console.warn` 에 원본 에러 메시지 노출 — 낮은 위험
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` (`endConversation` catch 블록, `e instanceof Error ? e.message : String(e)`)
  - 상세: 브라우저 devtools console 에만 기록되며(서버 로그·외부 전송 없음), 접근 가능한 주체는 이미 그 브라우저 세션을 제어하는 본인뿐이라 정보 노출 실익이 없다. 기존 프로젝트 관례(백엔드 로그와 달리 프런트 `console.warn` 은 낮은 리스크로 취급)와 일치.
  - 제안: 조치 불필요.

## 점검했으나 이슈 없음 (참고)

- **XSS**: 메시지 텍스트(`m.text`)는 React JSX 텍스트 노드로 렌더되어 자동 이스케이프됨(`dangerouslySetInnerHTML` 미사용). `data-source={m.source}`/`className={`wc-${m.role}`}` 는 타입으로 제한된 값(`"user"|"assistant"`, `TurnSource` 유니온)만 흘러 속성 인젝션 경로 없음. 위젯의 유일한 `dangerouslySetInnerHTML` 사용처(`presentations.tsx` `TemplateView`)는 이번 diff 범위 밖이며 기존에 DOMPurify 기반 `renderTemplateHtml` 새니타이즈를 거치는 것을 확인함 — 이번 durable `conversationThread` 노출로 새로운 미새니타이즈 HTML 렌더 경로가 열리지 않음(plan 상 presentation shape 매핑은 명시적으로 후속 과제로 defer됨).
- **인증/인가**: `getStatus()` 는 변경 전과 동일하게 `InteractionGuard` 가 검증한 `ctx.executionId` 로만 조회하며, 신규로 추가된 `conversationThread` 도 동일 execution 범위 내 데이터라 교차 테넌트/교차 세션 노출 없음. REST 신규 노출분은 이미 같은 토큰으로 SSE 를 통해 노출되던 데이터와 동일 신뢰 경계.
- **하드코딩 시크릿**: 테스트 픽스처(`DURABLE_THREAD` 등)·설정값(`apiBase: "https://api.test"`)에 실제 자격증명 없음.
- **인젝션(SQL/커맨드/경로탐색)**: 이번 diff 는 ORM(`findOne(where:...)`) 파라미터 바인딩만 사용, 원시 쿼리·쉘 호출·파일 경로 조작 없음.
- **암호화/평문전송**: 변경 없음(토큰 발급/전송 로직 비변경).
- **에러 처리(백엔드)**: `getStatus()` 에러 경로(`NotFoundException` 등) 비변경, 스택트레이스·내부 경로 노출 없음.
- **의존성**: 신규 의존성 추가 없음.

## 요약

이번 변경은 (1) 백엔드 `InteractionService.getStatus()` 가 이미 SSE `waiting_for_input` 으로 공개되던 durable `conversationThread` 를 REST 단발 조회에도 동일 신뢰 경계·동일 execution 스코프로 노출하고, (2) 프런트 위젯이 백엔드 실제 wire source(5값)를 올바른 user/assistant role 로 매핑하도록 정정하며, (3) 위젯 헤더에 "새 대화"/"대화 종료" 세션 컨트롤과 가벼운 confirm UI 를 추가한 것이다. 신규 인증 우회·인젝션·시크릿 하드코딩·안전하지 않은 암호화는 발견되지 않았다. React 의 기본 이스케이프와 execution 스코프 유지로 XSS·교차 세션 노출 벡터도 없다. 유일하게 주목할 점은 모두 CRITICAL/WARNING 이 아닌 INFO 수준으로, (a) durable 데이터 노출이 컨벤션에만 의존하는 점(방어심화 여지), (b) "새 대화" 반복 사용이 고아 `waiting_for_input` row 누적을 통한 저위험 자원 소진 벡터가 될 수 있는 점(이미 스펙 레벨 WARNING 으로 별도 추적 중)이다. 둘 다 이번 PR 이 신규로 만든 취약점이라기보다 기존 신뢰 모델의 표면 확장/트리거 편의성 증가에 가깝다.

## 위험도

LOW
