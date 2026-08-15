# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md` (--impl-prep)

## 검토 방법 메모

프롬프트 번들은 컨텍스트 예산 초과로 target 문서(`14-external-interaction-api.md`)와
`spec/0-overview.md` 를 제외한 **모든 관련 spec 본문이 절단**되어 있었다(17개 `5-system/*`
파일 + `1-data-model.md`·`2-navigation/**`·`4-nodes/**`·`7-channel-web-chat/**`·
`data-flow/**` 전체). 번들에 없다는 사실을 "충돌 없음" 의 근거로 삼지 않기 위해, 저장소의
실제 spec 파일을 `Read`/`grep` 로 직접 열어 target 이 인용하는 교차 참조 20여 건을 개별
대조했다 (`1-auth.md` §4.1, `12-webhook.md` §4.2/inline-auth 폐지, `4-execution-engine.md`
§1.1/§7.4/§7.5/§7.5.1/§8, `3-error-handling.md` §1.4, `6-websocket-protocol.md` §4.6,
`15-chat-channel.md` CCH-*, `data-flow/15-external-interaction.md`, `1-data-model.md` §2.2
Workspace, `conventions/redis-keys.md`, `conventions/swagger.md`).

## 발견사항

- **[WARNING]** `notification_url_allow_pattern` 필드가 `Workspace.settings` SoT 인벤토리에 없다
  - target 위치: §8.1 SSRF 방지 — `- 워크스페이스 단위 allowlist/blocklist 설정 가능 (workspace_settings.notification_url_allow_pattern)`
  - 충돌 대상: `spec/1-data-model.md` §2.2 `Workspace.settings` 알려진 키 목록
  - 상세: `1-data-model.md` 의 `Workspace.settings` known-keys 인벤토리는 `timezone` / `interactionAllowedOrigins` / `maxConcurrentExecutions` **셋만** 등재한다(모두 camelCase, 각 키마다 소유 spec·편집 API 를 명시). target §8.1 이 언급하는 `notification_url_allow_pattern` 은 (a) 이 인벤토리에 없고 (b) 형제 키들과 달리 snake_case 라 같은 JSONB blob 안에서 명명 컨벤션이 어긋난다. 이 문서는 다른 모든 미구현 항목(`interaction` 블록, `result.outputs` 등)을 "**미구현 (Planned)**" 로 명시적으로 표기하는데, 이 필드만 그 표기 없이 실재하는 설정처럼 서술되어 있어 구현 여부가 불명확하다. `EIA-NX-10`(§3.1, "워크스페이스 단위 allowlist 설정 가능")도 같은 근거 없는 서술을 공유한다.
  - 제안: `1-data-model.md` §2.2 에 이 키를 정식 등재하거나(이름을 `interactionAllowedOrigins` 형제 컨벤션에 맞춰 camelCase 로), 아직 미구현이면 target §8.1/§3.1 에 다른 항목과 동일하게 "**미구현 (Planned)**" 표기를 추가한다.

- **[WARNING]** outbound 서명 알고리즘 내부 저장 필드명이 §7.1 실제 JSONB 스키마와 스스로 어긋나며, 웹훅 spec 이 "폐기됨" 이라 명시한 필드명을 재사용한다
  - target 위치: §3.1 EIA-NX-03 (`hmacAlgorithm: 'sha256'` 로 trigger config 에 보관한다는 서술) vs §7.1 Trigger 엔티티 확장의 실제 JSONB 예시(`"signing": { "algorithm": "hmac-sha256", ... }`)
  - 충돌 대상: `spec/5-system/12-webhook.md` §167 / §481~488 — `trigger.config` 의 inline 필드 `authType`/`secret`/`bearerToken`/`hmacHeader`/`hmacAlgorithm` 은 `V066__trigger_config_strip_inline_auth.sql` 로 **제거됐고 코드가 무시한다**고 명시
  - 상세: EIA-NX-03 은 "알고리즘 식별자는 Webhook §4.2 화이트리스트 표기(`sha256`/`sha512`)와 동일 값을 trigger config 에 보관하되(`hmacAlgorithm: 'sha256'`), 외부 표면(`notification.signing.algorithm`)에서는 `hmac-` prefix 로 노출한다"고 적어 **내부 저장은 bare form, 외부 노출만 prefix form** 이라는 전제를 세운다. 그런데 바로 아래 §7.1 이 보여주는 실제 `Trigger.config.notification.signing.algorithm` 필드는 `"hmac-sha256"` (prefix 형태 그대로)를 저장한다 — EIA-NX-03 이 서술하는 "내부는 bare" 전제와 §7.1 예시가 자기모순이다. 게다가 `hmacAlgorithm` 이라는 이름 자체가 `12-webhook.md` 에서 V066 로 명시적으로 폐기된 inline 필드명과 문자 그대로 동일해, 코드 검색·리뷰 시 "이미 죽은 필드가 되살아났나"라는 혼동을 부를 수 있다.
  - 제안: EIA-NX-03 의 괄호 서술(`hmacAlgorithm: 'sha256'`)을 §7.1 의 실제 스키마(`notification.signing.algorithm: 'hmac-sha256'`)에 맞춰 정정하거나, 정말 별도 bare-form 내부 필드를 의도했다면 `12-webhook.md` 가 이미 폐기 선언한 `hmacAlgorithm` 대신 다른 필드명(예: `notificationSigningAlgorithm`)을 쓰고 §7.1 JSONB 예시도 그 필드를 반영하도록 동기화한다.

- **[INFO]** EIA §11 WS↔REST 명령 매핑 표가 권위 표(WS §4.6) 의 부분집합만 미러링
  - target 위치: §11 "WebSocket 명령 ↔ 외부 명령 매핑" 표
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.6 "외부 표면 매핑" — "외부 spec 의 §11 표는 이 표와 정합해야 한다" 라고 스스로 권위를 선언
  - 상세: WS §4.6 은 `execution.retry_last_turn`(외부 미노출·향후 노출 예정), `auth.refresh`(외부는 `/refresh-token` 사용), `subscribe`/`unsubscribe`(execution 토큰이 implicit 구독) 세 행을 포함하지만, target §11 표에는 이 세 행이 없다(`retry_last_turn` 은 §3.2 EIA-IN-02 본문 prose 로만 언급됨). 값 자체의 모순은 아니고 표의 완전성 차이라 CRITICAL/WARNING 은 아니지만, "두 표가 정합해야 한다"는 명시적 불변식을 문자 그대로 지키려면 §11 표에도 세 행을 추가(또는 "본 표는 subset — 전체는 WS §4.6 참조"라는 명시적 캐비엇)가 필요하다.
  - 제안: §11 표에 누락 3행을 추가하거나, 표 상단에 "완전한 목록은 WS §4.6 이 SoT, 본 표는 EIA 활성 명령만 발췌" 캐비엇을 명시.

## 대조하여 충돌 없음을 확인한 항목 (참고)

아래는 target 이 인용하는 교차 참조를 실제 spec 파일과 직접 대조해 **정합을 확인**한 항목이다(번들 절단으로 검증이 필요했던 항목들 중 실측 완료분):

- `1-auth.md` §4.1 감사 액션 3종(`trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked`) — target EIA-NX-12/EIA-AU-07 과 일치
- `12-webhook.md` §4.2 `AuthConfig.config.algorithm` 화이트리스트(`sha256`/`sha512`) — target EIA-NX-03 의 inbound 측 인용과 일치 (위 WARNING 은 outbound 저장 필드 쪽 자기모순)
- `4-execution-engine.md` §1.1/§7.4/§7.5 — `cancelledBy='timeout'`+`EXECUTION_QUEUE_WAIT_TIMEOUT`, `cancelledBy='system'`+`RESUME_*`, `waiting_for_input→cancelled` "타임아웃" 사유 예약(EIA-RL-07 판정 근거) 모두 target §6/§9.3/R19 서술과 일치
- `3-error-handling.md` §1.4 — `EXECUTION_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED`/`MAX_ITERATIONS_EXCEEDED`/`CYCLE_DETECTED` 목록이 target §6.4 인용과 일치
- `6-websocket-protocol.md` §4.6 이벤트 매핑 표(제목·값) — target §11 이벤트 표와 사실상 동일(행 순서만 미세 차이, 의미 차이 없음)
- `15-chat-channel.md` CCH-AD-07/CCH-ERR-04/CCH-SE-02/R-CC-16 — target 이 인용하는 의미와 일치
- `data-flow/15-external-interaction.md` §1.2/§2.2 — `TOKEN_SCOPE_MISMATCH`/`TOKEN_AUDIENCE_MISMATCH` 매핑, idempotency 키 스코프(`interaction:idempotency:<executionId>:<route>:<key>`), `itk_*` refresh 403 모두 target R8/R14/§5.1 표와 일치
- `conventions/redis-keys.md` §3 — `eia:rl:interact:`/`eia:rl:status:`/`eia:notif:rl:`/`iext:blacklist:`/`interaction:idempotency:` 인벤토리가 target §8.4 와 일치
- `1-data-model.md` §2.2 — `interactionAllowedOrigins` 필드 정의가 target §8.5 CORS 서술과 일치

## 요약

`14-external-interaction-api.md` 는 이미 다수 라운드의 cross-spec 정합화를 거친 문서다(git 로그의
#1160~#1173 등 최근 커밋이 정확히 이 종류의 drift 를 순차 제거해 왔다). 실제로 20여 개의 교차
참조(감사 로그 액션명, HMAC 화이트리스트, 종결 상태·`cancelledBy`·에러코드 매핑, WS↔REST 이벤트
매핑, chat-channel 요구사항 ID, idempotency 키 스코프, Redis 키 인벤토리, Workspace 설정 필드)를
실제 spec 파일과 직접 대조한 결과 대부분 정합했다. 발견된 두 WARNING 은 (1) `notification_url_allow_pattern`
워크스페이스 설정 필드가 `1-data-model.md` 의 SoT 인벤토리에 미등재된 채 "구현됨"처럼 서술된 점,
(2) outbound 서명 알고리즘의 내부 저장 표기(EIA-NX-03)가 §7.1 자신의 JSONB 예시와 어긋나고 폐기된
webhook 필드명을 재사용하는 점이며, 둘 다 문서 정정으로 닫을 수 있는 범위다. 이번 --impl-prep 이
착수하려는 코드 변경(종결 이벤트 emit 타입 파사드 — `durationMs`/`error`/`cancelledBy`/`status`)이
직접 의존하는 §6 필드 계약·§9.3 트랜잭션 규약·chat-channel/execution-engine 교차 참조는 전부 정합이
확인되어, 그 작업 자체를 막을 만한 cross-spec 충돌은 없다.

## 위험도

LOW
