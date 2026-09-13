# 요구사항(Requirement) 리뷰 — error-code-emission-axis (라운드 7)

## 검토 방법

이 배치는 이미 6라운드의 `/ai-review`(19_23_22 → 19_51_33 → 20_13_13 → 20_34_32 →
20_57_13 → 21_19_46)와 대응 `--impl-done`을 거쳤고, 그 산출물(RESOLUTION.md ×6·plan
`error-code-emission-axis.md`)이 매 라운드의 지적·처방·검증을 상세히 기록하고 있다.
이번 라운드는 그 기록을 신뢰하지 않고 핵심 주장을 **독립적으로 재실측**했다:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7121·7125·7130·8016`,
  `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:436`,
  `codebase/backend/src/modules/execution-engine/containers/loop-executor.ts:64·85`,
  `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:76`을
  `grep`/`sed`로 직접 열어 `GUIDE_NON_EMITTED_VOCABULARY`의 `where` 인용·`CHANGELOG.md`·
  `plan/**`의 실측 주장과 대조 — 전부 정확히 일치.
- `spec/5-system/3-error-handling.md §1.4`, `spec/5-system/4-execution-engine.md:332-333`,
  `spec/4-nodes/1-logic/3-loop.md:189-191`을 직접 읽어 SPEC-DRIFT 주장(spec 6파일이
  `CONTAINER_*`를 코드로 서술 vs `3-loop.md`는 발행 문자열 전문 인용으로 정확히 서술)을 재확인.
- `spec/conventions/user-guide-evidence.md §2`를 읽어 `guide-identifier-existence.test.ts`
  미등재(기존 갭, 9라운드 연속 확인)를 재확인.
- `codebase/frontend`에서 `guide-identifier-existence.test.ts`를 직접 실행 —
  **76/76 passed**, RESOLUTION.md(`20_57_13`)의 "71 → 76" 주장과 일치.
- `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts` 전문을 처음부터 끝까지
  읽고 `computeNonEmittedOffenders`(offender = 인용 ∧ 접두-전용 ∧ ¬카탈로그 ∧ ¬등록)의
  구현이 plan §B-3 술어와 정확히 일치하는지, 반환값·엣지 케이스(빈 인용 집합·빈 등록
  목록·`where` 다중 위치·파일 미특정)가 전부 처리되는지 확인.

## 발견사항

새로 지적할 CRITICAL/WARNING은 찾지 못했다. 이미 등재·처분된 항목 외에 추가로 관측한
것은 다음과 같다.

- **[INFO]** `[SPEC-DRIFT]` spec 6파일이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를
  여전히 "에러/코드"로 서술 — 이번 PR 은 조치하지 않았고 **그것이 옳다** (이미 등재·위임됨)
  - 위치: `spec/5-system/4-execution-engine.md:332-333`("`CONTAINER_MISSING_EMIT` 에러로
    실행 실패"), `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`,
    `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`,
    `spec/4-nodes/1-logic/9-foreach.md:209-210`
  - 상세: 직접 열어 확인한 결과 6파일 모두 `CONTAINER_*`를 코드처럼 서술하는 반면, 실제
    구현(`execution-engine.service.ts:8016`, `nodeExec.error = { message }` — `code` 필드
    없음)과 형제 문서(`spec/4-nodes/1-logic/3-loop.md:189-191`, 발행 문자열 **전문**을
    인용하는 정확한 서술)는 이 배치가 가이드에 반영한 내용과 일치한다. 즉 spec 본문이
    구현보다 낡았다 — 코드(가이드 mdx + 스캐너)가 옳고 spec 6파일이 정정 대상이다.
    이 불일치는 `plan/in-progress/spec-draft-nullable-notation-followups.md:3457-3504`에
    planner 항목으로 이미 등재돼 있고(§1.4 "앵커 없는 코드" 7종 처리와 묶어 한 턴에
    처분하기로 합의된 넷째 항목), `--impl-done` cross_spec/rationale_continuity가 라운드
    1부터 지목해 developer 권한 밖으로 위임된 상태다. 이번 라운드도 같은 결론을 독립
    재확인했을 뿐 새로운 결함이 아니다.
  - 제안: 코드(가이드 mdx·스캐너) 유지. spec 반영은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 두 planner 항목(3457, 3478) 집행 시 위 6파일 + `3-error-handling.md §1.4` 를
    함께 정정.

- **[INFO]** `guide-identifier-existence.test.ts`가 `spec/conventions/user-guide-evidence.md §2`
  build-time 가드 목록(3건)에 여전히 미등재
  - 위치: `spec/conventions/user-guide-evidence.md:68-76` (표에 `impl-anchor-existence.test.ts`·
    `integrations-coverage.test.ts`·`triggers-coverage.test.ts` 3건만 등재, `guide-identifier-existence.test.ts`
    없음)
  - 상세: 이 가드 자체는 `#1330`에서 신설돼 이 PR 이전부터 그 문서에 없었고(선재 갭), 이번
    라운드까지 9라운드 연속 동일 판정(등재분, 조치 불요)이 유지돼 왔다. 이번 PR 은 그 가드에
    축을 하나 추가했을 뿐 등재 여부와는 무관하다.
  - 제안: 조치 불요(선재 갭, 이 PR 범위 밖). 언젠가 `user-guide-evidence.md §2` 표를 갱신할
    때 함께 반영.

- **[INFO]** 기능 완전성·엣지 케이스·에러 시나리오·반환값 — 문제 없음 확인
  - `computeNonEmittedOffenders`(offender = 인용 ∧ 접두-전용 ∧ ¬카탈로그 ∧ ¬등록)는 4개
    조건 전부를 합성 진리표(`describe("computeNonEmittedOffenders — 네 항이 각각 무는가")`)로
    개별 검증하고, 빈 인용 집합(`[]`)·빈 등록 목록·`where` 다중 위치(`파일:줄·줄`)·소스
    파일 미특정(0건/2건 이상)의 엣지 케이스를 모두 명시적으로 다룬다(`broken.push(...)`로
    실패를 축적해 반환).
  - 모든 신규 함수(`collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`/
    `isMessagePrefixOnly`/`computeNonEmittedOffenders`)가 모든 경로에서 명시적 값
    (`Set`/`boolean`/`string[]`)을 반환한다 — 암묵적 `undefined` 반환 경로 없음.
  - TODO/FIXME/HACK/XXX 주석 검색 결과 0건(diff 대상 6개 코드/문서 파일 전수).

## 요약

핵심 기능(가이드가 "코드"로 부르는 토큰이 실제로 `error.code`로 발행되는지 판정하는 "발행
축")은 plan §B-3의 술어(인용 ∧ 접두-전용 ∧ ¬카탈로그 ∧ ¬등록 → RED)를 정확히 구현하고
있고, 그 술어를 뒷받침하는 실측 근거(`execution-engine.service.ts:7121·7125·7130·8016`,
`makeshop.handler.ts:436`, `loop-executor.ts:64·85`, `execution-failure-classifier.ts:76`)를
전부 독립적으로 재확인해 정확함을 검증했다. 가이드 문장 2건(KO/EN)의 정정은 실제 엔진
동작(구조화 코드 미발행, 메시지 접두만)과 일치하고, 이를 지키는 가드(`GUIDE_NON_EMITTED_VOCABULARY`
+ 3함수)는 등록 목록의 상한·인용 지속성·`where` 프리텍스트 방지를 전부 테스트로 강제한다.
독립 실행 결과 76/76 GREEN으로 회귀 없음을 확인했다. 유일하게 남는 항목은 spec 6파일이
여전히 `CONTAINER_*`를 코드로 서술하는 SPEC-DRIFT인데, 이는 이 PR 이 옳고 spec 이 낡은
경우이며 이미 planner 트래커에 등재·위임돼 있어 이번 배치가 손댈 권한/스코프 밖이다. 그
외 요구사항 충족 관점(기능 완전성·엣지 케이스·에러 시나리오·반환값·비즈니스 로직)에서
새로 지적할 CRITICAL/WARNING은 없다.

## 위험도

NONE
