# RESOLUTION — 그룹3 ai-review (10_07_06) — STALE-BASE 무효 + 재실행

## 근본 원인: stale diff-base
본 세션은 `--branch main` 으로 준비됐는데, **로컬 `main` ref 가 `a1ad25f6`(#549)** 로 stale 였다
(이미 머지된 #550/#551/#553 미반영). 그 결과 orchestrator 가 `main...HEAD` 를 **148파일/+7982**
거대 diff 로 생성했고, reviewer 들은 **이미 머지·리뷰 완료된 #550/#551/#553 코드 전체**를 본 PR 변경으로
오인했다.

**Ground truth** — 본 PR 의 실제 변경(`git diff origin/main...HEAD`): **6파일 / +220 / −9**
(code/http/i18n 테스트 + W14 주석 + plan 체크박스). DB_HOST_BLOCKED·INTERNAL_CODES·error-codes §4
삭제·추가는 **전혀 없음** (grep 으로 확인 — deletion 0건).

## 판정
- **Critical 1·2** (DB_HOST_BLOCKED 테스트 "삭제", INTERNAL_CODES 등재 "제거") → **FALSE POSITIVE**.
  해당 코드/테스트는 #553/#550 으로 main 에 존재하며 본 PR 이 건드리지 않는다. stale-base 가
  머지된 기능의 "부재(옛 base)" 를 본 PR 의 "삭제" 로 오판.
- **Warning 1·2·3** (LEGACY_TO_NORMALIZED, ErrorCode enum, classifyError rename) → **FP** — 전부
  #550 의 이미 머지된 내용.
- **Warning 5~9 / INFO 다수** (EXECUTION_TIMEOUT 레이어, error-codes §4 배치, 2-code §4, 1-http-request
  dry-run callout, send_email 포트 등) → **OUT OF SCOPE** — #551/#553 의 spec 이며 본 PR diff 에 없음.
  (일부는 #553 consistency 에서 이미 deferred 로 기록됨.)
- **Warning 4** (신규 dry-run 테스트가 `output._dryRun` 계약 미단언) → **GENUINE / FIXED**: 본 PR 의
  실제 신규 테스트 대상. dry-run test.each 에 `result.output._dryRun === true` +
  `wouldHaveCalled.kind === 'http_request'` 단언 추가. 72 unit green.

## 후속 조치
- 올바른 base(`origin/main`) 로 ai-review 재실행 → 후속 세션이 본 PR 의 실제 6파일 diff 만 리뷰.
  본 10_07_06 세션은 stale-base 로 **무효 처리**하며 재실행 SUMMARY 를 authoritative 로 삼는다.
- (로컬 `main` ref stale 는 환경 이슈 — 재실행은 `--range origin/main..HEAD` 로 우회.)
