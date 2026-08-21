# 테스트(Testing) 리뷰 — `@workflow/masked-markers` 추출

## 발견사항

- **[WARNING]** frontend 미러 가드의 SoT 자기제외 경계 체크에 `/` 경계가 없다 — backend 사본과 다르게 동작하는데 이를 잠그는 테스트가 없다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:143` (`findMirrorRedeclarations`)
  - 상세: frontend 가드는 `if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;` 로 자기 패키지를 스캔 대상에서 제외한다. 반면 같은 목적의 backend 사본(`codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:141`)은 `relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)` 로 **경계(`/`)를 명시**한다. frontend 쪽은 `SOT_DIR`("codebase/packages/masked-markers")과 **접두만 같고 실제로는 다른 디렉터리**(예: 가상의 `codebase/packages/masked-markers-legacy/src/...`)를 SoT 패키지로 오인해 스캔에서 건너뛴다 — 그 자리에서 마커 심볼을 재선언해도 가드가 탐지하지 못한다. 이 PR 자체가 이전 라운드(`11_27_29`)에서 "이 배제 분기가 당시엔 도달 불가능한 dead code" 라고 지적받았고, 라운드2(`1f63bbbef`)에서 `resolveScanDirs` 가 실제로 `codebase/packages/*/src` 전부를 훑도록 바뀌면서 이 분기가 **이제 실제로 도달 가능**해졌다 — 즉 예전엔 무해했던 비대칭이 지금은 실제 사각지대다. 현재 저장소에 접두가 겹치는 패키지가 없어 당장 오탐/미탐은 없지만(`codebase/packages/` 실측: ai-end-reason·chat-channel-validation·expression-engine·graph-warning-rules·masked-markers·node-summary·sdk·web-chat-sdk — 접두 충돌 없음), 두 "동일 목적 사본" 이 서로 다른 불변식을 가진 채 어느 테스트에서도 대조되지 않는다. 이 시리즈(memory: 경로/문자열 술어는 정규화 뒤에 물어야 하고, "접두 문자열까지만" 검사가 반복해 뚫린 전례)와 정확히 같은 패턴이다.
  - 제안: frontend 가드도 `relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)` 형태로 맞추고, 접두만 겹치는 형제 디렉터리(`masked-markers-something/src/mirror.ts`)를 fixture 로 만들어 "SoT 와 접두만 같은 디렉터리는 스캔·탐지 대상에 **포함**된다" 는 캐너리를 backend/frontend 양쪽에 추가한다.

- **[WARNING]** `findRedeclaredSymbols` 의 함수/클래스 선언 탐지 분기가 어떤 테스트로도 행사되지 않는다 — 변수 선언 형태만 캐너리로 고정돼 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:110-115` (`it.each(SOT_SYMBOLS...)`), `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:125-130` — 대상 로직은 `.../masked-marker-mirror-guard.ts` 의 `visit` 함수(`ts.isVariableDeclaration` / `ts.isFunctionDeclaration` / `ts.isClassDeclaration` 세 분기, 양쪽 파일 동일 구조)
  - 상세: "SoT 심볼의 재선언을 탐지한다" 캐너리는 모든 `SOT_SYMBOLS`(`isMaskedMarker` 포함)에 대해 예외 없이 `const ${symbol} = 1;` 픽스처만 쓴다 — 즉 `ts.isVariableDeclaration` 분기만 행사되고, `ts.isFunctionDeclaration`/`ts.isClassDeclaration` 분기는 어떤 테스트에서도 참이 되지 않는다. `isMaskedMarker` 는 이 패키지가 export 하는 유일한 함수이고, **이관 전 실제 backend 코드가 정확히 `export function isMaskedMarker(v: unknown): boolean {...}` 형태였다**(이번 diff 의 `sanitize-error-message.ts` 삭제분 참조) — 즉 "함수 선언으로 재선언" 은 이 가드가 막아야 할 가장 현실적인 회귀 형태인데, 그 분기가 뮤테이션·리팩터로 깨져도 현재 테스트 스위트는 GREEN 을 유지한다.
  - 제안: 두 파일의 `it.each` 픽스처에 `function isMaskedMarker() { return true; }` 형태(함수 선언)를 최소 한 건 추가해 해당 분기를 실제로 행사시킨다. 클래스 선언 분기는 현재 어떤 SoT 심볼도 클래스 형태를 취하지 않으므로 우선순위는 낮다(INFO 수준).

- **[INFO]** backend 깊이-경계 테스트가 정확한 상한(10/11)을 못박지 않는다 — 이미 plan 에 후속 항목으로 등재돼 있어 신규 발견은 아니다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:239` (`'caps recursion depth (deep nesting is masked wholesale, no stack blowup)'`)
  - 상세: 이 테스트는 `deep` 을 25단 중첩해 `not.toThrow()` 만 확인한다. `MAX_REDACT_DEPTH` 가 이번 diff 에서 `= MAX_MASK_DEPTH`(공유 패키지, 값 10)로 별칭화됐는데, backend 스위트는 그 정확한 경계(깊이 10 은 검사되고 11 은 안 됨)를 고정하지 않는다 — frontend `masked-markers.test.ts` 의 `[경계] 상한 깊이(10)에 놓인 마커는 잡는다` / `[경계] 상한보다 깊은 마커는 보지 않는다` 와 대칭이 아니다. `plan/in-progress/masked-marker-shared-package.md` §후속(이 PR 밖) 에 이미 같은 지적이 두 라운드(`11_53_49`·`12_25_15`) 연속으로 등재돼 있고, 실질 위험이 낮다는 근거(`codebase/packages/**` 변경은 두 워크플로 모두에 relevant 라 프런트 경계 테스트가 같은 PR 에서 함께 돈다)도 문서화돼 있다. 새 결함이 아니라 diff 가 이 상수를 직접 건드리므로 교차 확인 차 재확인한다 — 처분은 이미 기록돼 있으므로 추가 조치 불필요.

- **[INFO]** diff 밖 기존 테스트 주석이 이번 추출로 stale 해졌다 (본 PR 범위는 아님)
  - 위치: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` (이번 diff 파일 목록에 없음) — `describe("masked-markers", ...)` 안 `it("마커 집합이 이 리터럴 목록에서 이탈하지 않는다 (backend 미러는 트래커)", ...)` 및 그 위 JSDoc
  - 상세: 이 주석은 *"backend 가 바뀌는 것은 못 지킨다 … 공유 패키지 추출이 선행돼야 값싸다(트래커 '마커 미러 계약 테스트' 항목)"* 라고 적혀 있다. 이번 PR 이 바로 그 공유 패키지 추출을 완료해 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 트래커 두 항목을 `[x]` 처리했으므로, 이 파일의 주석은 이제 **닫힌 트래커를 여전히 열려 있는 것처럼** 서술한다. 테스트 자체는 여전히 유효(GREEN)하지만, 다음 사람이 이 주석을 보고 "아직 추출이 안 됐다" 고 오인하거나 중복 작업을 시도할 수 있다.
  - 제안: 이번 PR 이나 다음 drive-by 편집에서 해당 JSDoc 을 "SoT 는 `@workflow/masked-markers` 이고, 여기 리터럴은 그 패키지 값의 로컬 캐너리" 정도로 갱신.

## 요약

핵심 계약 파일(`codebase/packages/masked-markers/src/index.ts`)과 두 스택의 재export 지점은 리터럴 고정·불변성(`Object.freeze` 함정 회귀)·타입/비문자열 입력·정확 일치 경계를 캐너리로 촘촘히 잠갔고, 마스킹 재발 방지 미러 가드(backend/frontend 양쪽)도 vacuous 방지·합성 fixture·정상 형태 오탐 방지까지 갖춰 이 PR 자체의 문서화된 3라운드 자기 리뷰 이력이 보여주듯 상당히 성숙하다. mock 사용은 전무하고 전부 실제 `fs`/임시 디렉터리/`typescript` AST 를 쓰는 실측 테스트라 실제 동작과의 괴리가 없으며, 각 테스트는 `mkdtempSync` + `finally` 정리로 격리돼 있다. 다만 backend/frontend 두 가드 사본이 "동일 로직의 중복은 안전하다" 는 전제로 유지되는데, 정작 SoT 자기제외 경계 처리가 두 사본 사이에서 **비대칭**으로 구현됐고 어떤 테스트도 그 비대칭을 드러내지 못한다(WARNING 1) — 이 PR 이 반복해서 겪은 "가드 배치가 스스로 사각지대를 재도입한다" 패턴의 네 번째 변주에 가깝다. 또한 재선언 탐지의 세 분기 중 함수 선언 형태(가장 현실적인 회귀 형태 — 이관 전 실제 코드 모양)가 어떤 캐너리에서도 행사되지 않는다(WARNING 2). 나머지는 diff 범위 밖이거나 이미 plan 에 등재된 낮은 우선순위 항목이다.

## 위험도

MEDIUM
