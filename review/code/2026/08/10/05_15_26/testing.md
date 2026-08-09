# 테스트(Testing) 리뷰 — Gate C plan-completion spec-consistency

## 발견사항

- **[WARNING]** `makeSpecExists` 가 "실재하는 **spec 파일**"이 아니라 "저장소 안 아무 실재 파일"을 인정한다 — Gate C 의 핵심 불변식이 테스트로 방어되지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:112-123` (함수 `makeSpecExists`)
  - 상세: 이 함수의 JSDoc(같은 파일 104-110줄)은 "헤더 주석은 리스트 원소는 실재 spec **파일**이라 못박는데 구현은 무엇이든 존재하면 OK였다"는 과거 버그를 명시적으로 설명하고, 빈 문자열·디렉터리 케이스는 `isFile()` 로 고쳤다. 그런데 그 수정은 "spec/ 아래" 라는 prefix 제약을 걸지 않아 여전히 같은 결함의 절반만 닫혀 있다. 실제로 검증한 결과 `specExists("codebase/frontend/package.json")` 와 `specExists("CLAUDE.md")` 가 모두 `true` 를 반환한다(둘 다 저장소 안의 실재 파일이지만 spec 파일이 아님). 즉 `spec_impact: ["CLAUDE.md"]` 같은 선언이 Gate C 를 통과한다 — "이 작업이 어떤 spec 을 건드렸는지" 를 강제하려는 게이트의 존재 이유 자체가 우회된다. 320-352줄의 `makeSpecExists` 테스트(`it("makeSpecExists requires a real file — not the repo root, not a directory")`)는 빈 문자열/공백/디렉터리만 겨냥하고, "실재하지만 spec 이 아닌 파일" 케이스는 어떤 fixture 도 겨누지 않는다 — 회귀가 나도 어떤 테스트도 빨개지지 않는다.
  - 제안: `makeSpecExists` 구현에 `p.startsWith("spec/") &&` 제약을 추가하고, `codebase/frontend/package.json` 또는 `CLAUDE.md` 같은 "실재하지만 spec 밖" 파일을 거부하는 회귀 fixture 를 `it("makeSpecExists requires a real file — not the repo root, not a directory")` 옆에 추가한다.

- **[WARNING]** `rawScalar` 가 정규식 한 줄 매칭이라 같은 블록 안의 무관한 multi-line YAML 블록 스칼라(`|`/`>`) 값이 `started`/`owner`/`worktree` 로 시작하면 오검출될 수 있다 — 전용 단위 테스트가 없다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:214-218` (함수 `rawScalar`)
  - 상세: `rawScalar` 는 `^[ \t]*${key}:[ \t]*(.*)$` 를 `m` 플래그로 첫 매치만 취한다. 아래처럼 진짜 `started:` 보다 **앞서** 오는 무관한 필드의 블록 스칼라 내용이 우연히 `  started: ...` 형태면 그 줄이 먼저 매치돼 잘못된 값을 반환한다(직접 재현 확인):
    ```
    worktree: my-task
    notes: |
      started: not a real date, just prose that happens to look like a key
    started: 2026-08-10
    owner: dev
    ```
    이 입력에 대해 `rawScalar(block, "started")` 는 `"2026-08-10"` 이 아니라 `"not a real date, just prose that happens to look like a key"` 를 반환한다. 이 값은 `isIsoDate`/`hasMalformedStarted`/`isGateCEnforced` 로 그대로 흘러가 Gate C 판정(강제 대상 여부·malformed 여부)을 오염시킬 수 있다. `rawScalar` 는 export 되어 재사용되는데도(`spec-plan-completion.test.ts` 에서 3곳 직접 import) 이 파일 어디에도 `rawScalar` 만을 겨눈 직접 테스트가 없다 — `checkPlanFrontmatter`/`isGateCEnforced` 등 상위 함수들의 fixture(`frontmatter()`/`block()` 헬퍼)도 전부 단순 한 줄짜리 스칼라 값만 생성해 이 경로를 전혀 건드리지 않는다. 실제 plan frontmatter 에 이런 형태가 나올 가능성은 낮지만, 이 PR 이 다른 모든 분기를 뮤테이션까지 동원해 겨눈 것과 대비하면 유일하게 미검증인 채로 남은 갈래다.
  - 제안: 최소한 `rawScalar` 전용 `describe` 를 추가해 "이후 필드의 block-scalar 내용이 key-like 줄을 포함해도 영향받지 않는다"를 fixture 로 고정하거나(현재 동작을 의도적으로 받아들인다면 그 사실을 주석으로 명시), 필요하면 정규식을 frontmatter 최상위 키(들여쓰기 0)만 매칭하도록 좁힌다.

- **[INFO]** `it("every completed plan has parseable frontmatter")` 가 이미 계산해 둔 `parsedPlans` 를 재사용하지 않고 `findUnparseablePlans(root)` 를 통해 전체 `plan/complete/**` 를 다시 walk+read+parse 한다 — 바로 위 주석이 명시한 "한 번만 읽어 아래 두 단계가 공유한다" 설계 의도와 이 테스트만 어긋난다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:164-178` (vs. 137-144 의 `parsedPlans` 계산부)
  - 상세: 140-144줄 주석은 "종전에는 같은 plan 을 두 번 파싱했다"는 문제를 명시적으로 고치기 위해 `parsedPlans` 를 describe 스코프에서 한 번만 계산한다고 설명한다. `enforced` 필터(150-152줄)와 malformed-started 검사(185-187줄)는 실제로 `parsedPlans` 를 재사용하지만, "parseable frontmatter" 테스트만은 `findUnparseablePlans(root)` 를 호출해 (a) `collectCompletePlanMarkdown` 을 통한 디렉터리 재-walk, (b) 모든 파일의 재-read, (c) 재-parse 를 한 번 더 수행한다. `parseFrontmatterSafe` 가 매 호출 `{}` 옵션으로 gray-matter 캐시를 우회하므로 정확성 문제는 없지만(문서화된 그대로), 저장소가 커질수록 불필요한 I/O 가 두 배가 되고 무엇보다 파일 자신이 방금 막은 문제 패턴("복제된 파싱 경로")을 이 한 테스트만 다시 재현하고 있다.
  - 제안: `findUnparseablePlans(root)` 대신 `parsedPlans.filter((p) => p.parsed === null).map((p) => p.rel)` 로 교체해 단일 스캔 원칙을 이 테스트에도 맞춘다(동작은 동일해야 하며, 만약 다르면 그 자체가 `plan-scan.ts` 소비처 간 불일치를 드러내는 유의미한 신호다).

- **[INFO]** `describe("Gate C — plan-completion spec-consistency", ...)` 블록은 fixture 가 아니라 **실제 저장소의 `plan/complete/**` 데이터**에 직접 의존한다 — 코드 변경 없이도 향후 완료되는 plan 의 frontmatter 상태에 따라 이 테스트가 실패할 수 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:132-233`
  - 상세: 이는 이 저장소의 기존 관용구(`plan-frontmatter.test.ts`, `spec-links.test.ts`)와 동일한 "positive-only 실저장소 가드" 패턴이며, 의도적 설계로 이미 문서화돼 있다(235-237줄의 `describe("Gate C enforcement logic", ...)` 가 순수 로직을 fixture 로 별도 고정해 이 우려를 상쇄한다). 결함으로 보진 않으나, "테스트 격리" 관점에서 이 describe 블록의 pass/fail 은 테스트 스위트 밖(다른 PR 이 병합한 plan 데이터)에 좌우된다는 점은 리뷰 기록으로 남겨둔다.

## 요약

세 파일 모두 매우 높은 밀도의 뮤테이션 기반 negative-path 커버리지를 갖추고 있고(malformed `started` 롤오버, 비-문자열 `spec_impact`, 빈 문자열/디렉터리 경로, gray-matter 캐시 우회, index/`archive` 면제 등 이미 다수의 실측 결함을 fixture 로 고정), 순수 함수 + 의존성 주입(`specExists` 콜백, 문자열 입력) 구조라 테스트 용이성도 좋다. 다만 이번 검토에서 두 개의 실질적 커버리지 갭을 직접 재현으로 확인했다: (1) `makeSpecExists` 가 "spec 파일"이 아니라 "저장소 안 아무 실재 파일"을 인정해 Gate C 의 핵심 불변식이 실제로는 코드가 보장하는 것보다 넓다(문서화된 과거 버그의 절반만 닫힘), (2) `rawScalar` 가 첫 줄 매칭 정규식이라 앞선 필드의 block-scalar 내용에 오검출될 수 있는데 이 함수만 유일하게 직접 테스트가 없다. 두 갭 모두 실사용 빈도는 낮지만, 이 PR 이 스스로 세운 "모든 분기를 fixture 로 겨눈다"는 기준에는 못 미친다.

## 위험도
MEDIUM
