# RESOLUTION — ai-review 3R (22_40_42) carousel 잘림 배너 · 수렴

원 리뷰: `review/code/2026/07/12/22_40_42/SUMMARY.md` — RISK LOW, CRITICAL 0, WARNING 1.

## WARNING (1건 — 반영, 수렴)
- **W1 (문서/유지보수, 2 reviewer 독립 확인) — spec §2/R8 자기모순**: 2R 에서 ko 문구를
  "일부만"→"일부 항목만 표시돼요."로 바꿀 때 §4(L150)만 갱신하고 §2/R8 rationale(L233)의 인용문을
  누락했다. **반영**: L233 을 "일부 항목만 표시돼요."로 정정 → §4/catalog/테스트와 통일. 런타임 무영향
  (코드·catalog·테스트는 이미 신문구로 일치했음).

## INFO (판정)
- I1 (함수 JSDoc 투영 미언급): 낮은 우선순위 + 필드-레벨 JSDoc 이 이미 truncated/totalCount 문서화 → 비차단 수용.
- I2 (toTable 대비 테스트 패리티 3건): asEnvelope/asTotalCount 완전 공유 경로라 위험 낮음 → carousel 전용
  분기 도입 시 보강(tracked, 조치 불요).
- I3 (배너 JSX 반복): rule-of-three — 3번째 소비처 시 `<TruncationBanner>` 추출.
- I4/I5/I6 (asTotalCount tighten·dead-field 소급·non-optional 필드): 의도된 변경, CHANGELOG/이전 RESOLUTION 기록.

## requirement disk-write gap
status=success·output 부재(반복 패턴). 본 라운드 유일 실질 이슈가 spec 자기모순(requirement 관점의 SPEC-DRIFT)
이었고 이를 W1 로 수정했으므로 spec 정합 관점은 실질 커버.

## 검증
- 본 수정은 spec 1줄 wording sync(codebase 무변경) — doc 가드로 확인.
- 누적: channel-web-chat vitest 354·typecheck·lint·e2e-test-full(playwright 46/0 + backend 253) green(직전 라운드).

## 수렴
1R→2R→3R 각 라운드 실질 개선 후 Critical 0·잔여 WARNING 0(W1 수정)·INFO 전량 tracked/accepted 로 수렴.
spec-only 수정이라 codebase 대비 3R 리뷰 fresh 유지 → push.
