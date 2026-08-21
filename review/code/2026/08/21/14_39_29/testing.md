STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — `@workflow/masked-markers` 추출 (`14_39_29`, 라운드9)

## 검토 범위와 방법

이 PR(`masked-marker-contract-7d2e14`)은 이미 8라운드(`11_27_29`~`14_19_12`)에 걸쳐 테스트
관점 리뷰·수정이 반복돼 왔다. 이번 라운드의 실질 diff 는 직전 라운드(`14_19_12`) WARNING 1건
("이 PR 이 방금 닫은 것을 아직 열려 있다고 서술")을 처분한 커밋(`85197720e`) 하나뿐이다 —
`codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` 의 JSDoc·테스트 이름 정정.

핵심 소스를 `Read` 로 전량 대조했다: 신규 패키지(`codebase/packages/masked-markers/src/{index.ts,
__tests__/index.spec.ts}`), backend/frontend 미러 재발 가드 4파일(`masked-marker-mirror{-guard,}.
{ts,spec.ts,test.ts}`), 재export shim(`sanitize-error-message.ts`/`masked-markers.ts`), 이번
라운드가 고친 `masked-markers.test.ts`, 그리고 이 PR 이 건드리지 않은 인접 회귀 스위트
(`sanitize-error-message.spec.ts`)를 "이 PR 이후에도 유효한가" 관점에서 재확인했다. 또한
`plan/in-progress/masked-marker-shared-package.md` 의 "후속(이 PR 밖)" 절과 `.claude/
test-stages.sh`(`INTERNAL_PACKAGES` 등록)를 대조해 CI 배선이 테스트 실행을 실제로 커버하는지
확인했다.

## 발견사항 — 이번 라운드 신규

없음(CRITICAL/WARNING/INFO 전부 없음).

`masked-markers.test.ts` 의 JSDoc 정정을 직접 검증했다:

- **정정 후 서술이 실제 코드 상태와 정확히 일치한다.** `MASKED_MARKERS`(`codebase/frontend/src/
  lib/utils/masked-markers.ts:22-26,56`)는 `@workflow/masked-markers` 재export 이고, backend
  `sanitize-error-message.ts`(`:10-17,167`)도 같은 패키지를 import 한다 — "미러가 없으니 대조할
  두 벌도 없다"는 새 주석 문구가 사실이다.
- **테스트 이름 변경도 정확하다.** `it("마커 집합이 이 리터럴 목록에서 이탈하지 않는다 (backend
  미러는 트래커)", ...)` → `it("마커 집합이 SoT 리터럴에서 이탈하지 않는다", ...)`. 괄호 안
  "backend 미러는 트래커" 문구(이미 닫힌 트래커를 가리킴)가 제거됐고, 단언 자체(`expect([...
  MASKED_MARKERS]).toEqual([...])`)는 변경되지 않아 검증 내용의 회귀는 없다.
- **인용 보존 방식이 적절하다.** 종전 서술("못 지킨다: backend 가 바뀌는 것 …")을 지우지 않고
  `*"…"*` 인용 뒤에 "그 추출이 됐다"로 대체 사유를 이어 붙였다 — 이 프로젝트가 반복 채택해 온
  "삭제 대신 대체 근거 남기기" 패턴과 일치한다.
- **줄 길이 위반 없음.** 파일 전체를 문자 수 기준(바이트 아님)으로 실측한 결과 100자를 넘는
  줄이 없다(직접 계산, `awk` 의 바이트 카운트로는 다수가 100 초과로 보이나 이는 한글 3바이트
  인코딩 때문 — `length($0)` 를 문자 단위로 보정하면 전부 100 이하).
- **부작용 없음.** 이 diff 는 JSDoc·테스트 이름만 바꿨고 단언 로직·픽스처는 무변경이라 회귀
  테스트로서의 유효성이 그대로 유지된다.

## 재확인 — 상태 변화 없음 (직전 라운드들이 남긴 INFO)

이번 diff 로 손대지 않아 상태 변화가 없는 항목들. 전부 `plan/in-progress/
masked-marker-shared-package.md` "후속(이 PR 밖)" 절에 이미 등재돼 있거나 문서화된 설계
스코프로 저위험 재확인된 항목이라 반복 등재하지 않는다.

- **backend `deepRedactSecrets` 깊이 경계가 정확한 값(10)을 고정하지 않는다.** 프런트
  `masked-markers.test.ts`(`nest(10)→true`/`nest(11)→false`, 배열 분기 포함)는 `MAX_MASK_DEPTH`
  값이 바뀌면 즉시 RED 를 내는 정밀 경계 테스트인 반면, backend
  `sanitize-error-message.spec.ts:239-244` 의 `'caps recursion depth'` 테스트는 25단 중첩에
  대해 `not.toThrow()`만 확인한다 — 값이 10→1 처럼 잘못 바뀌어도 이 테스트 단독으로는 못
  잡는다. `plan/in-progress/masked-marker-shared-package.md:177-184` 가 이미 이 갭을 등재하고
  "실질 위험은 낮다(`codebase/packages/**` 변경은 양쪽 워크플로에 relevant 라 프런트 경계
  테스트가 같은 PR 에서 돈다)"는 근거까지 남겨 뒀다. 이번 PR 이 새로 만든 갭이 아니고, 이미
  추적 중이라 INFO 로도 재등재하지 않는다(확인만).
- **미러 재발 가드의 탐지 스코프(선언 노드만) 반대편을 겨냥한 부정 테스트 부재** — SoT 가
  아닌 다른 모듈에서 import 해 재export 해도 통과하는 경계, 구조분해 선언 미탐지 — 는 두 가드
  JSDoc(`masked-marker-mirror-guard.ts` backend `:100-108`, frontend `:104-108`)이 의도된
  설계로 명시하고 있어 결함이 아니다(`14_19_12` INFO 로 이미 기록, 상태 변화 없음).
- **`resolveScanDirs`의 방어적 조기 반환 분기**(`repoRoot`/`base` 미존재, `dirsOf` 의 `abs`
  미존재)를 직접 겨냥한 단위 테스트가 없다 — 실제 저장소·합성 tmp fixture 모두 대상 경로가
  항상 존재해 이 분기가 테스트 스위트 안에서 행사되지 않는다. 도달 가능성이 낮은 방어적
  코드라 결함은 아니며, 이전 라운드들도 지적하지 않은 자리다(최초 관찰이지만 INFO 미만).

## 긍정적 관찰 (재확인)

- 신설 패키지 스펙(`index.spec.ts`)은 `it.each` 로 세 마커 리터럴을 직접 못박아 "상수 간 상호
  정합만 본다"는 자기참조 함정을 피했고, `Object.freeze(Set)` 플라시보 회귀를 `.push()` 가
  실제로 `TypeError` 를 던지는지까지 확인하는 캐너리로 고정했다. `isMaskedMarker` 의 정확
  일치 경계와 비문자열 입력 5종을 전부 커버한다.
- backend/frontend 쌍둥이 미러 재발 가드는 테스트 이름이 문자 그대로 1:1 대응하고, vacuity
  방지·양성 탐지(합성 fixture)·오탐 회피(재export·지역 별칭·주석/문자열 언급·심볼/경로 접두
  겹침)·함수 선언 형태 재선언 탐지까지 갖춰 이 시리즈에서 실제로 났던 회귀를 전부 캐너리로
  잠갔다. 임시 디렉터리 fixture 는 `try/finally` 로 정리돼 테스트 격리가 지켜지고, 서로 다른
  `mkdtempSync` prefix 를 써 병렬 실행 시에도 충돌하지 않는다.
- 재export shim(`sanitize-error-message.ts`/`masked-markers.ts`)은 시그니처·리터럴 값이
  동일해 이번 PR 이 건드리지 않은 회귀 스위트(`sanitize-error-message.spec.ts`)가 수정 없이
  그대로 통과한다 — "값 자체는 무변경"이라는 이 PR 의 핵심 주장을 회귀 테스트가 실증한다.
- 순수 함수 설계(`resolveScanDirs`/`findMirrorRedeclarations`/`findRedeclaredSymbols` 모두
  `repoRoot`/`source` 를 매개변수로 받음)가 테스트 용이성을 높인다 — 전역 상태·하드코딩 경로
  의존 없이 임시 디렉터리 주입만으로 합성 fixture 를 검증한다.
- CI 배선도 실제로 테스트 실행을 보장한다: `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` 에
  `@workflow/masked-markers` 가 등록돼 lint/unit/build 3단계 모두 이 패키지를 커버하고, 그
  목록 자체는 `internal-package-registration.test.ts` 가드가 `codebase/packages/*` 대조로
  누락을 잡는다(회귀 방지 이중 배선).

## 요약

이번 라운드의 실질 diff는 직전 라운드가 남긴 WARNING 1건(인접 회귀 테스트의 stale JSDoc)을
정확하게 처분한 것 하나다 — 새 코드 없이 서술만 고쳤고, 정정 후 문구가 실제 코드 상태(공유
패키지 재export, 미러 소멸)와 정확히 일치함을 직접 대조로 확인했다. 부작용·회귀 없음. 8라운드
동안 추출된 값 자체·미러 재발 가드의 핵심 로직에는 지적이 쌓이지 않았고, 남은 항목은 전부
`plan/in-progress/masked-marker-shared-package.md` "후속(이 PR 밖)" 절에 근거와 함께 이미
추적 중인 저위험 INFO 급뿐이다(backend 깊이 경계 정밀도, 미러 가드 스코프 경계 부정 테스트).
테스트 관점에서 이 PR 은 병합 가능한 상태다.

## 위험도

NONE
