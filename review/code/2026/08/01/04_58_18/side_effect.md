# 부작용(Side Effect) 리뷰 — deps-guard-hardening (8차 라운드, 04_58_18)

## 스코프 메모

프롬프트에 전달된 31개 파일 중 실제 실행 가능한 코드는 `scripts/check-override-floors.py`
1개뿐이다(신규 파일, origin/main 대비 전체가 diff — diff 자체는 프롬프트 크기 제한으로
생략돼 저장소에서 직접 `Read`했다). 나머지 30개는 직전 세 라운드
(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33}/`)가 만든 정적 리뷰 산출물
(`SUMMARY.md`/`_retry_state.json`/`meta.json`/에이전트별 `*.md`)이다.

`git log`/`git show`로 확인한 결과, 직전 부작용 리뷰(`review/code/2026/08/01/04_35_33/side_effect.md`,
위험도 LOW)가 검토한 지점(HEAD `1598f542f`) 이후 이 파일에 남은 실제 코드 델타는 커밋
`fdc7ad801`("7차 리뷰 조치") 단 하나이며, `scripts/check-override-floors.py` 안에서 바뀐 줄은
`load_override_targets()`의 진단 메시지 조립부 3줄뿐이다. 나머지는 `.claude/tests/test_override_floors.py`
(라우터 스코프 밖, `.claude/**` 제외 정책과 일치)에 대한 테스트 추가와 `plan/` 문서 갱신이다. 판단은
프롬프트 요약이 아니라 `git show fdc7ad801`, 현재 소스 전체(`Read`), 관련 테스트 파일(`grep`/직접 열람)
대조로 내렸다.

## 발견사항

- **[INFO]** (확인) 이번 라운드의 유일한 실질 코드 델타 — `TypeError` fail-closed 수정이
  기존 동작을 보존하면서 크래시 경로만 제거함
  - 위치: `scripts/check-override-floors.py:139-146` (`load_override_targets()`, 특히 `:143-145`)
  - 상세: `sorted(data)` → `sorted(data, key=str)`로 바뀌었다. 이 호출은 `overrides` 키가
    매핑이 아니어서 `_undecidable()`로 fail-closed 하는 진단 메시지 조립 안에 있고, 그 자체가
    `if isinstance(data, dict) else type(data).__name__`로 감싸여 있어 `data`가 dict 가 아닐 때는
    호출조차 되지 않는다 — `None`/문자열 등에 대한 `sorted()` 오호출 위험은 이번 변경과 무관하게
    원래도 없다. `data`의 키가 전부 문자열인 통상 케이스에서는 `str(x) == x`이므로 `key=str` 적용
    전후로 정렬 결과가 동일하다(행동 보존). 직전 라운드(`04_35_33/side_effect.md` INFO 항목,
    `04_35_33/testing.md`는 다루지 않았으나 documentation/requirement 라운드가 각각 독립적으로
    지적)가 실측 프로브(`yaml.safe_load('overrides: "liquidjs"\n on: true\n')` → 최상위 키에
    `bool`/`str` 혼재 → `sorted()` 가 `TypeError`로 죽음)로 확인한 크래시 경로를 정확히 제거한다 —
    새 동작은 `str()`로 변환한 값을 정렬 키로만 쓰고 반환값 자체는 원본 요소(`True`/`False`/문자열)를
    그대로 유지하므로 fail-closed 진단 메시지의 정보량도 그대로다. 부작용 관점에서 신규 위험 없음.
  - 제안: 조치 불요.

- **[INFO]** (확인) 전체 파일의 부작용 프로파일 — 직전 3개 라운드(LOW 판정)와 동일하게 재확인됨
  - 위치: `scripts/check-override-floors.py` 전체
  - 상세: `global` 선언 0건, `os` 모듈 미임포트(환경 변수 읽기/쓰기 표면 자체가 없음),
    `open(`/`.write(`/`.write_text(`/`.unlink(`/`shutil.` 0건 — 유일한 파일시스템 접근은
    `:127`의 `path.read_text(encoding="utf-8")`(읽기 전용, `load_override_targets` 1회)다.
    `EXPECTED_SUPPRESSED_PATHS`(`:62-68`)를 포함한 모든 모듈 전역은 `.get()`으로만 읽히고
    어디서도 제자리 변경(in-place mutation)되지 않는다. 유일한 실질 부작용인 `pnpm audit`
    네트워크 호출(`:174-184`, `run_audit()`)은 파일 자신의 docstring 이 명시한 의도된 설계이고,
    `_AUDIT_TIMEOUT_SEC = 300`(`:77`)이 `.github/workflows/deps-security-checks.yml`의
    `override-floors` 잡 `timeout-minutes: 10`(직접 확인)보다 짧아 잡 자체가 죽기 전에 이
    스크립트가 fail-closed 로 먼저 끝나도록 배선돼 있다. 완전 신규 파일이라 시그니처를 깨뜨릴
    기존 호출자도 없다(저장소 전역 grep 결과 참조처는 `.claude/tests/test_override_floors.py`와
    문서뿐, git hook 미배선). 이번 델타(`fdc7ad801`)는 이 프로파일을 하나도 바꾸지 않았다.
  - 제안: 조치 불요.

- **[INFO]** (확인, 라우터 스코프 밖 직접 검증) 신규 `WidenedFilterTest`도 기존 격리 헬퍼를
  그대로 재사용해 부작용 없음
  - 위치: `.claude/tests/test_override_floors.py:390-419` (`WidenedFilterTest` 클래스,
    `_run` 은 `:403`, 테스트 메서드 2개는 `:410`/`:416`) — `run_with_stub_audit()`(`:87-131`) 호출
  - 상세: 이 커밋이 유일하게 프로덕션 로직을 건드리지 않고 추가한 테스트다(`main()`의
    `if module not in targets: continue`/`EXPECTED_SUPPRESSED_PATHS.get(module, set())`는
    이전 라운드부터 이미 존재하던 코드 — 이번엔 회귀 테스트만 신설). `run_with_stub_audit()`은
    `env = dict(os.environ, PATH=..., STUB_AUDIT_PAYLOAD=..., STUB_AUDIT_EXIT=...)`로 부모
    `os.environ`을 **복사**해 자식 프로세스에만 주입하고(제자리 변경 아님), 스텁 `pnpm`/워크스페이스
    YAML/payload 파일 전부 `tempfile.TemporaryDirectory()` 컨텍스트 안에서 생성돼 테스트 종료 시
    자동 정리된다 — 직전 라운드(`04_35_33/side_effect.md`)가 원문 코드 대조로 이미 확인한 격리
    메커니즘과 동일하며 이번 신규 테스트도 그 메커니즘만 재사용했다(헬퍼 자체는 수정되지 않음).
  - 제안: 조치 불요.

- **[INFO]** (메타, 반복 관측) 이번 라운드 페이로드도 같은 커밋(`fdc7ad801`)의 자매 파일
  (`.claude/tests/test_override_floors.py`, `plan/in-progress/deps-guard-hardening.md`)을
  포함하지 않음 — 코드 결함 아님, 직접 열람으로 부작용 없음 재확인
  - 위치: N/A (오케스트레이터/라우터 파일 선정 — 리뷰 대상 코드 자체의 결함 아님)
  - 상세: `git show --stat fdc7ad801`는 이 커밋이 `scripts/check-override-floors.py`(4줄) 외에
    `.claude/tests/test_override_floors.py`(+34줄)와 `plan/in-progress/deps-guard-hardening.md`
    (+16/-줄)도 함께 바꿨음을 보이지만, 이번 라운드의 31개 파일 목록에는 전자만 있다. 직전 라운드
    (`04_35_33/side_effect.md`)가 같은 패턴(테스트 파일 누락)을 이미 "오케스트레이터 페이로드
    구성 문제, 리뷰 대상 코드 결함 아님"으로 기록했고, `.claude/**` 제외는 `harness-checks.yml`
    별도 게이트와 일치하는 기존 정책이다(직전 라운드들이 반복 확인). 이번 라운드에서도 두 파일을
    직접 열어 대조한 결과(위 두 항목) 부작용 관점 결함은 없었으므로 최종 판단에는 영향 없다.
  - 제안: 조치 불요(반복되면 오케스트레이터 파일 선정 로직 점검 권장 — 이미 직전 라운드가 남긴
    권고와 동일).

- **[INFO]** 리뷰 산출물 30건(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33}/*`) —
  정적 문서·JSON 상태 파일, 런타임 부작용 표면 없음
  - 위치: 위 3개 세션 디렉터리 전체
  - 상세: 마크다운 20개는 실행되지 않는 정적 보고서. `_retry_state.json`×3/`meta.json`×3은
    `.claude/docs/subagent-call-contract.md`가 정의하는 orchestrator 상태 추적 표준 산출물로,
    세 세션 모두 스키마(키 구성)가 동일하고 값(세션 경로, `agents_forced_reasons`, `pending` 목록
    등)만 다르다 — 우발적 스키마 변경이나 새 필드 도입으로 다운스트림 소비자의 동작이 달라질
    소지는 관찰되지 않았다. 이는 직전 라운드가 같은 계열 파일(01_12_24~04_09_43)에 대해 이미
    내린 "dead field, 기록 전용" 판단과 일치한다.
  - 제안: 조치 불요.

## 요약

이번 8차 라운드에서 `scripts/check-override-floors.py`에 남은 실질 코드 델타는 커밋
`fdc7ad801`의 3줄(`sorted(data)` → `sorted(data, key=str)`)뿐이며, 이는 직전 라운드가 실측 프로브로
확인한 좁은 `TypeError` 크래시 경로를 제거하면서 통상 케이스(문자열 키)의 정렬 결과·정보량은
그대로 보존하는 순수 방어적 수정이다 — `isinstance(data, dict)` 가드 안에서만 호출되므로 신규
크래시 경로도 만들지 않는다. 전체 파일의 부작용 프로파일(전역 변수 제자리 변경 0건, `os` 모듈
미임포트로 환경 변수 표면 자체 없음, 파일시스템은 워크스페이스 YAML 읽기 1회, `pnpm audit` 네트워크
호출은 의도된 설계이며 300초 타임아웃이 CI 잡 타임아웃(10분)보다 짧게 배선됨, 완전 신규 파일이라
깨질 기존 시그니처/호출자 없음)은 직전 3개 라운드(모두 LOW)와 동일하게 재확인됐고 이번 델타로
바뀐 것이 없다. 라우터 스코프 밖의 신규 테스트(`WidenedFilterTest`)도 직접 열어 확인한 결과 기존
격리 헬퍼(`env` 복사, `tempfile.TemporaryDirectory`)를 그대로 재사용해 부작용이 없다. 유일하게
반복 기록해 둘 점은 이번 페이로드도 같은 커밋의 테스트·plan 문서 델타를 포함하지 않는다는
것인데(직전 라운드가 이미 지적한 것과 동일한 패턴), 직접 대조 결과 부작용 결함은 없어 최종
판단에는 영향이 없다. Critical·Warning 수준의 부작용 결함은 발견되지 않았다.

## 위험도

LOW
