# 변경 범위(Scope) 리뷰 — deps-guard-hardening (11차 라운드, `08_20_09`)

## 검토 방법

프롬프트 페이로드 14개 파일(리뷰 산출물 12개 + `scripts/check-override-floors.py` +
`scripts/check-pnpm-security-config.py`)은 `origin/main` 대비 누적 diff라 대부분 "신규"로
표시된다. 이번 라운드가 실제로 새로 검토해야 할 델타를 가려내기 위해 `git log`/`git show
f71be98d8`(HEAD, "축 3(ignoreCves 억제분 추적) 철회 + stale ignoreCves 2건 제거")로 직전
10차 라운드(`06_03_11`) 종료 시점 이후의 신규 커밋을 직접 대조했고, `plan/in-progress/
deps-guard-hardening.md`(§1 원문·"개발 중 실측으로 드러난 것"·"축 3 철회" 3개 절)로 승인된
스코프와 이번 델타의 정합성을 확인했다. 라이브 코드·설정·문서에 제거 대상 심볼의 잔존 참조가
있는지 `grep -rn`으로 전수 확인했다.

## 발견사항

- **[INFO]** 이번 라운드 실질 델타(커밋 `f71be98d8`, 17개 파일)는 직전 10차 리뷰의 CRITICAL
  2건에 정확히 수렴한다 — 다만 리뷰어가 제안한 수정(코드 유지 + `action.get("module")` 우선
  폴백)이 아니라 메커니즘 자체를 제거하는 대안 경로를 택했다.
  - 위치: `scripts/check-override-floors.py:220-249`(`classify_vulnerable()`, `actions[]`
    전체 미소비로 전환), `plan/in-progress/deps-guard-hardening.md:294`("## 축 3 철회" 절)
  - 상세: `widened`/`EXPECTED_SUPPRESSED_PATHS`/`_report_widened` 제거는 10차 CRITICAL
    #2("항상 발동 불가능한 죽은 코드")에 대한 응답이고, `classify_vulnerable()`이 `actions[]`를
    더 이상 전혀 읽지 않도록 바뀐 것은 10차 CRITICAL #1(정상 `"action":"update"` 응답을
    스키마 드리프트로 오판하던 경로 자체가 사라짐)도 함께 해소한다. 커밋 메시지와 plan
    §축 3 철회 절이 리뷰어 제안과 다른 경로를 택한 근거(lockfile×ignoreCves 2×2 실측 —
    `brace-expansion@2.1.4`를 실제로 lockfile 에 고정한 상태 포함 — 4칸 전부 0건)를 명시적으로
    남겼고 "사용자 결정"이라고 밝혀 자동화 단독 판단이 아님을 기록했다. `grep -rn
    "EXPECTED_SUPPRESSED_PATHS|_report_widened|WidenedFilterTest|SuppressedPathBaselineTest|
    CombinedReportTest"`를 `scripts/`·`.claude/tests/`·`pnpm-workspace.yaml`·`PROJECT.md`
    전체에 실행한 결과 0건 — 리뷰 산출물(과거 시점 스냅샷) 밖에는 잔존 참조가 없어 제거가
    완전하다.
  - 제안: 없음(기록 목적).

- **[INFO]**(긍정 관측) `pnpm-workspace.yaml`의 `auditConfig.ignoreCves` 공백화와
  `scripts/check-pnpm-security-config.py`의 `EXPECTED_IGNORED_CVES` 공백화가 같은 커밋에
  함께 반영돼, 이 저장소의 2-place 편집 규약(설정 변경 시 스냅샷 baseline 동반 갱신)을
  정확히 따른다.
  - 위치: `scripts/check-pnpm-security-config.py:75-78`(`EXPECTED_IGNORED_CVES: set[str] =
    set()`), `pnpm-workspace.yaml`의 `auditConfig.ignoreCves` 블록
  - 상세: 두 값 모두 축-3 조사 과정에서 발견된 "stale" 근거(`CVE-2026-53550`은 override 가
    gray-matter 경로를 이미 해소, `CVE-2026-14257`은 advisory 매칭 조건이 상류에서 좁아짐)가
    커밋 메시지·workspace 주석·plan 문서 3곳에 일관되게 기록돼 있다. `pnpm-workspace.yaml`의
    `overrides` 섹션(핀 값) 자체는 이번 커밋에서 손대지 않아, 무관한 핀 완화·추가가 섞여
    있지 않음을 대조 확인했다.
  - 제안: 없음.

- **[INFO]**(긍정 관측) 테스트·문서 변경은 전부 코드 축소의 직접 결과이거나 10차
  WARNING #2 수정이며, 무관한 테스트 추가/삭제가 섞여 있지 않다.
  - 위치: `.claude/tests/test_override_floors.py`(`CombinedReportTest`·`WidenedFilterTest`·
    `SuppressedPathBaselineTest` 3클래스 삭제, `SchemaDriftTest` 내 `actions` 축 서브테스트
    3건 삭제, `FailClosedSiteCountTest.EXPECTED_SITES` 11→10 + `test_readme_count_matches_
    source` 신규), `.claude/tests/README.md`(카탈로그 행 갱신)
  - 상세: plan 체크리스트의 회귀 테스트 수치가 "45건"에서 "38건"으로 갱신됐고(7건 감소),
    제거된 서브테스트 개수(2+2+1+2=7)와 정확히 일치한다. 신규 `test_readme_count_matches_
    source`는 10차 WARNING #2("`FailClosedSiteCountTest`가 README 를 검증한다고 주장만 하고
    실제로 읽지 않음")를 정확히 겨냥한다 — 이번 스코프와 무관한 신규 기능이 아니라 직전
    라운드가 지적한 결함의 수정이다.
  - 제안: 없음.

- **[INFO]**(긍정 관측) 함께 커밋된 리뷰 산출물 11개(`review/code/2026/08/01/06_03_11/*`)는
  10차 라운드 세션 파일만 정확히 번들됐다 — 8→9차 사이 있었던 "엉뚱한 커밋에 타 세션 산출물
  혼입"(커밋 `f46c560e9`) 패턴의 재발이 없다.
  - 위치: `review/code/2026/08/01/06_03_11/` 전체(`SUMMARY.md`·`_retry_state.json`·
    `documentation.md`·`maintainability.md`·`meta.json`·`requirement.md`·`scope.md`·
    `security.md`·`side_effect.md`·`testing.md`·`user_guide_sync.md`)
  - 상세: `git show --stat f71be98d8`로 대조한 결과 이 커밋에 포함된 `review/code/**` 경로는
    전부 `06_03_11/` 하위이며 다른 타임스탬프 디렉터리 파일은 없다. `performance`·
    `architecture`·`dependency`·`database`·`concurrency`·`api_contract` 6개 에이전트 파일이
    없는 것도 10차 라우터가 그 6명을 명시적으로 "제외"했기 때문(`SUMMARY.md`의 "라우터 결정"
    표와 일치)이지 누락이 아니다. `_retry_state.json`/`meta.json` 동반 커밋도 1~10차 세션
    전부와 동일한 기존 관례(`git ls-tree`로 03_47_10~05_36_28 전 세션 대조 확인).
  - 제안: 없음.

- **[INFO]**(carried, 10차와 동일 관측 반복) 이번 라운드 페이로드(14개 파일)는 이 브랜치의
  `origin/main` 대비 누적 diff(review 제외 13개 파일)의 부분집합이다.
  - 위치: 프롬프트 "## 리뷰 대상 파일" 목록 자체
  - 상세: `.github/workflows/deps-security-checks.yml`·`.github/workflows/harness-checks.
    yml`·`.github/dependabot.yml`·`PROJECT.md`는 이번 스코프 판정 대상 밖이다. 다만 이번
    커밋(`f71be98d8`)이 그 4개 파일 중 어느 것도 변경하지 않았으므로(diffstat 확인) 이는
    스코프 위반 신호가 아니라 라우터 페이로드가 브랜치 diff 전체를 반영하지 않는다는, 10차
    scope 리뷰가 이미 기록한 사실의 반복이다. `.claude/tests/test_override_floors.py`와
    `README.md`는 이번 커밋에서 실제로 변경됐음에도(`.claude/**` 제외 정책) 이번 라운드
    페이로드에도 여전히 빠져 있다 — 10개 라운드 전부가 공유하는 라우터 정책과 일치. plan
    체크리스트의 "TEST WORKFLOW(11차)·`/ai-review` 11차·RESOLUTION 최종·push+PR" 항목이
    아직 미완료라 최종 push 전 스코프 확인 기회는 남아 있다.
  - 제안: 조치 불요(기록 목적) — 최종 push 전 위 4개 비-`.claude` 파일을 포함한 스코프
    확인을 권장(10차와 동일 권고 유지).

- **[INFO]**(긍정 관측, §1 원 계획과의 대조) 이번 제거는 원래 승인된 §1 스코프의 축소
  이탈이 아니라, 구현 중 파생됐다가 반증된 부가 축을 원 스코프로 되돌리는 정정이다.
  - 위치: `plan/in-progress/deps-guard-hardening.md:16`("## 1. 오버라이드 바닥이 조용히
    낮아지는 것을 검출한다 (P1)" 원문), `:222`("## 개발 중 실측으로 드러난 것" 절)
  - 상세: plan 착수 시 §1의 확정 인도물은 "오버라이드 하한 < 알려진 패치 하한" 단일 축
    검출이었다. `widened`/`EXPECTED_SUPPRESSED_PATHS`(`ignoreCves` 재유입 추적)는 그
    확정 인도물이 아니라 "개발 중 실측으로 드러난 것" 절에서 구현 도중 파생된 부가 축이었다
    — 즉 애초에 사용자가 승인한 §1 스코프 밖에서 자체적으로 넓어졌던 것이, 이번에 실측으로
    반증되며 원래 스코프로 좁혀진 것이다. `main()`의 최종 형태(존재 확인 →
    `load_override_targets` → `run_audit` → `classify_vulnerable` → `eroded` 계산 → 보고,
    분기 3개→2개)도 §1 원문의 "침식 분류" 단일 관심사와 정확히 일치한다.
  - 제안: 없음.

## 요약

이번 11차 라운드의 실질 델타는 단일 커밋 `f71be98d8`이며, 그 전체가 직전 10차 리뷰의
CRITICAL 2건(actions[] 스키마 오판·widened 억제탐지 사문화)에 대한 응답으로 정확히
수렴한다. 리뷰어의 제안(모듈 필드 폴백/재설계)을 그대로 따르지 않고 개발자가 독자적인
2×2 실측(`brace-expansion@2.1.4`를 lockfile 에 실제로 고정한 상태 포함, 4칸 전부 0건)으로
"발동할 재료 자체가 없다"를 확인한 뒤 메커니즘 자체를 제거하는 대안 경로를 택했으며, 이
판단 근거는 커밋 메시지·plan §축 3 철회 절·workspace 주석 3곳에 일관되게 기록돼 있고
"사용자 결정"으로 명시돼 자동화 단독 판단이 아님을 남겼다. 제거는 완전하다(grep 전수 확인
결과 라이브 코드·설정·문서 어디에도 잔존 참조가 없다). 동반된 `pnpm-workspace.yaml`/
`check-pnpm-security-config.py` 변경(`ignoreCves` 2건 비움)은 같은 조사에서 발견된
"stale" 사실에 대한 2-place 편집 규약의 정확한 적용이고, 테스트/README 변경은 코드 축소와
10차 WARNING #2 수정의 직접 결과다(45건→38건, 감소분 7건이 제거된 서브테스트 개수와
정확히 일치). 함께 커밋된 리뷰 산출물 11개는 10차 세션 파일만 정확히 번들돼 과거 라운드가
겪은 "타 라운드 산출물 혼입" 재발이 없다. `codebase/**`·`spec/**`·CI 워크플로·`overrides`
핀 값 등 무관 영역 접촉, 포맷팅 전용 변경, 불필요한 임포트/주석 정리는 발견되지 않았다.
plan 원문과 대조한 결과 이번 제거는 §1 승인 스코프의 이탈이 아니라 구현 중 파생됐던 부가
축을 원 스코프로 되돌리는 정정이다. 유일한 기록 사항은 10차부터 이어지는 "페이로드가 브랜치
diff 부분집합" INFO — 이번 커밋이 그 파일들(workflows·dependabot·PROJECT.md)을 건드리지
않았으므로 스코프 위반은 아니며, push 전 최종 확인 권고를 유지한다.

## 위험도

NONE — Critical·Warning 없음. 이번 라운드의 실질 변경은 plan 문서(`deps-guard-hardening.md`
§1)의 승인된 스코프와 직전 라운드 CRITICAL 조치 요구에 정확히 국한되며, 대안 경로(수정 대신
제거) 선택도 실측 근거와 함께 문서화돼 임의 판단이 아니다. 리뷰 산출물 번들링도 10개 라운드
전부가 공유하는 정규 관례를 따른다. 유일한 기록 사항(페이로드가 브랜치 전체 diff의 부분집합)은
코드 변경 자체의 문제가 아니라 라우터 커버리지 한계이며 10차부터 반복 확인된 사실이다.
