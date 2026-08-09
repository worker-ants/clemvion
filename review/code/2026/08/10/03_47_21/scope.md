# 변경 범위(Scope) 리뷰 — plan-lifecycle-gates (03_47_21)

## 배경 확인

- 이번 세션은 직전 리뷰(`review/code/2026/08/10/03_28_25`)가 낸 WARNING 6건(위 프롬프트가
  가리키는 5개 파일 대상)을 고친 커밋 `be9a8fdb2`("재리뷰가 WARNING 6건을 더 잡았다")를
  대상으로 한다. 실제 코드 diff(`git show be9a8fdb2`)를 직접 대조해 각 변경 hunk 가 커밋
  메시지가 밝힌 W1/W3/W4/W5/W6 항목에 1:1로 대응하는지 확인했다.
- 5개 파일 중 `.claude/docs/plan-lifecycle.md` 는 직전 03_28_25 세션에서는 리뷰 대상 밖이었으나
  (당시 "이번 리뷰 대상 파일 목록에는 포함되지 않아 범위 밖"으로 명시), 이번 세션엔 포함됐다
  — worktree sentinel 근거 정정(§4)이 `plan-scan.ts` 코드 주석과 SoT 문서 양쪽에 동시에
  필요했기 때문(W6)이며, 새로 끼어든 범위가 아니라 같은 결함의 두 미러 지점이다.

## 항목별 대조

- **W1 (gray-matter 캐시 우회 누락)**: `findNonTerminalCompletedPlans`(`plan-scan.ts`)와
  `spec-plan-completion.test.ts` 두 호출부에 `matter(text, {})` 로 옵션 인자 추가. 이미
  `checkPlanFrontmatter` 에 있던 것과 동일한 패턴을 나머지 3곳 중 2곳에 맞췄다 — 순수 방어적
  1줄 diff + 그 옆의 설명 주석. 범위 이탈 없음.
- **W4 (공백-only 값 통과)**: `checkPlanFrontmatter` 의 `worktree`/`owner` 판정에 `.trim()`
  추가 + `plan-scan.test.ts` 에 6-케이스 fixture(`it("rejects whitespace-only ...")`) 신설.
  결함 수정과 그 결함을 고정하는 테스트만 있고 그 외 파생 변경 없음.
- **W5 (인덱스 면제가 디렉터리 이름에는 미적용)**: 코드 동작은 원래도 파일명 기준이었고
  (`isLifecyclePlan` 은 `e.name` 만 검사), 이번 diff 는 그 **기존 동작**을 fixture 2건
  (`0-batch/child.md`, `_wip/child.md`)으로 pin 하고 JSDoc 에 이유를 적었을 뿐이다. 로직
  변경이 아니라 "지금 동작"의 명시적 계약화 — over-engineering 아님.
- **W6 (폐기된 `plan_coherence` 근거)**: `WORKTREE_PLACEHOLDER` 의 JSDoc, `plan-lifecycle.md
  §4` sentinel 절 두 곳 모두 "제거된 `plan_coherence` 충돌 검출"을 근거로 들고 있던 것을
  "`plan-stale-audit.sh` + §3 연결 판정"이라는 **현재** 소비처로 교체했다. 코드 주석과 SoT
  문서가 같은 사실을 미러링하는 구조라 두 곳을 함께 고친 것은 정당 — 한쪽만 고치면 다시
  drift 가 생긴다.
- **W3 (JSDoc 회고 서사)**: `spec-links.ts` 의 `findBrokenPlanLinks` 위 JSDoc 블록에서
  "Measured 2026-08-09/10 …" 절(구체 개수·"8 vs 9" 서사)을 들어내고, 핵심 스코프 근거(§3
  point-in-time record 보존)만 남겼다. 삭제된 서사가 이 함수의 동작 설명에 필수적이지 않고
  숫자가 시간이 지나면 stale 해지는 종류의 정보라 — `plan-frontmatter.test.ts` 헤더에 이미
  적용된 "코드 주석 = 현재 규칙만" 원칙을 이 파일에도 맞춘 것. 순수 주석 정리이며 로직 변경
  없음.

## 발견사항

- **[INFO]** `plan-scan.ts` 모듈 헤더(파일 최상단)의 회고적 서사가 이번 라운드에도 그대로
  남아 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:1`~`26`
  - 상세: 직전 세션(`review/code/2026/08/10/03_28_25/scope.md`)이 이미 지적한 항목과 동일 —
    "158 tests 전량 GREEN 인데 위반 수집 분기는 한 번도 실행되지 않았다" 같은 구체 리뷰
    경위·수치가 영구 주석으로 남아 있고, 같은 PR 이 다른 파일(`spec-links.ts`)에서는 이번
    커밋으로 그런 서사를 막 걷어냈다(W3). 이번 커밋은 이 헤더 블록 자체를 건드리지 않았으므로
    새로 생긴 문제는 아니지만, "회고 서사를 걷어낸다"는 원칙을 한쪽에는 적용하고 한쪽엔 아직
    안 한 상태로 남아 있다.
  - 제안: scope 관점의 차단 사유는 아니다(내용이 파일의 존재 이유·스코프 경계 설명과 직결돼
    완전히 무관하지는 않음). maintainability/documentation 리뷰어가 "장기 유지 주석 vs
    커밋 이력" 판단으로 다루는 편이 적합.

## 점검 관점별 결론

1. **의도 이상의 변경**: 없음. 5개 파일의 diff 전부가 직전 리뷰가 낸 W1/W3/W4/W5/W6 여섯
   항목에 정확히 대응하고, 그 외 파일·라인은 변경되지 않았다(`git show --stat` 로 코드 diff
   범위가 이 5개 파일에 한정됨을 확인).
2. **불필요한 리팩토링**: 없음. `.trim()` 추가·`matter(..., {})` 인자 추가·JSDoc 정정 모두
   지목된 결함/서사 문제를 고치는 최소 diff.
3. **기능 확장(over-engineering)**: 없음. W5 항목은 새 기능이 아니라 기존 동작을 fixture 로
   고정한 것뿐이고, 나머지는 모두 방어 코드·문서 정정.
4. **무관한 수정**: 없음. 5개 파일 모두 지난 라운드가 지적한 WARNING 의 직접 수신처다.
5. **포맷팅 변경**: `git diff --check` 결과 공백 오류 없음. 각 hunk 가 실질 로직/주석에
   집중돼 있고 광범위 재포맷은 없다.
6. **주석 변경**: 대부분의 diff 가 주석(JSDoc) 변경이지만 전부 review 가 지목한 결함
   설명·근거 정정이며, 위 INFO 항목 외 불필요한 주석 추가/삭제는 없다.
7. **임포트 변경**: 이번 diff 에 import 변경 없음.
8. **설정 변경**: 없음. `.claude/docs/plan-lifecycle.md` 는 설정 파일이 아니라 SoT 문서이고,
   변경은 W6 사실 정정 2줄에 한정된다.

## 요약

`be9a8fdb2` 는 직전 리뷰 라운드가 낸 WARNING 6건(W1/W3/W4/W5/W6)을 정확히 겨눈 수복
커밋이다. 5개 파일의 모든 diff hunk 가 커밋 메시지가 밝힌 항목 중 하나로 소급 설명되며,
결함과 무관한 리팩토링·기능 추가·포맷팅·임포트·설정 변경은 발견되지 않았다. 유일한 관찰은
`plan-scan.ts` 모듈 헤더에 남아 있는 회고적 서사(직전 세션도 INFO 로 남겼던 것과 동일 항목,
이번 diff 는 그 블록을 건드리지 않음)로, scope 이탈이 아니라 문서화 스타일 일관성 문제에
가깝다.

## 위험도

NONE
