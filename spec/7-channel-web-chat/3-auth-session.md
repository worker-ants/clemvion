---
id: web-chat-auth-session
status: implemented
code:
  - codebase/channel-web-chat/src/lib/session-store.ts
  - codebase/channel-web-chat/src/lib/eia-client.ts
  - codebase/channel-web-chat/src/widget/use-widget.ts
  - codebase/channel-web-chat/src/widget/use-token-refresh.ts
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

> ⚠ **v1 구현 현황(부분)**: 현재 위젯(`use-widget.ts` `seedWaitingFromStatus`)은 `getStatus` 응답이 `waiting_for_input` 이면 그 표면 + **`context.conversationThread`(durable 스냅샷) 전체 히스토리**를 시드한 뒤 SSE 를 연다. `getStatus` 가 durable `Execution.conversation_thread` 를 동봉하므로([EIA §5.3·§R17](../5-system/14-external-interaction-api.md)) 새로고침 복원이 5분 SSE buffer·서버 재시작과 무관하게 과거 대화를 되살린다. turn `source`→말풍선 role 매핑은 [1-widget-app §2](./1-widget-app.md). 아래 2단계의 **200+종료·404·복구불가 401 REST 분기와 `401 → 낙관적 refresh 1회` 는 여전히 미구현(Planned)** — 그 외 status·오류는 `catch` soft-fail 후 SSE 로 진행하며, 종료는 SSE terminal 이벤트(버퍼 5분 내 replay)로 도달한다. 이 REST 오류 분기·낙관적 refresh 완전 구현은 후속 결정으로 남긴다.

1. iframe-origin **sessionStorage**(§R6)에서 `{executionId, token, expiresAt, endpoints}` 조회 — 없으면 신규(collapsed).
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
  **서버측 `waiting_for_input` execution row 자체**는 공개 위젯 idle-wait backstop([EIA §3.4 EIA-RL-07](../5-system/14-external-interaction-api.md#34-신뢰성일관성) — `WebchatIdleReaperService`)이 발급 토큰 영구 만료(`execution_token.exp_at`) + grace 후 `cancelled` 로 회수한다(토큰만 죽고 execution 은 잔존하던 갭 해소, [1-widget-app §R9](./1-widget-app.md)).
