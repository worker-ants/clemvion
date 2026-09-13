# Cross-Spec 일관성 검토 — error-code-emission-axis (round 4, --impl-done)

## 검토 범위 확인

이 PR 의 `spec_impact` 는 `none` 이고, 실측(`git diff origin/main...HEAD --stat -- spec/`)으로
확인해도 **`spec/**` 델타는 0개 파일**이다. 변경은 전부 `codebase/frontend/**`
(`guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·`logic{,.en}.mdx`)와
`plan/`·`CHANGELOG.md`·`PROJECT.md` 다. 따라서 "target 문서" 자체가 spec 을 새로 정의하지
않으므로, 본 리뷰는 **이 diff 가 기존 spec 서술과의 대비에서 드러내는(또는 악화시키는)
모순**을 점검한다.

## 발견사항

### [WARNING] `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 가이드는 고쳤는데 spec 6파일은 그대로 "에러 코드"로 서술

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/logic{,.en}.mdx` (이 diff),
  `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의
  `GUIDE_NON_EMITTED_VOCABULARY` 등록 (이 diff)
- **충돌 대상**:
  - `spec/5-system/4-execution-engine.md:332-333` §3.0 — *"`CONTAINER_MISSING_EMIT`
    **에러로** 실행 실패"*
  - `spec/3-workflow-editor/2-edge.md:202` §6.1 — 검증 행을 코드로 표기
  - `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 — 형제 `CONTAINER_INVALID_CHILD`·
    `CONTAINER_CYCLE` 도 동형 서술
  - `spec/4-nodes/1-logic/0-common.md:83`, `7-map.md:179-180` §6, `9-foreach.md:209-210` §6
- **상세**: 이 diff 는 가이드 문장을 *"…로 실행 실패해요"*(코드처럼 읽힘) →
  *"실패 **메시지 앞에** 붙어요 — 전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야
  해요"*로 정정하고, 실측 근거(`execution-engine.service.ts:8016` 의
  `nodeExec.error = { message }` — `code` 필드 부재)까지 코드 가드(`GUIDE_NON_EMITTED_VOCABULARY`)로
  고정했다. 반면 spec 쪽 6파일은 여전히 두 토큰을 구조화된 에러 코드처럼 서술한다 —
  **이 PR 이전에는 가이드와 spec 이 같은(부정확한) 설명으로 일치했지만, 이 PR 이 가이드만
  정정하면서 spec 트리 내부에 새로운 가시적 불일치**가 생겼다(같은 저장소 안의
  `spec/4-nodes/1-logic/3-loop.md:189-191` 은 이미 발행 문자열 전문을 인용해 올바른 선례를
  갖고 있다).
  실측 확인: 위 6개 spec 파일 본문을 직접 grep 하여 여전히 코드 표기임을 재검증했다(WARNING
  자체는 새 발견이 아니라 `review/consistency/2026/09/13/19_23_31` cross_spec WARNING#1 이
  이미 낸 것과 동일).
- **제안**: `spec/` 은 developer 쓰기 권한 밖이라 이 PR 이 직접 고칠 수 없다. 이미
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-13 planner 항목,
  6파일 목록 포함)에 등재돼 있으므로 **재등록 불필요** — planner 턴에서 (a) 6파일을
  `3-loop.md` 형태(발행 문자열 전문 인용)로 통일하거나 (b) "메시지 접두" 표기를 명시하는
  택일만 남아 있다. 이 PR 은 spec_impact: none 으로 올바르게 스코프됐고 이 WARNING 은
  **이 PR 을 막지 않는다**.

### [WARNING] `3-error-handling.md §1.4` "앵커 없는 코드" 7종 — 같은 구분(메시지 접두 vs 카탈로그 코드)이 카탈로그 문서 자체에서 아직 안 갈린다

- **target 위치**: `guide-identifier-scan.ts` 의 `collectQuotedLiterals`/`collectMessagePrefixes`
  JSDoc (§B-2, 이 diff) — 이 축이 "카탈로그 등재"를 요구 조건이 아니라 탈출구로 쓰도록 설계한
  근거
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` — `MAX_ITERATIONS_EXCEEDED`·
  `RECURSION_DEPTH_EXCEEDED`·`CYCLE_DETECTED` 등을 "앵커 없는 맨 문자열"이라 적으면서도
  정식 카탈로그 항목으로 취급
- **상세**: 이 PR 의 술어는 "메시지 접두로만 발행되고 카탈로그 미등재"인 토큰만 RED 로 잡는다.
  `MAX_ITERATIONS_EXCEEDED` 는 `loop-executor.ts` 에서 `CONTAINER_MISSING_EMIT` 과 **구조가
  완전히 동일**(메시지 접두 발행)한데 카탈로그에 있다는 이유만으로 통과한다. 즉 카탈로그
  등재 여부가 "코드다/아니다"의 실질 기준이 돼 버렸는데, `§1.4` 자체는 이 구분(발행 vs 소비자
  인용, 코드 vs 메시지 접두)을 아직 표기 축으로 명시하지 않는다.
- **제안**: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  planner 항목으로 등재(택일 (a) `CONTAINER_*` 를 §1.4 에 backfill, (b) §1.4 앵커-없는 행에
  "메시지 접두" 표기 추가)돼 있다. 어느 쪽을 택하든 이 PR 이 추가한
  `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`)이
  불필요해질 수 있음을 plan 이 이미 명시했다 — **재등록 불필요, 이 PR 비차단**.

### [INFO] `guide-identifier-existence.test.ts` 의 SoT 표기가 가리키는 절이 이 가드를 나열하지 않는다 (선재, 이 diff 로 악화되지 않음)

- **target 위치**: `PROJECT.md` (이 diff 가 갱신한 줄) — *"SoT: `spec/conventions/user-guide-evidence.md §2`"*
- **충돌 대상**: `spec/conventions/user-guide-evidence.md §2 "Build-time 가드 (3건)"` —
  표에 `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·
  `triggers-coverage.test.ts` **3건만** 나열하고 `guide-identifier-existence.test.ts` 는
  없다. 그 spec 파일의 frontmatter `code:` 목록에도 이 테스트 파일이 없다.
- **상세**: `git show origin/main:PROJECT.md` 로 확인한 결과 이 SoT 표기 자체는 이 PR 이전부터
  있던 것이라 이번 diff 가 만든 불일치는 아니다. 다만 이번 diff 는 바로 그 가드에 새 축(발행
  축)을 추가하면서 같은 줄을 갱신했으므로, 이 SoT 참조가 정확한 절을 가리키는지 확인할 좋은
  시점이다 — 지금 그 절은 이 가드의 존재도, 신규 `GUIDE_NON_EMITTED_VOCABULARY` 축도 서술하지
  않는다.
- **제안**: `spec_impact: none` 범위 밖이라 이 PR 에서 처리할 사안은 아니다. planner 턴에서
  `user-guide-evidence.md §2` 표·`code:` frontmatter 에 `guide-identifier-existence.test.ts`
  (+`guide-identifier-scan.ts`)를 4번째 가드로 추가하거나, PROJECT.md 의 SoT 참조를 실제
  근거(예: 그 테스트 파일 자체의 JSDoc)로 정정하는 동기화를 권고. 차단 사유 아님.

## 요약

이 PR 은 spec 을 건드리지 않고(`spec_impact: none`, 실측 델타 0파일) 가이드 문구 2줄과
프런트엔드 가드 코드만 바꾼다. Cross-spec 관점에서 새로 발견되는 CRITICAL 은 없다. 다만 이
PR 이 가이드 쪽 서술을 정확하게 고치면서, 같은 사실(`CONTAINER_MISSING_EMIT`/
`CONTAINER_MULTIPLE_EMIT` 이 구조화 코드가 아니라 메시지 접두라는 것)에 대해 `spec/5-system`·
`spec/3-workflow-editor`·`spec/4-nodes` 6개 파일이 여전히 반대로 서술하는 기존 모순이 더
뚜렷해졌다. 이 모순과 `3-error-handling.md §1.4` 의 인접 모순은 둘 다 이번 검토가 새로
찾은 것이 아니라 이전 라운드(`19_23_31`)가 이미 낸 WARNING 이며, `plan/in-progress/
spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 정확히 등재돼 있음을
재확인했다. `spec/` 은 developer 쓰기 권한 밖이므로 이 PR 의 `spec_impact: none` 스코프는
타당하고, 위 WARNING 들은 이 PR 을 막지 않는다.

## 위험도

LOW
