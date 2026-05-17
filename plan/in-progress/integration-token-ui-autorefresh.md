---
worktree: integration-token-ui-autorefresh-a3f9b2
started: 2026-05-17
owner: developer
---

# Integration 상세 페이지: 자동 갱신 통합의 "Connected" 표기 회복

## 배경

카페24 통합 상세 페이지에서 access_token 의 **2시간 수명** 때문에 헤더 상태 배지가 항상 "Expires today" 노란 톤으로 보여 사용자가 "갱신 실패" 로 오독한다. 백엔드 자동 갱신 로직(`Cafe24TokenRefreshProcessor`, `IntegrationExpiryScanner` 의 `cafe24-background-refresh` job, `Cafe24ApiClient.ensureFreshToken` proactive 경로) 은 정상 동작하며 `last_rotated_at` 도 최근에 갱신되고 있다. **표시 측면의 표현 정책**을 자동 갱신 통합 친화적으로 손본다.

조사 경위 / 진단: 대화 세션 2026-05-17 (DB 의 `last_rotated_at = 2026-05-17 01:38 UTC`, `token_expires_at = 2026-05-17 03:38 UTC` 확인).

## 사용자 결정 (Option A)

자동 갱신이 동작하는 통합은:

- 헤더 상태 배지의 **메인 라벨을 `Connected` 로 유지**.
- "Auto-renews" 의미를 작은 보조 텍스트(subLabel) 로 노출.
- Overview 탭의 "Token Expires" 행은 사람 친화 표기(`in 1h 24m · auto-renews`) + 절대시각은 Tooltip 으로 강등.

## 범위

### 본 PR 범위 (구현)

- **백엔드** — `IntegrationDto` 에 `autoRefresh: boolean` 필드 추가, `IntegrationsService.toPublic` 매핑.
- **프론트엔드** — `IntegrationDto` 타입 동기, `computeStatus` 의 `expiresSoon` 분기에 `autoRefresh` 가드, `StatusView` 에 `subLabel` 추가, `StatusBadge` 가 subLabel 렌더, 상세 페이지 `InfoRow` 에 optional `tooltip` prop + autoRefresh 친화 표기.
- **i18n** — `tokenAutoRenews`, `tokenExpiresAutoFormat` 등 키 추가 (ko/en 양쪽).
- **테스트** — status-badge 매트릭스 (autoRefresh × expiresSoon × status), 백엔드 toPublic 매핑 단위 테스트.

### 본 PR 범위 밖 (별도 spec-update + 후속 PR)

다음 항목은 `spec/2-navigation/4-integration.md` 술어 변경이 필요해 **project-planner 위임 후 후속 PR** 로 처리:

- §2.4 "Need attention" 배너 포함 조건에 autoRefresh 통합 제외.
- §11.4 사이드바 카운트 술어 동일 제외.
- §2.3 `Expiring` 칩 / §9.1 `?status=expiring`·`?status=attention` 가상 필터 동일 제외.
- frontend `needsAttention()` / backend `EXPIRING_SOON_INTERVAL` 술어 동시 변경.

세부 사양 제안은 `spec-update-integration-autorefresh.md` 에 노트.

> **이번 PR 의 사용자 가치**: 상세 페이지에서 본 헤더 상태 배지의 노란 오독이 해소되어, 카페24 통합이 정상으로 보인다. 사이드바 카운트는 보조 신호라 별도 처리.

## autoRefresh 판정 정의

- **true**: service 가 OAuth 이고 provider 가 refresh_token 을 발급·갱신하는 경우.
  - 현재 등록 provider: `cafe24` (✓ — Public/Private 양쪽, refresh_token + Cafe24ApiClient 자동 갱신), `google` (✓ — spec §10.3 표).
- **false**: 그 외 모든 케이스.
  - `github` (spec §10.3 Refresh: ✗ — long-lived token, 만료 시 reauthorize 필요).
  - api_key / basic / bearer / smtp / webhook_outbound / connection_string / mcp 등 — 영구 또는 사용자 수동 회전.

판정 위치: `service-registry.ts` 의 `ServiceDefinition` 에 `supportsTokenAutoRefresh?: boolean` 옵션 필드 추가, cafe24·google 의 정의에 명시. `IntegrationsService.toPublic` 에서 서비스 정의를 조회해 DTO 의 `autoRefresh` 로 매핑.

## 영향 파일 (예상)

| 파일 | 변경 |
| --- | --- |
| `backend/src/modules/integrations/services/service-registry.ts` | `ServiceDefinition.supportsTokenAutoRefresh` 옵션 + cafe24/google 에 true |
| `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` | `autoRefresh: boolean` 필드 + swagger 주석 |
| `backend/src/modules/integrations/integrations.service.ts` | `toPublic` 매핑에 `autoRefresh` 계산 |
| `backend/src/modules/integrations/integrations.service.spec.ts` (또는 신규 dedicated spec) | toPublic 매핑 단위 테스트 |
| `frontend/src/lib/api/integrations.ts` | `IntegrationDto.autoRefresh: boolean` 필드 |
| `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` | `expiresSoon` 분기 가드 + `StatusView.subLabel` + StatusBadge 렌더 |
| `frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` | 매트릭스 보강 |
| `frontend/src/app/(main)/integrations/[id]/page.tsx` | InfoRow tooltip prop + autoRefresh 친화 표기, 헤더 subLabel 노출 |
| `frontend/src/lib/i18n/dict/ko/integrations.ts` | `tokenAutoRenews`, `tokenExpiresInAuto`, ... |
| `frontend/src/lib/i18n/dict/en/integrations.ts` | 동일 키 영문 |

## 결정 노트

- frontend `IntegrationDto.tokenExpiresAt` vs backend DTO 정의의 `expiresAt` 명명 미스매치 관찰됨 — 본 PR 의 범위 밖. swagger DTO 가 entity spread 와 다르게 적힌 상태(`expiresAt`). 추후 swagger DTO 동기 필요 — `spec-update-integration-autorefresh.md` 에 메모.
- `subLabel` 은 새 prop 으로 도입; 기존 `detail`(괄호 안 짧은 진단) 과 의미가 다르다. detail = 에러/주의 진단, subLabel = 보조 안내(Auto-renews 등).
- "in 1h 24m" 형식의 humanize 는 `@/lib/utils/date` 의 `timeAgo` 와 대칭되는 함수가 없을 수 있어, 필요시 `humanizeTimeUntil(at)` 헬퍼를 같은 모듈에 추가.

## BLOCK 처리 (2026-05-17)

`consistency-check --impl-prep` 결과 **BLOCK: YES** — Critical 2건:
- C-1: `IntegrationDto.autoRefresh` 가 spec §9.1 에 정의 없음 (SDD 선행 요건 미충족)
- C-2: `computeStatus` 의 `expiresSoon && !autoRefresh` 분기 변경이 spec §2.2 상태 아이콘 정의를 일방적으로 우회

검토 산출물: `review/consistency/2026/05/17/12_16_00/SUMMARY.md`.

사용자 결정 (2026-05-17): **spec 먼저 갱신 후 본 PR 진행** (정통 SDD).

선행 작업 chain:
1. project-planner 호출 → `spec-update-integration-autorefresh.md` 의 §A~§G 항목으로 `spec/2-navigation/4-integration.md` 본문 갱신 (별도 worktree)
2. spec 갱신 PR merge
3. 본 worktree 로 복귀 → `consistency-check --impl-prep` 재실행 (BLOCK: NO 확인)
4. 본 PR 구현 진입

추가 메모 (consistency-check 발견 반영):
- **W-3**: `plan/in-progress/cafe24-backlog-residual.md` C-3 (`status-badge.tsx` 의 `isReauthorizeDisabled` 이동) 이 같은 파일을 수정 예정 → 본 PR merge 이후 진행 권장. cafe24-backlog plan 에 메모 추가 필요.
- **W-4**: 후속 PR (attention 술어 변경) 의 `EXPIRING_SOON_INTERVAL` 변경은 `plan/in-progress/20260516-full-review` RESOLUTION W-32 와 동일 위치. 후속 PR 기획 시 W-32 와 병합 처리 권장.
- **I-4**: 구현 단계에서 `computeStatus` 수정 코드에 "spec §2.2/§2.3 불일치는 spec-update-integration-autorefresh.md 완료 시 해소" 한 줄 주석 추가.
- **I-2**: spec-update 의 §F 에 §4.2 Reauthorize 비활성 조건의 autoRefresh=true 정상 갱신 중 안내 보강 — `spec-update-integration-autorefresh.md` 갱신.

## 진행 체크리스트

- [x] consistency-check --impl-prep 호출 + 결과 archive (`review/consistency/2026/05/17/12_16_00/`)
- [ ] **선행**: project-planner 가 spec 갱신 (별도 worktree, `spec-update-integration-autorefresh.md` 의 §A~§G + W-3/W-4/I-2/I-4 메모 반영)
- [ ] consistency-check --impl-prep 재실행 후 BLOCK: NO 확인
- [ ] DOCUMENTATION 영향 매핑 확인 (i18n parity, swagger)
- [ ] 백엔드: service-registry 필드 + DTO + toPublic + 단위 테스트
- [ ] 프론트엔드: status-badge 분기 + StatusBadge + 단위 테스트
- [ ] 프론트엔드: 상세 페이지 InfoRow tooltip + 헤더 subLabel + Overview 표기
- [ ] i18n ko/en 키
- [ ] TEST WORKFLOW (lint·unit·build·e2e — 통합 영역이므로 e2e 권장)
- [ ] REVIEW WORKFLOW (/ai-review + RESOLUTION.md)
- [ ] PR 생성 후 `git mv` → `plan/complete/`
