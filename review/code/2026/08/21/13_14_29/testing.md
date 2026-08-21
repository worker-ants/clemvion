# 테스트(Testing) 리뷰 — masked-marker-contract-7d2e14

## 검토 방법

`@workflow/masked-markers` 공유 패키지 추출 diff 전체(36개 변경 파일 + 이전 4라운드 리뷰 이력에 포함된 신규
가드 파일 2쌍)를 테스트 관점에서 검토했다. 핵심 대상은 (1) 패키지 자체 spec
(`codebase/packages/masked-markers/src/__tests__/index.spec.ts`), (2) 신규 미러 소멸 가드
(backend `masked-marker-mirror-guard.ts`/`.spec.ts`, frontend 동명 `.ts`/`.test.ts`), (3) 재export 로
전환된 backend `sanitize-error-message.ts` / frontend `masked-markers.ts` 에 대한 **기존** 테스트의
회귀 유효성이다. 직전 라운드(`12_50_37`)가 지적한 WARNING 1(SoT 접두 경계 backend/frontend 비대칭)과
WARNING 2(함수 선언 형태 재선언 미검증)는 커밋 `4dca96cc4` 로 수정됐고, 두 가드 파일을 직접 열어 그 수정이
backend/frontend 양쪽에 대칭으로 반영됐음을(`relPath === sot || relPath.startsWith(`${sot}/`)` 형태 +
"SoT 와 접두가 겹치는 형제 패키지" 캐너리 + "함수 선언 형태의 재선언" 캐너리, 양쪽 파일 동일) 확인했다.

## 발견사항

- **[INFO]** frontend 기존 소비 테스트(diff 밖)의 JSDoc 이 이번 PR 로 사실과 어긋나게 됐다 — 아직 미수정, 이미 추적됨
  - 위치: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:8`-`26` (특히 19-21행 "backend 가
    바뀌는 것 … 공유 패키지 추출이 선행돼야 값싸다(트래커 '마커 미러 계약 테스트' 항목)" 및 26행 테스트명
    `"마커 집합이 이 리터럴 목록에서 이탈하지 않는다 (backend 미러는 트래커)"`)
  - 상세: 이 파일은 이번 diff 파일 목록에 없다(`git diff` 로 무변경 확인). 그런데 이 PR 이 정확히 그 주석이
    말하는 "공유 패키지 추출"을 완료했고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    의 대응 트래커 두 항목도 이 diff 안에서 `[x]` 로 닫혔다. 남은 주석은 이제 **이미 닫힌 일을 여전히 열려
    있는 것처럼** 서술한다 — 테스트 자체(리터럴 pin)는 여전히 유효(GREEN)하지만, 이 서술만 읽는 다음 사람은
    "크로스체크가 없다"고 오판하거나 이미 끝난 추출 작업을 다시 제안할 수 있다. 이 항목은 이미 직전 라운드
    `12_50_37/testing.md` 에서 동일하게 INFO 로 지적됐고 그 라운드의 RESOLUTION(W1/W2/W3 만 수정)에서는
    다루지 않아 이번 diff 에도 그대로 남아 있다 — 새로 발견한 게 아니라 미해소 상태를 재확인한 것이다.
  - 제안: JSDoc 을 "SoT 는 `@workflow/masked-markers` 이고, 여기 리터럴은 그 패키지 값의 로컬 캐너리(양쪽
    스택 각자 자기 트리거에서 도는 방어)" 식으로 갱신. 값싼 drive-by 편집이라 이번 PR 이나 다음 편집 기회에
    처리 가능.

- **[INFO]** backend 깊이 상한 테스트가 정확한 경계(10/11)를 고정하지 않는다 — 이미 plan 후속 항목으로 등재됨
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:240` 부근(`MAX_REDACT_DEPTH`
    를 넘는 중첩을 만드는 테스트, `not.toThrow()` 만 단언)
  - 상세: `MAX_REDACT_DEPTH` 가 이번 diff 로 `= MAX_MASK_DEPTH`(공유 패키지, 값 10)로 별칭화됐지만, backend
    스위트는 "언젠가 멈춘다"만 확인하고 frontend `masked-markers.test.ts` 의 `[경계] 상한 깊이(10)에 놓인
    마커는 잡는다`/`[경계] 상한보다 깊은 마커는 보지 않는다` 처럼 10/11 양방향을 못박지 않는다. 값이 실수로
    바뀌어도(예: 10→1) backend 스위트만으로는 감지되지 않는다. `plan/in-progress/masked-marker-shared-package.md:165`
    "후속(이 PR 밖)" 절에 이미 등재돼 있고, 실질 위험이 낮다는 근거(`codebase/packages/**` 변경은 양쪽
    워크플로 모두에 relevant 라 프런트 경계 테스트가 같은 PR 에서 함께 돈다)도 문서화돼 있다.
  - 제안: 조치 불요(이미 추적·저위험 판정됨). 다음에 backend `deepRedactSecrets` 를 직접 건드리는 PR 에서
    `it("[경계] 상한 깊이(10)/상한+1(11)", …)` 형태로 값싸게 닫을 수 있다.

- **[INFO]** `findRedeclaredSymbols` 의 AST 탐지가 `enum`/`type`/`interface`/`namespace` 선언 형태를 보지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:120`-`126`(함수
    `findRedeclaredSymbols` 의 `visit`) 및 동일 로직의 frontend 사본
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:124`-`130`
  - 상세: `visit` 은 `ts.isVariableDeclaration`/`isFunctionDeclaration`/`isClassDeclaration` 세 가지만
    본다. 캐너리도 이 세 형태(`const X = 1`, `function isMaskedMarker() {}`)만 검증한다. 이 PR 의 SoT
    심볼 6개(3개 문자열 상수·`MASKED_MARKERS`·`isMaskedMarker`·`MAX_MASK_DEPTH`)는 전부 `const`/`function`
    으로만 자연스럽게 재구현될 수 있는 값이라 실질 위험은 낮지만, 예컨대 `enum MAX_MASK_DEPTH { ... }` 같은
    형태로 되살아나면 이 가드가 놓친다 — 어떤 테스트도 그 분기를 행사하지 않는다(가드 코드에도 없고 테스트도
    없다 — 이는 결함이라기보다 스코프 결정이지만, 결정 자체가 테스트로 명시되지 않았다는 점이 커버리지 갭이다).
  - 제안: 조치 불요 수준(낮은 실현 가능성). 다만 헤더 주석의 "무엇이 선언인가" 절에 "enum/type/interface/
    namespace 형태의 재선언은 스코프 밖" 이라고 한 줄 명시하면, 향후 이 가드를 확장하려는 사람이 의도된
    스코프인지 놓친 버그인지 헷갈리지 않는다.

## 긍정적 관찰

- **Mock 미사용, 실측 기반**: 신규 미러 가드 테스트는 전부 실제 `node:fs`/`os.tmpdir()`/`typescript` 컴파일러
  API 를 사용한다(mock/stub 전무). 가드의 역할 자체가 "실제 저장소 파일을 스캔"이므로 이 선택은 실제 동작과
  괴리가 없다 — mock 을 썼다면 오히려 실제 스캔 로직의 회귀를 놓쳤을 것이다.
- **테스트 격리**: 합성 fixture 테스트(`실제 재선언을 지목한다`, `SoT 와 접두가 겹치는 형제 패키지는 탐지
  대상이다`)는 `fs.mkdtempSync` 로 매번 고유한 임시 디렉터리를 만들고 `finally { fs.rmSync(...) }` 로 정리한다
  — 단언 실패 시에도 정리가 보장되고, 병렬 실행·재실행 간 상태 누수가 없다.
  독립성: 각 `it`/`it.each` 케이스는 서로 의존하지 않는다.
- **뮤테이션 검증 이력**: 커밋 `4dca96cc4` 는 frontend 를 옛 무경계 형태로 되돌리는 실제 뮤테이션을 수행해
  신규 "SoT 와 접두가 겹치는 형제 패키지" 캐너리 **1건만** 정확히 RED 가 됨을 확인했다 — 캐너리가 실제로
  그 결함 클래스를 판별하는지 실증됐다(vacuous 테스트가 아님).
  Object.freeze 배열의 `push` 뮤테이션 회귀(`index.spec.ts` "MASKED_MARKERS 는 실제로 불변이다")도 과거
  `Object.freeze(new Set(...))` 플라시보 결함의 실측을 근거로 설계됐다.
- **회귀 유효성 확인**: `MASKED_MARKERS` 의 frontend 타입이 `ReadonlySet<string>` → `readonly string[]` 로
  바뀌었으나(재export 로 전환), `grep -rn "MASKED_MARKERS\." codebase/frontend/src codebase/backend/src`
  로 전수 확인한 결과 `.has(` 호출 소비처가 없고 기존 소비 테스트(`dynamic-form-ui.test.tsx`,
  `lib/utils/__tests__/masked-markers.test.ts`)는 전부 `[...MASKED_MARKERS]` 스프레드만 사용해 타입 변경에
  영향받지 않는다 — 직접 확인했다. backend `sanitize-error-message.spec.ts` 의 `MASKED_MARKERS` 불변성
  테스트(`Object.isFrozen`/`.push` 예외)도 값이 이제 패키지에서 온다는 사실과 무관하게 여전히 유효하다(같은
  `Object.freeze([...])` 객체를 재export 하므로).
- **테스트 용이성**: 스캔·판정 순수 로직(`resolveScanDirs`/`listSourceFiles`/`findRedeclaredSymbols`/
  `findMirrorRedeclarations`)이 `__tests__/*-guard.ts` 로 분리되어 fs 접근이 함수 인자(`repoRoot`)로
  주입되므로, 실제 저장소 대신 임시 디렉터리를 넘겨 순수 함수처럼 테스트할 수 있다 — 이번 PR 이 반복해서
  활용한 패턴이다.

## 요약

이 PR 은 값 미러 제거(공유 패키지 추출)와 그 재발 방지 가드(backend/frontend 대칭 사본) 양쪽 모두에 걸쳐
5라운드에 걸친 자기 리뷰·뮤테이션 검증을 거쳐 테스트 관점에서 매우 성숙한 상태에 도달했다. 직전 라운드가
발견한 WARNING 2건(SoT 경계 비대칭·함수 선언 형태 미검증)은 이번 diff 에서 이미 수정·뮤테이션 검증까지
완료됐음을 직접 코드로 확인했다. 남은 발견 3건은 전부 INFO 수준이며 그중 2건은 이미 이전 라운드에서 지적돼
plan/이전 리뷰에 명시적으로 추적되고 있는 저위험 항목(diff-frontier 밖 파일의 stale 주석, backend 깊이 경계
미세 검증 누락)이고, 나머지 1건(AST 탐지의 enum/type 형태 미커버)은 실현 가능성이 낮은 이론적 커버리지 갭이다.
Mock 사용이 없고 실제 fs·AST 를 쓰는 실측 테스트, 확실한 격리(mkdtemp+finally), 뮤테이션으로 실증된 캐너리
효과성, 재export 전환에 따른 기존 소비 테스트의 회귀 유효성까지 전수 확인했다. 차단 사유는 없다.

## 위험도
LOW
