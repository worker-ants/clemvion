# 보안(Security) 리뷰

## 리뷰 범위
- `spec/7-channel-web-chat/3-auth-session.md` §3.1 재로드 복원 시퀀스 갱신
- `spec/conventions/conversation-thread.md` §8.4 Rationale "소비처 갱신" 추가

두 파일 모두 문서(spec) 변경이며, 신규 실행 코드는 포함되지 않는다. 문서가 서술하는 동작(`GET /api/external/executions/:id` 가 `waiting_for_input` 시 durable `context.conversationThread` 전체 히스토리를 REST 로 동봉)은 이미 별도 커밋(`interaction.service.ts`, `interaction.controller.ts`, `interaction.guard.ts`)에 구현되어 있어, 문서-코드 정합성 검증 차원에서 실제 구현도 함께 확인했다.

## 발견사항

- **[INFO]** REST `getStatus` 의 신규 히스토리 동봉은 기존 인증 스코프 안에서 이루어짐 (검증 완료)
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 / `codebase/backend/src/modules/external-interaction/interaction.service.ts:238-312`, `interaction.guard.ts:98-152`
  - 상세: `InteractionGuard` 가 `iext_*` 토큰은 JWT `sub` 와 URL `:executionId` 일치를, `itk_*` 토큰은 execution 의 `triggerId` 매칭을 강제한 뒤에만 `req.interaction` 을 합성하고, `getStatus` 는 그 컨텍스트로만 조회한다. 또한 `conversationThread` 는 `execution.status === WAITING_FOR_INPUT` 일 때만 동봉되고 종료(`completed`/`failed`/`cancelled`) 후에는 `context: null` 로 노출되지 않는다. 문서가 주장하는 "이미 SSE 로 공개 중인 데이터의 REST 재노출 — 신규 민감 표면 아님" 이라는 근거는 실제 인가 로직과 정합한다. IDOR 성 크로스-execution 조회는 확인되지 않았다.
  - 제안: 없음 (확인용 기록).

- **[WARNING]** "turn 텍스트에 민감 정보 금지" 불변식이 자동화된 강제 수단 없이 문서 서술에만 의존
  - 위치: `spec/conventions/conversation-thread.md` §8.4 "소비처 갱신" 문단 — "노드 핸들러는 turn 텍스트에 민감 중간결과를 남기지 않는다는 제약이 그대로 적용된다"
  - 상세: 이 문장이 REST 신규 노출의 안전성 근거로 인용되지만, 저장소 내에 이 불변식을 강제하는 lint/정적분석/유닛테스트는 발견되지 않았다(`grep` 로 관련 스펙 픽스처를 조사했으나 "노드 핸들러 output 에 시크릿·PII 패턴이 없는지" 를 검증하는 전용 가드는 없음). 이번 변경으로 conversation turn 데이터의 노출 경로가 "SSE(연결돼 있어야 관측 가능한 실시간 스트림) 1곳" → "SSE + durable REST 폴링(연결 여부와 무관하게 언제든 재조회 가능) 2곳" 으로 확장되므로, 향후 어떤 노드 핸들러(특히 `ai_tool` turn 의 tool 호출 결과, `includeToolTurns: true` opt-in 경로)가 실수로 민감 데이터를 turn text/data 에 흘리면 파급 범위(재조회 가능 기간·감사 난이도)가 이전보다 커진다.
  - 제안: `renderInteractionText`/`appendInternal` 경로에 대해 (a) 알려진 시크릿 패턴(API 키 포맷, `sk-`/`Bearer `/Authorization 헤더 문자열 등) 스캔 유닛테스트를 추가하거나, (b) 최소한 code-review 체크리스트/consistency-checker 룰에 "신규 노드 핸들러가 conversation thread 에 push 하는 텍스트는 사용자 입력 또는 LLM 응답만이어야 한다"는 항목을 명문화해 회귀 방지선을 둘 것.

- **[INFO]** 탈취된 `iext_*` 토큰의 활용 범위가 "실시간 스트림 관측" 에서 "임의 시점 히스토리 재구성" 으로 확대됨
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1, EIA §5.3/§R17 (참조만, 본 diff 밖)
  - 상세: 종전에는 `iext_*` 토큰이 유출돼도(예: 브라우저 `sessionStorage` 접근 가능한 XSS, `?token=` 쿼리스트링의 프록시/서버 access-log 잔존 등) 공격자가 대화 전체 이력을 얻으려면 SSE 연결이 열려 있는 시점에 붙어 있어야 했다(§R6 이 이미 `sessionStorage`+단명 토큰으로 이 위험을 완화). 이번 변경으로 토큰이 유효한 동안(`waiting_for_input` 지속 중) 언제든 `GET .../:id` 단발 호출만으로 전체 durable 히스토리를 얻을 수 있어, 탈취 토큰의 가치(공격자 관점)가 다소 높아진다. 토큰 자체는 단명(§R6 근거상 만료 有)·execution-scope 로 이미 완화돼 있고 이는 설계상 트레이드오프로 스펙(§R17 근거)에 명시돼 있어 심각도는 낮다.
  - 제안: 현 설계를 바꿀 필요는 없으나, `4-security.md`/EIA 문서에 "토큰 유출 시 REST 히스토리 재조회 가능" 트레이드오프를 명시적으로 기록해 두면 향후 위협 모델링 시 근거 추적이 쉬워진다. (기존 rate-limit `status` 120/min 버킷이 무차별 스크래핑 억제책으로는 이미 존재.)

- **[INFO]** 인젝션/시크릿/암호화 관점은 해당 없음
  - 위치: 두 diff 파일 전체
  - 상세: 순수 산문(prose) 문서 변경으로 SQL/커맨드/XSS 인젝션 벡터, 하드코딩 시크릿, 취약 암호화 알고리즘이 포함되지 않는다.

## 요약

리뷰 대상 diff 는 코드가 아닌 spec 문서 2건으로, 웹채팅 위젯의 새로고침 히스토리 복원을 위해 공개 REST `GET /api/external/executions/:id` 가 `waiting_for_input` 상태에 한해 durable `conversationThread` 스냅샷을 동봉하도록 한 기존 결정(이미 별도 커밋에 구현·테스트됨)을 문서화한 것이다. 실제 구현(`InteractionGuard`, `interaction.service.ts`)을 함께 확인한 결과 토큰-실행 스코프 바인딩·종료 후 미노출·rate-limit 이 정상 적용되어 새로운 IDOR·인증 우회는 발견되지 않았다. 다만 이 노출 경로가 "SSE 순간 관측" 에서 "REST 폴링으로 임의 시점 재조회" 로 확대된 만큼, 그 안전성의 근거로 인용된 "노드 핸들러는 turn 텍스트에 민감정보를 남기지 않는다" 는 불변식이 현재 자동화된 강제 수단 없이 문서 서술에만 의존하고 있어 회귀 방지 장치 보강을 권고한다.

## 위험도
LOW
