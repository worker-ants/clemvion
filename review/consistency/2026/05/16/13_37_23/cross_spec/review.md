# Cross-Spec 일관성 검토

**검토 모드**: `--impl-prep`
**대상 문서**: `spec/2-navigation/4-integration.md`
**구현 범위**: `plan/in-progress/cafe24-test-connection.md` — Cafe24 연결 테스트(`POST /api/integrations/:id/test`) 실 구현

---

## 발견사항

### [WARNING] §5.8 테스트 방법과 plan 구현 범위의 엔드포인트 불일치

- **target 위치**: `spec/2-navigation/4-integration.md §5.8` — "테스트 방법: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/store` 핑."
- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md §구현 범위` — "사용자 지시(2026-05-16)로 **`GET /api/v2/admin/apps` 로 변경**하고 401 시 refresh + 1회 재시도를 추가한다."
- **상세**: spec §5.8 은 `/store` 엔드포인트를 명시하지만, plan 은 `/apps` 엔드포인트로 변경을 결정했다. 구현이 `/apps` 로 완성되면 spec 과 코드가 상이해진다. plan 자체가 "Spec 갱신 (project-planner 위임 대상)" 섹션에서 갱신 필요를 인지하고 있지만, 구현 완료 전 spec 이 갱신되지 않으면 이 worktree 에서 reviewer 나 다른 contributor 가 잘못된 엔드포인트(`/store`)를 참조할 수 있다.
- **제안**: 구현 착수 전에 `project-planner` 를 통해 `spec/2-navigation/4-integration.md §5.8` 의 "테스트 방법" 항목을 `/apps` + 401 retry 정책으로 갱신한다. plan 의 "Spec 갱신 위임 노트" 는 구현 완료 후가 아닌 **착수 직전**에 실행되어야 spec 이 단일 진실 역할을 유지한다.

---

### [WARNING] `consecutive_network_failures` 카운터 적용 범위 — 테스트 호출 제외 미명시

- **target 위치**: `spec/2-navigation/4-integration.md §14.1` + `spec/1-data-model.md §2.10` — "`consecutive_network_failures`: 노드 실행 / 토큰 갱신 중 transport 실패 카운터. 성공 시 0으로 리셋, 3 도달 시 `error(network)` 전이."
- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md §구현 범위` — "transport 실패 → `{ success: false }` (**consecutiveNetworkFailures 카운터는 노드 호출 정의에 한정 — 테스트는 합산하지 않음**)."
- **상세**: plan 이 테스트 호출의 transport 실패를 카운터에서 제외하기로 결정했으나, `spec/2-navigation/4-integration.md §14.1` 및 `spec/1-data-model.md §2.10` 의 카운터 정의에는 이 제외 규칙이 기술되어 있지 않다. 구현 후 다른 개발자가 spec 을 보면 "왜 테스트 호출이 카운터를 올리지 않는가?"를 spec 에서 확인할 수 없어 행동이 불명확해진다.
- **제안**: spec §5.8 갱신 시 또는 `spec/1-data-model.md §2.10` `consecutive_network_failures` 설명에 "테스트(`POST /api/integrations/:id/test`) 호출의 transport 실패는 카운터 합산 대상 아님" 을 명시한다.

---

### [WARNING] `POST /api/integrations/:id/test` — `pending_install` 상태에서의 동작 미정의

- **target 위치**: `spec/2-navigation/4-integration.md §9.1` — `POST /api/integrations/:id/test`: "현재 저장된 자격 증명으로 연결 테스트"
- **충돌 대상**: `spec/2-navigation/4-integration.md §2.2` — "`pending_install` 의 ⋮ 메뉴는 상세 열기 + 삭제만 활성 — 재인증은 cafe24 측 '테스트 실행' 재호출이 정식이며, 연결 테스트는 토큰이 없어 의미가 없다."
- **상세**: UI 레이어(§2.2)는 `pending_install` 에서 연결 테스트 버튼이 비활성임을 명시하지만, API 레이어(§9.1)에서 `POST /api/integrations/:id/test` 가 `pending_install` 상태의 `integrationId` 로 호출됐을 때 어떤 HTTP 응답을 반환해야 하는지(예: 422 `INTEGRATION_INCOMPLETE`, 400, 무시 등)가 정의되어 있지 않다. plan 이 `testConnection` 을 entity-aware 로 구현한다고 명시하므로, 이 경우의 처리 경계를 spec 에 기술할 필요가 있다.
- **제안**: `spec/2-navigation/4-integration.md §9.1` 또는 §14.1 에 `pending_install` 상태의 `test` 호출 시 `422 INTEGRATION_INCOMPLETE` (또는 적절한 에러) 를 즉시 반환하도록 명시한다. 기존 `INTEGRATION_INCOMPLETE` 에러 코드(§14.1 에러 vocabulary)가 이미 정의되어 있어 재사용 가능하다.

---

### [WARNING] `preview-test` 의 Cafe24 분기 — entity-aware 확장과의 경계 미정의

- **target 위치**: `spec/2-navigation/4-integration.md §3.3` — "자동으로 `POST /api/integrations/preview-test`를 호출 (DB 저장 없이 메모리상 자격 증명으로 검증)"
- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md §구현 범위` — "preview-test (DB 저장 전) cafe24 케이스는 막 발급된 토큰이라 refresh 불필요 — 단순 ping만 수행 (entity 없는 분기)"
- **상세**: plan 이 `POST /api/integrations/:id/test` 는 entity 를 받아 `ensureFreshToken` + retry 를 하고, `preview-test` 는 entity 없이 단순 ping 만 한다고 설계를 구분했다. 그러나 spec §3.3 의 "테스트 방법" 항목(§5.8)은 하나의 "테스트 방법"만 기술하며, 두 경로(`/:id/test` vs `/preview-test`)의 동작 차이가 spec 에 명시되어 있지 않다. 특히 `/apps` 엔드포인트 변경과 401 retry 추가가 `preview-test` 경로에는 적용되지 않는다는 결정이 spec 에 없다.
- **제안**: spec §5.8 테스트 방법 갱신 시 "저장된 통합(`/:id/test`)은 ensureFreshToken + 401 retry 적용, 사전 검증(`/preview-test`) 은 단순 ping" 이라는 경로 분기를 명시한다.

---

### [INFO] §5.8 `consecutive_network_failures` 와 §14.1 에러 코드 vocabulary 간 Cafe24 전용 에러 코드 부재

- **target 위치**: `spec/2-navigation/4-integration.md §14.1` 에러 코드 vocabulary
- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md` — "401 → ... 재시도도 401 이면 `markAuthFailed` + `{ success: false }`, 403/기타 → `markAuthFailed` 호출하지 않고 `{ success: false, message }` 반환"
- **상세**: §14.1 에러 코드 테이블에 Cafe24 전용 테스트 결과 구분(예: 401 재시도 실패 vs 403 scope 오류)을 구분하는 코드가 없다. `INTEGRATION_CALL_FAILED` 나 `INSUFFICIENT_SCOPE` 가 사용 가능하지만, plan 의 "403은 markAuthFailed 없이 단순 실패" 라는 의도가 vocabulary 에 반영되어 있지 않아 구현과 spec 기록 사이의 동기화 갭이 생길 수 있다.
- **제안**: spec 갱신 시 Cafe24 test connection 의 응답 shape(`{ success, message?, authFailed? }`)을 §9.1 또는 §5.8 에 brief 하게 기술한다.

---

### [INFO] `spec/0-overview.md §6.2` Cafe24 구현 상태 참조 — 테스트 연결 미구현 언급 없음

- **target 위치**: `spec/0-overview.md §6.2` — "Cafe24 통합 ... 모두 구현 완료 (PR #20-#67)."
- **충돌 대상**: `plan/in-progress/cafe24-test-connection.md §배경` — "`POST /api/integrations/:id/test` 의 cafe24 분기는 현재 항상 `success: true` 를 반환한다 (구현 위치: `integrationsService.ts:160-162`, `dispatchTest` fallback)."
- **상세**: `spec/0-overview.md` 는 Cafe24 통합이 "모두 구현 완료"라고 기술하지만, 실제로는 연결 테스트(`/test` cafe24 분기)가 stub 상태임이 plan 에서 확인된다. 이는 overview 의 구현 완료 선언이 과도하거나 범위 정의가 부정확함을 나타낸다.
- **제안**: 구현 완료 후 `spec/0-overview.md §6.2` 의 Cafe24 항목을 갱신하거나, 구현 전이라면 "연결 테스트 stub" 을 `§6.2 🚧` 항목으로 이동한다.

---

## 요약

Cross-Spec 관점에서 `spec/2-navigation/4-integration.md` 자체는 `spec/1-data-model.md`, `spec/4-nodes/4-integration/4-cafe24.md` 등 관련 spec 과 구조적으로 일관성을 갖추고 있다. 직접적인 모순은 없다. 그러나 이번 `--impl-prep` 검토에서 핵심 위험은 **spec 과 plan 사이의 갭**이다: plan 이 spec §5.8 의 테스트 엔드포인트(`/store`)를 `/apps` 로 변경하고 401 retry 정책을 추가하기로 결정했지만, spec 갱신은 구현 완료 후로 미뤄져 있다. SDD(Spec-Driven Development) 원칙상 spec 이 먼저 갱신된 뒤 구현이 이루어져야 한다. 추가로 `consecutive_network_failures` 카운터의 테스트 호출 제외 규칙, `pending_install` 상태에서의 `/:id/test` API 동작, `preview-test` 와 `/:id/test` 의 동작 분기가 spec 에 미정의된 상태로 구현에 진입하면 추후 불일치 위험이 높다. CRITICAL 충돌은 없으나 WARNING 4건이 구현 전에 처리되어야 spec 단일 진실을 유지할 수 있다.

## 위험도

MEDIUM
