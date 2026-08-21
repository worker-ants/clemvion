# 테스트(Testing) 리뷰 — masked-marker-contract (라운드2, 11_27_29 RESOLUTION 반영분)

## 검증 방법

`git diff origin/main...HEAD --stat` 로 실 변경 파일을 확인하고, 이전 라운드(`11_27_29`)
testing.md 의 WARNING/INFO 가 이번 라운드에서 실제로 해소됐는지 diff 로 대조했다. 기존 소비처
테스트(`sanitize-error-message.spec.ts`, `masked-markers.test.ts` 등)는 이번 두 커밋
(`7cc64fa35`, `bf0618a7d`) 에서 **전혀 수정되지 않았음**을 `git diff --stat` 로 확인 — 재export
shim 이 값을 그대로 넘기므로 회귀 없이 유효하다.

## 이전 라운드 지적의 해소 확인 (재확인 낭비 방지용 기록)

- **[해소]** WARNING(패키지 자신이 리터럴을 pin 하지 않음) — `codebase/packages/masked-markers/src/__tests__/index.spec.ts`
  에 `it.each([["VALUE_MASK_MARKER", VALUE_MASK_MARKER, "***"], ...])("[캐너리] %s 리터럴 고정", ...)`
  가 추가돼 세 리터럴을 직접 `toBe` 로 못박는다. 자기참조적 "집합을 이룬다" 테스트와 분리된
  독립 단언이라 실효성이 있다.
- **[해소]** INFO(접두 겹침 오탐 경계 미고정) — frontend
  `masked-marker-mirror.test.ts`, backend `masked-marker-mirror.spec.ts` 양쪽
  `it.each` 오탐-방지 목록에 `['접두가 겹치는 다른 식별자', 'const MAX_MASK_DEPTH_OLD = 8;']`
  가 동일하게 추가됐다(두 사본 모두 확인).
- **[미해소, 의도적 이월]** INFO(backend `deepRedactSecrets` 깊이 10/11 정확 경계 테스트 부재) —
  `sanitize-error-message.spec.ts` 는 이번 라운드에서도 수정되지 않았다. `RESOLUTION.md` 가
  "미조치 INFO(20건)" 목록에 "선존 갭"으로 명시해 의식적으로 미룬 것은 맞으나, `plan/in-progress/masked-marker-shared-package.md` 본문에는 이 항목이 후속 작업으로 등재돼 있지 않다(grep 확인
  — `깊이`/`depth` 관련 섹션에 이 항목 없음). review 산출물은 SoT 가 아니므로, 다음에 이 파일을
  건드릴 때 다시 놓치지 않으려면 plan 트래커에 한 줄 옮겨 적는 편이 안전하다.

## 발견사항

- **[INFO]** 신규 backend 미러 가드 테스트가 저장소 루트를 **고정 상대경로 카운트**로 계산한다
  — 형제(frontend) 가드가 바로 그 패턴을 피하려고 marker 탐색으로 바꾼 것과 반대 방향
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:33`
    (`const repoRoot = path.resolve(__dirname, '../../../../..');`)
  - 상세: 대조군인 frontend `_shared.ts` 의 `repoRoot()` 는 정확히 이 패턴("고정 `../../..`
    카운트 대신 marker 로 탐색한다 — 파일이 이동해도 조용히 오해소되지 않는다")을 피하려고
    `pnpm-workspace.yaml` 을 marker 로 위로 탐색하도록 설계돼 있다(같은 PR 계열 파일이 아니라
    기존 인프라이지만, 바로 옆 파일이 반대 패턴을 새로 도입했다). backend 사본이 향후
    `__tests__/` 디렉터리 depth 가 바뀌면(예: 하위 폴더로 재배치) `path.resolve` 는 조용히
    **엉뚱한 디렉터리**를 `repoRoot` 로 잡는다 — throw 하지 않는다. 다행히 이 실패는 무해하게
    끝나지 않고 같은 파일의 "[캐너리] 스캔 대상 파일 목록이 비어 있지 않다" 테스트
    (`listSourceFiles` 결과 0건이면 RED, 합계 500 초과 못하면 RED)가 잡아준다 — 완전히
    무방비는 아니다. 다만 그 캐너리가 잡아주는 것은 "뭔가 잘못됐다"까지고, marker 탐색이었다면
    애초에 이 실패 모드 자체가 발생하지 않았을 것이다.
  - 제안: 급하지 않음(캐너리가 백스톱). 다음에 이 디렉터리 구조를 건드릴 기회에 backend 사본도
    `_shared.ts` 류의 marker 탐색(또는 `find-up` 유틸)로 맞추면 두 사본의 견고성이 대칭이 된다.

- **[INFO]** frontend/backend 두 미러 가드의 `SOT_SYMBOLS` 목록(그리고 탐지 로직 전체) 자체가
  서로 동기화됐는지 검증하는 테스트가 없다 — 이 PR 이 없애려던 "미러" 패턴이 **탐지 로직**
  수준에서 형태를 바꿔 남아 있다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:22-29`
    vs `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:22-29`
    (`SOT_SYMBOLS` 배열 — 값은 현재 완전히 동일함을 `grep` 대조로 확인)
  - 상세: 이번 라운드가 두 사본 모두에 접두 겹침 캐너리를 정확히 대칭으로 추가한 것은 좋은
    실행이지만("사람이 수동으로 양쪽을 맞췄다"는 사실 자체가 이 우려를 보여준다), 이를
    강제하는 테스트는 없다. `architecture.md`(WARNING1 처분)의 근거 — "값의 미러와 달리 탐지
    로직의 중복은 구멍을 만들지 않는다, 한 사본이 낡아도 다른 사본이 같은 불변식을 자기
    트리거에서 계속 지킨다" — 는 **각 사본이 독립적으로 여전히 정확할 때만** 성립한다. 만약
    미래에 마커가 7번째로 늘어 한쪽 `SOT_SYMBOLS` 에만 추가되고 다른 쪽은 빠뜨리면, 빠뜨린
    쪽은 그 신규 심볼의 재선언을 계속 놓치면서도 두 스위트 모두 GREEN 을 유지한다 — 정확히
    이 PR 이 값 도메인에서 없애려던 "한쪽만 갱신돼 조용히 fail-open" 형태가 탐지 로직
    도메인으로 옮겨간 것이다. 값과 달리 이 리스트는 공유 패키지로 뽑아낼 수 없다는 제약
    (두 파일이 각자 `SOT_SYMBOLS` 를 상수 리터럴로 갖는 이유가 바로 CI 경로 게이팅 회피이므로,
    공유 모듈로 다시 묶으면 이 PR 의 존재 이유가 무효화된다)이 있어 완전한 해법은 없지만,
    최소한 회귀를 사람이 아니라 기계가 잡게 할 여지는 있다.
  - 제안: (선택) 한쪽 스위트(예: backend)에 "frontend 사본의 `SOT_SYMBOLS`/`SCAN_DIRS` 소스
    텍스트를 읽어 자신의 것과 배열 값이 동일한지" 비교하는 캐너리 1개를 추가하면, 이 캐너리
    자체는 파일시스템 read 만 하므로 CI 경로 게이팅에 걸리지 않는 쪽(예: `backend-checks` 가
    `frontend` 소스 파일 하나를 읽는 것)에 둘 수 있다. 다만 이 테스트도 backend PR 에서만
    도니 완전한 대칭 보장은 아니다 — 비용 대비 실익이 낮다면 INFO 로 남겨 두는 것도 합리적
    선택이다.

- **[INFO]** `findMirrorRedeclarations` 의 `SOT_DIR` 자기 제외 분기가 어느 테스트에서도 도달
  하지 않는 죽은 분기다(maintainability 리뷰가 이미 지적한 항목과 동일 근거, 테스트 커버리지
  관점에서 재확인)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:122`
    / `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:113`
    (`if (relPath.startsWith(SOT_DIR...)) continue;`)
  - 상세: `SCAN_DIRS` 는 `codebase/backend/src` · `codebase/frontend/src` ·
    `codebase/channel-web-chat/src` 셋뿐이고 `codebase/packages/masked-markers` 는 포함되지
    않는다 — 즉 이 분기가 걸러야 할 대상(SoT 패키지 자신의 소스)이 애초에 스캔 대상에 들어오지
    않으므로 이 라인은 어떤 테스트로도 실행되지 않는다(실측: 실제 저장소 대상 통합 테스트도,
    합성 fixture 테스트도 이 경로를 타지 않는다). 동작에 영향은 없다(죽은 코드 제거와 동치).
  - 제안: 조치 불요. 굳이 커버리지를 채우려면 합성 fixture 안에 `SCAN_DIRS`-스타일 경로를
    직접 만들어 `SOT_DIR` prefix 를 갖는 파일을 넣고 `findMirrorRedeclarations` 가 건너뛰는지
    확인하는 테스트를 추가할 수 있으나, 실질 리스크가 낮아 우선순위는 낮다.

## 확인했으나 문제 없음 (재확인 낭비 방지용 기록)

- 신규 backend 스위트(`masked-marker-mirror.spec.ts`)는 frontend 스위트와 동일하게 vacuous
  방지(스캔 파일 수 하한) · 탐지력(합성 fixture) · 오탐 방지(정상 형태 7종, 접두 겹침 포함)
  세 축을 모두 갖췄다 — 새로 추가된 스위트이지만 앞선 라운드가 확립한 설계 품질 기준을 그대로
  재사용했다.
- `codebase/backend/src/repo-guards/**` 는 `tsconfig.build.json` 의 `exclude` 에 명시돼 있어
  신규 backend 가드가 `typescript` 를 devDependency 로 import 해도 프로덕션 번들에는 새지
  않는다 — `RESOLUTION.md` 가 주장한 근거를 `tsconfig.build.json:16` 로 직접 확인했다.
  `masked-marker-mirror.spec.ts` 는 backend jest 의 `testRegex: '.*\\.spec\\.ts$'` 에 정확히
  매칭돼 CI 에서 실제로 실행된다.
- `sanitize-error-message.ts` 에서 로컬 정의였던 `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER` 등이
  패키지 재export 로 바뀐 뒤에도, 이 상수들을 소비하는 기존 회귀 테스트
  (`strip-external-only-fields.spec.ts`, `reject-masked-resubmission.spec.ts`)는 전부
  `MAX_REDACT_DEPTH` 심볼을 통해 **동적으로** 참조하지 리터럴 `10` 을 하드코딩하지 않는다 —
  값 자체가 패키지에서 오도록 배선이 바뀌어도 이 테스트들은 배선 변경에 안전하다.
  `MAX_MARKER_SCAN_DEPTH`(frontend 구 로컬 상수)는 저장소 전체에서 참조가 완전히 제거됐음을
  grep 으로 확인했다 — dangling reference 없음.
- 신규 패키지 자신의 `index.spec.ts` 는 `Object.freeze(new Set(...))` 이 플라시보라는 사실을
  `.push()` 시도 후 `TypeError` 를 직접 단언하는 형태로 검증한다 — 이전 구현이 실제로 겪었던
  함정을 회귀로 고정한 좋은 캐너리다.
- 두 미러 가드 테스트 모두 `fs.mkdtempSync(os.tmpdir())` + `finally` 의 `fs.rmSync` 로 임시
  디렉터리를 격리하고 정리한다 — 저장소 트리를 뮤테이션하지 않으며 테스트 간 의존성이 없다.
  Mock/stub 사용이 전혀 없고 실제 파일시스템 I/O 로 동작을 검증하므로 실제 동작과의 괴리가
  없다.

## 요약

이전 라운드(`11_27_29`)에서 지적된 WARNING(패키지 자신의 리터럴 미고정)과 INFO(접두 겹침 오탐
경계 미고정) 두 건은 이번 처분 라운드에서 정확히 지적된 지점에 정확히 처방된 형태로 해소됐다
— 특히 접두 겹침 캐너리는 신설된 backend 사본에도 대칭으로 반영돼 있다. 신규로 추가된 backend
미러 가드 스위트(`masked-marker-mirror.spec.ts`)는 frontend 스위트와 동일한 3축 방어 설계를
재사용해 품질이 일관된다. 남은 발견은 전부 INFO 수준이다 — backend 가드가 저장소 루트를 고정
상대경로로 계산해 frontend 의 marker-탐색 패턴과 견고성이 비대칭이지만 vacuous 캐너리가
실패를 백스톱한다는 점, 두 스택의 미러 가드 자체(`SOT_SYMBOLS`)가 서로 동기화됐는지 검증하는
기계적 대조가 없어 "미러 소멸 감시" 라는 목적이 탐지 로직 층위에서 같은 형태의 리스크를
소규모로 물려받았다는 점, 그리고 `SOT_DIR` 자기 제외 분기가 `SCAN_DIRS` 구성상 도달 불가능해
테스트 커버리지가 애초에 그 라인에 닿지 않는다는 점이다. 기존 소비처 테스트는 이번 두 커밋에서
전혀 수정되지 않았고 값 배선이 재export 로 유지돼 회귀 위험이 없음을 diff·grep 으로 확인했다.
차단할 만한 결함은 없다.

## 위험도
LOW
