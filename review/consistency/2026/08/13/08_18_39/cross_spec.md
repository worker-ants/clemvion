# Cross-Spec 일관성 검토 — `plan/in-progress/backend-lint-gate-broken-on-main.md`

검토 모드: spec draft 검토 (--spec). 관련 spec 번들 중 예산 내에 전문이 실린 문서는
`spec/5-system/14-external-interaction-api.md` 와 `spec/data-flow/15-external-interaction.md`
둘뿐이었다(나머지는 컨텍스트 예산 초과로 절단). 아래 발견은 이 두 문서(및 target 이 직접
인용하는 `spec/5-system/15-chat-channel.md`, `spec/5-system/4-execution-engine.md` §9)를
실제 저장소 파일에서 재확인한 결과다.

target 문서는 대부분 이미 완료·해소된 작업 이력(lint 게이트 복구, idempotency 캐시 키
3-세그먼트 스코프화 등)이며, 최신 developer 턴(`eia-r8-cache-scope-4ae434`)이 착지시킨
`interaction:idempotency:${executionId}:${route}:${rawKey}` 형식은 `spec/5-system/14-external-interaction-api.md`
§R8 Rationale "캐시 키 스코프"(`interaction:idempotency:<executionId>:<route>:<key>`)와
`spec/data-flow/15-external-interaction.md` §2.2(`interaction:idempotency:<executionId>:<route>:<key>`)
양쪽 모두와 정확히 일치함을 실제 파일 grep 으로 확인했다 — 신규 충돌 없음. 컨트롤러 핸들러명도
`interact`/`cancel` 로 spec 이 명시한 route 세그먼트 리터럴과 일치한다(`interaction.controller.ts:63,109,93,127`).

target 이 스스로 미해결로 남겨 둔 두 항목은 재확인 결과 **여전히 실재하는 cross-spec
충돌**이라 아래에 재확인해 둔다(신규 발견이 아니라 target 자신의 체크리스트가 이미 추적 중인
항목의 유효성 확인).

## 발견사항

- **[WARNING]** `CCH-SE-02` 가 EIA 의 HTTP-only idempotency 메커니즘을 chat-channel in-process
  경로에 적용된다고 서술 — 계층 책임 충돌
  - target 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속,
    "`CCH-SE-02` 의 update dedup 이 미배선 — `ChannelUpdate.idempotencyKey` 는 dead field" 항목
    (체크박스 미완료, `19_56_51` cross_spec WARNING 3 인용)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` L88 (`CCH-SE-02`) ↔
    `spec/5-system/14-external-interaction-api.md` §3.3.1 (`EIA-AU-08`) / L76 (`EIA-IN-06`)
  - 상세: `CCH-SE-02` 는 "인터랙션 명령 처리는 EIA `Idempotency-Key` 를 어댑터가 자동 발급
    (텔레그램 `update_id` 기반). 동일 `update_id` 30초 안 재도착은 무시" 라고 명시해, chat-channel
    의 update 중복제거가 EIA 의 `Idempotency-Key` HTTP 인터셉터 경로를 탄다고 전제한다. 그러나
    같은 spec 파일군의 SoT 인 `14-external-interaction-api.md` §3.3.1/`EIA-AU-08`·L76 `EIA-IN-06`
    은 chat-channel 어댑터를 `scope: 'in_process_trusted'` 로 분류해 **HTTP 표면(따라서
    `InteractionGuard`·`IdempotencyInterceptor` 를 포함한 HTTP 파이프라인 전체)을 우회하는
    in-process 직접 호출**로 명시적으로 규정한다("우회는 `InteractionService.interact()` 의
    in-process 직접 호출 경로에 한정되며, HTTP 표면을 거치지 않는다"). `IdempotencyInterceptor` 는
    NestJS 인터셉터로 HTTP 요청 파이프라인에서만 동작하므로, in-process 호출에는 애초에 적용될
    수 없는 메커니즘이다. target 이 실측한 대로 `ChannelUpdate.idempotencyKey`(`chat-channel/types.ts:129`)
    는 provider 파서가 채우기만 하고 읽는 곳이 0곳이며, 30초 dedup 로직도 코드에 없다 — 두 spec
    문서가 같은 요구사항을 서로 다른 계층에 귀속시키고 있어 어느 쪽도 실제로 충족되지 않는 상태다.
  - 제안: planner 결정 필요 — (a) chat-channel 전용 in-process dedup 을 신설해 `CCH-SE-02` 를
    구현하거나 (HTTP 인터셉터 재사용 불가, 층이 다르다 — target 도 이미 이렇게 적어 뒀다), (b)
    `CCH-SE-02` 를 "EIA `Idempotency-Key` 메커니즘 재사용" 이 아니라 "어댑터 자체 dedup" 으로
    재기술한다. 어느 쪽이든 `15-chat-channel.md` 와 `14-external-interaction-api.md` §3.3.1 사이의
    "EIA 메커니즘이 in-process 경로에도 적용된다" 는 암묵적 전제를 명시적으로 정정해야 한다.

- **[WARNING]** EIA 계열 Redis 키가 실행 엔진의 "모든 Redis 키" 전역 네이밍 규약 예외 목록에
  없음 — 데이터 모델/네이밍 규약 SoT 충돌
  - target 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속, "EIA 계열 Redis
    키가 실행 엔진 §9.1/§9.2 키 레지스트리에 없다" 항목(체크박스 미완료, `19_56_51`
    convention_compliance INFO 4 인용)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §9.1/§9.2 ↔
    `spec/data-flow/15-external-interaction.md` §2.2 / `spec/5-system/14-external-interaction-api.md` §R8
  - 상세: `4-execution-engine.md` §9.1 은 "**모든** Redis 키는 아래 패턴을 따른다:
    `{service}:{workspaceId}:{resource}:{id}:{sub}`" 라고 절대 서술하고, §9.2 예외 각주는
    `exec:recover:lock` · `exec:cont:seq:<executionId>` · `exec:seq:<executionId>` · pub/sub 채널
    `integration:cache:invalidate` 만 열거한다. 그런데 EIA 영역 전체의 Redis 키
    (`interaction:idempotency:<executionId>:<route>:<key>`, `iext:blacklist:<jti>`,
    `data-flow/15` §2.2 표에 등재된 나머지 항목들)는 이 패턴을 따르지 않으면서도(고정
    `workspaceId` 세그먼트 부재) §9.2 예외 목록에 전혀 나타나지 않는다 — "모든" 이라는 전역
    선언과 실제 존재하는 별도 키 레지스트리가 정면으로 어긋난다.
  - 제안: target 이 이미 적어 둔 두 대안 중 하나로 planner 정정 — EIA 계열 키를 §9.2 예외
    목록에 묶어 등재하거나, §9.1 의 "모든" 을 실제 범위(예: 실행 엔진 자체 소유 키)로 좁힌다.
    `spec_impact` 에 `4-execution-engine.md` 를 추가하는 별도 planner 작업으로 남아 있다.

## 요약

target 문서는 대부분 이미 완료된 lint 게이트 복구·idempotency 캐시 키 스코프화 작업 이력이며,
최신 개발 턴이 착지시킨 3-세그먼트 캐시 키(`interaction:idempotency:${executionId}:${route}:${rawKey}`)는
`5-system/14`·`data-flow/15` 두 SoT 문서 및 실제 컨트롤러 핸들러명과 정확히 일치해 신규
cross-spec 충돌을 만들지 않는다. 다만 target 이 스스로 추적 중이던 두 미해결 항목
(chat-channel `CCH-SE-02` 의 EIA 메커니즘 오적용 전제, EIA Redis 키가 실행 엔진 §9.1/§9.2
전역 네이밍 규약의 예외 목록에서 빠진 것)은 실제 spec 파일을 직접 확인한 결과 여전히 유효한
cross-spec 충돌로 남아 있다. 둘 다 target 의 이번 작업(lint 게이트 복구, R8 캐시 스코프 구현)
스코프 밖이며 명시적으로 planner 인계로 남겨져 있어, 이 PR/문서 자체를 막을 필요는 없다.

## 위험도
MEDIUM
