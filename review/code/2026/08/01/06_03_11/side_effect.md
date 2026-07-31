# 부작용(Side Effect) 리뷰 — testing.md / scripts/check-override-floors.py

## 스코프 메모

router 가 이번 라운드에 넘긴 파일은 2개: (1) `review/code/2026/08/01/05_36_28/testing.md` — 이전
라운드(9차 이전)의 리뷰 산출물 markdown, (2) `scripts/check-override-floors.py` — 실제 프로덕션
코드. diff 는 둘 다 `new file mode 100644`(origin/main 기준 신규)로 표시되지만, `git log --
scripts/check-override-floors.py` 로 대조한 결과 이 파일은 같은 feature 브랜치 내에서 이미 9차례
"리뷰 조치" 커밋(`6b55b0f48`→`e18fc7227`)을 거쳤고 현재 워킹트리 `wc -l` 이 diff 의 `+386` 과
정확히 일치한다 — 즉 이번 리뷰는 origin/main 대비 누적 diff 전체(현재 HEAD 상태)를 대상으로 한다.
이 스크립트를 호출하는 `.github/workflows/deps-security-checks.yml` 의 `override-floors` job 은
같은 브랜치의 더 이른 커밋(`6b55b0f48`)에서 이미 추가돼 있고 이번 라운드 diff 대상 파일 목록에는
없다 — 즉 "CI 배선"은 기정사실이며 이번 회차의 신규 변경이 아니다(참고용으로만 언급, 발견사항에서
제외).

## 발견사항

- **[INFO]** 모듈 임포트 시점에 `sys.exit(2)` 를 호출하는 최상위 코드 — 임포트가 프로세스 종료라는
  부작용을 가질 수 있다.
  - 위치: `scripts/check-override-floors.py:48-52`(`try: import yaml / except ImportError: ... /
    sys.exit(2)`)
  - 상세: 이 블록은 함수 안이 아니라 모듈 최상위에 있어 `import` 문 자체(또는
    `.claude/tests/test_override_floors.py:169-170` 의 `importlib.util.module_from_spec` +
    `spec.loader.exec_module` 경로)가 트리거한다. PyYAML 이 없는 환경에서 이 모듈을 다른 스크립트가
    재사용 목적으로 `import` 하면 `ImportError` 를 캐치할 기회 없이 프로세스 전체가 죽는다. 다만
    `scripts/check-pnpm-security-config.py:27-31` 이 이미 동일한 패턴(`try: import yaml / except
    ImportError: ... sys.exit(2)`)을 쓰고 있어 이 코드베이스의 기존 관례와 일치한다 — 이번 PR 이
    새로 도입한 위험이 아니라 기존 패턴을 답습한 것. CI 워크플로(`deps-security-checks.yml`)의
    `override-floors` job 은 `pip install "pyyaml>=6,<7"` 스텝을 항상 먼저 실행하므로 실제 CLI 실행
    경로에서는 이 분기에 도달하지 않는다.
  - 제안: 조치 불요(기존 관례와 일치, CLI 전용 스크립트이며 라이브러리로 재사용될 계획이 diff 안에
    없음). 향후 이 모듈의 함수(`chain_segments`/`override_target` 등)를 다른 스크립트가
    import 해서 재사용할 계획이 생기면, 그 시점에 `import yaml` 을 함수 내부로 옮기거나
    `TYPE_CHECKING`/lazy import 로 바꾸는 것을 고려.

- **[INFO]** 반환 타입이 있는 함수들이 실제로는 `sys.exit()` 를 통해 프로세스를 종료할 수 있는
  `NoReturn` 이탈 경로를 갖는다 — "순수 반환" 함수가 아니라 프로세스 종료라는 부작용을 내부에
  숨기고 있다.
  - 위치: `_undecidable()` 정의(`scripts/check-override-floors.py:168-178`), 호출부는
    `override_target()`(`:124`), `load_override_targets()`(`:148`, `:156`), `run_audit()`(`:203`,
    `:208`, `:215`, `:223`, `:226`), `classify_vulnerable()`(`:279`, `:289`).
  - 상세: `load_override_targets(path) -> dict[str, list[str]]` 처럼 타입 시그니처는 정상 반환을
    약속하지만 실제로는 여러 지점에서 `sys.exit(2)`(→ `SystemExit`, `Exception` 이 아니라
    `BaseException` 하위)로 프로세스를 끝낼 수 있다. 이 모듈을 CLI 로 직접 실행하는 현재 용법(
    `if __name__ == "__main__": sys.exit(main())`)에서는 의도된 fail-closed 설계이고, 테스트
    스위트도 이를 인지해 `assertRaises(SystemExit)` 로 검증하고 있다(`testing.md` 상세 참조).
    다만 이 함수들을 나중에 다른 오케스트레이션 스크립트가 "값을 계산만 하고 알아서 처리하겠다"는
    의도로 재사용하면, 일반적인 `try/except Exception` 으로는 이 종료를 잡지 못해 호출자 프로세스
    전체가 예고 없이 죽는다.
  - 제안: 조치 불요 — 현재는 CLI 단독 실행 + 테스트만 이 함수들을 호출하고 둘 다 `SystemExit`
    가능성을 인지한 상태(테스트는 명시적으로 `assertRaises`, CLI 는 최상위 프로세스라 차이 없음).
    docstring 에 이미 fail-closed 설계 의도가 충분히 설명돼 있어 추가 조치보다는 향후 이
    모듈을 라이브러리로 확장할 때 유의할 사항으로 남긴다.

- **[INFO]**(의도된 설계, 확인 목적) `run_audit()` 의 `pnpm audit --json` subprocess 호출은 이 스크립트
  유일의 외부 네트워크 호출이며, 모듈 docstring 이 그 필요성과 격리 이유를 명시한다.
  - 위치: `scripts/check-override-floors.py:194-201`(`subprocess.run(["pnpm", "audit",
    "--audit-level=moderate", "--json"], ...)`), 설계 근거는 파일 최상단 docstring
    `:26-28`(`check-pnpm-security-config.py`(순수 로컬 스냅샷 대조)와 분리한 이유...`)
  - 상세: `env=` 인자를 넘기지 않아 `subprocess.run` 은 기본값대로 부모 프로세스의 전체 환경변수를
    상속한다 — `pnpm audit` 이 사설 레지스트리 인증 토큰 등을 쓰려면 필요한 동작이고, 같은 워크플로의
    이웃 `audit` job(`.github/workflows/deps-security-checks.yml:75-76`)이 `pnpm audit` 을 직접
    셸에서 호출하는 것과 동일한 노출 범위라 이 스크립트가 새로 넓힌 표면은 아니다. `capture_output=
    True` 로 자식 프로세스의 raw stdout/stderr 를 부모의 stdout/stderr 로 자동 전파하지 않고
    `_STDOUT_PREVIEW`/`_STDERR_PREVIEW` 로 잘라 진단 메시지에만 포함시키는 점도 확인했다(무제한
    로그 유출 없음). 네트워크 호출 자체는 "의도치 않은" 것이 아니라 이 스크립트의 존재 이유이므로
    WARNING 등급 대상이 아니라고 판단한다.
  - 제안: 조치 불요. `.github/workflows/deps-security-checks.yml` 의 `override-floors` job(이번
    diff 범위 밖, 이미 병합된 이전 라운드 커밋)이 이 네트워크 호출을 PR 경로 변경 시 + 주간
    cron 으로 실행하도록 이미 배선돼 있음을 참고로 기록.

- **[INFO]** `EXPECTED_SUPPRESSED_PATHS` 는 mutable 타입(`dict[str, set[str]]`)의 신규 모듈 전역이다
  — 현재 코드 경로는 읽기 전용(`.get()`)으로만 쓰지만 타입 자체는 향후 실수로 런타임 mutate 될
  여지를 막아주지 않는다.
  - 위치: `scripts/check-override-floors.py:63-69`(선언), 읽는 지점은
    `classify_vulnerable()`/`main()` 의 `:318`(`EXPECTED_SUPPRESSED_PATHS.get(module, set())`)
  - 상세: `classify_vulnerable()`→`main()` 호출 경로에서 `actual - allowed`(`:319`)는 새 set 을
    만드는 연산(`-` 는 in-place mutation 아님)이라 `EXPECTED_SUPPRESSED_PATHS[module]` 이 별칭을
    통해 변형될 위험은 실제로 없음을 직접 대조 확인했다. 순수 정적 설정 상수로만 쓰인다.
  - 제안: 조치 불요(현재 안전). 코드 스타일 선호에 따라 `Mapping`/`frozenset` 타입 힌트로
    방어적으로 명시할 수 있으나 이번 라운드의 필수 조치는 아니다.

- **[INFO]** `review/code/2026/08/01/05_36_28/testing.md` 는 순수 markdown 리뷰 산출물이며 실행되는
  코드나 상태 변경 로직을 포함하지 않는다 — 부작용 관점에서 검토 대상 아님(문서 자체 존재는
  `code-review-agents` 스킬의 정해진 산출 경로(`review/code/**`)에 부합).

## 요약

이번 라운드는 `scripts/check-override-floors.py`(신규 386줄 스크립트, origin/main 기준)와 그 이전
라운드 리뷰 산출물 markdown 1건을 대상으로 한다. markdown 파일은 부작용이 전혀 없는 정적 문서다.
스크립트는 전역 변수 신규 도입(모두 읽기 전용으로 실제 사용, 뮤테이션 경로 없음 확인)·
파일시스템(읽기 전용, `pnpm-workspace.yaml` 만 읽고 아무것도 쓰지 않음 grep 으로 확인)·환경 변수
(직접 접근 코드 없음, grep 0건)·이벤트/콜백(해당 없음) 축에서 문제되는 패턴을 찾지 못했다. 유일한
네트워크 호출(`pnpm audit --json`)은 이 스크립트의 존재 이유로 문서화돼 있고 이웃 `audit` CI job 과
동일한 환경변수 노출 범위이며 raw 출력을 무제한 전파하지 않는다. 시그니처·인터페이스 변경도 없다
— 파일 전체가 origin/main 에 없던 신규 코드라 깨지는 기존 호출자가 없다. 다만 두 가지 설계 특성은
"부작용"이라는 렌즈에서 기록해 둘 가치가 있다: (1) 모듈 최상위의 `import yaml` 실패 시 `sys.exit(2)`
— 임포트가 프로세스를 죽일 수 있는 부작용이지만 `check-pnpm-security-config.py` 의 기존 관례와
동일하고 CI 는 항상 사전에 PyYAML 을 설치하므로 실제 도달 경로는 없다, (2) `_undecidable()` 을 통해
"반환형이 있는" 함수들이 실제로는 `SystemExit` 로 조기 종료할 수 있다 — 현재는 CLI 단독 실행 +
`SystemExit` 을 이미 인지한 테스트만 이 함수들을 호출하므로 안전하지만, 향후 라이브러리로 재사용될
경우 호출자가 이 이탈 경로를 놓치기 쉽다는 점은 유의사항으로 남는다. 이번 diff 범위 밖이지만 참고로,
이 스크립트를 실행하는 CI 잡(`deps-security-checks.yml` 의 `override-floors`)은 이미 이전 커밋에서
배선이 끝나 있어 이번 병합 자체가 CI 에 새 네트워크 의존 게이트를 활성화한다 — 다만 이는 이 기능의
설계 목적 그 자체(deps-guard-hardening plan)이며 우연한 부작용이 아니다.

## 위험도

LOW — Critical/Warning 없음. INFO 4건은 전부 (a) 기존 코드베이스 관례와 일치하거나 (b) 현재 호출
경로에서 실제로 안전함을 직접 대조 확인한 항목이며, 즉각 조치가 필요한 항목은 없다.
