# Cross-Spec 일관성 검토 — error-code-emission-axis

## 검토 방법 메모

`_prompts/cross_spec.md` 번들은 예산 절단으로 `spec/conventions/error-codes.md`·
`spec/conventions/user-guide-evidence.md`·실제 코드 diff 본문을 누락했다 (알려진 결함 —
`plan/in-progress/spec-draft-nullable-notation-followups.md` "consistency `--spec` 기본
예산이 conventions 를 통째로 떨군다" 항목이 이번 `--impl-prep`(`18_40_54`)에서도 재현됐다고
이미 기록돼 있음). 프롬프트 지시대로 워킹트리를 절대경로로 직접 열어 우회했다:

- `git diff origin/main...HEAD --stat` / `--name-only` 로 실제 코드 diff 확인 (codebase 변경
  4파일: `logic.mdx`·`logic.en.mdx`·`guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`)
- `Read`/`grep` 로 `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md`,
  `spec/3-workflow-editor/{0-canvas,2-edge}.md`, `spec/4-nodes/1-logic/{0-common,3-loop,7-map,9-foreach}.md`,
  `spec/5-system/4-execution-engine.md`, `codebase/backend/.../execution-engine.service.ts` 직접 확인

## 발견사항

### [WARNING] 「CONTAINER_MISSING_EMIT/MULTIPLE_EMIT 는 구조화된 코드가 아니다」— 이번에 고친 문장과 6개 다른 spec 영역의 서술이 어긋난다

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` ·
  `logic.en.mdx:103` (이번 diff) — *"…연결하면 실행이 실패하고, **실패 메시지 앞에**
  `CONTAINER_MISSING_EMIT` 또는 `CONTAINER_MULTIPLE_EMIT` 가 붙어요 — **전용 에러 코드는
  없으니 코드가 아니라 메시지를 봐야 해요.**"* — `execution-engine.service.ts:7121·7125·7130`
  실측(`throw new Error(...)`, 일반 Error·`.code` 필드 없음)에 근거해 정확히 고쳤다.
- **충돌 대상** (같은 두 토큰을 **구조화된 에러처럼** 서술하는 6개 spec 파일):
  - `spec/5-system/4-execution-engine.md:332-333` §3.0 — *"emit 포트에 연결된 body 노드가
    0개 → `CONTAINER_MISSING_EMIT` **에러로 실행 실패**."* (가장 강한 형태 — "에러로 실행
    실패" 는 target 이 방금 "전용 에러 코드는 없다" 고 정정한 바로 그 서술)
  - `spec/3-workflow-editor/2-edge.md:202` §6.1 — *"검증 | emit 없음 → `CONTAINER_MISSING_EMIT`,
    2개 이상 → `CONTAINER_MULTIPLE_EMIT`."* (값처럼 표기)
  - `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 — 표의 "동작" 열에 다른 진짜(?) 케이스
    (`CONTAINER_INVALID_CHILD` 에러로 실패·`CONTAINER_CYCLE` 에러로 거부)와 **같은 문형**으로
    나열 — 그런데 그 둘도 같은 파일(`execution-engine.service.ts:7053·7084`)의 일반 `Error`
    메시지 접두일 뿐이라 같은 결함 계열이다(§아래 참고).
  - `spec/4-nodes/1-logic/0-common.md:83` — *"…연결되어야 한다 (`CONTAINER_MISSING_EMIT` /
    `CONTAINER_MULTIPLE_EMIT`)."*
  - `spec/4-nodes/1-logic/7-map.md:179-180` §6 — 열 헤더가 "메시지" 인데 값은 **전체 메시지가
    아니라 접두 토큰만** 적어 그 자체가 메시지 전체인 것처럼 읽힌다.
  - `spec/4-nodes/1-logic/9-foreach.md:209-210` §6 — 열 헤더가 "메시지 / 코드" 로 두 개념을
    합쳐 표기해 코드로 오독하기 더 쉽다.
  - (대조: `spec/4-nodes/1-logic/3-loop.md:189-191` §6 은 열 헤더가 "메시지" 이고 **실제
    발행 문자열 전문**(`CONTAINER_MISSING_EMIT: Container "<label>" has no body node ...`)을
    그대로 실어 target 의 새 서술과 **정합**한다 — 대비군으로 확인.)
- **상세**: `spec/conventions/error-codes.md`(§ "적용 범위")와 `spec/5-system/3-error-handling.md
  §1.4` 는 `error.code`/`output.error.code` 로 실제 발행되는 값만 카탈로그·명명 규약의 대상으로
  삼는다 — 실측상 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`(그리고 형제
  `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE`)는 이 카탈로그에 없고, `GUIDE_NON_EMITTED_VOCABULARY`
  등록이 그 사실을 코드 레벨로 고정했다(이 PR). 그런데 위 6개 spec 파일은 같은 두 토큰을
  "…에러로 실행 실패/거부" 또는 표의 "코드" 열 값으로 적어 **구조화된 에러 식별자**처럼
  보이게 서술한다 — 이번에 target 이 사용자 가이드에서 고친 바로 그 오독을 다른 영역이
  아직 반복하고 있다. 두 서술을 나란히 읽으면 "가이드: 전용 코드 없음" vs "엔진 spec:
  ~~에러로~~ 실행 실패" 로 정면으로 갈린다.
- **CRITICAL 이 아니라 WARNING 인 이유**: 어느 쪽도 "작동 불가"를 유발하지 않는다 — 순수
  서술(문서) 층위 충돌이고, 런타임 계약(둘 다 결국 `Error.message` 로만 전파됨)엔 영향 없음.
  다만 다음에 이 6개 파일 중 하나를 근거로 "CONTAINER_MISSING_EMIT 은 `output.error.code`
  값이다" 라고 판단하면(예: 클라이언트 분기 코드를 짜거나 §1.4 카탈로그에 추가하려 하면)
  실측과 충돌한다.
- **제안**: 이번 PR 은 스코프를 `02-nodes/logic{,.en}.mdx` 로 명시적으로 좁혔고
  (`plan/in-progress/error-code-emission-axis.md` §D-2, 트래커 항목
  `plan/in-progress/spec-draft-nullable-notation-followups.md:3404` 도 그 두 파일만
  지목) 이 6개 spec 파일은 그 항목의 대상이 **아니다** — 새 backlog 항목으로 planner 에
  등재 권고: 대상 `4-execution-engine.md §3.0`(가장 시급 — "에러로 실행 실패" 문구)·
  `2-edge.md §6.1`·`0-canvas.md §11.2.2`(+ 형제 `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE`
  도 동일 결함)·`0-common.md`·`7-map.md §6`·`9-foreach.md §6`. 처분 형태는 `3-loop.md §6`
  이미 쓰는 패턴(열 헤더 "메시지" + 발행 문자열 전문 인용)을 선례로 통일 권장.

### [INFO] `PROJECT.md` 의 `guide-identifier-existence.test.ts` SoT 표기가 여전히 `user-guide-evidence.md §2` 를 가리키지만 그 절은 이 가드를 나열하지 않음

- **target 위치**: `PROJECT.md:300` (이번 diff 가 같은 줄의 "발행 축" 서술을 추가하며 편집)
- **충돌 대상**: `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표 —
  `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts`
  3건만 등재, `guide-identifier-existence.test.ts` 는 없음.
- **상세**: `git show origin/main:PROJECT.md` 대조 결과 이 SoT 표기 불일치는 **이 PR 이전부터
  있던 상태**다 — 이번 diff 는 같은 줄의 다른 부분(발행 축 설명)만 추가했고 SoT 꼬리표는
  건드리지 않았다. 새로 만든 충돌은 아니라 CRITICAL/WARNING 은 아니지만, 이 PR 이 그 줄을
  두 번째로 편집하면서도 방치했다는 점만 기록한다.
- **제안**: 이 PR 의 책임 범위 밖(별건) — 다음에 `user-guide-evidence.md §2` 를 편집하는
  세션이 표에 네 번째 행으로 `guide-identifier-existence.test.ts` 를 추가하거나, PROJECT.md
  의 SoT 꼬리표를 제거.

## 요약

이번 PR 은 `spec/conventions/` 를 직접 건드리지 않았고(spec_impact: none, 실측과 일치),
코드 변경은 유저 가이드 문구 정정 2건 + 프론트엔드 테스트 하네스(발행 축) 뿐이라 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 정면 충돌은 없다. 다만 target 이
정정한 "CONTAINER_MISSING_EMIT/CONTAINER_MULTIPLE_EMIT 는 구조화된 에러 코드가 아니라
메시지 접두일 뿐" 이라는 실측 사실이, `5-system/4-execution-engine.md`·`3-workflow-editor/
{0-canvas,2-edge}.md`·`4-nodes/1-logic/{0-common,7-map,9-foreach}.md` 6개 spec 문서의
"…에러로 실행 실패/거부" 류 서술과 정면으로 어긋난다. target 자신의 plan 이 스코프를
가이드 2파일로 명시적으로 좁혔고 별도 트래커 항목이 그 범위를 확인해 주므로 이번 PR 을
막을 사유는 아니지만, 이 6개 파일은 어떤 기존 backlog 항목도 커버하지 않는 새로 드러난
갭이라 후속 planner 항목 등재를 권고한다.

## 위험도

LOW
