### 발견사항

---

**[CRITICAL] App URL Path 변경 — 외부 등록 URL의 Breaking Change**
- 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.4, `spec/2-navigation/4-integration.md` §9.2
- 상세: `/oauth/install/cafe24` → `/oauth/install/cafe24/:installToken` 경로 변경은 Cafe24 Developers에 이미 등록된 App URL을 가진 외부 클라이언트(Cafe24 측)에게 breaking change다. 기존 등록 URL로 호출 시 410 Gone을 반환하지만, 이를 누가 언제 변경해야 하는지 — Cafe24 Developers 설정 재등록 안내 플로우 — 가 spec에 없다. 또한 path parameter `:installToken`을 포함한 새 URL 포맷을 Cafe24 Developers에 어떻게 안내하는지(UI에서 App URL을 표시하는 방법)가 누락되어 있다.
- 제안: `pending_install` Integration 생성 후 사용자에게 표시되는 "App URL" 값이 `:installToken`이 치환된 완성 URL인지 template URL인지 spec에 명시. App URL 변경에 따른 사용자 마이그레이션 가이드 플로우를 §9.4 또는 §9.2에 추가.

---

**[CRITICAL] `CAFE24_INSTALL_INVALID_HMAC` 의미 축소 — 기존 소비자 하위 호환 파괴**
- 위치: `spec/2-navigation/4-integration.md` §9.2, `spec/4-nodes/4-integration/4-cafe24.md` §9.8
- 상세: 기존 API 계약에서 `CAFE24_INSTALL_INVALID_HMAC(403)`은 "pending row 미존재 + HMAC 불일치" 두 케이스를 커버했다. 이 계약을 기반으로 작성된 기존 통합 테스트 및 e2e 테스트는 "토큰 미존재" 경로에서 403을 기대한다. 신규 404 분리 후 해당 테스트들이 실패한다. `spec/4-nodes/4-integration/4-cafe24.md:431` (`spec/2-navigation/4-integration.md:653`) 두 파일 모두 기존 합산 정책을 명시적으로 기술하고 있어, replace 패치가 두 곳을 모두 커버하는지 일관성 검토가 필요하다.
- 제안: `plan/in-progress/cafe24-pending-polish.md` 변경 5 테스트 항목에 "기존 `CAFE24_INSTALL_INVALID_HMAC(403)` 케이스 중 '토큰/pending row 미존재' 경로를 `CAFE24_INSTALL_INVALID_TOKEN(404)`로 전환" 명시 추가 필수.

---

**[WARNING] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` HTTP 상태 코드 불일치**
- 위치: `spec/2-navigation/4-integration.md` §9.4 (409 정의) vs `plan/in-progress/cafe24-pending-polish.md` 변경 3 (400 명시)
- 상세: spec과 implementation plan이 동일 에러 코드에 다른 HTTP 상태 코드를 지정한다. 개발자가 plan을 기준으로 구현하면 API Contract가 409가 아닌 400으로 노출된다. consistency review 세션 3개(17-58-37, 18-15-41, 18-38-32)에서 반복 지적되었으나 plan 문서가 아직 수정되지 않았다. 중복/충돌 케이스에 400을 쓰는 것은 `spec/conventions/swagger.md §2-4` 및 기존 `INTEGRATION_IN_USE(409)` 선례에 위배된다.
- 제안: `plan/in-progress/cafe24-pending-polish.md` 변경 3의 `(400)` → `(409)` 즉시 정정. 구현 착수 전 필수.

---

**[WARNING] uniqueness 조건 범위 불일치 — API 동작 오구현 위험**
- 위치: `spec/2-navigation/4-integration.md` §9.2 vs `plan/in-progress/cafe24-pending-polish.md` 변경 3
- 상세: spec §9.2는 중복 차단 조건을 `(workspaceId, mall_id, app_type='private')`로 정의하나, plan 변경 3은 `(workspaceId, mall_id)`로 기술한다. `app_type='private'` 조건이 빠지면 같은 mall_id를 가진 public 앱과 private 앱이 공존할 수 없게 되어 의도치 않은 차단이 발생한다. API 클라이언트 입장에서 409를 받는 조건이 spec과 달라지는 계약 위반이다.
- 제안: plan 변경 3의 조건을 spec과 일치하도록 `(workspaceId, mall_id, app_type='private')` 로 수정.

---

**[WARNING] BullMQ 큐 메시지 스키마 확장 — 하위 호환성 미명시**
- 위치: `spec/data-flow/integration.md` §1.4
- 상세: `{ integrationId }` → `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` 확장은 기존 소비자(consumer)가 `reason` 필드를 처리하지 않는 경우 `undefined` 분기로 빠져 `token_expiring` 로직이 누락될 수 있다. spec에 "기존 소비자는 `reason` 미포함 메시지를 `token_expiring`으로 간주"가 명시되어 있으나, 이것이 구현 plan 변경 4의 체크리스트에 반영되어 있지 않다. 롤링 배포 환경에서 구버전 consumer와 신버전 producer가 동일 큐를 공유하는 구간에 데이터 처리 누락이 발생할 수 있다.
- 제안: `plan/in-progress/cafe24-pending-polish.md` 변경 4에 "consumer에 `reason ?? 'token_expiring'` 기본값 처리 추가" 및 "consumer 먼저 배포 후 producer(스캐너) 배포" 순서 명시.

---

**[WARNING] `connected` 재인증 실패 시 status 전이 — API Contract 모순**
- 위치: `spec/2-navigation/4-integration.md` §10.2 step 6 vs §10.4 에러 매핑 표
- 상세: §10.4 표는 `connected` 재인증 실패 시 `error(auth_failed)`로 전이를 정의하나, §10.2 step 6은 "connected 유지"를 기술한다. 외부 클라이언트가 Integration status를 폴링하는 경우 어느 상태를 기대해야 하는지 API Contract가 정의되지 않는다. 구현자에 따라 서로 다른 상태 전이를 구현하게 된다.
- 제안: §10.2 step 6을 "`pending_install`은 pending_install 유지, `connected` 재인증 실패는 §10.4 기준 `error(auth_failed)` 전이"로 교정하여 단일 정의로 수렴.

---

**[INFO] `pending_install → pending_install` 전이에서 `install_token` 보존 여부 미명시**
- 위치: `spec/2-navigation/4-integration.md` §6
- 상세: callback 실패 시 status는 `pending_install`로 보존되나, `install_token`이 유지되는지 소거되는지가 API 응답에 영향을 미친다. 재시도를 위해 App URL에 동일 `installToken`을 재사용할 수 있는지가 클라이언트 관점에서 중요한 계약이다.
- 제안: §6 전이 설명에 "`install_token` 유지 (Cafe24 재시도를 위해 소거하지 않음)" 명시.

---

**[INFO] `410 Gone` — swagger 규약 데코레이터 구현 주의사항**
- 위치: `spec/2-navigation/4-integration.md` §9.2 deprecated 항
- 상세: `spec/conventions/swagger.md §2-4` 표준 응답 코드 표에 410이 없어 구현 시 `@ApiGoneResponse` 데코레이터 대신 `@ApiResponse({ status: 410 })` 수동 지정이 필요하다.
- 제안: spec §9.2 deprecated 항에 "(구현 시 `@ApiResponse({ status: 410 })` 수동 지정 필요)" 한 줄 추가.

---

### 요약

이번 변경은 Cafe24 Private 앱 설치 흐름의 API Contract를 전면 재정의한다. 가장 심각한 문제는 두 가지다: (1) `/oauth/install/cafe24` → `/oauth/install/cafe24/:installToken` 경로 변경이 Cafe24 Developers에 이미 등록된 외부 App URL에 대한 breaking change이며, 사용자 마이그레이션 플로우(새 URL 안내 방법)가 spec에 없다. (2) `CAFE24_INSTALL_INVALID_HMAC(403)`의 의미 축소로 기존 API 계약을 기대하는 클라이언트와 테스트가 영향받는다. 추가로 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`의 HTTP 상태 코드가 spec(409)과 plan(400) 사이에 불일치하고, uniqueness 조건 범위도 spec과 plan 간에 어긋나 있어 이 두 항목은 구현 착수 전 plan 문서 정정이 필수다.

### 위험도

**HIGH** — CRITICAL 2건(외부 URL breaking change 마이그레이션 누락, 에러 코드 의미 변경에 따른 하위 호환 파괴)·WARNING 4건·INFO 2건 확인. CRITICAL 사항이 spec에 명시적으로 해소되기 전까지 구현 착수 시 Cafe24 연동 장애 위험이 있다.