# 테스트(Testing) 리뷰

이 diff 는 3라운드째 리뷰다. 1R(`W1` 정렬 커버리지 봉인 오판, `W2` `stripLiterals` 무테스트)와
2R(`W1` 동명 필드 충돌 오탐)에서 나온 testing 관점 WARNING 은 코드·테스트 양쪽에 반영돼 있는지
직접 실행·재현으로 확인했다. 그 위에서 독립적으로 남은 갭만 아래에 적는다.

## 회귀 확인 (기존 WARNING 이 실제로 닫혔는가)

- `npx jest src/common/__test-utils__/source-scan.spec.ts src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` → **57 passed**.
- `npx jest src/repo-guards` (가드 8스위트) → **139 passed**. RESOLUTION(`review/code/2026/09/04/02_12_38/RESOLUTION.md`)이 적은 수치와 일치.
- 1R W1(정렬 회귀 관측 가능성) 주장을 스캐폴딩 없이 직접 재현했다 — `nested-sibling.ts` 픽스처가 있는 동일 트리에서 `sort()` 를 뺀 walker 를 별도 스크립트로 돌리면 DFS 순서(`a.ts, nested/b.ts, nested/deep/c.ts, nested-sibling.ts`)가 정렬 순서(`a.ts, nested-sibling.ts, nested/b.ts, nested/deep/c.ts`)와 실제로 갈린다(로컬 macOS/APFS 실측). 테스트가 주장하는 판별력이 vacuous 하지 않음을 확인.
- 2R W1(동명 필드 충돌) — `nullable-type-lie-cast.spec.ts:289-315` 의 대조군이 `A.userId`(nullable)/`B.userId`(non-null) 픽스처로 충돌 제외를 검증하고, `:317-335` 대조군이 충돌 없는 이름은 계속 잡히는 것을 검증한다. 두 대조군 다 실행 확인.

## 발견사항

- **[INFO]** `sort()` 회귀 감지력이 `fs.readdirSync` 가 이미 알파벳순으로 정렬돼 있지 않다는, POSIX/Node 어디에도 보장되지 않는 성질에 의존한다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:207-250` (`nested-sibling.ts` 픽스처 + 정렬-관측 docstring)
  - 상세: 이 테스트의 판별력은 "DFS 순회 순서(readdirSync 반환 순서) ≠ 정렬 순서" 라는 전제 위에 서 있다. 로컬(Darwin/APFS)에서 스크립트로 직접 재현해 전제가 참임을 확인했고, CI(`ubuntu-latest`, 통상 ext4 htree 해시 순서)에서도 알파벳순으로 우연히 일치할 가능성은 낮다. 다만 이건 파일시스템 구현에 달린 비보장 동작이라, 이론상 `readdirSync` 가 알파벳순을 돌려주는 환경(또는 향후 Node 런타임 변경)에서는 이 테스트가 `sort()` 뮤턴트를 조용히 통과시킬 수 있다 — 검증 자체가 실행 호스트의 부수적 성질에 결속된 형태다. docstring 이 이미 이 트레이드오프의 절반(연속성 vs 상대위치)을 설명하고 있으니, 완전히 새로운 정보는 아니지만 "환경 종속 판별력"이라는 프레이밍은 명시돼 있지 않다.
  - 제안: 급하지 않음. 가장 확실한 대안은 `readdirSync` 반환을 fake(fs mock 이 아니라 `withFileTypes` 결과를 흉내낸 순수 함수로 walker 시그니처를 분리)해 순서를 직접 주입하는 것이지만, docstring 이 이미 "`fs` property 가 non-configurable 이라 spy 실패, 픽스처가 더 단순하다"고 트레이드오프를 밝혀 뒀다 — 재작업보다는 CI 통과 이력을 계속 신뢰하는 쪽이 합리적이다.

- **[INFO]** `stripComments → stripLiterals` 순서의 알려진 blind spot(문자열 안 `//` 를 주석으로 오인해 절단)에는 `stripLiterals` 자신의 "중첩 백틱" 한계와 달리 RED-고정 테스트가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:215`(`stripLiterals(stripComments(...))` 호출 순서), 한계 서술은 `codebase/backend/src/common/__test-utils__/source-scan.ts:45-48`("가드의 존재 이유가 조용히 통과를 막는 것이므로 그쪽을 닫는다")
  - 상세: 같은 PR 이 `stripLiterals` 의 중첩 백틱 한계는 `source-scan.spec.ts:330-334`(`[알려진 한계]` 네이밍)로 **테스트로 고정**해 뒀다. 그런데 `stripComments`→`stripLiterals` 순서 때문에 생기는 대칭적 위험 — 문자열 리터럴 안에 `//` 가 들어 있으면 `stripComments` 가 리터럴 경계를 모른 채 그 지점부터 줄 끝까지 잘라내(예: `` `url: 'http://x' as unknown as URL` `` 같은 리터럴에서 `//` 이후가 통째로 사라짐) 뒤쪽 캐스트 패턴이 은폐될 수 있다 — 는 docstring 에만 적혀 있고 pinning 테스트가 없다. 1R 에서 security 리뷰어가 INFO#5 로 이미 지적했고 방향(저탐지, 무해)까지 판단이 끝난 항목이라 재열기를 요구하는 건 아니지만, "알려진 한계는 테스트로 고정한다"는 이 PR 자신의 관례를 이 자리에만 적용 안 한 비대칭이라 testing 관점에서 다시 짚는다.
  - 제안: 급하지 않음. 나중에 이 영역을 만질 때 `[알려진 한계]` 네이밍으로 `` 'url: http://foo' as unknown as `` 류 픽스처 하나를 `stripLiterals` 스위트나 `findStaleSpecCasts` 스위트에 추가해 대칭을 맞추는 정도로 충분.

- **[INFO]** (2R INFO#8 재확인, 미해결 상태 유지) `WIDENED_DECL` 의 "추가 데코레이터 1개까지" 한계는 여전히 docstring 서술만 있고 pinning 테스트가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:155-160`(한계 docstring), 정규식 본체 `:162-163`
  - 상세: 새 항목이 아니라 2R 에서 이미 INFO 로 기록되고 "위음성 방향이라 우선순위 낮음"으로 유예된 항목이 이번 라운드에도 그대로 남아 있음을 확인했다(코드 변경 없음). `stripLiterals`(같은 PR, 같은 파일 계열)는 알려진 한계를 테스트로 고정했는데 이쪽만 비대칭이라는 지적도 유지된다.
  - 제안: 이미 내려진 유예 결정을 존중 — 급하지 않음. 저장소에 2단 이상 스택 데코레이터가 실재하는 날 이 주석이 처방을 근거로 준다.

## 요약

핵심 테스트 인프라 변경(`collectTsFiles` 통합, `stripLiterals` 신설, `widenedEntityFields`/`findStaleSpecCasts` 신설)에 대해 전용 테스트가 충실히 갖춰져 있고, 1R·2R 에서 testing 관점으로 지적된 두 개의 실질적 갭(정렬 회귀 미관측·`stripLiterals` 무테스트·동명 필드 오탐)이 모두 실제 뮤테이션(RED 재현)을 동반해 닫혔음을 이번 라운드에서 직접 재실행·재현으로 재확인했다. 57개 신규/관련 테스트와 139개 가드 스위트 전부 GREEN. 남은 항목은 전부 INFO 수준으로, ①정렬-회귀 테스트의 판별력이 파일시스템의 비보장 순서 동작에 기댄다는 프레이밍 보강, ②`stripComments`→`stripLiterals` 순서의 알려진 blind spot 에 대칭적 pinning 테스트 부재, ③이미 유예 결정된 `WIDENED_DECL` 데코레이터 한계 pinning 부재(신규 아님) — 모두 실제 배포 위험이 없는 문서/견고성 다듬기 수준이라 병합을 막을 사유가 아니다.

## 위험도
LOW
