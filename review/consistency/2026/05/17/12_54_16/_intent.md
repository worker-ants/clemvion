

---

## 변경 의도 (impl-prep — spec 갱신 PR #139 merge 후 재실행)

spec/2-navigation/4-integration.md 가 이미 autoRefresh 친화적으로 갱신됨 (commit c4200d51). 본 impl-prep 는 후속 구현이 그 spec 정의와 정합되는지를 확인.

### 구현 변경 예정

1. **백엔드**
   - `backend/src/modules/integrations/services/service-registry.ts` 의 `ServiceDefinition` 인터페이스에 `supportsTokenAutoRefresh?: boolean` 옵션 필드 추가
   - cafe24/google 의 정의에 `supportsTokenAutoRefresh: true` 설정 (github 은 Refresh ✗ — false 기본값)
   - `backend/src/modules/integrations/integrations.service.ts` 의 `toPublic` 매핑에 `autoRefresh: boolean` 계산 추가
   - `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 의 `IntegrationDto` 에 `autoRefresh` 필드 + swagger 주석 보강

2. **프론트엔드**
   - `frontend/src/lib/api/integrations.ts` 의 `IntegrationDto` 타입에 `autoRefresh: boolean` 추가
   - `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` 의 `computeStatus`:
     - `expiresSoon` 분기를 `expiresSoon && !autoRefresh` 로 좁힘
     - `StatusView` 인터페이스에 `subLabel?: string` 옵션 추가
     - autoRefresh + connected 면 라벨 "Connected" 유지 + subLabel "Auto-renews · next in <duration>"
   - `frontend/src/app/(main)/integrations/[id]/page.tsx`:
     - 헤더에 subLabel 렌더
     - Overview 탭의 "Token Expires" 행을 autoRefresh 한정으로 친화 표기 + 절대시각 Tooltip
     - `InfoRow` 컴포넌트에 optional `tooltip` prop 추가

3. **i18n** — ko/en 양쪽 `integrations.tokenAutoRenews`, `integrations.tokenExpiresInAuto` 등 키 추가

### 본 PR 범위 밖 (후속 별도 PR)

- backend `EXPIRING_SOON_INTERVAL` 쿼리에 `AND NOT autoRefresh` 가드 (목록/사이드바 카운트)
- frontend `needsAttention()` 가드
- 이유: spec §2.4·§11.4·§2.3 의 술어 갱신은 spec PR #139 에서 이미 끝났으나, 실제 SQL 변경은 `20260516-full-review` W-32 의 `EXPIRING_SOON_INTERVAL` 공유 상수 추출과 함께 묶어 처리하는 게 좋다는 plan 노트 (PR #139 에 포함)

### 점검 요청

- 본 변경이 갱신된 spec §2.2/§2.3/§2.4/§4.1/§4.2/§9.1/§10.5/§11.4/Rationale 정의와 정합되는지
- `autoRefresh` / `supportsTokenAutoRefresh` 식별자가 기존 요구사항 ID / 엔티티 / 환경변수와 충돌하는지
- 같은 worktree / 다른 in-progress plan 과의 충돌 (특히 `cafe24-backlog-residual.md` C-3 의 `status-badge.tsx` 동일 파일 수정 — 본 PR 후 진행으로 plan 노트 보강됨)
- swagger DTO 컨벤션, frontend i18n 키 ko/en parity 컨벤션 준수
