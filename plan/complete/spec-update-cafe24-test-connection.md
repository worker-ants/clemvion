---
worktree: cafe24-test-connection-2d7fa4
started: 2026-05-16
owner: developer (project-planner 위임용)
---

# Spec 갱신 위임: cafe24 연결 테스트

## 위임 사유

`POST /api/integrations/:id/test` 의 cafe24 분기를 실 API 핑으로 구현했다 (worktree
`cafe24-test-connection-2d7fa4`, branch `claude/cafe24-test-connection-2d7fa4`).
spec §5.8 의 기술이 구현과 어긋나서 project-planner 가 spec 본문을 갱신해야 한다.

## 머지 의존성 — **착수 전 직렬화 필수**

본 spec 갱신은 다음 작업이 main 에 머지된 후 착수한다 (consistency-checker 의 plan_coherence
checker, 2026-05-16 13:37 세션 Critical 1·2):

- `cafe24-spec-sync-e2a8b9` — `spec/2-navigation/4-integration.md` 동시 수정 중
- `cafe24-app-url-reuse-f9a2e3` — §3.2/§4.4/§6/§9/§10.2/Rationale 다수 절 수정 중
- `prod-rereview-fix-a7c93f` — §11 전체 재구성 중 (`spec-update-cafe24-background-refresh.md`)

위 3건 머지 전 본 위임을 진행하면 spec 파일에 동시 수정 충돌이 발생한다.

## 갱신 대상

### §5.8 "테스트 방법" 항목 (필수)

**현행**:
> **테스트 방법**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/store` 핑.
> 응답 200 + JSON 본문 확인.

**갱신 제안**:
> **테스트 방법**: 저장된 `access_token` 으로 `GET https://{mall_id}.cafe24api.com/api/v2/admin/apps` 핑.
> 응답 200 + JSON 본문 확인.
>
> - **Endpoint 선택 근거**: `/apps` 는 자기 앱 정보 조회로, 모든 cafe24 통합이 자기 앱이므로 scope 부족
>   위험이 가장 적다. 옛 `/store` 는 `mall.read_store` scope 가 없으면 403 으로 false negative 발생.
> - **401 자동 회복**: 응답 401 (`access_token time expired` 등) 시 `refresh_token` 으로 access_token
>   을 갱신한 뒤 1회 재시도. 재시도도 401 이면 `error(auth_failed)` 로 전이.
>   §10.5 의 proactive `ensureFreshToken` 이 race condition (DB `expires_at` 미동기, 다중 인스턴스 등)
>   으로 빗나간 경우 자가 회복하기 위함.
> - **transport 실패는 카운터 합산 제외**: 사용자가 직접 누른 진단용 호출이므로,
>   `Integration.consecutive_network_failures` (§14.1) 합산 대상에서 제외. 이 카운터는 노드 실행
>   시점의 자동 호출만 합산한다.
> - **사전 검증(`POST /api/integrations/preview-test`)** 은 단순 ping 만 수행 — 막 발급된 토큰이라
>   refresh 가 불필요하다.

### §9.1 또는 §14.1 — `pending_install` 상태 보호 (권장)

`POST /api/integrations/:id/test` 에 `status='pending_install'` 인 integration 이 호출되면
`422 INTEGRATION_INCOMPLETE` 반환. 현재 §2.2 가 UI 측면에서 버튼 비활성을 명시했으나 API 직호출
대비 spec 누락.

## 구현 위치 (참조용)

- `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `pingConnection(integration)` 추가
- `codebase/backend/src/modules/integrations/integrations.service.ts` — `dispatchTest` 외부에서 cafe24 entity-aware 분기

## 처리 후

본 노트를 `plan/complete/` 로 이동(`git mv`).

---

**2026-05-18 처리 완료** — worktree `cafe24-test-spec-guard-263221` 에서 단일 PR 로 다음을 동시 반영:

- **spec §5.8 "테스트 방법"**: `/admin/store` → `/admin/apps`, 401 자가 회복, 403/`CAFE24_INSUFFICIENT_SCOPE` 처리, transport 실패 카운터 제외, preview-test 단순 ping 명문화.
- **spec §9.1 `/test` 행 비고**: `pending_install` row 는 200 + `{ success:false, code:'INTEGRATION_INCOMPLETE' }` 로 거부 — service_type 무관 status 가드, UI 버튼 비활성의 backend backstop.
- **spec Rationale**: "연결 테스트 endpoint 를 `/store` 에서 `/apps` 로 전환 (2026-05-18)", "연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식 (2026-05-18)" 두 항 추가. plan 원안의 422 안은 인접 가드 (`INTEGRATION_CREDENTIALS_UNREADABLE`, cafe24 incomplete credentials) 와의 응답 형식 일관성을 우선해 200 + success:false 로 갱신.
- **`IntegrationsService.testConnection` 가드**: `entity.status === 'pending_install'` 한 줄 분기 추가, service_type 무관. unit test 2 케이스 추가 (cafe24 + http) — 전체 backend 217 suites · 3895 tests 통과.
