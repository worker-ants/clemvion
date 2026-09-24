# 동시성(Concurrency) 리뷰

## 검토 대상 확인

리뷰 대상 33개 파일을 전수 확인했다 (`### 파일 1` ~ `### 파일 33` 헤더 기준):

1. `.claude/tests/README.md` — 하네스 테스트 카탈로그 문서(신규 행 1개 추가)
2. `.claude/tests/test_spec_link_checks_scope.py` — 신규 `unittest` 테스트 파일. 단일 스레드로 YAML 을 읽어 정적 문자열/리스트 단언만 수행 — 스레드·프로세스·락·공유 가변 상태 없음
3. `.github/workflows/spec-link-checks.yml` — GitHub Actions 워크플로 YAML (`plan/**` pathspec 추가, 단일 파일 실행 → 디렉터리 전체 실행)
4. `CHANGELOG.md` — 변경 이력 문서
5. `PROJECT.md` — 서술 문서 갱신
6. `plan/in-progress/docs-guard-trigger.md` — 신규 plan 문서
7~33. `review/code/2026/09/24/21_16_58/**`, `review/consistency/2026/09/24/20_34_01/**`, `review/consistency/2026/09/24/21_04_26/**` — 선행 라운드의 리뷰/consistency-check 산출물(markdown 리포트 + JSON 상태 파일). 전부 정적 텍스트/설정 데이터

전 파일이 CI 설정(YAML)·산문 문서(md)·plan/review 산출물(md/json)·단일 스레드 테스트 스크립트(py) 이며, 스레드/프로세스/이벤트 루프/락/뮤텍스/세마포어/공유 가변 자원에 접근하는 런타임 애플리케이션 코드(`.ts`/`.tsx`/`.js` 등, 특히 backend `async`/`await`·큐·DB 트랜잭션 관련 코드)는 하나도 포함되어 있지 않다.

GitHub Actions 워크플로(파일 3)는 잡 간 `needs:` 의존성과 조건부 스킵(`if: needs.changes.outputs.relevant == 'false'`)을 사용하지만, 이는 CI 오케스트레이션의 선언적 제어 흐름이지 런타임 동시성 문제(경쟁 조건·데드락·원자성 위반)의 대상이 아니다. 이번 diff 가 건드린 부분(`pathspecs` 리스트에 `plan/**` 추가, `run:` 커맨드가 단일 파일 → 디렉터리 전체)도 트리거 조건과 실행 스텝 문자열뿐이며 병렬 실행 모델 자체를 바꾸지 않는다.

신규 테스트 파일(`test_spec_link_checks_scope.py`)의 두 테스트 메서드(`test_pathspecs_trigger_on_plan_and_spec`, `test_runs_the_docs_guard_directory_not_one_file`)도 `yaml.safe_load` 로 파일을 읽어 리스트 멤버십을 확인하는 순차 동기 코드로, 공유 자원·비동기 호출·병렬 실행이 전혀 없다.

## 요약

이번 변경 세트는 CI 워크플로 트리거 스코프 확장과 그에 따른 문서(PROJECT.md·CHANGELOG.md)·plan·하네스 테스트·선행 리뷰 산출물로만 구성되어 있으며, 동시성 리뷰 관점(경쟁 조건·데드락·동기화·스레드 안전성·async/await·원자성·이벤트 루프·리소스 풀링)에서 점검할 실행 시점 애플리케이션 코드가 존재하지 않는다. 신규 Python 테스트와 CI YAML 모두 단일 스레드/선언적 정적 설정 범주에 머무른다.

## 위험도
NONE
