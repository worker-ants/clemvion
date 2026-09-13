# Cross-Spec 일관성 검토 — error-code-emission-axis

## 검토 범위 요약

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- `spec/conventions/**` 자체의 델타는 0개 파일 — 이 브랜치는 `error-codes.md` 등 conventions 문서를 바꾸지 않았다. 정상이다(harness/문서 PR).
- 실제 코드/문서 diff는 4개 파일: `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `logic.en.mdx`(유저 가이드 문구 정정), `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`, `guide-identifier-existence.test.ts`(가드 신설/확장). 전부 `spec/conventions/error-codes.md` 가 정의하는 "명명 규율" 축과 직접 연결된 harness 변경이다.
- 두 `.mdx` 변경의 요지: `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "…로 실행 실패해요"(코드처럼 읽힘) → "실패 메시지 **앞에 붙는 접두**일 뿐이며 **전용 에러 코드는 없다**" 로 정정. 근거를 실제 코드로 확인함: `execution-engine.service.ts:7121·7125·7130` 은 `throw new Error(`CONTAINER_MISSING_EMIT: …`)` 형태의 메시지 접두일 뿐이고, `execution-engine.service.ts:8017` 이 `nodeExec.error = { message }` 로만 기록해 `.code` 필드 자체가 없다. 정정 방향은 옳다(실측 확인).

## 발견사항

### [WARNING] `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 정정된 유저 가이드와 6개 spec 파일이 여전히 "코드"처럼 서술해 상충

- **target 위치**: 이번 diff의 `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `logic.en.mdx` (Loop 컨테이너 emit 포트 콜아웃) — "전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요" 로 정정됨. 같은 배치가 `spec/conventions/error-codes.md` 가 정의하는 "코드 = 클라이언트 계약, 메시지 접두는 코드가 아니다" 규율축을 그대로 따른다.
- **충돌 대상**: 아래 6개 spec 파일이 같은 두 토큰을 여전히 "에러(코드)" 처럼 서술한다.
  - `spec/5-system/4-execution-engine.md:332-333` §3.0 — "`CONTAINER_MISSING_EMIT` **에러로** 실행 실패" (가장 강한 코드-프레이밍)
  - `spec/3-workflow-editor/2-edge.md:202` §6.1 — "검증 | emit 없음 → `CONTAINER_MISSING_EMIT`, 2개 이상 → `CONTAINER_MULTIPLE_EMIT`"(검증 결과를 코드처럼 표기)
  - `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 — 형제 `CONTAINER_INVALID_CHILD`·`CONTAINER_CYCLE` 도 동일 패턴으로 "…에러로 실패" 표기
  - `spec/4-nodes/1-logic/0-common.md:83` — 괄호 안에 코드처럼 병기
  - `spec/4-nodes/1-logic/7-map.md:179-180` §6("에러 코드") — 표 자체가 "코드" 열
  - `spec/4-nodes/1-logic/9-foreach.md:209-210` §6("에러 코드") — 표 헤더가 "메시지 / 코드" 로 두 성격을 합쳐 명시
  - (대조: `spec/4-nodes/1-logic/3-loop.md:189-191` 은 이미 올바른 선례 — 발행 문자열 전문을 "메시지" 열에 그대로 인용하고 "코드" 라 부르지 않는다.)
- **상세**: 실측(`execution-engine.service.ts:7121·7125·7130`, `:8017`)으로 확인되듯 이 두 토큰은 `error.code` 필드로 발행되지 않는다 — 일반 `Error` 메시지의 접두 문자열일 뿐이다. `spec/conventions/error-codes.md` §1 은 "코드는 클라이언트가 분기하는 안정 계약" 이라 규정하는데, 위 6개 파일은 같은 토큰을 코드-형(backtick 단독 인용, "…에러로 실패", "코드" 열)으로 적어 독자가 `error.code === 'CONTAINER_MISSING_EMIT'` 로 분기 가능하다고 오인하게 만든다. 이번 diff가 정정한 유저 가이드(`logic.mdx`)와 정면으로 다른 사실을 주장하는 상태다. `spec/5-system/3-error-handling.md §1` 카탈로그에는 애초에 이 두 토큰이 등재돼 있지 않다(grep 0건) — 즉 카탈로그는 이미 "코드 아님"을 암묵적으로 반영하고 있어, 6개 파일 쪽이 카탈로그·정정된 가이드·`3-loop.md` 선례 셋 모두와 어긋나는 소수파다.
- **기존 추적 상태**: 이 정확한 항목은 **이미 이전 라운드의 cross_spec 검토(`review/consistency/2026/09/13/19_23_31` cross_spec WARNING#1)가 찾아 `plan/in-progress/spec-draft-nullable-notation-followups.md:3473-3492` 에 planner 소유 오픈 항목으로 등재돼 있다**(체크박스 미완료). `spec/` 은 developer 쓰기 권한 밖이라 이번 PR(owner: developer)이 직접 고칠 수 있는 항목이 아니며, 실제로 고쳐지지 않은 채 남아 있다. 따라서 이번 라운드에서 **새로 발생한 회귀가 아니라 기존에 등재된 미해결 항목의 재확인**이다 — BLOCK 사유로 쓰지 말 것. 다만 이 PR이 바로 이 축("발행 vs 메시지 접두")을 주제로 삼고 있어 누락하면 정합성 보고가 불완전해지므로 재기재한다.
- **제안**: 이 PR 범위 밖(spec/ 은 developer 쓰기 금지). planner 턴에서 트래커 항목을 집행할 때 두 선택지 중 하나로 6개 파일을 `3-loop.md` 형태(발행 문자열 전문을 "메시지" 로 인용, "코드" 라 부르지 않음)에 맞춰 통일할 것을 권고. 이번 developer PR 은 조치 불필요.

### [INFO] 같은 트래커에 인접한 두 미해결 항목 — 처분 순서가 이 finding 과 얽혀 있음

- **target 위치**: 없음(참고 정보).
- **충돌 대상**: `plan/in-progress/spec-draft-nullable-notation-followups.md:3494-3528` — "`3-error-handling.md §1.4` 의 «앵커 없는 코드» 7종(`MAX_ITERATIONS_EXCEEDED` 등)도 실제로는 메시지 접두인데 카탈로그엔 등재돼 있다" 는 별도 오픈 항목(WARNING#2, rationale_continuity 축).
- **상세**: 그 항목의 처분(옵션 (a): `CONTAINER_*` 를 카탈로그에 backfill vs (b): 앵커-없는 카탈로그 행에 "메시지 접두" 라벨 추가)에 따라 위 WARNING의 6개 파일 수정 방향과 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건의 존속 여부가 갈린다고 트래커 본문이 이미 명시한다. 두 항목을 독립적으로 처분하면 planner 가 같은 절(`3-error-handling.md §1`)을 반복해 건드리게 된다.
- **제안**: 새 조치 불필요 — 트래커가 이미 "함께 볼 것" 이라 적어 두었으므로 그대로 따르면 된다. 참고용으로만 기록.

## 요약

이번 diff(`logic.mdx`/`logic.en.mdx` 문구 정정 + `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 가드 신설)는 `spec/conventions/error-codes.md` 의 "코드=안정 계약, 메시지 접두는 코드가 아니다" 원칙에 부합하며, 실제 발행 코드(`execution-engine.service.ts`)를 근거로 정확한 방향으로 정정됐다. `spec/conventions/**` 자체는 이 브랜치에서 변경되지 않아 conventions 영역 내부 충돌은 없다. 다만 정정된 사실("CONTAINER_MISSING_EMIT/CONTAINER_MULTIPLE_EMIT 는 코드가 아니다")과 정면으로 다른 서술이 `spec/5-system/4-execution-engine.md`·`spec/3-workflow-editor/{0-canvas,2-edge}.md`·`spec/4-nodes/1-logic/{0-common,7-map,9-foreach}.md` 6개 파일에 여전히 남아 있다 — 이는 이미 이전 검토 라운드가 찾아 planner 소유 오픈 항목으로 정확히 등재돼 있는 기존 결함이며, 이번 developer PR의 diff가 만든 새 결함이 아니다. Critical 급 모순(작동 불가)은 없다.

## 위험도

LOW
