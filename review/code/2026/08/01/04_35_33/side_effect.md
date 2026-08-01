# 부작용(Side Effect) 리뷰 — deps-guard-hardening (누적 브랜치 diff, 7차 라운드)

이번 라운드의 diff 는 21개 파일이다: 직전 두 라운드(`03_47_10`, `04_09_43`)가 생성한 리뷰 산출물
20개(모두 정적 `.md`/`.json`) + `scripts/check-override-floors.py`(신규 파일, origin/main 대비
361줄). 실제 실행 가능한 코드는 후자뿐이므로 부작용 분석은 이 파일에 집중하고, 나머지 20개는
런타임 표면이 없는 정적 문서로서 별도 항목으로만 확인했다.

`git log`/`git branch -vv`로 확인한 결과 이 브랜치(`claude/deps-guard-hardening`, HEAD
`1598f542f` "6차 리뷰 조치")는 origin/main 대비 10개 커밋 전체가 새로 얹힌 상태라 스크립트가
"new file"로 잡히는 것은 정상이다. 리뷰 판단은 요약·발췌가 아니라 실제 소스(`Read`)와
`.claude/tests/test_override_floors.py`(632줄, diff 목록엔 없으나 `git diff
origin/main...HEAD`로 실측 확인한 실제 변경분)를 직접 열어 검증했다.

## 발견사항

- **[INFO]** (확인/긍정) 직전 라운드(`04_09_43`)가 지적한 WARNING 3건이 이번 최종 코드에서
  모두 해소되고 전용 회귀 테스트로 고정됨을 소스 직접 대조로 재확인
  - 위치: `scripts/check-override-floors.py:119-148`(`load_override_targets`, YAML
    예외 처리 `:127-133`, 값 타입 검사 `:134-144`), `:164-187`(`run_audit`, timeout 처리)
  - 상세: (1) `overrides` 값이 `None`/문자열/리스트인 경우 — 이전엔 `"overrides" not in data`
    로 **키 존재만** 검사해 `overrides:`(값 없음)를 통과시켰으나, 현재는
    `overrides = data.get("overrides") if isinstance(data, dict) else None` 후
    `if not isinstance(overrides, dict): _undecidable(...)`로 **타입 자체**를 검사해 None·문자열·
    리스트를 전부 막는다. (2) `yaml.safe_load(text)` 호출이 이전엔 try/except 없이 노출돼
    구문 오류 YAML 이 traceback+exit 1("침식 발견"과 동일 코드)로 죽었으나, 현재는
    `except yaml.YAMLError as exc: _undecidable(...)`로 감싸져 exit 2 로 fail-closed 된다.
    (3) `run_audit()`의 `subprocess.TimeoutExpired` 분기는 이전 라운드부터 존재했으나 회귀
    테스트가 없었다 — 이번엔 `.claude/tests/test_override_floors.py:466-485`
    (`AuditTimeoutTest.test_timeout_exits_2`)가 `mock.patch.object(mod.subprocess, "run",
    side_effect=...)` + `self.assertRaises(SystemExit) as ctx: mod.run_audit()`로 직접
    검증한다. 세 항목 모두 `.claude/tests/test_override_floors.py:416-463`
    (`MissingOverridesKeyTest`, `test_valueless_overrides_is_undecidable`/
    `test_non_mapping_overrides_is_undecidable`/`test_unparseable_yaml_is_undecidable_not_exit_1`
    포함)로 회귀 고정돼 있음을 실제 파일을 열어 확인했다.
  - 제안: 조치 불요. 확인 목적의 긍정 관측.

- **[INFO]** fail-closed 조기 종료(`_undecidable()` → `sys.exit(2)`) 호출 지점이 이번 델타로
  8곳 → 9곳으로 증가 — 기존에 이미 확립된 설계(업무 로직 함수 내부에서 직접 프로세스 종료)의
  연장이며 코드-문서 결속 테스트로 drift 방지됨
  - 위치: `scripts/check-override-floors.py:151-161`(`_undecidable` 정의), 호출부 9곳
    — `:133,139`(`load_override_targets`, 이번 델타로 신설된 자리 `:133`),
    `:184,190,198,201`(`run_audit`), `:254,264`(`classify_vulnerable`), `:274`(`main`)
  - 상세: 신규 호출 지점(`:133`, YAML 파싱 실패)이 이번 델타로 추가돼 총 9곳이 됐다. 실제
    소스에서 `_undecidable(` 문자열을 직접 세어(정의부 제외) 9회임을 확인했고, 이는
    `.claude/tests/test_override_floors.py:500-521`(`FailClosedSiteCountTest.EXPECTED_SITES = 9`)
    가 소스 카운트와 정확히 일치하도록 강제하는 값과 일치한다. 이 종료 경로들은 여전히 top-level
    `__main__` 경계가 아니라 업무 로직 함수 내부에 흩어져 있다는 점은 1~6차 라운드에서 이미
    일관되게 INFO로 짚어온 설계이고 이번 델타가 그 성격을 바꾸지 않는다 — 테스트는 전부
    서브프로세스(`run_with_stub_audit`) 또는 `assertRaises(SystemExit)`로 이 경로를 격리해
    호출하므로 테스트 러너 프로세스가 의도치 않게 종료될 위험은 없다(`AuditTimeoutTest`가
    in-process로 `mod.run_audit()`을 직접 부르는 유일한 자리인데, `assertRaises(SystemExit)`로
    올바르게 감싸져 있음을 확인).
  - 제안: 조치 불요. 향후 in-process 재사용 계획이 생기면 `_undecidable`을 예외 발생으로
    전환하는 편이 안전(기존 라운드부터 이어진 권고, 이번 델타로 바뀌지 않음).

- **[INFO]** 네트워크 호출 표면(의도됨) — `_AUDIT_TIMEOUT_SEC`(300초) 도입으로 이전 라운드가
  지적한 "timeout 미설정" INFO 가 해소됨, 프로세스 정리 안전
  - 위치: `scripts/check-override-floors.py:77`(`_AUDIT_TIMEOUT_SEC = 300`), `:164-187`
    (`run_audit`, `subprocess.run(..., timeout=_AUDIT_TIMEOUT_SEC)` 및 `except
    subprocess.TimeoutExpired`)
  - 상세: `run_audit()`이 `pnpm audit --audit-level=moderate --json`으로 실제 레지스트리에
    조회하는 것이 이 스크립트의 유일한 실질적 외부 부작용이다. `subprocess.run`은
    `capture_output=True`(파이프)와 `timeout=`을 함께 쓸 때 표준 라이브러리가 내부적으로
    `Popen.communicate(timeout=...)` 경로를 타 데드락 없이 타임아웃 시 자식 프로세스를
    kill+wait 하므로 좀비/유휴 프로세스가 남지 않는다. `env=`를 넘기지 않아 부모 프로세스
    환경을 그대로 상속하는 것도 pnpm 레지스트리 인증에 필요한 정상 동작으로 이전 라운드부터
    일관되게 확인된 사실이다.
  - 제안: 조치 불요.

- **[INFO]** 전역 상태·환경 변수: 부작용 없음 — 소스 직접 grep 으로 재확인
  - 위치: `scripts/check-override-floors.py` 전체
  - 상세: `global` 키워드 0건, `os` 모듈 자체를 import 하지 않아(`os.environ` 접근 불가능),
    `open(`/`.write(`/`.write_text(`/`.unlink(`/`shutil.` 전부 0건임을 grep 으로 직접 확인했다.
    유일한 파일시스템 접근은 `:127`의 `path.read_text(encoding="utf-8")`(읽기 1회,
    `load_override_targets` 내부)뿐이다. `EXPECTED_SUPPRESSED_PATHS`(`:62-68`)를 포함한 모든
    모듈 전역은 `.get()`으로만 읽히고 어디서도 제자리 변경되지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 시그니처/인터페이스: 완전 신규 파일 — 파손될 기존 호출자 없음
  - 위치: N/A(신규 파일 전체)
  - 상세: `chain_segments`/`override_target`/`load_override_targets`/`_undecidable`/
    `run_audit`/`classify_vulnerable`/`main`/`_report_widened`/`_report_eroded` 전부 이번
    브랜치에서 처음 생기는 함수라 기존 시그니처를 바꾸는 사례가 없다. CI 배선
    (`deps-security-checks.yml`)은 이번 diff 목록에 없어(불변) 별도 확인 대상이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 하네스의 부작용 격리 메커니즘을 직접 코드로 재확인(요약이 아니라 원문 대조)
  - 위치: `.claude/tests/test_override_floors.py:87-131`(`run_with_stub_audit`)
  - 상세: `env = dict(os.environ, PATH=f"{bindir}:{os.environ['PATH']}",
    STUB_AUDIT_PAYLOAD=..., STUB_AUDIT_EXIT=...)`는 `os.environ`을 **복사**해 자식 프로세스에만
    `env=env`로 전달하고 실제 부모 프로세스의 `os.environ`은 그대로 둔다(제자리 변경 아님).
    `tempfile.TemporaryDirectory()`를 컨텍스트 매니저로 써서 스텁 `pnpm`/`pnpm-workspace.yaml`/
    payload 파일이 테스트 종료 시 자동 정리되고 잔존 파일을 남기지 않는다. 이는 3~6차 라운드가
    반복적으로 "완전 격리"라 서술해 온 주장을 이번 라운드에서 원문 코드로 직접 검증한 것이다.
  - 제안: 조치 불요.

- **[INFO]** (메타) 이번 라운드에 전달된 리뷰 페이로드(21개 파일)에
  `.claude/tests/test_override_floors.py`(632줄 신규)가 포함되지 않았음을 `git diff
  origin/main...HEAD --stat`로 확인 — 별도로 직접 `Read`하여 부작용 관점 이상 없음을
  확인했으므로 이번 라운드의 결론에는 영향 없음
  - 위치: N/A — 오케스트레이터/라우터 페이로드 구성 문제(리뷰 대상 코드 자체의 결함 아님)
  - 상세: 위 두 항목의 근거(테스트 격리 방식, WARNING 3건의 회귀 테스트 존재)는 이 프롬프트가
    제공한 21개 파일이 아니라 실제 저장소 파일을 직접 열어 얻었다. 프롬프트만 신뢰했다면 테스트
    측 부작용 격리를 재검증할 수 없었을 것이다. 이 파일 자체(테스트 코드)에서 side-effect
    관점의 결함은 발견되지 않았지만, side_effect reviewer 페이로드에 테스트 파일이 빠진 것은
    커버리지 갭으로 기록해 둘 만하다.
  - 제안: 조치 불요(이번 라운드 결론에는 영향 없음). 반복되면 오케스트레이터의 파일 선정 로직
    점검 권장.

- **[INFO]** 리뷰 산출물 20건(파일 1~20, `review/code/2026/08/01/{03_47_10,04_09_43}/*.md`,
  `*.json`) — 정적 문서, 런타임 부작용 표면 없음
  - 위치: `review/code/2026/08/01/03_47_10/*`, `review/code/2026/08/01/04_09_43/*`
  - 상세: 10개 마크다운은 실행되지 않는 정적 보고서다. `_retry_state.json`(파일 2, 12)에는
    로컬 워크트리 절대경로(`/Volumes/project/private/clemvion/...`)와 "모든 에이전트 pending,
    성공 0건"인 초기 스냅샷이 그대로 커밋돼 있으나, 이는 직전 라운드(`04_09_43`)의 side_effect
    리뷰가 오케스트레이터 코드 추적으로 이미 "`session_dir`는 기록 전용 dead field, resume 은
    디스크 리포트로 재조정"임을 확인한 사안과 동일 패턴이며 이번 라운드에서 다시 뒤집을 근거를
    찾지 못했다.
  - 제안: 조치 불요.

## 요약

`scripts/check-override-floors.py`는 완전 신규 CI 가드 스크립트로 기존 함수/시그니처를 깨뜨릴
호출자가 없고, 전역 변수는 읽기 전용이며(`global` 0건), `os` 모듈 자체를 import 하지 않아
환경 변수 부작용 표면이 없고, 파일시스템은 `pnpm-workspace.yaml` 읽기 1회 외에 건드리지 않는다.
유일한 실질적 부작용인 `pnpm audit` 네트워크 호출은 의도된 설계이고 이번 델타로 300초 타임아웃이
추가돼 무기한 대기 위험이 해소됐으며, 자식 프로세스 kill/wait 도 표준 라이브러리 경로로 안전함을
확인했다. 직전 라운드(`04_09_43`)가 지적한 WARNING 3건(`overrides` 값 타입 미검증, YAML 파싱
예외 미처리, timeout 분기 미검증)은 이번 최종 코드에서 모두 해소되고 전용 회귀 테스트로 고정돼
있음을 소스와 테스트 파일을 직접 열어 재확인했다 — 특히 새로 늘어난 fail-closed 종료 지점
(8→9곳)도 전부 서브프로세스 격리 또는 `assertRaises(SystemExit)`로 안전하게 테스트된다. 리뷰
산출물 20건은 정적 문서로 부작용 표면이 없으며, 그중 `_retry_state.json`의 로컬 경로/stale
스냅샷은 이전 라운드가 이미 dead field 로 확인한 사안과 동일하다. 유일하게 기록해 둘 점은 이번
side_effect 페이로드에 실제 테스트 파일(`.claude/tests/test_override_floors.py`, 632줄 신규)이
누락돼 있었다는 것인데, 직접 열어 대조한 결과 부작용 관점의 결함은 없어 최종 판단에는 영향이
없다. Critical·Warning 수준의 부작용 결함은 발견되지 않았다.

## 위험도

LOW
