# Cross-Spec 일관성 검토 — External Interaction API (`spec/5-system/14-external-interaction-api.md`)

> 검토 모드: `--impl-prep`. target 은 이미 다수 라운드의 consistency-check 를 거친 매우 성숙한 문서(수십 개의
> `구현됨`/`Planned` 표기·R1~R19 Rationale)이며, WS §4.6·실행 엔진 §7.5.1/§1.1·auth §4.1·swagger §1-4·
> data-flow/15-external-interaction.md 등 핵심 상호참조 대상을 직접 `Read` 로 열어 대조했다(프롬프트 예산 초과로
> 16개 파일이 절단됐으므로 "여기 없다"를 근거로 삼지 않고 spec/ 원본을 직접 읽었다).

## 발견사항

- **[WARNING] EIA §5.1 이 webhook §5.2 를 "legacy `statusCode/errors` shape" 라고 잘못 서술 — 두 spec 이 실제로는 이미 동일 컨벤션**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.1 "에러 응답" 도입부 — "응답 body 형식은 … `{ error: { code, message, details } }` 컨벤션을 따른다 (**12-webhook §5.2 의 `statusCode/errors` shape 는 webhook 호출 진입점 전용 legacy 형식** — 본 spec 의 신규 endpoint 는 신컨벤션 채택)."
  - 충돌 대상: `spec/5-system/12-webhook.md` §5.2 "400 응답 형식"
  - 상세: 실제 `12-webhook.md §5.2` 는 현재 `{ "error": { "code", "message", "requestId", "details" } }` — EIA 가 "신컨벤션"이라 부르는 바로 그 봉투를 이미 쓰고 있다(`statusCode`/`errors` 키는 파일 전체에 존재하지 않음, `grep` 확인). EIA 의 이 문장은 2026-05-21 최초 작성(#228) 당시의 webhook 구현 상태(legacy `statusCode/errors`)를 서술한 것인데, webhook 쪽은 2026-06-28 커밋 `7e181ed8e`(`fix(spec): webhook 400 에러 봉투 정합화`)로 신컨벤션으로 이미 정합화됐다. `git blame` 상 EIA §5.1 의 해당 줄은 그 이후 한 번도 갱신되지 않아, 두 문서를 나란히 읽으면 "webhook 은 legacy, EIA 는 신규"라는 **더 이상 사실이 아닌 구분**을 서술하게 된다.
  - 제안: EIA §5.1 의 괄호 문구를 "12-webhook §5.2 는 2026-06-28 정합화로 이미 동일 `{error:{code,message,details}}` 컨벤션을 쓴다"로 갱신하거나, 아예 "본 spec 의 신규 endpoint 도 동일 컨벤션을 따른다" 수준으로 단순화. 실제 계약(양쪽 다 `{error:{...}}`)은 이미 일치하므로 기능적 충돌은 아니고, 잘못된 대비 서술만 정정하면 된다.

- **[WARNING] `InteractionRequestContext` 타입 형태에 대한 chat-channel.md 의 서술이 EIA §3.3.1 의 discriminated union 도입 이전 상태로 정지(stale)**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §3.3.1 "Implementation Note — in-process trusted caller 오염 방지" — `InteractionRequestContext` 를 `ExternalInteractionRequestContext | InternalInteractionRequestContext` **discriminated union** 으로 정의하고 "v1 구현 완료"라 명시(코드 확인: `codebase/backend/src/modules/external-interaction/interaction.guard.ts` 가 실제로 이 union + `isInternalCtx()` 를 구현하고 있음).
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §8 "호환성"(507행) — "`InteractionRequestContext` 에 `scope?: 'in_process_trusted'` **optional 필드만 추가**(외부 HTTP guard 의 ctx 합성은 변경 없음)" 및 §5.1(319행) 동일 서술.
  - 상세: chat-channel.md 의 두 줄은 2026-05-22 최초 작성(#258) 이후 `git blame` 상 한 번도 수정되지 않은, **단일 인터페이스 + optional 필드**라는 옛 설계를 서술한다. 그러나 EIA 쪽은 2026-06-14 커밋(`907616c61`)에서 컴파일러로 invariant 를 강제하기 위해 **두 개의 별도 인터페이스로 분리**(`scope` 는 `InternalInteractionRequestContext` 에서 **필수 리터럴**, `ExternalInteractionRequestContext` 에는 **필드 자체가 부재**)했고 이는 이미 코드에 반영돼 있다. 두 문서가 같은 타입(`InteractionRequestContext`, security-critical 한 토큰 우회 플래그)의 현재 형태를 서로 다르게 서술한다 — chat-channel.md 를 SoT 로 오인해 새 코드를 작성하면(예: "optional 필드"라 믿고 `ExternalInteractionRequestContext` 에도 `scope: undefined` 를 명시 대입) 타입 체크는 통과해도 §3.3.1 이 강제하려는 invariant(외부 ctx 는 필드 자체가 없어야 함)와 어긋나는 코드가 나올 수 있다.
  - 제안: `chat-channel.md` §8·§5.1 을 EIA §3.3.1 의 union 정의로 갱신하거나, 두 곳 모두 "형태는 EIA §3.3.1 이 SoT" 로 포인터만 남기고 자체 타입 서술을 제거(§6 R7 이 이미 이 원칙을 쓰고 있음 — "같은 필드를 여러 문서에 나열하면 그 각각이 두 번째 SoT 가 된다").

- **[INFO] `data-flow/15-external-interaction.md` 가 존재하지 않는 요구사항 ID `EIA-AU-09` 를 참조**
  - target 위치: (target 자체가 아니라 target 이 정의하는 ID 카탈로그 — `spec/5-system/14-external-interaction-api.md` §3.3 은 `EIA-AU-01`~`EIA-AU-08` 까지만 정의)
  - 충돌 대상: `spec/data-flow/15-external-interaction.md` §1.2 (119행) — "토큰 검증 우회는 서버 내부 모듈만 가능 (타입 union 으로 컴파일러 강제, `interaction.guard.ts` **EIA-AU-08/09**)"
  - 상세: `spec/` 전체를 `grep` 해도 `EIA-AU-09` 는 이 한 곳에만 등장하며 어디에도 정의되지 않는다(요구사항 3 "요구사항 ID 충돌"의 변형 — 다른 의미로 재사용된 것이 아니라 **정의되지 않은 ID 로 참조**). 오탈자(의도는 `EIA-AU-08` 단독)이거나, 과거 계획했다가 목록에서 빠진 항목의 잔재로 보인다.
  - 제안: `EIA-AU-08/09` → `EIA-AU-08` 로 정정(가장 가능성 높은 원인), 혹은 실제로 별도 요구사항이 의도됐다면 EIA §3.3 에 `EIA-AU-09` 를 신설.

## 검증했으나 충돌 없음(참고용 — 재조사 불필요)

- WS `6-websocket-protocol.md §4.6` "외부 표면 매핑" 표는 EIA §11 표와 완전히 정합 (WS 쪽이 `retry_last_turn`/`auth.refresh`/`subscribe` 등 EIA 미노출 명령까지 포함하는 상위집합일 뿐, 공통 부분은 1:1 일치).
- 실행 엔진 `4-execution-engine.md §1.1` 상태 전이표의 `waiting_for_input → cancelled` "타임아웃" 사유는 EIA-RL-07 의 인용("이미 예약된 사유")과 정확히 일치.
- 실행 엔진 §7.5.1 publisher 사전 검증(nodeId·표면 매트릭스, `INVALID_EXECUTION_STATE`→ REST `409 STATE_MISMATCH` 매핑)은 EIA §5.1 표·§9.1 흐름과 정합.
- `12-webhook.md` 의 HMAC 알고리즘 화이트리스트(`sha256`/`sha512`, inline config)는 EIA-NX-03 의 내부/외부 표기 분리(§R12) 서술과 모순 없음.
- `1-auth.md §4.1` 감사 로그 액션(`trigger.notification_secret_rotated`, `trigger.interaction_token_revoked`)은 EIA-NX-12·EIA-AU-07 의 "감사 기록 필수" 요구와 정확히 일치.
- `data-flow/15-external-interaction.md` 본문(토큰 발급/inbound/SSE/outbound/rotation 시퀀스, Redis 키 인벤토리, 상태 전이도)은 EIA 본문과 폭넓게 정합 — 위 EIA-AU-09 건 외에는 드리프트 없음.
- `conventions/swagger.md` §1-4/Rationale 의 discriminator 판단 기준은 EIA §5.3 의 `getStatus.context` 사례를 그대로 공유(동일 사례를 두 문서가 같은 결론으로 서술).
- `1-data-model.md §2.2 Workspace.settings.interactionAllowedOrigins` ↔ EIA §8.5 CORS ↔ `7-channel-web-chat/4-security.md` §2·§3 ↔ `2-navigation/9-user-profile.md` §4.3/§6.1 4개 문서가 동일 키·동일 권한(Admin+)·동일 API(`PATCH /api/workspaces/:id/settings`)로 완전히 정합.
- `7-channel-web-chat/3-auth-session.md` R4(재로드 401/410 낙관적 refresh)·R6(sessionStorage, EIA-RL-07 backstop 인용)은 EIA §5.5·§3.4 EIA-RL-07 의 인용과 상충 없음.

## 요약

target(`14-external-interaction-api.md`)은 이미 다수 라운드의 cross-spec 정합화를 거친 매우 성숙한 문서로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 핵심 축에서 실행 엔진·WebSocket·webhook·auth·data-flow 문서와 폭넓게 정합했다. 발견된 3건은 모두 "현재 동작을 깨는 직접 모순"이 아니라 **다른 spec 문서의 과거 상태를 서술한 채 갱신되지 않은 문구**(webhook 에러 봉투 legacy 서술, chat-channel 의 `InteractionRequestContext` 구형 타입 서술)와 **정의되지 않은 요구사항 ID 참조**(`EIA-AU-09`) 다. 전자 두 건은 실제 코드/계약이 이미 올바르므로 기능 리스크는 낮지만, chat-channel.md 건은 보안에 민감한 토큰-우회 타입을 잘못 서술하고 있어 향후 그 문서를 SoT로 오인한 유지보수 시 혼동을 일으킬 수 있다.

## 위험도

LOW-MEDIUM
