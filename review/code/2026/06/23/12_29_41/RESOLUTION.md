# Code Review 후속 처리 (RESOLUTION) — m-2 페이지 API 이전

리뷰 대상: `refactor(frontend): m-2 — statistics/schedules/dashboard apiClient → lib/api 이전` (commit `cb18b7b4`)
처리 일시: 2026-06-23
전체 위험도: **LOW** — Critical 0, Warning 4, INFO 9.

본 PR 은 behavior-preserving 페이지 API 레이어 이전. Warning 4건 전부 fix 불요(planner-only /
pre-existing / 의도적 cross-domain defer)로, 코드 변경 없이 근거 기록 후 수렴한다.

## 수렴 판정: **CONVERGED**

Critical 0 + 잔존 WARNING 4건 전부 deliberate-defer. 코드 변경 없음 → 재리뷰 불요.

---

## Warning 처분 (전부 defer)

| # | 카테고리 | 처분 |
|---|----------|------|
| W-1 | SPEC-DRIFT | `GET /statistics/llm-usage/timeseries` 가 spec §3 에 있으나 `statisticsApi` 미수록. **페이지가 해당 엔드포인트를 호출하지 않음** — 본 이전은 페이지 사용 엔드포인트만 충실히 옮긴 것이라 미수록이 맞다(dead method 추가는 부적절). timeseries 위젯 구현 시 메서드 추가, 또는 spec 에 "카탈로그 미수록(미구현)" 표기 → **planner**. 기능 회귀 없음 |
| W-2 | SPEC-DRIFT | 신규 `lib/api/{dashboard,statistics,schedules}.ts` 가 각 spec frontmatter `code:` 미등재 → **planner-only**(developer `spec/` read-only). 이전 PR(triggers)들의 동일 SPEC-DRIFT 와 같은 트랙. frontend api 계층은 코드베이스 관례(spec 규약 아님) |
| W-3 | Architecture | `executions.ts` 의 로컬 `unwrap` 이 공유 `lib/api/unwrap.ts` 와 중복 — **pre-existing**(본 PR 은 `executions.ts` 미변경; 신규 wrapper 들은 공유 `unwrap` 사용). 별건 기술부채(별도 PR 에서 `executions.ts` 로컬 unwrap → import 교체) |
| W-4 | Architecture | statistics·schedules 페이지의 `/workflows` 직접 호출 잔류 — **의도적 cross-domain 제외**(workflows 도메인 → 별도 workflows 트랙). 각 호출에 주석 명시. triggers 페이지와 동일 처리. workflows 트랙 PR 에서 `workflowsApi.list()` 통합 |

---

## INFO 처분 (전부 비차단)

- **I-1/I-2/I-3 (Security)** — `id` 경로 보간 런타임 검증 / `StatisticsQueryParams` 광역 타입 / `handleExport` catch 무음 → 전부 **pre-existing**(verbatim 이동, 페이지 원본 동일). backend 인가가 실질 게이트. 광역 타입은 페이지가 동적 params 구성이라 의도적. export 무음은 원본 주석에 인지됨. 별건/수용.
- **I-4 (Side Effect)** — `exportStats` 의 `new Blob([res.data as BlobPart])` → **behavior-preserving 유지**(페이지 원본 verbatim). `res.data as Blob` 단순화는 미세 동작 변경이라 본 리팩터 범위 밖.
- **I-5 (Testing)** — `getErrors`/`getNodeStats` wrapper 테스트 누락 → wrapper 는 params passthrough 라 다른 getter 와 동일 패턴(대표 커버됨). node-stats 의 `workflowId=selectedWorkflowId` 특이점은 **페이지** 의 params 구성에 있고 기존 statistics 페이지 테스트(4)가 커버. 후속 보강 후보.
- **I-6 (Testing)** — `fakeAxios` 3 테스트 파일 복제 → `__tests__/helpers/` 공통 추출은 별건 정리(triggers.test.ts 도 동일 패턴).
- **I-7 (Testing)** — dashboard 컴포넌트 테스트 부재(기존에도 없음) → wrapper 테스트(4)로 API 계층 커버. 페이지 smoke test 는 별건.
- **I-8 (Documentation)** — `statistics.ts` 인터페이스 JSDoc 누락(dashboard/schedules 와 불일치) → 후속 보강 후보(저우선 nit).
- **I-9 (Maintainability)** — schedules `limit: 200` 매직넘버 → 상수화는 페이지 verbatim 이동분이라 별건 정리.

---

## 결론

Critical 0, Warning 4 전부 deferred(planner / pre-existing / 의도적 cross-domain). 본 이전은 페이지
사용 엔드포인트를 충실히 옮긴 behavior-preserving 변경(기존 페이지 테스트 무수정 통과 + 신규 wrapper
테스트). 코드 변경 없이 근거 기록 후 종결 → `/consistency-check --impl-done` 후 PR.
