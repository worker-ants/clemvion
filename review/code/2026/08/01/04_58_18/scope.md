# 변경 범위(Scope) 리뷰 — deps-guard-hardening (8차 라운드)

## 검토 방법

프롬프트 페이로드는 31개 파일이지만 대부분(1~30번)이 `origin/main` 대비 누적 diff라 5·6·7차
`/ai-review` 세션 산출물이 다시 "신규 파일"로 표시된다. 이는 1~7차 scope 리뷰가 이미 여러 번
검증·확정한 상태이므로, 이번 라운드는 (1) 직전 7차 리뷰(`review/code/2026/08/01/04_35_33`) 이후
**실제로 새로 생긴 델타**(`git log --oneline origin/main..HEAD` 최신 커밋 `fdc7ad801` "7차 리뷰
조치")에 집중하고, (2) 브랜치 전체 누적 diff(`git diff origin/main..HEAD --stat`, 81개 파일)가
여전히 무관 영역을 건드리지 않는지 재확인하고, (3) `scripts/check-override-floors.py`(364줄)
전체를 직접 `Read`해 plan 문서와의 정합을 독립적으로 재검증했다.

## 발견사항

- **[INFO]** 8차 라운드의 실질 델타(커밋 `fdc7ad801`)는 7차 리뷰(`04_35_33`)가 지적한 Warning 2건
  + INFO 1건에 정확히 국한된다 — 무관 변경 없음
  - 위치: `scripts/check-override-floors.py:142-145`(YAML 진단 메시지 `sorted(data, key=str)`),
    `.claude/tests/test_override_floors.py:390-422`(`WidenedFilterTest` 신설),
    `plan/in-progress/deps-guard-hardening.md:110,113,177-184`(테스트 수치·체크리스트 갱신)
  - 상세: `git show fdc7ad801`로 직접 대조한 결과 `scripts/check-override-floors.py`에 대한
    변경은 정확히 1곳(`sorted(data)` → `sorted(data, key=str)` + 3줄 근거 주석)뿐이며, 이는
    7차 라운드 testing 리뷰(`04_35_33/testing.md`)가 실측(무수정 프로브로 `TypeError` 재현)한
    INFO 11 항목과 정확히 일치한다. `classify_vulnerable()`/`main()`/`run_audit()`/
    `_report_widened()`/`_report_eroded()`/`chain_segments()`/`override_target()` 등 나머지
    함수는 이 커밋에서 한 줄도 바뀌지 않았다. 새 임포트도 없다. 7차 Warning 2건(override
    미관리 모듈 스킵 가드·`EXPECTED_SUPPRESSED_PATHS` 기본값 가드가 어떤 테스트로도 검증되지
    않음)은 둘 다 **기존 코드는 정확했고 테스트 커버리지만 없던 것**이라(7차 리뷰어들이
    프로덕션 코드가 아닌 뮤턴트 주입으로 갭을 실증), 프로덕션 코드 변경 없이
    `WidenedFilterTest`(`test_unmanaged_module_is_not_widened`,
    `test_managed_module_absent_from_baseline_always_widens`) 신설만으로 조치한 것이 적절한
    최소 대응이다. `EXPECTED_SITES`(9)·"아홉"·"Nine" 수치는 이번 라운드에 새 fail-closed
    분기가 추가되지 않아 그대로 유지되며, 실제로 `grep -c "_undecidable("`(정의부 제외)로
    9곳임을 직접 재확인해 코드-문서 정합이 유지됨을 확인했다. plan 체크리스트의 "40건"도
    `grep -c "def test_"`로 직접 세어 정확히 일치함을 확인했다(테스트 클래스
    `WidenedFilterTest` 추가로 38→40).
  - 제안: 조치 불요.

- **[INFO]** 리뷰 산출물 동봉 관례가 8회 연속 동일 패턴으로 유지됨 — 새로운 이탈 아님
  - 위치: `review/code/2026/08/01/04_35_33/*`(10개 파일, 커밋 `fdc7ad801`에 동봉)
  - 상세: 1~7차 scope 리뷰(`01_56_46`, `02_38_45`, `03_16_51`, `03_47_10`, `04_09_43`,
    `04_35_33`)가 이미 "코드 수정과 직전 라운드 리뷰 산출물을 같은 커밋에 묶는 것"을 저장소
    확립 관례(CLAUDE.md의 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 저장 규약과 일치)로
    반복 확인한 바 있다. `fdc7ad801`도 동일 패턴(`04_35_33/` 10개 파일 + 코드 수정 1건)을
    따른다 — 새로운 위반이 아니다. 이번 세션 자신의 산출물 디렉터리
    (`review/code/2026/08/01/04_58_18/`)는 아직 미커밋 상태(`git status` 확인)라 이 리뷰가
    검토 중인 diff 안에 없다.
  - 제안: 조치 불요, 참고 기록.

- **[INFO]** 브랜치 전체 누적 diff(81개 파일, `origin/main..HEAD`)가 이번 커밋 추가 후에도
  무관 영역을 건드리지 않음 — 독립 재확인
  - 위치: N/A — `git diff origin/main..HEAD --name-only`의 top-level 디렉터리 재집계
  - 상세: 직접 재집계한 결과 이 브랜치가 건드린 최상위 경로는
    `.claude/tests/**`·`.github/dependabot.yml`·`.github/workflows/**`·`PROJECT.md`·
    `plan/in-progress/**`·`pnpm-workspace.yaml`·`review/code/**`·`scripts/check-override-floors.py`
    뿐이다. `codebase/**`(frontend/backend/packages/channel-web-chat) 등 애플리케이션 코드
    영역은 전혀 없다 — 7차 scope 리뷰(`04_35_33/scope.md`)의 동일 결론이 8차 커밋 추가 후에도
    그대로 유지됨을 독립적으로 재확인했다.
  - 제안: 조치 불요.

## 범위 내 확인 사항 (문제 없음)

- **임포트 변경 없음**: 이번 델타는 신규/제거 임포트가 없다(기존 `sorted` 내장 함수 재사용).
- **포맷팅과 뒤섞인 실질 변경 없음**: `git show fdc7ad801 -- scripts/check-override-floors.py`
  기준 공백/줄바꿈만의 변경은 없다(1줄 제거 + 3줄 추가, 전부 의미 있는 변경).
- **주석 변경은 수정 코드에 직결**: `:143-144`의 신규 3줄 주석은 바로 아래 `key=str` 수정의
  근거(PyYAML 1.1 리졸버가 `on`/`yes`/`no`를 불리언으로 해석)를 설명하며, 이 파일의 기존
  "왜 이렇게 짰는가" 주석 관례와 일치한다. 무관한 주석 추가/삭제 없음.
- **설정 변경 없음**: 이번 델타(`fdc7ad801`)에는 `.yml`/`pnpm-workspace.yaml` 등 설정 파일이
  없다.
- **기능 확장(over-engineering) 없음**: `WidenedFilterTest`는 기존 `widened` 계산 루프
  (`main()` 288~298행)의 두 조건을 각각 검증하는 테스트 2건일 뿐, 새 CLI 옵션·설정 인터페이스·
  범용화 시도가 없다.
- **`eroded`/`widened` 2축 설계**: plan 문서("개발 중 실측으로 드러난 것" 절, `:211-218`)에
  근거가 명시돼 있고 1~7차 리뷰가 반복 확인한 대로 범위 이탈이 아니다 — 이번 라운드에서도
  해당 코드(`main()` 274~319행)는 미변경.

## 요약

8차 라운드가 검토하는 실질 델타(커밋 `fdc7ad801`)는 직전 7차 리뷰가 지적한 Warning 2건(모두
기존 정상 코드의 테스트 커버리지 부재)과 INFO 1건(`sorted()` TypeError)에 정확히 국한된다.
`git show`로 직접 대조한 결과 프로덕션 코드 변경은 진단 메시지 조립부 1곳(3줄)뿐이고, 두
Warning은 프로덕션 코드가 아니라 전용 테스트(`WidenedFilterTest`) 신설만으로 적절히 조치됐다 —
코드가 이미 옳았으므로 이는 과소 대응이 아니라 정확한 대응이다. 리뷰 산출물 동봉·plan 체크리스트
갱신은 8회 연속 동일한 저장소 확립 관례를 그대로 따른다. 브랜치 전체 누적 diff(81개 파일)를
독립 재집계한 결과 `codebase/**` 등 애플리케이션 코드 영역 변경은 여전히 전무하며, 무관한 파일·
포맷팅·불필요한 주석·임포트·설정 변경은 발견되지 않았다.

## 위험도

LOW — Critical 0, Warning 0. 8회 연속 scope 관점에서 위반 없음.
