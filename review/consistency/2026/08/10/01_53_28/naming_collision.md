# 신규 식별자 충돌 검토 (3차 — 종결 확인 라운드)

## 진단 메모 (알려진 결함 대응)

prompt 의 `## 구현 변경 사항` diff 섹션이 번들에 없었다(2576줄 `spec/conventions/` 번들만
있었고, 실제 변경 범위인 `.claude/docs/plan-lifecycle.md` / `codebase/frontend/src/lib/docs/__tests__/`
/ `plan/in-progress/docs-guard-walker-dedup.md` / `plan/in-progress/harness-env-value-subpattern-dedup.md`
는 빠져 있었음). 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)
에서 `git log`/`git show`/`git grep`/`Read` 로 직접 재구성해 검토했다.

## 검토 범위

본 라운드는 2차(`review/consistency/2026/08/10/01_37_01/naming_collision.md`)가 낸 유일한
발견사항 — **[INFO]** `plan-scan.ts` 코멘트의 "등재했다" 지시선이 최종 목적지
(`docs-guard-walker-dedup.md`)가 아닌 경유 plan(`harness-env-value-subpattern-dedup.md`)을
가리킴 — 이 정정됐는지, 그리고 그 정정이 저장소 전역에 부작용(새 충돌)을 남기지 않았는지만
확인하는 **종결 라운드**다. 오케스트레이터가 지목한 세 식별자(`TERMINAL_PLAN_STATUSES` ·
`docs-guard-walker-dedup.md` · `pr:` 필드)를 전수 재검증했다.

## 확인 결과

### 1. `plan-scan.ts` 경유 지시선 정정 — 반영 확인

- 수정 커밋 `e9b789a44`("fix(harness): 2차 consistency 지적 반영 — stale plan 포인터 · 인용
  범위 · 도입일")이 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:21` 을
  ```diff
  - 실측), 그 통합은 `harness-env-value-subpattern-dedup.md` 에 등재했다. "네 벌을 하나로
  + 실측), 그 통합은 `plan/in-progress/docs-guard-walker-dedup.md` 에 등재했다. "네 벌을 하나로
  ```
  로 정정했다. 현재 워킹트리 `plan-scan.ts:1-25` 전체 모듈 헤더 코멘트를 재확인한 결과
  `harness-env-value-subpattern-dedup` 문자열은 더 이상 등장하지 않는다.
- `git grep -n "docs-guard-walker-dedup"` 전수 결과, 살아있는 코드/plan 안의 참조는 정확히
  둘뿐이다 — `plan-scan.ts:21`(정정된 인용부)과
  `plan/in-progress/harness-env-value-subpattern-dedup.md:58`(`"## 함께 볼 것"` 절의
  상호참조, "정본은 이쪽" 이라고 명시). 나머지 등장은 전부 `review/consistency/2026/08/10/{01_09_04,01_37_01}/**`
  (과거 라운드 산출물, 시점 기록)뿐이다 — 갱신 대상 아님.
- `plan/in-progress/harness-env-value-subpattern-dedup.md` 자체도 같은 수정 커밋에서 `#970`
  인용 범위를 좁히는 편집을 받았으나(security 게이트 설계 원칙 ≠ 문서 조직 기준), 이 편집은
  walker 포인터·식별자 명명과 무관한 rationale 문구 조정이라 신규 식별자 충돌 표면을 만들지
  않는다.

**결론**: 2차가 지적한 INFO 는 완전히 해소됐고, 잔존 참조(고아 포인터)는 없다. 두 plan 문서
간 상호참조도 방향이 명확해졌다(경유지가 정본을 향해 "여기가 정본" 이라 가리키는 형태).

### 2. `TERMINAL_PLAN_STATUSES` — 재확인, 충돌 없음

`git grep -n "TERMINAL_PLAN_STATUSES"` 전수 결과 살아있는 참조는 5곳으로 2차와 동일하다:
`.claude/docs/plan-lifecycle.md:83`, `plan-frontmatter.test.ts:184`, `plan-scan.test.ts:6,163,165`,
`plan-scan.ts:100,130`(export 선언 + 소비), `spec-impl-evidence.md:87`. 전부 같은 개념(plan
종료 status 허용값 집합)을 가리키며 다른 도메인에서 이 이름을 선점한 사례는 여전히 없다.
backend `ExecutionEngineService.TERMINAL_STATUSES`(`execution-engine.service.ts:499`, 워크플로
**실행** 종료 상태)와도 이름이 더 이상 겹치지 않는다 — `git grep -n "TERMINAL_STATUSES" --
':!codebase/backend'` 결과 backend 밖에서 옛 이름(`TERMINAL_STATUSES`, PLAN 접두 없는 형태)의
잔존 리터럴은 0건.

### 3. `pr:` 필드 — 재확인, 충돌 없음

`git grep -n "^pr:" -- 'plan/**'` 결과 6개 완료 plan 이 동일 필드명·유사 값 형태(정수 또는
콤마-구분 정수 목록)로 쓰고 있다: `c1-pr2-aiturn-blueprint.md`(625) · `embedding-model-ux.md`(492) ·
`execution-engine-typed-errors.md`(598, 599) · `fix-carousel-waiting-status.md`(498) ·
`fix-presentation-tool-default.md`(438) · `workflow-execution-turn-timing.md`(445). 2차가
확인한 5개 선례 + 신규 1건(`pr: 625`) 구성이 그대로 유지된다 — 이번 3차 사이에 새 `pr:` 도입도,
철자 변형(`merged_pr` 부활 등)도 없다.

`merged_pr` 리터럴은 `git grep -n "merged_pr"` 전수 재확인 결과 여전히 두 곳뿐이다 — (a)
`plan/complete/spec-draft-secret-store-verification-footnote.md:131`(개명 결정 자체를 서술하는
Rationale 각주, 시점 기록) (b) `review/code/2026/08/09/23_43_28/**`(과거 코드 리뷰 산출물).
둘 다 `plan-lifecycle.md §3` "인입 참조는 옛 표현을 유지" 원칙상 갱신 대상이 아니며, 살아있는
스키마·코드 어디에도 `merged_pr` 은 남아있지 않다.

### 4. 이번 라운드 diff 자체가 새 식별자를 도입했는지

수정 커밋 `e9b789a44` 의 전체 diff(`plan-scan.ts` 1줄, `harness-env-value-subpattern-dedup.md`
rationale 문구, `spec-impl-evidence.md` 날짜 오탈자 1글자(`2026-08-10`→`2026-08-09`, convention
이 지적한 도입일 불일치 수정))를 확인했다. 셋 다 기존 식별자를 정확한 참조 대상으로 정정하거나
날짜 오기를 바로잡는 산문 편집이며, 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·
파일 경로를 새로 도입하지 않는다 — 신규 식별자 충돌 관점에서 검토할 새 표면이 없다.

## 발견사항

없음. 2차가 지적한 유일한 항목(경유 plan 포인터)이 정정 확인됐고, 이번 라운드가 재검증한 세
식별자(`TERMINAL_PLAN_STATUSES` · `docs-guard-walker-dedup.md` · `pr:` 필드) 모두 저장소 어디에도
폐기된 참조나 새 충돌을 남기지 않았다. 신규로 제기할 CRITICAL/WARNING/INFO 없음.

## 요약

3차(종결) 라운드에서 2차가 낸 유일한 INFO — `plan-scan.ts` 코멘트가 walker 통합 후속의
경유 plan(`harness-env-value-subpattern-dedup.md`)을 가리키던 문제 — 가 커밋 `e9b789a44` 로
정정됐음을 코드 라인 대조 및 diff 로 직접 확인했다. `plan-scan.ts:21` 은 이제
`plan/in-progress/docs-guard-walker-dedup.md` 를 정확히 가리키고, 두 plan 문서 간 상호참조도
방향이 명확하다. 오케스트레이터가 지목한 세 식별자 — `TERMINAL_PLAN_STATUSES`(build-guard
export 이름, backend 동명 상수와 비충돌) · `docs-guard-walker-dedup.md`(신규 plan 파일, 기존
plan 명명 컨벤션과 형식·경로 모두 정합) · `pr:` 필드(6개 완료 plan 이 동일 관례로 합류, `merged_pr`
잔존 없음) — 는 저장소 전수 검색 결과 모두 여전히 충돌 없이 일관된 상태다. 이번 라운드가 검토한
수정 diff 자체도 기존 참조를 바로잡는 산문·날짜 편집뿐이라 새 식별자 표면을 만들지 않는다. 새로
보고할 발견사항이 없으므로 본 라운드로 신규 식별자 충돌 관점의 검토를 게이트-오픈 상태로 종결한다.

## 위험도

NONE
STATUS=success
