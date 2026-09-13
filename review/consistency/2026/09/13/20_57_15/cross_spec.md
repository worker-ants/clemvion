# Cross-Spec 일관성 검토 — error-code-emission-axis

## 전제 확인

- `git diff origin/main...HEAD --stat -- spec/` = **0줄** — 이 브랜치는 `spec/**` 을 전혀
  건드리지 않는다 (plan frontmatter `spec_impact: none` 과 일치).
- 실제 변경은 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-{scan,existence}.test.ts`
  (하네스 가드에 "발행 축" 추가), `codebase/frontend/src/content/docs/02-nodes/logic{,.en}.mdx`
  (가이드 문장 2곳 정정 — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 을 "에러 코드"에서
  "메시지 접두"로), `CHANGELOG.md`/`PROJECT.md` 뿐이다.
- 워킹트리(HEAD) 를 절대경로로 직접 열어 확인했다 — `staleGuideEntries`(개명 완료, 구
  `staleEntries` 미잔존), `GUIDE_NON_EMITTED_VOCABULARY`(신규 export, 타 파일에 동명 없음)
  등 diff 상 신규 식별자가 실제로 코드에 존재함을 확인했다.

## 발견사항

### [WARNING] `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 가이드는 "코드 아님"으로 정정됐는데 spec 6파일은 여전히 에러 코드로 서술 (known-open, 이 PR 비차단)

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` /
  `logic.en.mdx:103` (이 diff 의 정정) · `guide-identifier-scan.ts` 의
  `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건
- **충돌 대상**: `spec/5-system/4-execution-engine.md:332-333`,
  `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`,
  `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`,
  `spec/4-nodes/1-logic/9-foreach.md:209-210` — 전부 `` `CONTAINER_MISSING_EMIT` ``/
  `` `CONTAINER_MULTIPLE_EMIT` `` 를 인라인 코드로 표기해 구조화 에러 코드처럼 읽힌다.
  (실측: `spec/4-nodes/1-logic/3-loop.md:189-191` 만 예외로 이미 "메시지 접두 전문 인용"
  형태 — `CONTAINER_MISSING_EMIT: Container "<label>" has no body node wired to …` — 를 쓴다.)
- **상세**: 이 PR 이 가이드 쪽 서술을 실측(코드 조사: `execution-engine.service.ts:7121·7125·7130`
  이 템플릿 리터럴 **메시지 접두**로만 이 두 이름을 쓰고, 구조화된 `error.code` 필드로는
  발행하지 않음)에 맞춰 정확하게 고치면서, 같은 사실에 대해 spec 6개 파일이 반대 방향(코드
  그 자체인 것처럼 인라인 코드 표기)으로 서술하는 기존 모순이 상대적으로 더 뚜렷해졌다.
  이 모순 자체는 이 PR 이 새로 만든 것이 아니며 spec 파일 델타 0으로 확인된다.
- **제안**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner
  소유 항목으로 등재돼 있다 (택일 (a) 6파일을 `3-loop.md` 형태로 통일해 전문 메시지 인용,
  (b) `3-error-handling.md §1.4` 앵커-없는 코드 표기에 "메시지 접두" 축 명시). 어느 쪽을
  택하든 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건이 그 처분과 함께 불필요해질 수 있음을 plan
  이 이미 적어 두었다 — **재등록 불요, 이 PR 비차단**. `spec/` 은 developer 쓰기 권한 밖이라
  이 PR 의 `spec_impact: none` 범위는 타당하다.

### [WARNING] `3-error-handling.md §1.4` "앵커 없는 코드" 축이 "메시지 접두 전용"과 "정상 앵커 없음"을 구분하지 않는다 (known-open)

- **target 위치**: `guide-identifier-scan.ts` 의 `collectQuotedLiterals`/`collectMessagePrefixes`/
  `isMessagePrefixOnly` JSDoc — 이 축을 처음 도입하며 §1.4 의 기존 서술에 의존
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` 머리말(*"나머지 7종은 앵커 없는
  맨 문자열"*) 과 표(`RECURSION_DEPTH_EXCEEDED`/`MAX_ITERATIONS_EXCEEDED`/`CYCLE_DETECTED`
  등 7종을 정식 카탈로그 항목으로 등재)
- **상세**: §1.4 는 "앵커 없음"(코드 내 타입 강제가 없는 맨 문자열)과 "카탈로그 등재 여부"만
  구분하고, 이 PR 이 새로 세운 "메시지 접두로만 발행"이라는 세 번째 축을 명시적으로 인정하지
  않는다. 그 결과 §1.4 의 7종(앵커 없음이지만 카탈로그엔 등재됨)과 `CONTAINER_*`(앵커도 없고
  카탈로그에도 없음)의 차이가 spec 본문 자체에서는 드러나지 않고, 이 PR 의 하네스가 실측으로
  그 구분(카탈로그를 "요구 조건이 아니라 탈출구"로 사용)을 임시로 메운다.
- **제안**: 위 항목과 동일한 planner 트래커 항목이 이미 이 갈림을 다루고 있다 — 별도 재등록
  불요. `3-error-handling.md §1.4` 에 "메시지 접두 전용" 표기 열을 추가하는 안 (b) 이 이
  항목까지 함께 해소한다.

## 요약

이 PR 은 `spec/**` 을 전혀 건드리지 않고(diff 델타 0, `spec_impact: none`), 프런트엔드 가이드
문장 2곳과 그 가이드를 검증하는 하네스 가드(`guide-identifier-{scan,existence}.test.ts`)에
"발행 축"을 추가하는 것으로 스코프가 닫혀 있다. Cross-spec 관점에서 이 PR 이 **새로** 만드는
CRITICAL 은 없다. 다만 가이드 문장을 실측대로 정확히 고치는 과정에서, 같은 사실
(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 이 구조화 코드가 아니라 메시지 접두라는
것)을 `spec/5-system`·`spec/3-workflow-editor`·`spec/4-nodes` 6개 파일이 여전히 반대로
(에러 코드인 것처럼) 서술하는 기존 모순과, `3-error-handling.md §1.4` 가 "메시지 접두 전용"
축을 아직 명시하지 않는 인접 모순이 이번 실측으로 더 뚜렷해졌다. 두 항목 모두 이번 검토가
새로 발견한 것이 아니라 직전 라운드(`review/consistency/2026/09/13/19_23_31`·`20_34_48`)가
이미 낸 WARNING 이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner
소유 항목으로 정확히 등재돼 상태 불변으로 이월된다. `spec/` 은 developer 쓰기 권한 밖이므로
이 PR 의 `spec_impact: none` 스코프는 타당하고, 위 WARNING 들은 이 PR 을 막지 않는다. 이전
라운드가 지적한 naming collision(`staleEntries` 동명 충돌)은 `staleGuideEntries` 로 개명되어
이번 라운드 기준 해소를 실측으로 확인했다.

## 위험도

LOW
