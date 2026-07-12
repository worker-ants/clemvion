# RESOLUTION — ai-review (21_59_01) carousel 잘림 배너

원 리뷰: `review/code/2026/07/12/21_59_01/SUMMARY.md` — RISK MEDIUM, CRITICAL 0, WARNING 2.

## WARNING (2건 — 전부 반영)
- **W1 (testing) — top-level `truncation` → carousel 투영 미검증**: 기존 "toCarousel — top-level truncation"
  테스트가 items 만 단언하던 것을 `expect(c.truncated).toBe(true)`/`expect(c.totalCount).toBe(500)` 로
  확장 — AI `render_carousel` 의 `PresentationPayload.truncation` 흡수 경로를 toTable 대칭으로 고정.
- **W2 (maintainability) — 검증 로직 인라인 복제**: `asTotalCount(v): number|undefined` 헬퍼를 as* 헬퍼군에
  추출해 `toCarousel`/`toTable` 이 공유. drift 위험 제거.

## INFO (반영/판정)
- **I1 (requirement) — 코드가 spec §R8("정수")보다 느슨**: `asTotalCount` 에 `Number.isInteger` 포함 →
  코드가 spec 에 맞춰짐. toTable 도 동반 tighten(동일 대칭, 기존 테스트 무회귀 확인). 12.5 → undefined 테스트 추가.
- **I4 (testing) — 0 경계 미검증**: `itemsTotalCount: 0` → `totalCount: 0` 유효 테스트 추가.
- **I5 (maintainability) — for 루프 vs it.each**: 이형 테스트를 `it.each([NaN,-1,Infinity,12.5,"5"])` 로 통일.
- I2/I3 (side_effect): 조치 불요 — 의도된 변경(같은 diff 동기화). I3(dead field 활성화 소급 노출)는 PR 노트 명시.
- I6 (배너 JSX 2번째 반복): rule-of-three, 3번째 배너 시 `<TruncationBanner>` 추출 — 조치 불요.
- I7 (scope): spec+code 동일 changeset = Phase A(planner)+Phase B(developer) 한 worktree 명시, 단일 feature 국한.

## documentation·user_guide_sync disk-write gap
두 reviewer status=success·output 부재(2R 연속 패턴). fresh `/ai-review` 라운드에서 재실행되며 해소.
(user_guide_sync: channel-web-chat 은 PROJECT.md doc-sync-matrix 밖이라 무발견 예상 — 위젯 로컬 catalog 경유.)

## 검증
- channel-web-chat vitest: 350 passed (기존 344 + 신규 6, isInteger tighten 무회귀)
- typecheck·lint: clean
- e2e-test-full: playwright 46 expected/0 unexpected/0 flaky + backend supertest 253 passed (무회귀)

fresh `/ai-review --branch origin/main` 후속(수렴 + documentation/user_guide_sync 회수).
