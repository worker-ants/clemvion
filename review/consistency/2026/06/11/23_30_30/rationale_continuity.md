# Rationale 연속성 검토 결과

**검토 대상**: `spec/4-nodes/4-integration/` (0-common, 1-http-request, 2-database-query, 3-send-email, 4-cafe24, 5-makeshop)
**검토 모드**: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/4-integration/, diff-base=origin/main)
**검토 일자**: 2026-06-11

---

## 발견사항

### 1. [INFO] D4 "모든 실패 error 포트 라우팅" 결정 — send-email 의 예외 케이스가 공통 결정과 미정합

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.8 + §3.2 포트 설명 + §5.3 표 1 비고
- **과거 결정 출처**: `spec/4-nodes/4-integration/0-common.md §4.2` — "D4 결정: 위 코드들이 발생하는 모든 경우는 핸들러 내부에서 catch 되어 `port: 'error'` + `output.error.{code, message, details?}` envelope 로 라우팅된다. Integration 노드(HTTP / Database Query / Send Email / Cafe24 / MakeShop) 모두 send-email 의 catch 패턴으로 통일한다. **`IntegrationError` 가 throw → 노드 실행 실패** 경로는 존재하지 않으며, 모든 `IntegrationError.code` 는 `output.error.code` 로 surface 된다."
- **상세**: 공통 §4.2 의 D4 결정은 "모든 `IntegrationError`는 `port:'error'`로 라우팅"이라고 명문화하고 있다. 그러나 send-email §5.8 과 §3.2 는 `EMAIL_NO_RECIPIENTS` 가 `execute()` 의 try 블록 **밖** 에서 plain `Error` throw → "error 포트로 라우팅되지 않고 노드 실행 자체가 실패"하는 경로를 허용하고 있다. 구현 갭으로 명문화되어 있어 "고의적 예외"이지만, D4 결정("모든 Integration 노드가 send-email 의 catch 패턴으로 통일")이 send-email 본 노드에서는 부분적으로만 이행됐다는 사실이 공통 D4 합의와 표면 모순을 이루고 있다. send-email §8 Rationale 에는 이 예외를 D4 와의 관계에서 명시적으로 기록하는 항목이 없다.
- **제안**: send-email §8 Rationale 에 "EMAIL_NO_RECIPIENTS 는 D4 이후에도 try 밖 throw 를 유지하는 의도된 예외이며, Planned 로 try 블록 내부로 이전 예정"이라는 항목을 추가해 D4 결정과의 관계를 명시할 것. 또는 0-common §4.2 D4 결정 문구에 send-email 의 예외 케이스를 각주로 포함할 것.

---

### 2. [INFO] SSRF 가드 — "전 인증 방식 공통" 결정이 database-query 의 전용 오류 코드 미정의 와 소폭 비대칭

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 callout — "차단 시 코드는 전용 코드 없이 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다 (HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 달리 driver 도메인 전용 코드 미정의 — 향후 통일 후보)."
- **과거 결정 출처**: `spec/4-nodes/4-integration/1-http-request.md §8.2 Rationale` — "SSRF 가드 전 인증 방식 적용" 결정. 동시에 `spec/2-navigation/4-integration.md Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일"` — 플래그 통일·posture 일관성을 명시적으로 합의.
- **상세**: 플래그·메커니즘은 통일됐으나, 오류 코드 표면(surface)은 세 노드가 비대칭이다: `HTTP_BLOCKED` (http-request) / `EMAIL_HOST_BLOCKED` (send-email) / `INTEGRATION_CALL_FAILED` fallback (database-query). 이는 새 결정을 기각하는 것은 아니며 database-query Rationale 에도 "향후 통일 후보"로 정직하게 기록되어 있다. 그러나 "보안 posture 통일"을 합의한 Rationale 의 원칙적 틀 안에서 오류 코드 표면이 향후 어느 spec 결정을 통해 통일될지 로드맵이 없어 관찰자가 임시 예외인지 영구 예외인지 구분하기 어렵다.
- **제안**: database-query Rationale 에 "향후 `DB_HOST_BLOCKED` 또는 `HTTP_BLOCKED` 계열 코드로 통일하는 작업은 `plan/in-progress/` 또는 백로그에 등록"이라는 의도를 명시하거나, 공통 §4.2 D4 결정에 database-query 의 SSRF 코드 미정의 예외를 함께 기록할 것.

---

### 3. [INFO] `meta.duration` → `meta.durationMs` 명명 통일 — breaking change 기록이 이전 spec 의 어떤 결정을 번복하는지 기록 없음

- **target 위치**: `spec/4-nodes/4-integration/0-common.md §6.1`
- **과거 결정 출처**: 현재 검토 대상 밖. 이전 http-request spec 또는 CONVENTIONS에서 `meta.duration`이 http_request 의 시간 필드로 정의됐을 것으로 추정. 공통 §6.1 자체는 "§3 에서 명시한 명명 차이… `meta.durationMs` 로 통일한다" 라고만 기술.
- **상세**: 공통 §6.1 은 `http_request` 의 `meta.duration` → `meta.durationMs` breaking change 를 정의하고 있으나, 이 변경이 어느 시점의 어느 결정을 번복(또는 정정)하는 것인지 Rationale 참조가 없다. Breaking change 알림은 있으나 "이전 결정과의 연속성" 측면에서 "기존 `meta.duration` 이 왜 채택됐었고 왜 이제 바꾸는가"에 대한 서술이 §6.1 에 완전히 없다. 이전 spec 을 읽던 사람이 이 변경을 독립적 결정인지 실수 교정인지 구분하기 어렵다.
- **제안**: §6.1 에 단 한 문장이라도 "기존 `meta.duration` 은 초기 http-request spec 에서 단위 불명 필드로 도입됐으며, ms 단위 명시가 필요한 다른 노드들과 통일하기 위해 `meta.durationMs` 로 정렬했다"는 배경을 추가하거나, 또는 기존 `meta.duration` 결정이 기록된 문서에 "본 필드는 §6.1 에서 폐지됨"을 cross-reference 할 것.

---

### 4. [INFO] http-request §5.3.2 transport 실패의 `output.response.error` — "legacy 잔재"로 표기됐으나 D4 결정 또는 Rationale 항목 없음

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §5.3.2` — `output.response.error: string` 필드 설명: "legacy 호환 잔재 — 신규 코드는 `output.error` 를 사용"
- **과거 결정 출처**: 공통 §7 출력 구조 색인 / CONVENTIONS Principle 3.2 — 표준 에러 envelope 은 `output.error.{code, message, details?}`. 이중 표면 (`output.response.error` + `output.error`) 은 이전 어느 spec 결정이 만들어낸 구조인지 불명확.
- **상세**: `output.response.error`를 legacy 잔재로 표기하면서도 (a) 언제·어느 결정으로 `output.response.error`가 도입됐는지, (b) 언제 폐지할 것인지 명시하는 Rationale 항목이 §8 에 없다. D4 결정이 "모든 실패를 `output.error`로 라우팅"으로 통일했음에도 transport 실패 경로에서만 `output.response.error`가 공존하는 이유가 불명확하다.
- **제안**: http-request §8 Rationale 에 "transport 실패 시 `output.response.error` 잔존 이유: 이전 구현 호환. 향후 minor version 에서 제거 예정"이라는 항목을 추가해 의도적 임시 공존임을 명문화할 것.

---

## 요약

target 문서(`spec/4-nodes/4-integration/`)는 SSRF 전 인증 방식 공통 적용(§8.2), D4 에러 라우팅 통일, `meta.durationMs` 명명 통일 등 핵심 결정들을 모두 Rationale 에 기록하고 기각된 대안(`none` 전용 무가드`, 별도 opt-in 플래그 등)도 명시하고 있어 전반적으로 Rationale 연속성이 양호하다. CRITICAL 또는 WARNING 수준의 "이미 기각된 대안 재도입"이나 "합의 원칙 직접 위반"은 발견되지 않았다. INFO 수준으로 (1) send-email 의 `EMAIL_NO_RECIPIENTS` 예외 케이스가 D4 합의와의 관계에서 명문화가 부족하고, (2) database-query 의 SSRF 차단 코드가 http/email 과 비대칭인 채로 "향후 통일 후보"로만 남겨진 점, (3) `meta.duration` → `meta.durationMs` breaking change 의 이전 결정 근거 서술 부재, (4) transport 실패 시 `output.response.error` legacy 잔재의 폐지 계획 미명문화 등 Rationale 보완 사항이 있다. 이들은 모두 문서화 보강 차원이며 설계 의도 자체의 역행은 아니다.

---

## 위험도

LOW
