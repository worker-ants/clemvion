# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — spec 내 직접 충돌(§11.1 vs §11.2 알림 발사 정책)이 구현 착수 전 해소되지 않으면, 이미 기각된 "refresh-capable provider에도 알림 발사" 경로가 코드에 그대로 유지될 위험이 있습니다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `§11.1` note가 cafe24에 대해 7일/3일/당일 임계 `integration_expired` 알림 발사를 여전히 명시 — 이미 확정된 `§11.2` 발사 정책(refresh-capable provider 제외)을 직접 무력화 | `spec/2-navigation/4-integration.md §11.1` (note block) | `spec/2-navigation/4-integration.md §11.2` 발사 정책; plan V-07 채택 결정 "§11.2 방향 정합" | plan V-07 spec 정합 작업에서 §11.1 cafe24 note를 "token_expires_at 만료 임계 알림은 refresh_token 없는 provider에만 적용(§11.2). cafe24는 refresh-capable이므로 알림 제외"로 수정 후 구현 착수 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity | `connected-expiry` 의사코드가 makeshop을 `isRefreshCapable` 면제 대상으로 처리하지 않음 — makeshop 처리는 note 텍스트에만 기술, 의사코드와 분리 | `spec/2-navigation/4-integration.md §11.1` 의사코드 | plan V-01 결정 `isRefreshCapable` 일반화(cafe24·makeshop+refresh_token) | 의사코드를 `if isRefreshCapable(integration)` 분기로 갱신해 makeshop note를 코드 안으로 흡수 |
| 2 | Rationale Continuity | `connected-expiry` 의사코드 `remain ≤ 0d` 분기에 `+ 알림` 표기 잔존 — plan V-07이 제거 대상으로 명시했으나 spec 미수정 | `spec/2-navigation/4-integration.md §11.1` 의사코드 `→ cafe24-token-refresh 큐 enqueue + 알림` | `§11.2` 발사 정책; plan V-07 채택 결정 "의사코드 동기" | spec 정합 시 `+ 알림` 제거 + Critical #1 note 정정과 일괄 처리 |
| 3 | Naming Collision | `data-flow/5-integration.md`에 `token_expired`가 "폐기·미구현"으로 선언되어 있어, V-07 fix 구현 후 틀린 서술로 남음 | `spec/data-flow/5-integration.md:438-441` | plan V-07 fix(`token_expired` 구현 확정) | 구현 전 또는 동시에 해당 "폐기" 서술을 삭제하거나 "V-07 fix로 구현 완료"로 교체; plan 체크리스트에 data-flow/5-integration.md 명시 추가 |
| 4 | Naming Collision | `isCafe24RefreshCapable` → `isRefreshCapable` 전환 후 data-flow spec 3곳에 stale 함수명 인용 잔존 | `spec/data-flow/5-integration.md:251,256,434` | plan V-01 fix(`isRefreshCapable` 일반화) | V-01 구현과 함께 data-flow 해당 3라인 함수명 + "cafe24 한정" 주석을 `isRefreshCapable` + "cafe24·makeshop+refresh_token 일반화"로 갱신 |
| 5 | Naming Collision | `token_expired`(Integration.statusReason) vs `TOKEN_EXPIRED`(REST 에러 코드) vs `auth.token_expired`(WS 이벤트) — 별개 네임스페이스이나 유사 표기로 혼동 가능 | `spec/1-data-model.md §2.10`, `spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md §4.5` | 세 표기 간 관계 미명시 | `spec/1-data-model.md §2.10` status_reason 주석에 "이 값은 Integration.status_reason DB 저장 전용; JWT 에러 코드 `TOKEN_EXPIRED`·WS 이벤트 `auth.token_expired`와 유사하나 별개 네임스페이스" 한 줄 추가 |
| 6 | Convention Compliance | `14-execution-history.md` — `## Overview (제품 정의)`와 `## 1. 개요`가 중복 구조로 공존, 타 파일과 구조 불일치 | `spec/2-navigation/14-execution-history.md` | CLAUDE.md 문서 구조 규약(Overview / 본문 / Rationale 3섹션) | Product-level 요구사항을 `_product-overview.md`로 이동하거나 단일 `## Overview` 아래로 통합, 섹션 번호 재정리 |
| 7 | Convention Compliance | `14-execution-history.md §5` 목록 API 응답 예시에 공통 래퍼(`TransformInterceptor`) 안내 문구 누락 — wire 포맷 vs data 내부 형태 불명확 | `spec/2-navigation/14-execution-history.md §5` | `spec/conventions/swagger.md §5-2` `ApiOkPaginatedResponse` 스키마 | `0-dashboard.md §7` 패턴 준용: "응답 본문은 공통 래퍼(`{ "data": ... }`)로 감싸진다. 아래 예시는 `data` 내부 형태다." 안내 문구 추가 |
| 8 | Plan Coherence | `spec/5-system/16-system-status-api.md` 수정 예정(V-15)이나 `health-probe-status-d9a184` worktree가 active로 동일 파일에 추가 fix 가능성 잔존 | `plan/in-progress/integration-expiry-fixes.md` V-15 | `plan/in-progress/spec-draft-health-probe-status.md` (health-probe-status-d9a184 worktree) | V-15 수정 전 health-probe worktree 최신 파일 상태 확인 후 진행; 수정 섹션이 달라 자동 merge 가능성 높음 |
| 9 | Cross-Spec | `GET /api/dashboard/recent-executions` 응답 래퍼·pagination 포함 여부 미명시 | `spec/2-navigation/0-dashboard.md §7` | `spec/5-system/2-api-convention.md §5.2` 목록 응답 pagination 필수 규약 | `recent-executions` 응답 예시 추가 — `{ data: [...10개] }` 구조 명시 + pagination 미포함 의도 기술 |
| 10 | Cross-Spec | `triggerSource`/`triggerLabel` 필드가 `recent-executions` 응답에 포함되는지 불명확 | `spec/2-navigation/0-dashboard.md §7` | `spec/2-navigation/14-execution-history.md §2.4` 분류 로직 SoT 위임 | `recent-executions` 응답 예시에 두 필드 포함 여부 명시 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `16-agent-memory.md` API 경로에 `/api/` prefix 누락 — 두 문서 모두 비일관적으로 prefix 없이 기술 | `spec/2-navigation/16-agent-memory.md`, `spec/5-system/17-agent-memory.md` | 양쪽을 `/api/agent-memories/...`로 통일하거나 의도적 생략 근거를 Rationale에 명시 |
| 2 | Rationale Continuity | `spec/1-data-model.md §2.10` status_reason 허용값 목록에 `token_expired` 명시·Rationale 연결 보완 권장 | `spec/1-data-model.md §2.10` | `token_expired: refresh_token 없는 provider가 token_expires_at 도달로 expired 전이할 때 설정` 한 줄 추가 |
| 3 | Rationale Continuity | `§11.4` autoRefresh 술어와 V-01 isRefreshCapable 일반화의 alignment가 spec에 명시되지 않아 독자가 별도 확인 필요 | `spec/2-navigation/4-integration.md §11.4` | `makeshop은 autoRefresh=true이므로 §11.4 주의보 카운트에서 자동 제외됨` 한 줄 추가 |
| 4 | Naming Collision | `unknown`(spec) vs `unknown_error`(코드) — spec §2.10 표기 오기 | `spec/1-data-model.md §2.10` status_reason 열 | spec의 `unknown`을 `unknown_error`로 교정 (V-07 spec 정합 작업 시 일괄 처리 권장) |
| 5 | Naming Collision | `MAKESHOP_REFRESH_QUEUE` 상수 자체는 이미 존재, MONITORED_QUEUES 등록 누락만 보완 | `codebase/backend/src/modules/integrations/makeshop-token-refresh.constants.ts:20` | 이름 충돌 없음. 단순 보완 |
| 6 | Plan Coherence | V-07 결정이 target plan에 정확히 반영됨 — 구현 완료 시 `spec-code-cross-audit-2026-06-10.md` V-07 항목 `[x]` 처리 필요 | `plan/in-progress/spec-code-cross-audit-2026-06-10.md` | 구현 완료 후 cross-audit plan V-07 항목 닫기 |
| 7 | Plan Coherence | `spec/1-data-model.md §2.10`의 `token_expired`가 이미 main spec에 포함되어 있어 V-07 spec 정합 추가 수정 범위 확인 필요 | `spec/1-data-model.md §2.10` | 코드 측 union 추가·formatter 구현이 핵심; spec 본문은 이미 준비됨 |
| 8 | Convention Compliance | `16-agent-memory.md` `id: nav-agent-memory` — 파일명 기반 권장 규약(`agent-memory`)과 소폭 불일치 | `spec/2-navigation/16-agent-memory.md` frontmatter | `id: agent-memory`로 통일 고려 (build 가드 영향 없음) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `recent-executions` 응답 shape 미명시(W×2), API prefix 비일관(I×1). CRITICAL 없음 |
| Rationale Continuity | **MEDIUM** | §11.1 note와 §11.2 발사 정책 직접 충돌(CRITICAL×1); 의사코드 makeshop 면제 미반영(W×1); `+ 알림` 잔존(W×1) |
| Convention Compliance | LOW | `14-execution-history.md` 구조 중복(W×1); 목록 API 래퍼 안내 누락(W×1). CRITICAL 없음 |
| Plan Coherence | LOW | `16-system-status-api.md` 병렬 worktree 수정 가능성(W×1). CRITICAL 없음 |
| Naming Collision | **MEDIUM** | `token_expired` "폐기" 서술 잔존(W×1); `isCafe24RefreshCapable` stale 인용(W×1); 유사 표기 혼동 가능(W×1) |

---

## 권장 조치사항

1. **(BLOCK 해소 — 필수 선행)** `spec/2-navigation/4-integration.md §11.1` note의 cafe24 알림 발사 서술을 "cafe24는 refresh-capable이므로 알림 제외(§11.2)"로 수정하고, 의사코드의 `+ 알림` 표기도 제거한다. 이 spec 정합이 완료된 후 구현 착수.
2. **(BLOCK 해소 — 필수 선행)** 의사코드를 `if isRefreshCapable(integration)` 분기로 갱신해 makeshop 격하 면제 의도를 코드 수준에서 명시한다.
3. **(구현 착수 전 권장)** `spec/data-flow/5-integration.md:438-441`의 `token_expired` "폐기" 서술을 삭제 또는 "V-07 fix로 구현 확정"으로 교체; data-flow 3곳의 `isCafe24RefreshCapable` 인용을 `isRefreshCapable`로 갱신.
4. **(구현 중 병행)** `spec/1-data-model.md §2.10` status_reason 주석에 `token_expired` 네임스페이스 구분 한 줄 추가; `unknown` → `unknown_error` 표기 교정.
5. **(낮은 우선순위)** `14-execution-history.md` 구조 중복 정리, `recent-executions` 응답 예시 보완, `16-agent-memory.md` API prefix 통일은 구현 중 spec 갱신 시 일괄 처리.