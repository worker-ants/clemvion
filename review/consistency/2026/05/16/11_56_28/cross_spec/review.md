# Cross-Spec 일관성 검토 결과

검토 대상: `spec/2-navigation/4-integration.md`
검토 모드: `--impl-prep`
검토 시각: 2026-05-16

---

## 발견사항

### [CRITICAL] `install_token` 콜백 성공 시 NULL 처리 여부 — data-flow spec 과 navigation spec 간 직접 모순

- **target 위치**: `spec/2-navigation/4-integration.md` §9.2 API 표, `GET /api/3rd-party/cafe24/install/:installToken` 항 설명 — "install_token 은 통합 lifetime 동안 persistent 식별자 (callback 성공 시 NULL 처리 안 함)"
- **충돌 대상**: `spec/data-flow/integration.md` §1.2.1 Cafe24 Private 앱 흐름 시퀀스 다이어그램 (line 90) — `Svc->>PG: UPDATE integration SET status=connected, install_token=NULL, credentials ENC, token_expires_at, last_rotated_at`
- **상세**: navigation spec §9.2 는 callback 성공 시 `install_token` 을 `NULL` 로 소거하지 않는다고 명시한다 (post-install navigation 식별 키로 보존). 반면 data-flow spec §1.2.1 의 시퀀스 다이어그램은 callback 성공 시 `install_token=NULL` 로 UPDATE 한다. 두 spec 이 동시에 사실일 수 없다. 이 구현 prep 의 핵심 기능인 `appUrl` 노출 (`IntegrationsService.toPublic` 에서 `install_token` → `buildCafe24InstallUrl` 계산) 은 `install_token` 이 `connected` 상태에서도 non-NULL 임을 전제한다. data-flow spec 대로 구현한다면 `connected` 행의 `install_token` 이 NULL 이 되어 `appUrl` 계산이 불가능하다.
- **제안**: `spec/data-flow/integration.md` §1.2.1 시퀀스 다이어그램의 `install_token=NULL` 을 삭제하고 navigation spec 의 "persistent 식별자" 정의와 일치하도록 갱신한다. navigation spec §6 상태 전이 표(`pending_install → connected` 행)의 "install_token 은 보존" 설명과 Rationale "Cafe24 App URL 재호출 흐름" 항이 정식 기준이다. project-planner 에 위임하여 data-flow spec 을 먼저 수정한 뒤 구현을 진행한다.

---

### [WARNING] `spec/data-flow/integration.md` §1.2.1 에 `install_token_issued_at` NULL 처리 누락

- **target 위치**: `spec/2-navigation/4-integration.md` Rationale "TTL 기준 (2026-05-15 갱신)" 항 — "callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다"
- **충돌 대상**: `spec/data-flow/integration.md` §1.2.1 시퀀스 다이어그램 line 90 — `UPDATE integration SET status=connected, install_token=NULL, credentials ENC, token_expires_at, last_rotated_at` (install_token_issued_at 항목 누락)
- **상세**: navigation spec Rationale 는 callback 성공 시 `install_token` 뿐 아니라 `install_token_issued_at` 도 NULL 로 소거해야 한다고 명시한다. data-flow spec 의 UPDATE 구문에서 `install_token_issued_at=NULL` 이 누락되어 있다. CRITICAL 항(install_token NULL vs 보존)이 해소된 후 data-flow spec 갱신 시 이 항도 함께 수정해야 한다.
- **제안**: data-flow spec §1.2.1 UPDATE 구문에 `install_token_issued_at=NULL` 추가. navigation spec Rationale 와 일치하도록 동기화.

---

### [WARNING] `PublicIntegration.appUrl` 필드가 spec 어디에도 명시되지 않음

- **target 위치**: `plan/in-progress/cafe24-app-url-detail.md` Step 5–7 — `PublicIntegration` 타입에 `appUrl: string | null` 추가, `installToken` 응답 제거
- **충돌 대상**: `spec/2-navigation/4-integration.md` §9 API 전체, §4 상세 페이지 Overview 탭 — 기존 GET `/api/integrations/:id` 응답 shape 에 `appUrl` 필드가 언급되지 않는다. 상세 페이지(§4.2 Overview 탭, §4.3 Security 탭) 에도 App URL 표시 UI 가 명세되어 있지 않다.
- **상세**: 구현 plan 은 상세 페이지에 `Cafe24AppUrlCard` 컴포넌트를 추가하고 `appUrl` 을 API 응답으로 노출할 것을 계획한다. 그러나 spec §4 상세 페이지 UI 정의와 §9.1 API 응답 shape 에 이 필드가 없다. spec 선행 갱신 없이 구현하면 spec-driven 원칙에 위배된다. plan 에서 `spec-update-cafe24-app-url-detail.md` 신규 작성으로 project-planner 위임을 언급하고 있으나, 그 spec 갱신이 완료되기 전에 구현을 진행하면 spec-code 불일치가 발생한다.
- **제안**: 구현 착수 전 project-planner 가 `spec/2-navigation/4-integration.md` §4.2(Overview 탭 Quick actions 또는 별도 블록), §9.1(GET `/api/integrations/:id` 응답 shape에 `appUrl: string | null`) 을 먼저 갱신한다. 갱신 후 consistency-checker 재통과 확인.

---

### [WARNING] `installToken` 응답 필드 제거 — 기존 API 계약에 `installToken` 존재 여부 불명확

- **target 위치**: `plan/in-progress/cafe24-app-url-detail.md` — "`installToken` 응답에서 완전히 제거 vs 보존 — App URL 의 path segment 로 이미 포함, 별도 필드 노출 불필요. 제거."
- **충돌 대상**: `spec/2-navigation/4-integration.md` §9.2 — `POST /api/integrations/oauth/begin` Cafe24 Private 응답 `{ mode:'cafe24_private_pending', integrationId, appUrl, callbackUrl }` 에 `installToken` 이 현재도 포함되지 않음. 하지만 GET `/api/integrations/:id` 응답에 `installToken` 이 포함된다는 spec 기술은 발견되지 않는다.
- **상세**: plan 은 `installToken` 을 `toPublic` 응답에서 제거한다고 명시하는데, 이 필드가 현재 응답에 실제로 포함되어 있는지 spec 에서 확인되지 않는다. spec §9.1 GET 응답 shape 이 상세히 기술되어 있지 않아, 기존 코드가 `installToken` 을 노출하고 있을 경우 API 계약 파괴(breaking change)가 될 수 있다. 외부 클라이언트(프론트엔드 이외)가 이 필드를 소비하고 있을 가능성을 배제해야 한다.
- **제안**: spec §9.1 에 GET `/api/integrations/:id` 의 응답 shape 을 명시하여 `appUrl` 포함, `installToken` 미포함을 정식 계약으로 기술한다. 구현 전 코드베이스에서 `installToken` 소비처를 점검한다.

---

### [INFO] `spec/4-nodes/4-integration/4-cafe24.md` §9.4 Private 앱 흐름 다이어그램과 navigation spec §6 상태 전이표의 `install_token` 처리 일관성 재확인 권장

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §9.4 Private 앱 등록 흐름 (line 3): "path 의 `install_token` 은 step 1 의 `pending_install` 생성 시 발급된 16바이트 base64url"
- **충돌 대상**: 동 파일에서 callback 성공 후 `install_token` NULL 처리 여부가 명시되지 않음
- **상세**: CRITICAL 항이 해소되어 data-flow spec 이 갱신될 때, cafe24 노드 spec §9.4 도 install_token 의 persistent 보존 정책을 명시적으로 기술하여 세 문서가 일관되도록 동기화를 권장한다.
- **제안**: data-flow spec 갱신 시 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 도 함께 검토·동기화.

---

## 요약

Cross-Spec 일관성 관점에서 가장 중대한 문제는 `spec/data-flow/integration.md` §1.2.1 시퀀스 다이어그램이 callback 성공 시 `install_token=NULL` 을 명시하는 반면, `spec/2-navigation/4-integration.md` §9.2 는 callback 성공 후에도 `install_token` 을 persistent 식별자로 보존한다고 명시하는 직접 모순이다. 이 모순은 이번 구현의 핵심 기능(`appUrl` 노출을 위한 `IntegrationsService.toPublic` 에서 `install_token` 비-NULL 전제)과 충돌하므로 구현 착수 전 반드시 data-flow spec 갱신이 선행되어야 한다. 또한 `appUrl` 필드 및 상세 페이지 UI 가 spec 에 미정의된 상태이므로 project-planner 를 통한 spec 갱신이 선행되어야 SDD 원칙을 준수한다.

## 위험도

HIGH
