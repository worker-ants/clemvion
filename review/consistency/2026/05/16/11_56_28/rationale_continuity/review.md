# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 문서: `spec/2-navigation/4-integration.md`
검토 기준 Rationale 출처: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/_layout.md`, `spec/3-workflow-editor/4-ai-assistant.md`

---

## 발견사항

- **[INFO]** `tryRecoverByMallId` 와 폐기된 "100건 mall_id 스캔 + trial HMAC" 패턴의 표현상 유사성
  - target 위치: `spec/2-navigation/4-integration.md` §9.2 API 표, Rationale "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 섹션
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` § Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)"
  - 상세: 폐기된 원래 흐름("백엔드가 `pending_install` 행을 in-memory 로 100건 스캔하면서 mall_id 일치 candidates 의 client_secret 으로 HMAC 검증을 trial") 과 신규 `tryRecoverByMallId` 는 형태상 mall_id 조회 후 HMAC trial 이라는 면에서 유사하다. 그러나 target Rationale "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 섹션이 이 표현상 충돌을 직접 인지하고 "옛 폐기 흐름은 모든 호출에 적용되는 식별 전략이었고, 새 회복 흐름은 단일 row 조회 실패 시에만 fall-back으로 작동"이라는 구분을 명시적으로 기술하고 있다. 즉 문서 내에서 이미 자체 해소됨.
  - 제안: 구현 착수 시 `tryRecoverByMallId` 의 진입 조건(`install_token` 직접 조회 실패 후에만)을 코드 주석에도 명확히 기재할 것 — 폐기된 구 경로와의 혼동을 방지한다. `RECOVERY_CANDIDATE_LIMIT = 5` 상수도 Rationale 에 기재된 DoS 보호 목적을 주석으로 명시 권장.

- **[INFO]** `CAFE24_INSTALL_INVALID_TOKEN(404)` 보안 전제 — 구현 착수 시 토큰 길이 invariant 준수 필요
  - target 위치: `spec/2-navigation/4-integration.md` §9.4 공통 응답 포맷, Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 (2026-05-14)"
  - 과거 결정 출처: 동 Rationale 항 — "이 전제가 깨지면 (예: **96-bit (12바이트) 미만으로의 토큰 길이 단축**, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다"
  - 상세: 이 invariant는 "install_token 이 128-bit 이상 random 이어야 404 분리 응답이 안전하다"는 명시적 보안 조건이다. 현행 16바이트 base64url(128-bit)은 전제를 만족하며 target spec에도 반영돼 있다. 그러나 향후 구현 단계에서 토큰 생성 로직을 수정할 경우 이 invariant를 반드시 검토해야 한다.
  - 제안: `install_token` 생성 코드에 해당 보안 전제(최소 128-bit entropy, CSPRNG 사용)를 inline comment 또는 별도 assertion 으로 명기할 것. Rationale에서 "전제가 깨지면 403으로 통합해야 한다"고 명시한 만큼, lint 또는 unit test 로 토큰 길이 최소값(≥ 16 byte)을 검증하는 것도 권장한다.

- **[INFO]** `OAuthState.mode='reauthorize'` 재사용 결정의 조건부 번복 가능성 — 분기 추가로 전제가 변화했음
  - target 위치: `spec/2-navigation/4-integration.md` §10.2 처리 플로우, Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유 (2026-05-14)"
  - 과거 결정 출처: 동 Rationale 항 — "단, 향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토"
  - 상세: 재사용 결정의 전제는 "callback 의 처리 분기가 동일(integration row UPDATE)"이었다. 이후 `request-scopes` 흐름이 Cafe24 Private 에서 begin 을 우회하는 별도 분기로 분리됐고(Rationale "Cafe24 Private request-scopes 흐름"), 이 변화가 `reauthorize` 재사용 결정에 미치는 영향이 명시적으로 재평가되지는 않았다. 현재 target 문서는 `request_scopes` 분기를 별도로 잘 처리하고 있으나, 향후 또 다른 분기(예: scope 확장 후 callback 결과 처리의 차이)가 추가될 때 본 결정의 재검토 조건("분리해야 할 동작이 늘어나면")에 해당하는지 명확한 기준이 없다.
  - 제안: Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유" 항에 "2026-05-15 request-scopes 분리 분기 추가 후에도 `reauthorize` mode 재사용 유지" 라는 업데이트 노트를 추가하면 Rationale 연속성이 더 명확해진다.

---

## 요약

`spec/2-navigation/4-integration.md` 의 Rationale 연속성은 전반적으로 견고하게 유지되고 있다. 가장 중요한 잠재적 충돌인 `tryRecoverByMallId` 와 폐기된 "100건 mall_id 스캔 + trial HMAC" 의 유사성은 target Rationale 섹션 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제"에서 스스로 인지하고 구조적 차이를 명확히 기술함으로써 자체 해소되었다. `refresh 실패 시 status_reason 통일`(expired → error(auth_failed))도 Rationale 갱신과 함께 명시적으로 번복 처리되어 결정의 무근거 번복에 해당하지 않는다. `install_token persistent 격상` 결정 역시 기존 single-use 가정을 뒤집으면서 충분한 새 Rationale 를 함께 제공했다. 발견된 세 건은 모두 INFO 수준으로, 구현 착수를 차단할 CRITICAL 또는 WARNING 이슈는 없다.

---

## 위험도

LOW
