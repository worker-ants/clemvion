# 변경 범위(Scope) 리뷰 — deps-guard-hardening (5차 리뷰 조치 커밋)

## 검토 방법 메모

프롬프트에 제시된 unified diff 는 `origin/main` 대비 브랜치 누적 diff라, `scripts/check-override-floors.py` 전체(347줄)를 포함해 11개 파일 전부가 "신규(`/dev/null` 기준)"로 표시된다. 실제로 이번에 검토해야 할 실질 변경은 이 리뷰 세션이 겨냥한 최신 커밋 `68e9064d3`("fix(harness): 5차 리뷰 조치 — returncode 불변식 · overrides 키 부재 · audit timeout") 하나이므로, `git show 68e9064d3 -- scripts/check-override-floors.py` 로 그 커밋이 이 파일에 낸 실제 델타를 직접 대조했다. 또한 이 리뷰 페이로드(`meta.json`)에 포함되지 않았지만 같은 커밋에 속한 `.claude/tests/README.md`·`.claude/tests/test_override_floors.py`·`plan/in-progress/deps-guard-hardening.md` 3개 파일도 git 이력으로 확인해 더 넓은 맥락에서 스코프 이탈이 없는지 교차 검증했다(단, 이 3개 파일은 라우터가 명시적으로 리뷰 게이트 스코프 밖으로 분류한 파일이라 — 파일 10 `testing.md` 의 "스코프 메모" 참조 — 아래 발견사항의 위치 인용은 이 리뷰의 실제 페이로드 안에서만 게이트 숫자를 사용했다).

## 발견사항

- **[INFO]** 코드 변경분(`scripts/check-override-floors.py`)이 커밋 메시지가 선언한 항목과 정확히 일치 — 무관 변경 없음
  - 위치: `scripts/check-override-floors.py:70-77`(`_AUDIT_TIMEOUT_SEC` 상수 신설), `:119-134`(`load_override_targets()` 의 `overrides` 키 부재 fail-closed 분기), `:150-192`(`run_audit()` 의 `subprocess.run` timeout + `TimeoutExpired` 처리, 실제 추가분은 `:158-173`)
  - 상세: `git show 68e9064d3 -- scripts/check-override-floors.py` 로 직접 대조한 결과, 이 커밋이 이 파일에 낸 델타는 정확히 3곳뿐이다 — (1) `_AUDIT_TIMEOUT_SEC = 300` 상수와 근거 주석 신설, (2) `load_override_targets()` 에 `overrides` 키 부재 시 `_undecidable()` 을 호출하는 fail-closed 분기 추가(오타 `override:` 대비), (3) `run_audit()` 의 `subprocess.run` 호출을 `try/except subprocess.TimeoutExpired` 로 감싸고 `timeout=_AUDIT_TIMEOUT_SEC` 인자 추가. `classify_vulnerable()`/`main()`/`_report_widened()`/`_report_eroded()` 등 나머지 함수·모듈 docstring·기존 상수는 이 커밋에서 전혀 건드리지 않았다. 새 임포트도 없다(`subprocess.TimeoutExpired` 는 이미 임포트된 `subprocess` 모듈 속성 접근). 커밋 메시지가 밝힌 W1(returncode 불변식)은 테스트 스텁 쪽 문제라 프로덕션 코드에 나타나지 않는 것이 정상인데, 실제로 diff 에도 없어 서술과 실제 변경이 정확히 일치한다. 포맷팅 변경·주석 정리·리팩토링·기능 확장 성격의 추가 코드는 없다.
  - 제안: 조치 불요. 확인 목적의 긍정 기록.

- **[INFO]** 이전 라운드(03_47_10) 리뷰 산출물 10개 파일을 코드 수정과 같은 커밋에 포함한 것은 이 저장소의 기존 관례와 일치 — 스코프 이탈 아님
  - 위치: 파일 1~10 전체 (`review/code/2026/08/01/03_47_10/{SUMMARY.md,_retry_state.json,documentation.md,maintainability.md,meta.json,requirement.md,scope.md,security.md,side_effect.md,testing.md}`)
  - 상세: CLAUDE.md 는 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 를 단일 진실 저장 위치로 명시한다. 리뷰 산출물을 그 리뷰가 지적한 조치와 **같은 커밋**에 묶는 방식이 이번이 처음인지 git 이력(`git show --stat`)으로 3차·4차 라운드의 조치 커밋과 대조했다 — 3차 조치 커밋(`99f6110c0`)도 2차 라운드 산출물 10개(SUMMARY 포함)를 조치 코드와 같은 커밋에 실었다. 다만 4차 조치 커밋(`652f6cc78`)은 `SUMMARY.md` 만 별도 `docs(review)` 커밋(`1f21c9d24`)으로 분리했었는데, 이번 5차 조치는 3차와 같은 패턴(전부 한 커밋)으로 산출물 10개를 함께 실었다. 두 패턴 모두 저장소 이력에 선례가 있어 "새로운 이탈"로 보기 어렵다. `_retry_state.json`(파일 2) 내용이 `routing_status: pending`/`agents_success: []`/14개 에이전트 전부 `agents_pending` 인 점도 4차 라운드에 커밋된 동일 파일과 같은 패턴(세션 착수 시점 스냅샷을 그대로 커밋하는 하네스의 기존 설계)임을 확인했다 — 이번 커밋에서 새로 생긴 이상 동작이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 이번 리뷰 페이로드 밖의 동일 커밋 3개 파일도 git 으로 직접 대조 — 커밋 메시지가 밝힌 범위 밖의 내용 없음
  - 위치: N/A — 이 리뷰의 할당 파일 목록(`meta.json`) 밖. 파일 10(`testing.md`)의 "스코프 메모" 절이 "이 테스트 파일이 이번 라운드의 router 파일 목록에서 빠진 것은 `.claude/**` 를 코드 리뷰 게이트 스코프에서 제외하는 기존 정책과 일치"라고 명시해 라우터의 의도된 제외임을 뒷받침한다.
  - 상세: `.claude/tests/test_override_floors.py` 는 `ReturncodeInvariantTest`/`MissingOverridesKeyTest` 2개 클래스 신설(W1/W2 대응)과 `FailClosedSiteCountTest.EXPECTED_SITES` 6→8 갱신뿐이었고, `.claude/tests/README.md` 는 `test_override_floors.py` 표 행의 "Six"→"Eight" 서술 갱신 1건, `plan/in-progress/deps-guard-hardening.md` 는 체크리스트 항목(TEST WORKFLOW 5차 완료, `/ai-review` 5차 결과 요약 추가, `/ai-review` 6차 항목 신설) 갱신뿐이었다. 전부 이번 라운드가 지적한 W1/W2/INFO3 세 항목의 직접 파생물이며, `FailClosedSiteCountTest` 가 소스-문서 수치 결속을 강제하므로(코드의 `_undecidable()` 호출 지점이 6→8이 되면 이 테스트가 즉시 RED) 이 갱신은 선택이 아니라 필수 동반 변경이다. 무관한 내용은 발견되지 않았다.
  - 제안: 조치 불요. 참고 목적(이 리뷰 페이로드 밖 파일에 대한 확인 근거).

## 요약

이번 라운드(5차 리뷰 조치, 커밋 `68e9064d3`)는 직전 리뷰(`review/code/2026/08/01/03_47_10`)가 지적한 WARNING 2건(`returncode` 불변식 미검증, `overrides` 키 부재 fail-closed 누락)과 INFO 1건(audit timeout 부재)만 정확히 조치했다. `git show` 로 직접 대조한 결과 `scripts/check-override-floors.py` 에 대한 실질 변경은 3곳(타임아웃 상수+예외 처리, `overrides` 키 부재 가드)뿐이며 무관한 리팩토링·포맷팅·주석·임포트 변경은 없다. 이번 리뷰 페이로드에 포함된 10개 리뷰 산출물 파일(`review/code/2026/08/01/03_47_10/*`)은 CLAUDE.md 가 명시한 저장 위치이자 이 저장소의 반복 관례(3차·5차 라운드 모두 조치 커밋에 산출물을 함께 실음)와 일치해 스코프 이탈이 아니다. 페이로드 밖의 연관 파일 3개(테스트·README·plan)도 git 이력으로 직접 대조했으며, 코드 변경에 결속된 `FailClosedSiteCountTest` 가 강제한 수치 동반 갱신 외의 내용은 없었다. "의도 이상의 변경·불필요한 리팩토링·기능 확장·무관한 수정·포맷팅 뒤섞임·불필요한 주석/임포트 변경·의도치 않은 설정 변경" 8개 점검 관점 전부에서 위반 사항을 발견하지 못했다.

## 위험도

LOW
