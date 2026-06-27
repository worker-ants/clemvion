# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/4-security.md`

검토 기준 문서: `spec/7-channel-web-chat/4-security.md` (id: `web-chat-security`, status: partial)

---

## 발견사항

### 발견사항 1
- **[INFO]** EIA §8.4 rate-limit 참조에서 구현 상태(Planned) 미명시
  - target 위치: `spec/7-channel-web-chat/4-security.md` §4 ("기존 EIA §8.4 유지(interact 분당 60/execution, SSE 동시 3/execution)")
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md §8.4` — "Inbound 명령(/interact) execution 당 분당 60 | **미구현 (Planned)** — per-execution rate-limit 가 코드에 없음"
  - 상세: target은 "EIA §8.4 유지"로 두 수치(interact 60, SSE 3)를 함께 서술하나, EIA §8.4에서 SSE 동시 3은 구현됨(implemented)이고 interact 분당 60은 Planned(미구현)다. 단일 문장으로 묶으면 독자가 두 제한 모두 현재 작동 중이라 오해할 수 있다. target이 spec값을 잘못 인용하는 것은 아니지만, EIA §8.4의 "미구현" 주석이 security 영역에 전달되지 않는다.
  - 제안: target §4의 해당 줄을 "기존 EIA §8.4 유지(SSE 동시 3/execution 구현됨, interact 분당 60/execution 미구현·Planned)"로 구현 상태를 구분해 기재하거나, EIA §8.4의 Planned 주석에 "이 Planned 제한이 활성화되면 security §4의 남용 방어 레이어와 중복 없이 공존한다"는 메모 추가.

### 발견사항 2
- **[INFO]** `GET /api/hooks/:endpointPath/embed-config` 의 API 명세 소재(webhook spec vs security spec) 모호성
  - target 위치: `spec/7-channel-web-chat/4-security.md` §3-① (`/embed-config` 엔드포인트 공개 동작 정의)
  - 충돌 대상: `spec/5-system/12-webhook.md` Rationale — "본 spec 을 webhook 도메인 SoT 로 확정한다: … ③ POST 전용(GET/PUT·`?wait` 동기모드 미지원) ④ URL 정본 `/api/hooks/:endpointPath`"
  - 상세: 웹훅 spec은 hooks 도메인의 SoT를 자임하고 "POST 전용"을 명시한다. target이 정의하는 `GET /api/hooks/:endpointPath/embed-config`는 서브-경로이며 HTTP method(GET)도 달라 웹훅 트리거 엔드포인트(`POST /api/hooks/:endpointPath`)와 직접 충돌하지는 않는다. 그러나 webhook spec의 domain claim이 서브-경로까지 포괄한다고 읽히면 GET 서브-경로의 존재가 모순으로 보일 수 있다. 실제 구현(`hooks.controller.ts @Get(':endpointPath/embed-config')`)이 같은 컨트롤러에 위치해 `/api/hooks/` 네임스페이스를 공유한다. 현재 security spec이 이 엔드포인트의 동작 SoT이며 `data-flow/14-chat-channel.md`·`3-auth-session.md`가 동일 경로를 일관되게 참조한다 — spec값 충돌은 없다.
  - 제안: `spec/5-system/12-webhook.md` Rationale의 "POST 전용" 항목에 "본 항은 트리거 엔드포인트(`POST /api/hooks/:endpointPath`)에 한정; 서브-경로(`/embed-config` 등)는 각 영역 spec이 별도 정의"라는 스코프 한정 문구 한 줄 추가. 또는 webhook spec §3 에 `embed-config` 를 비트리거 서브-경로로 명시적으로 언급.

---

## 요약

`spec/7-channel-web-chat/4-security.md`는 `spec/1-data-model.md §2.2`(`interactionAllowedOrigins` 키), `spec/5-system/14-external-interaction-api.md §8.5`(CORS 정책·빌트인 CDN origin), `spec/5-system/12-webhook.md`(공개 webhook 인증 없음 정의·rate-limit 수치), `spec/2-navigation/9-user-profile.md §4.3·§6.1`(PATCH 엔드포인트·Admin+ RBAC), `spec/7-channel-web-chat/1-widget-app.md §3.2`(`blocked` 상태 SoT), `spec/7-channel-web-chat/3-auth-session.md`(부팅 step 0), `spec/7-channel-web-chat/0-architecture.md §5`(M1/M2 모드 정의)와 모두 정합한다. 발견된 이슈는 모두 INFO 등급으로, target이 인용하는 EIA §8.4의 "interact 분당 60" 항목이 Planned임을 명시하지 않은 점과, webhook spec의 domain SoT 선언과 security spec의 `/embed-config` 서브-경로 정의 간 경계가 문서상 암묵적으로 처리된 점에 한정된다. 두 이슈 모두 실제 spec값의 모순이 아니라 독자 가이드 명확성 차원의 권장 동기화다.

## 위험도

LOW
