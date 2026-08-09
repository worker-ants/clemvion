# 테스트(Testing) 리뷰 — Gate C / plan-scan (`4e1995cb8`)

## 검증 방법

정적 검토에 더해 실제로 라운드트립 뮤테이션 테스트를 수행했다(파일 복원 확인 완료, 최종 `git status` clean):

- `spec-plan-completion.test.ts` 의 `makeSpecExists` 에서 `if (!p.startsWith("spec/")) return false;` 를 제거 → `` `makeSpecExists` requires a real file — not the repo root, not a directory `` 테스트가 정확히 RED (`CLAUDE.md` 회귀 fixture 가 잡음). 뮤턴트가 죽는다 = 이 fix 는 실제로 테스트가 지킨다.
- `plan-scan.ts` 의 `rawScalar` 정규식을 옛 형태(`^[ \t]*${key}:`)로 되돌림 → `plan-scan.test.ts` 의 `` ignores a same-named line nested inside an earlier block scalar `` 가 정확히 RED. 이 fix 도 실제로 테스트가 지킨다.
- `pnpm vitest run` 두 파일 모두 GREEN(835 tests) 확인, 복원 후 재확인.

## 발견사항

- **[WARNING]** `makeSpecExists` 의 `spec/` 접두 검사가 `..` 경로 순회로 우회된다 — 이번 커밋이 막으려던 것과 같은 종류의 fail-open 이 형태만 바꿔 남아 있고, 어떤 테스트도 겨누지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:117` (`makeSpecExists` 함수, `if (!p.startsWith("spec/")) return false;`), 테스트는 `spec-plan-completion.test.ts:304` (`` `makeSpecExists` requires a real file — not the repo root, not a directory ``)
  - 상세: `p.startsWith("spec/")` 는 문자열 접두 검사일 뿐 경로를 정규화하지 않는다. `path.join(root, p)` 는 `..` 세그먼트를 그대로 풀어버리므로 `spec_impact: ["spec/../CLAUDE.md"]` 나 `spec_impact: ["spec/../PROJECT.md"]` 는 문자열상 `"spec/"` 로 시작해 검사를 통과하고, `statSync` 는 결국 `spec/` 밖의 실재 파일을 가리켜 `true` 를 반환한다. 실측(probe 스크립트, `node`): 두 경로 모두 `true`.
    ```
    real("spec/../CLAUDE.md")   => true
    real("spec/../PROJECT.md")  => true
    ```
    이 함수 자체의 JSDoc/인라인 주석이 "헤더 주석은 '리스트 원소는 실재 spec **파일**' 이라 못박는데 구현은 더 넓었다" 는 이번 커밋의 문제의식과 정확히 같은 형태의 구멍이다 — 이번엔 `startsWith` 로 한 겹 좁혔지만 `..` 는 여전히 남는다. 기존 회귀 fixture(316~318행: `CLAUDE.md`/`codebase/frontend/package.json`/`PROJECT.md`)는 전부 접두사 없는 경로만 다뤄 이 우회를 겨누지 못한다.
  - 제안: `makeSpecExists` 에 `path.relative`/`path.resolve` 기반 정규화 후 `spec/` 하위인지 재검증하는 한 줄(예: `const rel = path.relative(path.join(root, "spec"), path.join(root, p)); if (rel.startsWith("..") || path.isAbsolute(rel)) return false;`)을 추가하고, `real("spec/../CLAUDE.md")` 를 회귀 fixture 로 등재. 실 데이터(233건 spec_impact 리스트)에 `..` 가 없다면 즉시 안전하게 조일 수 있다.

- **[INFO]** `rawScalar` 의 "top-level 만 매치" 규약이 "동일 키가 오직 들여쓴 형태로만 존재"하는 경우를 직접 겨누지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:259` (`` describe("rawScalar") > it("ignores a same-named line nested inside an earlier block scalar") ``)
  - 상세: 현재 테스트는 "들여쓴 가짜 + 그 뒤 진짜 top-level" 조합만 검증한다. `rawScalar` 가 "들여쓴 줄만 있고 top-level 줄이 아예 없을 때 `null` 을 반환"하는 경로는 새 정규식의 논리적 귀결이라 위 뮤테이션 테스트로 간접 방어되지만, 그 자체를 직접 단언하는 fixture 는 없다. 우선순위는 낮다 — 정규식 형태상 이 경로가 갈릴 여지가 거의 없고, `hasMalformedStarted`/`isGateCEnforced` 쪽에서 `null` 처리(선언 자체가 없으면 위반이 아님)는 이미 별도로 커버된다(`spec-plan-completion.test.ts` "missing/invalid `started` is not enforced").
  - 제안: 선택 사항. `rawScalar` describe 블록에 `expect(rawScalar("\nnote: |\n  started: 본문\n", "started")).toBeNull();` 한 줄을 추가하면 규약이 명시적으로 고정된다.

## 요약

이 커밋은 직전 라운드 리뷰(`/ai-review` WARNING 3건) 중 2건(spec 외부 경로 통과, `rawScalar` 블록 스칼라 오검출)을 코드+회귀 테스트로 닫았다. 두 fix 모두 손으로 되돌리는 뮤테이션 실험으로 검증했고, 각각 정확히 대응하는 새 단언이 RED 로 반응해 "실제로 지키는 테스트"임을 확인했다(vacuous 아님). 테스트는 실 파일시스템 fixture(`mkdtempSync`/`afterAll` cleanup)를 쓰고 mock 없이 순수 함수 단위로 나뉘어 있어 격리·가독성·의도 표현이 좋고, 헤더 주석마다 "왜 이 fixture 가 필요한가"(과거 실패 사례·뮤테이션 실측)를 남겨 회귀 방지 의도가 명확하다. 다만 이번에 닫은 fail-open 패턴("존재하면 통과" → "spec 파일이면 통과")이 `..` 경로 순회로 여전히 우회 가능하다는 새 갭을 발견했다 — 이 커밋이 반복적으로 경계해 온 것과 정확히 같은 클래스의 구멍이 형태만 바꿔 재발했다. 심각도는 이 게이트가 신뢰된 기여자가 손으로 쓰는 frontmatter 를 검사하는 doc-lint 성격이라 보안 경계가 아니므로 CRITICAL 은 아니지만, 이 리뷰가 발견한 만큼 다음 라운드에서 닫을 가치가 있다.

## 위험도

LOW
