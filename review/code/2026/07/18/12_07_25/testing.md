# 테스트(Testing) 리뷰 — 내부 패키지 등록 목록 drift 가드 (#968 후속)

## 발견사항

- **[INFO]** `fnBody` 의 "닫는 `}` 를 찾지 못함" 에러 분기가 미검증
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:158`
    (`if (!close) throw new Error(\`fnBody: ${fn} 의 닫는 '}' 를 찾지 못함\`);`)
  - 상세: `fnBody` 의 다른 4개 실패 분기(함수 선언 없음·조기 열림·heredoc·tab-strip heredoc)는
    모두 `internal-package-registration.test.ts` 의 `describe("fnBody", …)` 에서 개별
    `expect(() => fnBody(...)).toThrow(...)` 로 고정돼 있으나, "여는 `{` 는 찾았지만 파일이
    끝날 때까지 라인 시작 `}` 가 전혀 없는" 케이스(예: 함수 선언 후 본문만 있고 닫는 괄호가
    누락된 손상된 스크립트)는 테스트가 없다. 이 분기가 조용히 회귀(예: `close` null 체크
    제거)해도 현재 스위트로는 못 잡는다.
  - 제안: `fnBody("cmd_x() {\n  :\n", "cmd_x")` 같은 미종료 fixture 로
    `.toThrow(/닫는 '\}'/)` 테스트 1건 추가.

- **[INFO]** `repoRoot()` 의 실패 경로(marker 미발견 → throw) 미검증
  - 위치: `internal-package-registration-guard.ts:14-21` (`MAX_DEPTH` 루프 + throw)
  - 상세: `repoRoot()` 는 테스트에서 직접 호출되지 않고 모듈 로드 시 `ROOT` 계산에만 쓰이며,
    현재 저장소 위치에서는 항상 성공 경로만 실행된다. `MAX_DEPTH` 초과 시 throw 하는 방어
    로직 자체는 미검증 상태다. fs 접근이 하드코딩된 `__dirname` 기반이라 순수하게 unit
    테스트하기 어렵다는 점은 이해되나(다른 함수들처럼 fs 접근과 코어 로직을 분리하지 않음),
    "marker 를 못 찾으면 throw" 라는 계약 자체는 (`dirNames`/`exists` 를 주입받는 순수
    헬퍼로 한 겹 더 분리하면) 검증 가능하다.
  - 제안: 낮은 우선순위. 리스크가 낮으므로(가짜 통과가 아니라 fail-loud 라 최악의 경우도
    "에러가 안 던져짐" 정도) 필수는 아니고, 여유가 있으면 `collectPackages`/`workflowDepsOf`
    처럼 fs 코어를 분리해 커버할 수 있음을 기록만 해 둔다.

- **[INFO]** 여러 줄에 걸친 `pnpm --filter \` (줄바꿈 continuation) 시나리오가 명시 테스트 없음
  - 위치: `explicitFilterCalls` 독스트링 (`internal-package-registration-guard.ts:112-114` 부근)
    — "전제: 한 호출은 한 분절(=한 줄) 안에 있어야 한다" 로 이미 문서화된 한계.
  - 상세: `pnpm --filter \` 다음 줄에 `<pkg> <script>` 가 오는 실제 bash 관용구(백슬래시
    줄바꿈 안의 인자 분리)는 파서가 인식하지 못해 "누락"으로 판정된다. 이는 fail-loud
    방향(과소검출이 아니라 과다검출)이라 안전하지만, 이 정확한 실패 모드를 실제로
    fail-loud 로 재현하는 회귀 테스트는 없다(현재 `test-stages.sh` 가 이 패턴을 쓰지 않아
    실사용 리스크는 낮음).
  - 제안: 선택 사항. 문서화된 한계이므로 필수는 아니나, 향후 `test-stages.sh` 리팩터 시
    이 경계를 넘는 변경이 "조용히 통과"가 아니라 "빨갛게 실패"함을 한 번 실측해 두면 방어력이
    한 단계 더 굳어진다.

- **[INFO]** `listAtPath` 의 flow-style YAML(`paths: ['a', 'b']` 한 줄 인라인 배열) 미지원·미검증
  - 위치: `internal-package-registration-guard.ts` `listAtPath`/`blockRange`
  - 상세: 현재 파서는 block-style(`key:\n  - item`) 만 인식한다. 인라인 배열로 작성되면
    `listAtPath` 가 빈 배열을 반환하고, "vacuity 방지" 테스트(`length toBeGreaterThan(0)`)가
    fail-loud 로 잡아주므로 침묵 실패는 아니다. 다만 이 경계 자체를 검증하는 테스트는 없다.
    실 `packages-checks.yml` 이 block-style 만 쓰므로 리스크는 낮다.
  - 제안: 필수 아님. 파서 헤더 주석에 이미 "필요한 3개 목록이 전부 알려진 위치라 충분"이라고
    스코프를 명시하고 있어 현 상태로 충분하다고 판단.

## 커버리지·설계 관점 총평 (감점 아님, 확인 사항)

- `missingFromStage`(가드의 핵심 판정 함수)는 6가지 시나리오(INTERNAL+`_run_internal` 커버,
  신규 패키지 완전 누락=실제 #968 재현, 명시 호출로 커버, `_run_internal` 자체가 없을 때
  전원 누락, 다른 스테이지 호출은 커버 안 됨, 주석/echo 안 텍스트로는 커버 안 됨)로 매우
  촘촘하게 커버되어 있다 — 이 가드가 막으려는 결함 클래스(#968)에 정확히 조준된 회귀
  테스트다.
- `explicitFilterCalls` 도 변수형 제외·라인 주석·행 끝 주석·echo 로그 문자열·따옴표 안
  명령 구분자(`;`/`|`) 오분절 방지까지 실측 기반(리뷰 WARNING 실제 재현) fixture 로
  고정되어 있어, "파서가 스스로 그 파서가 막으려는 결함을 재현하지 않는지" 를 검증하는
  메타적 테스트 설계가 돋보인다.
- "vacuity 방지" describe 블록(파싱이 조용히 빈 집합을 반환하면 이후 대조가 전부 vacuous
  PASS 가 된다는 점을 별도로 못박음)은 이 프로젝트에서 반복된 실패형(#960·#962·#968)에
  대한 정확한 대응이며, 실측 테스트와 합성 fixture 테스트를 분리한 2단 구조(현재 저장소
  상태 대조 vs 순수 함수 mutation 고정)가 "저장소가 이미 정렬돼 있어 회귀를 못 잡는" 함정을
  구조적으로 피한다.
- Mock 은 전혀 쓰지 않고 실제 `fs.readFileSync` 로 저장소 실 파일을 읽는다 — 이 가드의
  목적상(실제 drift 탐지) 옳은 선택이다. mock 을 썼다면 가드 자체가 무력화된다.
- 테스트 격리: `describe` 콜백 최상단에서 `packages`/`sh`/`yml`/`internal`/`backendShared`
  를 1회 계산해 여러 `it()` 가 read-only 로 공유하는 구조라 테스트 간 상호 의존(mutation
  공유)은 없다. 다만 이 계산이 collection 단계에서 실행되므로, 만약 fs 접근 자체가
  실패하면(예: CI 컨테이너가 monorepo 전체를 체크아웃하지 않는 경우) 개별 `it()` 실패가
  아니라 describe 블록 전체가 뭉개진 에러로 보고된다 — 의도된 fail-loud 이지만 진단
  메시지의 세밀함은 다소 떨어진다. 실제 CI 배선(`frontend-checks.yml` 은 `actions/checkout@v7`
  기본 full clone)을 확인한 결과 이 문제는 현재 발생하지 않는다.
- `.claude/test-stages.sh`·`.github/workflows/packages-checks.yml` 자체 변경분은 주석
  추가뿐이라 별도 테스트 불필요.
- 실행 검증: `pnpm vitest run src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
  → 45/45 통과 확인.

## 요약

이번 변경은 정확히 "테스트(가드)를 추가하는" 커밋이며, 실측 대조 테스트(현재 저장소
상태)와 순수 함수에 대한 합성 fixture 회귀 테스트를 이원화한 설계가 매우 견고하다. 특히
가드가 막으려는 결함(#968: 패키지 등록 누락 시 조용한 PASS)의 재현 시나리오와, 파서 자신이
같은 유형의 결함(주석/문자열 안 텍스트를 실제 호출로 오인)을 재현하지 않는지까지 메타적으로
고정한 점이 인상적이다. Mock 미사용은 이 가드의 목적에 부합하는 올바른 선택이고, 격리
문제도 없다. 남은 갭은 `fnBody` 의 "닫는 `}` 미발견" 분기 미검증, `repoRoot()` 실패 경로
미검증, 문서화된 경계(멀티라인 pnpm 호출·인라인 YAML 배열) 의 fail-loud 실측 부재 정도이며,
모두 실사용 리스크가 낮고 이미 fail-loud/fail-closed 방향으로 설계돼 있어 "조용한 오탐/오인"
으로 이어지지 않는다. 커밋 이력(2~4차 ai-review 반영)을 보면 이미 여러 라운드의 리뷰
피드백이 선반영되어 있어 잔여 이슈는 전부 INFO 수준이다.

## 위험도

LOW
