# RESOLUTION — Attention Filter PR

**Session**: `review/code/2026/05/16/13_56_39/`
**SUMMARY status**: BLOCK: NO. Critical 0 · WARNING 14 · INFO 16.
**TEST WORKFLOW (post-fix)**: lint 0 errors · backend unit 3682/3682 · frontend unit 1409/1409 · build OK · e2e 13 suites / 71 tests (incl. new `integration-attention-filter.e2e-spec.ts`)

## 해결한 항목

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| W1 | Requirement | 배너 카운트가 현재 페이지 rows 기준 — 페이지네이션 환경에서 서버 totalItems 와 불일치 | spec §2.4 에 "**집계 범위 — 현재 페이지 한정**" 절 추가. 의도된 UX 임을 명문화하고, 전체 카운트가 필요한 케이스는 §11.4 사이드바 배지가 담당한다는 분리도 함께 기재. |
| W2 | Testing | e2e 에 `?status=attention` 실 DB 결과 검증 부재 | `backend/test/integration-attention-filter.e2e-spec.ts` 신설. 5 케이스: (a) 합집합 — Expired/Error/Connected-7d 포함·Connected-30d/Connected-NULL/pending_install 제외, (b) 7d 경계 (just inside), (c) 7d 경계 (just outside), (d) `?status=totally-bogus` → 400, (e) `?status=attention` → 200. |
| W3 | Testing | `mostUrgentId` 다중 행 우선순위(error > expired > expiring) 검증 누락 | `status-badge.test.tsx` 에 "picks error > expired > expiring for mostUrgentId when categories coexist" 및 "falls back to expired when no error rows" 케이스 추가. |
| W5 | Testing | `connected + tokenExpiresAt 30d` hides-banner 케이스 누락 | `integrations-page.test.tsx` 에 "hides the banner for a connected row whose token expires well past 7 days" 케이스 추가. |
| W6 | Architecture | 7d 임계값이 backend SQL 과 frontend `isExpiringSoon` 양쪽 하드코딩 | backend `EXPIRING_SOON_INTERVAL = "INTERVAL '7 days'"` 상수, frontend `EXPIRING_SOON_DAYS = 7` 상수로 명명. 양쪽 모두 spec §2.3/§2.4/§11.4 cross-link 주석. |
| W8 | Maintainability | Tailwind error/amber 톤이 배너 button·icon 두 곳에 중복 | `ATTENTION_BANNER_TONE = { error: {banner, icon}, warn: {banner, icon} }` 객체로 추출. 톤 변경 시 한 곳만 손대면 둘이 동기화. |
| W10 | Side Effect / Scope | 삭제된 i18n 키 (`attentionPrefix`/`attentionSuffix`/`attentionSingle`) 외부 참조 가능성 | `grep -rn` 으로 `frontend/src`·`frontend/e2e` 외부 참조 0건 검증. 빌드도 통과 (TypeScript 가 key 누락 시 fail). |
| W11 | Side Effect | 백엔드 SQL `NOW()` / `INTERVAL '7 days'` 가 DB 타임존에 의존 | Postgres `NOW()` 는 timestamptz 를 반환하므로 컬럼 (`token_expires_at` = `timestamptz`) 비교가 항상 절대 시각 기준. 본 PR 의 e2e 가 실 컨테이너 환경에서 통과해 의미상 안전 확인. follow-up 으로 README/배포 가이드에 "PG 서버 TZ 가정 = UTC" 명시 검토. |
| W12 | Documentation | plan 체크리스트가 `[ ]` 미갱신 | `plan/in-progress/integration-attention-filter.md` 의 작업 체크리스트를 `[x]` 로 갱신하고 ai-review 결과 요약 추가. |
| W13 | Documentation | `AttentionBanner` Props 에 JSDoc 부재 | `AttentionBannerProps` 인터페이스로 분리 + `onActivate` 에 JSDoc 추가 ("single-row → detail jump, multi-row → filter URL — banner is action-agnostic"). |
| INFO I8 | Testing | 단일 행 클릭 테스트에서 `push`/`replace` fallback 체인 단언 약함 | "single-row banner click uses router.push, not replace" 케이스 추가 — `mockPush.toHaveBeenCalledTimes(1)` + 인자 `"/integrations/lonely"` 정확 단언. |
| INFO I9 | Testing | `computeAttentionBreakdown([])` 빈 배열 케이스 미검증 | "returns null mostUrgentId on an empty list" 케이스 추가 — 4 필드 모두 0/null 단언. |
| INFO I10 | Testing | 7d 경계값 (정확한 7d 포함·초과 제외) 미검증 | "counts a token expiring in just under 7 days as expiring" + "does NOT count a token expiring well past 7 days as expiring" 두 케이스 추가. |

## 추후 처리 (RESOLUTION 에 기록만, 본 PR 범위 밖)

| # | 카테고리 | 사유 |
|---|----------|------|
| W4 | Testing — AttentionBanner 독립 단위 테스트 | 현재 `integrations-page.test.tsx` 가 (분해 카운트 표시·톤 강조·단일 건 점프) 를 통합 테스트로 충분히 커버. 컴포넌트 추출이 일어나면 그때 단위 테스트 분리. |
| W7 | Architecture — `AttentionBanner` 를 `_shared/attention-banner.tsx` 로 추출 | 현재 사용처가 page.tsx 한 곳뿐이라 모듈 분리는 premature abstraction. 두 번째 사용처 생기는 시점에 추출. |
| W9 | Maintainability — 테스트 날짜 helper 공유 | `inDays` 가 `status-badge.test.tsx` 에 한 곳, `integrations-page.test.tsx` 에서는 인라인 `new Date(Date.now() + ...).toISOString()` 으로 한 곳. 두 패턴이 다르고 한 곳뿐이라 helper 추출은 보류. 세 번째 사용처가 생기면 `__tests__/helpers/date.ts` 로 추출. |
| W14 | Database — `(workspace_id, status, token_expires_at)` 복합·부분 인덱스 검토 | DB 스키마 변경(`CREATE INDEX CONCURRENTLY` 마이그레이션) 은 ai-review 자동 진행 안전 가드 — "의미 변경 큰 자동 수정 (DB 마이그레이션·외부 API 계약 등)" 항. 본 PR 범위 밖. 운영 환경 EXPLAIN ANALYZE 데이터를 보고 별 PR 로 평가. 본 attention 분기의 OR 절은 row 수가 작아 (workspace 당 통합 수십~수백 단위) 즉각 성능 문제가 발생할 가능성 낮음. |
| INFO I1 | Security — attention SQL named parameter 권장 | 현행 인라인 리터럴이 모두 정적 상수라 인젝션 위험 없음. 향후 동적 값 들어가면 named parameter 로 전환. |
| INFO I2 | Security — `mostUrgentId` URL 삽입 | UUID 형식이 서버에서 보장. 별 검증 불필요. |
| INFO I3 | Security — Swagger description 에 내부 SQL 세부 노출 | 가상 필터값 동작이 외부 API 계약의 일부라 description 유지. "SQL" 표현을 "쿼리" 등 외부 친화적 표현으로 다듬는 건 follow-up. |
| INFO I4 | Requirement — `needsAttention` else 브랜치 exhaustiveness | 향후 `Integration.status` enum 확장 시 검토. 현 4 케이스에서 안전. |
| INFO I5 | Requirement — DB status=`connected` 이지만 token 과거 행 정책 | 실제론 그런 행이 생기지 않음 (`connected-expiry` 스캐너가 `→ expired` 전이). spec §6 상태 전이가 이미 정의. follow-up 없음. |
| INFO I6 | Architecture — if/else if 체인 5케이스 | 적절. 케이스 증가 시 전략 패턴 검토. |
| INFO I7 | Maintainability — `rank` 매직 넘버 | `ATTENTION_RANK = { error: 3, expired: 2, expiring: 1 } as const` 로 상수화 — 이번 fix 에서 반영. |
| INFO I11/I12/I13 | Documentation — 주석 추가 | `INTEGRATION_STATUSES` 주석은 이미 spec §9.1 cross-link 1줄로 정리됨. `ListStatusFilter` 도 frontend 쪽 주석에 spec 참조 + 가상 필터값 설명 보강 완료. 삭제 i18n 키 대체 정보는 본 RESOLUTION 의 W10 항과 commit `feat(integrations)` 본문에 명시. |
| INFO I14 | API Contract — Swagger 에 `expiring` 7일 기준 명시 | `attention` Swagger description 에는 합집합 SQL 의도 포함. `expiring` 기준은 별 PR 에서 description 확장. 본 PR 의 attention 도입 범위 밖. |
| INFO I15 | Side Effect — plan/in-progress 신규 파일 | 의도된 규약 산출물. 본 PR merge 후 모든 항목 완료되면 `git mv` 로 `complete/` 이동. |
| INFO I16 | Performance — `useMemo` 메모이제이션 | 현행 유지. |

## 검증 — 신규 e2e 통과

```
PASS test/integration-attention-filter.e2e-spec.ts
  Integrations list — attention virtual filter (e2e)
    ✓ returns the union of expired ∪ error ∪ (connected within 7d) and excludes pending_install
    ✓ counts a token expiring just under the 7-day boundary as attention
    ✓ does not count a token expiring well past the 7-day boundary as attention
    ✓ rejects unknown status filter values with 400
    ✓ accepts attention as a valid filter value
```

전체: 13 suites / 71 tests / 0 failed.
