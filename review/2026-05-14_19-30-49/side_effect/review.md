## 발견사항

---

### [CRITICAL] App URL path 변경 — Cafe24 Developers 등록 URL 외부 의존성

- **위치**: `spec/4-nodes/4-integration/4-cafe24.md:383`
- **상세**: App URL이 `/oauth/install/cafe24` → `/oauth/install/cafe24/:installToken`으로 변경됨. 기존에 Cafe24 Developers에 App URL을 등록한 **운영 중인 Private 앱은 외부 대시보드에서 수동으로 URL을 갱신해야** 한다. 410 Gone이 처리되더라도 구 URL로 등록된 앱은 `pending_install` 흐름 자체가 완전히 중단된다. spec 내에 이 운영 조치가 누가 언제 수행해야 하는지 명시되어 있지 않다.
- **제안**: `spec/2-navigation/4-integration.md §9.2` 또는 `plan/in-progress/cafe24-pending-polish.md`에 "배포 전 체크리스트: 기존 Cafe24 Private 앱 등록 URL 갱신 필요" 항목 추가. 운영 중 Private 앱이 없다면 INFO로 강등 가능.

---

### [WARNING] BullMQ `integration-expiry` 큐 메시지 스키마 — 소비자 하위 호환 미적용 시 silent failure

- **위치**: `spec/data-flow/integration.md §1.4` (DRAFT 3C-bis)
- **상세**: 메시지 shape이 `{ integrationId }` → `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }`으로 확장된다. 구 소비자가 `reason`을 읽고 분기한다면 `undefined`로 인해 `pending_install_timeout` 처리 경로에 절대 진입하지 못한다. 명시적 오류 없이 `token_expiring` fallback이나 무처리로 빠지는 silent failure다. `review/consistency/2026-05-14_18-38-32/naming_collision/review.md`에서 롤링 배포 순서(소비자 먼저, 생산자 나중)를 권장했으나 `cafe24-pending-polish.md` 변경 4에 미반영.
- **제안**: `cafe24-pending-polish.md` 변경 4에 "BullMQ consumer에 `reason ?? 'token_expiring'` 기본값 처리 추가" + "배포 순서: consumer 먼저 배포 후 producer" 체크박스 명시.

---

### [WARNING] `CAFE24_INSTALL_INVALID_HMAC` 의미 축소 — 기존 테스트 silent breakage

- **위치**: `spec/2-navigation/4-integration.md §9.2` (DRAFT 2E)
- **상세**: 기존 spec은 "HMAC 실패 OR pending row 미발견"을 같은 403으로 처리했다. 이번 변경으로 "pending row 미발견"이 `404 CAFE24_INSTALL_INVALID_TOKEN`으로 분리된다. 기존 e2e/통합 테스트에서 "토큰 없는 경로"를 403으로 assert하던 테스트는 **404를 받아 실패**한다. `4-cafe24.md:431`과 `4-integration.md:653` 두 파일 모두 갱신 대상인데, 구 어설션이 신 코드와 매핑되지 않으면 테스트는 통과하되 동작은 틀린 상태가 될 수 있다.
- **제안**: `cafe24-pending-polish.md` 변경 5에 "기존 `CAFE24_INSTALL_INVALID_HMAC(403)` 테스트 중 '토큰 미존재' 경로 → `CAFE24_INSTALL_INVALID_TOKEN(404)`로 전환" 항목 추가.

---

### [WARNING] `markIntegrationCallbackError` — plan과 spec의 `connected` status 처리 충돌

- **위치**: `plan/in-progress/cafe24-pending-polish.md 변경 0` vs `spec/2-navigation/4-integration.md §10.4`
- **상세**: plan 변경 0은 "`status` 유지 (pending_install → 그대로 / connected → 그대로)"라고 기술하지만, spec §10.4는 `connected` + 코드 교환 실패 시 `error(auth_failed)`로 **전이**한다고 정의한다. plan대로 구현하면 기존 `connected → error(auth_failed)` 전이가 무효화되는 기능 회귀다. 이 충돌은 `review/consistency/2026-05-14_18-23-55/plan_coherence/review.md`에서 WARNING으로 지적됐으나 plan 문서가 정정되지 않은 채 현재 브랜치에 유지 중이다.
- **제안**: `cafe24-pending-polish.md` 변경 0의 `markIntegrationCallbackError` 설명을 "`pending_install` 전용 (status 보존) — `connected` 재인증 실패는 기존 error 전이 경로 유지"로 수정.

---

### [WARNING] `spec/2-navigation/4-integration.md` §13 데이터 모델 영향 요약 — `install_token` 필드 누락으로 구현자 오독

- **위치**: `spec/2-navigation/4-integration.md §13`
- **상세**: `spec/1-data-model.md §2.10`에는 `install_token (String?)` 필드와 `(install_token) WHERE install_token IS NOT NULL` 부분 인덱스가 추가됐다. §13의 Integration 변경 요약은 `status_reason, last_used_at, last_rotated_at, last_error` 4개만 열거하고 `install_token` 필드와 인덱스가 빠져 있다. 구현자가 §13만 읽으면 마이그레이션 대상에서 이 컬럼을 누락시킬 수 있다. (`review/consistency/2026-05-14_18-38-32/cross_spec/review.md` WARNING 4로 지적됐으나 미해소)
- **제안**: §13에 `install_token (String?, Cafe24 private 전용)` 필드 + `(install_token) WHERE install_token IS NOT NULL` 인덱스 행 추가.

---

### [WARNING] plan 변경 3 — HTTP 상태 코드 400 vs spec 409 불일치

- **위치**: `plan/in-progress/cafe24-pending-polish.md 변경 3`
- **상세**: plan은 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (400)`으로 기재, spec §9.4는 `(409)`로 확정. developer가 plan 기준으로 구현하면 API contract 불일치 발생. uniqueness 조건도 plan은 `(workspaceId, mall_id)`, spec은 `(workspaceId, mall_id, app_type='private')`로 달라 public/private 앱 간 의도치 않은 충돌 차단이 발생할 수 있다.
- **제안**: plan 변경 3에서 `(400)` → `(409)`, uniqueness 조건 → `(workspaceId, mall_id, app_type='private')`로 정정.

---

### [INFO] `spec/1-data-model.md` Integration status enum 확장 — TypeScript 타입 미언급

- **위치**: `spec/1-data-model.md:252`
- **상세**: `status` enum에 `pending_install`이 추가됐다. `backend/src/modules/integrations/entities/integration.entity.ts`의 TypeScript 타입(`IntegrationStatus`)은 V042 migration 시 이미 반영된 것으로 확인되지만(`naming_collision/review.md` INFO), spec 변경이 TypeScript exhaustive switch/타입 가드에 새 케이스 처리를 요구한다는 점이 plan 변경 0~5 어디에도 명시되지 않았다. Frontend 상태 표시 컴포넌트도 `pending_install`을 별도로 처리해야 한다.
- **제안**: plan 변경 1 FE 항목에 "`pending_install` 상태 표시 UI 처리 확인" 체크박스 추가.

---

### [INFO] `spec/conventions/cafe24-api-metadata.md §6` — 규약 파일 수정이 spec 패치에 혼재

- **위치**: `spec/conventions/cafe24-api-metadata.md:157-159` (DRAFT 2H)
- **상세**: 규약 파일(`spec/conventions/`)은 모든 spec에서 참조하는 단일 진실 소스다. 이번 커밋에서 spec 변경과 규약 파일 변경이 동일 커밋에 포함되어 리뷰어가 두 변경의 영향 범위를 구분하기 어렵다. 내용 자체는 기존 §6와 일관한 명시 추가이므로 의미 충돌은 없다.
- **제안**: 향후 규약 파일 수정은 별도 커밋 또는 PR 단계에서 분리하는 것을 검토.

---

## 요약

이 변경사항들은 모두 spec 및 리뷰 문서 변경이다. 실행 코드 직접 변경은 없으나, spec 변경이 구현에 미치는 부작용이 상당하다. 가장 큰 위험은 세 가지로 집약된다: (1) Cafe24 Developers에 등록된 App URL을 갱신하지 않으면 운영 앱 설치 흐름이 즉시 중단되는 외부 의존성, (2) `markIntegrationCallbackError`의 `connected` status 처리가 plan과 spec 사이에 정반대로 기술되어 구현 시 기존 `connected → error` 전이를 회귀시킬 위험, (3) `CAFE24_INSTALL_INVALID_HMAC` 의미 축소로 기존 테스트가 silent하게 잘못된 경로를 검증하게 될 가능성. BullMQ 큐 메시지 schema 확장과 plan의 HTTP 상태 코드 오기재도 구현 전 반드시 조치해야 할 항목이다.

## 위험도

**MEDIUM** — Critical 수준 코드 버그는 없으나, App URL 외부 의존성과 plan-spec 간 `connected` status 처리 모순이 구현 시 기능 회귀로 이어질 수 있다.