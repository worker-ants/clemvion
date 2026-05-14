### 발견사항

---

**[CRITICAL] `statusReason: 'waiting'` — 미정의 픽스처 값이 spec 정의와 불일치**
- 위치: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts:449`
- 상세: spec(DRAFT 1C / DRAFT 3B)이 `status_reason` 유효값을 `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `install_timeout` 등으로 명시했으나 해당 테스트 픽스처는 spec에 없는 `'waiting'`을 사용한다. 이 상태로 구현이 완료되면 픽스처가 실제 동작을 검증하지 못하고 spec drift를 숨기는 거짓 통과(false positive) 테스트가 된다.
- 제안: 변경 5 테스트 보강 착수 시 해당 픽스처를 `'oauth_token_exchange_failed'` 등 spec 정의 값으로 교체. 픽스처에 임의 문자열이 허용된다면 `status_reason` 컬럼에 unknown 값이 진입하는 경로를 차단하는 별도 validation 테스트 추가.

---

**[WARNING] `CAFE24_INSTALL_INVALID_HMAC(403)` 기존 테스트 — "pending 미발견" 경로가 이제 404를 반환**
- 위치: 기존 install callback 관련 e2e / 통합 테스트 전체
- 상세: 기존 spec은 "토큰/pending row 미존재"와 "HMAC 불일치" 두 케이스를 모두 403으로 합산했다. draft 적용 후 토큰 미존재 경로는 `CAFE24_INSTALL_INVALID_TOKEN(404)`로 분리된다. 기존에 "pending row 없음" 시나리오를 `403 CAFE24_INSTALL_INVALID_HMAC`로 기대하는 테스트가 있다면 모두 실패로 전환된다.
- 제안: `plan/in-progress/cafe24-pending-polish.md` 변경 5 테스트 보강 목록에 "기존 `403 HMAC` 테스트 중 'token/row 미존재' 경로를 `404 CAFE24_INSTALL_INVALID_TOKEN`으로 전환" 항목을 명시 추가(consistency review들이 반복 지적했으나 plan에 미등재).

---

**[WARNING] `markIntegrationCallbackError` — plan과 spec 간 `connected` status 처리 충돌로 테스트 방향 결정 불가**
- 위치: `plan/in-progress/cafe24-pending-polish.md` 변경 0 / `spec/2-navigation/4-integration.md §10.4`
- 상세: plan 변경 0은 `markIntegrationCallbackError`가 "status 유지 (pending_install → 그대로 / connected → 그대로)"로 기술한다. 그러나 spec §10.4 표는 `mode=reauthorize, status=connected` 코드 교환 실패 시 `error(auth_failed)` 전이를 명시한다. 테스트를 plan 기준으로 작성하면 spec 동작을 깨는 구현이 검증을 통과하게 된다. 2026-05-14_18-23-55 plan_coherence review도 MEDIUM으로 지적.
- 제안: 구현 착수 전 plan 변경 0의 `connected` 케이스 기술을 `error(auth_failed)` 전이로 수정하고, 이를 검증하는 단위 테스트 케이스(`connected + mode=reauthorize + token exchange failure → status=error, status_reason=auth_failed`)를 TDD 착수 기준으로 명시.

---

**[WARNING] 새 `install_token` 식별 흐름에 대한 테스트 케이스 미명시**
- 위치: `plan/in-progress/cafe24-pending-polish.md` 변경 2/3/5
- 상세: 핵심 경로 변경(mall_id 스캔 → `/:installToken` 단일 조회)이 발생했으나 plan의 변경 5 테스트 항목에 다음 케이스들이 없다: (a) `install_token` 정상 조회 → HMAC 검증 성공 흐름, (b) `install_token`이 callback 성공 후 NULL로 전환된 상태에서 App URL 재호출 → 404, (c) `install_token` TTL 만료 후 NULL 전환 확인, (d) timestamp 윈도우 초과 시 `400 CAFE24_INSTALL_REPLAY`. 특히 (b)는 보안 불변식(token 재사용 불가)의 핵심 검증이다.
- 제안: 변경 5에 위 4개 케이스를 체크박스로 추가. (b)는 e2e 테스트로, (c)는 스캐너 통합 테스트로 작성.

---

**[WARNING] BullMQ `reason` 필드 추가 — 하위 호환 fallback 테스트 미명시**
- 위치: `plan/in-progress/cafe24-pending-polish.md` 변경 4
- 상세: DRAFT 3C-bis가 `reason ?? 'token_expiring'` 기본값 처리를 명시했으나, 변경 4 체크리스트에 하위 호환 테스트가 없다. 구 포맷 `{ integrationId }` 메시지를 소비자가 올바르게 `token_expiring` 분기로 처리하는지 검증하지 않으면 롤링 배포 구간에서 silent failure가 발생할 수 있다.
- 제안: 변경 4에 "`reason` 필드 없는 기존 메시지 → `token_expiring` fallback 처리 단위 테스트" 체크박스 추가. 별도로 `pending_install_timeout` reason이 `status_reason='install_timeout'`으로 DB에 기록되는 매핑도 통합 테스트로 커버.

---

**[INFO] `pending_install → pending_install` 전이 — install_token 보존 여부 테스트 누락**
- 위치: `spec/2-navigation/4-integration.md §6` / `spec/data-flow/integration.md §1.2.1`
- 상세: callback 실패 후 `install_token`이 NULL로 되지 않고 보존되어야 "테스트 실행" 재시도가 가능하다. 이 invariant를 검증하는 테스트 케이스가 plan에 없다.
- 제안: 변경 5에 "callback 실패(oauth_token_exchange_failed) 후 `install_token`이 NULL이 아님을 검증하는 단위 테스트" 추가.

---

**[INFO] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` — `pending_install` 중복 허용 여부 테스트 미명시**
- 위치: `spec/2-navigation/4-integration.md §9.2` / DRAFT 2F-bis
- 상세: 동일 `(workspaceId, mall_id, app_type='private')`에 `connected`가 있으면 차단하고 `pending_install`이 있으면 허용하는 비대칭 정책이다. 두 케이스를 명시적으로 구분하는 테스트가 없으면 "pending_install 중복도 차단"하는 오구현이 통과될 수 있다.
- 제안: 변경 3 테스트에 (a) connected 중복 → 409, (b) pending_install 중복 → 허용(200/201) 두 케이스를 각각 명시.

---

### 요약

변경 대상이 구현 코드가 아닌 spec 문서이므로 현재 단계의 테스트 이슈는 "구현 착수 시 테스트 계획에 누락된 케이스들"이다. 가장 위험한 항목은 두 가지다: `statusReason: 'waiting'` 픽스처는 이미 존재하는 테스트 코드가 잘못된 값을 검증하는 실패한 사전 조건이고, `markIntegrationCallbackError`의 `connected` 처리 방향이 plan과 spec 사이에 충돌하여 어느 쪽을 기준으로 테스트를 작성해도 한 쪽을 깨게 된다. 나머지 WARNING들(`HMAC 403→404 전환`, `install_token 흐름`, `BullMQ 하위 호환`)은 plan 변경 5 체크리스트에 항목을 추가하는 것만으로 해소 가능하며, 구현 착수 전에 반영해야 TDD가 올바른 방향으로 진행될 수 있다.

### 위험도

**MEDIUM** — Critical 1건(`statusReason: 'waiting'` 픽스처)과 구현 방향을 결정해야 하는 MEDIUM 항목 1건(`markIntegrationCallbackError connected 처리`)이 구현 착수 전 해소 필요. 나머지는 plan 문서 보강으로 처리 가능.