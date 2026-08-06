### 발견사항

- **[WARNING]** `OneJudgeTest`(판정자 단일성 가드)의 금지 연산/임포트 목록이 `pathlib` 기반 재구현을 잡지 못한다
  - 위치: `.claude/tests/test_review_gate_ci.py:209-210` (금지 호출 튜플 `os.walk`/`glob.glob`/`glob.iglob`/`re.compile`/`subprocess.run`/`subprocess.check_output`/`open`), `:222` (금지 임포트 튜플 `re`/`glob`/`subprocess`)
  - 상세: 이 테스트의 docstring(179~188행)은 "판정을 자기가 계산하지 않는다"는 성질을 **단어가 아니라 연산**으로 고정하려 두 번 실패했다고 서술한다(1차: 전체 grep이 스크립트 docstring의 "review/code" 인용에 걸림, 2차: docstring을 걷어냈지만 사용자 안내 문구에 걸림). 그런데 동일 AST 로직을 독립적으로 재현해 측정한 결과(합성 스니펫에 실제로 실행), `Path(root).rglob("SUMMARY.md")`처럼 `pathlib` 기반으로 트리를 순회하는 재구현은 `called`/`imported` 어느 집합에도 걸리지 않고 통과한다 — attribute 호출의 `f.value`가 `ast.Name`이 아니라 호출식(`Path(root)`)일 때 `base`를 빈 문자열로 처리하므로 `rglob`이 아무 접두어 없이 그대로 들어가고, 금지 목록에는 `os.walk`/`glob.*` 계열만 있어 `pathlib` import 자체도 금지 대상이 아니다(직접 실행해 `any(b in called for b in banned_calls)`·`any(b in imported for b in banned_imports)` 둘 다 `False`임을 확인). 현재 `scripts/check-review-gate.py`는 실제로 `argparse`/`os`/`sys`만 임포트하고 이런 우회를 쓰지 않으므로(직접 확인) 지금 당장 발현되는 결함은 아니지만, 이 테스트 자신의 docstring이 "같은 성질이 다른 표현으로 두 번 재발했다"고 기록한 바로 그 실패 클래스가 세 번째 형태(연산은 다르지만 목적은 동일)로 재발할 수 있는 통로가 열려 있다.
  - 제안: 금지 목록에 `Path.rglob`/`Path.iterdir`/`Path.walk`(3.12+)/`os.scandir`/`os.listdir` 등 동등 기능의 attribute 이름과 `pathlib` import를 추가하거나, 블랙리스트 대신 화이트리스트(허용된 호출만 나열) 방식으로 뒤집는 것을 검토.

- **[INFO]** 스크립트/플랜 문서가 인용하는 "리뷰 산출물 파일 수" 실측치가 현재 HEAD 대비 이미 소폭 낡아 있다
  - 위치: `scripts/check-review-gate.py:22-23` ("8,851개", "review/ 전체 14,517개"), `plan/in-progress/harness-review-gate-ci-backstop.md` 동일 문구(§후보 (1) 하위)
  - 상세: 이 브랜치의 fork point인 `origin/main`(`06c2651c9`)에서 직접 `git ls-tree -r --name-only`로 측정하면 `review/code` 9,113개·`review/` 전체 14,779개로, 인용된 수치보다 각각 정확히 262개 많다. 같은 부모 PR(#1057) 병합 직전 상태(`9c7f4c7e7`)에서 재측정해도 8,964/14,630으로 여전히 불일치(델타 113/113, 두 지표 모두 코드/전체 델타가 서로 동일해 review/code 외 하위트리 증가는 없었던 것으로 보임) — 활발히 성장 중인 저장소에서 "실측 시점"과 "이 커밋 시점" 사이 자연스러운 드리프트로 보인다. 다만 이 수치가 뒷받침하는 정성적 결론("리뷰 산출물은 gitignored가 아니라 git에 커밋돼 있다")은 정확한 개수와 무관하게 그대로 유효함을 별도로 확인했다(`.gitignore`는 `review/**/_prompts/` 한 줄만 review 하위를 제외).
  - 제안: 설계 결정에는 영향 없음(관측 모드 진입 여부와 무관) — 정보성 기록. 이후 유사 인용 시 "측정 커밋 해시"를 같이 적어 두면 재검증이 쉬워진다.

- **[INFO]** 이 변경 영역을 규율하는 `spec/` 문서 없음 — 정상
  - 위치: 해당 없음 (`spec/` 전역, `grep -rl "review-gate\|review_guard" spec/` 결과 0건으로 확인)
  - 상세: `.claude/`, `.github/workflows/`, `scripts/check-review-gate.py`는 harness/CI 메타 도구이고 CLAUDE.md의 정보 저장 위치 규약상 `spec/`는 제품 정의만 다룬다 — spec 누락이 아니라 애초에 spec 대상이 아닌 영역. 이 변경의 SoT는 `plan/in-progress/harness-review-gate-ci-backstop.md`이며, `git show f2896147b -- plan/...`로 이 커밋이 그 문서에 가한 diff만 따로 뽑아 실제 구현과 line-level로 대조한 결과 — 체크박스 `[ ] → [x]` 전환, "구현 완료(관측 모드)" 배너, 재측정된 마찰 수치(435/355/80, dependabot 11+기타 69) — 모두 코드·워크플로 내용과 부합한다.

### 검증 방법 (요약)

- `scripts/check-review-gate.py`에 9종의 개별 뮤테이션을 적용(관측 모드 단락 제거, advisory `notes` 출력 루프 제거, `evaluate()` 예외 전파화, `_load_gate` import 실패 시 예외 전파화)하고 `.github/workflows/review-gate.yml`에 5종(dependabot 면제 제거, `--enforce` 조용한 활성화, 자기 트리거 경로 2곳 개별 제거)을 적용해 `test_review_gate_ci.py`의 대응 테스트가 정확히 RED로 전환되는지 확인 — 13개 테스트 중 "실패할 수 없는 테스트"는 발견되지 않았다. 모든 뮤테이션은 원본과의 `diff`가 0임을 재확인한 뒤 즉시 원복했다.
- `.github/workflows/harness-checks.yml`의 신규 `scripts/check-review-gate.py` 등재 항목을 제거해 `test_harness_checks_paths_coverage.py::test_every_guarded_file_is_covered`가 실제로 실패로 전환됨을 확인 — 장식용 주석이 아니라 하중을 받는 등재임을 확인.
- 임시 git 저장소를 만들어 `git fetch --no-tags origin <branch>`(명시 refspec 없는 형태)가 `refs/remotes/origin/<branch>`를 실제로 채우는지 직접 실험 — 채움을 확인. 동일 패턴이 이미 `migration-check.yml`(선례, 이 diff 이전부터 존재)에 있어 신규 리스크가 아님도 대조했다.
- 하네스 전체 스위트(`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`) 825개 테스트 OK — 커밋 메시지의 claim과 정확히 일치. `test_workflow_yaml_structure.py`(중복 키·run/uses 단일성 가드)를 별도로 실행해 이번에 건드린 두 워크플로 파일 모두 통과함을 확인 — PyYAML 도입 계기가 된 바로 그 사고 클래스가 재발하지 않았음을 기계적으로 확인.
- 스크립트가 호출하는 `review_guard.evaluate_review(cwd=None, *, in_flight_ok=False) -> ReviewDecision`의 실제 시그니처/필드(`blocked`, `reason`, `notes`)를 직접 읽어 `check-review-gate.py`의 호출부(`evaluate(root)`, `decision.blocked`, `decision.reason`, `getattr(decision, "notes", ()) or ()`)와 대조 — 전부 일치.
- `.gitignore`, 커밋 히스토리(squash-merge 비율: 게이트 이후 676개 first-parent 커밋 중 664개가 `(#N)`로 종료, 673개가 단일 부모 — 문서가 인용한 664/675와 거의 일치, 단일 부모 수만 2건 오차)를 대조해 "커밋 단위 = PR 단위" 전제를 부분 검증. "435건 중 80건(18%)" 자체는 과거 전체 이력을 걸쳐 `_summary_is_resolved`와 동일한 술어를 재구현해야 하는 규모라 이번 리뷰에서 독립 재현하지 않았다(위 INFO 항목의 실측 드리프트와 같은 성격의 한계).
- TODO/FIXME/HACK/XXX: 6개 파일 전체에서 0건.
- 새로 도입된 정규식 없음(review_guard.py의 기존 `_glob_to_regex`는 이번 diff의 대상이 아니며, 이미 wildcard 캡으로 보호돼 있음을 확인 — 이 백스톱이 그 보호를 상속만 할 뿐 새 위험을 만들지 않음).

### 요약

`scripts/check-review-gate.py` + `.github/workflows/review-gate.yml`은 스스로 서술한 목표 — "판정자는 로컬 훅과 동일한 `review_guard.evaluate_review()` 하나, 트리거만 독립, 기본은 관측 모드, fail-open, advisory는 판정과 무관하게 항상 출력" — 를 실제로 구현하고 있음을 코드 대조와 실행형 뮤테이션 테스트(총 14종: 스크립트 9종 + 워크플로 트리거 5종)로 각각 확인했으며, 전부 의도한 대로 RED로 전환돼 "실패할 수 없는 테스트"는 이 파일에서 발견되지 않았다. `harness-checks.yml`의 신규 등재 항목이 실제로 하중을 받는지도 뮤테이션으로 확인했고, 전체 하네스 스위트 825개와 워크플로 YAML 구조 가드가 모두 그린이다. `git fetch` 기반 base-ref 해석은 별도 실험 저장소로 직접 검증했고 기존 `migration-check.yml` 선례와 일치해 신규 리스크가 아니다. plan 문서(사실상 이 변경의 spec 역할)와 실제 diff는 line-level로 부합하며, 제품 `spec/`가 이 영역을 다루지 않는 것은 정상이다. 유일한 흠은 판정자-단일성 가드(`OneJudgeTest`) 자신의 금지 목록이 `pathlib` 기반 재구현을 못 잡는다는 것으로, 현재 산출물에는 실존하지 않는 잠재적 회귀 통로이며 즉각적 기능 결함은 아니다. 그 외 두 건은 활발히 성장하는 저장소에서 실측 수치가 커밋 시점 대비 자연 드리프트한 것으로, 설계 결정 자체에는 영향이 없는 정보성 기록이다.

### 위험도
LOW
