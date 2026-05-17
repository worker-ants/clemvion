# RESOLUTION — code review 조치 내역

> 세션: `review/code/2026/05/17/13_44_54/`
> 대상 PR: feat(integrations) autoRefresh derived 필드 + UI 표기 (`c9fe5dde`)
> 처리자: developer (2026-05-17)

## 조치 분류

본 PR 의 응집도(autoRefresh 노출 + 상세 페이지 표기) 안에 즉시 흡수 가능한 항목 vs 후속 PR 로 분리하는 게 자연스러운 항목으로 구분.

## 즉시 처리 (이번 PR 에 반영)

| # | 등급 | 항목 | 처리 |
|---|---|---|---|
| C-1 | Critical | `humanizeUntil` 직접 단위 테스트 부재 (testing) | `status-badge.test.tsx` 에 `describe("humanizeUntil")` 블록 8 케이스 추가 — 과거시각/NaN/공백/30s/45m/60m·120m/1h 24m/일 단위 경계 |
| W-4 | Warning | 백엔드 테스트 케이스 7 이름 오기 (`returns false for cafe24 Private` 이나 단언은 `toBe(true)`) | 케이스 description 을 `returns true for cafe24 Private ...` 로 수정 |
| W-8 | Warning | `pending_install` 분기 callback failure 진단 주석 블록 삭제 | 원본 주석 복원 (spec §10.4 참조 포함 6줄) |
| W-9 | Warning | `humanizeUntil` 공개 export 인데 JSDoc 부재 | `@param`, `@returns` 포함 정식 JSDoc 블록으로 교체 |
| W-10 | Warning | `expired + install_timeout` Cafe24-private-specific 주석 블록 삭제 | 원본 주석 복원 (2줄) |
| W-11 | Warning | `@ApiProperty({ example: true })` 에 `type` 미명시 (Swagger 추론 실패 가능) | `@ApiProperty({ type: 'boolean', example: true })` 로 명시 |
| W-1 (부분) | Warning | `needsAttention()` 의 autoRefresh 가드 누락 — TODO 주석 부재로 후속 개발자 혼동 위험 | 본 PR 의 plan 결정대로 가드 자체는 후속 PR. 다만 `needsAttention` 함수 헤더에 후속 PR 추적 메모(W-32 병합 처리·일시적 불일치 잔존 사실) 7줄 TODO 주석 추가 |

## 후속 PR 로 분리 (응집도 / 범위 분리)

| # | 등급 | 항목 | 분리 사유 / 추적 위치 |
|---|---|---|---|
| W-1 (가드 자체) | Warning | `needsAttention()` / `computeAttentionBreakdown()` 의 `autoRefresh` 가드 | spec PR #139 가 attention 술어를 `AND NOT autoRefresh` 로 정의했으나, 그 효과는 backend 쿼리 (`EXPIRING_SOON_INTERVAL`) + frontend `needsAttention` 가 동시에 변경되어야 사이드바·목록·헤더 사이 일관. 본 PR 의 `plan/in-progress/integration-token-ui-autorefresh.md` "본 PR 범위 밖" 절 + `plan/in-progress/20260516-full-review/SUMMARY.md` W-32 와 병합 처리 권고로 분리 |
| W-2 | Warning | `autoRefresh` 파생 필드의 e2e 시나리오 | 본 PR 은 derived 필드 추가 + UI 표시. 실 인프라·multi-actor 흐름 불변 → `[skip-e2e]` 정당화. 후속 PR (가드 변경 포함) 에서 attention 술어 흐름이 실제 사용자 시나리오를 변경할 때 e2e 추가 |
| W-3 | Warning | `InfoRow` tooltip 분기 RTL 렌더 테스트 | 컴포넌트 추가가 작은 prop 1건이라 단위 테스트 ROI 낮음 — 후속 PR 또는 별도 위생 PR 에서 처리. 본 PR 의 사용자 가치(헤더 노란 경고 해소) 와는 결합 약함 |
| W-6 | Warning | `TooltipProvider` 위치 — 페이지/탭 루트로 상향 | Radix 권장 패턴이지만 본 PR 의 단일 InfoRow 만 사용. 추가 사용처 늘 때 한 번에 상향 (별도 위생 PR 예약) |
| W-7 | Warning | `humanizeUntil` 위치를 `@/lib/utils/` 로 이동 | 본 PR 은 status-badge 와 page.tsx 두 곳만 import. 추가 사용처 등장 시 위치 이동 — 별도 위생 PR |
| W-5 | Warning | `toPublic` 의 목록 API 경로에서도 `autoRefresh` 검증 | 본 PR 의 단위 테스트는 `findById` 경유 — 실제로 동일 `toPublic` 매핑이라 보장됨. 후속 PR 에서 list 경로 명시 케이스 1건 추가 가능 |
| W-12 | Warning | spec PR(#139, #142) 와 본 PR merge 순서 — JSDoc spec 참조 broken 위험 | 운영 합의 사항 (사용자가 #139, #142 를 먼저 merge 한 뒤 본 PR 진입) 으로 이미 해소 — main 에 두 PR 이 반영된 상태에서 본 PR 가 rebase 됨 (commit c4200d51·96bf35cb 가 본 PR 의 base) |

## INFO 등급 추적

INFO 16건 모두 본 PR 범위 외 / 중기 개선 항목. 본 RESOLUTION 에서는 별도 처리 없이 발견 사실만 보존:

- I-1 (security): `credentials` 필드 마스킹 의존 — 기존 이슈
- I-2 (architecture): `ServiceDefinition.supportsTokenAutoRefresh` optional → 필수 또는 helper
- I-3 (architecture): IntegrationDto 프론트-백엔드 수동 동기 — openapi-typescript 도입 검토
- I-4~I-5 (side_effect): `humanizeUntil` `Date.now()` 직접 사용 / `StatusView.subLabel` 직접 생성 호출처
- I-6~I-7 (maintainability): ms 단위 상수 중복 / 테스트 헬퍼 산재
- I-8~I-10 (testing): `StatusBadge` 컴포넌트 레벨 렌더 테스트, service-registry 직접 단언, error/expired 분리
- I-11~I-12 (api_contract): supportsTokenAutoRefresh helper / changelog
- I-13~I-14 (documentation): JSDoc 의 구체 서비스 이름 박제 / `InfoRow` JSDoc 의 §4.2 vs §4.1 불일치
- I-15~I-16 (requirement/architecture): rolling 배포 시 `?? false` 폴백 / `subLabel` 빌더 추출

후속 위생 PR (`spec-update-2-navigation-hygiene-followup`) 또는 `20260516-full-review` 잔여 항목 분류로 흡수 권고.

## 재테스트 결과 (조치 후)

- frontend `status-badge.test.tsx`: 35 tests pass (이전 27 + `humanizeUntil` describe 8)
- backend `integrations.service.spec.ts`: 71 tests pass
- backend `npm run build`: 통과
- frontend `npm run lint`: 0 errors
- skip-e2e (본 PR 사유 동일)

## 진행 상태

- 모든 Critical (1건) 해소 ✓
- 본 PR 흡수 대상 Warning (5건) 해소 ✓
- 후속 PR 로 분리한 Warning (7건) plan 메모에 반영 ✓
- INFO (16건) RESOLUTION 추적 ✓

다음 단계: 본 fix commit (자동 커밋 규약 — REVIEW WORKFLOW 단일 commit) → PR push.
