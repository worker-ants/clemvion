# 문서화(Documentation) 리뷰

## 메모 — 이 changeset 은 이미 4라운드 리뷰를 거쳤다

`origin/main...HEAD` 는 harness 위생(plan 체크박스 blockquote 비대칭 카운팅·도구 아티팩트
태그 잔재 가드 신설·`plan-lifecycle.md` outgoing-link 절)과 `spec/conventions/error-codes.md`
`EngineErrorCode` 병기로 구성되고, 이미 코드 리뷰 4라운드(`22_25_37`→`22_44_29`→`23_09_35`→
`23_28_32`) + consistency 6라운드를 거쳤다. 매 라운드 documentation 리뷰어가 실제 결함을
찾아 고쳤고(1R: SoT 미등재 발견 후 유예 등재, 4R: 이 PR 자신의 편집이 만든 stale 줄번호
인용), RESOLUTION 은 발견의 성격이 "동작 → 구조 → 서술 정합" 으로 수렴했다고 기록한다.
이번 라운드는 그 수렴이 유지되는지, 4R 이 고친 내용이 실제로 정확히 반영됐는지를 코드를
직접 열어 독립적으로 재검증하는 데 집중했다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 어느 등급도 새로 발견되지 않음).

## 확인했으나 문제 없음 (근거 기록 — 전부 소스를 직접 열어 재검증)

- **4R 이 고친 stale 줄번호 인용이 실제로 반영·정합됐다.** 4R RESOLUTION 은
  `plan/in-progress/spec-conventions-engine-error-code-surface.md:58` 의
  `error-codes.ts:114-115` 인용을 앵커 문구(`**엔진 레이어** 에러 코드`)로 교체했다고
  주장한다. 직접 확인: 현재 그 문서에 `error-codes.ts:<숫자>` 형태의 줄번호 인용은
  **0건**(`grep`)이고, 대신 "앵커: `**엔진 레이어** 에러 코드`" 로 참조하며, 그 문자열은
  실제로 `codebase/backend/src/nodes/core/error-codes.ts:122` 에 정확히 존재한다
  (`EngineErrorCode` JSDoc 첫 줄). 인용이 코드와 어긋나지 않는다.
- **`_QUOTED`/`_CHECKBOX` 정규식 + `_all_checkboxes_done()` docstring 이 실제 동작과
  일치한다.** 비대칭 카운팅 설명("열린 항목은 인용문 안이어도 거부권" / "닫힌 항목은
  자기 것만 증거")을 코드 흐름과 대조했고, `test_plan_guard.py` 의 6개 관련 테스트
  (`test_open_checkbox_inside_blockquote_counts` 등)가 그 설명 그대로의 입출력을
  검증하고 있다. 저장소 실측치도 재현했다 — 인용문 안 **불릿 구조** 열린 체크박스는
  `grep -rnP '^\s*>[\s>]*[-*]\s+\[ \]' plan/` 로 정확히 **3건**
  (`marketplace-and-plugin-sdk.md:86-88`), 테스트 docstring 이 인용하는 수치와 일치한다.
- **`stray-tool-tags.test.ts` 의 `MIN_EXPECTED_MD_FILES` 실측 주석이 현재 저장소와
  정확히 일치한다.** 주석은 "2026-09-01 실측(archive 제외): `plan/` **505** ·
  `spec/` **386**" 이라고 적는데, `find plan -name "*.md" ! -path "*/archive/*" | wc -l`
  → **505**, `find spec -name "*.md" ! -path "*/archive/*" | wc -l` → **386** 으로
  독립 재현 일치한다. 상수 값(`plan: 250`, `spec: 190`)도 "실측의 절반 언저리" 서술과
  부합한다.
- **`spec/conventions/error-codes.md` §Overview 신규 두 문단과 `error-codes.ts` 최상단
  JSDoc 이 같은 "비대칭" 프레이밍을 쓴다** — 두 곳 모두 "`EngineErrorCode` 는 엔진만,
  `ErrorCode` 는 엔진도 쓴다" / "카탈로그의 '엔진 수준 에러' 분류와 1:1 대응하지 않는다"
  표현이 동일하다. JSDoc 이 인용하는 `spec/conventions/error-codes.md` §Overview 도
  실제 헤딩(`## Overview`)과 일치한다.
- **`EngineErrorCode` JSDoc 자체("엔진 레이어" 이분법 프레이밍)가 §Overview 의 새 "비대칭"
  프레이밍과 정확히 맞지 않는 점은 이미 인지·등재돼 있다** —
  `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 "후속(별도 planner
  턴) — 인접 문서의 선재 drift 2건" 항목이 정확히 이 지점(`error-codes.ts` 의 "엔진 레이어"
  JSDoc 프레이밍)을 지목하고 developer 트랙으로 분류해 두었다 — 새로 지적할 결함이 아니다.
- **신규 build-blocking 가드(`stray-tool-tags.test.ts`)의 SoT(`spec-impl-evidence.md
  §4.2`) 미등재는 여전히 유효한 gap 이지만, 4라운드 연속 동일 근거로 재확인된 의도적
  유예다.** `plan/in-progress/harness-review-gate-followups.md:174-181` 에 사유("이 PR
  에 spec 축이 이미 과다 번들됐다는 동일 리뷰의 다른 WARNING 과 상충")와 재개 신호("다음
  harness 가드 추가 시 함께")가 여전히 명시돼 있고, `spec/conventions/spec-impl-evidence.md`
  §4.2 는 여전히 "build 차단 4건" 이며 신규 가드가 미등재 상태임을 직접 확인했다 — 묵살이
  아니라 추적되는 상태 그대로다.
- **`review/consistency/2026/09/01/23_17_23/SUMMARY.md` INFO#2 가 인용하는
  `error-codes.ts:114-115`는 그 세션 실행 시점(23:17) 기준으로는 유효했으나, 이후 커밋
  (23:28 `fix(harness)` 3R/4R)이 같은 파일 최상단에 6줄을 더 추가하며 물리적으로 밀렸다.**
  다만 `review/**` 는 이 저장소 관례상 봉인된 시점 기록이라(RESOLUTION `22_25_37` INFO 9·
  4R 문서화 리뷰 선례) 갱신 대상이 아니다 — 살아있는 문서(`spec-conventions-engine-error-
  code-surface.md`)만 앵커로 정정하면 되고, 그것은 이미 4R 에서 완료됐다.
- **CHANGELOG.md** — 이번 changeset 은 harness/plan/spec-convention 성격이고 이 저장소의
  `fix(harness)`/`docs(harness)`/`docs(plan)`/`docs(spec)` 계열 커밋이 CHANGELOG 를
  갱신한 선례가 없다(과거 라운드에 이어 재확인). README 갱신을 요하는 신규 기능·설정도
  없다(harness 내부 정규식 확장 + 테스트 가드로, 사용자 대면 기능·환경변수 신설 없음).
- **`walkTree` 의 `bases: readonly string[]` 로의 시그니처 확장 주석**("본체는 순회만
  하고 변형하지 않으므로 넓혀도 안전, 기존 `string[]` 호출부는 전부 그대로 통과")도 4R
  RESOLUTION 이 `tsc --noEmit --strict` 로 6개 호출부 전체 호환을 직접 검증했다고 기록하고
  있고, 그 처방(호출부 대신 헬퍼 시그니처를 넓힘)은 코멘트의 근거와 일치한다.

## 요약

이번 라운드에서 독립적으로 재검증한 결과, 4라운드에 걸쳐 발견·수정된 문서화 결함(SoT
미등재 → 유예 등재, stale 줄번호 인용 → 앵커 문구 전환, 실측 오기 → 재측정·정정, 마크다운
자기중첩 강조 → 정정)이 전부 최종 코드 상태에 정확히 반영돼 있고, 관련 실측 수치(파일
개수·인용문 안 체크박스 개수)를 독립적으로 재현해도 문서·주석의 주장과 일치했다. 새로
발견된 문서화 결함은 없다. 유일하게 남은 known gap(`stray-tool-tags.test.ts` 의
`spec-impl-evidence.md` 미등재)은 근거·재개 신호가 명시된 의도적 유예 상태 그대로이며,
새로 악화되지도 방치되지도 않았다.

## 위험도

NONE
