# 아키텍처(Architecture) 리뷰 — harness-probe-isolation

## 범위 메모

이번 diff 는 전부 `.claude/tests/**` pytest 하네스 · `CHANGELOG.md` · `plan/**` · `review/**` 산출물이며
`codebase/**` 제품 코드는 건드리지 않는다. 프레젠테이션/비즈니스/데이터 레이어 분리 같은 제품 아키텍처
질문은 적용 대상이 없어, 분석은 **테스트 픽스처 설계의 구조적 품질**(SRP, 결합도, 확장점 재사용, 안티패턴
여부)에 집중했다. 소스는 diff 뿐 아니라 현재 체크아웃(`_harness.py`, `consistency_orchestrator.py`,
`test_consistency_bundle_priority.py`, `test_router_decision_trust.py`)을 직접 `Read`/`grep` 으로
대조해 게이트 줄번호와 실제 정의 위치가 일치함을 확인했다(뮤테이션 없음 — 읽기만 수행).

이 라운드(`10_45_12`)는 직전 라운드(`review/code/2026/09/25/10_27_27`)의 WARNING 2건(0-subtree
`CalledProcessError`, 5곳 완전 동일 부트스트랩)이 이미 커밋(`89ae9fa24`)으로 조치된 뒤의 전체 브랜치
diff 를 본다 — 두 조치를 실측으로 재확인했다:

- WARNING 1 (0-subtree) → `make_temp_repo_copy` 가 `git commit -q --allow-empty` 로 바뀌었고
  (`.claude/tests/_harness.py:164`), `TheRepoCopyFixtureTest.test_no_subtrees_is_an_empty_copy_not_an_error`
  가 그 경계를 직접 고정한다.
- WARNING 2 (5곳 완전 동일 부트스트랩) → `test_consistency_bundle_priority.py` 의 `_PREAMBLE` 이
  `extra=` 확장점에 `five_system_copy(tmp)` 헬퍼 정의 하나를 주입하고(`orchestrator_preamble(extra=...)`),
  5개 호출부(`grep` 확인: 654·691·728·781·899행)가 전부 `five_system_copy(tmp)` 한 줄만 쓴다. 중복은
  제거됐다.

## 발견사항

- **[INFO]** 프로세스 격리를 이루는 방식이 파일마다 세 갈래로 다르다 — 공용 추상화 없음(설계상 수용된 상태)
  - 위치: `.claude/tests/_harness.py:138`(`make_temp_repo_copy`, `run_in_orchestrator` 프리앰블 안에서
    씀), `.claude/tests/test_consistency_spec_draft_snapshot.py:57`(`_run(cwd, *args)` — `make_temp_git_repo`
    로 만든 저장소를 `cwd=` 로 CLI subprocess 에 직접 넘김), `.claude/tests/test_router_decision_trust.py:335`
    (`_prepare_over(..., cwd=REPO_ROOT)` — git 도 아닌 순수 `tempfile.mkdtemp()` 를 `cwd=` 로 넘김)
  - 상세: 세 파일이 "병렬 실행 시 쓰기가 공유 파일을 향하지 않게 한다"는 같은 목표를 서로 다른 메커니즘으로
    이룬다 — (1) fresh-interpreter 프리앰블 안에서 함수를 직접 호출하며 `root` 를 인자로 넘기는 방식,
    (2) 오케스트레이터 CLI 를 `cwd=` 로 재배치해 `repo_root() == os.getcwd()` 계약에 얹는 방식, (3) git 도
    없는 순수 임시 디렉터리를 `cwd=` 로 넘겨 오케스트레이터의 "명시 경로만 주면 git 미의존" 분기에 얹는
    방식. 셋 다 정확하게 동작함을 직접 소스 대조로 확인했다(`consistency_orchestrator.py:121` `repo_root()`
    가 실제로 `os.getcwd()`, 세 함수(`_edited_rels`/`_branch_changed_rels`/`collect_context`)가 전부
    `root` 를 명시 인자로 받음 — 암묵적 cwd 의존이 아니라 주입이라 `run_in_orchestrator` 가
    `cwd=str(REPO_ROOT)` 로 고정돼 있어도 안전하다). 다만 이 세 갈래를 하나의 `run_isolated(...)` 류
    헬퍼로 강제 통합하면, "git 저장소가 필요한가" · "오케스트레이터가 cwd 로 루트를 읽는가 인자로 읽는가"
    · "출력 세션도 옮겨야 하는가" 세 축이 갈려 분기만 늘어난다. 이 저장소가 이미 쓰는 방침
    (`project_reaper_engine_dry_refactor_920` — "axes 발산 시 full-unification 은 defer")과 일치하는
    선택이며, plan(`plan/in-progress/harness-probe-isolation.md`)도 §C 에서 "새 코드가 필요 없다" 는
    실측으로 각 갈래를 정당화했다.
  - 제안: 조치 불요. 다섯 번째 유사 픽스처가 생기는 시점에 재검토(이미 직전 라운드 architecture.md INFO
    가 같은 결론을 냈고, 이번 라운드에서도 유효함을 재확인).

- **[INFO]** 공유 테스트 인프라 헬퍼 자신을 직접 검증하는 계약 테스트가 새로 생겼다 — 긍정적 설계 관행
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:765`(`TheRepoCopyFixtureTest` 클래스),
    `.claude/tests/_harness.py:138`(대상 `make_temp_repo_copy`)
  - 상세: `make_temp_repo_copy` 는 그 소비자(4개 테스트 클래스, 5개 호출부)를 통해서만 간접 검증되다가,
    `update-ref` 줄을 지운 뮤턴트(P5)가 소비자 테스트 전부를 통과시킨 채 생존했다(plan §D 표). 소비자
    입장에서는 "미커밋 변경만 보면 되므로" 그 계약이 죽어도 안 보였던 것 — 공유 추상화의 암묵적 계약이
    소비자 테스트만으로는 커버되지 않는 전형적인 사례다. 대응으로 `TheRepoCopyFixtureTest` 가 헬퍼
    자체를 대상으로 "갓 만든 사본의 변경 집합은 비어 있다" · "사본에서 커밋한 변경은 `origin/main` 대비
    브랜치 diff 로 보인다" · "0-subtree 는 빈 커밋" 세 계약을 직접 단언한다. 공유 모듈이 여러 소비자의
    암묵적 가정에 기대는 대신 자신의 계약을 스스로 테스트로 명시하는 것은, `_harness.py` 를 "테스트
    SDK 레이어"로 다루는 이 저장소의 기존 태도(README 의 `git_in`/`load_module_by_path` 안전장치 문서화)
    와 일관되고, 향후 이 헬퍼가 다른 소비자에게 재사용될 때 회귀를 그 소비자가 아니라 헬퍼 자신의 테스트가
    먼저 잡아 준다.
  - 제안: 없음(참고 기록). 향후 `_harness.py` 에 공유 헬퍼가 추가될 때 이 패턴(소비자 테스트 + 헬퍼 자신의
    계약 테스트를 분리)을 유지할 것을 권장.

- **[INFO]** `make_temp_repo_copy` 가 git 객체가 아니라 살아있는 워킹트리를 `shutil.copytree` 로 읽는다 —
  경계가 "쓰기 측"으로 한정됨을 문서가 정확히 알림(과잉 보장 아님)
  - 위치: `.claude/tests/_harness.py:138-166`(`make_temp_repo_copy` 및 docstring)
  - 상세: 복사가 진행되는 순간 같은 서브트리(`spec/5-system`)를 편집 중인 다른 프로세스가 있으면 이론상
    부분 상태를 읽는 좁은 창이 남는다 — 직전 라운드 architecture.md 가 이미 지적한 축이며, 이번 라운드에서
    다시 확인해도 결론은 같다: docstring 4번째 문단이 "The copy reads the **working tree**, not git
    objects … What this closes is the write side" 라고 스스로 범위를 명시해, "완전 격리"로 오독될 여지를
    문서 자신이 차단한다(`feedback_documented_guarantee_wider_than_built` 관례 기준으로 봐도 과잉
    보장이 아니다). 이번 PR 이 실측으로 닫은 회귀 클래스(§B/§E, 잔여 5/6→0/6)는 전부 "쓰기 대 쓰기" 경쟁이었고
    "읽기 도중 쓰기"(torn read) 경로는 재현 대상이 아니었다.
  - 제안: 조치 불요. 후속에서 진짜 필요해지면(예: 대상 서브트리를 다른 세션이 상시 편집) `git archive`/
    `git show` 기반으로 git 객체를 스냅샷 떠 완전한 시점 고정을 논의할 수 있으나, 지금 규모(18개 파일,
    실측 0.115초)에서는 과설계다.

## 설계상 확인한 점 (조치 불요)

- `make_temp_repo_copy` 는 `make_temp_git_repo` 를 상속이 아니라 위임(호출)으로 확장한다(OCP) — 직전
  라운드 consistency-check 의 이름/역할 겹침(W2) 지적을 상속이 아니라 합성으로 풀어, 두 함수의 상위집합
  관계가 docstring 첫 줄에 명시된다.
- 네 테스트 파일 모두 오케스트레이터의 **기존에 이미 열려 있던** 루트 해석 경로(cwd 또는 인자)를 그대로
  썼다 — 격리를 위해 프로덕션 오케스트레이터 코드(`consistency_orchestrator.py`, `code_review_orchestrator.py`)
  에 테스트 전용 백도어나 새 파라미터를 추가하지 않았다. 프로덕션 진입점이 닫힌 채 유지된다는 점에서
  OCP 가 올바른 방향으로 지켜졌다.
- `orchestrator_preamble(extra=...)` 확장점이 정확히 의도대로 쓰였다 — 파일-로컬 픽스처(`five_system_copy`)는
  `_harness.py` 안으로 끌려 들어가지 않고 그 파일에만 존재한다. "서로 44~70% 만 비슷한 프리앰블은 공용
  코어만 뽑고 나머지는 각자 둔다"는 `_harness.py` 자신의 설계 원칙(176~185행 주석)과 일치한다.
- `test_consistency_spec_draft_snapshot.py::_run` 이 부모 환경에서 `CONSISTENCY_OUTPUT_DIR` 를 명시적으로
  제거하는 방어(`env = {k: v for k, v in os.environ.items() if k != "CONSISTENCY_OUTPUT_DIR"}`)는, cwd 를
  옮기는 것만으로는 부모 셸의 우연한 env var 가 격리를 깨뜨릴 수 있다는 점을 정확히 예상한 설계다.

## 순환 의존성 / 레이어 / 안티패턴

새 함수 `make_temp_repo_copy` 는 같은 모듈(`_harness.py`) 내부 함수(`make_temp_git_repo` → `git_in`)만
호출하고, 네 테스트 파일은 모두 `_harness` 를 단방향으로 import 한다 — 순환 의존 없음. 안티패턴(God
헬퍼, 테스트 전용 프로덕션 코드 오염, 상속 남용)은 발견되지 않았다. 사용된 패턴은 Test Data
Builder(`make_temp_git_repo` → `make_temp_repo_copy` 위임), Dependency Injection(오케스트레이터에
`root`/`cwd` 를 외부에서 주입), Contract Test(`TheRepoCopyFixtureTest` 가 공유 헬퍼의 계약을 직접
고정)로 셋 다 적절하다.

## 요약

harness-only 변경으로 제품 레이어 아키텍처에는 영향이 없다. 직전 라운드에서 지적된 WARNING 2건(0-subtree
실패, 5곳 부트스트랩 중복)은 각각 `--allow-empty` + 경계 테스트, `five_system_copy` 헬퍼 공유로 실제로
해소됐음을 소스 대조로 재확인했다. 남은 관찰은 전부 INFO 수준이다 — 세 갈래 격리 메커니즘의 병존은 발산
축이 갈려 있어 지금 통합하면 오히려 나빠지는 정당한 defer 이고(기존 저장소 방침과 합치), 워킹트리를
그대로 읽는 `shutil.copytree` 의 이론적 torn-read 여지는 문서가 스스로 "쓰기 측만 닫는다"고 정확히
scope 를 밝혀 과잉 보장이 아니다. 오히려 이번 라운드에서 새로 눈에 띈 긍정적 설계는, 소비자 테스트만으로는
안 잡히던 공유 헬퍼의 암묵적 계약(P5 뮤턴트 생존)을 헬퍼 자신을 대상으로 한 계약 테스트로 메운 점이다 —
공유 테스트 인프라를 1급 시민으로 취급하는 관행으로 향후에도 유지할 가치가 있다. 병합을 막을 아키텍처적
결함은 없다.

## 위험도

LOW
