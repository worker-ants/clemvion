STATUS=success ISSUES=2
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — `@workflow/masked-markers` 추출 (`14_19_12`)

## 검토 범위와 방법

`origin/main...HEAD` 누적 diff(20개 코드 파일, 커밋 7개 — `7cc64fa35`~`523f649d8`)를 대상으로
했다. 이미 7라운드(`11_27_29`~`13_55_59`)에 걸쳐 테스트 관점 리뷰·수정이 반복돼 왔으므로,
이번 라운드는 (1) 직전 라운드들이 남긴 INFO 가 이번 diff 로 상태 변화가 있는지, (2) 지금까지
어느 라운드도 짚지 않은 새 각도가 있는지 두 가지를 중심으로 봤다. 핵심 파일을 전량 `Read` 로
대조했다 — `codebase/packages/masked-markers/src/{index.ts,__tests__/index.spec.ts}`,
backend/frontend `masked-marker-mirror{-guard,}.{ts,spec.ts,test.ts}` 4개 파일(라인 단위 diff),
`sanitize-error-message.ts`/`masked-markers.ts` 재export shim, 그리고 이 PR 이 건드리지 않은
인접 회귀 스위트(`sanitize-error-message.spec.ts`, `lib/utils/__tests__/masked-markers.test.ts`)
도 "이 PR 이후에도 유효한가" 관점에서 열었다.

## 발견사항

- **[WARNING]** 인접 회귀 테스트(이 PR 미변경 파일)의 JSDoc 이 이 PR 이 방금 닫은 상태를
  "아직 안 닫혔다"고 서술한다 — 다음 사람을 오도한다
  - 위치: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:13-24`
    (`it("마커 집합이 이 리터럴 목록에서 이탈하지 않는다 (backend 미러는 트래커)", ...)` 바로
    위 JSDoc 블록)
  - 상세: 이 주석은 *"못 지킨다: backend 가 바뀌는 것. 같은 파일 안의 리터럴-대-리터럴
    비교라 진짜 크로스체크가 아니다 — backend jest 와 frontend vitest 가 갈려 있어 공유 패키지
    추출이 선행돼야 값싸다(트래커 "마커 미러 계약 테스트" 항목)"* 라고 적혀 있다. 그런데 이
    PR 자체가 정확히 그 "공유 패키지 추출"이고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:373,757`
    두 트래커 항목 모두 이 PR 로 `[x]` 처리됐다(`git show`로 확인). 이 파일이 import 하는
    `MASKED_MARKERS`(`codebase/frontend/src/lib/utils/masked-markers.ts:23-26`)는 이제
    `@workflow/masked-markers` 를 그대로 재export 하므로, 이 파일의 "리터럴-대-리터럴 비교"
    단언(`:26-32`)은 더 이상 "같은 파일 안의" 비교가 아니라 backend 와 **같은 패키지의 같은
    상수**를 보는 진짜 크로스체크가 됐다 — backend 가 그 패키지의 값을 바꾸면 이 정확한
    단언이 frontend 스위트에서 RED 를 낸다. 주석은 이 사실을 반영하지 못한 채 "여전히 갭이
    있다"는 인상을 남긴다. 테스트 자체는 여전히 유효(계속 GREEN, 계속 실질 검증)하므로
    회귀는 아니지만, 이 프로젝트가 반복해 지적해 온 "plan/코드 서술이 실제 상태보다 좁거나
    stale 하면 다음 사람이 이미 닫힌 일을 다시 하거나 근거 없는 불안을 갖는다" 패턴과 정확히
    같은 형태다. 이 PR 의 diff 목록에는 포함되지 않은 파일이라 "이 PR 이 만든 결함"은
    아니지만, 이 PR 이 스스로 닫았다고 선언한 바로 그 갭을 참조하고 있어 정정 비용이 낮다.
  - 제안: JSDoc 을 "이제 `@workflow/masked-markers` 를 통해 backend 와 같은 상수를 본다 —
    이 리터럴 비교는 그 상수가 바뀌면 여기서도 RED 를 낸다"로 갱신하고, "트래커 항목" 언급을
    제거하거나 종결 커밋을 가리키게 고친다.

- **[INFO]** 미러 재발 가드(`findRedeclaredSymbols`)의 탐지 범위가 "선언 노드"로 명시적으로
  좁혀져 있는데, 그 경계의 **반대편**(import 출처를 검증하지 않는 것)을 직접 겨냥한 테스트가
  없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:110-136`
    (`findRedeclaredSymbols`, 특히 `:122-126` 의 `record()` — `ts.isIdentifier(name)` 만
    통과시킴), frontend 쌍둥이 `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:110-137`
    도 동일 로직.
  - 상세: 두 파일 JSDoc(`backend :100-108`, `frontend :104-108`)은 "import 로 들여온 바인딩과
    재export 도 선언 노드가 아니라서 걸리지 않는다"를 **의도된** 설계로 명시한다. 그런데 이
    설계가 실제로 뜻하는 바는, 예를 들어 `import { MASKED_MARKERS } from "./local-fake";
    export { MASKED_MARKERS };` 처럼 **SoT 패키지가 아닌 다른 곳에서** 같은 이름을 들여와
    재export 해도 가드는 통과시킨다는 것이다 — import 모듈 지정자(`from` 뒤의 경로)를 전혀
    보지 않기 때문이다. 두 spec/test 파일의 "정상 형태를 오탐하지 않는다" `it.each` 표는
    전부 `from "@workflow/masked-markers"` 로 고정된 fixture 만 쓰고(`backend :175-191`,
    `frontend :185-201`), "SoT 가 아닌 곳에서 온 재export 도 (의도대로) 통과한다"는 경계를
    직접 확인하는 케이스가 없다. 마찬가지로 `record()` 는 `ts.isIdentifier(name)` 만 참으로
    받아 `const { MASKED_MARKERS } = obj;` 같은 구조분해 선언(`node.name` 이
    `ObjectBindingPattern`)도 탐지되지 않는다 — 이 역시 테스트로 못박혀 있지 않다. 둘 다
    현재 저장소 관행에서 실제로 쓰일 가능성은 낮고, JSDoc 이 "선언 노드만 본다"는 스코프를
    이미 명시했으므로 **결함은 아니다**. 다만 이 스코프의 실질 함의(어디서 import 하든
    재export/별칭이면 통과)를 직접 겨냥한 부정 테스트가 없어, 향후 스코프를 좁히려는
    사람이 "이미 안전하다"고 오판할 여지가 남는다.
  - 제안: 비차단. 여유가 있으면 `it.each` 표에 `import { MASKED_MARKERS } from
    "./some-other-module"; export { MASKED_MARKERS };` 형태를 "[캐너리] 재선언이 아니다"로
    추가해, "이건 알려진 스코프 경계이지 누락이 아니다"를 기계로도 문서화할 수 있다.

## 재확인 — 상태 변화 없음 (직전 라운드 INFO)

`13_55_59/testing.md` 가 남긴 INFO 3건(backend 깊이 상한 경계 미고정 · frontend 깊이 경계
테스트가 `MAX_MASK_DEPTH` 를 import 하지 않고 리터럴 10/11 사용 · backend 미러 가드의 고정
상대경로 `repoRoot`)은 이번 diff 로 손대지 않아 상태 변화가 없다. 전부 `plan/in-progress/masked-marker-shared-package.md`
"후속(이 PR 밖)" 절에 이미 등재돼 있거나 저위험으로 재확인된 항목이라 반복 등재하지 않는다.

## 긍정적 관찰

- 신설 패키지 스펙(`index.spec.ts`)은 `it.each` 로 세 마커 리터럴을 직접 못박아 "상수 간
  상호 정합만 본다"는 자기참조 함정을 피했고, `Object.freeze(Set)` 플라시보 회귀를
  `.push()` 가 실제로 `TypeError` 를 던지는지까지 확인하는 캐너리로 고정했다. `isMaskedMarker`
  의 정확 일치 경계(부분 포함·접두·접미·공백·빈 문자열·유사 리터럴)와 비문자열 입력 5종을
  전부 커버한다.
- backend/frontend 쌍둥이 미러 재발 가드는 테스트 이름이 문자 그대로 1:1 대응한다(직접
  `diff` 로 확인) — vacuity 방지(스캔 디렉터리·파생 심볼 비지 않음), 양성 탐지(합성
  fixture), 오탐 회피(재export·지역 별칭·주석/문자열 언급·무관한 리터럴·심볼 접두 겹침·
  **경로** 접두 겹침), 함수 선언 형태 재선언 탐지까지 갖춰 이 시리즈에서 실제로 났던 회귀를
  전부 캐너리로 잠갔다. 임시 디렉터리 fixture 는 `try/finally` 로 정리돼 테스트 격리가
  지켜지고, 두 스택이 각자 자기 워크플로에서 도는 사본이라 서로 상태를 공유하지 않는다.
- 소비처 재export shim(`sanitize-error-message.ts`/`masked-markers.ts`)은 시그니처·리터럴
  값이 전부 동일해 기존 회귀 스위트(`sanitize-error-message.spec.ts` 의 "MASKED_MARKERS
  불변성"/"마커 집합이 이 리터럴에서 이탈하지 않는다" 등, 이번 PR 로 미변경)가 수정 없이
  그대로 통과한다 — "값 자체는 무변경"이라는 이 PR 의 핵심 주장을 회귀 테스트가 실증한다.
  frontend `masked-markers.test.ts` 의 깊이 경계 테스트(`nest(10)→true`/`nest(11)→false`,
  배열 분기 포함)도 `MAX_MASK_DEPTH` 값 자체(10)가 무변경이라 여전히 유효하다.
- 순수 함수 설계(`resolveScanDirs`/`findMirrorRedeclarations`/`findRedeclaredSymbols` 모두
  `repoRoot`/`source` 를 매개변수로 받음)가 테스트 용이성을 높인다 — 전역 상태나 하드코딩
  경로에 의존하지 않아 임시 디렉터리 주입만으로 합성 fixture 를 검증할 수 있다.

## 요약

이번 라운드의 실질 diff(20개 코드 파일)는 이미 7라운드에 걸쳐 테스트 관점 리뷰가 촘촘히
반복된 결과물이라 CRITICAL/WARNING 급 새 결함은 거의 남아 있지 않다. 이번에 새로 짚은
WARNING 1건은 이 PR 이 만든 결함이 아니라, 이 PR 이 스스로 닫은 갭을 참조하는 **이 PR 밖**
회귀 테스트의 stale JSDoc 이다 — 테스트 판정 자체는 계속 유효하고 오히려 이 PR 덕분에 실질
보장이 강화됐는데, 주석이 그 사실을 반영하지 못해 다음 사람이 이미 닫힌 갭을 다시 조사하거나
불필요한 불안을 가질 수 있다. INFO 1건은 미러 가드의 문서화된 스코프 경계(import 출처 미검증,
구조분해 선언 미탐지)를 직접 겨냥한 부정 테스트가 없다는 점으로, 결함이 아니라 스코프를
기계로도 못박으면 더 좋을 자리다. 신설 공유 패키지 테스트와 양쪽 미러 재발 가드 테스트 모두
vacuity·오탐·격리·경계값·회귀 형태를 신경 쓴 성숙한 설계이며, 인접 회귀 스위트도 재export
전환 이후에도 여전히 유효하다. 테스트 관점에서 이 PR 은 병합 가능한 상태다.

## 위험도

LOW
