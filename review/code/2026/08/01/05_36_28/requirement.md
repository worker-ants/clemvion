# 요구사항(Requirement) 리뷰 — deps-guard-hardening (누적 diff, 9차+ 검증 라운드)

## 검토 방법

이번 라운드 프롬프트 페이로드 42개 중 41개는 5~8차 `/ai-review` 세션(`review/code/2026/08/01/
{03_47_10,04_09_43,04_35_33,04_58_18}/`)의 산출물(정적 markdown/JSON)이고, 실 코드는
`scripts/check-override-floors.py`(365줄, diff 는 크기 제한으로 프롬프트에 실리지 않음) 1개뿐이다.
`Read`로 저장소 현재 파일을 직접 열고, `git log`(`614d72ba3` "8차 리뷰 조치" 가 최신 HEAD)로 이미
9라운드(1~8차 리뷰 + 8차 조치)에 걸친 review-fix 사이클이 이 스크립트에 적용돼 있음을 확인했다.
기존 8회 라운드가 이미 매우 촘촘히 검증했으므로, 이번 라운드는 (1) 기존 발견사항들이 현재 코드에
실제로 반영돼 있는지 독립 재검증하고, (2) 8라운드 동안 아무도 짚지 않은 새 각도를 찾는 데 집중했다.

**직접 실행/실측 검증**:
- `python3 scripts/check-override-floors.py` 라이브 실행 → `OK: override 대상 26개 패키지 중
  취약 재유입 0건`, exit 0 (기존 라운드들의 실측치와 일치).
- `.claude/tests/test_override_floors.py`(41개 테스트, 게이트 스코프 밖) 전체 실행 → 41/41 PASS.
- `grep -c "_undecidable("` (정의부 제외) → 9곳, 문서(`EXPECTED_SITES=9`, "아홉") 와 일치.
- `grep -inE "TODO|FIXME|HACK|XXX"` → 0건.
- `spec/` 전체 grep(`override-floors`/`override_floors`/`check-override-floors`/`바닥 침식`) → 0건.
- `.github/workflows/deps-security-checks.yml`/`harness-checks.yml`의 배선(`timeout-minutes: 10`,
  `paths:` 등재)을 직접 대조.
- 아래 발견사항 2건은 REPL/서브프로세스 직접 실행으로 **재현 확인**했다(추론이 아님).

## 발견사항

- **[WARNING]** `run_audit()`의 `except subprocess.TimeoutExpired`가 `pnpm` 바이너리 자체를 못 찾는
  경우(`FileNotFoundError`)를 포섭하지 못해, 이 스크립트가 가장 경계하는 "exit 1(erosion 발견)과
  판단-불가 상황이 혼동되는" 실패 형태를 정확히 재현한다.
  - 위치: `scripts/check-override-floors.py:176-191`(`run_audit()`의 `try: subprocess.run(...) except
    subprocess.TimeoutExpired:` 블록, 특히 `:187`)
  - 상세: `subprocess.run(["pnpm", "audit", ...])`가 `pnpm`을 PATH에서 찾지 못하면 파이썬은
    `FileNotFoundError`(=`OSError`의 서브클래스)를 던진다 — `TimeoutExpired`가 아니라서 현재 `except`
    절에 잡히지 않고 그대로 전파된다. **직접 재현**: `PATH`에서 pnpm 디렉터리만 제외하고 저장소의
    스크립트를 그대로 실행하면 —
    ```
    FileNotFoundError: [Errno 2] No such file or directory: 'pnpm'
    EXIT=1
    ```
    처리되지 않은 traceback 과 함께 **exit 1** 로 죽는다. 이 스크립트의 어휘에서 1 은 "침식 발견"(진짜
    조치가 필요한 결과)이고 2 는 "판단 불가"(fail-closed)인데, `pnpm` 부재는 명백히 후자에 속하는데도
    전자와 같은 코드로 나온다 — `load_override_targets()`의 주석(`:132-134`)이 명시적으로 경계하는
    바로 그 "exit code 만 보는 자동화가 혼동" 시나리오다. 더 구체적으로, 이 정확한 실패 형태(서브프로세스/
    파일 I/O 가 예상 밖 `OSError` 를 던지면 잡지 못해 exit 1 로 죽는 것)는 **바로 이 스크립트의 직전
    조치 커밋(`614d72ba3`, 8차 리뷰 조치)이 `load_override_targets()`의 YAML 읽기 경로에 대해서는 이미
    한 번 고친 문제**다 — 그 커밋은 `except yaml.YAMLError`를 `except (yaml.YAMLError,
    UnicodeDecodeError, OSError)`로 넓혀 "유효하지 않은 UTF-8 이 traceback+exit 1 로 죽던 것"을 막았다.
    그런데 형제 함수 `run_audit()`의 서브프로세스 호출에는 같은 종류의 확장이 적용되지 않았다 — 같은
    커밋이 같은 클래스의 버그를 한쪽에서만 고치고 다른 쪽에 그대로 남긴 형태다.
    `.claude/tests/test_override_floors.py::AuditTimeoutTest`(게이트 스코프 밖, 참고 확인)는
    `subprocess.run`이 `TimeoutExpired`를 던지는 경우만 목(mock)하며, `FileNotFoundError`/`OSError`
    계열을 던지는 경우는 어떤 테스트에도 없다(`grep -n "FileNotFoundError\|OSError\|PermissionError"`
    결과 0건). 현재 CI(`deps-security-checks.yml`의 `override-floors` 잡)는 `pnpm/action-setup@v6`을
    실행 전에 두므로 오늘 당장 이 경로가 트리거되지는 않지만, (a) 로컬/수동 실행(이 스크립트는 CI
    전용이 아니라 독립 실행 가능하도록 설계된 모듈 docstring을 갖는다)에서 `pnpm`이 PATH에 없는 흔한
    상황, (b) 향후 워크플로 리팩터링이 이 잡의 setup 스텝 순서를 실수로 바꾸는 경우 모두 실제로
    도달 가능하다.
  - 제안: `except subprocess.TimeoutExpired:`를 `except (subprocess.TimeoutExpired, OSError):`로
    넓혀 `load_override_targets()`에 이미 적용된 것과 동일한 패턴으로 `_undecidable()`에 라우팅한다.
    회귀 테스트로 `mock.patch.object(mod.subprocess, "run", side_effect=FileNotFoundError(...))` 케이스를
    `AuditTimeoutTest`류에 추가할 것을 권장. `EXPECTED_SITES`(현재 9)는 분기 추가가 아니라 기존
    `except`절의 예외 타입 확장이므로 변경 불필요.

- **[WARNING]** `chain_segments()`가 `>` 앞에 공백이 오면 체인 구분자로 인식하지 않아(레인지의
  OR 표현 `>=1 || >2`를 보호하기 위한 의도된 설계), 사람이 가독성을 위해 공백을 넣은 체인형 override
  키(`"next > postcss"`)를 조용히 **분할하지 않고** 매칭 불가능한 대상 이름을 만든다 — fail-closed
  없이.
  - 위치: `scripts/check-override-floors.py:95`(`_NAME_CHAR = re.compile(r"[A-Za-z0-9._/-]")`),
    `:101-110`(`chain_segments()`, 특히 `:106`의 `_NAME_CHAR.match(key[i - 1])`), 소비부
    `:113-117`(`override_target()`), `:149-151`(`load_override_targets()`의 `targets.setdefault(...)`)
  - 상세: **직접 재현**(`importlib`로 실제 모듈 로드 후 호출) —
    ```python
    >>> chain_segments("next > postcss")
    ['next > postcss']          # 분할 안 됨 (기대: ['next', ' postcss'] 류)
    >>> override_target("next > postcss")
    'next > postcss'            # 기대: 'postcss'
    >>> override_target("next>postcss")
    'postcss'                   # 공백 없으면 정상
    ```
    `_NAME_CHAR`가 공백을 제외한 것은 의도된 설계다 — 인접 주석(`:85-88`)이 "레인지의 `>` 는 `@` 나
    **공백** 뒤에 온다(`>=1 || >3`)"고 명시하며, 이는 세미버 OR-레인지(`foo@>=1.0.0 || >2.0.0`)의
    두 번째 `>`가 체인 구분자로 오인되는 것을 막기 위한 트레이드오프다. 문제는 이 트레이드오프의
    **반대편** — 사람이 체인 구분자 `>` 앞뒤에 공백을 넣어 쓰면(YAML 문법상 완전히 유효한 키) 그
    쪽도 "레인지"로 오분류돼 분할되지 않는다는 점이 — 코드 어디에도 검증되지 않고 방어되지 않는다는
    것이다. 결과적으로 `override_target()`은 공백이 섞인 문자열을 그대로 반환하고, 이 문자열은
    어떤 실제 npm 패키지명(공백을 포함할 수 없다 — npm 이름 규칙)과도 매칭되지 않으므로 그 override
    키는 **영구히 감시 대상에서 빠진다** — `main()`은 크래시하지 않고 `OK: override 대상 N개 패키지
    중 취약 재유입 0건`처럼 정상으로 보이는 메시지를 낸다(그 N에는 매칭 불가능한 유령 대상이 하나
    섞여 있을 뿐, 크래시도 `_undecidable()` 경고도 없다). 이 함수(`chain_segments`/`override_target`)는
    이미 이 정확한 종류(">`" 분할 규칙의 미묘한 오류)의 버그를 프로젝트 역사에서 **3회** 냈다(1차
    Warning 2건 + 2차 Critical, `review/code/2026/08/01/04_35_33/RESOLUTION.md` 조치 이력 참고) —
    이번 것은 그 네 번째 형제 사례다. `OverrideTargetExtractionTest`(8개 테스트, `pnpm-workspace.yaml`
    실측 대조 포함)에는 공백이 섞인 입력 케이스가 없다.
    **완화 요인**: 오늘 `pnpm-workspace.yaml`의 override 키 15개(체인/레인지/scope 포함) 전부 공백
    없는 형식을 쓰고 있어 현재 상태는 영향받지 않는다. 또한 `scripts/check-pnpm-security-config.py`의
    `EXPECTED_OVERRIDES`(원문 키 문자열 그대로 정확 대조, `deps-security-checks.yml`의 `config-guard`
    잡이 같은 트리거 경로 `pnpm-workspace.yaml`에서 실행)가 **기존에 올바르던 키가 공백 포함 형태로
    바뀌는 경우**를 "baseline 핀 사라짐" + "미등록 핀 추가"로 잡아준다 — 부분적 백스톱은 존재한다.
    다만 이 백스톱은 "두 파일이 처음부터 같은(공백 포함) 형식으로 동시에 작성되는" 경우(신규 override
    추가 시 `EXPECTED_OVERRIDES`에도 같은 공백 포함 문자열을 등록)는 못 잡는다 — 이 스크립트 자신의
    파싱 로직 문제이기 때문이다.
  - 제안: 급한 조치는 아니나(현재 미트리거, 부분 백스톱 존재), `override_target()`의 결과값에 공백이
    포함되면(실제 npm 패키지명은 공백을 가질 수 없다) `_undecidable()`로 fail-closed 처리하는 저비용
    가드를 추가하는 것을 권장 — 이 파일이 이미 일관되게 적용해 온 "빈 결과로 조용히 흘려보낼 수 있는
    입력은 한 자리에서 가른다" 철학과 정확히 같은 결의 보강이다. `OverrideTargetExtractionTest`에
    `"next > postcss"` 류 케이스를 추가해 현재 동작(공백 있으면 매칭 실패)을 최소한 문서화해 둘 것.

## 그 외 확인한 항목 (기존 8라운드 재검증, 이상 없음)

- **기능 완전성**: `chain_segments`/`override_target`/`load_override_targets`/`run_audit`/
  `classify_vulnerable`/`main` 전체 흐름 재추적 — widened(수용 범위 밖 재유입)/eroded(바닥 침식)
  2분류, 9곳 fail-closed가 plan §1 목적과 일치. 8가지 이미 검증된 override 키 형태(플레인·부모-자식·
  다단 체인·레인지·scope·scope 자식·체인 중간 scope·체인+scope+레인지)는 위 WARNING 2건이 지적하는
  "공백 포함" 형태를 제외하면 전부 코드 재추적으로 정확함을 재확인.
- **TODO/FIXME/HACK/XXX**: 0건(재확인).
- **의도와 구현 간 괴리**: `_undecidable()`→`NoReturn`+`sys.exit(2)` 계약은 유지되나, 위 WARNING
  1건("`run_audit()`은 판단 불가만 exit 2로 처리한다"는 함수 docstring `:171-174`의 취지)이 서브프로세스
  탐색 실패라는 특정 하위 경로에서는 실제로 지켜지지 않음을 확인 — 나머지는 일치.
- **에러 시나리오**: 9곳의 `_undecidable()` 호출은 각각 정확한 조건에서 exit 2로 고정되고
  `FailClosedSiteCountTest`가 이를 강제. 다만 위 WARNING 2건이 지적하는 두 경로는 "정상 흐름 외
  에러 상황"임에도 이 9곳 체계 밖에 있다.
- **반환값**: `main()`의 모든 도달 가능 경로가 명시적 `int`(0/1)를 반환하거나 `_undecidable()`이
  `NoReturn`으로 프로세스를 종료 — 단 WARNING 1(FileNotFoundError)의 경로는 `main()`에 도달하지
  못하고 인터프리터 최상위에서 처리되지 않은 예외로 종료되므로, "함수의 선언된 반환 계약" 관점에서는
  이 특정 예외가 그 계약 밖에서 프로세스를 끝낸다는 뜻이다.
- **비즈니스 로직**: "override 대상+취약 → eroded" vs "override 미대상 취약 → audit 잡 담당" vs
  "ignoreCves 억제분 중 경로 확대만 → widened" 3분류가 `main()`(현재 실측 라인 `:292-320`)의 계산과
  일치. `suppressed`가 `reported`를 배제해 구성되는 것(한 모듈에 억제+비억제 CVE 동시 존재 시 그
  실행의 `widened` 상세가 누락될 수 있음)은 6~8차 라운드가 이미 INFO로 정확히 특정해 둔 사안이며
  core fail-closed 불변식은 훼손되지 않는다는 판단에 이번 라운드도 동의 — 변화 없어 재론하지 않음.
- **spec fidelity**: `spec/` 전체 grep 재실행 결과 관련 문서 0건(재확인). `plan/in-progress/
  deps-guard-hardening.md`의 `spec_impact: none`과 Rationale("CI·스크립트·설정 변경으로 제품 명세와
  무관")이 실제와 일치 — line-level spec-코드 대조 대상 자체가 없음(정상, INFO).
- **리뷰 산출물 41개**(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33,04_58_18}/*`): 인용
  라인·수치(`_undecidable` 6→8→9곳)를 현재 코드와 교차 대조한 결과 사실관계 불일치 없음. 8차
  라운드가 보고한 `WidenedFilterTest`의 간헐적 flake(≈2%, 근본원인 미확정)는 같은 커밋(`614d72ba3`)이
  구조적 완화(원자적 rename 배치 + 마커 파일 자체 진단)로 조치했고, 이번 라운드의 독립 실행(41/41
  PASS 1회)은 그 조치와 모순되지 않는다 — 재현되지 않은 flake 특성상 이번 1회 실행만으로 완전
  해소를 확정할 수는 없으나 새로운 정보는 아니다.

## 요약

`scripts/check-override-floors.py`는 8라운드의 review-fix 사이클을 거치며 기능 완전성·엣지 케이스·
에러 시나리오·비즈니스 로직·반환값 전 영역에서 이미 매우 높은 수준으로 수렴해 있음을 라이브 실행·
41개 회귀 테스트·문서-코드 수치 대조로 재확인했다. `spec_impact: none`이 legitimate함도 재확인했다
(관련 spec 문서 없음, 정상 INFO). 이번 라운드에서 독립적으로 새로 찾은 것은 이 파일이 스스로
극도로 경계해 온 바로 그 실패 클래스("정상 흐름 밖 오류가 exit 1=erosion-발견과 혼동됨")의 잔여
사각지대 2곳이다 — (1) `run_audit()`의 서브프로세스 호출이 `TimeoutExpired`만 잡고 `pnpm` 바이너리
부재(`FileNotFoundError`) 등 `OSError` 계열은 못 잡아 traceback+exit 1로 죽는 것을 직접 재현
확인했다(직전 라운드가 형제 함수 `load_override_targets()`의 YAML 읽기 경로에는 이미 적용한 것과
동일한 보강이 이 서브프로세스 호출에는 빠져 있음). (2) `chain_segments()`가 체인 구분자 `>` 앞의
공백을 (OR-레인지 보호를 위해 의도적으로) 레인지 문법으로 오분류해, 공백이 섞인 체인형 override
키를 조용히 매칭 불가능한 대상으로 만드는 것을 직접 재현 확인했다 — 이쪽은 사촌 스크립트
`check-pnpm-security-config.py`의 baseline 정합 검사가 부분적 백스톱을 제공한다. 두 항목 모두
현재 저장소 상태(`pnpm-workspace.yaml`, CI 배선)에서는 트리거되지 않으며 Critical 급 즉각적 위험은
아니지만, 이 프로젝트 자신이 9곳에 걸쳐 매우 정교하게 적용해 온 fail-closed 철학의 사각지대라는
점에서 조치 가치가 있다. 그 외 8라운드가 이미 정리한 모든 항목(스키마 드리프트 2계열, override
키 8형태, 반환값 계약, 2-place 편집 규약 등)은 재검증 결과 이상이 없다.

## 위험도

MEDIUM — Critical 0, 신규 WARNING 2건. 둘 다 이 스크립트의 핵심 안전 불변식("exit 1은 오직
erosion 발견만을 의미한다")을 정면으로 건드리는 사각지대이나, 현재 실행 환경(CI 배선·현재
`pnpm-workspace.yaml` 내용)에서는 트리거되지 않고 하나는 사촌 스크립트의 부분적 백스톱까지 있어
즉각적 실사고 위험은 낮다고 판단해 HIGH 대신 MEDIUM으로 유지한다.
