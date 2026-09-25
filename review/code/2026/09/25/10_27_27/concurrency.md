# 동시성(Concurrency) 리뷰

## 개요

이번 변경은 본질적으로 **동시성 결함(경쟁 조건) 수정**이다. `.claude/tests/` 하네스의 테스트 4개가
공유 워크트리(`REPO_ROOT`)의 실제 파일(추적된 spec, `plan/in-progress/`, `review/consistency/`, 저장소
루트 임시 디렉터리)에 직접 프로브를 쓰고 `cp` 로 원복하던 패턴이, 병렬로 여러 pytest 프로세스가 같은
워크트리에서 돌 때 서로의 프로브를 밟는 실제 레이스를 유발했다(측정: 4개 동시 실행 6라운드 중 5라운드에서
`spec/5-system/7-llm-client.md` 에 프로브 잔여, 24개 중 22개 실패). 수정은 "락으로 순서를 강제"하는
대신 **공유 자원 자체를 제거**하는 설계 — 테스트마다 격리된 임시 git 저장소 사본(`_harness.make_temp_repo_copy`)
또는 임시 출력 디렉터리(`CONSISTENCY_OUTPUT_DIR`/`REVIEW_OUTPUT_DIR` 재지정)로 대상을 옮겨, 프로세스 간
공유 가변 상태를 없앴다.

## 발견사항

- **[INFO]** 새 격리 규약이 순수 관례(문서)로만 강제된다 — 런타임 가드 부재
  - 위치: `.claude/tests/README.md:109` (게이트 기준, 신설 bullet "Never write into this checkout")
  - 상세: 이번 수정으로 네 테스트는 고쳐졌지만, "이 체크아웃에 쓰지 않는다"는 규약 자체는 README 문장과
    코드 리뷰 관행에 의존한다. 향후 새 테스트가 다시 `REPO_ROOT` 에 직접 쓰는 프로브를 추가해도 이를
    막는 자동화된 가드(예: `sys.addaudithook` 기반의 CI 단계, 혹은 `_harness.git_in` 류의 강제 경유)는
    diff 안에 보이지 않는다. plan 문서(`plan/in-progress/harness-probe-isolation.md` §A)에 등장하는
    감사 훅(`sitecustomize.py` + `sys.addaudithook`)은 이번 수정을 **측정**하는 데는 쓰였지만, 회귀를
    막는 상시 CI 게이트로 배선된 근거는 이 diff 범위에는 없다.
  - 제안: (선택) 측정에 쓴 감사 훅을 `python3 -m pytest .claude/tests -q` 실행 경로에 opt-in 가드로
    남겨, 향후 회귀를 자동으로 잡을 수 있게 하는 방안을 백로그에 남길 것. 다만 이는 이번 PR의 스코프
    확장 요구가 아니라 향후 개선 제안이다.

- **[INFO]** `make_temp_repo_copy` 는 원본 트리를 "쓰기 시점 스냅샷"이 아니라 파일 단위로 순차 복사한다
  - 위치: `.claude/tests/_harness.py` — `make_temp_repo_copy` 함수 (게이트 138~166줄)
  - 상세: `shutil.copytree(REPO_ROOT / rel, repo / rel)` 는 파일을 하나씩 읽어 복사한다. 이론상 복사가
    진행되는 바로 그 순간 사람이 `spec/5-system` 아래 파일을 실제로 편집 중이면(예: 다른 세션이 같은
    워크트리에서 동시에 `Edit` 중) 서로 다른 파일이 서로 다른 시점의 내용으로 섞인 "torn read" 사본이
    만들어질 여지가 이론적으로 남는다. 다만 이번 PR이 닫으려는 문제(테스트끼리의 **쓰기** 경쟁)와는
    다른 축이며, 실측된 회귀 클래스(§B)는 전부 "테스트가 쓴 파일을 다른 테스트가 되살린다" 형태였고
    이 경로는 재현되지 않았다. 위험도는 낮다 — 사람이 그 순간 그 파일들을 편집 중일 확률은 테스트-대-테스트
    경쟁보다 훨씬 낮고, 결과도 "가끔 일관성 없는 스냅샷을 잠깐 읽는" 정도로 프로덕션 안전성에 영향은 없다.
  - 제안: 현 상태로 충분. 별도 조치 불요(정보 제공 목적의 기록).

## 검증 관점별 확인

- **경쟁 조건**: 핵심 수정 대상. `_harness.make_temp_repo_copy` + `CONSISTENCY_OUTPUT_DIR`/`REVIEW_OUTPUT_DIR`
  재지정으로, 병렬 프로세스가 공유하던 파일(추적 spec, 고정 이름 draft/plan 파일, 세션 디렉터리, 저장소
  루트 임시 디렉터리)에 대한 쓰기가 프로세스별 격리 디렉터리로 이동했다. `plan/in-progress/harness-probe-isolation.md`
  §E 의 재현 실험(고치기 전 잔여 5/6 라운드·실패 22/24 → 고친 뒤 잔여 0/6·실패 0/24)이 수정 효과를
  뒷받침한다. 뮤테이션 테스트(§D, P1~P6)도 새 fixture 가 옛 계약을 그대로 지키는지, 그리고 실제로 생존한
  뮤턴트(P5 — `update-ref` 제거)에 대해 별도 계약 테스트(`TheRepoCopyFixtureTest`)를 추가해 KILLED 로
  전환한 이력이 확인된다.
- **동기화**: 락/세마포어 대신 "공유 제거"로 접근한 설계가 적절하다 — 테스트별 `tempfile.TemporaryDirectory()` /
  `tempfile.mkdtemp()` 로 프로세스마다 유일한 루트를 받으므로 락이 필요 없다.
- **원자성**: `make_temp_repo_copy` 내부의 `add -A` → `commit` → `update-ref` 세 단계는 그 저장소가
  해당 프로세스 전용이라 다른 프로세스의 개입 없이 순차 실행되며 원자성 문제가 없다. `git_in` 은
  `subprocess.run(..., check=True)` 로 각 단계 완료를 보장한다.
- **스레드 안전성**: 이번 변경은 스레드가 아니라 별도 **프로세스**(pytest 워커) 간 공유 파일시스템 경쟁을
  다룬다 — in-process 공유 객체(리스트/딕셔너리 등)의 스레드 안전성 이슈는 해당 없음. `orch._edited_rels = lambda ...`
  같은 몽키패치도 매 테스트가 새 서브프로세스(fresh interpreter)에서 orchestrator 모듈을 재 import 하므로
  `sys.modules` 오염이나 전역 상태 공유가 없다(`_harness.py` 상단 주석에 그 설계 이유가 명시됨).
- **async/await, 이벤트 루프, 리소스 풀링**: 이 diff 범위에는 비동기 코드·이벤트 루프·스레드/커넥션 풀이
  없다 — 전부 동기 `subprocess.run` 기반 테스트 하네스 코드다.
- **데드락**: 락을 도입하지 않았으므로 데드락 가능성 없음.

## 요약

핵심 변경은 병렬 pytest 실행이 공유 워크트리 파일을 밟던 실측된 경쟁 조건을, 락 기반 직렬화가 아니라
프로세스별 격리(임시 git 저장소 사본 + 임시 출력 디렉터리)로 근본 제거한 것으로, 재현 실험과 뮤테이션
테스트로 효과가 뒷받침된다. 새로 도입된 코드(`_harness.make_temp_repo_copy`, 각 테스트의 임시 디렉터리
사용)에서 새로운 경쟁 조건이나 동기화 결함은 발견되지 않았다. 남은 항목은 "격리 규약이 런타임 가드가
아닌 문서 관례로만 강제된다"는 INFO 수준 관찰과 "파일 단위 복사가 이론적으로 torn read 여지를 남긴다"는
저위험 INFO 뿐이며, 둘 다 이번 PR의 차단 사유는 아니다.

## 위험도

LOW
