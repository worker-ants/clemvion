# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 위배 4건 발견. 변경 2·4 구현 착수 차단. 변경 0의 순수 코드 부분(ErrorClass·try/catch)과 변경 1의 FE 폴링은 spec 갱신 후 착수 가능.

---

## 전체 위험도

**HIGH** — CRITICAL 4건 중 2건이 spec과 구현 방향이 정반대이거나 참조 모델 자체 누락. spec 선행 갱신 없이 구현하면 DB 마이그레이션·API 계약·상태 머신이 동시에 붕괴.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| C1 | cross_spec | `pending_install` 상태가 데이터 모델 Enum에 부재 — spec §6이 정규 상태로 사용하지만 `spec/1-data-model.md §2.10` status Enum은 `connected / expired / error` 3값만 열거 | `spec/2-navigation/4-integration.md §6`, `§3.2` | `spec/1-data-model.md §2.10` Integration.status Enum | project-planner가 `spec/1-data-model.md §2.10` Enum에 `pending_install` 추가, TTL 정리 배치 조회용 인덱스(`(workspace_id, status) WHERE status='pending_install'`) 함께 추가 |
| C2 | cross_spec | `install_token` 컬럼이 데이터 모델에 없음 — DB·코드에 실존하는 컬럼이 spec에 미등재, 단일 진실 원칙 위반 | `spec/2-navigation/4-integration.md §3.2`, `§9.2` | `spec/1-data-model.md §2.10` Integration 엔티티 필드 목록 | project-planner가 `spec/1-data-model.md §2.10`에 `install_token \| String? \| Cafe24 Private 앱 설치 흐름 식별 키. 설치 완료 후 NULL 소거. Cafe24 private 전용` 추가 |
| C3 | plan_coherence + convention_compliance + cross_spec | 변경 4의 `pending_install → expired` TTL 전이가 현 spec §6 `→ (삭제)` 정의와 **방향 반대** — spec대로 구현하면 삭제, plan대로 구현하면 expired. `expired` 상태도 현재 OAuth 토큰 만료 전용으로 정의됨 | `plan/in-progress/cafe24-pending-polish.md §변경 4` | `spec/2-navigation/4-integration.md §6` 상태 머신 다이어그램 + 전이 표 | project-planner가 §6에 (a) `pending_install → expired (auto, install_timeout, TTL 24h)` 전이 추가, (b) `→ (삭제)` 동작을 manual delete에만 한정, (c) `expired` 상태 note에 TTL 만료 케이스 명시 후 구현 착수 |
| C4 | plan_coherence + convention_compliance + cross_spec | 변경 2의 `/oauth/install/cafe24/:installToken` 경로 및 `appUrl` 토큰 포함 URL이 현 spec §9.2 / §3.2 API 계약과 **정면 충돌** — Cafe24 Developers에 등록된 기존 App URL 즉시 파손 위험 | `plan/in-progress/cafe24-pending-polish.md §변경 2` | `spec/2-navigation/4-integration.md §9.2`, `§3.2` | project-planner가 §9.2 경로, §3.2 응답 예시(`appUrl`), §9.4 에러 응답 테이블 갱신 + 기존 경로 410 Gone 처리 정책 명시 후 구현 착수 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| W1 | plan_coherence + convention_compliance + cross_spec | callback 실패 시 `pending_install` 상태 유지 정책 미기술 — `markIntegrationCallbackError`가 status를 바꾸지 않는다는 계약이 spec에 없어 미래 구현자가 `pending_install → error` 전이 가능 | `spec/2-navigation/4-integration.md §10.4` + `§6` | 현재 §10.4 에러 매핑 표 (해당 행 없음) | project-planner가 §10.4에 "콜백 실패 (pending_install 상태) → status 유지, last_error + status_reason 기록" 행 추가. 변경 0의 코드 부분(ErrorClass, try/catch)은 spec 갱신과 무관하게 착수 가능 |
| W2 | plan_coherence | `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드가 §9.4에 미등재 | `plan/in-progress/cafe24-pending-polish.md §변경 3` | `spec/2-navigation/4-integration.md §9.4` 에러 코드 목록 | 변경 2/3/4 spec 갱신 묶음에 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (400)` 추가 |
| W3 | cross_spec | `pending_install` 상태 Integration의 목록 화면 표시 방식 미정의 — 아이콘/라벨, ⋮ 메뉴 허용 액션, "Need attention" 배너 포함 여부 전무 | `spec/2-navigation/4-integration.md §2.2` + `§2.4` | 동일 문서 §6 (pending_install 존재), plan 변경 1 (FE 폴링) | project-planner가 §2.2에 `⏳ pending_install` 아이콘·라벨·허용 액션 추가, §2.4 배너 조건에 포함 여부 명시 |
| W4 | naming_collision | `CallbackFailure` 예외 클래스명이 기존 `OAuthCallbackFailure` 인터페이스와 혼동 가능 | 변경 0 신규 예외 클래스 | `backend/src/modules/integrations/services/oauth-callback.template.ts:21` | `CallbackFailure` → `OAuthCallbackException` 또는 `IntegrationCallbackError` 로 변경 |
| W5 | naming_collision | `statusReason = 'install_timeout'`이 `spec/data-flow/integration.md §3.2` 허용 값 표에 없음 | 변경 4 TTL 만료 로직 | `spec/data-flow/integration.md §3.2` expired.statusReason 허용 값 (`token_expired`, `refresh_failed` 만 있음) | 구현 전 `spec/data-flow/integration.md §3.2`에 `install_timeout` 항목 추가 |
| W6 | naming_collision | 응답 DTO의 `status` enum에 `pending_install` 누락 — 변경 0/1이 FE에 노출 시 API 문서·클라이언트 타입 불일치 | `backend/src/modules/integrations/dto/responses/integration-response.dto.ts:34-38` | `@ApiProperty({ enum: ['connected', 'expired', 'error'] })` | DTO `@ApiProperty` enum에 `pending_install` 추가 |
| W7 | convention_compliance | §14.2 UI 용어 "Resource 단위 grouping"이 `spec/conventions/cafe24-api-metadata.md §6` "카테고리 단위 grouping"과 상충 | `spec/2-navigation/4-integration.md §14.2` | `spec/conventions/cafe24-api-metadata.md §6` | §14.2 "Resource" → "카테고리" 로 교정 (단어 하나 수정) |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | naming_collision | `INTEGRATION_STATUSES` 필터 enum에 `expiring`(entity에 없음) 있고 `pending_install` 없음 | `backend/src/modules/integrations/dto/integration.dto.ts:20-26` | 변경 1(폴링) 착수 시 DTO 필터 enum과 entity 타입 통일 |
| I2 | naming_collision | `purgeExpired()` 메서드가 이미 존재 (OAuth state 정리용). 변경 4가 같은 메서드를 확장 시 단일 책임 원칙 이탈 | `backend/src/modules/integrations/integration-oauth.service.ts:762` | `purgeExpiredOauthStates()` / `purgeExpiredPendingInstalls()` 별도 분리 권장 |
| I3 | cross_spec | Rate limit 헤더 목록 — §5.8(`X-Cafe24-Call-Remain`, `X-Cafe24-Call-Usage`, `X-Api-Call-Limit`)이 Cafe24 노드 spec §4.1(`+X-Cafe24-Time-Usage`, `+X-Cafe24-Time-Remain`)보다 불완전 | `spec/2-navigation/4-integration.md §5.8` vs `spec/4-nodes/4-integration/4-cafe24.md §4.1` | §5.8에 누락 헤더 추가하거나 §4.1 cross-reference로 중복 최소화 |
| I4 | convention_compliance | §5.8에 `spec/conventions/cafe24-api-metadata.md` 역참조 없음 | `spec/2-navigation/4-integration.md §5.8` | §5.8 첫 단락에 규약 역참조 링크 추가 |
| I5 | convention_compliance | `## Rationale` 섹션 권장 (867줄 문서에 부재) | `spec/2-navigation/4-integration.md` 전체 | §6·§9.2·§10.5 원자 갱신 근거 등을 Rationale 섹션으로 구조화 권장 |
| I6 | plan_coherence | `installToken=null` 초기화와 spec §5.8 credentials JSONB 스키마의 관계 불명확 (컬럼이 JSONB가 아닌 엔티티 컬럼이지만 미언급) | `spec/2-navigation/4-integration.md §5.8` | §5.8 또는 §6 note에 install_token 컬럼 라이프사이클 한 줄 언급 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **HIGH** | `pending_install` Enum 부재·`install_token` 컬럼 부재 — 두 CRITICAL이 spec/1-data-model.md와 직접 모순 |
| Rationale Continuity | **NONE** | 파일 미존재로 검토 대상 없음. 파일 작성 후 재검토 권장 |
| Convention Compliance | **MEDIUM** | 규약 직접 위반 없으나 변경 0·2·4 모두 spec 선행 갱신 없이 구현 시 명세 없는 동작 박힘 |
| Plan Coherence | **HIGH** | CRITICAL 2건 — 변경 4(삭제 vs expired)·변경 2(경로 계약)가 spec과 반대 방향 |
| Naming Collision | **LOW** | Critical 없음. `CallbackFailure` 네이밍·DTO enum·statusReason 허용 값 3건 WARNING |

---

## 권장 조치사항

1. **(BLOCK 해소 필수, project-planner 위임)** `spec/1-data-model.md §2.10` 갱신 — Integration.status Enum에 `pending_install` 추가(C1), 엔티티 필드 목록에 `install_token` 추가(C2)
2. **(BLOCK 해소 필수, project-planner 위임)** `spec/2-navigation/4-integration.md §6` 갱신 — `pending_install → expired (auto, install_timeout, TTL 24h)` 전이 추가, 기존 `→ (삭제)` 동작을 manual delete 한정으로 수정(C3)
3. **(BLOCK 해소 필수, project-planner 위임)** `spec/2-navigation/4-integration.md §9.2` 갱신 — `/oauth/install/cafe24/:installToken` 경로·`appUrl` 토큰 포함 URL·기존 경로 410 Gone 처리 정책 반영(C4)
4. **(spec 갱신 묶음)** `§9.4` 에러 코드 목록에 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED (400)` 추가(W2), `§10.4`에 callback 실패 시 `pending_install` 상태 유지 정책 행 추가(W1), `§2.2` / `§2.4`에 `pending_install` UI 표시 방식 추가(W3)
5. **(spec 갱신 묶음)** `spec/data-flow/integration.md §3.2` 허용 값 표에 `install_timeout` 추가(W5)
6. **(구현 착수 전 코드 수정)** `CallbackFailure` → `IntegrationCallbackError` 리네이밍(W4), 응답 DTO enum에 `pending_install` 추가(W6)
7. **(즉시 가능)** `§14.2` "Resource" → "카테고리" 단어 교정(W7)
8. **(권장)** I1–I6 INFO 항목들은 순차 처리 (긴급도 낮음)