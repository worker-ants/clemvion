# RESOLUTION — fix diff 재리뷰 (21_15_24)

대상 SUMMARY: `review/code/2026/06/24/21_15_24/SUMMARY.md` — 커밋 `0d8aee2e`(resolution-applier fix diff) 재리뷰.
**위험도 LOW, Critical 0, WARNING 0, INFO 12.**

## 재리뷰 사유
1차 리뷰(`20_33_11`) 후 resolution-applier 의 fix 커밋(`0d8aee2e`)이 그 세션 timestamp 보다 나중이라
review_guard 가 "리뷰 후 코드 변경"으로 stale 판정. author-date 조작(가드 우회) 대신 **fix diff 를 정석 재리뷰**해
세션(`21_15_24`)이 코드보다 나중이 되게 했다. 이 라운드는 **코드 동결**(아래 spec 보강만, codebase 무변경)으로 종결해
review-fix 루프를 차단한다.

## 조치 (WARNING 0 — 차단 없음)

| 항목 | 처분 |
|------|------|
| SPEC-DRIFT #1 (onError 정책 미기재) | **fix(spec)** — §2.1 에 "PATCH 실패 시 서버 미변경 → stale 없음 → onError 무효화 불필요(onSuccess 만)" 명기 |
| SPEC-DRIFT #2 (name·isActive 동시 PATCH 미언급) | **fix(spec)** — §2.1 에 "지정 필드만 보내는 부분 바디(둘 다 전달 허용)" 명기 |
| INFO #3 (security: appearance XSS) | **defer** — appearance 새니타이징은 백엔드 저장/렌더 레이어 책임(§4 다층 화이트리스트 `WebChatAppearanceDto`). 이번 diff 범위 밖 |
| INFO #4·#5 (name trim·빈 바디 방어) | **defer** — 다이얼로그 1차 방어(trim·빈 가드) + 서버 2차 검증 존재. 훅 레벨 추가 방어는 저우선 |
| INFO #6·#10·#11·#12 (invalidate 헬퍼·캐시 전략·이중 필터·내부 네이밍) | **defer(백로그)** — 단일 콘솔 경로에서 현행 적절. 향후 키 구조 변경 시 우선순위 상승 |
| INFO #7·#8·#9 (테스트 mutations.retry 명시·remount 테스트·헤더 주석) | **defer** — 저우선. retry 기본 0 이라 현재 무해 |
| side_effect reviewer 출력 누락(N/A) | 나머지 8 reviewer + 1차 리뷰(side_effect NONE)로 커버 — 재실행 불요 |

## TEST / 검증
- 1차 라운드에서 lint·unit(11/11)·e2e(214/214)·build 모두 green 확인됨. 이 라운드는 코드 무변경(spec 본문만)이라 재실행 불요.
- spec 보강(`5-admin-console.md §2.1`)은 codebase 가 아니므로 review_guard freshness·consistency Gate 2(impl-done) 에 영향 없음.
