---
id: web-chat-auth-session
status: partial
code:
  - codebase/channel-web-chat/src/lib/session-store.ts
  - codebase/channel-web-chat/src/lib/api-base.ts
  - codebase/channel-web-chat/src/lib/eia-client.ts
  - codebase/channel-web-chat/src/widget/use-widget.ts
  # §3.1 재로드 복원 시퀀스가 `isAttemptStale` 에 의존한다 — 복원 중 새 부팅 시도가 들어오면
  # 앞선 시도의 결과를 적용하지 않는다. 그 판정의 정본은 여기다(`use-widget.ts` 는 소비처).
  - codebase/channel-web-chat/src/widget/use-session-generations.ts
  - codebase/channel-web-chat/src/widget/use-token-refresh.ts
pending_plans:
  - plan/in-progress/webchat-reload-rest-error-branches.md
---

# Spec: Channel Web Chat — 인증 / 세션 흐름

> 관련: [EIA §4·§5](../5-system/14-external-interaction-api.md) · [Webhook §3.2](../5-system/12-webhook.md) ·
> [보안](./4-security.md).

---

## Overview

공개 임베드 위젯의 **인증·세션 모델**을 정의한다 — 트리거는 인증 없는 공개 webhook(`auth_config_id IS NULL`, §1),
대화는 webhook `202` 가 동봉하는 **per_execution 단명 토큰**(`iext_*`, §2)으로만 진행하며 클라이언트에 장기 비밀을 두지
않는다. 세션 시퀀스(부팅→시작→SSE→명령→갱신→종료, §3)와 새로고침 복원(sessionStorage 기반, §3.1)을 다룬다. 토큰
저장소(§R6)·per_execution 채택(§R3)·재로드 `401` 낙관적 refresh(§R4) 등의 결정 근거는 Rationale.

## 1. 공개 위젯 = webhook 인증 없음 (`auth_config_id IS NULL`)

위젯이 임베드되는 트리거는 누구나 호출 가능한 공개 챗봇이므로 `POST /api/hooks/:endpointPath` 트리거를
**`auth_config_id IS NULL`(인증 없음)** 로 둔다([12-webhook §3.2 WH-SC-01](../5-system/12-webhook.md) — 과거 inline
`authType` 필드는 V066 cleanup 으로 폐기, AuthConfig FK 모델). webhook path(UUID)가 사실상 비밀 키이며 스니펫에
노출돼도 무방. 남용 방어는 인증이 아니라 rate-limit + origin 검증 + 워크플로우 측 가드로 한다([보안](./4-security.md)).

## 2. 토큰 전략 — per_execution 단일 지원

- 위젯은 **per_execution 만** 사용. webhook `202` 응답이 단명 `iext_*` 토큰을 동봉(EIA §4.1)하므로 위젯은 공개 path 만
  알면 되고 클라이언트에 장기 비밀을 넣지 않는다. 대화 종료 시 토큰 자동 invalidate.
- per_trigger(영구 `itk_*`)는 **미지원** — 영구 토큰을 스니펫/번들에 노출하지 않기 위함. boot config 에 인증 토큰
  필드를 두지 않는다([2-sdk §4](./2-sdk.md)). 근거 §R3.
- **(향후) 유저당 다중 세션 목록 노출**: per_execution 은 "한 대화 = 한 execution" 모델이라, 여러 대화 목록 표시는 별도
  설계 필요(전제: 사용자 식별 + 유저별 execution/conversation 목록 조회 API — 현 EIA 미존재). v1 비목표.

## 3. 세션 시퀀스 (per_execution)

```
0. (boot) 위젯: GET /api/hooks/:path/embed-config → { data: { allowlist, enforce } } 조회(전역 wrap, res.data 언랩) → host origin soft 검증.
       불일치 시 위젯 [blocked] (시작 차단). allowlist 빈/enforce=false 면 통과(fail-open). 상세 [4-security §3-①](./4-security.md)
1. 패널 open(런처 클릭) → 위젯: POST /api/hooks/:path { profile }   (인증 없음. firstMessage 미동봉 — [1-widget-app §R6](./1-widget-app.md))
2. API: 202 { data: { executionId, status: "pending", interaction: { token: iext_*, expiresAt, endpoints } } }
       ↑ 전역 TransformInterceptor 가 모든 성공 응답을 { data } 로 래핑 (webhook §3.1). 위젯은 res.data 를 언랩해 읽는다.
3. 위젯: GET .../:id/stream?token=iext_*           (SSE open)
4. SSE: execution.waiting_for_input → interactionType 별 첫 표면 렌더
       (ai_conversation → 입력창 / buttons·carousel → 선택지 / form → 폼)
5. 사용자 입력/선택 → POST .../:id/interact { command: submit_message|click_button|submit_form, ... }  (Authorization: Bearer iext_*)
6. SSE: execution.ai_message (+ presentations?) → 말풍선 렌더 → 다시 waiting_for_input
7. (만료 30분 이내 & 대화 alive) → POST .../:id/refresh-token → 토큰 갱신
8. 종료/ completed → SSE 종료, 토큰 invalidate, [ended]
```
- 새로고침 지속: `executionId`+단명 토큰을 iframe-origin **sessionStorage** 에 저장해 재로드 시 복원한다(탭 단위 —
  같은 탭 reload 는 유지, 탭 종료 시 자동 소거. 근거 §R6). **상세 절차는 §3.1**. 사용자 식별은 v1 익명.

### 3.1 재로드 복원 시퀀스 (per_execution)

> ⚠ **v1 구현 현황(부분)**: 현재 위젯(`use-widget.ts` `seedWaitingFromStatus`)은 `getStatus` 응답이 `waiting_for_input` 이면 그 표면 + **`context.conversationThread`(durable 스냅샷) 전체 히스토리**를 시드한 뒤 SSE 를 연다. `getStatus` 가 durable `Execution.conversation_thread` 를 동봉하므로([EIA §5.3·§R17](../5-system/14-external-interaction-api.md)) 새로고침 복원이 5분 SSE buffer·서버 재시작과 무관하게 과거 대화를 되살린다. turn `source`→말풍선 role 매핑은 [1-widget-app §2](./1-widget-app.md). 아래 2단계의 **`200`+종료 REST 분기는 구현됨** — 스냅샷 `status` 가 terminal 이면 세션 정리 + `[ended]` 전이 + host `conversationEnded` 통지를 수행하고 SSE 재오픈·토큰 갱신 예약을 건너뛴다. **버퍼 만료(≥5분) gap 안에 종료된 경우 그 terminal SSE 이벤트도 버퍼와 함께 유실돼 다시 오지 않으므로**([EIA `R-replay-unavailable`](../5-system/14-external-interaction-api.md)) 이 REST 분기가 유일한 종료 도달 경로다 — 없으면 위젯이 `streaming` 에 무기한 멈춘다([1-widget-app §3.1](./1-widget-app.md)). **`404`·복구불가 `401` REST 분기와 `401 → 낙관적 refresh 1회` 는 여전히 미구현(Planned)** — 그 외 status·오류는 `catch` soft-fail 후 SSE 로 진행한다. 이 잔여 REST 오류 분기·낙관적 refresh 완전 구현은 후속 결정으로 남긴다 — 그 결정과 구현을 소유하는 plan 은 [`webchat-reload-rest-error-branches.md`](../../plan/in-progress/webchat-reload-rest-error-branches.md) 이며, 본 문서 frontmatter 의 `pending_plans:` 가 가리키는 대상이 그것이다(이 잔여 때문에 `status` 는 `implemented` 가 아니라 **`partial`**).

1. iframe-origin **sessionStorage**(§R6)에서 `{executionId, token, expiresAt, endpoints, apiBase}` 조회 — 없으면 신규(collapsed).
   저장 세션은 **발급된 `apiBase`(origin)에 묶인다**: 현재 `apiBase` 와 불일치하거나 `apiBase` 가 기록돼 있지 않으면
   **폐기하고 신규로 시작**한다. 재전송(§3)이 `apiBase` 를 바꿀 때 옛 origin 에서 발급된 단명 토큰이 새 origin 으로
   전송되는 것을 막는다(세션과 엔드포인트의 축 분리). 비교는 후행 슬래시만 정규화하고 **경로는 보존**한다
   (`apiBase` 는 `/api` 등 경로 포함이 정상).
2. `GET /api/external/executions/:id` 로 현재 상태 확인 — **종료된 execution 도 `200 OK` + `status` 로 응답**한다
   ([EIA §5.3](../5-system/14-external-interaction-api.md)). EIA-IN-12 의 `410 Gone` 은 *명령*(interact)에 대한 응답
   전용이라 **상태 조회에는 나타나지 않는다**. status 값으로 분기:
   - `200` + `status` ∈ {`running`/`waiting_for_input` 등 진행 중} → SSE 재연결(`Last-Event-Id` 절차 =
     [1-widget-app §3.1](./1-widget-app.md)) → 복원. `waiting_for_input` 이면 그 `context` 로 현재 표면 +
     `context.conversationThread`(durable 스냅샷)로 **과거 대화 히스토리 전체**를 시드한다(EIA §5.3·§R17).
   - `200` + `status` ∈ {`completed`/`failed`/`cancelled`}(종료) → storage 정리 후 `[ended]`. (버퍼(5분) 내면 SSE
     terminal 이벤트 replay 로도 동일 도달.)
   - `404 EXECUTION_NOT_FOUND`(purge·미존재) → storage 정리 후 `[ended]`.
   - `401` → **만료 vs blacklist 구분 불가**: per_execution 토큰은 execution 종료 시 즉시 **jti blacklist**
     ([EIA §8.3](../5-system/14-external-interaction-api.md), EIA-AU-04)되므로, 재로드 `401` 은 (a) 단순 만료(refresh
     가능) 또는 (b) 종료 후 blacklist(복구 불가) 둘 다 가능하다. 위젯은 **낙관적으로 `POST .../refresh-token` 1회**
     시도 → 성공 시 SSE 재연결로 복원, 재차 `401` 이면 종료로 간주.
3. **storage 정리 책임**: 종료(`completed`/`failed`/`cancelled`) 수신 시, 위 복원에서 200+terminal status·`404`·복구불가
   `401` 확인 시, 그리고 명령 응답 `410 Gone`(EIA-IN-12) 수신 시 위젯이 즉시 storage 항목을 제거한다(stale 토큰 잔존 금지).

## Rationale

### R3. 토큰 전략 — per_execution 단일 (per_trigger 미지원)
"신규 자격증명 도입 없이 기존 토큰 재사용 + webhook 인증 없음" 요건을 per_execution 이 완전히 충족한다(기존 EIA 토큰
메커니즘, 신규 credential 없음, webhook 202 가 단명 토큰 발급 → 위젯은 공개 path 만 알면 됨). per_trigger(영구 `itk_*`)는
공개 사이트의 스니펫/번들에 영구 토큰이 박혀 노출되고 origin allowlist 로만 방어해야 하므로 **배제**. per_execution 은
클라이언트에 장기 비밀이 없고 종료 시 자동 invalidate, scope 가 1 execution 으로 한정 — 공개 위젯에 명백히 우수.
리로드 간 연속성은 토큰 재사용이 아니라 `executionId`+단명 토큰 클라이언트 저장·복원으로 해결(노출 면을 늘리지 않음).
EIA §R4 의 "default per_execution(안전)" 원칙과 정합 — per_trigger 는 EIA 가 "사용자가 변환층을 직접 구현하는 advanced
봇" 한정으로 두는데, 공개 브라우저 위젯은 그 조건이 아니므로 노출하지 않는 것이 EIA 의도와 일치한다.

### R4. 재로드 `401` — 낙관적 refresh 1회 후 종료

> **결정은 내려졌으나 구현은 없다 (Planned).** 아래는 채택된 설계이지 현재 동작이 아니다 — 실제
> 위젯은 `401` 을 다른 오류와 구분하지 않고 `catch` soft-fail 로 넘긴다(§3.1 배너). 구현 여부는
> [`webchat-reload-rest-error-branches.md`](../../plan/in-progress/webchat-reload-rest-error-branches.md)
> 가 소유한다.

재로드 시점에 위젯은 `401` 의 원인(단순 만료 vs 종료 후 jti blacklist, EIA §8.3)을 **사전 판별할 수 없다**. 따라서
**낙관적으로 `refresh-token` 1회** 시도해 만료면 복구하고, 재차 실패(`401`/`410`)면 종료로 확정한다 — 항상 종료로 보면
정당한 만료 세션을 잃고, 항상 refresh 만 믿으면 blacklist 세션을 못 끊는다. 1회 시도는 EIA-AU-04(종료 시 invalidate)
invariant 안에서 안전하며 추가 왕복 1회로 양 케이스를 모두 올바르게 수렴시킨다.

### R5. REST 응답 `{ data }` 봉투 언랩 + 폴백
백엔드 전 REST 성공 응답은 전역 `TransformInterceptor` 가 `{ data }` 로 래핑한다(webhook §3.1 SoT, 본 영역이 바꿀 수
없는 횡단 규약). 따라서 위젯 `eia-client` 는 webhook 시작·상태 조회·토큰 갱신 응답에서 **`res.data` 를 언랩**해 읽는다
(SSE 프레임은 인터셉터를 거치지 않아 봉투 없음 — 언랩 비대상). 언랩 헬퍼는 `data` 키 부재 시 body 를 그대로 반환하는
**폴백**을 둔다: 이는 (a) unit test 가 봉투 없는 fixture 로 메서드 로직을 격리 검증할 수 있게 하고, (b) 인터셉터 우회
경로(향후 비-래핑 응답)에 대한 방어다. 실운영 서버는 항상 `{ data }` 를 반환하므로 폴백 분기는 정상 흐름에서 미발동이며,
봉투가 전 표면에서 확정 보장되면 제거 가능한 이행 코드다. `interact` 는 EIA 상으로 `InteractAckDto`(`{ executionId,
accepted, currentStatus }`)를 `{ data }` 봉투에 실어 `202` 로 반환하지만([EIA §5.1·§R16](../5-system/14-external-interaction-api.md)),
**위젯 eia-client 는 그 ack body 를 소비하지 않는다**(후속 상태는 SSE 수신으로 대체) — 따라서 위젯 측 언랩 비대상이다(no-op).
(배경: 봉투 미언랩으로 `interaction` 을 못 읽어 SSE 가 안 열리던 회귀 수정 — `plan/complete/fix-webchat-envelope-unwrap.md`.)

### R6. 토큰 저장 — sessionStorage (vs localStorage)

`executionId`+단명 토큰의 재로드 복원 저장소로 **`sessionStorage`** 를 쓴다(`localStorage` 아님). 근거:

- **defense-in-depth**: per_execution 토큰은 1 execution 으로 scope 가 한정된 단명 자격이라 본래 위험도가 낮으나,
  `sessionStorage` 는 **탭 종료 시 자동 소거**되어 비밀의 클라이언트 잔존 시간을 최소화한다. `localStorage` 는 탭·브라우저
  종료 후에도 남아 XSS 등으로 탈취될 잔존 노출 면이 더 길다. 단명 토큰이라 영향은 작지만 무비용에 가까운 방어다.
- **§3.1 재로드 복원(N1)은 보존된다**: `sessionStorage` 는 **같은 탭의 새로고침(reload)·동일 문서 내비게이션을 가로질러
  유지**된다 — 호스트 reload → iframe 재로드 경로(같은 top-level 세션)에서 저장 항목이 그대로 남아 복원이 정상 동작한다.
  탭을 닫거나 새 탭에서 열 때만 비워진다.
- **트레이드오프 — 탭 간 세션 미공유**: `sessionStorage` 는 탭(브라우징 컨텍스트) 단위라 같은 호스트 페이지를 새 탭에서
  열면 대화가 공유되지 않고 독립 시작된다. 공개·익명 위젯에는 수용 가능하며(오히려 탭별 독립 대화가 자연스럽다),
  per_execution·v1 익명 모델(§R3)과도 정합한다. 다중 탭 세션 공유가 요구되면 그때 재검토한다.
- **storage 정리 책임(§3.1-3)은 불변**: 종료/복구불가 수신 시 즉시 항목 제거 정책은 저장소 종류와 무관하게 유지된다.
- **구 `localStorage` 잔류 항목**: 이전 버전(localStorage 저장)에서 남은 `clemvion-web-chat:session:*` 키는 읽기·쓰기
  경로가 모두 `sessionStorage` 전용으로 전환됐으므로 **무시**된다(별도 마이그레이션·1회 클린업 미수행). per_execution
  단명 토큰이라 잔류분은 만료로 자연 무효화되며, 복원에 쓰이지 않아 보안·기능 영향이 없다.
- **서버측 execution 회수는 별도 backstop**: 위 client 토큰 만료는 클라이언트 잔존만 정리한다 — 이탈로 방치된
  **서버측 `waiting_for_input` execution row 자체**는 공개 위젯 idle-wait backstop([EIA §3.4 EIA-RL-07](../5-system/14-external-interaction-api.md#34-신뢰성일관성) — `WebChatIdleReaperService`)이 발급 토큰 영구 만료(`execution_token.exp_at`) + grace 후 `cancelled` 로 회수한다(토큰만 죽고 execution 은 잔존하던 갭 해소, [1-widget-app §R9](./1-widget-app.md)).

### R7. 표면 되감기 방어는 "세션 확립" 축 — boot 세대 비교가 아니다

재로드 복원(§3.1)은 상태 조회 스냅샷으로 화면을 seed 한 뒤 SSE 를 연다. 그 사이 **더 최신 시도가
이미 스트림을 열었다면**, 늦게 도착한 스냅샷이 SSE 가 전진시킨 화면을 옛 노드로 되돌릴 수 있다.
이 되감기를 막는 가드의 축은 **"스트림이 실제로 열렸는가"** 이지, 부팅 시도의 세대(generation)
비교가 아니다.

**한 함수 안에 staleness 정책이 둘 공존하고, 합치면 안 된다.**

| 분기 | 가드 | 왜 |
|---|---|---|
| 종료 확정 | **세계의 사실만** 본다 | 종료는 시도의 소유물이 아니다. 대체된 시도가 발견한 진짜 종료를 버리면 **아무도 확정하지 않을 수 있다** — 살아있는 시도는 스트림 열림으로 자기 상태조회를 건너뛸 수 있고, 버퍼 만료 구간에선 terminal SSE 도 다시 오지 않는다 |
| 표면 갱신 | **세션 확립 여부** | 스트림이 열린 순간부터 **SSE 가 표면의 단일 진실**이다 |

**왜 boot 세대 축이 아닌가** — 세대 비교는 "다른 시도가 이미 열었는가" 의 proxy 였고 **두 번
구멍이 났다**: (1) 호출부 checkpoint 는 함수 **반환 뒤**만 보는데 표면 갱신은 함수 **안쪽**이라
닿지 않았고, (2) 진입 시점 세대를 캡처하면 **아무것도 복원하지 못하는 no-op 재전송**이 세대만
올려 자기 자신을 거짓 stale 처리해 스피너에 고착시켰다. 두 구멍 다 "스트림이 실제로 열렸는가"
라는 **직접 신호**로 사라진다 — 열렸으면(누가 열었든) SSE 가 소유하니 건너뛰고, 안 열렸으면
이 시도가 그린다.

**이 가드는 "표면 되감기"만 막는다. "이중 스트림"은 스트림 열기 자체가 막는다.** seed 와
스트림 열기 사이엔 microtask 경계가 있어, 겹친 두 seed 가 같은 flush 에서 완료되면 **둘 다
seed 시점엔 미열림**을 보고 통과한 뒤 각자 스트림을 열려 한다. 그래서 **스트림 열기 진입에서**
소유권을 재확인하고, 이미 열려 있으면 아무것도 하지 않은 채 "다른 시도가 소유 중" 을 돌려준다.
최종 상태는 어차피 단일 스트림으로 수렴하지만, 그 가드가 낭비성 두 번째 연결 생성 자체를 없앤다.

> **종전엔 이 재확인이 호출부 2곳에 손으로 복제돼 있었다.** 3번째 seed→스트림 경로가 생기면
> 아무도 그것을 상기시켜 주지 않아, 이 표면이 반복해 낸 "가드를 한쪽에만 적용" 결함의 다음
> 재발 자리였다. 열기 진입으로 옮겨 **구조적으로 강제**한다(2026-08-10). 호출부는 결과를
> **부정 비교**로 게이팅한다 — 향후 "중단이어야 하는" 결과가 늘어도 기본값이 중단이다(fail-closed).

> **예외 — 버퍼 만료 재동기화**: 자기 스트림의 표면을 재동기화하는 경우(§replay 폴백)만 스트림이
> 열려 있어도 표면을 다시 그린다. 그건 "다른 시도가 가로챔" 이 아니라 "내가 다시 그려야 함" 이다.

> **근거의 성격**: 이 불변식은 되감기 수정의 **3차 반복 끝에** 도달했고, 짝 가드의 필요성은
> "seed 반환 직후 동기 실행이라 원천 차단된다" 는 초기 판단이 microtask 경계를 간과한 오판임이
> 3인 재현으로 드러나 추가됐다. 대안(boot 세대 비교)이 두 번 실패한 이력이 여기 있으므로,
> 되살리려면 위 두 구멍을 먼저 반증해야 한다.

### R8. 저장 세션은 발급 `apiBase` 에 바인딩 — 재전송이 origin 을 바꾸면 폐기

호스트는 부팅 설정을 **여러 번 재전송**할 수 있다(관리자 라이브 미리보기는 폼 변경마다
디바운스 없이 보낸다). 재전송이 `apiBase` 를 바꿨다면 저장된 세션은 **옛 origin 이 발급한
토큰**이다. 복원 조회에 현재 `apiBase` 를 함께 넘겨 **발급 origin 이 같은 세션만** 복원하고,
다르면 폐기하고 새 세션을 시작한다 — 옛 토큰을 새 origin 으로 **보내지 않는다**.

- **fail-closed**: 판정할 수 없으면 폐기한다. 복원 실패의 대가는 "대화를 새로 시작" 이지만,
  오전송의 대가는 **A origin 의 자격이 B origin 에 노출**되는 것이다. 값이 다르다.
- **레거시 세션 fail-safe 를 두지 않았다**: 바인딩 정보가 없는 구 저장 항목을 "일단 복원"
  으로 살려 주면 정확히 그 경로가 남는다. 구 항목은 그냥 복원되지 않고 자연 만료된다
  (per_execution 단명 토큰이라 잔존 비용이 낮다 — §R6 과 같은 논리).
- **정규화는 후행 슬래시로만 한정한다.** `apiBase` 는 `/api` 같은 **경로 포함이 정상**이라
  경로까지 지우고 비교하면 `https://h/api` 와 `https://h` 를 같다고 보게 되고, 그것이 곧
  토큰 오전송이다.

> ⚠ **동명 함수 주의**: 데모 설정에는 후행 `/api` **까지 제거**하는 정반대 계약의 동명
> 정규화 함수가 있다(입력 편의용). 두 함수를 "같은 것" 으로 통합하면 **이 가드가 무력화된다.**

관련 위협 축은 [4-security §1 "저장 세션의 발급-origin 바인딩"](./4-security.md).
