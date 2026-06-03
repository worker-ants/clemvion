# Cross-Spec 일관성 검토 결과

> target: `plan/in-progress/spec-draft-channel-web-chat-gaps.md`
> 검토 일시: 2026-06-03

---

## 발견사항

### [INFO] W1 — EIA §5.2 의 버퍼 만료 신호 상태 기술 일치 확인 필요
- **target 위치**: §W1 `1-widget-app.md §3.1` SSE 재연결 절차 문단
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` EIA-IN-07 / EIA-NF-03 / §5.2
- **상세**: target draft 는 "버퍼(5분) 만료 신호 이벤트는 EIA 측 계획·미구현이라 위젯은 시간 기준(>5분)으로 판단한다"고 기술한다. EIA 본문 EIA-IN-07·EIA-NF-03 도 "버퍼 만료 시 `execution.replay_unavailable` 신호 emit 은 계획·미구현"이라고 명시하고 있어 내용이 **일치**한다. 그러나 target draft 에 명시된 폴백 endpoint `GET /api/external/executions/:id`(현재 `conversationThread`)가 EIA-IN-04 의 `GET /api/external/executions/:executionId`(상태·result·seq 등 조회)와 동일 경로임을 확인했다. draft 의 `conversationThread` 필드 언급은 EIA §5.3·§6 의 스냅샷 응답 shape 정의와의 관계를 독자가 직접 추론해야 하는 불명확성이 있다.
- **제안**: 폴백 endpoint 설명에 "EIA §5.3 snapshot 필드 참조" cross-ref 를 추가해 독자가 응답 shape 를 찾을 수 있도록 연결하면 INFO 수준으로 해소.

---

### [INFO] W2 — `3-auth-session.md` §3.1 에서 `410 Gone` 의미 vs EIA-IN-12 충돌 아님, 그러나 `refresh-token` 성공 시 복원 절차 미정의
- **target 위치**: §W2 `3-auth-session.md §3` 재로드 복원 시퀀스 신설
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §4.1 / EIA-IN-12 / EIA-AU-04 / EIA-AU-05
- **상세**: draft 가 기술하는 재로드 복원 흐름은 다음 두 EIA 정의와 정합한다:
  - `401` → `POST .../refresh-token` 1회 시도 (EIA-AU-05 대응).
  - 재차 `401`/`410` 이면 종료 (EIA-IN-12 대응).
  - `410 Gone` = 종료/만료 (EIA-IN-12 에서 "종료된 execution → `410 Gone`" 명시).
  그러나 `POST .../refresh-token` 성공 후 "복원" 이라 했을 때 이후 절차(SSE `Last-Event-Id` 재연결로 복원? 아니면 `GET /:id` snapshot 으로 복원?) 가 draft 에 명시되지 않았다. W1 과의 연계가 없으면 구현자가 임의 해석할 수 있다.
- **제안**: W2 §3.1 복원 성공 분기에 "복원 후 SSE 재연결은 W1 절차([1-widget-app §3.1])" cross-ref 추가.

---

### [INFO] W3 — `spec-impl-evidence.md §1` INCLUDE_PREFIXES 확장: 기존 적용 대상 목록 형식과 일치 여부
- **target 위치**: §W3 `spec-impl-evidence.md §1` 적용 대상 목록 `spec/7-channel-web-chat/**.md` 추가
- **충돌 대상**: `spec/conventions/spec-impl-evidence.md §1`
- **상세**: 현재 `spec-impl-evidence.md §1` 의 적용 대상 목록은 `spec/2-navigation/**.md` / `spec/3-workflow-editor/**.md` / `spec/4-nodes/**.md` / `spec/5-system/**.md` / `spec/conventions/**.md` 5개 경로. draft 는 `spec/7-channel-web-chat/**.md` 를 추가하겠다고 기술하며, `_product-overview.md` 는 underscore prefix 제외 규칙(§1 "제외" 항) 으로 자동 걸러짐을 확인했다. 기존 `spec/7-channel-web-chat/` 5개 파일 중 `_product-overview.md` 만 underscore 제외에 해당하고 나머지 4개(`0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`)는 정상 적용 대상이다. 모두 `status: partial` + `pending_plans:` 필드를 가지고 있어 가드 적격 요건 충족. **내용 충돌 없음**.
- **제안**: 변경 없음. 단, draft 에서 "5개 파일 모두"라고 서술하는데 실제 파일은 5개 spec 파일 + 1개 `_product-overview.md` = 6개이며, 적용 대상은 5개임을 명확히 기재하면 혼동 방지.

---

### [INFO] W5 — `0-architecture.md §4` 의 env 키 `WEB_CHAT_WIDGET_ORIGINS` — `spec/1-data-model.md §2.2 Workspace.settings.interactionAllowedOrigins` 와의 역할 구분
- **target 위치**: §W5 `0-architecture.md §4` + `.env.example` `WEB_CHAT_WIDGET_ORIGINS` 명시
- **충돌 대상**: `spec/1-data-model.md §2.2 Workspace.settings` / `spec/7-channel-web-chat/4-security.md §2`
- **상세**: `4-security.md §2.1` 은 backend 가 `WEB_CHAT_WIDGET_ORIGINS`(env) 로 빌트인 CDN origin 을 관리하고, `interactionAllowedOrigins`(워크스페이스 settings) 는 추가 BYO-UI/M2 origin 관리라고 구분한다. draft W5 는 그 env 키 이름을 `0-architecture.md §4` 에 명시하겠다고 하며, 이는 기존 `4-security.md §2.1`·`0-architecture.md §4` 의 "빌드타임/런타임 config 로 관리" 기술과 일치한다. 두 키의 역할 분리 정의는 `spec/1-data-model.md §2.2` 의 `interactionAllowedOrigins` 설명 및 `4-security.md §2` 에 이미 있으므로 **중복 정의 위험은 낮다**. 그러나 `0-architecture.md §4` 가 env 키 이름을 추가하면 두 spec 문서(0-architecture §4, 4-security §2.1)가 동일 env 키를 각자 언급하는 형태가 된다.
- **제안**: `0-architecture.md §4` 에 env 키 언급 시 "SoT: `4-security.md §2.1`" cross-ref 를 병기하여 단일 진실이 어디 있는지 명시.

---

### [INFO] §4-a — `1-widget-app §2/§3` show/hide 가시성 축: 기존 `2-sdk.md §1·R4` 와의 정합 확인
- **target 위치**: §4-a `1-widget-app §2/§3` 런처 가시성 축(show/hide) 추가
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md §1` / `§5 ChatInstance` / `§R4`
- **상세**: `2-sdk.md §1` 이미 `show`/`hide` vs `open`/`close` 두 축을 기술하고("**§5 의 `ChatInstance` 타입 블록이 공개 메서드 계약의 타입 SoT** — 상충 시 §5 우선"), `§5 ChatInstance` 에서 4개 메서드를 타입으로 정의한다. `§R4` 도 `show`/`hide` (런처 가시성) vs `open`/`close` (패널 전개) 두 축 분리를 명시하며 "`1-widget-app` 상태기계가 SoT" 라고 명시한다. draft §4-a 는 그 위젯 SPA 상태기계(`1-widget-app §2/§3`)에 두 축을 명시 추가하는 것이므로 **SDK 와 방향이 일치한다**. `hidden` 상태에서 `open` 무효(먼저 `show` 필요)는 `2-sdk.md §1` 의 "hide 후엔 open 해도 보이지 않는다(먼저 show)" 기술과 일치. **충돌 없음**.
- **제안**: draft §4-a 에 "2-sdk §5 ChatInstance 가 공개 계약 타입 SoT" 주석을 추가하면 reader 가 두 문서의 역할을 명확히 파악할 수 있다.

---

### [INFO] §4-b — `updateProfile` shallow merge "다음 시작에 적용" 의미: `2-sdk.md §2` / `§5` 의 기술 범위 밖
- **target 위치**: §4-b `1-widget-app §3` updateProfile 세션중 갱신 의미
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md §2(npm 패키지)` / `§5 ChatInstance`
- **상세**: `2-sdk.md §5` 는 `updateProfile(profile: Record<string, unknown>): void` 의 타입 시그니처만 정의하고, "다음 워크플로우 시작에 적용/소급 불가" 의미론은 기술하지 않는다. draft §4-b 는 그 의미론을 `1-widget-app §3` 에 정의하겠다는 것으로, SDK 타입 SoT 와의 충돌은 없다(다른 레이어). **직접 충돌 없음**. 단, `2-sdk.md §5` 의 `ChatInstance` 타입 블록에 별개 docstring 또는 cross-ref 가 없으면 SDK 소비자가 `updateProfile` 의 시간적 의미를 놓칠 수 있다.
- **제안**: `2-sdk.md §5 ChatInstance` 의 `updateProfile` 항목에 "의미: `1-widget-app §3` 참조" 한 줄 cross-ref 추가 권장.

---

### [INFO] W4 — `4-security.md §Rationale` 신설 내용이 기존 본문 산재 근거와 중복 없이 집약되는지
- **target 위치**: §W4 `4-security.md` Rationale 신설
- **충돌 대상**: `spec/7-channel-web-chat/4-security.md §1·§2·§3·§4` (기존 본문의 산재 근거)
- **상세**: `4-security.md` 현재 본문에는 §4 `rate-limit 구현 특성(v1)` 블록 등 근거성 서술이 본문에 혼재한다. draft W4 는 이를 `## Rationale` 로 집약하되 본문 중복 제거를 명시했다. 기존 `spec/0-overview.md` 의 Rationale 패턴("본문은 latest-only 사실, Rationale 은 왜")과 정합한다. 별도 spec 과의 **구조 충돌 없음**.
- **제안**: 집약 시 §4 본문의 `rate-limit 구현 특성(v1)` 블록(기울임 인용문)을 Rationale 로 이동하고 본문 §4 는 정책만 남기면 패턴 일관성이 높아진다.

---

## 요약

target draft(`spec-draft-channel-web-chat-gaps.md`) 는 기존 spec 영역(`spec/5-system/14-external-interaction-api.md`, `spec/1-data-model.md`, `spec/7-channel-web-chat/2-sdk.md`, `spec/conventions/spec-impl-evidence.md`)과 **CRITICAL 또는 WARNING 수준의 직접 모순을 갖지 않는다**. W1~W5 보강은 EIA SoT 와 cross-ref 를 추가·구체화하는 정밀화 성격이며, 기존 EIA-IN-07·EIA-NF-03·EIA-AU-04·EIA-AU-05 정의와 방향이 일치한다. show/hide + open/close 두 축(`§4-a`)은 이미 `2-sdk.md §R4`·`§5 ChatInstance` 에서 합의된 결정의 위젯 SPA 반영이며 충돌이 없다. updateProfile 의미(`§4-b`)는 SDK 타입 SoT 레이어와 다른 의미 레이어를 기술하므로 충돌이 아니다. 발견된 모든 항목은 INFO 등급(cross-ref 누락, 표기 명확성)이며 채택 차단 사유가 되지 않는다.

## 위험도

LOW

---

STATUS: OK
