# Cross-Spec 일관성 검토 — `spec/5-system/14-external-interaction-api.md`

검토 모드: `--impl-prep` (scope=`spec/5-system/`)

## 스코프 메모

현재 target 파일의 **미커밋 diff 는 2줄**(§6 필드 집합 표의 `durationMs` 행 Rationale
보강 · §6.4 blockquote 의 `code` nullable 근거 보강)뿐이다. 두 diff 모두 실측(`3-error-handling.md`
§1.4 의 에러코드 목록, `6-websocket-protocol.md` L206 의 `duration`/`durationMs` 표기차 caveat)과
직접 대조했고 **모순 없음** — `WORKER_HEARTBEAT_TIMEOUT`/`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/
`WEBCHAT_IDLE_TIMEOUT` 전부 `3-error-handling.md` 에 동일 이름·동일 귀결(`failed`/`cancelled`)로
등재돼 있다.

아래 발견사항은 diff 가 아니라 **target 전체 문서**(bundle 로 제공된 파일 전문)를 다른
`spec/5-system/**` 파일과 대조하며 찾은, **이미 커밋에 존재하던** 두 건의 drift다. 둘 다
이번 세션의 편집으로 생긴 것은 아니지만, target 문서가 "Cross-Spec 검토 대상" 이므로 보고한다.

---

## 발견사항

### [WARNING] EIA-NX-03 / R12 가 V066 로 폐기된 `hmacAlgorithm` 필드를 현재형으로 인용

- target 위치: `spec/5-system/14-external-interaction-api.md` §3.1 `EIA-NX-03` (표 행) ·
  `## Rationale` → `### R12. HMAC 알고리즘 표기 — inbound vs outbound 분리`
- 충돌 대상: 같은 파일 §7.1 의 `Trigger.config` 스키마 블록(주석) · `spec/5-system/12-webhook.md`
  §4.2 (라인 167, 229)
- 상세:
  - `EIA-NX-03` 은 "알고리즘 식별자는 Webhook §4.2 의 화이트리스트 표기(`sha256`/`sha512`)와
    동일 값을 **trigger config 에 보관하되 (`hmacAlgorithm: 'sha256'`)**, 외부 표면
    (`notification.signing.algorithm`)에서는 `hmac-sha256` prefix 형태로 노출한다" 고 적고,
    `R12` 도 "inbound webhook HMAC 검증(Webhook §4.2)은 `hmacAlgorithm: 'sha256'|'sha512'`" 라고
    반복한다. 둘 다 `git blame` 상 PR #228(최초 spec 도입) 원문 그대로이며 그 뒤 갱신된 적이 없다.
  - 그러나 같은 파일 §7.1 의 실제 `Trigger.config` 확장 필드 스키마(§7.1 jsonc 블록, "SoT: 5-system/12-webhook.md
    §inline auth path 폐지")는 명시적으로 "옛 inline auth 필드(`authType`/`secret`/`bearerToken`/
    `hmacHeader`/`hmacAlgorithm`)는 폐지됐고 **V066 cleanup migration 으로 제거된다** — 잔존 row 에
    남아 있어도 코드는 무시한다" 고 적고, 실제 저장 형태는 `notification.signing.algorithm: "hmac-sha256"`
    (prefix 포함)뿐 — `hmacAlgorithm` 이라는 키는 스키마 어디에도 없다.
  - `12-webhook.md` L167 도 동일하게 확인해 준다 — 옛 inline `config.hmacAlgorithm` (트리거
    레벨)은 V066 으로 제거됐고, 현재 inbound HMAC 검증 필드는 `AuthConfig.config.algorithm`
    (자격증명 메타, 트리거가 아니다)이다. L229 도 그 필드를 "`config.algorithm` 은 `sha256`,
    `sha512` 만 허용" 으로 부른다 — `hmacAlgorithm` 이 아니다.
  - 즉 `EIA-NX-03`/`R12` 는 (a) 이미 제거된 필드명(`hmacAlgorithm`)을 현재형으로 인용하고,
    (b) 그 필드가 어느 엔티티(Trigger vs AuthConfig)에 속하는지도 target 자신의 §7.1 및
    `12-webhook.md` 와 어긋난다. 세 서술(요구사항 표 / Rationale / §7.1 스키마)이 서로 다른
    필드명·소유 엔티티를 가리키는 셈이라 구현자가 "inbound 와 동일 값" 을 어디서 읽어야 하는지
    (`AuthConfig.config.algorithm` vs 존재하지 않는 `hmacAlgorithm`) 헷갈릴 수 있다.
- 제안: `EIA-NX-03`/`R12` 의 `hmacAlgorithm: 'sha256'` 예시를 `AuthConfig.config.algorithm`
  (inbound, bare `sha256`/`sha512`) 참조로 교체하거나, §7.1 스키마가 이미 보여주듯 outbound
  저장값 자체가 `hmac-sha256` prefix 로 직접 저장된다면("bare 내부 보관 → prefix 외부 노출" 이라는
  2단 변환이 실제로는 없다면) 그 문장 전체(분리 근거 R12 포함)를 스키마 현실에 맞게 재작성.
  기능 동작(실제 검증 로직)은 §7.1/§4.2 를 따르면 맞으므로 CRITICAL 은 아니나, 요구사항 문구
  자체가 오도하므로 정정 권장.

### [WARNING] §11 WS↔외부 명령 매핑 표의 `execution.stop` 행이 "권위 표" 의 won't-do 주석을 누락

- target 위치: `spec/5-system/14-external-interaction-api.md` §11 "WebSocket 명령 ↔ 외부 명령
  매핑" 도입부("본 spec 의 §5.1 의 표가 그 권위 표와 정합해야 한다") 및 바로 아래 표의
  `execution.stop` 행
- 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.6 "외부 표면 매핑" 의 `execution.stop` 행
  (PR #859 `74a744f4a` 에서 갱신)
- 상세: target §11 은 자신의 매핑 표가 WS 문서 §4.6 의 "권위 표" 와 1:1 로 정합해야 한다고
  명시하는데, 실제로는 표기가 다르다.
  - WS §4.6 (권위 표, #859 갱신본): `` `execution.stop` _(WS 명령 §4.2 won't-do)_ | `cancel`
    (또는 `POST /api/external/executions/:id/cancel` alias) | WS 명령은 미채택 — 개념(실행
    중단) 매핑. 내부/외부 모두 REST. force 옵션은 외부에서 미지원 ``
  - target §11 (PR #228 원문 그대로, 이후 미갱신): `` `execution.stop` | `cancel` | `force`
    옵션은 외부에서 미지원 `` — "(WS 명령 §4.2 won't-do)" 주석이 없다.
  - `git blame` 확인: WS 문서 쪽은 #859("SSE replay_unavailable emit + WS 4종 won't-do 종결")에서
    이 주석이 추가됐고, target §11 의 해당 행은 그 이전(#228)부터 한 번도 갱신되지 않았다 —
    두 "정합해야 한다" 는 표가 실제로 비대칭 갱신을 겪은 사례.
  - 같은 표 안에서 `execution.start` 는 "(해당 없음) — 외부 인터페이스에서 지원 안 함" 으로
    명확히 "WS 명령 자체가 없다" 는 뜻을 표시하는데, `execution.stop` 은 (WS 명령이 마찬가지로
    없음에도) 다른 실제 WS 명령들(`submit_form` 등)과 동일한 행 형식으로 나열돼 있어, target
    §11 만 읽으면 `execution.stop` 이 내부적으로 존재하는 WS 명령을 facade 하는 것처럼 오독될
    수 있다. §3.2 EIA-IN-02 본문은 정확히 이 사실("§4.2 에서 비채택")을 명시하므로 문서 내
    다른 절과도 표현 수준이 어긋난다.
- 제안: target §11 표의 `execution.stop` 행에 WS §4.6 과 동일한 `_(WS 명령 §4.2 won't-do)_`
  주석을 추가해 두 "권위 표" 를 실제로 동기화. 별도 스펙 변경 없이 문구 정합화만 필요.

---

## 요약

Target(`14-external-interaction-api.md`)은 `spec/5-system/**`(특히 `1-data-model.md`,
`2-api-convention.md`, `3-error-handling.md`, `4-execution-engine.md`, `6-websocket-protocol.md`,
`12-webhook.md`, `15-chat-channel.md`, `7-channel-web-chat/3-auth-session.md`)와 데이터 모델
(Trigger/Execution/ExecutionToken 필드), 감사 액션명, 에러코드 어휘, seq 카운터 계약, rate-limit
버킷·Redis 키, CORS origin allowlist, RBAC(Admin+ 편집 권한) 전반에서 **높은 밀도로 정합**돼 있다 —
반복 리뷰 이력(PR #859/#946/#950/#1145/#1149/…) 이 축적한 상호 참조가 대부분 그대로 유지된다.
이번 세션의 실제 미커밋 diff(2줄, `durationMs`/`error.code` Rationale 보강)는 `3-error-handling.md`
및 `6-websocket-protocol.md` 의 기존 서술과 모순되지 않는다. 다만 문서 전체를 다른 영역과 대조하는
과정에서, PR #228 원문 이후 한 번도 갱신되지 않은 **두 곳의 stale 인용**(폐기된 `hmacAlgorithm`
필드명 · WS §4.6 의 won't-do 주석 누락)을 발견했다 — 둘 다 기능을 깨지는 않지만 target 이
스스로 "권위 표/동일 값과 정합해야 한다" 고 선언한 지점에서 실제로는 어긋나 있어 WARNING 으로
등재한다.

## 위험도

LOW
