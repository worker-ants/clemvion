# Cross-Spec 일관성 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 발견사항

- **[WARNING]** `2-api-convention.md §10.4` 의 "재연결" 요약이 이번 결정으로 더 멀어진다
  - target 위치: 변경안 표(§변경안 — spec 8곳) — §6.1 `:951-962` 예외 명문화(#6), §9.2 `:1042-1050` fallback 추가(#7)
  - 충돌 대상: [`spec/5-system/2-api-convention.md` §10.4](../../../../../spec/5-system/2-api-convention.md) "연결 끊김 시 지수 백오프로 재연결" / "재연결 시 마지막 수신 이벤트 ID 전달 → 놓친 이벤트 재전송"
  - 상세: §10.4 는 이미 6-websocket-protocol.md 의 현재 모델(Socket.IO 내장 backoff, seq 재전송이 아니라 `execution.snapshot`)과 어긋난 서술을 "상세 프로토콜 참조" 한 줄로 방어하고 있다. 이번 draft 는 바로 그 "재연결" 도메인에 **새 예외**(서버발신 `disconnect()` 는 Socket.IO 자동 재연결 대상이 아니고 클라이언트가 `socket.connect()` 를 명시 호출해야 한다)를 §6.1/§9.2 에 공식화한다. §10.4 는 무조건적 "재연결" 문장만 남아 이 예외를 전혀 반영하지 않으므로, §10.4 만 읽는 독자는 `auth.token_expired` 이후에도 자동 재연결이 되는 것으로 오독할 수 있다. target 의 `spec_impact` 는 `6-websocket-protocol.md` 하나뿐이라 이 요약 문서는 손대지 않는다.
  - 제안: §10.4 의 "상세 프로토콜 참조" 캐비엇에 "단, 서버발신 disconnect(`auth.token_expired` 후속)는 예외" 한 줄을 additive 로 얹거나, 최소한 draft Rationale 에 "§10.4 는 기존에도 stale 했고 본 draft 범위 밖" 이라는 명시적 스코프 아웃 문장을 남겨 다음 사람이 "빠뜨렸다" 로 재지적하지 않게 한다.

- **[WARNING]** 명시적 세션 무효화(비번 변경·탈취 의심)는 이 결정이 닫는 "인가 갭" 밖에 남는다
  - target 위치: "## 배경 — 인가 갭이다" / "## 결정" 전체
  - 충돌 대상: [`spec/5-system/1-auth.md`](../../../../../spec/5-system/1-auth.md) §1.4 ("해당 사용자의 활성 refresh token 전체를 즉시 revoke"), §2.3 표 (비밀번호/이메일 변경 시 "**모든 활성 family 를 revoke**"), `token_reuse_detected` ("모든 세션 종료")
  - 상세: target 은 소켓 인가 갭을 "핸드셰이크 이후 토큰 재검증 없음" 으로 정의하고 그 해法을 **토큰의 `exp`** 에만 건다. 그런데 1-auth.md 가 "즉시 종료/즉시 revoke" 라 서술하는 이벤트(비밀번호 변경, 이메일 변경, WebAuthn counter 역행, refresh 재사용 탐지)는 **refresh token family** 를 revoke 할 뿐 이미 발급된 **access token**(그리고 그 access token 으로 붙어 있는 WS 소켓)은 무효화하지 않는다 — 본 draft 의 타이머도 `exp` 만 보므로 이 access token 이 자연 만료(최대 15분)될 때까지 소켓은 계속 살아 있다. 즉 auth.md 가 쓰는 "즉시 종료" 라는 표현과, WS 소켓이 실제로는 최대 15분 더 인가된 채 남는다는 이 draft 의 모델 사이에 **독자가 오해할 여지**가 있다 — "세션 종료" 가 "그 세션이 만든 소켓도 즉시 끊긴다" 를 의미하지 않는다는 점이 어느 문서에도 명시돼 있지 않다.
  - 제안: EIA §R19(`execution_token` 만료 기반 idle-wait 회수)가 스코프를 "익명 위젯 execution 한정" 으로 명문화한 것과 같은 방식으로, 이 draft 의 "구현 메모" 또는 Rationale 에 "명시적 revoke(비번 변경·탈취 의심)는 이 타이머의 관심사가 아니다 — 그 소켓은 여전히 자기 access token 의 자연 `exp` 까지 산다" 는 한 줄을 카브아웃으로 남긴다. (지금 "분산·재시작 내성은 이 타이머의 관심사가 아니다" 카브아웃과 같은 자리에 나란히 적으면 된다.)

- **[INFO]** "60초는 15분 토큰의 4%" 산술 오차
  - target 위치: "### 왜 lead time 인가 · 왜 60초인가" 문단
  - 충돌 대상: [`spec/5-system/1-auth.md`](../../../../../spec/5-system/1-auth.md) §2.1 표 "Access Token | ... | 15분" (= 900초, `auth.module.ts` `expiresIn: 900` 과 정합 확인됨)
  - 상세: 60 / 900 = 6.7%다. "4%" 는 이 15분 값과 정합하지 않는 계산이다. 결정 자체(60초 lead time)에는 영향 없으나, spec 문서에 남는 근거 문장의 산술이 인접 spec(1-auth.md)의 TTL 값과 어긋난다.
  - 제안: "4%" → "약 6.7%" 로 정정하거나 "15분의 1/15" 식 표현으로 바꾼다.

## 요약

target 은 이전 라운드에서 cross_spec 이 잡은 CRITICAL(§6.1/§9.2 재연결 위임과의 직접 모순)을 이미 해소한 상태로 들어왔고, 데이터 모델(access token TTL 900초 = 15분, spec/1-auth.md 와 정합)·요구사항 ID(`R-ws-socket-lifetime-binds-token` 중복 없음)·webchat 채널(내부 `/ws` 미사용, SSE 전용이라 무영향)·EIA 매핑(§4.7, R19 `iext_*`/`execution_token` 은 별개 토큰 계열이라 충돌 없음)·"변경 없음" 판정 3곳(1-data-model.md:300, data-flow/8-notifications.md:347, spec-sync-external-interaction-api-gaps.md:343)까지 전수 재확인했고 모두 draft 의 서술과 일치했다. 남은 것은 CRITICAL 급 직접 모순이 아니라, 이 변경이 건드리는 "재연결" 도메인을 요약해 둔 다른 spec(§10.4)이 새 예외를 반영하지 못한 채 뒤에 남는 문제와, "인가 갭을 닫았다" 는 draft 의 결론이 실은 자연 만료 경로만 닫고 명시적 revoke 경로는 그대로 열어 둔다는 스코프 누락 두 건(WARNING)이다.

## 위험도

LOW
