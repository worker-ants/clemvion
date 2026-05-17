---
worktree: integration-token-ui-autorefresh-a3f9b2
started: 2026-05-17
owner: developer (project-planner 위임 요청)
---

# Spec 갱신 제안: 자동 갱신 통합의 attention/expiring 술어 제외

## 배경

자매 plan `integration-token-ui-autorefresh.md` 의 구현은 상세 페이지의 표현 자유도 안에서만 처리하며, `spec/2-navigation/4-integration.md` 의 다음 술어들은 **자동 갱신 통합(cafe24/google 등)을 영원히 attention 으로 잡는 부작용**이 있어 spec 자체의 정의 변경이 필요하다. developer 권한으로 spec 본문은 수정할 수 없으므로 project-planner 에 위임한다.

## 발견 사실

- 카페24 access_token 수명은 2시간. spec §2.4·§2.3·§11.4 가 사용하는 `token_expires_at <= NOW() + INTERVAL '7d'` 술어는 **항상 true** 가 되어, 카페24 통합은 사이드바 attention 카운트·"Need attention" 배너·`Expiring` 칩에 영구 포함된다.
- 백엔드 자동 갱신(BullMQ `cafe24-token-refresh`, `Cafe24ApiClient.ensureFreshToken`, `cafe24-background-refresh` 일일 잡)이 정상 동작 중이므로, 이 통합은 사용자 액션을 요구하지 않는다 → attention 표시는 거짓 양성.

## 제안하는 spec 변경

### A. §9.1 IntegrationDto 응답 스키마 — `autoRefresh: boolean` 필드 추가

- 자동 갱신 가능 통합의 식별자 (UI 분기 근거).
- 정의: 서비스 정의가 `refresh_token` 발급·갱신을 보장하는 OAuth provider 인지.
- 현재 매핑: cafe24 = true, google = true, github = false (Refresh ✗ — §10.3 표), 비-OAuth = false.

### B. §2.4 "Need attention" 배너 포함 조건

기존: `(status='connected' AND token_expires_at > NOW() AND token_expires_at <= NOW() + INTERVAL '7d')` 포함.

변경: 위 조건에 **`AND NOT integration.autoRefresh`** 추가. 자동 갱신 통합은 만료 임박이라도 사용자 액션 불필요.

### C. §11.4 UI 배지 (사이드바 카운트)

§2.4 와 동일한 술어 → 동일 변경.

### D. §2.3 Filter 칩 `Expiring` (7일 이내) / §9.1 `?status=expiring` 가상 필터

기존: `status='connected' AND token_expires_at within 7d`.
변경: `AND NOT integration.autoRefresh` 추가.

`?status=attention` (= Expired ∪ Expiring ∪ Error) 도 자동 전파.

### E. §2.2 항목 요소 — 상태 텍스트 표

기존: `Connected / Expires in Nd / Expired / Error / Pending install`.
보완: "**자동 갱신 통합(autoRefresh=true)** 은 만료 임박일 때도 `Connected` 를 표시하며, 작은 보조 라벨(`Auto-renews`) 로 자동 갱신 사실을 알린다." 한 줄 단서.

### F. §4.1 헤더 / §4.2 Overview 탭 — 보조 라벨·친화 표기

- 상태 배지의 보조 텍스트로 `Auto-renews · next in <duration>` 노출 (autoRefresh=true 한정).
- Overview 의 "토큰 만료 시각" 행은 자동 갱신 통합 한정으로 친화 표기(`in 1h 24m · auto-renews`) + 절대시각은 Tooltip 으로 강등.

### G. §10.5 토큰 자동 갱신 — autoRefresh 정의 명문화

본문 내 "Refresh token 보유 시" 표현을 `IntegrationDto.autoRefresh` 와 연결해, frontend 가 그 플래그로 UI 분기함을 명시.

### H. Rationale 추가

> **자동 갱신 통합을 attention 술어에서 제외 (2026-05-XX)**
>
> 카페24 access_token 수명(2h)이 §2.4·§11.4·§2.3 의 7일 임계치보다 짧아 attention 술어가 영원히 true 가 되는 거짓 양성. 자동 갱신이 동작하면 사용자 액션이 불필요하므로 attention 에서 제외한다. autoRefresh 통합의 실패는 §10.5 의 `error(auth_failed)` / `error(network)` 전이로 별도 attention 신호가 이미 있어, 사용자 신호가 사라지는 회귀는 없다.

## 백엔드 영향

- `EXPIRING_SOON_INTERVAL` 사용 위치 (`integrations.service.ts:248~275`) 의 list filter 쿼리에 `AND service_type NOT IN (auto-refresh services)` 또는 join 기반 제외.
- 사이드바 카운트 API 동일.
- 단위 테스트 + e2e (attention 합집합 / Expiring 칩 / 사이드바 카운트) 보강.

## 프론트엔드 영향

- `needsAttention(integration)` 가 `connected AND expiringSoon` 분기에서 `!autoRefresh` 가드 추가.
- 목록 카드의 attention 배지 / 헤더 상태 배지 / 사이드바 카운트가 일관되게 떨어짐.

## 부수 미스매치 (별도 메모)

- backend `IntegrationDto` 클래스 정의의 `expiresAt?: string | null` (line 91) 이 실제 wire 의 `tokenExpiresAt` (entity field spread 결과) 와 불일치. swagger 만 부정확. 동일 PR 사이클에서 동기화 권장.

## consistency-check 발견 추가 반영 (2026-05-17)

본 spec 갱신 PR 에서 함께 처리:

- **§F 보강 (I-2)**: spec §4.2 Reauthorize 비활성 조건에 "autoRefresh=true 통합은 정상 갱신 중이므로 Reauthorize 불필요" 한 줄 추가.
- **Rationale 보강 (I-3)**: autoRefresh 신규 개념 도입 근거 + 향후 Attention 배너·칩·가상 필터 연동 방향 명시.
- **§9.1 보강**: `autoRefresh` 는 derived 필드 — `ServiceDefinition.supportsTokenAutoRefresh` 에서 파생되며 DB 컬럼이 아님을 §9.1 또는 Rationale 에 명시.
- **W-5 별개 처리 (선택)**: `spec/2-navigation/14-execution-history.md` 의 자기 참조 PRD 링크 / `prd/` 출처 blockquote / Overview·본문 이중 구조 정리는 본 PR 과 별개 — project-planner 가 한 사이클에 처리할지 분리할지 결정.

## 후속 PR 메모 (W-3, W-4)

- **W-3**: 후속 attention 술어 변경 PR 은 `plan/in-progress/cafe24-backlog-residual.md` C-3 (status-badge.tsx 의 `isReauthorizeDisabled` 이동) 이후 진행. cafe24-backlog plan 에 "integration-token-ui-autorefresh PR merge 이후" 메모 추가 필요.
- **W-4**: 후속 PR 의 `EXPIRING_SOON_INTERVAL` 변경은 `plan/in-progress/20260516-full-review/RESOLUTION.md` W-32 와 동일 파일·위치 — 후속 PR 기획 시 W-32 작업과 병합/조율.

## 진행 체크리스트

- [x] developer 가 발견·노트 작성 (2026-05-17)
- [ ] **사용자 결정**: spec 먼저 갱신 (2026-05-17 결정 — 본 plan 진행)
- [ ] project-planner 호출 → 별도 worktree 에서 spec 본문 갱신
- [ ] spec 갱신 PR merge
- [ ] integration-token-ui-autorefresh worktree 로 복귀 → consistency-check 재실행 → 본 PR 구현 진입
- [ ] 후속 attention 술어 PR (backend 쿼리 + frontend needsAttention) 분리 발주
- [ ] 본 plan 의 처리 완료 시 `git mv` → `plan/complete/`
