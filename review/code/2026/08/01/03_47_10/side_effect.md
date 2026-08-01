# 부작용(Side Effect) 리뷰 — scripts/check-override-floors.py (5차 라운드)

이번 라운드의 리뷰 대상은 `scripts/check-override-floors.py` 단일 파일이다(신규 파일,
origin/main 대비 전체 325줄이 diff 상 "new"). 직전 라운드(`03_16_51`)의 side_effect 리뷰가
같은 파일을 포함한 41개 파일 누적 diff를 LOW로 판정했고, 그 라운드가 발견한 로직 결함
WARNING(`actions[]` 스키마 드리프트 fail-closed 무력화, requirement/testing reviewer 공동 발견)이
이번 코드(`actions_with_module` 분리 판정, 227-232행)에서 이미 해소되어 있음을 확인했다 —
전용 회귀 테스트 `SchemaDriftTest.test_actions_drift_is_caught_even_when_advisories_parse_fine`
(`.claude/tests/test_override_floors.py:337-354`)가 이를 고정한다. 본 라운드는 파일을 직접
`Read`하고, 저장소 전체 grep 으로 호출자 존재 여부·git hook 배선 여부를 재확인했다.

## 발견사항

- **[INFO]** 신규 네트워크 호출 표면(의도됨, 격리 확인) — `run_audit()`이 `pnpm audit
  --audit-level=moderate --json`으로 npm/pnpm 레지스트리에 실제 조회한다. 파일 최상단
  docstring(2-37행)과 함수 docstring(139-145행)이 의도를 명시하고, 기존
  `deps-security-checks.yml`의 `audit` 잡이 이미 같은 성격의 호출을 하고 있어 새로운 리스크
  계층은 아니다. `.claude/tests/test_override_floors.py::run_with_stub_audit()`가 `PATH` 맨
  앞에 스텁 `pnpm`을 얹은 **복사본** env로만 서브프로세스를 실행해, 테스트 프로세스가 실제
  레지스트리를 타지 않도록 격리함을 재확인했다.
  - 위치: `scripts/check-override-floors.py:138-151`(`run_audit`, 실제 호출은 146-151)
  - 상세: 의도된 설계이며 호출 성격이 기존 CI 패턴과 동일. 조치 불요, 기록 목적.
  - 제안: 없음.

- **[INFO]** 외부 호출에 timeout 미설정 — `subprocess.run(["pnpm", "audit", ...])`(146-151행)에
  `timeout=` 인자가 없다. 레지스트리가 응답하지 않으면 이 스텝이 GitHub Actions 자체의
  job/step 타임아웃까지 무기한 블록될 수 있다. 다만 같은 명령을 그대로 재사용하는 기존
  `deps-security-checks.yml`의 `audit` 잡도 동일한 특성을 이미 갖고 있어, 이 diff 가 새로
  도입하는 위험 계층은 아니다.
  - 위치: `scripts/check-override-floors.py:146-151`
  - 상세: 리스크는 낮지만 무기한 대기 가능성 자체는 실재.
  - 제안: 우선순위 낮음(이 PR 스코프 밖). 여유가 있으면 `timeout=<n>`과 `subprocess.TimeoutExpired`를
    `_undecidable()`로 라우팅하는 방어 추가를 별도 트랙에서 검토.

- **[INFO]** `sys.exit(2)`가 top-level `main`/`__main__` 경계가 아니라 업무 로직 함수 내부에서
  직접 발생 — `_undecidable()`(125-135행 정의)의 호출 6곳(`run_audit()` 내 154-158/162/165-169,
  `classify_vulnerable()` 내 218-222/228-232, `main()` 내 238-239) 모두 프로세스 전체를 즉시
  종료시킨다. 테스트가 이 경로들을 전부 서브프로세스(`run_with_stub_audit`)로만 실행함을
  확인했다 — in-process `importlib` 로드(`_load_module()`, 123-127행)를 쓰는 테스트는
  `chain_segments`/`override_target` 등 exit을 부르지 않는 순수 함수만 호출한다. 따라서 현재
  테스트 러너 프로세스가 이 종료 경로에 의해 죽을 위험은 없다. 의도된 fail-closed 설계이며
  `_undecidable`의 docstring(126-131행)에 근거가 명시돼 있다.
  - 위치: `scripts/check-override-floors.py:125-135`(정의), 호출부
    `:154-158,162,165-169,218-222,228-232,238-239`
  - 상세: 결함은 아니나, 향후 이 함수들을 서브프로세스가 아니라 in-process 로 재사용/import 하는
    코드가 생기면 그 호출자가 예기치 않게 종료될 수 있음을 인지해 둘 필요가 있다.
  - 제안: 조치 불요. 이 모듈을 라이브러리로 재사용할 계획이 생기면 `_undecidable`을 예외
    발생으로 바꾸고 `sys.exit`은 `__main__` 블록으로만 한정하는 전환을 고려.

- **[INFO]** import 시점 `sys.exit(2)` — PyYAML 미설치 시 47-51행이 모듈 **import** 자체에서
  프로세스를 종료한다(`ImportError`를 던지는 대신). 자매 스크립트
  `scripts/check-pnpm-security-config.py:21-24`가 이미 동일 패턴을 쓰고 있어 이 파일이 새로
  만든 관례는 아니다.
  - 위치: `scripts/check-override-floors.py:47-51`
  - 상세: 기존 컨벤션과 일치. `.claude/tests/test_override_floors.py`는 매 테스트 클래스마다
    `importlib.util`로 이 모듈을 새로 로드하지만, harness-checks CI 는 이 스위트 실행 전
    PyYAML 을 설치하므로(이 리뷰 범위 밖 워크플로 파일) 정상 환경에서는 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 파일시스템/전역 상태: 부작용 없음 확인 — 이 파일은 `WORKSPACE_YAML.read_text()`
  (117행) 읽기 1회 외에 어떤 파일도 생성·수정·삭제하지 않는다(`pnpm audit`는 `audit fix`가
  아니라 읽기 전용 하위 명령이라 lockfile/node_modules 도 건드리지 않는다).
  `EXPECTED_SUPPRESSED_PATHS`(62-68행)를 포함해 모듈 전역은 런타임에 `.get()`으로만 읽히고
  어디서도 제자리 변경(in-place mutation)되지 않으며, 파일 전체에 `global` 선언이 없다.
  `os.environ`에 대한 직접 대입도 없다 — subprocess 호출(146-151행)은 `env=`를 넘기지 않아
  부모 프로세스 환경을 그대로 상속하는데, 이는 pnpm 레지스트리 인증에 필요한 정상 동작이다.
  - 위치: `scripts/check-override-floors.py:115-122`(`load_override_targets`),
    `:62-68`(`EXPECTED_SUPPRESSED_PATHS`)
  - 제안: 조치 불요.

- **[INFO]** 시그니처/인터페이스: 완전 신규 파일이라 파손될 기존 호출자가 없음 — 저장소 전체
  grep 으로 `check-override-floors.py`/`check_override_floors`를 참조하는 곳이
  `.claude/tests/test_override_floors.py`(서브프로세스 실행 + `importlib` 동적 로드)와 문서
  (`PROJECT.md`, `plan/in-progress/deps-guard-hardening.md`)뿐임을 확인했다. git hook
  (`scripts/setup-githooks.sh`, `.git/hooks/*`) 어디에도 배선되지 않아 로컬 `git commit`/`push`
  시 예기치 않게 실행되지 않는다 — `deps-security-checks.yml`의 명시적 CI 잡을 통해서만
  실행된다(해당 워크플로 파일 자체는 이번 라운드 리뷰 대상 밖).
  - 위치: N/A(신규 파일 전체 — 리포지토리 전역 grep 결과)
  - 제안: 조치 불요.

## 요약

이 파일은 완전한 신규 스크립트로 기존 함수/시그니처를 깨뜨릴 호출자가 없고, 저장소 전역에서
참조하는 곳은 테스트 파일과 문서뿐이며 git hook 에도 배선돼 있지 않아 로컬 개발 흐름에 예기치
않은 실행을 유발하지 않는다. 파일시스템 쓰기·전역 변수 제자리 변경·환경 변수 대입은 어디에도
없다. 유일한 실질적 부작용은 `run_audit()`이 만드는 `pnpm audit` 레지스트리 네트워크 호출인데,
파일 자신의 방대한 docstring 이 명시하는 설계 의도이고 기존 `deps-security-checks.yml`의
`audit` 잡과 같은 성격이라 새로운 리스크 계층이 아니며, 테스트 스위트는 스텁 `pnpm`으로 이
호출을 완전히 격리한다. 이번 라운드에서 새로 관찰한 사항은 전부 INFO 수준이다 — timeout
미설정(기존 패턴과 동일), `_undecidable()`의 `sys.exit(2)`가 top-level 경계가 아니라 업무 로직
함수 내부에서 직접 프로세스를 종료시키는 설계(테스트는 서브프로세스로만 이 경로를 태워 안전),
import 시점 `sys.exit(2)`(자매 스크립트와 동일 관례). 전부 의도된 설계이거나 기존 관례와
일치해 조치가 필요하지 않다. 참고로 직전 라운드가 지적했던 로직 결함(스키마 드리프트
fail-closed 무력화)은 현재 코드에서 이미 해소되어 전용 회귀 테스트로 고정돼 있음을 함께
확인했다.

## 위험도

LOW
