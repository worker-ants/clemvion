# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** `TEST_FILE_RULES["frontend"]` 정규식이 tsconfig 가 실제로 제외하는 `*.spec.ts(x)` 패턴을 빠뜨렸다
  - 위치: `.claude/tests/test_typecheck_ratchet.py:77-80`
  - 상세: `codebase/frontend/tsconfig.json` 의 `exclude` 는 `src/test/**` · `*.test.ts(x)` · `*.spec.ts(x)` · `**/__tests__/**` 네 가지를 담고 있고(`codebase/frontend/tsconfig.json:33-39`), `scripts/check-frontend-typecheck-ratchet.py` 의 docstring 도 이 네 가지를 그대로 나열한다. 그런데 baseline 이 "테스트 파일만" 담고 있는지 검증하는 `TEST_FILE_RULES["frontend"] = re.compile(r"(?:^|/)__tests__/|\.test\.tsx?$|(?:^|/)src/test/")` 는 `\.spec\.tsx?$` 갈래가 빠져 있다(backend 쪽 규칙 `\.spec\.tsx?$` 와 대칭이 안 맞는다). 지금은 저장소의 frontend `.spec.ts` 파일 3개(`generate-unique-label.spec.ts` 등)가 모두 `__tests__/` 디렉터리 안에 있어 다른 갈래로 우연히 매치되므로 `test_baselines_only_list_test_files`/`test_baseline_contains_files_the_base_config_excludes` 가 통과하지만, `__tests__/`·`src/test/` 밖에 colocate 된 `*.spec.ts` 가 baseline 에 진단을 내는 순간 "프로덕션 파일이 타입 진단을 내고 있다"로 오분류되어 거짓 실패를 낸다. 이 PR 자체의 근거 문구("사본을 만들면 규칙이 갈리는데 틀리는 방향이 조용한 통과라 특히 나쁘다")가 정확히 경고하는 클래스의 축소판이 이 정규식-tsconfig 쌍에 남아 있다.
  - 제안: `"frontend": re.compile(r"(?:^|/)__tests__/|\.(?:test|spec)\.tsx?$|(?:^|/)src/test/")` 로 `.spec.ts(x)` 갈래를 추가하거나, 두 곳(tsconfig exclude 목록·정규식)이 갈리지 않도록 tsconfig 의 exclude 배열을 읽어 정규식을 도출하는 방식을 고려할 것.

- **[INFO]** `RatchetConfig` 7필드 리터럴이 헬퍼를 우회해 한 곳에 더 중복돼 있다
  - 위치: `.claude/tests/test_typecheck_ratchet.py:235-242` (`test_tsc_is_invoked_with_the_configured_tsconfig`)
  - 상세: 같은 파일에 이미 `fake_config(baseline)` 헬퍼(`.claude/tests/test_typecheck_ratchet.py:90-99`)가 있는데, `tsconfig` 필드 하나만 다른 설정이 필요한 이 테스트는 헬퍼를 쓰지 않고 7개 필드를 `CORE.RatchetConfig(...)` 로 다시 나열했다. `@dataclass(frozen=True)` 이므로 `dataclasses.replace(fake_config(tmp), tsconfig="tsconfig.typecheck.json")` 로 줄이면 필드가 늘어날 때(예: 향후 옵션 추가) 갱신 지점이 하나로 줄어든다.
  - 제안: `dataclasses.replace` 활용해 중복 제거.

- **[INFO]** docstring 안에서 한 줄만 재래핑을 놓쳐 형제 줄 대비 과도하게 길다
  - 위치: `scripts/check-frontend-typecheck-ratchet.py:32`
  - 상세: "## 착수 시 실측" 문단의 다른 줄들은 대략 90~120자로 줄바꿈돼 있는데, 32번째 줄("전면 승격하려면 그 51건을 먼저 처분해야 하고 …")만 약 206자로 눈에 띄게 길다 — 편집 중 재줄바꿈을 빠뜨린 흔적으로 보인다.
  - 제안: 인접 줄과 동일한 폭으로 재줄바꿈.

## 요약

이번 변경의 핵심은 `check-backend-typecheck-ratchet.py` 안에 있던 판정 로직(파싱·baseline 대조·fail-closed 처리)을 `scripts/_typecheck_ratchet.py` 공유 코어로 뽑아내고, backend/frontend 두 엔트리포인트는 `RatchetConfig` 값 주입만 담당하도록 재구성한 것이다. 이 저장소가 반복해서 겪은 "같은 판정 로직의 독립 사본이 조용히 갈리는" 실패 클래스(`plan_guard.py`↔`plan-stale-audit.sh`)를 정확히 겨냥한 설계이고, 함수 분리(`run_tsc`/`count_by_file`/`load_baseline`/`write_baseline`/`verdict`/`main`)·네이밍·문서화(각 함수·데이터클래스 필드에 "왜"를 남긴 docstring)가 일관되고 함수 길이·중첩 깊이 모두 양호하다. 테스트 파일도 구 `test_backend_typecheck_ratchet.py` 를 삭제하고 `test_typecheck_ratchet.py` 하나로 두 패키지를 `subTest` 로 묶어 같은 원칙을 스스로 지킨다. 다만 그 통합의 이음매에서 frontend 전용 `TEST_FILE_RULES` 정규식이 tsconfig 의 실제 exclude 패턴(`*.spec.ts(x)`)과 완전히 대칭이지 않아, 이 PR 이 스스로 경고하는 "규칙이 갈리는" 위험의 축소판이 하나 남아 있다(WARNING 1건). 나머지는 사소한 중복/서식 정돈 수준의 INFO 2건이다.

## 위험도
LOW
