---
worktree: cafe24-mall-dup-ux-a7f2c8
started: 2026-05-16
owner: project-planner
---

# Spec Draft — Cafe24 Public 흐름 중복 가드 + precheck endpoint

대상 파일: `spec/2-navigation/4-integration.md`
구현 PR: `claude/cafe24-mall-dup-ux-a7f2c8` (이미 backend/frontend 구현·테스트 완료, RESOLUTION 작성 완료).

---

## 변경 1 — §9.2 OAuth begin 행 (line 696)

**옛 (마지막 ※ 문구)**:
> ※ Cafe24 Private 흐름 진입 시 동일 `(workspaceId, mall_id)` 의 cafe24 Integration 이 이미 존재하면 (`app_type` 무관 — public 이든 private 이든) begin 자체가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 으로 즉시 거부된다.

**신**:
> ※ Cafe24 흐름 진입 시 (app_type 무관 — public/private 모두) 동일 `(workspaceId, mall_id)` 의 cafe24 Integration 중 다음 조건이 맞으면 begin 자체가 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)` 으로 즉시 거부된다:
> - **Public 흐름**: `status='connected'` row 존재 시. Public 은 begin 단계에서 row 를 만들지 않으므로 V045 partial UNIQUE 가 finalize 단계로 미뤄지면 사용자가 OAuth 동의까지 마친 뒤에야 충돌이 드러난다 → begin 단계 SELECT 로 connected row 만 사전 차단.
> - **Private 흐름**: `status='connected'` row 존재 시 동일 차단. 추가로 `status='pending_install'` 인 row 가 있고 `credentials.app_type='private'` 이면 새 row 를 만들지 않고 기존 row 를 reuse (`install_token` 보존, idempotent begin).
> - **다른 status (`expired`/`error`)** 는 begin 단계에서 차단하지 않고 V045 partial UNIQUE 가 finalize 단계의 race backstop 으로 동일 409 코드로 변환한다 (사용자가 재연동 의도로 다시 등록하더라도 한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 — 기존 행을 먼저 삭제해야 한다). 자세한 근거는 Rationale "Cafe24 Public 흐름의 begin-time 사전 가드 추가" 항.

## 변경 2 — §9.2 신규 endpoint 행 추가 (line 696 다음)

```
| GET | `/api/integrations/cafe24/precheck` | 사용자가 mall_id 입력 단계에서 호출하는 사전 중복 감지. 쿼리: `mallId` (`^[a-z0-9-]{3,50}$`). 응답 DTO: `Cafe24PrecheckResultDto` (`ApiOkWrappedResponse` 래퍼) = `{ conflict: bool, existingIntegrationId?: string, existingName?: string, status?: 'connected'\|'pending_install'\|'expired'\|'error' }`. **인증된 사용자의 current workspace** (X-Workspace-Id 헤더 기준) **소속 cafe24 row 만 노출** — cross-workspace 접근 경로 아님 (Organization-scope 도입 시 본 한정을 재검토하지 않아도 됨, current workspace 의 정의가 변경되면 자동 추종). 자격 증명·토큰·timestamps 미노출. priority `connected > pending_install > error > expired` 로 가장 제한적인 row 만 반환. enum 범위 밖 transitional status (`initializing` 등) 가 들어오면 `status` 필드를 omit 해 frontend silent fallthrough 방지. **NestJS 라우트 선언 순서**: `:id` 동적 경로보다 앞에 선언해야 `cafe24` 가 UUID 로 해석되지 않는다 (코드 회귀 안전망은 controller 주석에 명시). **throttle 60/min** — 이 endpoint 전용 상한이며 일반 API rate limit (`spec/5-system/2-api-convention.md` 의 기본 정책) 위에 더해지지 않고 본 값으로 대체된다. 사용자 입력 350ms debounce 기준 정상 호출 1~2회/입력으로 충분. 자세한 근거는 Rationale "precheck endpoint — mall_id 입력 단계 사전 감지 UX" 항. |
```

## 변경 3 — §9.4 errors 의 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 행 (line 725)

> ※ 사용자 지시 (2026-05-16): 본 코드의 rename (`→ CAFE24_MALL_ALREADY_CONNECTED`) 은 **기각**. 사유는 변경 4 의 Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정" 항. 메시지·설명만 일반화하고 코드 이름은 호환성 유지.

**옛**:
> `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (409) — 동일 `(workspaceId, mall_id)` 에 이미 cafe24 Integration (`app_type` 무관 — public/private 모두) 이 존재. SQL UNIQUE 가 `service_type='cafe24'` 기준이므로 app_type 분리 보유 불가. swagger 규약(spec/conventions/swagger.md §2-4 — 중복/충돌은 409, `INTEGRATION_IN_USE(409)` 선례) 에 맞춤

**신**:
> `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (409) — 동일 `(workspaceId, mall_id)` 에 이미 cafe24 Integration (`app_type` 무관 — public/private 모두) 이 존재. SQL UNIQUE 가 `service_type='cafe24'` 기준이므로 app_type 분리 보유 불가. **두 경로에서 동일 코드 반환**: ① Cafe24 Public/Private begin 의 사전 SELECT (connected row 만 차단), ② `POST /api/integrations` finalize 단계의 V045 partial UNIQUE 위반 (race backstop — `idx_integration_cafe24_workspace_mall` 의 `23505` 를 `throwIfUniqueViolation` 이 본 코드로 변환). 코드 이름의 `PRIVATE` 토큰은 historical artifact (2026-05-15 신설 당시 Private 흐름 한정이었음) 이며 의미는 본 spec 정의에 따른다 — 클라이언트는 코드 이름이 아닌 본 의미(mall_id 기준 중복) 로 분기 (의미 기반 명명 선례 예외, Rationale 항 참조). swagger 규약(spec/conventions/swagger.md §2-4 — 중복/충돌은 409, `INTEGRATION_IN_USE(409)` 선례) 에 맞춤.

## 변경 4 — Rationale 신설 2개 항목 (Rationale 섹션 말미에 추가)

### Cafe24 Public 흐름의 begin-time 사전 가드 추가 (2026-05-16)

Public 흐름은 begin 단계에서 Integration row 를 만들지 않으므로 V045 partial UNIQUE 가 발사되는 시점이 `POST /api/integrations` finalize 단계로 미뤄진다. 사용자가 Cafe24 동의 페이지까지 마친 뒤에야 충돌이 드러나고, `IntegrationsService.throwIfUniqueViolation` 의 옛 분기는 `integration_workspace_name_unique` 만 처리해 `idx_integration_cafe24_workspace_mall` 위반은 raw `QueryFailedError` → 500 으로 빠지던 UX 결함이 있었다.

조치 (PR `cafe24-mall-dup-ux-a7f2c8`):

- **begin 단계 사전 가드** — Public 분기에도 Private 와 동일한 `(workspaceId, mall_id)` connected row 사전 SELECT 추가. `IntegrationOAuthService.findConnectedCafe24MallIntegration` 헬퍼로 두 흐름 공유.
- **race backstop 확장** — `throwIfUniqueViolation` 에 `idx_integration_cafe24_workspace_mall` 분기 추가. begin pre-check 통과 후 동시 INSERT race / finalize 시점 충돌도 동일 409 코드로 변환.

**다른 status (`pending_install`/`expired`/`error`) 가 begin 단계에서 차단되지 않는 이유**:
- `pending_install` 은 Private 흐름의 idempotent begin 정책 (같은 row 를 reuse 해 install_token 보존) 과 호환되어야 한다 (`CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로` 항 참조). Public 흐름은 begin 단계에서 row 를 만들지 않으므로 pending_install 이 있더라도 begin 자체는 무영향 — V045 가 finalize 단계에서 차단.
- `expired`/`error` 는 사용자의 재연동 의도를 반영해 begin 진입 자체는 허용하되, 한 workspace 안에서 같은 mall_id 의 cafe24 통합이 최대 1행이라는 invariant 는 V045 partial UNIQUE 가 finalize 단계에서 보장 (사용자는 기존 행을 먼저 삭제해야 새 통합 등록 가능).
- 결과적으로 모든 비-connected status 의 race / 충돌은 finalize 의 V045 backstop 이 동일 409 코드로 변환 → 클라이언트는 단일 분기.

### CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정 (2026-05-16)

본 코드를 Public 흐름에도 재사용하면서 `→ CAFE24_MALL_ALREADY_CONNECTED` rename 안이 ai-review 와 consistency-check 양쪽에서 제기됐으나 사용자 지시로 **기각**. 사유:

- **(a) 클라이언트 호환성** — 기존 클라이언트(프론트엔드, integration 사용자)는 코드의 *의미* (mall_id 기준 중복) 로 분기 처리하므로 이름 변경으로 얻는 가독성 이득은 없다. rename 시 deprecated 처리·alias 추가 등 호환성 부담만 발생.
- **(b) swagger 규약 정합** — `spec/conventions/swagger.md §2-4` 의 중복/충돌 409 정책과 `INTEGRATION_IN_USE(409)` 선례에 부합. 이름 토큰의 정확성보다 상태 코드·의미의 정확성이 우선.
- **(c) 의미 기반 명명 선례 예외** — `spec/conventions/swagger.md` 의 의미 기반 명명 원칙에서 본 코드는 hisotrical artifact 예외로 등록한다. 신규 코드는 이 예외를 따르지 않으며 처음부터 의미 정확한 이름을 부여한다.

장기적으로 본 코드가 다른 mall_id 충돌 케이스 (예: cross-workspace 정책 변경) 와 분리해야 할 필요가 생기면 별도 코드 신설을 고려하되, 그 시점까지는 본 코드의 정의를 spec 으로 명확화해 유지한다.

### precheck endpoint — mall_id 입력 단계 사전 감지 UX (2026-05-16)

사용자가 mall_id 를 다 입력하기 전(타이핑 중)에 conflict 를 감지해 inline 경고 배너로 보여주는 read-only endpoint. begin 의 pre-check 와 동일한 SELECT 를 노출하되, 다음 5가지 설계 결정을 반영한다.

- **응답 shape 최소화** — `{ conflict, existingIntegrationId?, existingName?, status? }` 만 반환. 자격 증명·토큰·timestamps·workspace 메타 비포함.
- **노출 범위 격리** — 인증된 사용자의 current workspace (X-Workspace-Id 헤더 기준) 소속 cafe24 row 만 반환. cross-workspace enumeration 경로 아님. Organization-scope 도입 후에도 current workspace 의 정의가 변경되면 본 endpoint 가 자동 추종 (별도 RBAC 처리 불필요).
- **priority status 단일 반환** — `connected > pending_install > error > expired` 순서로 가장 제한적인 status 만 반환 (전체 row 목록이 아닌 단일 status). frontend i18n 메시지 분기 4종이 priority 순으로 일치.
- **enum 범위 밖 status 처리** — 미래에 추가될 수 있는 transitional status (예: `initializing`) 가 들어오면 `status` 필드를 omit. 강제 캐스팅으로 frontend 가 unknown enum 을 silent fallthrough 하는 위험 차단.
- **throttle** — 분당 60회. **이 endpoint 전용 상한** (일반 API rate limit 위에 더해지지 않고 본 값으로 대체 — `@Throttle` decorator 적용). 사용자 입력 350ms debounce 기준 정상 호출 1~2회/입력으로 충분한 여유. mall_id 패턴 정규식 매칭이 frontend 에서 사전 1차 차단되므로 backend 호출 자체가 압축됨. brute-force enumeration 의 비용은 회당 1 SQL 조회 + JWT 검증으로 낮으나 throttle 이 backstop.

**O(N) 폐기와의 관계** — Cafe24 install_token mismatch 회복 흐름 항에서 폐기된 "전방위 O(N) mall_id 스캔 + HMAC trial" 패턴과 본 endpoint 는 다르다. precheck 는 V045 plain mall_id 컬럼의 단일 인덱스 lookup (`(workspace_id, mall_id) WHERE service_type='cafe24'`) 으로 O(1) row 만 가져온다. legacy `mall_id IS NULL` fallback 만 backfill 완료 전 임시로 추가 쿼리 발행 — 향후 backfill 종료 시 제거된다 (구현 코드 주석 `findAllCafe24RowsForMall` 참조).

라우트 선언 순서 주의는 변경 2 의 §9.2 표 행에 명시되어 있다 (NestJS 데코레이터 순서 — `cafe24/precheck` 를 `:id` 보다 앞에 선언).

---

## 영향 분석

| 문서 | 변경 |
|------|------|
| `spec/2-navigation/4-integration.md` | §9.2 (begin 행 + 신규 precheck 행), §9.4 errors, Rationale 3개 항목 신설 |
| `spec/data-flow/5-integration.md` | 변경 없음 (V045/V046 constraint 자체 유지). precheck SELECT 흐름 추가는 후속 plan 으로 검토 (data-flow 의 read-only endpoint 일관 패턴화 시점) |
| `spec/1-data-model.md` | 변경 없음 |
| `spec/conventions/swagger.md` | 변경 없음 (`INTEGRATION_IN_USE(409)` 와 동일 정책 — 이미 부합). `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 의 의미 기반 명명 선례 예외는 본 spec 의 Rationale 에 inline 으로 등록 (별도 conventions 갱신 불필요) |

side-effect 검토 결과 — 본 변경은 §9.2 표·§9.4 errors·Rationale 의 추가/확장 중심이며 기존 §6 상태 전이, §10 callback, §11 스캐너 흐름과는 결합 없음.

## 직렬화 조건 (착수 전 점검)

consistency-check 의 plan_coherence checker 가 `cafe24-pending-polish-7fdb7e` / `cafe24-app-url-reuse-f9a2e3` / `prod-rereview-fix-a7c93f` worktree 와의 §9.2 / Rationale 충돌을 Critical 로 제기했으나, **세 worktree 의 PR (#18, #39 등) 은 이미 origin/main 에 merged 됐고** 본 branch 는 `git rebase origin/main` 으로 동기화 완료. 따라서 실제 충돌은 없으며 stale plan note 만 `plan/in-progress/` 에 남아있는 상태. 후속 cleanup (해당 plan 들을 `plan/complete/` 로 이동) 은 별도 plan 정리 worktree (`cafe24-plan-cleanup-3a7c9b` 가 이미 존재) 의 책임이며 본 PR 의 범위 밖.

따라서 본 spec draft 는 추가 직렬화 없이 `spec/` 본문 반영 가능.
