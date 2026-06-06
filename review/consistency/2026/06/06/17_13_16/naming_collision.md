# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상: `spec/5-system/14-external-interaction-api.md`
검토일: 2026-06-06

---

## 발견사항

### 발견사항 없음

아래 6개 관점 전체를 점검한 결과 신규 충돌 식별자가 없음을 확인했다.

#### 1. 요구사항 ID 충돌

`spec/5-system/14-external-interaction-api.md` 에 정의된 요구사항 ID: `EIA-NX-*`, `EIA-IN-*`, `EIA-AU-*`, `EIA-RL-*`, `EIA-NF-*`.

`EIA-` prefix 는 본 파일 전용으로 사용되며, 다른 `_product-overview.md` 의 요구사항 ID 패턴(`NAV-*`, `ND-*`, `ED-*`, `WH-*`, `AGM-*`, `CCH-*` 등)과 중복되지 않는다. 코퍼스 내 `EIA-` 접두어는 본 파일만 사용한다.

#### 2. 엔티티/타입명 충돌

본 spec 이 도입하는 주요 타입명:
- `InteractionRequestContext` / `ExternalInteractionRequestContext` / `InternalInteractionRequestContext` — `spec/5-system/14-external-interaction-api.md §3.3.1`
- `InteractionScope` — 동 spec §3.3.1
- `NotificationDispatcher` / `NotificationFanout` / `SseAdapterService` / `IdempotencyInterceptor` / `InteractionTokenService` — 동 spec §10 구현 파일 구조
- `InteractionGuard` — 동 spec §10

이들 타입명은 코퍼스 내 다른 spec 에서 동일 명칭으로 다른 의미를 갖는 사례가 없다. `Guard` / `Service` suffix 패턴은 NestJS 전통 naming 으로 모듈별 namespace 로 분리된다.

#### 3. API endpoint 충돌

본 spec 이 정의하는 신규 endpoint prefix: `/api/external/executions/:id/*`

기존 `/api/executions/*` (워크스페이스 JWT 전용, `spec/3-workflow-editor/3-execution.md` 및 `spec/2-navigation/14-execution-history.md`) 와는 path prefix 가 다르며, `spec/5-system/14-external-interaction-api.md §12` 에서 분리 근거(§R11)를 명시하고 있다. 충돌 없음.

추가 endpoint:
- `POST /api/triggers/:id/notification/rotate-secret` — `EIA-NX-12`
- `POST /api/triggers/:id/interaction/revoke-token` — `EIA-AU-07`

`/api/triggers/:id/*` 하위에 신규 sub-path 이지만 기존 `spec/5-system/12-webhook.md` 의 trigger CRUD 와 path collision 이 없다.

#### 4. 이벤트/메시지명 충돌

본 spec 이 사용하는 SSE/notification 이벤트 이름: `execution.waiting_for_input`, `execution.completed`, `execution.failed`, `execution.cancelled`, `execution.ai_message`, `execution.node.started`, `execution.node.completed`, `execution.node.failed`, `execution.node.skipped`, `execution.resumed`, `execution.started`, `execution.user_message`, `execution.tool_call_started`, `execution.tool_call_completed`, `execution.replay_unavailable`.

이들은 `spec/5-system/6-websocket-protocol.md §4.1` 의 동일 이벤트명을 **의도적으로 재사용**하는 facade 설계 (§R10) 이며, 동일 의미를 다른 표면에 노출하는 구조적 재사용이지 충돌이 아니다. 내부 WS 의 `replay.unavailable` 과 외부 SSE 의 `execution.replay_unavailable` 은 명시적 namespace 차이로 분리되어 있다(본 spec §5.2).

BullMQ 큐명 `notification-webhook` 은 `execution-run`, `execution-continuation`, `background-execution`, `agent-memory-extraction`, `makeshop-token-refresh` 등 기존 큐명과 충돌하지 않는다.

#### 5. 환경변수·설정키 충돌

본 spec 이 암시하는 환경변수/설정키:
- `INTERACTION_JWT_SECRET` — `spec/5-system/14-external-interaction-api.md §8.3` 에 간접 언급 (plan 에서 `INTERACTION_JWT_SECRET ?? jwt.secret ?? JWT_SECRET` fallback chain 언급). 기존 `JWT_SECRET` 과 fallback 관계로 공존하며, `plan/in-progress/exec-park-b2a-followup.md ②` 에서 이를 명확화하는 spec 갱신이 예정되어 있다. 현재 spec 문서 자체에서는 환경변수를 직접 명명하지 않으므로 충돌 불가.

- `ALLOW_HTTP_HOOKS` — `spec/5-system/14-external-interaction-api.md §3.1 EIA-NX-09` 에서 notification URL `http://` 예외 조건으로만 사용. 기존 webhook 수신과 다른 맥락에서 동일 ENV 를 재사용하는 구조이나 의미가 일치(개발 환경 HTTP 허용)하므로 충돌 아님.

- `workspace.settings.interactionAllowedOrigins` — `spec/1-data-model.md §2.2 Workspace.settings` 에 이미 정의된 known 키이며, 본 spec 은 그 키를 참조할 뿐 신규 도입하지 않는다.

#### 6. 파일 경로 충돌

`spec/5-system/14-external-interaction-api.md` 는 기존 파일 목록과 중복되지 않으며, `spec/0-overview.md §8 문서 맵` 에서도 `14-external-interaction-api.md` 로 등록되어 있다. 명명 컨벤션(`N-name.md`)을 준수한다.

---

## 요약

`spec/5-system/14-external-interaction-api.md` 는 신규 식별자를 명확히 격리된 네임스페이스(`EIA-*`, `/api/external/executions/*`, `iext_*` / `itk_*` / `wsk_*` 토큰 prefix) 에 정의하고 있으며, 기존 코퍼스의 어떠한 식별자와도 의미적 충돌이 발견되지 않는다. `spec/5-system/6-websocket-protocol.md` 의 이벤트명을 재사용하는 부분은 의도적인 facade 설계(§R10)로, 동일 의미를 두 표면에 노출하는 구조적 재사용이다. `plan/in-progress/exec-park-b2a-followup.md` 가 예정하는 §8.3 의 `iext_*` / `itk_*` secret 명확화 작업도 기존 식별자를 변경하는 것이 아니라 기존 설계를 문서에 정확히 반영하는 것이므로 충돌 리스크가 없다.

---

## 위험도

NONE
