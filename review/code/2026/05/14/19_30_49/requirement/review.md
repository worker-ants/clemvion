## 발견사항

---

### [WARNING] App URL 노출 UI 흐름 미명시 — install_token 포함 URL을 사용자에게 전달하는 경로 없음

- **위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 2`
- **상세**: step 1에서 integration 생성 시 install_token이 발급되고, step 2에서 사용자가 Cafe24 Developers에 App URL을 등록한다. 그런데 사용자가 등록해야 할 URL은 `/api/integrations/oauth/install/cafe24/:installToken` — 즉 발급된 토큰이 박힌 구체적인 URL이다. 이 URL을 사용자에게 어떻게 전달하는지(UI에서 복사 버튼 노출, pending_install 상세 화면 등)가 spec 어디에도 명시되어 있지 않다. 사용자가 이 URL을 알 수 없으면 전체 플로우가 성립하지 않는다.
- **제안**: `spec/2-navigation/4-integration.md §2.2` 또는 §9.4 Rationale에 "pending_install 생성 직후 App URL(`/oauth/install/cafe24/:installToken`)을 UI에서 복사 가능한 형태로 노출한다" 항목 추가.

---

### [WARNING] `markIntegrationCallbackError`의 `connected` status 처리 — plan vs spec §10.4 직접 충돌

- **위치**: `plan/in-progress/cafe24-pending-polish.md 변경 0` vs `spec/2-navigation/4-integration.md §10.4`
- **상세**: plan 변경 0은 `markIntegrationCallbackError`를 "status 유지 (`pending_install` → 그대로 / `connected` → 그대로)"로 명시한다. 그러나 spec §10.4는 `mode=reauthorize, status=connected` 코드 교환 실패 시 `error(auth_failed)` + `last_error` 기록으로 **status가 전이**된다고 정의한다. 구현자가 plan대로 구현하면 기존 connected → error(auth_failed) 경로를 깨뜨린다. consistency check 3회(17-58-37 plan_coherence, 18-23-55 plan_coherence, 18-38-32 plan_coherence)가 동일하게 지적했으나 plan이 수정된 흔적이 없다.
- **제안**: plan 변경 0을 "pending_install → status 보존 + last_error 갱신 / connected → error(auth_failed) + last_error 기록 (§10.4 기준)"으로 분리 기술. 또는 `markIntegrationCallbackError`를 pending_install 전용으로 명시하고 connected 분기는 기존 코드 경로에 위임.

---

### [WARNING] TTL 경계 처리 미정의 — 24h 경과했지만 스캐너 미실행 구간의 install 요청

- **위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 7`, `spec/2-navigation/4-integration.md §9.2`
- **상세**: install_token의 TTL은 24h이고, 만료 처리는 "일일 스캐너"가 수행한다. 생성 후 24h 이후 ~ 스캐너 실행 전 구간에서 Cafe24가 App URL(`:installToken` 포함)을 호출하면, DB에는 row가 존재하고 install_token도 non-null이지만 TTL을 초과한 상태다. 현재 spec은 이 구간의 요청을 어떻게 처리할지 정의하지 않는다 — 정상 처리할지, 별도 에러를 반환할지 불명확.
- **제안**: §9.2의 install_token 조회 로직에 "install_token 조회 성공 + pending_install 상태이나 created_at이 24h 초과 → `404 CAFE24_INSTALL_INVALID_TOKEN` (이미 만료된 토큰으로 처리)" 또는 "정상 처리 후 스캐너가 이후 정리" 중 정책을 명시.

---

### [WARNING] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` HTTP 코드 plan-spec 불일치 미해소

- **위치**: `plan/in-progress/cafe24-pending-polish.md 변경 3` vs `spec/2-navigation/4-integration.md §9.4`
- **상세**: consistency check 18-15-41(W2), 18-23-55(plan_coherence INFO), 18-38-32(W5)에서 반복 지적된 불일치다. plan 변경 3은 `(400)`으로 명시하고 spec §9.4는 `(409)`로 확정한다. 해당 plan이 수정되었는지 이번 diff에서 확인되지 않는다. 개발자가 plan 기준으로 구현하면 API contract 불일치가 발생한다.
- **제안**: plan 변경 3의 `(400)` → `(409)` 즉시 정정. consistency check 출력에 이 수정이 권장된 첫 세션 이후로 시간이 경과했으므로 확인 필요.

---

### [WARNING] `credentials_unreadable` — pending_install 흐름에서의 실제 발생 가능성 미검증

- **위치**: `spec/1-data-model.md §2.10 status_reason`
- **상세**: spec은 `credentials_unreadable`을 "기존 분기(`integrations.service.ts:845`)로 정합성 유지"라고 소급 등재한다. 그러나 `pending_install` 상태의 callback 처리 경로에서 AES-256-GCM 복호화 실패가 발생하면 이 코드가 기록되어야 하는지, 기존 분기가 pending_install 케이스를 커버하는지 spec이 명시하지 않는다. plan의 변경 0-5 어디에도 credentials 복호화 실패 처리가 없다.
- **제안**: spec §10.4 또는 DRAFT 1C 주석에 "기존 분기가 pending_install 상태에서도 동작하는지 구현 착수 전 `integrations.service.ts:845` 확인" 노트 추가. 미커버 시 plan에 변경 항목 신설 필요.

---

### [INFO] §6 상태 전이 표에 `install_token` 보존 정책 미명시

- **위치**: `spec/2-navigation/4-integration.md §6`
- **상세**: `data-flow §1.2.1`은 callback 실패 시 install_token이 유지됨을 주석으로 명시한다(`install_token 도 유지`). 그러나 §6 상태 전이 표의 `pending_install → pending_install` 행에는 "`status_reason` + `last_error` 만 갱신"으로만 기술되어 있다. install_token 보존이 "테스트 실행 재시도"를 가능하게 하는 핵심 invariant임에도 §6에서 누락되어 있다.
- **제안**: §6 해당 전이 행에 "`install_token` 유지 (Cafe24 재시도 재호출을 위해 소거하지 않음)" 추가. consistency check 18-38-32 cross_spec INFO 1이 동일하게 지적함.

---

### [INFO] V041 마이그레이션 선행 조건 미검증

- **위치**: `spec/data-flow/integration.md §2.1` (DRAFT 3D) / `plan/in-progress/cafe24-pending-polish.md`
- **상세**: `integration_oauth_state.provider_meta` 컬럼(V041로 기술)이 실제 DB에 적용되어 있는지 plan이 확인하지 않는다. V042가 이미 적용된 상태라면 V041 역시 선행 완료여야 하는데, consistency check에서 지속 지적됐음에도 plan에 선행 확인 체크박스가 추가되지 않았다.
- **제안**: plan 변경 2/3 앞에 `[ ] 선행 확인: integration_oauth_state.provider_meta (V041) 컬럼 DB 실재 여부 — 미적용 시 별도 migration 계획` 추가.

---

### [INFO] Legacy path 영구 폐기 follow-up 미등재

- **위치**: `plan/in-progress/cafe24-pending-polish.md`
- **상세**: spec의 DRAFT 2I Rationale는 `/oauth/install/cafe24` 영구 폐기를 plan 후속 항목으로 추가하겠다고 약속했다. consistency check 4회 이상에서 지적됐으나 이번 diff 기준으로 plan에 해당 항목이 보이지 않는다. 410 Gone 응답을 무기한 유지하게 된다.
- **제안**: plan "비포함" 또는 말미에 `[ ] (후속) 레거시 경로 `/oauth/install/cafe24` 영구 폐기 결정 — 운영 데이터·외부 등록 URL 잔존 여부 확인 후 별도 PR` 추가.

---

## 요약

spec 변경 자체(1-data-model.md, 4-cafe24.md, cafe24-api-metadata.md)는 install_token 기반 식별 전략으로의 전환을 정합하게 반영했으며, `resource_not_found` dead identifier 문제와 같은 Critical 모순은 최종 세션(18-15-41) 기준으로 해소된 상태다. 그러나 **요구사항 충족 관점에서 가장 심각한 갭은 두 가지**다: (1) install_token이 박힌 App URL을 사용자에게 전달하는 UI 흐름이 spec 어디에도 없어 전체 Private 앱 등록 플로우가 사용자 행동 관점에서 불완전하고, (2) `markIntegrationCallbackError`의 connected status 처리 방식이 plan과 spec 사이에서 정반대로 기술되어 있어 구현 시 기존 reauthorize 실패 경로를 깨뜨릴 수 있다. plan 문서에 HTTP 409 vs 400 불일치, TTL 경계 처리 미정의, V041 선행 조건 미확인 등 다수의 소규모 gaps도 남아 있어 구현 착수 전 plan 정정이 선행되어야 한다.

## 위험도

**MEDIUM** — spec-code 직접 모순(Critical)은 없으나, App URL 노출 UI 흐름 누락과 `markIntegrationCallbackError` plan-spec 충돌이 Private 앱 전체 등록 플로우를 불완전하게 만든다. 두 항목 해소 없이 구현을 시작하면 사용자가 흐름을 완료할 수 없거나 기존 reauthorize 동작이 회귀한다.