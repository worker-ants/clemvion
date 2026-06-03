---
id: web-chat-auth-session
status: partial
code:
  - codebase/channel-web-chat/src/lib/session-store.ts
  - codebase/channel-web-chat/src/lib/eia-client.ts
  - codebase/channel-web-chat/src/widget/use-widget.ts
pending_plans:
  - plan/in-progress/channel-web-chat-impl.md
  - plan/in-progress/channel-web-chat-followups.md
  - plan/in-progress/channel-web-chat-demo.md
---

# Spec: Channel Web Chat — 인증 / 세션 흐름

> 관련: [EIA §4·§5](../5-system/14-external-interaction-api.md) · [Webhook §3.2](../5-system/12-webhook.md) ·
> [보안](./4-security.md).

---

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
1. 첫 사용자 입력 → 위젯: POST /api/hooks/:path { profile, firstMessage }   (인증 없음)
2. API: 202 { executionId, interaction: { token: iext_*, expiresAt, endpoints } }
3. 위젯: GET .../:id/stream?token=iext_*           (SSE open)
4. SSE: execution.waiting_for_input (ai_conversation) → 입력창 활성 + conversationConfig 렌더
5. 사용자 입력 → POST .../:id/interact { command: submit_message, message }  (Authorization: Bearer iext_*)
6. SSE: execution.ai_message (+ presentations?) → 말풍선 렌더 → 다시 waiting_for_input
7. (만료 30분 이내 & 대화 alive) → POST .../:id/refresh-token → 토큰 갱신
8. 종료/ completed → SSE 종료, 토큰 invalidate, [ended]
```
- 새로고침 지속: `executionId`+단명 토큰을 iframe-origin storage 에 저장해 재로드 시 복원한다. **상세 절차는 §3.1**.
  사용자 식별은 v1 익명.

### 3.1 재로드 복원 시퀀스 (per_execution)

1. iframe-origin storage 에서 `{executionId, token, expiresAt, endpoints}` 조회 — 없으면 신규(collapsed).
2. `GET /api/external/executions/:id` 로 상태 확인:
   - `200`(진행 중) → SSE 재연결(`Last-Event-Id` 절차 = [1-widget-app §3.1](./1-widget-app.md)) → 복원.
   - `410 Gone`(종료/만료) → storage 정리 후 `[ended]`.
   - `401` → **만료 vs blacklist 구분 불가**: per_execution 토큰은 execution 종료 시 즉시 **jti blacklist**
     ([EIA §8.3](../5-system/14-external-interaction-api.md), EIA-AU-04)되므로, 재로드 `401` 은 (a) 단순 만료(refresh
     가능) 또는 (b) 종료 후 blacklist(복구 불가) 둘 다 가능하다. 위젯은 **낙관적으로 `POST .../refresh-token` 1회**
     시도 → 성공 시 SSE 재연결로 복원, 재차 `401`/`410` 이면 종료로 간주.
3. **storage 정리 책임**: 종료(`completed`/`failed`/`cancelled`) 수신 시, 그리고 위 복원에서 `410`/복구불가 `401`
   확인 시 위젯이 즉시 storage 항목을 제거한다(stale 토큰 잔존 금지).

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
