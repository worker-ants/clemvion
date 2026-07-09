# RESOLUTION — 2026/07/09 20_01_04 code review (round 5, fresh)

LOW, Critical 0(5라운드 연속), WARNING 1(CHANGELOG stale). round4 WARNING 2건은 requirement 가 git show +
테스트 재실행으로 실제 반영 확인. WARNING + 사소 INFO 반영, 나머지 backlog.

## WARNING — 반영
- #1 documentation (CHANGELOG:7 stale "booting 세션 컨트롤 노출"): round2 booting 제외에 맞춰 정정
  ("streaming/awaiting 확립 후에만 노출, booting 미노출 — 세션 미확립").

## INFO — 반영
- #2 requirement: plan `spec_impact` 에 `spec/7-channel-web-chat/2-sdk.md` 추가.
- #3 documentation: use-widget catch 주석의 하드코딩 라인번호(`:289·:299`) → 구조적 서술(BOOTED 직전·openStream 직전)로 대체.

## INFO — defer (backlog/확인완료)
- #1 requirement: round4 WARNING 2건 실제 반영·테스트 확인 — 조치 불필요.
- #4 documentation: 테스트 제목 "통지 경로" 가 단언 범위보다 넓음(sendEvent spy 없음, 코드베이스 관례) — 저우선.
- #5·#6·#7 api_contract(키생략 vs null·context null 드롭·turns 크기 상한): 기존 backlog.
- #8 api_contract: gone fix 는 round4 에서 반영·테스트 완료(코드 diff 가 이번 payload 밖이라 재검증만 미수행).
- #9~#12 security: 신규 취약점 없음.

## 검증
- web-chat 279 passed. 변경은 CHANGELOG·plan frontmatter·comment 뿐(런타임 무영향).
- 반영분(문서-only) 커버 위해 최종 확인 리뷰.
