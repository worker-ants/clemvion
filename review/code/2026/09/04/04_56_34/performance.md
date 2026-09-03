# 성능(Performance) 리뷰

## 스코프 메모

리뷰 대상 파일 목록 중 실질 코드/문서 변경은 파일 1~10
(`codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}`, `repo-guards/__tests__/`
5개 가드 파일(walker → `collectTsFiles` 위임 전환), 신규 가드
`nullable-type-lie-cast-guard.ts`/`.spec.ts`, `plan/in-progress/entity-nullable-column-type-mismatch.md`)이고,
나머지(파일 11 이후)는 이 PR 자신의 이전 리뷰 라운드(`review/code/2026/09/04/{01_48_39...04_37_28}/**`)
산출물이라 신규 로직이 아니다 — 성능 관점 분석 대상에서 제외했다.

핵심 변경은 두 가지다: ① `repo-guards/__tests__/` 5곳에 흩어져 있던 재귀 디렉터리 walker
(`readdirSync` 기반, 각 10~20줄)를 `source-scan.ts` 의 `collectTsFiles()` 하나로 통합, ②
`| null` 로 넓혀진 엔티티 필드를 겨눈 `.spec.ts` 의 낡은 `null as unknown as` 캐스트를 찾는
신규 가드(`widenedEntityFields`/`findStaleSpecCasts`) 추가. 둘 다 **빌드/테스트 시점에만
실행되는 정적 분석 도구**이고, 스캔 대상은 저장소 자신의 `codebase/backend/src` 트리(비-spec
818개, `.entity.ts` 41개, `.spec.ts` 443개, 트리 전체 15MB)로 크기가 작고 고정돼 있다 —
프로덕션 런타임 경로·API 응답 경로에는 전혀 개입하지 않는다.

## 확인한 것 (직접 실측)

- `codebase/backend/src` 비-spec `.ts` 파일 수: **818개**, `.entity.ts`: **41개**, 트리 크기: **15MB**.
- `collectTsFiles`(`source-scan.ts:249-271`) 통합은 기존 5개 walker 사본과 **알고리즘적으로 동일**
  (O(n) 단일 DFS 재귀 + `sort()`) — Big-O·호출 빈도 변화 없음. 순수 추출 리팩터다.
- `nullable-type-lie-cast.spec.ts` 의 각 `describe` 블록은 `collectScanTargets()`/`collectTsFiles(SRC_ROOT,
  {includeSpec:true})` 를 **블록 스코프에서 한 번만** 호출해 여러 `it()` 에 재사용한다(:81,
  :425). 저장소 전체 트리를 중복으로 두 번 걷는 형태는 없다 — docstring(:422-424)이 "두 번 부르면
  트리를 통째로 두 번 걷는다" 는 것을 스스로 명시하고 실측(엔티티 41·spec 443, 파생 전후 동일)까지
  남겨 뒀다. `widened` 값도 `:428` describe 스코프에서 한 번만 계산해 두 `it()` 이 재사용한다.

## 발견사항

- **[INFO]** `findCastOffenders`/`findUntypedNullableColumns` 가 동일한 818개 파일 목록의 내용을 각자 독립적으로 `fs.readFileSync` 한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:81`(`const files = collectScanTargets();`), `:92`(`findCastOffenders(files)`), `:104`(`findUntypedNullableColumns(files)`) — 구현은 `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:43-52`(`findCastOffenders` — 파일마다 `fs.readFileSync`)와 `:104-121`(`findUntypedNullableColumns` — 같은 파일을 별도로 다시 `fs.readFileSync`)
  - 상세: `files`(818개)는 한 번만 계산되지만, 그 배열의 **내용**은 두 함수가 서로 공유하지 않고 각자 디스크에서 다시 읽는다 — 판정 축(캐스트 존재 여부 vs `@Column` nullable/type 짝)이 서로 달라 함수를 분리한 설계 자체는 합리적이지만, 결과적으로 같은 800여 개 파일이 이 테스트 스위트 실행마다 디스크에서 2회 read 된다. 파일당 수 KB 수준이라 절대 비용은 작고(수십 ms 내외로 추정, 트리 전체 15MB 기준 2회 read 도 30MB 미만), CI/로컬 backend 테스트 실행 시점에만 발생해 프로덕션 요청 경로에는 영향이 없다.
  - 이 항목은 **신규 지적이 아니다** — 이 changeset 의 앞선 리뷰 라운드(`review/code/2026/09/04/03_58_32/performance.md`)가 이미 동일 지점을 INFO 로 짚었고 "조치 불필요 수준. 다음 접촉 시 '파일 목록 → 내용 맵 1회 로드 → 두 함수에 전달' 구조 고려 가능" 으로 판단이 확정돼 있었다. 이후 라운드(9R, `04_37_28`)에서 별도로 지적된 "저장소 트리 이중 워크"(W1)와 "`widenedEntityFields` 이중 재계산"(INFO#1)은 실제로 고쳐져 현재 코드(`nullable-type-lie-cast.spec.ts:425-428`)에 반영돼 있음을 직접 확인했다 — 이 항목만 이전 라운드의 "낮은 우선순위" 판단을 유지한 채 남아 있다.
  - 제안: 조치 불필요 수준 유지에 동의. 다음에 이 파일을 만질 기회가 있으면 `files.map(f => [f, fs.readFileSync(f, 'utf8')])` 로 내용을 1회 로드해 두 함수에 맵으로 전달하는 구조를 고려할 만하다(필수 아님).

## 요약

이 diff 의 핵심(5개 walker 사본 → `collectTsFiles` 통합, `null` 넓힘 캐스트 신규 가드)은
전부 빌드/테스트 시점에만 도는 정적 분석 도구이고, 대상 트리 크기가 작고 고정돼 있어(818개
비-spec `.ts`, 15MB) 알고리즘 복잡도·N+1·블로킹 I/O·메모리 관점에서 실질 위험이 없다. walker
통합 리팩터는 Big-O 가 완전히 동일한 순수 추출이며, 저장소 전체 트리를 중복으로 두 번 걷던
형태(9R 에서 지적된 실질 WARNING)는 이미 고쳐져 지금은 각 describe 블록에서 정확히 1회씩만
훑는다. 남은 유일한 관찰은 `findCastOffenders`/`findUntypedNullableColumns` 가 같은 818개
파일의 내용을 서로 캐시 없이 각자 다시 읽는다는 것인데, 이는 앞선 라운드에서 이미 검토돼
"조치 불필요" 로 확정된 사항이라 이번 라운드에서도 그 판단을 유지한다 — 새로운 CRITICAL/WARNING
급 성능 결함은 발견되지 않았다.

## 위험도

NONE
