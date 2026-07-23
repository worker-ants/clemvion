# 변경 범위(Scope) 리뷰 — mermaid-lint import fail-open (exit 3 분리)

## 컨텍스트 확인

`git diff origin/main...HEAD` 기준 diff 는 2개 커밋으로 구성된다.

- `66dd4c316` fix(harness): lint-mermaid import 크래시 fail-open — corrupt tree exit 3 분리 (§A-1)
- `cdcff2b2e` test(harness): §A-1 리뷰 Warning 3건 반영 + exit-3 pinning·2nd-catch 커버

두 커밋 모두 `plan/in-progress/harness-guard-followups.md` §A "10_55_35 라운드 잔여"의
**W1(10_55_35)** 항목("lint-mermaid.mjs 를 import 크래시에 fail-open 시켜라")을 그대로 구현하고,
그 직전 리뷰 라운드(`review/code/2026/07/22/10_48_43`, RISK=LOW)의 Warning 3건을 반영한다.
두 커밋 각각의 실제 diff(`git show --stat`)를 직접 대조해 prompt 페이로드 내용과 일치함을 확인했다.

## 발견사항

- **[INFO]** `.githooks/pre-commit` exit-3 안내 메시지 문구 정리(괄호 어색함 → sibling 톤 통일)
  - 위치: `.githooks/pre-commit` (두 번째 커밋)
  - 상세: 핵심 fix 와 직접 관련 없는 순수 문구(포맷) 조정처럼 보일 수 있으나, 이는 드라이브바이가
    아니라 직전 리뷰 라운드(`review/code/2026/07/22/10_48_43/documentation.md` INFO #7)가 명시적으로
    지적하고 `RESOLUTION.md` 가 "INFO 중 반영한 것"으로 못박은 항목이다. 근거가 커밋 메시지·
    RESOLUTION.md 에 투명하게 남아 있어 범위 이탈로 보지 않는다.
  - 제안: 조치 불요 (이미 사유 문서화됨).

- **[INFO]** `review/code/2026/07/22/10_48_43/*` (SUMMARY.md·RESOLUTION.md·per-agent 리포트·
  meta.json·_retry_state.json) 다수 신규 파일이 이번 diff 에 포함
  - 위치: `review/code/2026/07/22/10_48_43/` 전체 (9개 파일)
  - 상세: 코드 변경과 무관해 보이지만, 프로젝트 컨벤션(`CLAUDE.md` "review/ 는 gitignored 아님 —
    SUMMARY·RESOLUTION 도 커밋")에 따라 리뷰 산출물 자체가 커밋 대상이다. 두 번째 커밋이 그 직전
    리뷰 라운드의 Warning 반영(RESOLUTION.md)이므로 review 산출물 동봉은 관례에 부합하며 무관한
    수정이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/harness-guard-followups.md` 체크박스 `[ ]` → `[x]` 갱신 + 구현 요약 서술 추가
  - 위치: §A "10_55_35 라운드 잔여" W1(10_55_35) 항목
  - 상세: 프로젝트 컨벤션("plan 체크박스는 수행 후에만 체크하고 그 커밋에 포함")을 정확히 따른
    부수 변경이며, 이 diff 가 구현하는 항목 자체를 가리키므로 무관한 수정이 아니다.
  - 제안: 조치 불요.

## 점검 관점별 판정

1. **의도 이상의 변경**: 없음. 두 커밋 모두 하나의 plan 항목(W1)·하나의 선행 리뷰(10_48_43)에 정확히
   대응한다. 핵심 코드 변경은 `lint-mermaid.mjs` 의 두 dynamic import 를 try/catch 로 감싸 exit 3 을
   내보내고, 세 소비처(PostToolUse hook·pre-commit·plan 잔여 서술)가 그 새 exit code 를 fail-open 으로
   분류하도록 좁게 국한된다.
2. **불필요한 리팩토링**: `.githooks/pre-commit` 의 `if ! node ...; then` → `node ...; mermaid_rc=$?` 전환은
   exit 3 분기를 만들기 위해 반드시 필요한 최소 변경이며, 그 외 로직 재정렬·이름 변경은 없다.
3. **기능 확장(over-engineering)**: 없음. 새 exit code 는 정확히 "import 실패"라는 단일 신규 케이스만
   커버하며, 리뷰가 "스코프 밖"으로 판단한 `new JSDOM()` 생성자 예외·`mermaid.initialize()` 예외·시그널
   종료 등은 (RESOLUTION.md 에 명시된 대로) 손대지 않았다 — 오히려 과확장을 자제한 사례.
4. **무관한 수정**: 없음. 5개 실제 코드/훅 파일(`lint_mermaid_posttooluse.py`, 두 테스트 파일,
   `lint-mermaid.mjs`, `.githooks/pre-commit`) + 1개 plan 파일 + review 산출물만 변경됐고, 앞서 확인한
   대로 review 산출물·plan 체크박스는 컨벤션상 동반되어야 하는 것들이다.
5. **포맷팅 변경**: pre-commit 메시지 문구 정리(괄호) 1건뿐이며, 실질 로직 변경(`mermaid_rc` 분기)과
   섞여 있지 않고 별도 hunk 로 분리돼 있다. 의미 없는 공백/줄바꿈 변경은 없다.
6. **주석 변경**: 모든 신규/수정 주석이 새 exit 3 계약을 설명하는 데 직접 기여한다(Exit 코드 표 갱신,
   `_EXIT_TOOLING_BROKEN`/`EXIT_TOOLING_BROKEN` 상수 주석, 각 소비처의 fail-open 사유). 기존 무관 주석의
   삭제/수정은 없다.
7. **임포트 변경**: 신규 `import re`(테스트 내부, 지역 스코프)만 추가됐고 실제 사용된다. 사용하지 않는
   임포트 추가나 정리는 없다.
8. **설정 변경**: `.githooks/pre-commit` 은 셸 훅이지 설정 파일이 아니며, 그 변경도 exit 3 분기
   추가/문구 정리에 국한된다. CI/설정 파일(`package.json`, `settings.json` 등) 변경은 없다.

## 요약

두 커밋 모두 사전에 문서화된 단일 defer 항목(§A W1(10_55_35))과 그 항목에 대한 선행 리뷰 라운드의
Warning 3건을 정확히, 좁게 구현한다. 핵심 로직 변경은 5개 파일에 한정되고, 나머지(plan 체크박스·review
산출물)는 프로젝트가 명시적으로 요구하는 동반 변경이다. 리뷰가 "스코프 밖"이라 판단한 인접 결함(JSDOM
생성자 예외 등)은 실제로 손대지 않고 RESOLUTION.md 에 사유와 함께 defer 되어 있어, over-engineering 이나
의도 이상의 확장이 없음을 뒷받침한다. 드라이브바이 포맷팅·무관한 리팩토링·불필요한 주석/임포트/설정
변경도 발견되지 않았다.

## 위험도

NONE
