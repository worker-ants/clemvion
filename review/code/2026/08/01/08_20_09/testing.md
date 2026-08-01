# 테스트(Testing) 리뷰 — deps-guard-hardening (11차 라운드, `08_20_09`)

## 스코프 메모

router 가 넘긴 14개 파일 중 실제 프로덕션 코드는 2개뿐이다: `scripts/check-override-floors.py`
(현재 303줄)와 `scripts/check-pnpm-security-config.py`(149줄). 나머지 12개
(`review/code/2026/08/01/05_36_28/testing.md`, `review/code/2026/08/01/06_03_11/*.{md,json}`)는
9~10차 라운드의 리뷰 산출물(정적 markdown/JSON)이 신규 파일로 저장소에 편입되며 diff 에 잡힌
것이다 — 실행되는 코드가 아니라 커버리지·mock·격리 같은 테스트 관점이 적용되지 않는다
(9~10차 testing.md 와 동일 판단, 발견사항 없음).

`git log`/`git show f71be98d8`로 대조한 결과 이번 라운드의 실질 신규 델타는 단일 커밋
`f71be98d8`("축 3(ignoreCves 억제분 추적) 철회 + stale ignoreCves 2건 제거")이며, 직전
10차 리뷰(`06_03_11`)의 CRITICAL 2건과 WARNING #2(README 검증 미실장)에 대한 응답이다.
`.claude/tests/test_override_floors.py`는 이번 라운드도 router 파일 목록 밖이지만(`.claude/**`
제외 정책 — 10개 라운드 전부 동일 판단), `Read`/`Grep`으로 직접 열어 확인했다. 아래 발견사항은
전부 **실제 뮤턴트 주입(README.md·pnpm-workspace.yaml) + `cp` 백업 원복** 또는 **실측 payload
직접 재현**으로 검증했으며, 매번 `git status --porcelain`/`git diff --stat`로 클린 복원을
재확인했다. 실 pnpm registry 재현(직전 10차 requirement 리뷰가 CRITICAL 2건을 발견한 방식)은
이번 라운드에는 재수행하지 않았다 — 개발자가 커밋 메시지·plan 문서에 이미 동등한 2×2 실측
결과를 투명하게 남겼고, 네트워크·lockfile 변경을 요구하는 그 검증 축은 testing 보다는
requirement 리뷰어의 영역이라고 판단했다. 대신 그 실측이 남긴 **정확한 payload 형태**를 재구성해
현재 코드가 그것을 올바르게 처리하는지는 직접 검증했다(아래 두 번째 INFO).

## 발견사항

- **[WARNING]** (carried, 미해결) `run_audit()`/`classify_vulnerable()`가 여전히 `actions`/
  `advisories` 최상위 컨테이너의 **존재만** 검증하고 **타입**은 검증하지 않는다 — 리스트/딕셔너리가
  아닌 값이 오면 `AttributeError`로 크래시해 exit 1(이 스크립트 어휘로 "침식 발견")이 된다. 이
  시나리오를 겨냥한 테스트가 스위트에 없다.
  - 위치: `scripts/check-override-floors.py:210`(`if not isinstance(data, dict) or "actions" not
    in data:` — 존재만 확인, 타입 미확인), `:230,233`(`classify_vulnerable()`의 `advisories =
    audit.get("advisories") or {}` → `for name, adv in advisories.items():`). 테스트 부재 확인:
    `.claude/tests/test_override_floors.py` 전체에 컨테이너 타입 불일치 케이스(`raw_stdout=`으로
    `advisories`를 list 로 주입 등)가 0건.
  - 상세: 06_03_11 라운드 requirement 리뷰가 이미 이 경로를 WARNING #1로 지적했고(뮤턴트로
    `actions`를 dict, `advisories`를 list 로 바꿔 `AttributeError` 재현), 이번 라운드 커밋
    (`f71be98d8`)은 axis-3 철회와 README 수정에만 집중해 이 부분은 손대지 않았다. 직접
    재현해 여전히 살아있음을 확인했다:
    ```
    r = run_with_stub_audit(
        advisories={}, overrides='overrides:\n  liquidjs: ^10.27.1\n',
        raw_stdout='{"actions": [], "advisories": [{"module_name": "liquidjs"}]}',
    )
    # 결과: returncode=1, stderr에 raw Traceback
    #   AttributeError: 'list' object has no attribute 'items'
    ```
    `returncode=1` + raw Traceback — 이 스크립트가 명시적으로 피하려는 정확한 실패 형태다(exit
    1은 이 스크립트 어휘로 "침식 발견"이라 실행 실패가 정상 발견 신호와 같은 코드가 된다).
    `run_with_stub_audit()` 헬퍼는 `json.dumps({"advisories": advisories, ...})`로 `advisories`
    타입을 dict 로 구조적으로 강제해 이 형태를 정상 인자로는 표현할 수 없고, `raw_stdout=`
    우회 경로를 쓴 테스트도 이 시나리오엔 없다. 이번 라운드가 `classify_vulnerable()`의
    시그니처(`tuple[dict[str,str], dict[str,list[str]]]` → `dict[str,str]`)와 내부 로직을
    직접 건드렸음에도 이 갭은 재검토 없이 이월됐다.
  - 제안: `FailClosedTest`(또는 인접 클래스)에 `raw_stdout=`을 이용해 `{"actions": {}, ...}`
    (actions가 list 아닌 dict)와 `{"actions": [], "advisories": [...]}`(advisories가 dict 아닌
    list) 두 케이스를 추가하고, `run_audit()`/`classify_vulnerable()`에
    `isinstance(actions, list)`/`isinstance(advisories, dict)` 가드를 넣어 `_undecidable()`로
    fail-closed 처리할 것(06_03_11 requirement.md 제안과 동일 — 아직 미채택).

- **[INFO]** (긍정, mutation 으로 직접 검증) 신규 `test_readme_count_matches_source`가 실제로
  README 수치 drift 를 잡는다 — 직전 라운드가 지적한 "assertion 메시지만 주장하고 실제로는 안
  읽는다" WARNING 이 진짜로 해소됐다.
  - 위치: `.claude/tests/test_override_floors.py:537`(`EXPECTED_SITES = 10`), `:551-572`
    (`test_readme_count_matches_source`)
  - 상세: `.claude/tests/README.md`의 `test_override_floors.py` 카탈로그 행에서
    `"**Ten** sites exit 2"`를 `"**Nine** sites exit 2"`로 직접 뮤턴트 →
    `FailClosedSiteCountTest` 2건 중 `test_readme_count_matches_source`**만** 정확히 FAIL
    (`test_docstring_count_matches_source`는 GREEN 유지 — 두 테스트가 소스/README 두 축을
    독립적으로 겨냥함도 함께 확인), 원복 후 `git status --porcelain`/`git diff --stat`로 클린
    복원과 재-GREEN 을 재확인했다. 06_03_11 테스트 리뷰·SUMMARY.md WARNING #2가 뮤턴트로
    반증했던 바로 그 gap이 이번 라운드에 정확히 닫혔다.
  - 제안: 조치 불요. 검증 기록 목적.

- **[INFO]** (긍정, 실측 재현) axis-3(`widened`/`EXPECTED_SUPPRESSED_PATHS`/`_report_widened`)
  삭제가 깨끗하고(댕글링 참조 0건), 부수 효과로 직전 라운드 CRITICAL #1(스키마 드리프트 오판)도
  실제로 해소됨을 실측 payload 로 직접 재현해 확인했다.
  - 위치: `scripts/check-override-floors.py:220-249`(`classify_vulnerable()`, `actions[]`
    미소비로 축소, docstring `:223-228`), `:252-280`(`main()`, widened 계산 부재)
  - 상세: `grep -n "widened\|EXPECTED_SUPPRESSED_PATHS\|suppressed\|_report_widened"
    scripts/check-override-floors.py .claude/tests/test_override_floors.py` 0건 — 프로덕션
    코드·테스트 양쪽에서 완전히 제거됨을 직접 확인. 이어서 직전 라운드 CRITICAL #1이 실측한
    정확한 payload(liquidjs 의 `"action":"update"`, `module:null`, `target:null`, `advisories`는
    정상 파싱)를 `run_with_stub_audit()`으로 재구성해 직접 실행했다:
    ```
    r = run_with_stub_audit(
        advisories={"1124277": {"module_name": "liquidjs",
                     "github_advisory_id": "GHSA-g357-x5c3-c72p", "patched_versions": ">=10.27.1"}},
        overrides="overrides:\n  liquidjs: ^10.27.1\n",
        actions=[{"action": "update", "resolves": [{"id": 1124277, "path": "...>liquidjs"}],
                  "module": None, "target": None, "depth": 3}],
    )
    # 결과: returncode=1, "ERROR: override 바닥이 낡아 취약 버전이 다시 해소됐다." (침식 정상 보고)
    ```
    `returncode=1` + 깨끗한 "override 바닥이 낡아..." 침식 보고 — 이전의 "스키마가 바뀐 것 같다"
    오판 exit 2 메시지가 아니다. `classify_vulnerable()`이 이제 `actions[]`를 전혀 읽지 않으므로
    이 오판 경로 자체가 구조적으로 존재하지 않는다.
  - 제안: 조치 불요. 검증 기록 목적.

- **[INFO]** (긍정) fail-closed 지점 개수 축소(11→10)가 정확하고, 남은 10곳 전부 최소 1개의
  전담 테스트로 커버되며, 테스트 총계 45→38(-7) 감소가 제거된 서브테스트 개수와 정확히
  일치한다.
  - 위치: `scripts/check-override-floors.py`의 `_undecidable(` 호출 10곳
    (`:110,134,142,189,194,201,209,212,244,254`), `.claude/tests/test_override_floors.py:537`
    (`EXPECTED_SITES = 10`)
  - 상세: `src.count("_undecidable(") - src.count("def _undecidable(")`로 직접 세어 10을
    확인(`EXPECTED_SITES`와 일치). 10곳을 개별 대조한 결과 전부 전담 테스트가 있다(예:
    `:110`→`test_whitespace_in_extracted_target_is_undecidable`, `:244`→
    `test_advisories_without_module_name_is_undecidable`, `:254`→
    `test_missing_workspace_file_is_undecidable` 등, 미커버 지점 0개). 전체 스위트 재실행 결과
    38/38 GREEN(`python3 -m unittest discover -s .claude/tests -p 'test_override_floors.py'`).
    삭제된 서브테스트(`CombinedReportTest` 1건, `SchemaDriftTest`의 actions 축 3건,
    `WidenedFilterTest` 2건, `SuppressedPathBaselineTest` 2건 = 8건) − 신규 1건
    (`test_readme_count_matches_source`) = 순감소 7건, 45−7=38과 정확히 일치.
  - 제안: 조치 불요.

- **[INFO]** `classify_vulnerable()`가 이번 라운드에 시그니처(`tuple[dict,dict]` →
  `dict[str,str]`)와 내부 로직이 바뀌었는데도 여전히 직접 단위 테스트가 없다 — subprocess 를
  통한 통합 테스트(`run_with_stub_audit()`)로만 도달 가능하다.
  - 위치: `scripts/check-override-floors.py:220`(`def classify_vulnerable`)
  - 상세: `grep -n "classify_vulnerable" .claude/tests/test_override_floors.py` — 매치 0건
    (정의부 문자열조차 등장하지 않음, 즉 `mod.classify_vulnerable()` 직접 호출 0건). 같은
    파일의 `override_target()`/`load_override_targets()`는 `_load_module()`로 로드해 직접
    호출하는 빠른 in-process 단위 테스트가 있는 반면(`OverrideTargetExtractionTest`,
    `WorkspaceReadFailureTest`), `run_audit()`/`classify_vulnerable()`는 여전히 매 케이스마다
    전체 서브프로세스 기동(`run_with_stub_audit()`)이 필요하다. 06_03_11 maintainability
    리뷰가 이미 관찰한 사실(carried)이고, 이번 델타가 함수 내부를 크게 단순화했음에도 테스트
    전략은 갱신되지 않았다.
  - 제안: 급하지 않음. `classify_vulnerable(audit: dict)`는 순수 함수라 `_load_module()`
    패턴으로 직접 단위 테스트 가능하다 — `AuditTimeoutTest`가 이미 쓰는 in-process 패턴을
    재사용하면 서브프로세스 기동 없이 더 빠르게 축 2를 검증할 수 있다.

- **[INFO]** (forward-looking) 이번에 실측된 CRITICAL #1 촉발 payload 형태(`"action":"update"`,
  `module:null`)를 회귀 fixture 로 남겨두지 않았다 — 코드 삭제로 현재는 안전하지만, `actions[]`
  소비 로직이 향후 재도입되면 같은 실수가 무방비로 재발할 수 있다.
  - 위치: `.claude/tests/test_override_floors.py`(전체 — 해당 payload 형태를 담은 fixture
    없음), 참고 `plan/in-progress/deps-guard-hardening.md:328`("교훈" 절)
  - 상세: plan 문서가 스스로 "정적 분석·mutation 으로 9라운드를 돌았는데 '실제 도구를
    돌려본다'가 10라운드째에야 나왔다... 손으로 만든 스텁만 순회하면 도구의 실제 응답 형태가
    바뀐 것은 영영 안 보인다"고 기록했는데, 그 교훈이 구체적인 회귀 fixture 로는 옮겨지지
    않았다. 현재는 `actions[]`를 어디서도 안 읽으므로 당장 위험은 없지만, 이 필드가 이
    파일에서 CRITICAL 을 두 차례 낸 이력(9~10차)을 감안하면 실측 payload 형태를 주석 처리된
    fixture 로라도 남겨 향후 재도입 시 참고하게 하는 것이 저비용 고가치다(06_03_11
    maintainability 리뷰의 유사 제안과 같은 결).
  - 제안: 급하지 않음. `classify_vulnerable()` docstring 또는 테스트 파일 상단에 실측된 실제
    payload 형태(`{"action":"update","module":null,"target":null,"resolves":[...]}`)를 주석으로
    고정해 두면, 이 필드를 다시 다루게 될 개발자가 같은 실수를 반복하지 않는 데 도움이 된다.

- **[INFO]** `scripts/check-pnpm-security-config.py` 전체(149줄, 이번 라운드에 처음으로
  testing 리뷰 스코프에 진입)에 전용 unit test 가 없다. 다만 CI 가 매 실행마다 실제
  `pnpm-workspace.yaml`과 직접 대조하므로 "2-place 규약 위반"(무단 부활) 시나리오 자체는
  효과적으로 커버됨을 직접 뮤턴트로 검증했다.
  - 위치: `scripts/check-pnpm-security-config.py`(전체), 특히 `:75-78`
    (`EXPECTED_IGNORED_CVES: set[str] = set()`, 이번 라운드 실제 변경분), `:90-124`(`main()`의
    baseline 대조 로직)
  - 상세: `find .claude/tests -iname "*pnpm*"` 0건 — 이 파일을 겨냥한 `.claude/tests/test_*.py`가
    존재한 적이 없다(10개 라운드 testing.md 전부에 이 파일 언급 0건 — 이번이 router 스코프 진입
    최초). 직접 뮤턴트로 검증: `pnpm-workspace.yaml`의 `auditConfig.ignoreCves`에
    `EXPECTED_IGNORED_CVES`와 짝을 맞추지 않고 `CVE-2026-14257`을 단독으로 되살리자(무단 부활
    시나리오) `python3 scripts/check-pnpm-security-config.py`가 정확히 `returncode=1` +
    `"[auditConfig.ignoreCves] baseline 미등록 항목(무단 추가?): ['CVE-2026-14257']"` 진단으로
    잡았다(원복 후 `git status --porcelain` 클린 + 재실행 OK 확인) — 개발자가 커밋 메시지에서
    주장한 "무단 부활 뮤턴트로 config-guard RED 확인"이 실제로 성립함을 독립적으로
    재현했다. 다만 이 검증은 CI 가 매번 라이브 리포 상태에 대해 스크립트를 직접 실행하는
    것에 전적으로 의존한다 — 로컬에서 빠르게(네트워크·실제 파일 수정 없이) 이 스크립트의
    세 분기(핀 삭제·값 약화·무단 추가) 각각을 독립적으로 검증할 포터블 단위 테스트는 없다.
    이번 라운드의 실제 diff(2줄, 집합 비우기)는 이 자기검증 메커니즘 자체로 이미 방어된다.
  - 제안: 급하지 않음(이번 델타는 자기검증으로 충분히 방어됨). 여유가 있으면
    `check-override-floors.py`의 `_load_module()` 패턴처럼 `main()` 로직을 임시 YAML 텍스트에
    대해 호출하는 소규모 `.claude/tests/test_pnpm_security_config.py`를 신설해, 핀 삭제·값
    약화·무단 추가 3가지 분기를 네트워크·실제 파일 수정 없이 로컬에서 빠르게 검증할 수 있게
    할 것.

- **[INFO]** 리뷰 대상 14개 파일 중 12개(`review/code/2026/08/01/{05_36_28,06_03_11}/*.{md,json}`)는
  실행되는 코드가 아닌 이전 라운드 리뷰 산출물·머신 상태 파일이라 테스트 관점 발견사항이 없다
  (9~10차 testing.md 와 동일 판단 — 산문 리포트에는 커버리지·mock·격리 개념이 적용되지 않는다).
  - 위치: 해당 12개 파일 전체
  - 상세: 조치 불요.
  - 제안: 없음.

## 회귀 확인

`.claude/tests/test_override_floors.py` 38개 전체를 직접 재실행해 GREEN 확인
(`python3 -m unittest discover -s .claude/tests -p 'test_override_floors.py'`). 9~10차가
검증한 나머지 fail-closed 지점(returncode 불변식·overrides 키 부재·`overrides` 값 타입·
`TimeoutExpired`·예외 확장·`sorted()` TypeError 등)도 대응 테스트가 스위트에 그대로 남아 GREEN을
유지한다. `python3 scripts/check-pnpm-security-config.py`도 재실행해 OK 확인. 두 뮤턴트 실험
(README.md 문구 치환, pnpm-workspace.yaml 의 `ignoreCves` 단독 되살리기) 모두 `cp` 백업 → 원복 →
`git status --porcelain`/`git diff --stat` 클린 확인을 거쳤다 — 최종 `git status`에는 이 세션이
직접 작성한 `review/code/2026/08/01/08_20_09/**` 외 어떤 tracked 파일 변경도 남아 있지 않다.

## 요약

이번 라운드의 실질 코드 델타(커밋 `f71be98d8`)는 테스트 관점에서 순수한 개선이다. (1) 직전
라운드가 뮤턴트로 반증한 `FailClosedSiteCountTest`의 "README를 검증한다고 주장만 하는" 결함이
`test_readme_count_matches_source` 신설로 실제로 닫혔음을 재-뮤턴트로 직접 확인했다. (2)
`widened`/`EXPECTED_SUPPRESSED_PATHS` 축 삭제가 프로덕션 코드·테스트 양쪽에서 댕글링 참조 없이
깨끗하며, 그 삭제가 부수적으로 직전 CRITICAL #1(`actions[]` 스키마 드리프트 오판)까지 구조적으로
제거함을 실측 payload 재현으로 직접 검증했다. fail-closed 지점 10곳 전부 1:1 전담 테스트가
유지되고 45→38 테스트 수 감소도 정확히 설명된다. 다만 이번 델타가 손대지 않은 영역에 이미
있던 갭 하나는 여전히 살아 있다 — `run_audit()`/`classify_vulnerable()`가 `actions`/`advisories`
최상위 컨테이너의 타입을 검증하지 않아 리스트/딕셔너리가 아닌 값이 오면 `AttributeError`로
크래시(exit 1 = 이 스크립트 어휘로 "침식 발견")하는데, 이를 겨냥한 테스트가 스위트에 없다
(06_03_11 requirement WARNING #1과 동일 이슈, 직접 재현으로 재확인 — 이번 라운드가
`classify_vulnerable()`을 직접 건드렸음에도 범위 밖으로 이월됐다). 추가로 (a)
`classify_vulnerable()`가 이번에 시그니처가 바뀌었는데도 여전히 직접 단위 테스트 없이
subprocess 통합 테스트로만 도달 가능한 점, (b) CRITICAL #1을 촉발한 실측 payload 형태가 회귀
fixture로 고정되지 않아 향후 `actions[]` 로직 재도입 시 안전망이 없는 점, (c)
`check-pnpm-security-config.py` 전체가 처음으로 스코프에 들어왔는데 전용 unit test가 없는 점
(다만 라이브 CI 자기검증으로 무단 부활 뮤턴트 시나리오는 실제로 방어됨을 확인)을 INFO로
기록한다. 테스트 격리(매 테스트 `tempfile.TemporaryDirectory()` + 원자적 스텁 배치 + marker 기반
`StubNotUsed` 가드)·가독성(한국어 docstring이 "왜"를 설명)·Mock 적절성(PATH 기반 `pnpm` 스텁 +
타임아웃/미존재 바이너리 분기만 `unittest.mock` 병용)은 이번 라운드에도 기존 스위트와 동일하게
모범적이다.

## 위험도

MEDIUM — Critical 없음. WARNING 1건(carried: `actions`/`advisories` 컨테이너 타입 미검증
크래시 경로에 대한 테스트 부재, 직접 재현으로 재확인, 이번 라운드가 손댄 함수 인근이지만 이번
델타 범위 밖이라 미조치). 이번 라운드가 실제로 작업한 항목들(README 검증 fix, axis-3 삭제)은
전부 mutation/실측으로 검증된 순수 개선이라 그 자체의 리스크는 NONE에 가깝다 — MEDIUM 판정은
오로지 이월된 WARNING 1건 때문이며, 이 결함도 실패 시 항상 비-0 종료(exit 1, 다만 "erosion
found"와 같은 코드로 오분류)라 핵심 안전 불변식("조용한 통과")을 깨지는 않는다.
