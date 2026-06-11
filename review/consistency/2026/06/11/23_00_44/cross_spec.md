# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/4-nodes/4-integration/` (0-common, 1-http-request, 2-database-query, 3-send-email)
**검토 모드**: --impl-done, diff-base=origin/main
**검토 일시**: 2026-06-11

---

## 발견사항

### 1. **[CRITICAL]** `INTEGRATION_NOT_FOUND` 에러의 라우팅 정의 충돌

- **target 위치**: `spec/4-nodes/4-integration/0-common.md §4.2` (D4 결정) — "모든 `IntegrationError.code` 는 `output.error.code` 로 surface 된다. `IntegrationError` 가 throw → 노드 실행 실패 경로는 존재하지 않는다."
- **충돌 대상**: `spec/2-navigation/4-integration.md §14.1` 에러 코드 vocabulary 표
  - 해당 표 line 1073: `| INTEGRATION_NOT_FOUND | integrationId가 존재하지 않거나 타 워크스페이스 소속 | Usage 로그 기록(failed) + **노드 실패** |`
- **상세**: `4-integration.md §14.1` 은 `INTEGRATION_NOT_FOUND` 가 "노드 실패"(throw → workflow failed 경로)를 일으킨다고 기술한다. 그러나 target `0-common.md §4.2` 는 D4 결정으로 모든 IntegrationError 가 `port:'error'` 로 라우팅된다고 명시한다. 또한 target 은 "별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다 — `requireEntity` 는 `NotFoundException`(`RESOURCE_NOT_FOUND`)을 throw 해 `INTEGRATION_CALL_FAILED`(`EMAIL_SEND_FAILED`)로 흡수된다"고 추가 설명한다. `4-integration.md §14.1` 표는 D4 이전 상태 그대로다.
- **제안**: `spec/2-navigation/4-integration.md §14.1` 에러 코드 vocabulary 표를 D4 결정 기준으로 갱신. (a) `INTEGRATION_NOT_FOUND` 행의 영향 컬럼을 "→ `INTEGRATION_CALL_FAILED`/`EMAIL_SEND_FAILED` 로 흡수 — `error` 포트로 라우팅"으로 수정. (b) D4 결정 설명 추가. (c) 표에서 "노드 실패"(throw 경로)로 기술된 모든 항목 재검토.

---

### 2. **[WARNING]** `HTTP_BLOCKED` 코드가 에러 카탈로그(`spec/5-system/3-error-handling.md §1.4`)에 누락

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §6` 에러 코드 표 및 `§5.8(D4)` — `HTTP_BLOCKED` 가 정식 런타임 에러 코드로 정의됨
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` 노드 수준 런타임 에러 카탈로그 — HTTP 카테고리 행이 `HTTP_TRANSPORT_FAILED · HTTP_4XX · HTTP_5XX · HTTP_TIMEOUT` 만 열거하고 `HTTP_BLOCKED` 가 없음
- **상세**: target 이 D4 결정으로 `HTTP_BLOCKED`(SSRF 차단 전 인증 방식 공통)를 정식 `output.error.code`로 확립했지만, 에러 코드 카탈로그 SoT(`3-error-handling.md §1.4`)에는 이 코드가 등재되지 않았다. `spec/2-navigation/4-integration.md §14.1` 및 `spec/2-navigation/4-integration.md Rationale "SMTP SSRF …"`에서 `HTTP_BLOCKED`를 언급하지만 공식 카탈로그 항목이 아니어서 참조 일관성이 깨진다. `EMAIL_HOST_BLOCKED`도 동일하게 카탈로그 Email 행에 이미 등재돼 있으나 `HTTP_BLOCKED`가 누락된 비대칭이 있다.
- **제안**: `spec/5-system/3-error-handling.md §1.4` HTTP 카테고리 행에 `HTTP_BLOCKED` (SSRF 차단 — loopback/RFC1918/link-local/CGNAT/IPv6 ULA, `ALLOW_PRIVATE_HOST_TARGETS` opt-out)를 추가 등재.

---

### 3. **[WARNING]** Database Query SSRF 차단 에러 코드 명명 비일관

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md §4` SSRF 가드 callout — "차단 시 코드는 전용 코드 없이 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다 (HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 달리 driver 도메인 전용 코드 미정의 — 향후 통일 후보)"
- **충돌 대상**: `spec/4-nodes/4-integration/1-http-request.md §4` (SSRF 차단 → `HTTP_BLOCKED`), `spec/4-nodes/4-integration/3-send-email.md §6` (SSRF 차단 → `EMAIL_HOST_BLOCKED`), `spec/5-system/3-error-handling.md §1.4` Email 행 (`EMAIL_HOST_BLOCKED` 등재)
- **상세**: 동일한 `ALLOW_PRIVATE_HOST_TARGETS` 메커니즘으로 SSRF를 차단하지만 노드마다 에러 코드가 다르다. HTTP → `HTTP_BLOCKED`, Email → `EMAIL_HOST_BLOCKED`, Database → `INTEGRATION_CALL_FAILED`(fallback). target 이 "향후 통일 후보"로 인식했으나 코드 카탈로그·워크플로 분기 조건이 노드마다 달라 사용자 분기 로직 혼란을 야기한다. `spec/4-nodes/4-integration/_product-overview.md` 및 `spec/2-navigation/4-integration.md §14.1`도 Database의 SSRF 차단 코드를 별도 정의하지 않고 있어 cross-spec 공백이다.
- **제안**: Database Query 용 `DB_HOST_BLOCKED`(또는 공통 패턴 `DATABASE_HOST_BLOCKED`) 에러 코드를 신설하고 (a) `2-database-query.md §4` SSRF callout, (b) `2-database-query.md §6.2` 에러 코드 표, (c) `3-error-handling.md §1.4` Database 카테고리 행을 동기화. 신설 전까지는 target 현황 그대로 Planned 로 유지.

---

### 4. **[WARNING]** `spec/2-navigation/4-integration.md §14.1` 핸들러 실패 시 `IntegrationError` throw 기술이 D4 결정과 모순

- **target 위치**: `spec/4-nodes/4-integration/0-common.md §4.2` D4 결정 — "D4 이후 `IntegrationError` 가 throw → 노드 실행 실패 경로는 존재하지 않으며, 모든 `IntegrationError.code` 는 `output.error.code` 로 surface 된다"
- **충돌 대상**: `spec/2-navigation/4-integration.md §14.1` 세 번째 불릿 — "실패 시 핸들러는 `IntegrationError(code, message)` 를 **throw** 하며 `Integration.status`·`last_error` 가 함께 갱신된다"
- **상세**: `4-integration.md §14.1` 은 핸들러 런타임 실패를 여전히 "throw" 로 기술한다. D4 결정 이후 핸들러 내부에서 catch → `port:'error'` 라우팅 패턴으로 전환됐으므로 이 기술은 사실과 다르다. 또한 `Integration.status`·`last_error` 갱신이 throw 경로가 아니라 Usage 로그(logUsage) 경로에서 이뤄지는지 여부도 목적 불분명하게 서술된다.
- **제안**: `spec/2-navigation/4-integration.md §14.1` 세 번째 불릿을 D4 기준으로 갱신 — "실패 시 핸들러는 `port:'error'` + `output.error.{code, message, details?}` 로 라우팅하고 `logUsage({ status: 'failed', error })` 를 기록한다 (throw 경로 없음 — D4 결정)."

---

### 5. **[INFO]** `spec/2-navigation/4-integration.md §14.1` 에 `HTTP_BLOCKED` 에러 코드 미등재

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §6` — `HTTP_BLOCKED` 런타임 에러 코드 정의
- **충돌 대상**: `spec/2-navigation/4-integration.md §14.1` 에러 코드 vocabulary 표 (line 1083-1084) — `HTTP_{status}` / `HTTP_TRANSPORT_FAILED` 는 있으나 `HTTP_BLOCKED` 미등재
- **상세**: `4-integration.md §14.1` 는 통합 에러 코드의 vocabulary 표를 제공하는데, D4로 신설된 `HTTP_BLOCKED`(전 인증 방식 SSRF 차단)가 누락됐다. 참조하는 개발자/운영자가 이 코드를 인식하지 못할 수 있다.
- **제안**: `spec/2-navigation/4-integration.md §14.1` 에러 코드 vocabulary 표에 `HTTP_BLOCKED` 항목 추가.

---

### 6. **[INFO]** `meta.durationMs` 명명 통일 내용이 `spec/5-system/4-execution-engine.md` 과 동기화 확인 필요

- **target 위치**: `spec/4-nodes/4-integration/0-common.md §6.1` — `meta.durationMs` 로 통일 (breaking: `http_request` 의 `meta.duration` 폐지)
- **충돌 대상**: `spec/5-system/4-execution-engine.md` (line 466·1109·1117) — `durationMs` 로 참조하나 `meta.duration` 의 legacy alias가 spec 본문에 잔존 가능성 있음
- **상세**: 실행 엔진 spec은 `durationMs` 를 사용하고 있어 target의 통일과 방향이 일치하나, spec/5-system/4-execution-engine.md §10 Integration Handler 계약이 `meta.durationMs` 단일 필드로 명시적으로 갱신됐는지 확인 필요. Breaking change 주석이 `0-common.md §6.1`에만 있어 실행 엔진 계약 §10의 동기화 여부가 불분명하다.
- **제안**: `spec/5-system/4-execution-engine.md §10` Integration Handler 계약에서 `meta.duration`(구 http_request 필드) 폐지 내용을 명시 동기화.

---

## 요약

Cross-Spec 일관성 관점에서 가장 중요한 충돌은 D4 결정(IntegrationError → `port:'error'` 라우팅 전환)이 `spec/2-navigation/4-integration.md §14.1`에 아직 반영되지 않은 것이다. 해당 섹션은 `INTEGRATION_NOT_FOUND`를 여전히 "노드 실패"(throw 경로)로 기술하며 핸들러 실패도 "throw"로 묘사해, target 의 D4 결정과 직접 모순된다. 이는 동일 문서를 참조하는 통합 관리 화면·워크플로 에디터 개발자에게 혼란을 줄 수 있다(CRITICAL). 추가로 `HTTP_BLOCKED` 에러 코드가 공식 에러 카탈로그(`spec/5-system/3-error-handling.md §1.4`)에 누락되어 있고, Database Query의 SSRF 차단 코드만 HTTP/Email과 달리 generic `INTEGRATION_CALL_FAILED`를 사용해 사용자 분기 일관성이 깨진다(WARNING × 2). 이 3건은 target 구현 자체의 오류가 아니라 인접 spec 문서의 동기화 지연이므로, 관련 spec 파일을 함께 갱신하면 모순이 해소된다.

---

## 위험도

**MEDIUM**

(CRITICAL 1건은 인접 spec 동기화 지연 — 구현을 블록하지는 않으나 `spec/2-navigation/4-integration.md §14.1`이 공식 참조 문서로 사용되면 D4 결정과 정면 모순되는 오독 리스크가 있다. WARNING 2건은 에러 코드 카탈로그 공백 및 명명 비일관으로 운영·디버깅 혼란 요인.)

---

## 참조 파일

- `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/0-common.md`
- `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/1-http-request.md`
- `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/2-database-query.md`
- `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/3-send-email.md`
- `/Volumes/project/private/clemvion/spec/2-navigation/4-integration.md`
- `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md`
- `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md`
- `/Volumes/project/private/clemvion/spec/conventions/error-codes.md`
