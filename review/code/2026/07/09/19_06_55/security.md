# 보안(Security) 코드 리뷰 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + 새로고침 히스토리 복원.
> 핵심 변경: 백엔드 `InteractionService.getStatus()` 가 durable `Execution.conversation_thread` 를
> `context.conversationThread` 로 REST 단발 조회에도 동봉(EIA §R17 재조정), 프런트 위젯 `roleOf` 가
> 백엔드 wire 5-source 를 user/assistant role 로 매핑, 위젯 헤더에 "새 대화"/"대화 종료" 컨트롤 + 가벼운
> confirm UI + `endConversation` 액션(기존 `InteractCommand` 재사용) 추가. `review/code/2026/07/09/18_44_10/*`
> 및 `review/consistency/2026/07/09/18_27_06/*` 는 이번 changeset 에 포함된 이전 리뷰 라운드 산출물(신규
> 커밋된 리포트 파일)이며 자체는 실행 코드가 아니라 보안 분석 대상에서 제외했다(내용은 교차 검증용으로 참고).

## 발견사항

- **[INFO]** durable `conversationThread` 의 REST 노출 시간창 확장 — 런타임 강제 없는 컨벤션 의존
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` (JSDoc
    ~224-233행, 구현 ~256-311행)
  - 상세: `waiting_for_input` execution 은 이제 `GET /api/external/executions/:id` 단발 재조회만으로도
    durable 대화 히스토리 전체(`Execution.conversation_thread`, 최대 500 turns)를 반환한다. 노출되는 데이터
    자체는 이미 SSE `waiting_for_input` 로 같은 신뢰 경계(execution-scoped bearer 토큰) 안에서 공개되던
    것이라 신규 인가 우회는 아니다. 다만 안전성이 "노드 핸들러/LLM 이 turn 텍스트에 API 키·PII 를 기록하지
    않는다"는 순수 문서 컨벤션에만 의존하고, 서버 측 redaction/allowlist 검증 레이어는 없다. 이번 변경으로
    노출 경로가 "SSE 구독 중" 한정에서 "waiting_for_input 지속되는 동안 언제든 REST 재조회 가능"으로 넓어져,
    향후 컨벤션 위반(핸들러 버그, 프롬프트 인젝션으로 LLM 이 민감정보를 turn 에 반영하는 등)이 실제 발생했을
    때의 노출 재현성·시간창이 커진다.
  - 제안: 즉시 차단 사유는 아님(기존 신뢰 모델의 합리적 연장). 방어심화 백로그로 conversation turn
    저장/노출 경로에 명백한 시크릿 패턴(API 키 형태 등) 스캔이나 필드 allowlist 검증을 고려할 것 — 이미
    RESOLUTION.md 에 defer 로 기록돼 있음.

- **[INFO]** "새 대화" 반복 클릭 → 이전 세션 토큰이 살아있는 동안 durable 히스토리 지속 접근 가능(가용성/기밀성 인접)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat()`/`resetSessionRefs()`,
    `codebase/backend/.../interaction.service.ts` `getStatus()`
  - 상세: "새 대화"는 이전 execution 에 명시적 종료 명령을 보내지 않고(CHANGELOG·plan 에 의도적으로 명시)
    새 execution 만 시작한다. 이전 execution 은 `waiting_for_input` 상태로 서버에 잔존하며, 그 execution 의
    `per_execution` 토큰이 TTL/idle 만료 전까지는(위젯이 그 토큰을 더는 참조하지 않더라도) 여전히 유효해
    `getStatus`/`interact` 호출 시 durable `conversationThread` 를 계속 반환한다. 토큰을 탈취·재사용할 수 있는
    주체(예: 공유 기기의 잔여 sessionStorage, 네트워크 로그, XSS)가 있다면 사용자가 "새 대화"로 넘어간 뒤에도
    구 대화 이력을 일정 시간 계속 열람할 수 있다. 이는 이번 diff 가 새로 만든 취약점이 아니라 기존 토큰
    라이프사이클(TTL/idle 만료)의 고유 특성이며, 자원 소진 관점의 고아 row 누적 이슈로 이미 이전 리뷰
    라운드(INFO)와 spec WARNING 으로 추적 중이다.
  - 제안: 즉시 조치 불필요. 백로그로 (a) "새 대화" 클릭 시 이전 execution 에 best-effort `cancel`(토큰
    즉시 invalidate 포함) 동시 발사 여부를 planner 결정, 또는 (b) idle 세션 GC 정책 검토.

- **[INFO]** `endConversation` 실패 시 원본 에러 메시지가 브라우저 콘솔에 노출
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `endConversation` catch 블록
    (`console.warn(..., e instanceof Error ? e.message : String(e))`)
  - 상세: 서버 로그나 외부 전송 없이 브라우저 devtools console 에만 기록되고, 접근 가능한 주체는 이미 그
    브라우저 세션을 제어하는 사용자 본인뿐이라 실질적 정보 노출 실익이 없다. 프로젝트 관례(백엔드 로그와 달리
    프런트 `console.warn` 은 저위험으로 취급)와 일치.
  - 제안: 조치 불필요.

## 점검했으나 이슈 없음 (참고)

- **인증/인가**: `getStatus()` 는 변경 전과 동일하게 `InteractionGuard` 가 검증한 execution-scoped bearer
  토큰(`ctx.executionId`)으로만 조회한다(`interaction.guard.ts` 확인). 신규 `conversationThread` 필드도 그
  execution 범위 내부 데이터라 교차 테넌트/교차 세션 노출 경로가 없다. `endConversation`/`cancel` 도 기존
  `client.interact(session.endpoints, session.token, command)` 를 그대로 재사용해 신규 인가 우회 표면이 없다.
- **XSS/인젝션**: 위젯 메시지 텍스트는 JSX 텍스트 노드로 렌더되어 React 가 자동 이스케이프한다
  (`panel.tsx` 는 `dangerouslySetInnerHTML` 미사용). 유일한 raw-HTML 렌더 경로(`presentations.tsx`
  `TemplateView`)는 이번 diff 범위 밖이며 DOMPurify 기반 새니타이저를 그대로 거친다 — durable
  `conversationThread` 노출로 새 미새니타이즈 경로가 열리지 않았다(plan 에 presentation shape 매핑은 명시적
  후속 과제로 defer). 백엔드는 ORM 파라미터 바인딩(`findOne({ where })`)만 사용하고 원시 SQL·쉘 호출·파일
  경로 조작이 없다.
- **하드코딩 시크릿**: 테스트 픽스처(`DURABLE_THREAD`, `iext_x`, `apiBase: "https://api.test"` 등)에 실제
  자격증명·API 키 없음. 코드 전체 diff 를 시크릿 패턴(`api[_-]?key|secret|password|Bearer ...|BEGIN
  PRIVATE`)으로 스캔한 결과 매치 없음.
- **입력 검증**: 새 UI 컨트롤은 신규 사용자 입력 필드를 도입하지 않는다(버튼 클릭 → 고정 커맨드 literal).
  `state.pending?.nodeId` 는 서버가 이전에 내려준 신뢰된 상태에서 파생되며 사용자가 직접 입력할 수 없다.
- **암호화/평문 전송**: 토큰 발급·전송 로직 비변경. 전송 채널(HTTPS)·토큰 형식 변경 없음.
- **에러 처리(백엔드)**: `getStatus()` 에러 경로(`NotFoundException` 등) 비변경, 스택트레이스·내부 경로·DB
  세부사항 노출 없음.
- **의존성 보안**: 신규 npm 패키지 추가 없음(diff 는 기존 모듈 내부 로직 변경뿐).
- **CSRF/클릭재킹**: "대화 종료"·"새 대화"는 파괴적 동작이지만 신규로 2단계 인라인 confirm 을 추가해 오조작을
  완화했고, 인증은 쿠키가 아닌 Authorization 헤더 기반 bearer 토큰이라 전통적 CSRF(ambient credential 자동
  전송) 벡터에 해당하지 않는다.

## 요약

이번 변경은 (1) 이미 SSE 로 공개되던 durable 대화 히스토리를 REST 단발 조회에도 동일 신뢰 경계(execution-scoped
토큰)로 노출하고, (2) 위젯이 백엔드 실제 wire source 를 올바른 user/assistant role 로 매핑하도록 정정하며,
(3) 헤더에 파괴적 동작 2종(새 대화/대화 종료)을 confirm UI 와 함께 추가한 것이다. 신규 인증 우회, 인젝션,
하드코딩 시크릿, 안전하지 않은 암호화/평문 전송, 민감정보 에러 노출은 발견되지 않았다. XSS 는 React 기본
이스케이프로 방어되고, 새 API 표면(`conversationThread`)도 기존 SSE 신뢰 경계를 그대로 상속한다. 남은 항목은
모두 INFO 수준으로 (a) durable 데이터 노출이 서버 측 강제가 아닌 컨벤션에만 의존한다는 점, (b) "새 대화"
반복 사용이 만료 전 이전 토큰을 통한 히스토리 지속 열람/고아 row 누적으로 이어질 수 있다는 점이며, 둘 다 이번
PR 이 새로 만든 취약점이라기보다 기존 신뢰 모델·토큰 라이프사이클의 표면 확장/트리거 편의성 증가에 가깝다
(이미 spec/RESOLUTION 에 방어심화 백로그로 추적 중).

## 위험도

LOW
