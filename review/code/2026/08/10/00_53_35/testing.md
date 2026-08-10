# 테스트(Testing) 리뷰 — plan-scan.ts / plan-scan.test.ts

## 발견사항

- **[WARNING]** `plan-scan.test.ts` 를 독립적으로 두 번 연속 실행했을 때 4개 테스트가 재현성 있게 FAIL 했고, 이후 8회 이상 재실행에서는 계속 PASS 했다 — 원인을 확정하지 못했다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` (테스트 실행 시점 관찰, 특정 줄 아님) / 관련 로직: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:112-127` (`findNonTerminalCompletedPlans`)
  - 상세: `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/plan-scan.test.ts` 를 처음 실행했을 때 다음 4개가 FAIL 했다(두 번째 실행에서도 동일하게 재현):
    - `accepts every terminal vocabulary and a missing status` — `no-status.md` 가 위반으로 잡힘
    - `skips a plan whose frontmatter does not parse` — `broken.md`(파싱 실패 fixture) 가 위반으로 잡힘
    - `` skips a non-string `status` rather than crashing or false-reporting `` — `status-empty.md`/`status-num.md`/`status-list.md` 가 위반으로 잡힘
    - `reports exactly the planted violations (no over-reach)` — `found` 목록에 `broken.md`, `no-status.md`, `status-empty.md`, `status-list.md`, `status-num.md` 가 추가로 섞여 나옴(기대 4건 대신 9건)

    즉 `typeof status !== "string"` 분기와 `catch { continue }` 분기가 **전혀 동작하지 않은 것처럼** `found` 가 나왔다 — `done.md`/`superseded.md`(유효 종료 어휘) 만 빼고 거의 모든 `complete/` fixture 가 위반으로 잡혔다.

    이후 조치와 결과:
    1. `findNonTerminalCompletedPlans`/`matter()` 를 격리된 디버그 테스트로 직접 호출 → 정상 동작(기대한 4건만 반환).
    2. `node -e` 로 `gray-matter` 를 직접 호출해 `broken.md`/`no-status.md` 파싱 확인 → 정상(문서화된 대로 throw/undefined).
    3. `rm -rf node_modules/.vite` 후 재실행 → PASS.
    4. `plan-scan.test.ts` 단독 재실행을 6회 이상 반복 → 전부 PASS.
    5. `tsc --noEmit` → 해당 파일 타입 에러 없음.

    코드 자체(`plan-scan.ts`)의 로직은 읽어봐도, 격리 재현에서도 문제가 없다. 그러나 최초 2회 연속 **동일한 패턴**으로 실패했다는 점은 무작위 노이즈보다는 "무언가 워밍업/캐시 상태에 의존"하는 것을 시사하고, 재현 실패가 결함 부재의 증거는 아니다.
  - 제안: 이 스위트는 바로 이 PR 이 고치려는 "위반 0건 = 검사가 작동한다는 증거 아님" 문제를 스스로 되풀이하면 안 되는 자리다 — 뒤집어 말해 "가끔 FAIL 함"도 게이트 신뢰를 깎는다. CI 에서 `--repeat`/여러 번 반복 실행으로 flakiness 유무를 확인하거나, `gray-matter`/YAML 파싱 관련 첫 호출 워밍업 이슈가 없는지 (예: Vite 의존성 사전번들링 타이밍, 병렬 `it()` 블록 간 `matter()` 내부 캐시 등) 별도로 조사할 것을 권장한다. 최소한 이 관찰을 기록해두고 CI 로그에서 동일 패턴의 실패가 재발하는지 모니터링해야 한다.

- **[INFO]** `walkPlanMarkdown` 의 정렬(`out.sort(...)`) 이 어떤 테스트로도 관측되지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:71` (`out.sort((a, b) => a.relPath.localeCompare(b.relPath));`)
  - 상세: `plan-scan.test.ts` 에서 2개 이상 원소를 갖는 배열을 `toEqual` 로 비교하는 자리는 "reports exactly the planted violations" 뿐인데, 여기서는 실제 결과를 `.sort()` 로 다시 정렬한 뒤 기대값과 비교한다(`plan-scan.test.ts:142`). 나머지는 `toContain`/`not.toContain` (순서 무관) 이거나 원소가 1개뿐이다. 즉 `plan-scan.ts:71` 의 `sort` 를 지우거나 비교자를 뒤집어도 어떤 테스트도 RED 로 죽지 않는다 — 이 PR 이 다른 다섯 곳에서 고친 "무관측 분기" 와 같은 성격의 잔여 갭이다.
  - 제안: `collectCompletePlanMarkdown`/`collectLivePlanMarkdown` 이 이미 정렬된 순서로 반환된다는 것을 `toEqual`(정렬하지 않은 raw 배열)로 직접 단언하는 테스트를 하나 추가하면 닫힌다. (2개 이상 fixture 를 일부러 역순으로 이름 붙이면 관측 가능.)

- **[INFO]** `spec-plan-completion.test.ts`(Gate C) 는 여전히 자체 `collectCompletePlans` 구현을 갖고 있고, 이 PR 이 도입한 공유 `walkPlanMarkdown`/`collectCompletePlanMarkdown` 을 쓰지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (`collectCompletePlans`, 이번 diff 밖 — 변경되지 않음) vs `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:46-73` (`walkPlanMarkdown`)
  - 상세: `plan-scan.ts` 상단 주석(41-52줄 근방)은 "`plan/` 트리를 손으로 순회하는 walker 가 저장소에 네 벌 있었고 ... 여기서 두 수집기를 한 구현에서 파생시키고, Gate C 와 같은 면제 규칙을 쓴다" 고 적는다 — "같은 면제 규칙" 이라는 표현 자체는 정확하지만(코드 공유를 주장하지 않음), 실제로는 두 개의 독립된 `0-`/`_`/`archive` 필터 구현이 여전히 공존한다. 이미 `plan-frontmatter.test.ts`(`collectLivePlanMarkdown`)와 `spec-links.ts`(re-export)는 이번 PR 로 통합됐지만, Gate C 쪽은 그대로다. 오늘은 두 구현이 우연히 같은 규칙이라 데이터상 차이가 없지만, 어느 한쪽만 바뀌면(예: 새 접두 예외 추가) 조용히 어긋나는 정확히 그 실패모드가 남아 있고, 이를 잡아줄 테스트가 없다.
  - 제안: 이번 PR 범위 밖으로 봐도 무방하나, 후속 작업으로 Gate C 의 `collectCompletePlans` 도 `collectCompletePlanMarkdown` 으로 교체하거나, 최소한 두 구현이 동일 파일 집합을 반환하는지 비교하는 회귀 테스트를 추가할 가치가 있다.

- **[INFO]** `status: true`/`status: false` (bool 리터럴) 같은 boolean 케이스가 명시적으로 fixture 화되어 있지 않다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:49-55` (status-* fixture 군)
  - 상세: `status:`(null), `123`(number), `[complete]`(array), `no`(YAML 1.1 이면 false 였을 문자열) 는 다 다뤘지만 명시적 `status: true`/`status: false` 는 없다. `typeof status !== "string"` 분기가 boolean 도 이미 커버하므로 실질 위험은 낮지만, "YAML 1.1 불리언 축소" 코멘트의 취지상 `false` 리터럴 케이스를 하나 추가하면 그 분기의 완전성이 더 명확해진다.
  - 제안: 우선순위 낮음. 시간 되면 `status-bool.md`(`status: false`) fixture 하나 추가 고려.

## 좋았던 점 (요약에 반영)

- Mock 을 전혀 쓰지 않고 실제 `fs`(`mkdtempSync`/`writeFileSync`/`rmSync`) 로 합성 저장소를 만들어 검증한다 — 함수가 실제로 하는 일(파일시스템 순회·YAML 파싱)과 괴리가 없다.
- `beforeAll`/`afterAll` 로 fixture 생성·정리가 격리돼 있고, 각 `it` 은 읽기 전용으로 공유 fixture 를 참조할 뿐이라 순서 의존성이 없다.
- `root: string` 을 인자로 받는 순수 함수 설계라 테스트가 임시 디렉터리를 자유롭게 주입할 수 있다(테스트 용이성 양호).
- "위반 0건은 검사가 작동한다는 증거가 아니다"라는 이 PR 의 핵심 통찰을 스스로 실천 — 모든 분기(파싱 실패 skip, 비-문자열 skip, 미등재 어휘, 디렉터리 모순, 인덱스 면제, archive 제외, 재귀/비재귀, "no" 의 YAML 1.1 함정)에 대해 **양성 fixture 로 실제 탐지를를** 증명하고, "reports exactly the planted violations" 로 과잉 탐지(over-reach) 없음까지 확인한다.
- 이전 리뷰 라운드(4R W1 INFO4, 커밋 `d1b622084`)에서 지적된 "마지막 무관측 분기"를 실제로 닫은 이력이 diff 로 확인된다 — 회귀 대응이 실질적이다.

## 요약

`plan-scan.ts`/`plan-scan.test.ts` 는 실저장소 가드가 positive-only 라 "검사가 작동한다"는 것을 증명하지 못했던 문제를 합성 fixture 로 정면 해결한, 테스트 설계 관점에서 모범적인 변경이다 — mock 미사용, 격리된 fixture, 명시적 negative-path, 과잉탐지 방지, 이전 리뷰 지적사항의 실제 반영까지 갖췄다. 다만 리뷰 과정에서 `plan-scan.test.ts` 를 독립 실행했을 때 최초 2회 연속으로 4개 테스트가 동일한 패턴(비-문자열/파싱실패 skip 분기가 전혀 작동하지 않은 것처럼 보이는 결과)으로 실패했고, 이후 캐시 삭제·재실행·격리 재현 시도에서는 계속 GREEN 이었다 — 원인을 확정하지 못했으나 재현 실패가 결함 부재를 뜻하지 않으므로, 이 관찰을 반드시 기록하고 CI 에서 동일 flakiness 가 있는지 확인해야 한다. 그 외에는 `sort()` 순서 보장이 어떤 테스트로도 관측되지 않는 점, Gate C(`spec-plan-completion.test.ts`)가 여전히 독립된 walker 사본을 유지해 향후 드리프트 위험이 남아있는 점 정도가 경미한 보완 대상이다.

## 위험도

MEDIUM
