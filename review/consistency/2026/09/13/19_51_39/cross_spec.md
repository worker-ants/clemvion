# Cross-Spec 일관성 검토 — error-code-emission-axis (라운드 2)

## 검토 방법 메모

`_prompts/cross_spec.md` 번들은 예산 절단으로 `spec/conventions/error-codes.md`·
`spec/conventions/migrations.md`·`node-output.md`·`swagger.md` 등 다수와 실제 `git diff`
본문을 누락했다 (기록된 결함 — `plan/in-progress/spec-draft-nullable-notation-followups.md`
"consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다" 항목과 동형). 프롬프트
지시대로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
절대경로로 직접 열어 우회했다:

- `git diff origin/main...HEAD --stat` (전체 및 `-- codebase/`, `-- spec/`, `-- PROJECT.md`,
  `-- CHANGELOG.md` 분리) — **`spec/` 델타 0**, `codebase/` 델타 4파일 확인
  (`logic.mdx`·`logic.en.mdx`·`guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`)
- `git log --oneline origin/main..HEAD` (2 커밋: `65256a109` 라운드 1 구현,
  `a397ccc55` 라운드 1 리뷰 후속 수정) + `git show --stat a397ccc55`
- `Read`/`grep` 로 `spec/conventions/error-codes.md`, `spec/5-system/3-error-handling.md §1.4`,
  `spec/3-workflow-editor/{0-canvas,2-edge}.md`, `spec/4-nodes/1-logic/{0-common,3-loop,7-map,9-foreach}.md`,
  `spec/5-system/4-execution-engine.md`, `spec/conventions/user-guide-evidence.md §2`,
  `PROJECT.md:300`, `CHANGELOG.md` 직접 확인
- 직전 라운드 산출물 `review/consistency/2026/09/13/19_23_31/cross_spec.md` 및
  `plan/in-progress/{error-code-emission-axis,spec-draft-nullable-notation-followups}.md`
  대조 — 라운드 1 이 이미 등재한 항목과 라운드 2 신규 diff 를 구분하기 위함

## 발견사항

### [WARNING] 「CONTAINER_MISSING_EMIT/MULTIPLE_EMIT 는 구조화된 코드가 아니다」— 이번 정정 문장과 6개 spec 파일의 서술이 여전히 어긋난다 (라운드 1 대비 불변, 이미 planner 트래커 등재됨)

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` ·
  `logic.en.mdx:103` — *"…연결하면 실행이 실패하고, **실패 메시지 앞에**
  `CONTAINER_MISSING_EMIT` 또는 `CONTAINER_MULTIPLE_EMIT` 가 붙어요 — **전용 에러 코드는
  없으니 코드가 아니라 메시지를 봐야 해요.**"* — `execution-engine.service.ts:7121·7125·7130`
  실측(`throw new Error(...)`, 일반 `Error`·`.code` 필드 없음, `nodeExec.error = { message }`
  로만 기록됨 — `execution-engine.service.ts:8016`)에 근거해 정확히 고쳤다.
- **충돌 대상** (같은 두 토큰을 **구조화된 에러 코드처럼** 서술하는 6개 spec 파일 — 변경 없음):
  - `spec/5-system/4-execution-engine.md:332-333` §3.0 — *"emit 포트에 연결된 body 노드가
    0개 → `CONTAINER_MISSING_EMIT` **에러로 실행 실패**."*
  - `spec/3-workflow-editor/2-edge.md:202` §6.1 — *"검증 | emit 없음 → `CONTAINER_MISSING_EMIT`,
    2개 이상 → `CONTAINER_MULTIPLE_EMIT`."*
  - `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 — 같은 문형으로 형제
    `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE` 도 나열 (둘 다 `execution-engine.service.ts:7053·7084`
    의 일반 `Error` 메시지 접두일 뿐이라 같은 결함 계열).
  - `spec/4-nodes/1-logic/0-common.md:83` — *"…연결되어야 한다 (`CONTAINER_MISSING_EMIT` /
    `CONTAINER_MULTIPLE_EMIT`)."*
  - `spec/4-nodes/1-logic/7-map.md:179-180` §6 — 열 헤더 "메시지" 인데 값은 접두 토큰만.
  - `spec/4-nodes/1-logic/9-foreach.md:209-210` §6 — 열 헤더 "메시지 / 코드" 로 두 개념 혼재.
  - (대조: `spec/4-nodes/1-logic/3-loop.md:189-191` §6 은 발행 문자열 전문을 그대로 실어
    target 의 새 서술과 정합 — 처분 시 선례로 쓸 수 있다.)
- **상세**: `spec/conventions/error-codes.md` "적용 범위" 는 `error.code` 로 **실제 발행**되는
  값만 명명 규약·카탈로그 대상으로 삼는다. `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
  는 이 카탈로그·§1.4 어디에도 없고(§1.4 목록에 부재 — 아래 참고), `GUIDE_NON_EMITTED_VOCABULARY`
  등록(이 PR)이 그 사실을 코드 레벨로 고정했다. 그런데 위 6개 spec 파일은 같은 두 토큰을 여전히
  "…에러로 실행 실패/거부" 또는 표의 "코드" 열 값으로 적어 **구조화된 에러 식별자**처럼 보이게
  서술한다.
- **라운드 간 변화**: `spec/` 델타는 이번 라운드도 0 이므로 이 충돌 자체는 라운드 1(`19_23_31`
  cross_spec WARNING#1)과 동일하다. 다만 이제 **정상적으로 처분됐다** —
  `plan/in-progress/spec-draft-nullable-notation-followups.md:3419` 에 planner 소유 항목으로
  등재됐고(대상 6파일·처분 선례까지 명시), `error-code-emission-axis.md` §D-2·트래커 3404 가
  이 PR 의 스코프를 `02-nodes/logic{,.en}.mdx` 문장 2건으로 명시적으로 좁혔다고 확인된다.
  즉 이번 PR 이 새로 만든 충돌이 아니라 **이번 PR 이 드러낸 뒤 올바르게 위임한** 기존 충돌이다.
- **CRITICAL 이 아니라 WARNING 인 이유**: 순수 서술(문서) 층위 충돌이고 런타임 계약(둘 다
  `Error.message` 로만 전파)엔 영향 없다. 다만 이 6개 파일 중 하나를 근거로 "이 토큰은
  `output.error.code` 값이다" 라고 추후 판단하면(클라이언트 분기·§1.4 카탈로그 추가 등)
  실측과 충돌한다.
- **제안**: 신규 조치 불요 — 이미 planner 트래커에 등재·위임됨. 다음 planner 턴에서
  `3-error-handling.md §1.4` backfill(a) 또는 6파일 표기 정정(b) 중 택일 시, 그 처분이
  이 PR 이 만든 `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건과 카탈로그 탈출구 코드(§아래 INFO)
  에도 영향을 준다는 점(트래커에 이미 기재됨)을 재확인만 하면 된다.

### [INFO] `CHANGELOG.md` 신규 Unreleased 항목이 **이 PR 자신의 라운드 2 수정**으로 반증된 메커니즘 서술을 그대로 남긴다

- **target 위치**: `CHANGELOG.md` "Unreleased — 가이드가 «코드» 로 부르던 두 이름이 코드가
  아니었다 (+ 식별자 가드에 발행 축)" 항목 (커밋 `65256a109`, 라운드 1 도입, 라운드 2에서
  미수정) — *"탈출구로 쓰면 `MAX_ITERATIONS_EXCEEDED` 처럼 **접두로만 발행되지만 spec 이
  정식 코드로 인정한 것이 통과한다** — spec 이 `HTTP_TIMEOUT`(미발행 — §1.4 註)에 이미
  쓰는 처리와 같은 모양이다."*
- **충돌 대상**: 같은 PR 의 라운드 2 커밋(`a397ccc55`)이 `guide-identifier-scan.ts` 의
  `collectCatalogCodes` JSDoc 과 `guide-identifier-existence.test.ts` 의 회귀 테스트로
  **정확히 반대 사실**을 단언·고정했다 — `MAX_ITERATIONS_EXCEEDED` 는 카탈로그 탈출구
  때문이 아니라 `execution-failure-classifier.ts:76` **소비자 Set 인용** 때문에
  `isMessagePrefixOnly=false` 가 되어 카탈로그 검사에 **도달조차 하지 않는다**(전수 실측:
  카탈로그 탈출구는 "오늘 한 번도 발화하지 않는다"). `spec/5-system/3-error-handling.md §1.4`
  머리말도 이 소비자-인용 어휘와 발행 앵커를 명시적으로 구분한다 — CHANGELOG 의 "카탈로그
  덕에 통과" 서술은 바로 그 §1.4 의 구분과도 어긋난다.
- **상세**: `plan/in-progress/error-code-emission-axis.md` §E 는 이 오류를 라운드 1 리뷰가
  잡아냈고 개발자 스스로 "내 근거가 또 거짓이었다" 라고 정정했다고 명시적으로 기록한다.
  그런데 그 정정이 코드·JSDoc·plan 문서에는 반영됐지만, 같은 diff 에 포함된 `CHANGELOG.md`
  항목 본문은 여전히 **정정 이전(라운드 1)의 틀린 서술**을 담고 있다 — 이 diff 를 그대로
  머지하면 영속 이력(CHANGELOG)에 이미 반증된 메커니즘 설명이 남는다.
- **cross-spec 관점 경계**: 엄밀히는 `CHANGELOG.md` 는 `spec/**` 가 아니라 이 checker 의
  주 관점(데이터 모델/API 계약/요구사항 ID/상태 전이/RBAC/계층 책임) 중 어디에도 정확히
  들지 않는다 — `spec/5-system/3-error-handling.md §1.4` 의 설계(카탈로그를 탈출구로 쓰는
  이유)에 대한 **서술 정확성** 문제라 rationale_continuity/documentation 축과 더 가깝다.
  다만 그 축의 이번 라운드 리뷰가 diff-scope 판정에 따라 이 파일을 놓칠 수 있어 참고로
  남긴다.
- **제안**: `CHANGELOG.md` 의 해당 단락(*"탈출구로 쓰면 …HTTP_TIMEOUT…같은 모양이다"*)을
  라운드 2의 실제 결론(*"MAX_ITERATIONS_EXCEEDED 는 소비자-인용 경로 때문에 통과하고,
  카탈로그 탈출구는 오늘 한 번도 발화하지 않는다"*)으로 교체 — plan §E 의 표를 그대로
  옮기면 된다.

### [INFO] `PROJECT.md:300` 의 `guide-identifier-existence.test.ts` SoT 표기가 여전히 `user-guide-evidence.md §2` 를 가리키지만 그 절은 이 가드를 나열하지 않음 (라운드 1 대비 불변, PR 이전부터 존재)

- **target 위치**: `PROJECT.md:300` (이번 라운드도 같은 줄의 "발행 축" 서술만 확장 편집)
- **충돌 대상**: `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표 —
  `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts`
  3건만 등재, `guide-identifier-existence.test.ts` 는 없음 (직접 확인).
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에도 이 항목이 별도로
  등재돼 있지 않다 — 신규 등재를 권고한다.
- **상세**: `git show origin/main:PROJECT.md` 대조 결과 이 SoT 불일치는 이 PR 이전부터
  있던 상태다. 라운드 1·2 모두 같은 줄의 다른 구절(발행 축 설명)만 추가했을 뿐 SoT
  꼬리표는 건드리지 않았다. 새로 만든 충돌은 아니다.
- **제안**: 이 PR 의 책임 범위 밖(별건) — 다음에 `user-guide-evidence.md §2` 를 편집하는
  세션이 표에 네 번째 행으로 `guide-identifier-existence.test.ts` 를 추가하거나,
  `PROJECT.md` 의 SoT 꼬리표를 제거.

## 요약

라운드 2(코드 diff: `logic{,.en}.mdx` 문장 정정 + `guide-identifier-existence.test.ts`/
`guide-identifier-scan.ts` 발행 축 가드, `spec/` 델타 0)는 라운드 1이 이미 드러낸 두 축의
cross-spec 충돌 상태를 바꾸지 않았다 — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
를 "구조화된 코드 아님" 으로 고친 이번 문구와, 여전히 그 두 토큰을 코드처럼 서술하는
6개 spec 파일(`4-execution-engine.md`·`3-workflow-editor/{0-canvas,2-edge}.md`·
`4-nodes/1-logic/{0-common,7-map,9-foreach}.md`) 사이의 정면 어긋남은 **이미 planner
트래커(`spec-draft-nullable-notation-followups.md:3419`)에 등재·위임**되어 있어 이번 PR을
막을 사유가 아니다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 정면
충돌은 없다. 다만 라운드 2가 스스로 반증한 "카탈로그 탈출구가 `MAX_ITERATIONS_EXCEEDED`
를 통과시킨다" 는 서술이 같은 diff 의 `CHANGELOG.md` 항목에는 그대로 남아, 코드/plan
의 정정과 영속 이력 문서 사이에 새로운 불일치가 생겼다(INFO, cross-spec 본연의 영역은
아니나 참고 목적으로 기록). `PROJECT.md`↔`user-guide-evidence.md §2` SoT 표 누락은
PR 이전부터의 별건 INFO 로 불변이다.

## 위험도

LOW
