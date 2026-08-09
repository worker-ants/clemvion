# RESOLUTION — 21_53_16

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `6046963c3` | `test_toolchain_pins_did_not_drift_in_the_extraction` 을 `startswith` 존재 확인에서 `uses:` 값 정확 비교(`assertEqual`)로 강화 — `actions/setup-node@v7` / `pnpm/action-setup@v6.0.9`. 뮤테이션(`@v7`→`@v6`, `@v6.0.9`→`@v6.0.8`)으로 각각 RED 확인 후 원복 |
| #2 | 문서 | `6046963c3` | 모듈 docstring(1행, §왜 이 파일이 있는가) · `test_pnpm_receives_frozen_lockfile_and_the_filter` 실패 메시지 · `test_there_are_consumers` docstring/assertion/하한(8→9) · `.claude/tests/README.md` 카탈로그 행의 "8개 워크플로"를 "9개 잡(5개 워크플로, byte-identical 8 + backend typecheck-ratchet 1)"로 정정. `assertGreaterEqual` 유지(요청대로 `assertEqual` 로 바꾸지 않음) |
| #3 | 코드 | `6d156bee1` | `_MAY_SWALLOW` 예외 키를 `(path.name, step 이름)` → `(path.relative_to(REPO_ROOT).as_posix(), step 이름)` 로 변경, 기존 등재 항목도 `.github/workflows/e2e.yml` 형식으로 갱신. `_STEP_CONDITIONS`·`_SKIP_JOB_WORKFLOWS`·`_PULL_REQUEST_KEYS`·`_JOB_CONDITIONS` 는 실측 확인 결과 여전히 워크플로 전용이라 무수정. 뮤테이션(임시 2번째 composite action + 동명 continue-on-error 스텝)으로 pre-fix basename 키가 vacuous GREEN 을 내는 것과 fix 후 RED 로 잡히는 것을 둘 다 확인 후 원복 |

## TEST 결과

- lint  : 통과 (`.claude/tools/run-test.sh lint` — 51s)
- unit  : 통과 (`.claude/tools/run-test.sh unit` — 14 tests passed, 70s)
- harness suite : 통과 (`python3 -m unittest discover -s .claude/tests -p 'test_*.py'` — 995 tests OK)
- build : 별도 실행 불요 (변경 set 이 `.claude/**`/`.github/**`/`plan/**` 뿐, 빌드 대상 코드 무변경)
- e2e   : 면제 — `git diff --name-only origin/main...HEAD` 실측 결과 변경 set 이 `.claude/tests/README.md`, `.claude/tests/test_harness_checks_paths_coverage.py`, `.claude/tests/test_pnpm_workspace_action.py`, `.claude/tests/test_workflow_yaml_structure.py`, `.github/actions/pnpm-workspace/action.yml`, `.github/workflows/*.yml`, `plan/in-progress/*.md` 뿐이며 `codebase/**` 는 0건. PROJECT.md §e2e 면제 화이트리스트 인용: "`.claude/**` (skills, hooks, agents 정의)" · "`.github/**` (CI 정의는 e2e 가 검증 대상 아님)" · "`spec/**` · `plan/**` · `review/**` · ... · `PROJECT.md`" — 변경 set 은 이 목록의 **부분집합**이라 e2e 면제.

## 보류·후속 항목

- INFO 1 (서드파티 액션 SHA 미핀, 신뢰 지점 집중): `plan/in-progress/ci-required-check-skip-jobs.md` §후속(2026-08-09 21:53 세션)에 등재 완료.
- INFO 2 (`STUB`/`argv()` 헬퍼 `test_changed_paths_reusable.py` 중복, 3번째 사례 트리거): 위 §후속에 등재 완료.
- INFO 5 (`ConsumerBindingTest.consumers()` glob 비대칭 `*.yml` vs `*.y*ml`): 위 §후속에 등재 완료.
- 나머지 INFO(3·4·6·7·8·9·10·11)는 SUMMARY.md 지시대로 조치·등재 모두 불요 처리(기존 관례 답습 · 이미 등재 · 설계 의도 확인 기록).
- 민감 변경 가드 해당 없음 — 이번 라운드는 harness 테스트 로직·문서·plan 문서만 변경, DB/외부 API 계약/인증/결제/의존성 메이저 버전 변경 없음.

## 커밋

- `6046963c3` fix(ci): SUMMARY#1 SUMMARY#2 pnpm-workspace 액션 테스트 — 버전 핀 정확 비교 + 소비처 수 오기 정정
- `6d156bee1` fix(ci): SUMMARY#3 _MAY_SWALLOW 예외 키를 basename → 저장소 상대경로로
- `578aad4bf` docs(plan): composite action 추출 ai-review INFO 3건 후속 등재
