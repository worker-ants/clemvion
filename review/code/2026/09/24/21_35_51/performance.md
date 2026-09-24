# 성능(Performance) 리뷰: docs-guard-trigger (CI 트리거 스코프 확장)

## 검토 범위 참고

리뷰 대상 33개 파일을 전수 확인했다. 실질적인 "코드" 변경은 다음 6개뿐이고, 나머지 27개(파일 7~33)는
직전 리뷰/컨시스턴시-체크 라운드(`review/code/2026/09/24/21_16_58/**`, `review/consistency/2026/09/24/{20_34_01,21_04_26}/**`)의
산출물이 저장소 관례(`CLAUDE.md` §정보 저장 위치)에 따라 커밋된 정적 markdown/JSON 리포트다.
런타임에 실행되는 애플리케이션 코드가 아니므로 알고리즘 복잡도·N+1·캐싱 등 대부분의 점검 관점이
해당 없음이다:

1. `.claude/tests/README.md` — 카탈로그 표에 새 테스트 행 1개 추가 (문서)
2. `.claude/tests/test_spec_link_checks_scope.py` — 신규 하네스 회귀 테스트 (unittest, 2개 테스트 메서드)
3. `.github/workflows/spec-link-checks.yml` — CI pathspec 에 `plan/**` 추가, 실행 스텝을 단일 파일 →
   디렉터리 전체(`src/lib/docs/__tests__/`)로 확장
4. `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/docs-guard-trigger.md` — 문서/plan 서술 갱신

## 발견사항

- **[INFO]** CI 트리거 표면 확대 + 단일 파일 → 디렉터리 전체 실행으로 잡 실행 시간 증가
  - 위치: `.github/workflows/spec-link-checks.yml:71-74` (`pathspecs` 블록에 `plan/**` 추가),
    `.github/workflows/spec-link-checks.yml:115-118` (`run: pnpm --filter frontend test src/lib/docs/__tests__/`)
  - 상세: (1) `plan/**` 이 pathspec 에 추가되어 plan 문서만 바꾸는 PR 에서도 이 잡이 이제 매번
    실행된다(이전엔 스킵). (2) 실행 대상이 `spec-link-integrity.test.ts` 한 파일에서 디렉터리 전체로
    바뀌어, PR 당 도는 vitest 케이스 수가 늘었다. 두 변화 모두 CI 컴퓨트 소비를 늘리는 방향이라
    "블로킹 I/O"·"불필요한 연산" 관점에서 한 번은 짚어야 한다. 다만 이는 결함이 아니라 **의도된,
    실측된 트레이드오프**다 — `plan/in-progress/docs-guard-trigger.md` §C 가 실측을 남겼다
    ("로컬에서 CI 와 같은 명령으로 23파일 3567개 확인"), 목적 자체가 "plan/spec 만 바꾼 PR 에서
    docs 가드가 하나도 안 돌던" 실결함(false negative)을 닫는 것이므로 트리거 증가는 수정의 본질이지
    부산물이 아니다. 헤더 주석(`:12-14`)도 "디렉터리 전체도 수 초" 라고 명시해 `next build` 를 도는
    `frontend-checks` 대비 여전히 가볍다는 판단 근거를 남겼다.
  - 제안: 조치 불요. 다만 "가벼운 대체 트리거" 라는 성능 불변식(그 디렉터리엔 무거운 테스트가
    없어야 한다)을 강제하는 코드/테스트가 전혀 없다는 점은 남는 리스크다 — 아래 항목 참고.

- **[INFO]** "가벼운 트리거" 불변식에 대한 실행 시간 상한 가드 부재 (선행 아키텍처 리뷰의 성능 버전)
  - 위치: `.github/workflows/spec-link-checks.yml:115` (`run:` 커맨드), 관련 근거 주석 `:30-32`
  - 상세: 열거식 실행(단일 `.test.ts`)을 디렉터리째 실행으로 바꾼 이유는 "새 docs 가드가 생겨도
    잊지 않고 함께 돈다" 는 것이지만, 그 대가로 이 디렉터리에 **누가 무거운 테스트(네트워크 호출,
    긴 타임아웃, 대용량 fixture 등)를 추가해도 막을 방법이 없다**. 지금은 vitest 로 수 초라
    문제가 없지만, "가벼움" 을 강제하는 것은 순수 관례이며 회귀 테스트도 CI 타임아웃 어서션도
    없다. 이 워크플로의 존재 이유가 "`frontend-checks` 의 무거운 `next build` 를 피하는 lightweight
    대체 트리거" 인데, 그 경량성 자체가 구조적으로 보증되지 않는다.
  - 제안: 이번 PR 스코프는 아니다(이미 아키텍처 리뷰에서 동일 지적, INFO 처리 합의). 후속으로
    `src/lib/docs/__tests__/` 디렉터리에 대한 vitest 실행 시간 상한을 검증하는 하네스 테스트,
    또는 파일명 컨벤션으로 "무거운 테스트는 별도 스위트로" 를 강제하는 안을 고려할 수 있다.

- **[INFO]** 신규 하네스 테스트가 워크플로 YAML 을 테스트 메서드마다 재-parse
  - 위치: `.claude/tests/test_spec_link_checks_scope.py:56-57` (`test_pathspecs_trigger_on_plan_and_spec` 이
    `parse_pathspecs_block(WORKFLOW.read_text(...))` 호출), `:67-68` (`test_runs_the_docs_guard_directory_not_one_file` 이
    `_docs_guard_run_commands()` → 내부에서 다시 `yaml.safe_load(WORKFLOW.read_text(...))`)
  - 상세: 두 테스트 메서드가 각자 파일을 읽고 각자 YAML/pathspec 파싱을 수행해 디스크 I/O +
    파싱이 2회 발생한다. 대상 파일(`spec-link-checks.yml`)은 수 KB 짜리 워크플로 하나뿐이고
    `unittest.TestCase` 는 클래스당 1회 실행되는 구조라 실질 비용은 무시할 수준(밀리초 이하)이다.
    캐싱·`setUpClass` 도입은 가독성 대비 이득이 없다.
  - 제안: 조치 불요 — 언급은 하되 실질적 성능 영향은 없음.

- **[INFO]** review/consistency 산출물(파일 7~33)은 정적 markdown/JSON — 성능 관점 해당 없음
  - 위치: `review/code/2026/09/24/21_16_58/**`, `review/consistency/2026/09/24/{20_34_01,21_04_26}/**`
  - 상세: 전부 이전 라운드의 리뷰 리포트·meta.json·retry_state.json 이며, 런타임에 로드/파싱되는
    경로가 아니다(사람이 읽거나 향후 grep 대상일 뿐). 알고리즘·N+1·메모리·캐싱 어느 관점으로도
    점검할 대상이 없다.
  - 제안: 조치 불요.

## 요약

이번 변경 세트는 애플리케이션 런타임 코드를 전혀 건드리지 않는 CI 워크플로 설정(pathspec 확장 +
단일 파일 실행 → 디렉터리 전체 실행) 과 그에 따른 문서·plan·리뷰 산출물로 구성된다. 성능 관점에서
유일하게 의미 있는 변화는 CI 트리거 표면 확대와 잡 실행 시간 증가인데, 둘 다 plan 문서(§C, §D)와
CHANGELOG 에 실측(23파일 3567 케이스, 수 초, 과거 커밋 `relevant=false→true` 전이)이 남아 있는
의도된 트레이드오프이며 수정의 목적(트리거 갭 해소) 그 자체다. 신규 하네스 테스트의 파일 재-parse
는 무시할 수준이다. "가벼운 트리거" 불변식을 강제하는 코드가 없다는 점은 향후 리스크로 기록해 둘
가치는 있으나 이번 PR 의 결함은 아니며, 이미 아키텍처 리뷰에서 동일하게 INFO 로 포착돼 있다.
Critical/Warning 급 성능 이슈는 없다.

## 위험도
NONE
