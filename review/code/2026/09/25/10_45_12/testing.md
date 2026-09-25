# 테스트(Testing) 리뷰 — harness-probe-isolation (2라운드, `10_45_12`)

## 검증 절차

리포트를 쓰기 전에 직접 실행해 확인했다(저장소 트리에는 쓰지 않음 — 대상 4개 테스트 파일을
이 워크트리에서 그대로 실행):

```
python3 -m pytest .claude/tests/test_consistency_bundle_priority.py \
  .claude/tests/test_consistency_spec_draft_snapshot.py \
  .claude/tests/test_consistency_target_validation.py \
  .claude/tests/test_router_decision_trust.py -q
→ 74 passed, 4 subtests passed in 11.41s
```

1라운드(`10_27_27`) 실측(73 passed)보다 1개 늘었는데, W1 조치로 추가된
`TheRepoCopyFixtureTest.test_no_subtrees_is_an_empty_copy_not_an_error` 와 정합한다. 실행 후
`git status --short` 는 `review/code/2026/09/25/10_45_12/` 외 변경이 없음을 확인했다(리뷰
세션 자신이 만든 산출물뿐 — 대상 코드 실행이 저장소 트리에 쓴 흔적 없음).

## 1라운드 WARNING 두 건에 대한 회귀 확인

- **W1(`make_temp_repo_copy(path)` 0-subtree 호출 시 `CalledProcessError`)** — `git commit`
  이 `-q --allow-empty -m "copy of this checkout"` 로 바뀌었고(`.claude/tests/_harness.py:169`),
  경계 테스트 `TheRepoCopyFixtureTest.test_no_subtrees_is_an_empty_copy_not_an_error`
  (`.claude/tests/test_consistency_bundle_priority.py:796-805`)가 `origin/main == HEAD` ·
  `ls-files == [".gitkeep"]` 를 직접 잰다. 뮤턴트 P7(`--allow-empty` 제거) 이 이 테스트 1개만
  RED 를 낸다는 plan 기록과 일치 — 실측으로 재확인됨.
- **W2(다섯 호출부의 바이트-동일 부트스트랩 중복)** — `_PREAMBLE` 의 `extra=` 로 `five_system_copy(tmp)`
  헬퍼 하나를 주입하고(`.claude/tests/test_consistency_bundle_priority.py:44-57`), 다섯 호출부
  전부(644·691·728·781·899행) 이 헬퍼를 쓴다. `grep` 으로 5곳 전수 확인 — 누락된 호출부 없음.
  `TheRepoCopyFixtureTest.test_no_subtrees_is_an_empty_copy_not_an_error`(800행)만 경계 테스트라
  의도적으로 헬퍼를 안 쓴다 — 이것도 맞는 선택이다(0-subtree 를 재려는 테스트가 5-subtree 헬퍼를
  쓰면 자기모순).

두 조치 모두 "테스트로 고정" 이라는 이 프로젝트의 기준을 충족한다 — 문서 수정이 아니라 RED 를
낼 수 있는 assertion 으로 닫았다.

## 발견사항

- **[INFO]** 이 PR 이 막으려는 실제 경쟁(병렬 pytest 프로세스가 서로의 프로브를 트램플)을 재현하는
  **상시 회귀 테스트가 없다** — 재현은 `scratchpad/race_repro.py`(미커밋, plan §B)뿐이고, 하네스에
  남는 것은 개별 뮤테이션 테스트(P1~P7, 단일 프로세스 관점)와 산문 규약(`README.md:109`)이다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` `TheDocumentBeingEditedIsNeverOmittedTest`
    클래스 전체(격리 원인이 되는 부분), `.claude/tests/README.md:109-118`(규약)
  - 상세: 1라운드 testing 리뷰(`review/code/2026/09/25/10_27_27/testing.md`)가 이미 지적했고,
    `plan/in-progress/harness-review-gate-followups.md` 에 신규 백로그 항목(«이 체크아웃에 쓰지
    않는다» 가 산문 규약뿐 — 감사 훅 census 를 상시 가드로)으로 등재됐다(RESOLUTION `10_27_27`
    INFO 1 처분). 유예 근거(비용 산정 필요·이 PR 축과 다름)가 plan 에 실측 함정 셋과 함께 남아
    있어 "유예 근거는 실측해야 한다" 관례를 충족한다 — 재지적이지만 **아직 열려 있다는 사실**만
    다시 남긴다. 다섯 번째 테스트 파일이 같은 안티패턴을 재도입해도 `pytest` 한 번으로는 못 잡고
    `/ai-review` 대기가 필요하다.
  - 제안: 조치 불요(이미 백로그 등재·근거 기록됨). 후속 세션에서 그 백로그 항목을 집을 때 이
    리뷰를 참조.

- **[INFO]** `make_temp_repo_copy` 의 `subtrees` 인자에 대한 입력 검증 테스트가 여전히 없다 —
  존재하지 않는 경로 · 중첩 경로(`("spec", "spec/5-system")`) 를 넘겼을 때의 동작(각각
  `FileNotFoundError` / `FileExistsError`)이 테스트로 고정되지 않는다.
  - 위치: `.claude/tests/_harness.py:138-171`(`make_temp_repo_copy`, 특히 166-167행
    `for rel in subtrees: shutil.copytree(...)`)
  - 상세: 1라운드 requirement 리뷰가 중첩 subtree 케이스를 INFO 로 지적했고(조치 불요 처분),
    이번 라운드에도 코드는 그대로다. 현재 호출부 5곳 전부 `"spec/5-system"` 단일·정확한 경로만
    쓰므로 오늘 당장 위험은 없다. 다만 0-subtree 경계는 이번에 테스트로 닫혔는데(W1) 나머지 두
    입력 이상 경로(오탈자·중첩)는 여전히 미검증 — "빈 컬렉션" 만 닫고 "잘못된 원소" 는 열려
    있다는 점에서 엣지 케이스 커버리지가 비대칭적이다.
  - 제안: 우선순위 낮음. 실제로 다중/중첩 subtree 호출부가 생기기 전까지는 조치 불요 — 지금
    추가하면 방어 코드가 아니라 이론적 커버리지만 늘린다.

## 긍정적으로 확인한 점

- **뮤테이션 검증의 완전성**: plan §D 표(P1·P1b·P2~P7)가 예측을 먼저 적고 실측으로 대조하는
  방식을 그대로 따랐고, 실제로 하나(P5 — `update-ref` 제거)가 생존해 `TheRepoCopyFixtureTest`
  라는 새 계약 테스트로 메워진 이력이 커밋 로그(`128cc9746`)와 테스트 코드에 모두 남아 있다 —
  "설계 근거는 뮤턴트로 반증해 본다" 는 기준을 실제로 충족한 사례다.
- **회귀 테스트 유효성**: 순위 단언을 `assertLess(rank, tier0_size)` 에서
  `assertEqual(tier0_size, 1)` + `assertEqual(rank, 0)` 으로 좁힌 근거(사본은
  `origin/main == HEAD` 라 변경 집합이 프로브 하나뿐)가 `TheRepoCopyFixtureTest` 로 별도 고정돼
  있어, "그 전제가 실제로 성립하는가" 를 다음 사람이 다시 증명할 필요가 없다
  (`.claude/tests/test_consistency_bundle_priority.py:669-681, 683-715`).
- **테스트 격리**: 4개 파일 모두 `tempfile.TemporaryDirectory()`/`mkdtemp()` 로 테스트마다
  유일한 루트를 받고, orchestrator 구동은 별도 서브프로세스(fresh interpreter)라 `sys.modules`
  오염이나 프로세스 간 공유 가변 상태가 없다. `test_consistency_target_validation.py` 의 나머지
  5개 테스트(env 미지정)는 `env=None` 이 `subprocess.run` 기본값과 동일해 회귀 없음을 확인했다.
- **Mock 적절성**: `orch._edited_rels = lambda ...` 몽키패치는 서브프로세스 내부에서만 유효해
  다른 테스트로 새지 않는다. 실제 git 호출은 스텁하지 않고 `_harness.git_in` 을 그대로 태워
  "무엇을 검증하는지" 와 "무엇을 스텁했는지" 가 각 테스트 주석에 명시돼 실제 동작과의 괴리가
  없다.
- **가독성**: 각 테스트·헬퍼 docstring 이 "왜 이렇게 재는가" 를 과거 실측치(날짜·라운드 수·잔여
  파일 수)와 함께 남겨, 다음 사람이 같은 실수를 반복하지 않도록 설계돼 있다.

## 요약

1라운드에서 지적된 두 WARNING(0-subtree 크래시, 부트스트랩 5중복)은 모두 RED 를 낼 수 있는
전용 테스트로 닫혔고 실측(74 passed, `git status` 무잔여)으로 재확인했다. 핵심 변경
(`_harness.make_temp_repo_copy` + 4개 테스트 파일의 프로브 격리)은 뮤테이션 테스트 전수
KILLED·전후 census(97→0행)·병렬 재현(잔여 5/6→0/6) 세 축으로 뒷받침되며, 테스트 격리·가독성·
Mock 사용 모두 이 저장소의 기존 기준에 부합한다. 남은 갭은 둘 다 INFO 수준이다 — (1) 이 PR 이
막는 실제 동시성 결함을 재현하는 상시 회귀 테스트가 없고 개별 뮤테이션 테스트로만 대체돼
있다는 점(이미 백로그 등재·유예 근거 기록됨), (2) `make_temp_repo_copy` 의 subtrees 입력
이상 경로(오탈자·중첩)가 여전히 미검증이라는 점(현재 호출부는 전부 안전). 둘 다 병합을 막을
수준은 아니다.

## 위험도

LOW
