# Cross-Spec 일관성 검토 결과

**대상**: `spec/4-nodes/4-integration/1-http-request.md`
**검토 모드**: `--spec`
**검토 시각**: 2026-06-11

---

## 발견사항

### 1. **[WARNING]** 캔버스 요약 URL 잘림 한도 수치 불일치 — 35자 vs 40자

- **target 위치**: `§7. 캔버스 요약` — "URL 35자 초과 시 잘림"
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §5 캔버스 요약` — "라인 전체를 **40자** 한도(초과 시 마지막 1자를 `…` 로 치환)" + 표 내 HTTP Request 행 "라인 40자 초과 시 잘림"
- **상세**: `0-common.md`는 캔버스 요약의 잘림 단위가 "렌더된 한 줄 전체"이며 한도는 40자라고 명시한다. target spec은 같은 규칙을 "URL 35자 초과 시 잘림"으로 기술해 (a) 잘림 단위(URL 필드 개별 vs 라인 전체)와 (b) 수치(35 vs 40) 두 가지가 모두 다르다. `0-common.md`가 SoT(`codebase/frontend/src/lib/utils/node-config-summary.ts` 인용)이므로 target의 기술이 부정확하다.
- **제안**: target §7 을 `[공통 §5](./0-common.md#5-캔버스-요약) — HTTP Request 행: `{method} {url}`, 라인 전체 40자 초과 시 잘림.` 로 수정하고 "35자"를 제거한다.

---

### 2. **[WARNING]** `INTEGRATION_NOT_FOUND` 코드 존재 여부 — target 에서 실재하는 코드로 열거하나 0-common 에서 비존재 명시

- **target 위치**: `§5.8 (D4)` — "`INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / ..."; `§6 에러 코드` — `INTEGRATION_*` 설명에 `INTEGRATION_NOT_FOUND` 포함
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §4.2 공통 에러 코드` 및 note — "별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다 … `INTEGRATION_CALL_FAILED`로 surface 된다"
- **상세**: `0-common.md`는 integrationId 부재·소속 오류가 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` → catch fallback `INTEGRATION_CALL_FAILED`로 surface 됨을 명확히 기술한다. target spec은 이 코드가 실제로 surface 되는 것처럼 열거해 독자에게 존재하지 않는 에러 코드를 기대하게 한다.
- **제안**: target §5.8 및 §6 의 `INTEGRATION_NOT_FOUND` 열거를 제거하거나, `INTEGRATION_CALL_FAILED` (통합 없음·소속 오류의 실제 surface 코드)로 교체하고 `0-common.md §4.2` note 를 함께 참조한다.

---

### 3. **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` production 동작 — target 에서 warn/throw 분류 미언급

- **target 위치**: `§4 실행 로직 ALLOW_PRIVATE_HOST_TARGETS callout box` (§105 참조)
- **충돌 대상**: `spec/5-system/11-mcp-client.md §3.2` + `spec/5-system/1-auth.md §Rationale "Production fail-closed 가드"` — "`ALLOW_PRIVATE_HOST_TARGETS` 는 throw 가 아닌 warn — production 에서 켜져 있으면 부팅은 하되 경고 로그를 남긴다"
- **상세**: auth.md·mcp-client.md 가 `assertProductionConfig` 의 항목 분류(절대금지 = throw, 정당용도있는 = warn)를 명시하면서 `ALLOW_PRIVATE_HOST_TARGETS`를 warn 계열로 분류한다. target spec의 callout 은 "외부 egress 방화벽 전제"만 언급하고 production 에서의 warn 동작(부팅 허용·경고 로그)을 언급하지 않는다. 기능 모순은 아니나, production 운영자가 이 플래그를 설정할 때 부팅이 되는지 여부를 target spec만 읽어서는 알 수 없다.
- **제안**: target §4 callout box 에 "production 에서 설정 시 부팅은 허용되나 경고 로그 기록 (`assertProductionConfig` warn — `MCP_ALLOW_INSECURE_URL`의 throw 와 다름, [Spec Auth §Rationale](../../5-system/1-auth.md#rationale) 참조)" 한 줄을 추가한다.

---

### 4. **[INFO]** SSRF 가드 전 인증 방식 적용 변경 — `0-common.md` §7 출력 구조 색인의 SSRF 설명 동기화 여부 확인 권장

- **target 위치**: `§4 step 8`, `§8.2 Rationale`
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §7 출력 구조 색인` 내 http_request 행 — "4xx/5xx + transport + integration resolve 실패 + SSRF 차단 모두 통합"
- **상세**: `0-common.md §7` 의 http_request 에러 케이스 설명 ("SSRF 차단")은 target 변경 내용과 논리적으로 일치한다. 그러나 "none/custom 전 인증 공통 SSRF 가드"라는 새 문맥이 추가됐으므로 `0-common.md §7` 에도 인증 방식 불문 SSRF 차단을 명시적으로 언급하면 독자 혼동을 막을 수 있다. 현 기술이 틀리지는 않으나 새 결정의 가시성이 낮다.
- **제안**: `0-common.md §7` http_request 에러 케이스 설명을 "… + SSRF 차단 (authentication 방식 무관 — `none`/`integration`/`custom` 모두)" 으로 보강한다(선택).

---

## 요약

target 문서(`spec/4-nodes/4-integration/1-http-request.md`)는 기존 spec과 대체로 일관성을 유지하며, 핵심 변경(SSRF 가드 전 인증 방식 공통화·D4 에러 포트 라우팅)은 `0-common.md`·`2-database-query.md`·`3-send-email.md` 와 정합하게 기술되어 있다. 다만 두 가지 구체적 수치·코드 오류가 발견됐다: 캔버스 요약 잘림 한도(target 35자 vs `0-common.md` SoT 40자 라인 전체), 그리고 `INTEGRATION_NOT_FOUND` 코드가 존재하는 것처럼 열거되나 `0-common.md §4.2` 는 이 코드가 존재하지 않고 `INTEGRATION_CALL_FAILED`로 surface 됨을 명시한다. 두 WARNING 을 수정하면 spec 내부 모순이 해소된다.

---

## 위험도

**LOW**

(두 WARNING 모두 기존 SoT와 수치·코드명이 다르지만 실제 기능 동작에 직접 영향을 주는 구조적 충돌은 아님. 독자 오해 및 구현 시 잘못된 에러 코드 참조 위험이 있으므로 수정 권장.)
