# 부작용(Side Effect) 리뷰 — deps-guard-hardening (9차 라운드, 05_36_28)

## 스코프 메모

프롬프트에 전달된 42개 파일 중 실제 실행 가능한 코드는 `scripts/check-override-floors.py`
1개뿐이다(신규 파일 diff 는 프롬프트 크기 제한으로 생략돼 저장소에서 직접 `Read`했다). 나머지
41개는 직전 4개 라운드(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33,04_58_18}/`)가 만든
정적 리뷰 산출물(`SUMMARY.md`/`RESOLUTION.md`/`_retry_state.json`/`meta.json`/에이전트별 `*.md`)이다.

`git log`/`git show`로 확인한 결과, 직전 부작용 리뷰(`review/code/2026/08/01/04_58_18/side_effect.md`,
위험도 LOW)가 검토한 시점 이후 남은 유일한 실 코드 델타는 커밋 `614d72ba3`("8차 리뷰 조치 —
flaky 스텁을 구조로 제거 + sorted 회귀 테스트") 하나이며, `scripts/check-override-floors.py` 안에서
바뀐 곳은 `load_override_targets()`의 예외 처리 범위(3줄)와 모듈 docstring 문구(2줄)뿐이다. 같은
커밋이 `.claude/tests/test_override_floors.py`(+64/-8줄, 라우터 스코프 밖)와
`plan/in-progress/deps-guard-hardening.md`도 함께 바꿨는데, 이번 라운드 페이로드에는 전자가
빠져 있어 저장소에서 직접 `Read`/`grep`으로 대조했다.

## 발견사항

- **[INFO]** (확인) 이번 라운드의 유일한 실질 코드 델타 — 예외 처리 범위 확장이 새 실패
  경로를 만들지 않고 기존 크래시 경로 하나를 fail-closed 로 흡수함
  - 위치: `scripts/check-override-floors.py:128-135` (`load_override_targets()`)
  - 상세: 이전에는 `text = path.read_text(encoding="utf-8")`가 `try` 블록 **밖**에 있어, 읽기
    자체가 실패하면(권한 오류·`main()`의 `WORKSPACE_YAML.exists()` 확인 이후 파일이 삭제되는
    TOCTOU 경합·잘못된 인코딩) 잡히지 않은 예외가 traceback 과 함께 파이썬 기본 종료코드 1로
    프로세스를 끝냈다. 이 스크립트의 어휘에서 exit 1 은 "침식 발견"을 뜻하므로, 이는 스크립트가
    막으려는 정확히 그 실패 클래스(설정/입력 문제가 정상 신호와 같은 코드로 위장)를 자기 자신이
    재현하는 셈이었다. 이번 델타는 `read_text()` 호출을 같은 `try` 블록 안으로 옮기고
    `except` 튜플에 `UnicodeDecodeError`/`OSError`를 추가해, 이 경로도 나머지 8곳과 동일하게
    `_undecidable()`(exit 2, 명확한 사유 문자열)로 fail-closed 시킨다. `yaml.safe_load()`가
    `OSError`를 내는 경로는 없어(문자열 파싱만 수행) 이 범위 확장이 무관한 예외를 대신 삼킬
    위험은 없다. 함수 시그니처(`path: pathlib.Path -> dict[str, list[str]]`)·반환 계약은
    그대로이고, 호출부(`main()`, `:281`)도 수정되지 않았다 — 인터페이스 변경 없음.
  - 제안: 조치 불요. 부작용 관점에서 위험을 새로 만들지 않고 하나 줄인 변경.

- **[INFO]** (확인) 테스트 헬퍼의 신규 파일시스템 부작용은 전부 `tempfile.TemporaryDirectory()`
  격리 안에 있고, `os.environ` 은 사본만 넘긴다 — 프로덕션 코드·영속 상태 무영향
  - 위치: `.claude/tests/test_override_floors.py:75`(스텁 스크립트 안의 마커 파일 write),
    `:129`(`with tempfile.TemporaryDirectory() as tmp:`), `:139-143`(스텁을 임시 이름에 쓰고
    `chmod` 후 `os.replace`로 원자적 배치), `:144`(`marker = tmp / "stub-ran"`),
    `:145-151`(`env = dict(os.environ, ..., STUB_RAN_MARKER=str(marker))`)
  - 상세: 새로 추가된 파일 연산(`staged.write_text`/`staged.chmod`/`os.replace`/마커 파일 생성)은
    모두 `with tempfile.TemporaryDirectory() as tmp:` 블록 안에서 생성된 경로(`tmp/bin/...`,
    `tmp/stub-ran`)에 대해서만 일어나고, 블록을 벗어나면 자동 정리된다. `env = dict(os.environ,
    ...)`는 부모 `os.environ`을 새 dict 로 복사해 자식 프로세스에만 주입하는 기존 패턴(직전
    라운드가 이미 확인한 것과 동일)을 그대로 재사용했을 뿐 `os.environ[...] = ...` 형태의 제자리
    변경은 없다(저장소 전체 `grep` 결과 이 파일에 해당 패턴 0건). 마커 파일 존재 확인
    (`:158`)은 `subprocess.run(...)`이 **완료된 뒤**(POSIX 상 자식 프로세스 종료 후 그 프로세스가
    쓴 파일은 부모에게 항상 보이므로) 수행되어 그 자체가 새로운 경합을 도입하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** (확인) 테스트 헬퍼 `run_with_stub_audit()` 시그니처 확장 — 하위 호환 유지, 외부
  소비자 없음을 저장소 전역에서 재확인
  - 위치: `.claude/tests/test_override_floors.py:97-101` (`expect_stub_ran: bool = True` 추가)
  - 상세: 신규 파라미터가 기본값 `True`를 가져 기존 호출부(파라미터 미지정)의 동작은 그대로다
    (스텁이 실행됐는지 사후 검증하는 조건이 하나 늘 뿐, 정상 스텁 경로에서는 항상 참이라
    관측 가능한 차이가 없다). `expect_stub_ran=False`로 호출부를 바꾼 5곳(overrides 키
    부재/오타/값 없음/비-매핑/YAML 파싱 불가 — 스크립트가 audit 을 실행하기 전에 이미 종료하는
    경로들)은 실제로 스텁이 안 도는 게 맞는 시나리오라 새 검증과 정합적이다. 저장소 전체
    `grep -rn "run_with_stub_audit"` 결과 이 함수는 `.claude/tests/test_override_floors.py`
    내부에서만 호출되고(`PROJECT.md`/`.claude/tests/README.md`는 산문 언급뿐, import 아님),
    외부 모듈이 이 시그니처에 의존하지 않으므로 파손되는 호출자가 없다.
  - 제안: 조치 불요.

- **[INFO]** (메타, 반복 관측 — 직전 2개 라운드와 동일 패턴) 이번 라운드 페이로드도 같은 커밋
  (`614d72ba3`)의 자매 파일(`.claude/tests/test_override_floors.py`,
  `plan/in-progress/deps-guard-hardening.md`)을 포함하지 않음 — 코드 결함 아님, 직접 열람으로
  부작용 없음 재확인(위 두 항목)
  - 위치: N/A (오케스트레이터/라우터 파일 선정 — 리뷰 대상 코드 자체의 결함 아님)
  - 상세: `git show --stat 614d72ba3`는 이 커밋이 `scripts/check-override-floors.py`(16줄) 외에
    `.claude/tests/test_override_floors.py`(+64/-8줄)와 `plan/in-progress/deps-guard-hardening.md`
    (+19줄)도 함께 바꿨음을 보이지만, 이번 라운드의 42개 파일 목록에는 스크립트만 있다. 직전
    두 라운드(`04_35_33/side_effect.md`, `04_58_18/side_effect.md`)가 같은 패턴을 이미
    "오케스트레이터 페이로드 구성 문제, 리뷰 대상 코드 결함 아님"으로 기록했고, `.claude/**`
    제외는 `harness-checks.yml` 별도 게이트와 일치하는 기존 정책이다. 이번 라운드에서도 직접
    열어 대조한 결과(위 두 항목) 부작용 관점 결함은 없었으므로 최종 판단에는 영향 없다.
  - 제안: 조치 불요(3회 연속 반복이면 오케스트레이터 파일 선정 로직 점검을 권장 — 직전 라운드가
    남긴 권고와 동일. 현재까지는 매번 직접 대조로 안전이 확인돼 왔다).

- **[INFO]** (확인) 전체 파일의 부작용 프로파일 — 직전 4개 라운드(모두 LOW)와 동일하게
  재확인됨, 이번 델타로 바뀐 것 없음
  - 위치: `scripts/check-override-floors.py` 전체
  - 상세: `global` 선언 0건, `os` 모듈 미임포트(환경 변수 읽기/쓰기 표면 자체가 없음),
    `open(`/`.write(`/`.write_text(`/`.unlink(`/`shutil.` 0건(`grep` 재확인) — 유일한 파일시스템
    접근은 `load_override_targets()`의 `path.read_text()`(읽기 전용, 1회)다. `sys.exit(` 호출은
    정확히 4곳(`:52` PyYAML import 실패, `:165` `_undecidable()` 내부, `:365`
    `if __name__ == "__main__"` 블록의 `main()` 반환값) — 이번 델타로 늘거나 준 곳이 없다.
    `EXPECTED_SUPPRESSED_PATHS`를 포함한 모든 모듈 전역은 `.get()`으로만 읽히고 제자리
    변경되지 않는다. `run_audit()`의 `pnpm audit` 네트워크 호출(`:168-210`)은 이번 델타가
    건드리지 않았고, `_AUDIT_TIMEOUT_SEC = 300`(`:78`)도 그대로다. 완전 신규 파일 계열이라
    깨질 기존 시그니처/호출자가 없다는 점도 직전 라운드들과 동일.
  - 제안: 조치 불요.

## 요약

이번 9차 라운드(`05_36_28`)에서 `scripts/check-override-floors.py`에 남은 실질 코드 델타는 커밋
`614d72ba3`의 `load_override_targets()` 예외 처리 범위 확장(3줄)과 docstring 문구 정리(2줄)뿐이며,
전자는 `read_text()`를 기존 `try` 블록 안으로 옮기고 `UnicodeDecodeError`/`OSError`를 추가로
잡아, 이전엔 잡히지 않은 예외로 traceback + 파이썬 기본 exit 1(이 스크립트 어휘에서 "침식
발견"과 같은 코드)로 죽던 좁은 경로 하나를 나머지 fail-closed 지점들과 동일하게 exit 2 로
흡수한다 — 새 위험 표면을 만들지 않고 기존 위험 하나를 줄이는 순수 방어적 변경이다. 함수
시그니처·반환 계약·호출부는 그대로다. 라우터 스코프 밖의 동반 테스트 파일 변경
(`STUB_RAN_MARKER` 마커, 원자적 rename 스테이징, `run_with_stub_audit()`의 `expect_stub_ran`
파라미터 추가)도 직접 열어 확인한 결과 전부 `tempfile.TemporaryDirectory()` 안에서만 일어나고
`os.environ`은 사본으로만 다루며, 시그니처 확장은 기본값으로 하위 호환을 유지하고 이 함수의
유일한 소비자(같은 파일 내부)만 갱신돼 있어 부작용이 없다. 전체 파일의 부작용 프로파일(전역
변수 제자리 변경 0건, `os` 모듈 미임포트로 환경 변수 표면 자체 없음, 파일시스템은 워크스페이스
YAML 읽기 1회, `pnpm audit` 네트워크 호출은 기존 설계 그대로, 완전 신규 파일이라 깨질 기존
시그니처/호출자 없음)은 직전 4개 라운드(모두 LOW)와 동일하게 재확인됐다. 유일하게 반복 기록해
둘 점은 이번 페이로드도 같은 커밋의 테스트·plan 문서 델타를 포함하지 않는다는 것인데(직전
두 라운드가 이미 지적한 것과 동일한 패턴), 직접 대조 결과 부작용 결함은 없어 최종 판단에는
영향이 없다. Critical·Warning 수준의 부작용 결함은 발견되지 않았다.

## 위험도

LOW
