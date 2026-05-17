# 정식 규약 준수 Check Payload

본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자가 가리키는 경로에 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (정식 규약 준수)

1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가

## 검토 모드
spec draft 검토 (--spec)

## Target 문서
경로: `plan/in-progress/spec-draft-integration-autorefresh.md`

```
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
- [ ] `/consistency-check --spec plan/in-progress/spec-draft-integration-autorefresh.md` 호출
- [ ] Critical 0건 확인 (그 외 Warning/Info 는 spec 본문 반영 시 Rationale 에 inline 으로 흡수)
- [ ] `spec/2-navigation/4-integration.md` 본문 패치 (위 §4.1~§4.10 적용)
- [ ] commit + PR (제목: `docs(spec/integration): autoRefresh 친화 attention 술어 + 표현 정책`)
- [ ] PR merge 후 본 draft 와 자매 plan(`spec-update-integration-autorefresh.md`) 의 spec 갱신 체크박스 갱신
- [ ] 모든 항목 완료 시 `git mv` → `plan/complete/`

```

## 정식 규약 모음 (spec/conventions/)

### spec/conventions 정식 규약

#### `spec/conventions/cafe24-api-catalog/_overview.md`
```
# CONVENTION: Cafe24 API Catalog — Overview

> 관련 문서: [Spec Cafe24 노드](../../4-nodes/4-integration/4-cafe24.md) · [Cafe24 API Metadata 컨벤션](../cafe24-api-metadata.md) · [Cafe24 공식 Admin API 문서](https://developers.cafe24.com/docs/ko/api/admin/)

본 디렉토리(`spec/conventions/cafe24-api-catalog/`) 는 Cafe24 Admin API 의 **모든 endpoint** 를 18 resource 단위로 enumerate 한 단일 진실(single source of truth)이다. 노드 메타데이터(`backend/src/nodes/integration/cafe24/metadata/*.ts`) 가 어디까지 구현됐고 어디가 남았는지가 한 화면에서 보이도록 유지한다.

---

## 1. 디렉토리 구조

```
spec/conventions/cafe24-api-catalog/
  _overview.md        # 본 문서 — 인덱스 + 컬럼 정의 + 동기 정책 + coverage matrix
  store.md            # Store (상점) — 50+ sub-resource
  product.md          # Product (상품)
  order.md            # Order (주문)
  customer.md         # Customer (회원)
  community.md        # Community (게시판)
  design.md           # Design (디자인)
  promotion.md        # Promotion (프로모션)
  application.md      # Application (앱 관리)
  category.md         # Category (상품분류)
  collection.md       # Collection (판매분류)
  supply.md           # Supply (공급사)
  shipping.md         # Shipping (배송)
  salesreport.md      # Salesreport (매출통계)
  personal.md         # Personal (개인화)
  privacy.md          # Privacy (개인정보)
  mileage.md          # Mileage (적립금)
  notification.md     # Notification (알림)
  translation.md      # Translation (번역)
```

resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/metadata/types.ts`) 와 1:1 일치한다.

## 2. 표 컬럼 정의

각 resource 파일은 다음 컬럼의 표를 가진다.

| 컬럼 | 필수 | 설명 |
|------|------|------|
| `id` | ✓ | 노드 메타데이터의 operation id. `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` (예: `product_list`, `product_options_create`). 영문 snake_case, resource 내 unique |
| `라벨 (한)` | ✓ | UI 드롭다운에 노출되는 한국어 라벨 (예: "상품 목록 조회") |
| `English title` | ✓ | Cafe24 공식 docs 의 영문 제목 (예: "Retrieve a list of products") |
| `method` | supported 시 ✓ | `GET` / `POST` / `PUT` / `DELETE`. planned 시 `?` 허용 |
| `path` | supported 시 ✓ | path template (예: `products/{product_no}`). `/api/v2/admin/` 접두는 생략. planned 시 `?` 허용 |
| `scope` | supported 시 ✓ | `read` / `write`. `mall.<scope>_<resource>` 의 가운데 토큰. planned 시 `?` 허용 |
| `paginated` | — | `✓` 또는 빈 칸. `paginated: true` 인 operation 만 표시 |
| `status` | ✓ | §3 의 enum 중 하나 |
| `docs` | ✓ | Cafe24 공식 docs anchor URL — `https://developers.cafe24.com/docs/ko/api/admin/#<anchor>` |

## 3. status enum

| 값 | 의미 | 백엔드 메타데이터 |
|-----|------|------|
| `supported` | 노드/MCP Bridge 에서 호출 가능 | `CAFE24_OPERATIONS_BY_RESOURCE[resource]` 에 row 존재 |
| `planned` | 카탈로그에 등재만, 미구현. UI 의 Operation 드롭다운에 **disabled + "지원 예정" 배지** 로 노출 | row 없음 |
| `deprecated` | Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함 | row 없으면 정상. 있으면 마이그레이션 대상 |

`planned` 행의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다.

## 4. 동기 정책 (Sync Contract)

본 카탈로그는 `backend/src/nodes/integration/cafe24/metadata/*.ts` 와 **양방향 동기 테스트**로 보호된다.

**테스트 위치**: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`

**검증 규칙**:

1. **`supported` row → 메타데이터 존재**: 카탈로그에 `status: supported` 로 적힌 모든 `(resource, id)` 가 `findCafe24Operation(resource, id)` 로 조회되어야 한다. 누락 시 fail.
2. **메타데이터 → `supported` row 존재**: `CAFE24_OPERATIONS_BY_RESOURCE` 의 모든 operation 이 해당 resource 의 카탈로그에 `status: supported` 행으로 적혀 있어야 한다. 누락 시 fail.
3. **`paginated` 일치**: `supported` row 의 `paginated` 컬럼(`✓`/공백)이 메타데이터의 `paginated: boolean` 과 일치해야 한다.
4. **`method`/`path` 일치**: `supported` row 의 `method`·`path` 가 메타데이터와 일치.
5. **`scope` 일치**: `supported` row 의 `scope` 가 메타데이터 `scopeType` 과 일치.
6. **id 의 resource 내 unique**: 한 카탈로그 파일 안에 같은 `id` 가 두 번 나오면 fail.
7. **status 가 enum 중 하나**: `supported` / `planned` / `deprecated` 외의 값이 있으면 fail.

테스트는 카탈로그 MD 의 표를 파싱한다 — MD 표 구문이 깨지면 곧장 fail. 따라서 본 카탈로그는 **사람이 직접 손으로 수정하는 SoT** 이며, 코드 변경 시점에 반드시 카탈로그 동기 갱신을 함께 commit 해야 한다(`spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차에 인용).

## 5. Coverage Matrix

2026-05-16 기준. 본 매트릭스는 카탈로그 row 수 + 메타데이터 row 수의 한 화면 요약이다 — 위 동기 테스트와 별개의 휴먼 가독성 보조 정보다. row 추가/삭제 시 본 표도 손으로 갱신한다.

| Resource | Supported | Planned | Cafe24 docs sub-resource 수 |
|----------|-----------|---------|---|
| [store](./store.md) | 8 | 50+ | 50+ |
| [product](./product.md) | 14 | 25+ | 28 |
| [order](./order.md) | 17 | 30+ | 47 |
| [customer](./customer.md) | 24 | 0 | 12 |
| [community](./community.md) | 24 | 0 | 9 |
| [design](./design.md) | 9 | 0 | 3 |
| [promotion](./promotion.md) | 35 | 0 | 10 |
| [application](./application.md) | 19 | 0 | 8 |
| [category](./category.md) | 19 | 0 | 5 |
| [collection](./collection.md) | 15 | 0 | 5 |
| [supply](./supply.md) | 20 | 0 | 6 |
| [shipping](./shipping.md) | 15 | 0 | 5 |
| [salesreport](./salesreport.md) | 5 | 0 | 5 |
| [personal](./personal.md) | 5 | 0 | 3 |
| [privacy](./privacy.md) | 6 | 0 | 2 |
| [mileage](./mileage.md) | 8 | 0 | 5 |
| [notification](./notification.md) | 12 | 0 | 7 |
| [translation](./translation.md) | 9 | 0 | 4 |
| **합계** | **264** | **~109** | **~250** |

> "Cafe24 docs sub-resource 수" 는 공식 docs 좌측 사이드바에서 본 resource 그룹 아래의 두 번째 레벨 항목 수다. 각 sub-resource 마다 통상 2~5 operation 이 존재하므로 endpoint 합계는 ~500.

## 6. 신규 endpoint 등재 절차

1. Cafe24 공식 문서에서 endpoint 확인.
2. 본 카탈로그 해당 resource 파일에 표 row 추가:
   - 처음 등재 시 `status: planned`, `method`/`path` 는 `?` 허용.
   - 구현 PR 에서 backend 메타데이터 row 1줄 추가 + 카탈로그 row 를 `planned → supported` 로 갱신 + `method`/`path`/`scope`/`paginated` 채움.
3. `_overview.md` §5 의 coverage matrix 카운트도 함께 갱신.
4. `npm test --workspace backend -- catalog-sync` 통과 확인.

> `spec/conventions/cafe24-api-metadata.md` §5 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다.

## 7. CHANGELOG

| 일자 | 변경 |
|------|------|
| 2026-05-16 | 신규 컨벤션 — 18 resource 카탈로그 + 양방향 동기 테스트 도입. 사용자 결정(2026-05-16) "Cafe24 docs 전수 등재" 에 따라 supported 53 + planned ~300 으로 초기 채움. |
| 2026-05-16 (coverage Phase 5a) | Order resource — `order_count`, `order_status_update`, `order_status_update_multiple` 3건을 planned → supported 로 승격 (backend metadata + planned.ts mirror 동시 갱신). order supported 6 → 9, 합계 53 → 56. |
| 2026-05-16 (coverage Phase 5b) | Product resource — `product_count`, `product_options_list/create/update/delete`, `product_seo_get/update` 7건을 planned → supported 로 승격. product supported 7 → 14, 합계 56 → 63. |
| 2026-05-16 (coverage Phase 5c) | Customer resource — 회원 메모 CRUD 완성: `customer_memos_count/list/get/update/delete` 5건을 planned → supported 로 승격. customer supported 5 → 10, 합계 63 → 68. |
| 2026-05-16 (coverage Phase 5d) | Promotion resource — 쿠폰 보완: `coupon_count`, `coupon_issues_list`, `coupon_issuance_customers_list`, `customers_coupons_list`, `customers_coupons_count` 5건을 planned → supported 로 승격. promotion supported 5 → 10, 합계 68 → 73. |
| 2026-05-16 (coverage Phase 5e) | Salesreport resource 완성 — `salesreport_monthly`, `salesreport_hourly`, `salesreport_volume` 3건을 planned → supported 로 승격. salesreport supported 2 → 5, planned 3 → 0, 합계 73 → 76. salesreport resource 의 첫 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 5f) | Promotion resource — 시리얼쿠폰 5건 (`serialcoupons_list`, `serialcoupons_generate`, `serialcoupons_delete`, `serialcoupons_issues_get`, `serialcoupons_issues_register`) 를 planned → supported 로 승격. promotion supported 10 → 15, 합계 76 → 81. |
| 2026-05-16 (coverage Phase 6a) | Order resource — A/S 자동화 8건 (`refunds_list/get`, `cancellation_get/create_multiple`, `exchange_get/create_multiple`, `return_get/create_multiple`) 를 planned → supported 로 승격. order supported 9 → 17, 합계 81 → 89. |
| 2026-05-16 (coverage Phase 6b) | Store resource — 결제 설정 6건 (`paymentmethods_list`, `paymentmethods_paymentproviders_list`, `paymentgateway_paymentmethods_list`, `paymentgateway_create/update/delete`) 를 planned → supported 로 승격. store supported 2 → 8, 합계 89 → 95. |
| 2026-05-16 (coverage Phase 6c) | Promotion resource — 회원 혜택 CRUD 6건 + 회원 정보 이벤트 3건 + customers_coupons_delete 1건 = 10건. promotion supported 15 → 25, 합계 95 → 105. |
| 2026-05-16 (coverage Phase 6d) | Category/Collection/Supply/Shipping baseline 10건 — category(category_count/mains_list/autodisplay_list), collection(brands count/create/update/delete), supply(suppliers_count/get), shipping(carriers_get). 합계 105 → 115. |
| 2026-05-16 (coverage Phase 6e) | Mileage resource — 적립금 자동 만료 3건 (`points_autoexpiration_get/create/delete`) + 예치금 2건 (`credits_list`, `credits_report`) = 5건. mileage supported 2 → 7, 합계 115 → 120. |
| 2026-05-16 (coverage Phase 6f) | Notification resource — SMS 2건 (`sms_senders_list`, `sms_receivers_get`) + automails 2건 (`automails_get/update`) + recipientgroups 2건 (`recipientgroups_list/get`) = 6건. notification supported 2 → 8, 합계 120 → 126. |
| 2026-05-16 (coverage Phase 6g) | Translation resource — products_update + categories list/update + store list/update + themes list 6건. translation supported 1 → 7, 합계 126 → 132. 본 사이클 (Phase 6 a~g) 종료. |
| 2026-05-16 (coverage Phase 7a) | Promotion resource — discountcodes CRUD 5건 + commonevents CRUD 4건 = 9건. promotion supported 25 → 34, 합계 132 → 141. |
| 2026-05-16 (coverage Phase 7b) | Customer resource 완성 — 회원 14건 (paymentinfo 3 + properties 2 + customergroups 4 + delete + autoupdate + plusapp + social + social_list). customer supported 10 → 24, planned 14 → 0, 합계 141 → 155. customer 두 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7c) | Community resource — boards 설정 2건 + boards 글 CRUD 3건 + comments 3건 + commenttemplates 2건 = 10건. community supported 3 → 13, 합계 155 → 165. |
| 2026-05-16 (coverage Phase 7d) | Application resource — apps_update + scripttags CRUD 5건 + webhooks_update + webhooks_logs_list = 8건. application supported 3 → 11, 합계 165 → 173. |
| 2026-05-16 (coverage Phase 7e) | Shipping resource 완성 — carriers CRUD 3건 + regionalsurcharges 2건 + shipping_settings 2건 + shipping_additionalfees_countries + shippingorigins CRUD 5건 = 13건. shipping supported 2 → 15, planned 13 → 0, 합계 173 → 186. shipping 세 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7f) | Category resource 완성 — decorationimages 2건 (get/update) + seo 2건 (get/update) + mains 3건 (add/update/delete) + autodisplay 3건 (create/update/delete) = 10건. category supported 9 → 19, planned 10 → 0, 합계 186 → 196. category 네 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 7g) | Supply resource 완성 — suppliers CUD 3건 + suppliers_users CRUD 6건 + suppliers_users regional shipping 5건 + shipping_suppliers 3건 = 17건. supply supported 3 → 20, planned 17 → 0, 합계 196 → 213. supply 다섯 번째 0-planned resource. 본 사이클 (Phase 7 a~g) 종료. |
| 2026-05-16 (coverage Phase 8a) | Mileage resource 완성 — `points_report` 1건. mileage supported 7 → 8, planned 1 → 0, 합계 213 → 214. mileage 여섯 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8b) | Promotion resource 완성 — `coupon_manage` 1건 (use_coupon T/F 토글). promotion supported 34 → 35, planned 1 → 0, 합계 214 → 215. promotion 일곱 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8c) | Translation resource 완성 — 테마 번역 단건 조회/수정 2건. translation supported 7 → 9, planned 2 → 0, 합계 215 → 217. translation 여덟 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8d) | Personal resource 완성 — `customers_wishlist_count` + `products_carts_count` + `products_carts_list` 3건. personal supported 2 → 5, planned 3 → 0, 합계 217 → 220. personal 아홉 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8e) | Notification resource 완성 — `customers_invitation_send` + recipientgroups CUD 3건 = 4건. notification supported 8 → 12, planned 4 → 0, 합계 220 → 224. notification 열 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8f) | Privacy resource 완성 — customers_privacy list/count/update 3건 + products_wishlist_customers list/count 2건 = 5건. privacy supported 1 → 6, planned 5 → 0, 합계 224 → 229. privacy 열한 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8g) | Application resource 완성 — appstore_orders get/create 2건 + appstore_payments list/count 2건 + databridge_logs_list + recipes list/create/delete 3건 = 8건. application supported 11 → 19, planned 8 → 0, 합계 229 → 237. application 열두 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8h) | Collection resource 완성 — manufacturers count/get/create/update 4건 + trends_count + classifications list/count 2건 + origin_list = 8건. collection supported 7 → 15, planned 8 → 0, 합계 237 → 245. collection 열세 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8i) | Design resource 완성 — themes count/get 2건 + theme_pages CRUD 4건 (get/create/update/delete) + icons_list + icons_update_settings = 8건. design supported 1 → 9, planned 8 → 0, 합계 245 → 253. design 열네 번째 0-planned resource. |
| 2026-05-16 (coverage Phase 8j) | Community resource 완성 — boards_comments_bulk + boards_seo get/update 2건 + commenttemplates get/update/delete 3건 + financials_monthlyreviews_count + urgentinquiry get/reply CRUD 4건 = 11건. community supported 13 → 24, planned 11 → 0, 합계 253 → 264. community 열다섯 번째 0-planned resource. 본 사이클 (Phase 8 a~j) 종료. |

```

#### `spec/conventions/cafe24-api-catalog/application.md`
```
# Cafe24 API Catalog — Application (앱 관리)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).
> **주의**: 본 resource 는 Cafe24 앱 관리 API 다. 우리 서비스의 Integration `app_type` (Public/Private OAuth 앱 등록) 과 **무관** — naming collision 회피 참고.

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `applications_list` | 설치된 앱 목록 조회 | Retrieve an app information | GET | `applications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-app-information) |
| `scripttags_list` | 스크립트태그 목록 조회 | Retrieve a list of script tags | GET | `scripttags` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-script-tags) |
| `webhooks_list` | Webhook 설정 조회 | Retrieve webhook settings | GET | `webhooks` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-webhook-settings) |
| `apps_update` | 앱 정보 수정 | Update an app information | PUT | `apps` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-app-information) |
| `appstore_orders_get` | 앱스토어 주문 조회 | Retrieve a Cafe24 store order | GET | `appstore/orders/{order_id}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retreive-a-cafe24-store-order) |
| `appstore_orders_create` | 앱스토어 주문 생성 | Create a Cafe24 store order | POST | `appstore/orders` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-cafe24-store-order) |
| `appstore_payments_list` | 앱스토어 결제 목록 | Retrieve a list of Cafe24 store payments | GET | `appstore/payments` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-cafe24-store-payments) |
| `appstore_payments_count` | 앱스토어 결제 수 | Retrieve a count of Cafe24 store payments | GET | `appstore/payments/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-cafe24-store-payments) |
| `databridge_logs_list` | DataBridge 로그 목록 | Retrieve a list of DataBridge webhook logs | GET | `databridge/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-databridge-webhook-logs) |
| `recipes_list` | 레시피 목록 조회 | Retrieve a list of recipes | GET | `recipes` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipes) |
| `recipes_create` | 레시피 생성 | Create a recipe | POST | `recipes` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-recipe) |
| `recipes_delete` | 레시피 삭제 | Delete a recipe | DELETE | `recipes/{recipe_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-recipe) |
| `scripttags_count` | 스크립트태그 개수 조회 | Retrieve a count of script tags | GET | `scripttags/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-script-tags) |
| `scripttags_get` | 스크립트태그 단건 조회 | Retrieve a script tag | GET | `scripttags/{tag_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-script-tag) |
| `scripttags_create` | 스크립트태그 생성 | Create a script tag | POST | `scripttags` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-script-tag) |
| `scripttags_update` | 스크립트태그 수정 | Update a script tag | PUT | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-script-tag) |
| `scripttags_delete` | 스크립트태그 삭제 | Delete a script tag | DELETE | `scripttags/{tag_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-script-tag) |
| `webhooks_logs_list` | Webhook 로그 목록 | Retrieve a list of webhook logs | GET | `webhooks/logs` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-webhook-logs) |
| `webhooks_update` | Webhook 설정 수정 | Edit webhook settings | PUT | `webhooks` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings) |

```

#### `spec/conventions/cafe24-api-catalog/category.md`
```
# Cafe24 API Catalog — Category (상품분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `category_list` | 카테고리 목록 조회 | Retrieve a list of product categories | GET | `categories` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-product-categories) |
| `category_get` | 카테고리 단건 조회 | Retrieve a product category | GET | `categories/{category_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-product-category) |
| `category_create` | 카테고리 생성 | Create a product category | POST | `categories` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-product-category) |
| `category_update` | 카테고리 수정 | Update a product category | PUT | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category) |
| `category_delete` | 카테고리 삭제 | Delete a product category | DELETE | `categories/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-product-category) |
| `category_products_list` | 카테고리별 상품 목록 조회 | Retrieve a list of products by category | GET | `categories/{category_no}/products` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-products-by-category) |
| `category_count` | 카테고리 개수 조회 | Retrieve a count of product categories | GET | `categories/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-product-categories) |
| `category_decorationimages_get` | 카테고리 꾸미기 이미지 조회 | Retrieve decoration image settings by category | GET | `categories/{category_no}/decorationimages` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-decoration-image-settings-by-category) |
| `category_decorationimages_update` | 카테고리 꾸미기 이미지 수정 | Update decoration images of a product category | PUT | `categories/{category_no}/decorationimages` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-decoration-images-of-a-product-category) |
| `category_seo_get` | 카테고리 SEO 조회 | Retrieve SEO settings by category | GET | `categories/{category_no}/seo` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings-by-category) |
| `category_seo_update` | 카테고리 SEO 수정 | Update a product category SEO | PUT | `categories/{category_no}/seo` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-category-seo) |
| `mains_list` | 메인 카테고리 목록 조회 | Retrieve a list of main categories | GET | `mains` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-main-categories) |
| `mains_add` | 메인 카테고리 추가 | Add main category | POST | `mains` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#add-main-category) |
| `mains_update` | 메인 카테고리 수정 | Update main category | PUT | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-main-category) |
| `mains_delete` | 메인 카테고리 삭제 | Delete main category | DELETE | `mains/{main_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-main-category) |
| `autodisplay_list` | 자동 진열 목록 조회 | Retrieve a list of auto layouts | GET | `autodisplay` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-auto-layouts) |
| `autodisplay_create` | 자동 진열 생성 | Create auto layout for selected product category | POST | `autodisplay` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-auto-layout-for-selected-product-category) |
| `autodisplay_update` | 자동 진열 수정 | Update auto layout for selected product category | PUT | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-auto-layout-for-selected-product-category) |
| `autodisplay_delete` | 자동 진열 삭제 | Delete auto layout for selected product category | DELETE | `autodisplay/{category_no}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-auto-layout-for-selected-product-category) |

```

#### `spec/conventions/cafe24-api-catalog/collection.md`
```
# Cafe24 API Catalog — Collection (판매분류)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `brands_list` | 브랜드 목록 조회 | Retrieve a list of brands | GET | `brands` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-brands) |
| `manufacturers_list` | 제조사 목록 조회 | Retrieve a list of manufacturers | GET | `manufacturers` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-manufacturers) |
| `trends_list` | 트렌드 목록 조회 | Retrieve a list of trends | GET | `trends` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-trends) |
| `brands_count` | 브랜드 개수 조회 | Retrieve a count of brands | GET | `brands/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-brands) |
| `brands_create` | 브랜드 생성 | Create a brand | POST | `brands` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-brand) |
| `brands_update` | 브랜드 수정 | Update a brand | PUT | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-brand) |
| `brands_delete` | 브랜드 삭제 | Delete a brand | DELETE | `brands/{brand_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-brand) |
| `manufacturers_count` | 제조사 개수 조회 | Retrieve a count of manufacturers | GET | `manufacturers/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-manufacturers) |
| `manufacturers_get` | 제조사 단건 조회 | Retrieve a manufacturer | GET | `manufacturers/{manufacturer_code}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-manufacturer) |
| `manufacturers_create` | 제조사 생성 | Create a manufacturer | POST | `manufacturers` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-manufacturer) |
| `manufacturers_update` | 제조사 수정 | Update a manufacturer | PUT | `manufacturers/{manufacturer_code}` | write |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-manufacturer) |
| `trends_count` | 트렌드 개수 조회 | Retrieve a count of trends | GET | `trends/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-trends) |
| `classifications_list` | 사용자 정의 카테고리 목록 | Retrieve a list of custom categories | GET | `classifications` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-custom-categories) |
| `classifications_count` | 사용자 정의 카테고리 수 | Retrieve a count of custom categories | GET | `classifications/count` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-custom-categories) |
| `origin_list` | 원산지 목록 조회 | Retrieve a list of origins | GET | `origin` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-origins) |

```

#### `spec/conventions/cafe24-api-catalog/community.md`
```
# Cafe24 API Catalog — Community (게시판)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md).

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

## 표

| id | 라벨 (한) | English title | method | path | scope | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|
| `boards_list` | 게시판 목록 조회 | Retrieve a list of boards | GET | `boards` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-boards) |
| `board_articles_list` | 게시판 글 목록 조회 | Retrieve a list of posts for a board | GET | `boards/{board_no}/articles` | read | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
| `board_article_get` | 게시판 글 단건 조회 | Retrieve a list of posts for a board (single) | GET | `boards/{board_no}/articles/{article_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board) |
| `boards_settings_get` | 게시판 설정 조회 | Retrieve the board settings | GET | `boards/{board_no}` | read |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-board-settings) |
| `boards_settings_update` | 게시판 설정

... (truncated due to size limit) ...
