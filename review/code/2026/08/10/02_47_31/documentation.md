# 문서화(Documentation) 리뷰 — plan-frontmatter.test.ts

## 리뷰 범위

이번 라운드 대상은 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 1개 파일
(change_type: Review, 전체 파일 컨텍스트만 제공, diff 없음, 188줄). 파일이 인용하는 외부 정본
4곳 — `plan-scan.ts`, `spec-links.ts`, `.claude/docs/plan-lifecycle.md`, `spec/conventions/spec-impl-evidence.md` —
을 모두 직접 열어 주석 서술과 실제 구현/문서가 지금도 일치하는지 재대조했다. 이 파일은 같은
브랜치 안에서 이미 세 차례(round 02_06_01, 02_18_34, 02_33_44) 문서화 관점 재검토를 거쳤고,
현재 파일 내용은 그 라운드들이 검토한 것과 동일하다(신규 diff 없음).

## 교차검증 상세

1. 헤더 주석(게이트 13-35) "SoT 는 `.claude/docs/plan-lifecycle.md §4`" / "§3/§4 에 있다" →
   `plan-lifecycle.md` 실제 목차: `## 3. 이동 규칙`, `## 4. Frontmatter 스키마`. 일치.
2. "`plan-scan.ts`(수집·status)와 `spec-links.ts`(링크)에 있다 — `spec-links.ts` 도
   `collectLivePlanMarkdown` 을 export 하지만 그건 하위호환 re-export" (게이트 20-22) →
   `plan-scan.ts` 가 `collectLivePlanMarkdown`/`collectCompletePlanMarkdown`/
   `findNonTerminalCompletedPlans`/`TERMINAL_PLAN_STATUSES` 를 실제로 export 하고,
   `spec-links.ts` 는 `import { collectLivePlanMarkdown } from "./plan-scan"; export { collectLivePlanMarkdown };` 로
   순수 재수출만 한다(자체 순회 로직 없음). 일치.
3. `collectTopLevelPlans` 헬퍼(게이트 42-48) 주석 "스캔 소스는 `collectLivePlanMarkdown`
   **하나**다 ... 접두 면제 규칙은 이제 그 함수가 갖는다" → `plan-scan.ts` 의
   `collectLivePlanMarkdown` 이 `walkPlanMarkdown(root, "in-progress", { recurse: false })` 를
   호출하고, `isLifecyclePlan` 이 `0-`/`_` 접두 필터를 갖는다. 서술과 구현 일치.
4. `findBrokenPlanLinks` 관련 주석(게이트 128-134) "초판은 여기에 정규식을 새로 짰는데
   그것은 코드펜스 안의 링크도 실제 링크로 취급했다" → 현재 `spec-links.ts` 의
   `extractLinks` 는 펜스 블록을 스킵하도록 구현돼 있어, 서술된 과거 결함이 고쳐진 현재
   상태와 정확히 대응. 일치.
5. 에러 메시지 내 "TERMINAL_PLAN_STATUSES 에 등재할 것"(게이트 184-185) → `plan-scan.ts` 에
   동일 이름의 export, 값 4개(`complete`/`implemented`/`applied`/`superseded`) — `plan-lifecycle.md §4`
   신설분과도 표현이 동일. 일치.
6. "`plan-scan.test.ts` 가 합성 fixture 로 위반 3건을 심고 정확히 그 3건만 잡히는지까지
   단언"(게이트 165-167) → `plan-scan.test.ts` 존재, 3건 planting + over-reach 없음을
   확인하는 테스트 확인. 일치.
7. `spec/conventions/spec-impl-evidence.md` §4.2 표의 `plan-frontmatter.test.ts` 행 —
   "판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관이고 이 파일은
   호출부다" — 대상 파일의 실제 구조(로직 없이 호출만)와 정확히 일치.

7개 인용 전부에서 불일치(stale comment) 발견되지 않음.

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** 헤더 주석(게이트 13-35) 및 두 곳의 개별 `it` 블록 주석(게이트 128-134, 146-151)이
  "현재 규칙"과 "과거에 어떻게 틀렸었는가(ai-review 지적 이력)"를 같은 블록에 섞어 서술한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:13-35, 42-45, 128-134, 146-151`
  - 상세: 내용 자체는 위 교차검증에서 전부 사실과 일치함을 확인했고, 이 저장소가 가드 파일에
    ai-review 지적 이력을 인라인 주석으로 남기는 것을 확립된 관례로 쓰고 있다(`plan-scan.ts`,
    `spec-links.ts` 도 동일 패턴, `plan-lifecycle.md` 도 "이 저장소가 두 번 놓친 실패다" 식
    회고를 본문에 유지). 신규 독자 입장에서는 "지금 지켜야 할 불변식"과 "예전에 있었던 실수"를
    분리해 읽어야 하는 부담이 있으나, 파일 최상단 주석이 이미 "코드 주석은 **현재 규칙**만
    담는다 — 실패 이력은 커밋 메시지/`plan/complete/` 산출물을 볼 것"이라는 원칙을 명시하고
    실제로도 각 회고 문장이 "왜 이렇게 짰는가"를 설명하는 데 쓰이고 있어(순수 서사 나열이
    아님), 강제 수정 대상은 아니다.
  - 제안: 조치 불필요(참고용 관찰). 다음에 이 가드를 다시 손댈 때, 이미 완전히 해소된
    과거형 문장(예: 게이트 42-45의 "그 사본이 접두 필터에서 조용히 어긋나 있었다")을
    `plan-lifecycle.md` Rationale 섹션이나 커밋 메시지 쪽으로 옮기고 소스 주석에는 "현재
    규칙 + 왜 이 스코프인가"만 남기는 정리를 고려할 수 있다.

- **[INFO]** JSDoc 부재 — `collectTopLevelPlans`(게이트 46) 는 export 되지 않는 로컬 test
  헬퍼이고 바로 위 4줄 인라인 주석(게이트 42-45)이 목적·배경을 충분히 설명하므로 지적
  대상 아님. 공개(export) 표면이 아니므로 JSDoc 요구 기준에 해당하지 않는다.

README/API 문서/CHANGELOG — 새 환경변수·설정 옵션·API 엔드포인트 없음(테스트/빌드 가드
전용 파일). 이 저장소는 harness/test-only 변경에 CHANGELOG 엔트리를 요구하지 않는 것이
기존 관례이며(최근 harness 전용 PR들도 CHANGELOG 미기재), 가드 목록 자체는
`spec/conventions/spec-impl-evidence.md §4.2` 표와 `.claude/docs/plan-lifecycle.md §4`에
이미 정확히 반영돼 있어 문서 동기화 갭이 없다.

## 요약

`plan-frontmatter.test.ts` 는 문서화 관점에서 이례적으로 잘 관리된 파일이다. 헤더 주석과
개별 테스트 주석이 인용하는 외부 정본 4곳(`plan-scan.ts`, `spec-links.ts`,
`plan-lifecycle.md §3/§4`, `spec-impl-evidence.md §4.2`)을 전부 직접 열어 대조한 결과 모든
서술이 현재 구현·문서와 정확히 일치했고, 이전 라운드들이 지적했던 stale 참조(spec-links.ts를
정본으로 잘못 지목하던 문제)도 이미 정정된 상태로 확인됐다. 남은 지적은 헤더 주석에 회고성
서사가 누적되는 스타일에 대한 INFO 수준 관찰 두 건뿐이며 둘 다 액션 아이템은 아니다. 신규
CRITICAL/WARNING 없음.

## 위험도

NONE
