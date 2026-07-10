# 문서화(Documentation) Review

대상 커밋: `926bb1ecf` — 이전 리뷰(11_02_46) Warning 6건 + INFO 다수를 조치하는 후속 커밋. 스크립트/테스트/워크플로/`PROJECT.md`/`playwright.config.ts` 주석·문서만 대상이며, 이 커밋 자체가 "문서화 정확성" 개선을 목적으로 한다는 점에서 스스로가 문서화 리뷰의 좋은 사례이자 동시에 재검토 대상이다.

## 발견사항

- **[WARNING]** 신규 테스트 모듈 docstring이 실제 CI 트리거 범위를 부정확하게 서술
  - 위치: `.claude/tests/test_report_playwright_flaky.py` 모듈 docstring(파일 최상단, "stdlib unittest 로 harness-checks 에서 게이트한다(트리거 paths 에 `scripts/**` 포함 필수).") vs `.github/workflows/harness-checks.yml`의 실제 추가분(`- 'scripts/report_playwright_flaky.py'`)
  - 상세: docstring은 `scripts/**` 글롭이 트리거 조건이라고 서술하지만, 실제로 이 커밋(W1)이 등록한 것은 `scripts/report_playwright_flaky.py` **개별 리터럴 경로**다(같은 파일의 인라인 주석이 인용하는 `migration-check.yml`의 `scripts/check-migration-versions.py` 도 동일하게 글롭이 아닌 개별 경로 등재 방식). 즉 `scripts/` 하위에 새 스크립트가 추가돼도 `harness-checks.yml`에 개별 등재하지 않으면 여전히 트리거되지 않는데, docstring은 `scripts/**`가 이미 커버한다고 오인시켜 향후 스크립트 추가 시 "테스트 있는데 트리거 안 됨"이라는 이 커밋이 막으려던 바로 그 유형의 갭을 재발시킬 수 있다.
  - 제안: docstring 문구를 "harness-checks.yml `paths`에 **본 스크립트 경로가 개별 등재**돼야 함(신규 covered 스크립트 추가 시 각각 등재 필요)"로 정정. `scripts/**`라는 글롭 표현은 제거.

- **[INFO]** `RESOLUTION.md`가 "fix"로 표시한 INFO 10 항목이 실제 반영 내용과 부분적으로 어긋남
  - 위치: `review/code/2026/07/10/11_02_46/RESOLUTION.md`("INFO 10(`main()` docstring)") vs `scripts/report_playwright_flaky.py`의 신규 `main()` docstring
  - 상세: 원 SUMMARY.md INFO 10은 "markdown 표는 `line==0`일 때 `:line` 표기를 생략하는데(`_location`), `::warning::` 어노테이션(`_emit_annotations`)은 동일 처리 없이 `line=0`을 그대로 출력 — 두 출력 경로의 비대칭을 설명하는 주석 부재"를 지적했다. 이번에 추가된 `main()` docstring은 "항상 exit 0"이라는 별개의 불변식만 설명하고, 지적된 line==0 비대칭 자체는 이번 diff에서도 여전히 어디에도 설명되지 않는다(`_location`/`_emit_annotations` 코드 로직도 미변경). RESOLUTION.md의 "fix" 라벨이 실제 반영 범위보다 넓게 서술된 상태.
  - 제안: `_emit_annotations` 또는 `_location` 근처에 1줄 주석("markdown 은 line==0 이면 `:line` 생략, annotation 은 그대로 출력 — 의도된 비대칭") 추가. 혹은 RESOLUTION.md 문구를 "main() 독스트링만 추가, line=0 비대칭은 별도 미조치"로 정정.

- **[INFO]** 테스트 헬퍼 `_spec()`의 docstring 축약으로 파라미터 의미 설명이 소실
  - 위치: `.claude/tests/test_report_playwright_flaky.py`의 `_spec(title, status, *, file=..., line=10, retries=0)` 함수
  - 상세: 변경 전 docstring은 `status`(그 spec의 단일 test의 status)와 `retries`(results의 최대 retry 인덱스)의 의미를 명시했으나, 이번 diff에서 `"""Playwright JSON 리포트의 spec 노드 하나(단일 test)."""` 한 줄로 축약되며 두 파라미터 설명이 사라졌다. 마침 이 커밋에서 `find_flaky`의 retries 집계 범위가 "flaky test 한정"으로 더 정밀해졌는데(§`find_flaky` docstring 개선), 이를 검증하는 fixture 헬퍼의 파라미터 설명은 반대로 줄어든 비대칭이다.
  - 제안: 최소 1줄로 파라미터 의미(예: `retries`: 생성되는 단일 test 의 results 최대 retry 인덱스) 복원.

- **[INFO]** `_emit_annotations` 함수에 독스트링 부재(형제 프라이빗 헬퍼는 전부 보유)
  - 위치: `scripts/report_playwright_flaky.py`의 `_emit_annotations(flaky)`
  - 상세: 같은 모듈에서 이번 커밋으로 추가/정비된 `_safe_int`·`_max_flaky_retry`·`_load_report`·`_gha_escape`는 모두 한 줄 docstring을 갖췄는데, `_emit_annotations`만 인라인 주석(`# ::warning:: 는 job 을 실패시키지 않는다...`)만 있고 함수 docstring이 없다. 이번 커밋이 INFO 6/7/8을 통해 모듈 전반의 문서화 일관성을 끌어올린 맥락에서 사소하지만 눈에 띄는 누락.
  - 제안: 한 줄 docstring(예: "flaky 목록을 `::warning::` 어노테이션으로 stdout 에 출력한다.") 추가.

## 긍정적으로 확인된 부분 (참고)

- `PROJECT.md`에 신설된 "Playwright flaky surfacing" 절은 형식(코드블록·불릿·SoT 링크)이 인접 "문서 링크 검증" 절과 일관되고, 실제 코드 동작(항상 exit 0, 경로 3곳 정합, 배경 plan/PR 링크)과 정확히 일치함.
- `codebase/frontend/playwright.config.ts`와 `scripts/report_playwright_flaky.py` docstring의 dangling `plan/in-progress/...` 경로 참조 2곳 모두 `plan/complete/e2e-retry-visibility-followup.md`로 정확히 갱신됨(실제 파일 존재 확인).
- `harness-checks.yml`의 신규 `paths` 항목에 붙은 인라인 주석은 "cf. migration-check.yml"로 선례를 정확히 인용하며, 그 선례 역시 실제로 개별 리터럴 경로 등재 방식임(위 WARNING과 대조하면 이 주석 자체는 정확하고, 문제는 테스트 파일 쪽 docstring 표현임).
- `scripts/report_playwright_flaky.py`의 `DEFAULT_REPORT` 상수 위 신규 주석은 cross-file 정합 불변식과 이를 검증하는 테스트(`CrossFilePathGuardTest`)를 정확히 상호 참조함.
- `main()`/`_load_report`/`_safe_int`/`_max_flaky_retry`/`_gha_escape` 등 신규·개정 docstring은 각 함수의 실제 동작과 일치.
- CHANGELOG.md는 이번 변경(spec_impact: none인 CI 인프라 전용 변경)에서 손대지 않았는데, 기존 CHANGELOG 항목들이 모두 spec 영향 있는 사용자 대면 변경만 기록하는 패턴과 일치하므로 누락이 아님.

## 요약

이 커밋은 직전 리뷰가 지적한 문서화 관련 갭(harness-checks 트리거 배선 서술, dangling plan 경로, docstring 부재, PROJECT.md 미등재)을 대부분 정확하게 해소했고, 신설된 `PROJECT.md` 절과 여러 헬퍼 docstring은 실제 코드와 정확히 일치한다. 다만 그 해소 과정에서 새로 생긴 부정확성 하나(테스트 모듈 docstring이 `scripts/**` 글롭을 언급하지만 실제로는 개별 경로 등재 방식이라, 향후 신규 스크립트 추가 시 이 커밋이 막으려던 것과 같은 유형의 트리거 누락을 재유발할 소지)와, RESOLUTION.md의 "fix" 라벨이 실제 반영 범위(line=0 비대칭 미설명 잔존)보다 넓게 서술된 점, 테스트 헬퍼 docstring 축약으로 인한 정보 손실이 확인된다. 전반적으로 CRITICAL 없음, 실질 영향은 작지만 "주석 정확성"이라는 이 리뷰 관점의 핵심을 정확히 건드리는 지점이라 조치 권장.

## 위험도
LOW
