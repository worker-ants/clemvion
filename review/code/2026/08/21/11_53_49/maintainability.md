# 유지보수성(Maintainability) Review — masked-marker-contract-7d2e14 (round 11_53_49)

## 발견사항

- **[WARNING]** 미러 소멸 가드 자신의 감시 목록(`SOT_SYMBOLS`/`SCAN_DIRS`)이 backend/frontend 두 파일에 리터럴 배열로 중복 선언돼 있고, 둘을 맞춰야 한다는 것을 강제하는 테스트가 없다 — 이 PR이 없애려던 "값 미러 발산" 과 같은 형태의 위험을 가드 자신의 설정에 재도입한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:22-29`(`SOT_SYMBOLS`), `:32-36`(`SCAN_DIRS`) / `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:22-29`(`SOT_SYMBOLS`), `:32-36`(`SCAN_DIRS`)
  - 상세: 두 파일 모두 저장소 전체(`SCAN_DIRS` 3곳)를 훑고 각자 자기 트리거(`backend-checks`/`frontend-checks`)에서 실행되므로, "탐지 로직" 자체의 중복은 구멍을 만들지 않는다는 아키텍처 근거(11_27_29 W1 대응 헤더 주석)는 타당하다. 다만 `findRedeclaredSymbols`가 실제로 무엇을 재선언으로 잡는지는 `SOT_SYMBOLS` **데이터**에 전적으로 의존한다. `@workflow/masked-markers` 패키지에 새 심볼(예: 여섯 번째 마커, 새 유틸)을 추가했을 때 두 배열 중 한쪽에만 그 이름을 추가하고 다른 쪽을 빠뜨리면, 그 반대쪽 스택 전용 PR(예: backend-only 로 새 심볼을 재선언하는 PR)에서 정확히 이 PR이 막으려던 "조용한 fail-open"이 재현된다 — backend 가드가 그 이름을 모르므로 통과시키고, `frontend-checks` 는 backend-only 변경이라 아예 실행되지 않는다(같은 경로 게이팅). 두 배열이 지금은 우연히 동일하지만, 이를 기계로 대조하는 테스트(예: 두 파일의 `SOT_SYMBOLS`를 import 해 `toEqual` 하는 cross-check, 또는 SOT 패키지의 named export 목록에서 자동 도출)가 없다. `SCAN_DIRS` 도 동일한 리스크를 안고 있으나 변경 빈도가 훨씬 낮아(디렉터리 구조는 드물게 바뀜) 상대적으로 덜 급하다.
  - 제안: 두 파일 중 하나(예: backend)의 `SOT_SYMBOLS`/`SCAN_DIRS`를 정본으로 삼고, 다른 쪽 spec/test 파일에 "두 목록이 (수동으로 유지되는 한) 하드코딩된 값이 backend 목록과 같은 항목 수/이름을 갖는다"를 검증하는 캐너리 하나를 추가하거나, 최소한 각 배열 선언 옆에 "반대쪽 파일의 동일 배열과 함께 갱신할 것"이라는 명시적 코멘트를 남긴다(현재는 파일 헤더 코멘트가 "탐지 로직 중복은 안전하다"고만 말하고, 이 데이터 중복에 대해서는 침묵한다).

- **[INFO]** backend/frontend 미러 가드 4개 파일(`*-mirror-guard.ts` 2개 + `*-mirror.spec.ts`/`*-mirror.test.ts` 2개)이 quote 스타일·import 스타일만 다르고 함수 본문(`listSourceFiles`/`findRedeclaredSymbols`/`findMirrorRedeclarations`)과 테스트 케이스 구조가 거의 100% 동일하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전체(129줄) vs `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전체(136줄); `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` 전체(128줄) vs `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` 전체(116줄)
  - 상세: 이 중복은 헤더 코멘트(각 파일 1~12행)에서 "CI 경로 게이팅을 우회하려면 각 스택이 자기 워크플로에서 도는 사본을 가져야 한다"는 근거로 명시적으로 정당화돼 있고, 이전 라운드 아키텍처 리뷰(WARNING 1)의 직접적 대응이라 이번 PR이 새로 만든 나쁜 패턴이 아니라 의도된 트레이드오프다. 다만 향후 판정 로직(예: `findRedeclaredSymbols` 의 AST 순회 규칙)을 바꿔야 할 때 두 파일을 손으로 동기화해야 하며, 위 WARNING(데이터 중복)과 달리 이쪽은 "로직이 낡아도 각자 트리거에서 불변식을 계속 지킨다"는 이유로 안전하다고 판단된 것으로 보인다 — 그 판단이 유효하려면 최소한 로직 자체는 두 파일이 지금처럼 계속 동일해야 한다는 암묵적 전제가 있는데, 이를 지키는 장치(예: 한쪽 diff가 바뀌면 다른 쪽도 리뷰하라는 CI 코멘트)는 코드 내 주석뿐이다.
  - 제안: 조치 불요(설계 결정으로 이미 문서화됨). 다만 두 파일 중 하나를 고칠 때 반대쪽을 잊지 않도록, 각 파일 헤더에 "형제 파일과 로직을 동일하게 유지할 것" 한 줄을 명시적으로 추가하면 향후 유지보수자에게 더 안전하다.

- **[INFO]** frontend 가드의 `SOT_DIR` 정규화가 여전히 순회 루프 안에서 매 파일마다 재계산된다 (이전 라운드 INFO, 미조치·이번 diff에서도 동일 코드 유지)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:122` (`findMirrorRedeclarations` 내부 `if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;`)
  - 상세: `SOT_DIR.split(path.sep).join("/")` 는 루프 변수에 의존하지 않는 불변 값인데 스캔되는 전체 파일 수(500개 이상, `masked-marker-mirror.test.ts:58` 하한)만큼 매번 재계산된다. 비용은 미미하나 "이 값이 반복마다 달라지나"라는 불필요한 의문을 남긴다. 참고로 backend 쪽 동형 함수(`masked-marker-mirror-guard.ts:115`)는 `SOT_DIR` 을 애초에 `path.join` 없이 슬래시 리터럴로 선언해(`:19`) 이 정규화 단계 자체가 없다 — 같은 목적의 두 "사본"이 이 지점에서 스타일뿐 아니라 접근 방식 자체가 갈라져 있다는 점도 위 WARNING(데이터/로직 drift 우려)을 뒷받침하는 정황이다.
  - 제안: 루프 진입 전에 `const sotPrefix = SOT_DIR.split(path.sep).join("/");` 로 한 번만 계산해 재사용한다.

- **[INFO]** backend 전용 신규 스펙 파일이 저장소 루트를 5단계 상위 상대경로(`'../../../../..'`)로 하드코딩해 계산한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:33` (`const repoRoot = path.resolve(__dirname, '../../../../..');`)
  - 상세: 이 파일이 옮겨지면(예: `__tests__` 디렉터리 깊이 변경) `..` 개수를 손으로 다시 세야 하고, 잘못 세면 예외 없이 다른 디렉터리를 스캔하게 된다. frontend 쪽은 형제 가드들이 공유하는 `_shared.ts` 의 `ROOT` 상수를 재export 해 이런 하드코딩이 없다(`masked-marker-mirror-guard.ts:11,135`). 다만 이 파일 자신의 "[캐너리] 스캔 대상 파일 목록이 비어 있지 않다" 테스트(같은 파일 43~49행 대응부, "500개 이상" 하한)가 경로가 완전히 어긋나는 사고는 잡아주므로 실질 위험은 낮다.
  - 제안: `backend/src/repo-guards/__tests__/` 아래 다른 가드들의 관행을 따라 공용 `ROOT`/`repoRoot` 헬퍼가 있다면 재사용하고, 없다면 이번처럼 향후 backend repo-guard 가 늘어날 때를 대비해 하나 만들어 두는 것을 고려한다.

- **[INFO]** `masked-markers` package.json 의 `prepare` 스크립트가 저장소 내 9번째로 동일한 인라인 JS 문자열을 복제한다 (선존 관행, 이번 diff는 관행을 그대로 답습)
  - 위치: `codebase/packages/masked-markers/package.json` (`scripts.prepare`, 8~9번째 줄 부근)
  - 상세: `ai-end-reason`/`node-summary`/`chat-channel-validation`/`graph-warning-rules`/`expression-engine`/`web-chat-sdk`/`sdk` 등 기존 패키지 전부에 동일한 `node -e "..."` 스크립트가 문자 그대로 박혀 있고, 이번 PR은 그 패턴을 그대로 복제했을 뿐이다(신규 결함 아님). 새 패키지가 추가될 때마다 로직을 고치려면 지금 9곳을 동시에 손대야 한다.
  - 제안: 이번 PR 범위 밖. 향후 패키지가 더 늘어나기 전에 `scripts/pkg-prepare.js` 같은 공유 스크립트로 추출해 각 `package.json` 이 위임하도록 리팩터를 검토할 가치가 있다(이전 라운드에서도 동일하게 제안됨).

## 요약

이번 라운드의 diff는 이전 라운드 WARNING(가드가 `frontend-checks` 에만 걸려 backend-only PR 에 무력했던 CI 경로 게이팅 사각지대)을 backend 전용 사본(`masked-marker-mirror-guard.ts`/`.spec.ts`) 신설로 해소했고, 그 구현 자체는 함수 단위가 짧고 책임이 하나씩이며(파일 순회/AST 스캔/집계 분리) 중첩도 최대 3단(for-for-if)에 그쳐 개별 파일 기준으로는 여전히 깔끔하다. 다만 새로 생긴 backend 사본을 프런트 원본과 나란히 놓고 보면, "탐지 로직의 중복은 안전하다"는 설계 근거가 성립하는 전제 — 두 사본이 같은 판정을 내린다 — 를 지키는 장치가 코드 밖 주석뿐이라는 점이 드러난다. 특히 `SOT_SYMBOLS`/`SCAN_DIRS` 는 로직이 아니라 **데이터**이고, 이 PR이 마커 값 자체에 대해 없애려던 바로 그 "한쪽만 갱신되면 조용히 fail-open" 패턴을 가드의 감시 목록 차원에서 재현할 수 있는 자리라 WARNING으로 남긴다. 그 외에는 이전 라운드에 이미 지적되고 미조치로 남은 경미한 INFO(순회 중 불변값 재계산, prepare 스크립트 9번째 복제)와, 이번에 새로 생긴 backend 사본이 프런트와 미묘하게 다른 방식(경로 정규화 유무, 상대경로 하드코딩)을 택해 "동일해야 하는 두 사본"이 이미 세부 구현에서 갈라지고 있다는 정황을 뒷받침하는 INFO 둘을 남긴다. 매직 넘버·과도한 함수 길이·복잡도 폭발 등 차단급 문제는 없다.

## 위험도
LOW
