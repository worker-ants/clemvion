# 요구사항(Requirement) 리뷰 — `extractLinks()` 멀티라인 링크 수정 + plan 이관

## 검증 방법 요약

- `pnpm`/`vitest` 로 `codebase/frontend/src/lib/docs/__tests__/` 전체와 개별 스펙을 실제로 구동.
- `extractLinks()` 의 순수 JS 미러 스크립트로 여러 확률적 시나리오(멀티라인 링크 2개, 펜스,
  URL 개행 등)를 저장소 밖 scratch 에서 재현.
- 뮤테이션은 하지 않았다(이미 scratch 에 다른 동시 리뷰어의 검증 산출물이 있어 대신 참고만
  했고, 저는 실제 소스는 건드리지 않고 `Read`/`vitest run`/scratch 스크립트로만 검증했다).
  `git status --short` 로 최종 clean 확인(제 리뷰 출력 디렉터리만 untracked).

## 발견사항

- **[CRITICAL]** `plan/in-progress/harness-review-gate-followups.md` 의 새 예시 문구가 이 PR 이
  고치는 바로 그 가드(`plan-frontmatter.test.ts` → `findBrokenPlanLinks`)를 **깨진 링크로
  트립시킨다** — build-blocking 테스트가 현재 커밋(HEAD `cb3a45ac0`)에서 **실제로 RED**.
  - 위치: `plan/in-progress/harness-review-gate-followups.md:100`
    (```` 1. 인라인 코드는 **지운다**(공백으로 채우지 않는다) — `` [a]`code`(b) `` 는 코드를 ````)
  - 상세: `extractLinks()` 의 인라인 코드 제거 정규식(`/`[^`]*`/g`)이 이 줄의 이중 백틱
    ``` `` ``` 을 **빈 코드 스팬 두 개**로, 가운데 `` `code` `` 를 **세 번째 스팬**으로 각각
    소비해 지운다. 결과 masked 텍스트는 `"...공백으로 채우지 않는다) —  [a](b)  는 코드를"` —
    정확히 `[a](b)` 링크가 **새로 생긴다**(target=`b`). 이 파일은 top-level
    `plan/in-progress/*.md` 라 `findBrokenPlanLinks` 스코프에 들고, 그 함수는
    `targetFilter` 가 없어(스펙 대상 필터 없음) 임의 target 의 존재 여부를 그대로 검사한다 →
    `b` 라는 파일이 없으니 DEAD 로 잡힌다. 실측(격리 재현, `vitest run` 직접 구동):
    ```
    FAIL plan-frontmatter.test.ts > ... > top-level in-progress plans have no broken relative links
    AssertionError: 깨진 상대링크 1건:
      plan/in-progress/harness-review-gate-followups.md:100 → b
    ```
    같은 문구를 순수 JS 로 재현해도 동일:
    `masked = "...— [a](b)  는 코드를"`, `LINK_RE` 매치 `target: "b"`.
    이 예시 문구는 **바로 이 PR 이 새로 추가**한 것이다(diff 의 "구현이 지켜야 했던 세 가지"
    목록 1번) — `spec-links.ts` 의 JSDoc 안에 있는 같은 문구는 `.ts` 파일이라
    `findBrokenSpecLinksInSources` 의 `targetFilter`(spec md 타깃만)에 걸려져 안전하지만,
    이 plan `.md` 파일에 그대로 옮겨적으면서 그 안전장치가 없는 스코프로 들어왔다.
  - 왜 문제인가: `spec/conventions/spec-impl-evidence.md` 표가 `plan-frontmatter.test.ts` 를
    **"build 차단"** 으로 명시한다. 즉 이 커밋은 그대로면 build/CI 를 깬다. 게다가 이 항목은
    "→ 해소 (2026-08-29, `#1235`)" 로 체크박스를 `[x]` 로 올렸는데, 정작 그 해소 서술 자체가
    새 회귀를 심었다 — CLAUDE.md 관례("체크박스 = 실제 상태")와도 어긋난다.
  - 제안: 그 예시를 **펜스 코드블록**(` ``` `)으로 감싸거나(펜스 안 라인은 `]` placeholder
    로 치환돼 `](` 인접이 원천적으로 생기지 않음을 이 PR 스스로 증명했다), 또는 대괄호/괄호
    인접이 재현되지 않도록 문구를 바꾼다(예: 세 스팬을 텍스트로 분리하거나 `(b)` 를
    `（b）`처럼 폭이 다른 문자로 대체). 어느 쪽이든 `vitest run plan-frontmatter` 로 GREEN
    회귀 확인 필요.

- **[INFO]** 알고리즘 자체(`extractLinks()` 의 마스킹+이분탐색)는 별도 검증에서 정확했다 —
  두 개의 멀티라인 링크가 한 문서에 있을 때 각 링크가 시작한 원본 줄을 올바르게 보고하고
  (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:131-186`), 펜스 경계에 `]` 를
  삽입하는 방식이 펜스를 넘는 거짓 링크를 만들지 않음을 수식으로도 확인했다(펜스에서 나온
  `]` 뒤에는 `masked.join("\n")` 특성상 항상 `\n` 이 오므로 `](` 인접이 생길 수 없다). 목적지가
  줄을 못 넘는 것(`[^)\n]+`)도 CommonMark 규칙과 일치한다. 사전 필터(`cannotContainLink`)가
  여전히 유효하다는 주석 속 주장도 같은 논리로 성립한다 — 펜스 마스킹이 절대 새 `"]("` 을
  만들지 못하므로. `pnpm`/`vitest` 로 `spec-links.test.ts`(37건) + `spec-link-integrity.test.ts`
  전체 GREEN, `tsc --noEmit`/`eslint` 도 클린.

- **[INFO]** spec fidelity: 이 변경 영역(`extractLinks()` 의 라인 단위 vs 전문 매칭 알고리즘)을
  정의하는 spec 문서는 없다 — `spec/conventions/spec-impl-evidence.md` §4.2 표는 가드의
  **스코프**(어떤 트리를 보는지, target filter 유무)만 SoT 로 규정하고 내부 파싱 전략은
  구현 세부사항으로 남겨둔다. 표의 서술(스코프·필터 유무)과 실제 `spec-links.ts` 코드는
  이번 diff 이후에도 일치한다 — 불일치 없음.

## 요약

`extractLinks()` 를 줄 단위 매칭에서 마스킹된 전문(全文) 매칭으로 바꾼 핵심 로직은 정확하고
테스트로 잘 고정돼 있다(양방향 단언·펜스 경계 처리·줄 번호 역산 전부 확인). 그러나 같은 커밋이
`plan/in-progress/harness-review-gate-followups.md` 에 추가한 "해소" 서술의 예시 문구
(`` [a]`code`(b) ``)가 자기 자신이 고친 바로 그 가드의 **다른 진입점**(`findBrokenPlanLinks`,
target filter 없음)에 걸려 `plan-frontmatter.test.ts` 를 RED 로 만든다 — 실측 재현 완료. 이
가드는 `spec-impl-evidence.md` 에 build 차단으로 명시돼 있어, 이 상태로는 이 PR 이 자기 자신의
빌드를 깬다. 체크박스를 `[x]` 로 올린 "해소 완료" 주장도 이 실패가 남아 있는 한 성립하지 않는다.

## 위험도

CRITICAL
