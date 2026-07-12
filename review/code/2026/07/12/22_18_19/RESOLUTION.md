# RESOLUTION — ai-review 2R (22_18_19) carousel 잘림 배너

원 리뷰: `review/code/2026/07/12/22_18_19/SUMMARY.md` — RISK MEDIUM, CRITICAL 0, WARNING 3.

## WARNING (3건 — 전부 반영)
- **W1 (문서화) — CHANGELOG 미갱신**: `CHANGELOG.md` Unreleased 에 carousel 잘림 배너 항목 추가
  (#921 table 대칭, dead-field 활성화·소급 노출·asTotalCount isInteger tighten·spec 링크 명시).
- **W2 (테스트) — 부분 반영**: (a) 복원 thread describe 블록에 `payloadOf("carousel", ..., {itemsTruncated,
  itemsTotalCount})` 컴포넌트 테스트 2건(총 개수/무개수 폴백) 추가 — AI `render_carousel` 실 렌더 경로 검증.
  (b) toCarousel 우선순위 lock-in + null/문자열 no-op unit 2건 추가(toTable 대칭). 이전 RESOLUTION "전부 반영"
  → 실제는 부분이었음을 본 RESOLUTION 이 정정.
- **W3 (CSS) — `.wc-carousel-truncated` 부재**: `styles.ts` 의 `.wc-table-truncated` 셀렉터에
  `.wc-carousel-truncated` 를 합쳐 공유(시각 대칭 — 작은 회색 캡션).

## INFO (반영/판정)
- **I5 (ko 문구 비대칭)**: `carousel.truncated` ko "일부만 표시돼요." → "일부 항목만 표시돼요."(en "items" 대칭,
  table "행"·carousel "항목"). spec §4 동반 갱신.
- **I7 (plan count stale)**: 완료 노트 344 → 350.
- I1/I2 (asTotalCount tighten·dead-field 소급): 의도된 변경 — CHANGELOG 에 명시.
- I3/I4 (non-optional 필드·JSX 반복): 조치 불요(동기화·rule-of-three).
- **I6 (함수 JSDoc 투영 미언급)**: 우선순위 낮음 + 필드-레벨 JSDoc 이 이미 truncated/totalCount 문서화 →
  비차단 수용(미반영).
- **I8**: 이전 RESOLUTION "doc-sync-matrix 밖" 근거 부정확(결론은 맞음, channel-web-chat 은 `new-widget-chrome-string`
  으로 matrix 내·catalog ko/en 추가로 충족). 아카이브 문서라 소급 수정 불요 — 본 SUMMARY/RESOLUTION 에 정정 기록.

## security·user_guide_sync disk-write gap
2R 연속 반복 패턴. 실 결함 아님: 이전 라운드 security=NONE(순수 렌더/헬퍼/테스트, 공격면 미증가),
user_guide_sync 는 catalog ko/en 추가로 doc-sync-matrix `new-widget-chrome-string` 충족. fresh 라운드가 재확인.

## 검증
- channel-web-chat vitest: 354 passed (기존 350 + 신규 4: 컴포넌트 2 + unit 2)
- typecheck·lint: clean (catalog ko/en parity 포함)
- e2e-test-full: playwright 46 expected/0 unexpected/0 flaky + backend supertest 253 (무회귀)

fresh `/ai-review --branch origin/main` 3R 후속(수렴).
