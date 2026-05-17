

---

## 변경 의도 (impl-prep — 3차 재실행, spec PR #139 + 위생 PR #142 merge 후)

spec/2-navigation/4-integration.md 가 autoRefresh 친화적으로 갱신됨 (PR #139, c4200d51). 14-execution-history.md 자기 참조 PRD 링크 제거 + 1-data-model.md §2.10 autoRefresh derived 주석 추가됨 (PR #142, 96bf35cb). 이전 BLOCK 사유 모두 해소된 상태에서 구현 착수 가능 여부를 최종 확인.

### 구현 변경 예정

1. **백엔드** (NestJS)
   - `backend/src/modules/integrations/services/service-registry.ts` 의 `ServiceDefinition` 인터페이스에 `supportsTokenAutoRefresh?: boolean` 옵션 필드 추가
   - cafe24 / google 의 정의에 `supportsTokenAutoRefresh: true` 설정 (github 등 나머지는 미설정 = false 효과)
   - `backend/src/modules/integrations/integrations.service.ts` 의 `toPublic` 매핑에 `autoRefresh: boolean` 계산 추가 (service-registry lookup)
   - `backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 의 `IntegrationDto` 에 swagger 주석 추가 (`@ApiProperty({ description: '...' })`)
   - 단위 테스트: `toPublic` 매핑이 cafe24/google true, 다른 service_type false 반환

2. **프론트엔드** (Next.js)
   - `frontend/src/lib/api/integrations.ts` 의 `IntegrationDto` 타입에 `autoRefresh: boolean` 추가
   - `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`:
     - `StatusView` 인터페이스에 `subLabel?: string` 옵션 추가
     - `computeStatus` 의 `expiresSoon` 분기를 `expiresSoon && !autoRefresh` 로 좁힘
     - autoRefresh + connected 면 라벨 "Connected" 유지 + subLabel = i18n key 의 "Auto-renews · next in <duration>"
     - StatusBadge 컴포넌트가 subLabel 을 작은 회색 글씨로 렌더
   - `frontend/src/app/(main)/integrations/[id]/page.tsx`:
     - 헤더 메타 라인 옆 subLabel 노출
     - Overview 탭 "Token Expires" 행은 autoRefresh 면 친화 표기 `in <duration> · auto-renews` + 절대시각 Tooltip
     - `InfoRow` 컴포넌트에 optional `tooltip` prop 추가
   - 단위 테스트: status-badge 매트릭스 (autoRefresh × expiresSoon × status)

3. **i18n** — ko/en 양쪽 `integrations.tokenAutoRenews` 등 키 추가

### 본 PR 범위 밖 (후속 별도 PR)

- backend `EXPIRING_SOON_INTERVAL` 쿼리에 `AND NOT autoRefresh` 가드 (목록·사이드바 카운트)
- frontend `needsAttention()` 가드
- W-32 (`integrations.service.ts:250` 공유 상수 추출) 와 병합 처리 권고

### 점검 요청

- 본 변경이 갱신된 spec §2.2/§2.3/§2.4/§4.1/§4.2/§9.1/§10.5/§11.4/Rationale 정의와 정합되는지
- `autoRefresh` / `supportsTokenAutoRefresh` 식별자가 기존 요구사항 ID / 엔티티 / 환경변수와 충돌하는지
- `cafe24-backlog-residual.md` C-3 의 `status-badge.tsx` 동일 파일 수정 — 본 PR 후 진행으로 plan 노트 보강된 상태
- swagger DTO 컨벤션, frontend i18n 키 ko/en parity 컨벤션 준수
