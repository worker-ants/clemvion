---
worktree: spec-integration-autorefresh-b2c4f1
started: 2026-05-17
owner: planner
---

# Spec Draft: 자동 갱신 통합(autoRefresh) 친화적 UI·attention 술어 개정

> 대상 spec: `spec/2-navigation/4-integration.md` (단일 파일 개정)
> 발단: developer skill 의 `consistency-check --impl-prep` 가 BLOCK: YES (Critical 2건) 으로 차단 — 사용자 결정으로 spec 선행 흐름 선택 (2026-05-17).
> 자매 plan: `plan/in-progress/integration-token-ui-autorefresh.md` (구현용 — 다른 worktree)
> 위임 문서: `plan/in-progress/spec-update-integration-autorefresh.md` (요구사항 §A~§H)

## 1. 개정 요지

카페24 access_token 의 **2시간 수명**이 spec §2.4·§2.3·§11.4 의 7일 임계치보다 짧아 attention 술어가 항상 true 가 되는 거짓 양성. 백엔드 자동 갱신(`cafe24-token-refresh` 큐 + `cafe24-background-refresh` 일일 잡)은 정상 동작 중이므로 사용자 액션이 불필요한데도 사이드바·배너·칩에 "주의 필요" 로 표시되어 오독을 유발한다.

본 개정으로 `Integration` 응답에 **derived 식별자 `autoRefresh: boolean`** 을 추가하고, attention 술어 전반에서 자동 갱신 통합을 제외한다. 동시에 상세 페이지의 헤더·Overview 가 자동 갱신 사실을 보조 라벨로 알리도록 표현 정책을 명문화한다.

## 2. autoRefresh 정의 (개정 본문에서 사용할 명문 정의)

- **derived field** — DB 컬럼 아님. `ServiceDefinition.supportsTokenAutoRefresh` 에서 파생 (`backend/src/modules/integrations/services/service-registry.ts`).
- **true** = service 가 OAuth 이고 provider 가 refresh_token 을 발급·갱신: 현재 `cafe24`, `google`.
- **false** = 그 외. `github` (Refresh ✗ — §10.3 표), api_key / basic / bearer / smtp / webhook_outbound / connection_string / mcp 등.
- **frontend 분기 신호**: 상태 배지 라벨·attention 술어·Reauthorize 비활성·Overview 표기 모두 본 플래그로 분기.

## 3. 본 PR 범위 / 범위 밖

### 본 PR 범위

| § | 변경 |
| --- | --- |
| §2.2 항목 요소 (상태 텍스트 표) | autoRefresh 통합은 만료 임박 시에도 `Connected` 표시·`Auto-renews` 보조 라벨이라는 한 줄 추가 |
| §2.3 검색·필터 (`Expiring` 칩 정의) | "7일 이내 + NOT autoRefresh" 명시. `?status=expiring` 가상 필터 술어 동일 |
| §2.4 Need attention 배너 (포함 조건) | `(connected AND token_expires_at within 7d)` 조건에 `AND NOT autoRefresh` 추가 |
| §4.1 상세 페이지 헤더 | autoRefresh=true 한정 보조 라벨 `Auto-renews · next in <duration>` 명시 |
| §4.2 Overview 탭 — 기본 정보 | Token Expires 행을 autoRefresh=true 면 친화 표기(`in 1h 24m · auto-renews`) + 절대시각 Tooltip 으로 강등 |
| §4.2 Overview 탭 — Quick actions 의 Reauthorize 비활성 | autoRefresh=true 면 "현재 자동 갱신 중" 안내 + 비활성 (I-2) |
| §9.1 IntegrationDto | `autoRefresh: boolean` 필드 추가 + derived 명시 |
| §9.1 `?status=expiring`·`?status=attention` 가상 필터 정의 | autoRefresh 제외 술어 반영 |
| §10.5 토큰 자동 갱신 | "이 자동 갱신 여부는 `IntegrationDto.autoRefresh` 로 노출" 한 줄 명시 |
| §11.4 UI 배지 (사이드바 카운트) | §2.4 와 동일 술어 (autoRefresh 제외) |
| Rationale | 신규 항목 "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" + autoRefresh 식별자가 derived 인 이유 |

### 본 PR 범위 밖 (별도 spec PR / 별도 후속 PR)

- **W-5** (`14-execution-history.md` 의 PRD 잔재 정리), **I-6** (Rationale 섹션 누락 보강), **I-7** (`0-dashboard.md` prefix), **I-8** (`cafe24-api-catalog/_overview.md` prefix), **I-9** (`10-auth-flow.md` HTTP 메서드 불일치), **I-10~I-12** (casing 명시 보강) — 모두 본 주제와 무관한 위생 항목. 별도 plan `plan/in-progress/spec-update-2-navigation-hygiene.md` 신설 권장 (본 PR 에 포함하면 응집도 저하).
- **백엔드 쿼리 갱신** (`EXPIRING_SOON_INTERVAL` 변경 — `integrations.service.ts:248~275`) 및 frontend `needsAttention()` 가드 — `plan/in-progress/integration-token-ui-autorefresh.md` 의 후속 PR 로 분리 (이미 별도 plan 으로 추적 중).

## 4. 정확한 패치 (before / after)

> 각 패치는 `spec/2-navigation/4-integration.md` 의 현재 본문에서 정확히 한 곳을 가리킨다.

### 4.1 §2.2 항목 요소 — 표 아래에 한 줄 추가

**위치**: 현재 §2.2 표(50~60 라인) 직후, §2.3 시작(62 라인) 직전.

**추가**:

```markdown
> **자동 갱신 통합 (`autoRefresh=true`, §9.1)**: 만료 임박 시에도 상태 텍스트는 `Connected` 를 유지하고, 작은 보조 라벨 `Auto-renews` 로 자동 갱신 사실을 알린다. 표의 `Expires in Nd` 는 `autoRefresh=false` 통합에만 적용된다.
```

### 4.2 §2.3 검색·필터 — 표의 "상태 칩" 행 보강 + 가상 필터값 주석 확장

**위치**: 라인 69 (상태 칩 행) + 라인 73 (※ 가상 필터값 설명).

**Before** (라인 69):
```markdown
| 상태 칩 | `All` / `Attention` / `Connected` / `Expiring` (7일 이내) / `Expired` / `Error`. 단일 선택 |
```

**After**:
```markdown
| 상태 칩 | `All` / `Attention` / `Connected` / `Expiring` / `Expired` / `Error`. 단일 선택. `Expiring` = `status='connected' AND token_expires_at within 7d AND NOT integration.autoRefresh` — 자동 갱신 통합(§9.1)은 제외 |
```

**Before** (라인 73):
```markdown
※ `expiring` 과 `attention` 두 값은 DB `Integration.status` Enum 에는 존재하지 않는 **가상 필터값(virtual filter)** 이다 — 백엔드 쿼리 빌더가 §9.1 의 `status` 파라미터를 받아 합집합 WHERE 절로 변환한다. DB Enum (`connected`/`expired`/`error`/`pending_install`) 자체를 확장하지 않는 것은 영속화되는 상태와 화면 필터링용 술어를 분리하기 위함이다.
```

**After**:
```markdown
※ `expiring` 과 `attention` 두 값은 DB `Integration.status` Enum 에는 존재하지 않는 **가상 필터값(virtual filter)** 이다 — 백엔드 쿼리 빌더가 §9.1 의 `status` 파라미터를 받아 합집합 WHERE 절로 변환한다. DB Enum (`connected`/`expired`/`error`/`pending_install`) 자체를 확장하지 않는 것은 영속화되는 상태와 화면 필터링용 술어를 분리하기 위함이다. 두 가상값 모두 자동 갱신 통합(§9.1 `autoRefresh=true`) 을 술어에서 제외한다 (Rationale "자동 갱신 통합을 attention 술어에서 제외" 항 참고).
```

### 4.3 §2.4 "Need attention" 배너 — 포함 조건 보강

**위치**: 라인 81 (포함 조건 글머리표).

**Before**:
```markdown
- **포함 조건**: `status IN (expired, error)` OR `(status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')`. `pending_install` 은 사용자가 외부(Cafe24 Developers)에서 흐름을 진행 중인 정상 상태로 보고 배너에서 제외 — `status_reason` 이 채워진 케이스도 동일. `install_timeout` 사유로 `expired` 가 된 Cafe24 Private 행은 attention 에 포함된다 (사용자 조치(삭제 후 재등록)가 필요한 정상 운영 신호).
```

**After**:
```markdown
- **포함 조건**: `status IN (expired, error)` OR `(status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d' AND NOT integration.autoRefresh)`. `pending_install` 은 사용자가 외부(Cafe24 Developers)에서 흐름을 진행 중인 정상 상태로 보고 배너에서 제외 — `status_reason` 이 채워진 케이스도 동일. `install_timeout` 사유로 `expired` 가 된 Cafe24 Private 행은 attention 에 포함된다 (사용자 조치(삭제 후 재등록)가 필요한 정상 운영 신호). **자동 갱신 통합(`autoRefresh=true`)** 은 만료 임박(7d 이내) 분기에서 제외 — 짧은-수명 토큰(예: cafe24 2h)의 거짓 양성 방지. autoRefresh 통합의 실패 신호는 §10.5 의 `error(auth_failed)` / `error(network)` 전이로 별도 attention 에 잡힌다.
```

### 4.4 §4.1 상세 페이지 헤더 — 보조 라벨 명시

**위치**: 라인 235~252 (§4.1 레이아웃).

레이아웃 ASCII 도식은 그대로 두고, 그 직후 (라인 252 "헤더 아래 탭..." 한 줄) 위에 헤더 메타 라인 규약을 한 항목으로 추가한다.

**Before** (라인 250~252):
```markdown
└──────────────────────────────────────────────────────────────┘
```

헤더 아래 탭(앵커 기반 `#security`, `#usage`, …)으로 섹션을 스위치한다.
```

**After**:
```markdown
└──────────────────────────────────────────────────────────────┘
```

**헤더 메타 라인**: `<인증 유형> · <Scope> · <상태 배지> · <Last used …>` 형식. **자동 갱신 통합(`autoRefresh=true`, §9.1)** 은 상태 배지의 메인 라벨이 `Connected` 인 경우에 한해 그 옆에 작은 보조 라벨 `Auto-renews · next in <duration>` 을 회색 톤(`muted-foreground`)으로 노출한다 (예: `Auto-renews · next in 1h 24m`). `<duration>` 은 `token_expires_at - NOW()` 의 사람 친화 표기. `connected` 가 아닌 다른 상태(에러·만료 등) 이거나 `autoRefresh=false` 면 보조 라벨은 표시하지 않는다.

헤더 아래 탭(앵커 기반 `#security`, `#usage`, …)으로 섹션을 스위치한다.
```

### 4.5 §4.2 Overview 탭 — 기본 정보 + Reauthorize 비활성 조건 보강

**위치**: 라인 254~262 (§4.2 표).

**Before** (라인 258~259):
```markdown
| 기본 정보 | 서비스, 별칭, 생성자, 생성·수정일, 마지막 사용 시각, 마지막 회전 시각, 토큰 만료 시각 |
| Quick actions | `Test connection` (connected 한정), `Reauthorize`(OAuth · `pending_install` 또는 cafe24 private 에서 비활성 — §4.3 Reauthorize 상세 조건 참조), `Rotate credentials`(비OAuth), `Edit alias` |
```

**After**:
```markdown
| 기본 정보 | 서비스, 별칭, 생성자, 생성·수정일, 마지막 사용 시각, 마지막 회전 시각, **토큰 만료 시각** (`autoRefresh=true` 통합은 친화 표기 `in <duration> · auto-renews` 로 노출하고 절대시각은 행 호버 시 Tooltip 으로 강등. `autoRefresh=false` 는 기존대로 절대시각 직접 표기) |
| Quick actions | `Test connection` (connected 한정), `Reauthorize`(OAuth · `pending_install` 또는 cafe24 private 에서 비활성 — §4.3 Reauthorize 상세 조건 참조. `autoRefresh=true` 통합이 `status='connected'` 인 동안에도 자동 갱신이 정상 동작 중이므로 사용자 액션 불필요 — 버튼은 활성 상태로 두되 hover 시 "Auto-renewing — manual reauthorization unnecessary" 안내). `Rotate credentials`(비OAuth), `Edit alias` |
```

> 참고: §4.3 Security 탭의 Reauthorize 행 (라인 269) 의 **비활성 조건**은 별도로 손대지 않는다 — autoRefresh=true 라도 사용자가 명시적으로 재인증을 시도할 권한 자체는 유지 (예: scope 정리 후 재발급). hover 안내만 보강.

### 4.6 §9.1 IntegrationDto — `autoRefresh: boolean` 필드 추가

**위치**: 라인 686 (`GET /api/integrations/:id` 행) — 응답 envelope 정의를 풀어 쓴 부분.

**Before**:
```markdown
| GET | `/api/integrations/:id` | 상세 조회. credentials 는 마스킹. 응답 envelope 는 [API 규약 §5.1](../5-system/2-api-convention.md#51-단일-리소스) 의 `{ data: IntegrationDto }` 형식이며, `IntegrationDto` 는 `appUrl: string \| null` 필드를 포함한다 — Cafe24 Private 통합 (`service_type='cafe24' AND credentials.app_type='private'`) 은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 값, 그 외 통합은 `null`. `install_token` 자체는 응답에 별도 필드로 노출되지 않고 App URL path segment 안에만 포함된다 (식별자 분산 방지 — Rationale "Cafe24 App URL 상세 페이지 표시" 참조). |
```

**After**:
```markdown
| GET | `/api/integrations/:id` | 상세 조회. credentials 는 마스킹. 응답 envelope 는 [API 규약 §5.1](../5-system/2-api-convention.md#51-단일-리소스) 의 `{ data: IntegrationDto }` 형식이며, `IntegrationDto` 는 다음 두 derived 필드를 포함한다 — (a) `appUrl: string \| null` — Cafe24 Private 통합 (`service_type='cafe24' AND credentials.app_type='private'`) 은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 값, 그 외 통합은 `null`. `install_token` 자체는 응답에 별도 필드로 노출되지 않고 App URL path segment 안에만 포함된다 (식별자 분산 방지 — Rationale "Cafe24 App URL 상세 페이지 표시" 참조). (b) **`autoRefresh: boolean`** — 자동 갱신 가능 통합 식별자. `ServiceDefinition.supportsTokenAutoRefresh` (backend service registry) 에서 파생되는 derived 필드로 DB 컬럼이 아니며, 매 응답 시점에 계산된다. 현재 `service_type='cafe24'`, `service_type='google'` 이 `true`, 그 외(`github` 포함 — Refresh ✗, §10.3) 는 `false`. 사이드바 카운트(§11.4) / `Need attention` 배너(§2.4) / `Expiring`·`Attention` 칩(§2.3) / 상세 페이지 헤더·Overview(§4.1·§4.2) 의 UI 분기 신호로 사용된다. |
```

### 4.7 §9.1 — `?status=expiring`·`?status=attention` 가상 필터 술어 명시 보강

**위치**: 라인 684 (`GET /api/integrations` 행).

**Before**:
```markdown
| GET | `/api/integrations` | 목록 조회. 쿼리: `q`, `scope`, `serviceType`, `status`, `page`, `limit`. `status` 허용값 = `connected` / `expiring` / `expired` / `error` / `attention` — 이 중 `expiring` 과 `attention` 은 **가상 필터값** 으로 DB Enum 에는 없고 백엔드 쿼리 빌더가 합집합 WHERE 절로 변환한다 (`expiring` = `status='connected' AND token_expires_at within 7d`, `attention` = `Expired ∪ Expiring ∪ Error`). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. |
```

**After**:
```markdown
| GET | `/api/integrations` | 목록 조회. 쿼리: `q`, `scope`, `serviceType`, `status`, `page`, `limit`. `status` 허용값 = `connected` / `expiring` / `expired` / `error` / `attention` — 이 중 `expiring` 과 `attention` 은 **가상 필터값** 으로 DB Enum 에는 없고 백엔드 쿼리 빌더가 합집합 WHERE 절로 변환한다. `expiring` = `status='connected' AND token_expires_at within 7d AND NOT integration.autoRefresh`, `attention` = `Expired ∪ Expiring ∪ Error` (`Expiring` 의 autoRefresh 제외가 자동 전파). 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수. |
```

### 4.8 §10.5 토큰 자동 갱신 — `IntegrationDto.autoRefresh` 와 연결

**위치**: 라인 798~804 (§10.5 본문).

**Before** (라인 800):
```markdown
- Refresh token 보유 시: 노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출
```

**After**:
```markdown
- Refresh token 보유 시 (provider 가 refresh_token 발급·갱신을 보장 — 현재 `cafe24`, `google`): 노드 실행 직전 만료 확인 → 만료됐으면 갱신 후 호출. 이 자동 갱신 가능 여부는 `IntegrationDto.autoRefresh: boolean` 필드(§9.1) 로 클라이언트에 노출되어 상태 배지·attention 술어·Reauthorize hover 안내의 분기 신호로 쓰인다.
```

### 4.9 §11.4 UI 배지 — 사이드바 카운트 술어 보강

**위치**: 라인 881 (사이드바 Integration 메뉴 글머리표).

**Before**:
```markdown
- 사이드바 Integration 메뉴: `status IN (expired, error) OR (status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')` 카운트 — §2.4 배너 포함 조건 및 §9.1 `?status=attention` 가상 필터값과 동일한 술어. `pending_install` 은 제외.
```

**After**:
```markdown
- 사이드바 Integration 메뉴: `status IN (expired, error) OR (status='connected' AND token_expires_at IS NOT NULL AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d' AND NOT integration.autoRefresh)` 카운트 — §2.4 배너 포함 조건 및 §9.1 `?status=attention` 가상 필터값과 동일한 술어. `pending_install` 은 제외. **자동 갱신 통합(`autoRefresh=true`)** 은 만료 임박 분기에서 제외 (§2.4 와 동일 사유).
```

### 4.10 Rationale — 신규 항목 추가

**위치**: 라인 977 (§"Attention 가상 필터값" 항목 끝) 직후, 라인 979 (§"Cafe24 Private 앱의 callback 실패..." 항목) 직전.

**추가**:

```markdown
### 자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)

§2.4·§11.4·§2.3 의 attention/expiring 술어는 `token_expires_at <= NOW() + INTERVAL '7d'` 단일 임계치만 사용했다. 그런데 **Cafe24 OAuth access_token 의 수명은 2시간** 이라 이 술어가 항상 true 가 되어, 자동 갱신이 동작하는 정상 통합도 사이드바 attention 카운트·"Need attention" 배너·`Expiring` 칩에 영구 포함됐다 (2026-05-17 사용자 보고 — `/integrations/[id]` 상세 페이지 헤더가 항상 "Expires today" 노란 톤으로 표시되어 사용자가 갱신 실패로 오독).

**결정**: 응답 DTO 에 derived 식별자 `autoRefresh: boolean` (§9.1) 을 추가하고, 모든 attention 술어(§2.4·§11.4·§2.3 `Expiring` 칩·§9.1 `?status=expiring`·`?status=attention` 가상 필터) 에서 `autoRefresh=true` 행을 만료 임박 분기에서 제외한다. 동시에 상세 페이지 헤더(§4.1) 와 Overview Token Expires 행(§4.2) 이 autoRefresh 사실을 보조 라벨/친화 표기로 알리도록 표현 정책을 명문화한다.

**왜 derived 인가**: `autoRefresh` 는 DB 컬럼이 아니라 `ServiceDefinition.supportsTokenAutoRefresh` (백엔드 service registry — `cafe24`/`google` 만 true) 에서 매 응답 시점에 계산된다. service 신설·정책 변경이 잦은 영역이라 영속화하지 않고 코드 한 곳에서 결정되도록 분리. 옛 attention 술어는 `service_type` 직접 비교로도 동일 효과를 낼 수 있었지만, (a) 신규 OAuth provider 추가 시마다 SQL 술어를 손대야 하고, (b) "왜 이 service 가 제외되는가" 의 의도가 SQL 에 묻혀 사라지므로 derived 플래그를 한 단계 거치게 했다.

**자동 갱신 통합의 실패 신호 보전**: 자동 갱신이 실패해 `error(auth_failed)` (invalid_grant) 또는 `error(network)` (transport 3회 연속 실패) 로 전이하면, 그 행은 status 가 `error` 라 본 술어와 무관하게 attention 에 포함된다 — 사용자 신호 회귀 없음 (§10.5 의 전이 정책 + §11.2 `integration_action_required` 알림이 별도로 발사).

**과거 결정과의 호환**: `Attention 가상 필터값` (2026-05-16) 의 "DB Enum 비확장" 원칙은 그대로 유지 — `autoRefresh` 는 영속 상태가 아닌 derived 식별자다. `pending_install 은 필터 칩에 추가하지 않는다` (2026-05-14) 의 외부 흐름 정상 상태 제외 원칙과 동일 맥락 (사용자 액션 불필요한 정상 운영 상태를 attention 에서 빼는 것).

**프론트엔드·백엔드 영향 (구현 PR)**: 후속 PR (`plan/in-progress/integration-token-ui-autorefresh.md`) 이 `backend/src/modules/integrations/services/service-registry.ts` 의 `ServiceDefinition.supportsTokenAutoRefresh` 추가 + `IntegrationsService.toPublic` 의 `autoRefresh` 매핑 + 목록 쿼리 (`integrations.service.ts` 의 `EXPIRING_SOON_INTERVAL` 사용 부) 의 `AND NOT autoRefresh` 가드 + frontend `_shared/status-badge.tsx::computeStatus` / `needsAttention` 의 동일 가드 + 상세 페이지 헤더 보조 라벨·Overview Tooltip 을 동기 반영한다.
```

## 5. 의사결정 명시

| 결정 | 채택 안 | 폐기 안 / 사유 |
| --- | --- | --- |
| `autoRefresh` 를 derived 필드로 노출 vs DB 컬럼 추가 | **derived** — service registry 에서 매 응답 시점 계산 | DB 컬럼 — service 정책이 자주 바뀌고 코드 한 곳 결정 원칙 위배 |
| 술어를 `service_type IN (cafe24, google)` 로 직접 vs `autoRefresh=true` 추상화 | **추상화** — 의미 명확성 + provider 추가 시 SQL 손대지 않음 | 직접 비교 — service 마다 SQL 손봐야 함 |
| `Auto-renews` 보조 라벨을 헤더 + Overview 양쪽 vs 헤더만 | **양쪽** — 헤더는 한눈 신호, Overview 는 친화 표기 + Tooltip 으로 절대시각 | 헤더만 — 사용자가 Overview 에서 절대시각 보고 다시 오독 가능 |
| 부수 위생 항목(W-5, I-6~I-12) 본 PR 포함 vs 분리 | **분리** — 응집도. 별도 plan `spec-update-2-navigation-hygiene.md` 신설 권고 | 포함 — 본 PR 영역 비대화 |
| 백엔드 쿼리 + frontend `needsAttention` 변경 본 PR vs 후속 PR | **후속 PR** — 본 PR 은 spec 본문만, 코드는 `integration-token-ui-autorefresh-a3f9b2` worktree 에서 진행 | 본 PR — spec PR 이 코드 변경까지 끌어안으면 spec 본문 리뷰가 늦어짐 |

## 6. consistency-check 대상

이 draft 를 `/consistency-check --spec plan/in-progress/spec-draft-integration-autorefresh.md` 로 검토. Critical 발견 시 draft 를 재작성하고 6단계 재실행.

특히 점검 요청:
- `autoRefresh` 식별자가 다른 영역 (요구사항 ID / 엔티티 / 환경변수) 과 충돌하는지 (이전 impl-prep 의 naming_collision 결과는 충돌 없음으로 보고됨 — 본 draft 가 새 식별자 도입을 spec 본문에 정식화하므로 재확인)
- §2.4·§11.4·§2.3 의 새 술어가 §6 상태 전이·§10.5 자동 갱신·§11.2 알림 정책과 정합되는지
- Rationale "자동 갱신 통합을 attention 술어에서 제외" 가 기존 Rationale ("Attention 가상 필터값", "pending_install 은 필터 칩에 추가하지 않는다") 와 일관되는지

## 7. 진행 체크리스트

- [x] 발신 plan 두 건 + consistency-check SUMMARY (메모리) 컨텍스트 흡수
- [x] draft 작성
- [x] `/consistency-check --spec plan/in-progress/spec-draft-integration-autorefresh.md` 호출 (세션 `review/consistency/2026/05/17/12_34_47/`)
- [x] Critical 0건 확인 — **BLOCK: NO**. WARNING 4 / INFO 17. W-1 은 본문 반영, W-2/W-3 는 plan 노트, W-4 는 Rationale 헤더 기존 확인 후 추가
- [x] `spec/2-navigation/4-integration.md` 본문 패치 (§2.2/§2.3/§2.4/§4.1/§4.2/§9.1/§10.5/§11.4/Rationale 9개 항목 적용 — diff 38 lines)
- [x] `plan/in-progress/cafe24-backlog-residual.md` C-3 에 의존 메모 추가 (W-2)
- [x] `plan/in-progress/20260516-full-review/SUMMARY.md` W-32 에 의존 메모 추가 (W-3)
- [ ] commit + PR (제목: `docs(spec/integration): autoRefresh 친화 attention 술어 + 표현 정책`)
- [ ] PR merge 후 자매 plan(`spec-update-integration-autorefresh.md` · `integration-token-ui-autorefresh.md`) 의 spec 갱신 체크박스를 발신 worktree 에서 갱신
- [ ] 모든 항목 완료 시 `git mv` → `plan/complete/`
