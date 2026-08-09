# 변경 범위(Scope) 리뷰 — plan-scan.ts / spec-plan-completion.test.ts

## 조사 방법

리뷰 payload 는 두 파일의 "전체 파일 컨텍스트"만 제공하지만, 실제 변경 경계를 판정하기
위해 `git diff origin/main...HEAD`(및 최신 커밋 `6e4e62367`) 로 실제 diff 를 대조했다.

- `plan-scan.ts` — origin/main 에 파일 자체가 없음. 이 PR(`plan-lifecycle-gates`) 신규 파일
  전체(300줄).
- `spec-plan-completion.test.ts` — 기존 파일의 DFS walker(`collectCompletePlans`)와
  `gray-matter` 직접 호출 2곳을 `plan-scan.ts` 의 공유 함수(`collectCompletePlanMarkdown`,
  `parseFrontmatterSafe`)로 위임하도록 축소 (47줄 diff, 순삭감).

두 변경 모두 커밋 메시지(`fix(harness): 내 등재 근거가 절반 틀렸다 — 자기 PR 이 만든
중복은 제거로 전환`)와 관련 plan(`plan/in-progress/docs-guard-walker-dedup.md`)이 명시한
의도(자기 PR 이 만든 중복 파서/walker 로직 제거)와 정확히 일치한다. 새 기능 추가나
무관한 파일 수정은 없다.

## 발견사항

- **[WARNING]** `plan-scan.ts` 헤더 주석이 이번 커밋에서 실제로 이뤄진 통합을 반영하지 못해
  스스로 모순된 상태
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:18-22`
  - 상세: 해당 주석은 "Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는
    **아직 독립 구현으로 남아 있고**... 그 통합은 `docs-guard-walker-dedup.md` 에 등재했다"
    라고 서술한다. 그러나 같은 리뷰 대상인 `spec-plan-completion.test.ts` 의 diff
    (`function collectCompletePlans(root) { return collectCompletePlanMarkdown(root).map(...) }`)
    는 바로 이 커밋에서 `collectCompletePlans` 를 `collectCompletePlanMarkdown` 위임으로
    전환했다 — 즉 주석이 서술하는 "아직 안 됨" 은 이 diff 가 나오는 시점에 이미 거짓이다.
    실제로 `plan/in-progress/docs-guard-walker-dedup.md` (같은 커밋에서 함께 수정됨) 는
    "둘 다 그 PR 에서 해소했다(`parseFrontmatterSafe` 단일 진입점 + `collectCompletePlans`
    를 공유 구현 위임으로 축소)" 라고 정정된 반면, `plan-scan.ts` 쪽 주석만 정정이
    누락됐다. 이 주석은 "네 벌을 하나로 합쳤다 로 읽히지 않도록 범위를 명시한다" 는
    목적으로 쓰였는데, 그 범위 서술 자체가 이제 stale 하다는 점에서 scope 리뷰 관점의
    핵심 발견이다 — 다음 사람이 이 주석만 보고 `collectCompletePlans` 를 "손대면 안
    되는 별도 구현" 으로 오판할 수 있다.
  - 제안: 헤더 주석을 "Gate C 의 `collectCompletePlans` 도 이 PR 에서 `collectCompletePlanMarkdown`
    위임으로 통합했다" 로 갱신하거나, 최소한 plan 파일의 정정 문구와 동기화할 것.

- **[INFO]** 임포트/삭제 정합성 확인 — 문제 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:1-5`
  - 상세: `import matter from "gray-matter"` 제거는 해당 모듈의 유일한 소비처가
    `parseFrontmatterSafe` 로 이관됐기 때문에 정당하고, 새로 추가된
    `collectCompletePlanMarkdown`/`parseFrontmatterSafe` 임포트도 실제로 두 곳에서
    바로 사용된다. dangling import 나 미사용 임포트 없음.

## 요약

두 파일의 변경은 커밋 메시지가 밝힌 목적(자기 PR 이 도입한 `matter(raw, {})` 관용구 4중
복제와 `collectCompletePlans`/`collectCompletePlanMarkdown` 병렬 구현을 단일 진입점으로
통합) 과 1:1 로 일치하며, 요청 범위를 벗어난 리팩토링·기능 확장·무관한 파일 수정·의미
없는 포맷팅 변경은 발견되지 않았다. 다만 `plan-scan.ts` 헤더 주석이 바로 이 diff 로
이뤄진 `collectCompletePlans` 통합을 반영하지 못해, 같은 리뷰 대상 파일 내에서 "아직 안
됐다"(주석) vs "이미 됐다"(코드+plan 문서) 가 모순되는 상태로 남아 있다 — 이는 범위 서술
자체의 정확성 문제이므로 병합 전 정정을 권한다.

## 위험도
LOW
