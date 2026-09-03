# 유지보수성(Maintainability) 리뷰

## 검증 방법

diff 대상 9개 파일 중 실제 코드 파일 8개(`source-scan.ts`/`.spec.ts`, `audit-action-binding-guard.ts`,
`engine-error-code-anchor-guard.ts`, `masked-reject-callers-guard.ts`/`.spec.ts`,
`nullable-type-lie-cast-guard.ts`/`.spec.ts`, `redis-fail-open-catalog-guard.ts`)을 저장소에서
`Read`로 직접 열어 현재(HEAD) 상태를 확인했다. 이 changeset 은 이미 6라운드(01_49_18~03_37_37)의
리뷰·조치를 거쳤으므로, 이전 라운드가 조치했다고 기록한 항목(1R W3 `withFiles`/`withFixture`
중복 제거, 1R W4 JSDoc 위치, 6R W1 `listSourceFiles`의 `includeSpec` 배선 테스트 추가)이 실제로
반영됐는지를 코드에서 직접 대조했고, 그 과정에서 6R W1 조치 자체가 새로 만든 문제를 발견했다.
저장소는 읽기만 했고 아무것도 쓰지 않았다.

## 발견사항

- **[WARNING]** 6R 에서 테스트를 추가하며 끼워 넣은 JSDoc 이 원래 그 자리에 있던 JSDoc 을 orphan 시켰다 — 1R W4 와 같은 결함 클래스의 재발
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts:11-27`(orphan 된 원본 JSDoc, "Manual 실행 경로가 마커 거부를 건너뛰지 못하게 한다…") · `:28-41`(6R 이 새로 끼워 넣은 JSDoc) · `:42-60`(6R 이 새로 끼워 넣은 `describe('스캔 대상에 \`.spec.ts\` 가 포함된다', …)`) · `:62`(원래 JSDoc 이 설명하던 대상 `describe('resolveTriggerParameters 직접 호출부 허용목록', …)`)
  - 상세: 파일 상단의 JSDoc(11~27줄, "Manual 실행 경로가 마커 거부를 건너뛰지 못하게 한다…")은 내용상 `ALLOWED_DIRECT_CALLERS`/`findUnexpectedCallers` 를 다루는 `describe('resolveTriggerParameters 직접 호출부 허용목록', …)`(62줄)를 설명하는 문서다("새 파일이 걸리면 판단이 필요하다: Manual 실행 경로 → wrapper… / 외부 시스템 페이로드 → 목록에 추가"). 6R 은 직전 라운드(5R)의 testing WARNING("`includeSpec: true` 옵션이 빠져도 테스트가 안 죽는다")을 고치면서, 원래 JSDoc 바로 뒤(28줄)에 **새 JSDoc**과 **새 `describe` 블록 전체**(42~60줄)를 끼워 넣었다. 그 결과 11~27줄 JSDoc 은 이제 자신이 설명하던 `describe`(62줄)로부터 완전히 분리된 채, 아무 선언도 없이 **또 다른 JSDoc** 바로 위에만 놓여 있다 — 이 저장소 파일들 전반이 지켜온 "JSDoc 은 자신이 설명하는 선언 바로 위에 붙는다" 관례가 깨졌다. 위에서 아래로 읽으면 "Manual 경로 규칙 설명 → (아무 코드 없이) `.spec.ts` 스캔 배선 설명 → `.spec.ts` 스캔 describe" 순서가 되어, 첫 JSDoc 이 마치 문서화 대상이 없는 채로 떠 있거나 다음 JSDoc/블록에 잘못 귀속되는 것처럼 읽힌다. 이는 바로 이 changeset 의 1R 에서 `source-scan.ts`(`stripLiterals` 삽입이 `countCalls` JSDoc 을 orphan 시킴)로 이미 한 번 발견·수정된 것과 **정확히 같은 실패 모드**다 — "중간에 새 코드를 끼워 넣을 때 앞뒤 JSDoc-선언 결속을 확인하지 않는다" 는 패턴이 6라운드 동안 두 번째로 재발했다.
  - 제안: 11~27줄 JSDoc 을 62줄(`describe('resolveTriggerParameters 직접 호출부 허용목록', …)`) 바로 위로 옮기고, 28~41줄 JSDoc 은 그대로 42줄 `describe('스캔 대상에 \`.spec.ts\` 가 포함된다', …)` 바로 위에 둔다(현재도 이 둘의 관계는 올바르다). 즉 파일 상단 삽입 순서를 "새 describe 블록 전체(자신의 JSDoc 포함) → 기존 JSDoc → 기존 describe" 로 재배치하면 된다.

- **[INFO]** `collectTsFiles({ includeSpec: true })` 실사용처가 이제 둘인데, 관련 JSDoc·테스트 이름은 여전히 "하나"/"유일" 이라고 말한다 — 이미 알려져 있고 6R 에서 의도적으로 유예된 항목
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:213-216`(`CollectTsFilesOptions.includeSpec` JSDoc, "실사례가 하나 있다: masked-reject-callers-guard…") · `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:252`(테스트 제목 "masked-reject 가드가 쓰는 유일한 축") · 실사용 2건은 `masked-reject-callers-guard.ts:51` 과 `nullable-type-lie-cast.spec.ts:399`(`collectTsFiles(SRC_ROOT, { includeSpec: true })`)
  - 상세: `nullable-type-lie-cast.spec.ts` 의 "저장소 전수" 테스트가 `includeSpec: true` 를 직접 호출해 두 번째 실사용처가 됐는데, source-scan.ts JSDoc 과 source-scan.spec.ts 테스트 제목은 여전히 "하나"/"유일" 이라고 서술한다. 6R RESOLUTION(`review/code/2026/09/04/03_37_37/RESOLUTION.md` INFO#1)이 이미 같은 지점을 지적받았고 "검증되지 않는 숫자는 적지 않는다는 규칙과 충돌하니 이 라운드에서는 개수 표현을 다시 늘리지 않고, 다음에 그 파일을 만질 때 빼는 것으로 남긴다"고 명시적으로 유예를 결정한 항목이다 — 새 발견이 아니라 기존 유예의 재확인.
  - 제안: 조치 불필요(기존 결정 유지). 다음에 `source-scan.ts`/`source-scan.spec.ts` 를 만질 기회가 있으면 "하나"/"유일" 표현을 개수 대신 "실사례가 있다" 정도로 낮추는 것을 고려.

## 확인된 정상 항목 (재검증)

- 1R W3(`withFiles`/`withFixture` 중복) — `nullable-type-lie-cast.spec.ts:55-78` 에서 `withFixture` 가 `withFiles` 의 얇은 래퍼로 유지되고 있음을 확인.
- 1R W4(JSDoc orphan, `source-scan.ts`) — `stripLiterals`(57~82줄)·`countCalls`(84~93줄) 각자 자기 JSDoc 을 정확히 갖고 있음을 확인(위 WARNING 은 **다른 파일**에서 같은 결함 클래스가 재발한 것).
- `nullable-type-lie-cast-guard.ts`/`nullable-type-lie-cast.spec.ts` — 함수 길이·중첩 깊이 전부 관리 가능한 수준(가장 긴 함수도 20줄 내외, 중첩은 최대 2~3단). `WIDENED_DECL` 정규식이 파일에서 가장 복잡한 지점이지만 한계(추가 데코레이터 1개까지)가 docstring `## 한계` 절에 명시돼 있어(6R 에서 이미 확인된 사항) 새 지적 없음.
- `audit-action-binding-guard.ts`/`engine-error-code-anchor-guard.ts`/`redis-fail-open-catalog-guard.ts`/`masked-reject-callers-guard.ts` — `collectTsFiles` 위임으로 통합된 이후 각 파일의 한 줄 래퍼(`collectSourceFiles`/`listSourceFiles`/`listProductionSources`) 이름이 여전히 4가지로 갈리는 상태이나, 이는 5R/6R 에서 이미 INFO 로 기록되고 "다음에 그 파일들을 개별적으로 만질 때 정리" 로 명시적으로 유예된 항목이라 재기재하지 않는다.

## 요약

핵심 변경(`repo-guards/__tests__/` 5곳의 walker 사본을 `collectTsFiles` 로 통합 + 넓혀진 nullable
필드를 겨눈 낡은 spec 캐스트를 잡는 `widenedEntityFields`/`findStaleSpecCasts` 신규 가드)은 6라운드
리뷰를 거치며 유지보수성 관점에서 매우 견고해진 상태다. 함수는 짧고 단일 책임을 지키며, 새로
도입된 함수마다 "왜 필요한가/왜 오탐이 없는가/한계는 무엇인가" 절을 갖춘 JSDoc 을 일관되게 달아
이 파일들이 확립한 "주석이 판단 기록" 관례를 유지한다. 다만 직전 라운드(6R)가 testing WARNING을
고치며 `masked-reject-callers.spec.ts` 상단에 새 JSDoc+describe 블록을 끼워 넣는 과정에서, 정확히
이 changeset 의 1R 에서 이미 한 번 발견·수정됐던 것과 같은 실패 모드(JSDoc 삽입 위치가 기존 JSDoc
을 그 대상 코드로부터 갈라놓음)를 다른 파일에서 재발시켰다 — "코드 중간에 새 블록을 끼워 넣을 때
앞뒤 JSDoc-선언 결속을 다시 확인하지 않는다"는 패턴이 이 PR 안에서 두 번째로 나타난 것이라 WARNING
으로 기록한다. 그 외 남은 항목(`includeSpec` 실사용처 개수 서술의 잔여 불일치, 래퍼 이름 4종 잔존)
은 이미 이전 라운드에서 확인·유예가 결정된 INFO 급 항목으로, 이번 라운드에서 새로 늘어난 위험은
없다.

## 위험도

LOW
