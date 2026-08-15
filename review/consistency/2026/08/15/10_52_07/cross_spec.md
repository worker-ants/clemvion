# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 요약

이번 diff(`origin/main...HEAD`)의 실질 변경은 EIA 종결 이벤트(`execution.completed`/
`failed`/`cancelled`) 의 `durationMs` 필드 구현(16 경로 전체, 그중 엔티티 미로드 5경로는
SQL `RETURNING`)과 `spec/5-system/14-external-interaction-api.md` §12 의 Re-run API 경로
오탈자(`/api/v1/executions/...` → `/api/executions/...`) 정정이다. 이 변경분은
`spec/3-workflow-editor/3-execution.md`(이벤트 필드 표) · `spec/conventions/chat-channel-adapter.md`
(`EiaEvent` union `durationMs?: number | null`) · `codebase/backend/.../chat-channel/types.ts`
세 곳 모두 동기화되어 있고, `spec/1-data-model.md` 의 `duration_ms Integer?` 컬럼 타입과
새 SQL 의 int4 클램프(`LEAST(2147483647, …)`)도 정합했다. **diff 자체가 만든 새로운
cross-spec 충돌은 발견되지 않았다.**

다만 target 문서(`spec/5-system/14-external-interaction-api.md`) 및 그 직접 인접 영역을
전수 대조하는 과정에서, diff 밖에 있는 **기존(pre-existing) cross-spec 충돌**을 하나
새로 확인했고(§8.2 HMAC 화이트리스트), 이전 라운드(`09_00_27` cross_spec)가 이미 등재했으나
아직 미해소인 항목 2건을 재확인했다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
에 `- [ ]` 로 남아 있어 추적은 되고 있으나, 파일 자체는 여전히 어긋난 상태이므로 이번 라운드
결과에도 포함한다.

---

## 발견사항

### [WARNING] EIA §8.2 HMAC 알고리즘 화이트리스트가 같은 문서·인접 문서·코드와 모순

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §8.2 "HMAC 검증 일반 규약"
  (894–899행) — `- algorithm whitelist: \`hmac-sha256\` 만. v2 추가 시 \`v2=\` prefix 로 병행`
- **충돌 대상**:
  - 같은 문서 §3.1 `EIA-NX-03`(57행): "알고리즘 식별자는 [Webhook §4.2] 의 화이트리스트 표기
    (`sha256`/`sha512`) 와 동일 값을 … 외부 표면에서는 `hmac-sha256`/`hmac-sha512` 의 명시적
    prefix 형태로 노출"
  - 같은 문서 §Rationale R12(1279행): "각 경로에서 algorithm 화이트리스트는 `sha256`/`sha512`
    만 (둘 다)."
  - `spec/data-flow/15-external-interaction.md` §1.4: "알고리즘 `hmac-sha256`(default) /
    `hmac-sha512`"
  - 코드 SoT `codebase/backend/src/modules/external-interaction/notification-signature.util.ts:11`
    — `export type SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512';`
- **상세**: §8.2 는 "화이트리스트는 `hmac-sha256` 만" 이라고 절대적으로 서술하지만, 같은 문서의
  `EIA-NX-03`·`R12`, 그리고 별도 파일인 data-flow 문서와 실제 구현 타입은 모두 `hmac-sha256`
  **과** `hmac-sha512` 둘 다를 정식 화이트리스트로 못박고 있다. `v2 추가 시 v2= prefix 로 병행`
  이라는 문구는 이미 sha512 가 "미래" 가 아니라 **현재** 지원되는 값임을 감안하면 시점이 지난
  서술이며, 헤더 버저닝(`v2=`)과 secret rotation 시의 이중 서명(`v1=` 두 개 동봉,
  data-flow §1.4)도 서로 다른 메커니즘을 혼동시킬 소지가 있다. 실행에는 영향 없다(코드·
  §3.1·R12·data-flow 넷이 모두 sha256/sha512 둘 다로 일치하므로 §8.2 가 outlier) — 그러나
  보안 섹션(§8) 안에서 "화이트리스트" 를 자기모순으로 서술하면 감사·클라이언트 구현자가
  §8.2 만 읽고 sha512 를 거부 대상으로 오인할 수 있다.
- **제안**: `spec/5-system/14-external-interaction-api.md` §8.2 를 `EIA-NX-03`/`R12` 와
  동일하게 "algorithm whitelist: `hmac-sha256` / `hmac-sha512`(§R12)" 로 정정하고,
  "v2 추가 시 v2= prefix" 문구는 삭제하거나 실제 rotation 표기(`v1=` 두 개 동봉, secret
  버전이지 알고리즘 버전이 아님)와 구분되게 다시 쓴다.

### [WARNING] `spec/5-system/15-chat-channel.md` 가 `InteractionRequestContext` 를 옛 형태(단일 인터페이스+optional `scope`)로 서술 — EIA §3.3.1 의 discriminated union 과 불일치

- **target 위치**: (target 영역과 인접한 동일 `spec/5-system/` 파일) `spec/5-system/15-chat-channel.md`
  §5.1 319행, §8 507행
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §3.3.1 (`ExternalInteractionRequestContext`
  / `InternalInteractionRequestContext` union + `isInternalCtx()`, "v1 구현 완료" 로 명시)
- **상세**: 15-chat-channel.md 319행은 "`InteractionRequestContext` 의 `scope: 'in_process_trusted'`
  플래그가 set 된 경우만 …" 이라 하나의 인터페이스에 optional `scope` 필드가 달린 것처럼
  서술하고, 507행("`InteractionRequestContext` 에 `scope?: 'in_process_trusted'` optional
  필드만 추가")도 동일한 낡은 모델을 반복한다. 그러나 EIA §3.3.1 은 이미 이를 두 개의 분리된
  인터페이스(`External…`/`Internal…`) 의 union 으로 재정의했고 코드(`interaction.guard.ts`)도
  그렇게 구현되어 있다 — 토큰 우회(`scope`)가 개별 optional 필드가 아니라 **타입 자체가
  다른 갈래**라는 것이 EIA 쪽의 현재 계약이다. 토큰-우회 관련 타입이라 보안 민감도가 있으나,
  실측 결과 이는 **문서 stale 이며 런타임 결함은 아니다**(코드는 EIA §3.3.1 대로 union 을
  이미 사용).
- **참고**: 이 항목은 이전 라운드(`review/consistency/2026/08/15/09_00_27/cross_spec.md`)가
  이미 발견해 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "타 문서가 EIA 의
  현재 형태를 못 따라간 서술" 절에 `- [ ]` 로 등재했다. 이번 diff 는 이 두 파일을 건드리지
  않았으므로 **여전히 미해소** 상태다 — 재확인 차원에서 이번 라운드에도 포함한다.
- **제안**: 15-chat-channel.md §5.1·§8 서술을 `InteractionRequestContext` union 타입에 대한
  EIA §3.3.1 cross-link 로 교체(내용을 다시 베끼지 않고 포인터만 둠 — 같은 계약을 두 곳에
  적어 두면 drift 가 재발한다는 것이 이 저장소의 반복 교훈).

### [WARNING] EIA §5.1 이 `12-webhook.md` §5.2 를 "legacy `statusCode/errors` 형식" 이라 서술하지만 실제로는 이미 신컨벤션

- **target 위치**: `spec/5-system/14-external-interaction-api.md` 317행 — "12-webhook §5.2 의
  `statusCode/errors` shape 는 webhook 호출 진입점 전용 legacy 형식 — 본 spec 의 신규
  endpoint 는 신컨벤션 채택"
- **충돌 대상**: `spec/5-system/12-webhook.md` §5.2 "400 응답 형식" (295행) — "`GlobalExceptionFilter`
  가 이를 프로젝트 공식 에러 봉투(`{ error: { code, message, requestId, details? } }`)로
  직렬화" — **이미 신컨벤션과 동일한 shape**
- **상세**: `12-webhook.md` §5.2 는 이미 2026-06-28(`7e181ed8e`, `plan/in-progress/spec-sync-...`
  에 기록됨)에 `{error:{code,message,details}}` 로 정합화됐다. EIA §5.1 은 여전히 두 표면이
  다른 형식("legacy `statusCode/errors`" vs "신컨벤션")이라고 대비시키는데, 이는 사실이 아니게
  됐다 — 두 endpoint 군 모두 같은 에러 봉투를 쓴다. 실제 동작 오류는 없지만(둘 다 신컨벤션을
  따르므로), 대비 서술 자체가 독자에게 "webhook 호출 진입점은 아직 옛 shape" 라는 그릇된
  인상을 준다.
- **참고**: 이 항목도 `09_00_27` cross_spec 라운드가 이미 발견해 같은 plan 파일에 등재했고,
  이번 diff 는 이 문장을 건드리지 않았다 — 여전히 미해소.
- **제안**: 317행의 legacy 대비 문구를 삭제하거나 "과거에는 달랐으나 2026-06-28 정합화 이후
  양쪽 모두 동일 컨벤션" 으로 정정.

### [INFO] `spec/data-flow/15-external-interaction.md:119` 가 정의되지 않은 `EIA-AU-09` 를 참조

- **target 위치**: (인접 data-flow 문서) `spec/data-flow/15-external-interaction.md` 119행
  — "`interaction.guard.ts` EIA-AU-08/09"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §3.3 인증 요구사항 표 —
  `EIA-AU-01` ~ `EIA-AU-08` 까지만 정의, `EIA-AU-09` 는 존재하지 않음
- **상세**: dangling 요구사항 ID 참조. 실제 근거는 `EIA-AU-08`(in-process trusted caller
  예외) 하나뿐이며 `/09` 는 오탈자로 보인다.
- **참고**: `09_00_27` cross_spec 라운드가 이미 (INFO) 로 등재. 이번 diff 밖이라 미해소 유지.
- **제안**: `EIA-AU-08/09` → `EIA-AU-08` 로 정정.

---

## 요약

이번 diff(durationMs 종결 payload 구현 + Re-run 경로 오탈자 정정)는 관련된 세 spec/코드
표면(3-execution.md 이벤트 표·chat-channel-adapter.md 의 `EiaEvent` union·chat-channel
`types.ts`)과 정확히 동기화되어 있어 diff 자체가 새로 만든 cross-spec 충돌은 없다. 다만
target 영역 전수 대조에서 §8.2 HMAC 화이트리스트가 같은 문서의 §3.1/R12·인접
data-flow 문서·실제 코드와 모순되는 것을 새로 확인했고(WARNING), 이전 라운드가 발견한
`15-chat-channel.md` 의 `InteractionRequestContext` 구형 서술과 EIA §5.1 의 webhook
"legacy" 오분류 두 건(둘 다 WARNING, 보안/계약 서술 오류이나 런타임 결함 아님으로 확인됨)이
여전히 미해소로 남아 있어 재확인 차원에서 함께 보고한다. `EIA-AU-09` dangling 참조는
INFO 로 유지. 넷 다 이번 PR 을 막을 만한 CRITICAL 은 아니며(실제 동작에는 다른 정합한
서술/코드가 이미 진실을 담고 있음), spec 텍스트 자체의 신뢰도 문제로 별도 스펙 정정
커밋이 필요하다.

## 위험도

MEDIUM
