# Code Review 후속 처리 (RESOLUTION) — M-8 1단계 완결 (delete/getHistory)

리뷰 대상: `refactor(triggers): M-8 1단계 완결 — triggersApi 에 delete/getHistory + 다이얼로그 이전` (commit `b135e6c6`)
처리 일시: 2026-06-23
전체 위험도: **LOW** — Critical 0, **Warning 3**, INFO 15.

본 커밋은 직전 `--impl-done`(08_33_48)의 I-1(delete-dialog 미이관)을 해소하고 §3 API 표를
완결한 additive 변경(delete/getHistory + 두 다이얼로그 이전 + 테스트). 신규 결함 없음.

## 수렴 판정: **CONVERGED**

Critical 0 + 잔존 WARNING 3건 전부 deliberate-defer(planner-only / pre-existing / 별도 리팩터,
리뷰가 직접 각 행에 defer 권고)로 수렴 기준 충족. 추가 codebase 수정은 review-gate 재무장
루프를 유발하므로 review/** 전용으로 종결.

---

## 잔존 WARNING (deferred)

| 출처 | 항목 | 처분 |
|------|------|------|
| **W-1** (SPEC-DRIFT) | `lib/api/triggers.ts` 가 `2-trigger-list.md` frontmatter `code:` 미등재 | **planner-only**(developer `spec/` read-only). consistency W-2·이전 ai-review SPEC-DRIFT 와 동일 항목. frontend api 계층은 코드베이스 관례(spec 규약 아님). project-planner 가 `code:` 등재 |
| **W-2** (Architecture) | `TriggerDeleteDialog` 가 `queryClient.invalidateQueries` 직접 호출(JSDoc `onDeleted?` prop 패턴 미반영) | **pre-existing** — 본 PR 변경은 `apiClient.delete`→`triggersApi.delete` 한 줄뿐, invalidation 로직 무변. JSDoc/invalidation 불일치는 기존 상태. 리뷰: "M-8 2단계에서 처리 권장" → 컴포넌트 분리(2단계) 시 `onDeleted?` 콜백으로 캐시 책임 호출자 위임 |
| **W-3** (Architecture) | `getHistory`/`getById` 의 envelope 정규화(`body?.data ?? body`) 인라인 중복 | **별도 리팩터/2단계** (리뷰 명시 defer). 공통 `unwrapEnvelope<T>` 헬퍼 추출 후보 — 기존 `lib/api/unwrap.ts` 와 통합 검토. 현재는 behavior-preserving 우선(각 메서드가 원본 호출부 로직 verbatim 흡수) |

---

## INFO 처분 (전부 비차단)

- **#1/#2 (Architecture)** — 트리거 13곳 triggersApi 집결 / `executions.ts` 관례 준수 → **긍정 발견**, 조치 불요.
- **#3 (Architecture)** — frontend `TriggerDetail` ↔ backend 동명 → M-8 2단계 개칭 검토(consistency W-3 과 동일, 이름은 drawer 에 이미 존재한 것을 relocate — 신규 충돌 아님).
- **#4 (Requirement)** — `getHistory` `{data:{data}}` 삼중 래핑 미처리 → spec 미정의 케이스, 3 테스트(배열/envelope/빈값)로 현행 범위 커버. 운영 발견 시 추가.
- **#5/#6/#8 (Requirement/Maintainability)** — `triggerId as string` 단언(`enabled` 가드로 안전, drawer getById 패턴 동일) / 빈 name confirm(backend §2.5 차단) → pre-existing, 기존 패턴 보존.
- **#7 (Maintainability)** — `getHistory<T>` 제네릭 vs `getById` 명시 반환 불일치 → 2번째 호출처 등장 시 `TriggerHistoryEntry` 를 triggers.ts 로 export 검토. 현재 단일 호출처라 보류.
- **#9/#10 (Maintainability)** — history-dialog Link className 인라인 / `fakeAxios` config 캐스팅 → 저우선 nit, 2단계/관례 정리 시 동반.
- **#11/#12/#13 (Testing)** — 다이얼로그 테스트가 `apiClient` 내부 mock(현 정상, 중기 `vi.mock("@/lib/api/triggers")` 전환 권장) / `getHistory` params 인수 검증 / delete 계층 중복 → 회귀 없음. 신규 `triggers.test.ts`(16) 가 API 레이어 직접 커버. 중기 개선 후보.
- **#14 (Documentation)** — `TriggerListParams` 에 `search`/`sort`/`order` 생략 주석 → **behavior-preserving**(원본 page 도 page/limit/type/status 만 전송, consistency W-1 동일). nit, 재무장 회피 위해 보류.
- **#15 (API Contract)** — `getHistory` `limit` optional(호출부 항상 `HISTORY_LIMIT=10` 전달) → 실질 위험 없음.

---

## 결론

Critical 0, Warning 3(planner-only / pre-existing / 별도 리팩터, 전부 defer). delete/getHistory 완결로
§3 API 표 전체 커버·트리거 직접 호출 13곳 제거 달성, 신규 결함 0. INFO 는 긍정/2단계/pre-existing/nit 분류.
**수렴 종결** — `/consistency-check --impl-done` 재실행(b135e6c6 postdate) 후 PR.
