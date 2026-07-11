# Cross-Spec 일관성 검토 결과 — `spec/7-channel-web-chat/`

검토 모드: 구현 착수 전 검토 (--impl-prep). target = `spec/7-channel-web-chat/*.md` (0-architecture / 1-widget-app /
2-sdk / 3-auth-session / 4-security / 5-admin-console). 교차 검증 대상: `spec/5-system/14-external-interaction-api.md`
(EIA), `spec/5-system/12-webhook.md`, `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`,
`spec/conventions/conversation-thread.md`, `spec/conventions/interaction-type-registry.md`,
`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/6-presentation/0-common.md`, `spec/2-navigation/_layout.md` ·
`_product-overview.md` · `2-trigger-list.md`, `spec/0-overview.md`.

## 발견사항

- **[WARNING]** 위젯 세션 종료(reload) 시퀀스 표의 "→ `410 Gone`" 라벨이 EIA 의 실제 상태코드 시맨틱과 어긋남
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 표, "토큰 만료/서버 타임아웃" 행 —
    `per_execution 만료(refresh 실패) 또는 idle → \`410 Gone\`` → `[ended]` + "대화 종료, 새로 시작" 안내
  - 충돌 대상:
    - 같은 영역 `spec/7-channel-web-chat/3-auth-session.md` §3.1 (재로드 복원 시퀀스) 자신의 정밀 서술
    - `spec/5-system/14-external-interaction-api.md` §5.3(`GET /:executionId`), §5.5(`refresh-token`), EIA-IN-12
  - 상세: EIA 스펙상 (a) **refresh 실패는 `401 Unauthorized`** 다(§5.5 "`401 Unauthorized // execution 종료됨,
    또는 expiresAt 까지 30분 이상 남음`"; §5.1 에러표의 `TOKEN_REVOKED`/`TOKEN_INVALID`/`TOKEN_EXPIRED` 도 전부
    401 계열). (b) **idle-wait backstop(EIA-RL-07)** 이 execution 을 `cancelled` 로 회수한 뒤, 위젯이 재로드 시 호출하는
    `GET /api/external/executions/:id` 는 **`200 OK` + `status: "cancelled"`** 로 응답한다 — `410 Gone` 은 §5.3 자체가
    "**EIA-IN-12 의 `410 Gone` 은 *명령*(interact/cancel)에 대한 응답 전용이라 상태 조회에는 나타나지 않는다**"고 명시적으로
    구분한다. 즉 `410 Gone` 은 이미 종료된 execution 에 **명령**(예: `submit_message`/`cancel`)을 보낼 때만 발생하는
    별개 경로이며, "token 만료/idle 후 재로드" 흐름의 결과 코드로 제시하는 것은 부정확하다. 실제로 같은 target 문서인
    `3-auth-session.md` §3.1 은 이 세 갈래(401→낙관적 refresh→재차 401, 200+terminal status, 404, 그리고 명령 응답 410)를
    정확히 구분해 서술하는데, `1-widget-app.md` §3.1 표는 이를 단일 "`410 Gone`" 으로 뭉뚱그려 **동일 영역 내에서도**
    상태 신호 서술이 일치하지 않는다(관점 4: 상태 전이 서술 drift).
  - 제안: `1-widget-app.md` §3.1 표의 해당 행을 "만료/idle → (재로드 시 `200 status=cancelled` 또는 `401`→낙관적
    refresh 실패, 명령 시도 시 `410 Gone`)" 정도로 정정하거나, 단순히 `3-auth-session.md §3.1` 을 SoT 로 참조하도록
    바꿔 두 표의 이중 서술을 제거한다. 기능적 회귀는 아니지만(코드가 아닌 요약 표의 정밀도 문제), 구현자가 이 표만 보고
    "idle timeout 은 410 으로 온다" 고 가정해 재로드 분기 처리 코드를 잘못 작성할 위험이 있다.

## 요약

`spec/7-channel-web-chat/*` 는 EIA(`14-external-interaction-api.md`) · webhook(`12-webhook.md`) · execution-engine
(`4-execution-engine.md`) · data-model(`1-data-model.md` Workspace.settings/Trigger) · conversation-thread convention ·
interaction-type-registry · AI Agent(§6.2/§7.10/§12.5) · Presentation 공통(§10.4/§10.6) · navigation(NAV-WC-01..06,
`_layout.md` 메뉴 순서, `2-trigger-list.md` RBAC) 등 사실상 전 인접 영역과 대조했을 때 필드명·상태값·에러코드·권한
등급·요구사항 ID 가 모두 정확히 일치했다 — 특히 EIA-RL-07(idle-wait backstop) · EIA-IN-02(end_conversation/cancel
분기) · EIA-IN-12(410 Gone) · `interactionType` 3값/4값 매핑(interaction-type-registry §1.2) · conversation-thread
5-source→2-way 말풍선 축약(§9 스코프 예외) · Trigger.config.interaction/appearance 스키마(EIA §4) · CORS 두 표면 분리
(EIA §8.5 ↔ 4-security §2) 등 잠재 충돌 소지가 큰 지점들이 이미 상호 참조로 명시적으로 조정돼 있었고, EIA 문서 자체에
"impl-prep cross_spec WARNING 반영"(EIA-NX-11 관련) 흔적이 남아 있어 이번이 첫 교차검토가 아님을 시사한다. 유일하게
발견된 이슈는 CRITICAL 급 모순이 아니라, 같은 대상 영역 내부(`1-widget-app.md` vs `3-auth-session.md`)에서 세션 종료
신호를 요약하는 방식이 EIA 의 정밀한 상태코드 구분(401 vs 200+cancelled vs 410)과 어긋나는 WARNING 1건이다.

## 위험도

LOW
