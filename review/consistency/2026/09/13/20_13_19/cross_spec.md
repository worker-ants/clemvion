# Cross-Spec 일관성 검토 — error-code-emission-axis (라운드 3)

## 검토 방법 메모

`_prompts/cross_spec.md` 번들은 예산 절단으로 `spec/conventions/error-codes.md` 등 다수와
실제 `git diff` 본문을 누락했다(기록된 결함 — `plan/in-progress/spec-draft-nullable-notation-followups.md`
"consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다" 항목과 동형). 프롬프트 지시대로
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/error-code-emission-axis-56c9ff`)를
절대경로로 직접 열어 우회했다:

- `git log --oneline origin/main..HEAD` (3커밋: `65256a109` 라운드1 구현 · `a397ccc55` 라운드1
  리뷰 후속(round-1 fix) · `a4b98eda8` 라운드2 리뷰 후속(round-2 fix, 이번 라운드가 새로 보는 diff))
- `git diff origin/main...HEAD --stat` (`spec/` 델타 **0파일**, `codebase/` 델타 4파일:
  `logic.mdx`·`logic.en.mdx`·`guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`)
- `git show a4b98eda8 --stat` / 본문 — 이번 라운드가 새로 보는 마지막 커밋은 `where` 다중매치
  파싱·핵심 술어(`isMessagePrefixOnly`) 스캐너 승격·중복 제거·CHANGELOG 자기모순 정정으로,
  전부 **테스트 하네스 내부** 이슈이며 새 spec 관련 서술을 추가하지 않았다
- 이전 두 라운드 산출물(`review/consistency/2026/09/13/{19_23_31,19_51_39}/cross_spec.md`)과
  `plan/in-progress/{error-code-emission-axis,spec-draft-nullable-notation-followups}.md` 대조
  — 라운드 1·2 가 이미 등재한 항목과 라운드 3 신규 diff 를 구분하기 위함
- `Read`/`grep` 로 `spec/5-system/3-error-handling.md §1.4`,
  `spec/3-workflow-editor/{0-canvas,2-edge}.md`, `spec/4-nodes/1-logic/{0-common,3-loop,7-map,9-foreach}.md`,
  `spec/5-system/4-execution-engine.md`, `spec/conventions/user-guide-evidence.md §2`,
  `PROJECT.md:300`, `execution-engine.service.ts:7105-7135` 재확인 (라운드 1·2 실측과 일치)

## 발견사항

### [WARNING] 「CONTAINER_MISSING_EMIT/MULTIPLE_EMIT 는 구조화된 코드가 아니다」— 6개 spec 파일의 서술과 여전히 어긋남 (라운드 1·2 대비 불변, planner 트래커 등재 완료 상태 유지)

- **target 위치**: `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` ·
  `logic.en.mdx:103` — *"…연결하면 실행이 실패하고, **실패 메시지 앞에**
  `CONTAINER_MISSING_EMIT` 또는 `CONTAINER_MULTIPLE_EMIT` 가 붙어요 — **전용 에러 코드는
  없으니 코드가 아니라 메시지를 봐야 해요.**"* — `execution-engine.service.ts:7121·7125·7130`
  (`throw new Error(...)`, 일반 `Error`·`.code` 필드 없음, `nodeExec.error = { message }` 로만
  기록 — `execution-engine.service.ts:8016`) 실측에 근거해 정확히 고쳤다. 이 문장 자체는
  라운드 1 이후 변경 없음.
- **충돌 대상** (같은 두 토큰을 **구조화된 에러 코드처럼** 서술하는 6개 spec 파일 — 라운드 1·2
  대비 변경 없음):
  - `spec/5-system/4-execution-engine.md:332-333` §3.0 — *"emit 포트에 연결된 body 노드가
    0개 → `CONTAINER_MISSING_EMIT` **에러로 실행 실패**."* (가장 강한 형태)
  - `spec/3-workflow-editor/2-edge.md:202` §6.1 — *"검증 | emit 없음 → `CONTAINER_MISSING_EMIT`,
    2개 이상 → `CONTAINER_MULTIPLE_EMIT`."*
  - `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 — 같은 문형으로 형제
    `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE` 도 나열 (그 둘도 같은 파일
    `execution-engine.service.ts:7053·7084` 의 일반 `Error` 메시지 접두일 뿐이라 동일 결함 계열).
  - `spec/4-nodes/1-logic/0-common.md:83` — *"…연결되어야 한다 (`CONTAINER_MISSING_EMIT` /
    `CONTAINER_MULTIPLE_EMIT`)."*
  - `spec/4-nodes/1-logic/7-map.md:179-180` §6 — 열 헤더 "메시지" 인데 값은 접두 토큰만 실려
    그 자체가 메시지 전체인 것처럼 읽힘.
  - `spec/4-nodes/1-logic/9-foreach.md:209-210` §6 — 열 헤더가 "메시지 / 코드" 로 두 개념을
    혼재해 코드로 오독하기 더 쉬움.
  - (대조: `spec/4-nodes/1-logic/3-loop.md:189-191` §6 은 열 헤더가 "메시지" 이고 **발행
    문자열 전문**(`` CONTAINER_MISSING_EMIT: Container "<label>" has no body node ... ``)을
    그대로 실어 target 의 정정 문장과 **정합** — 처분 시 선례로 쓸 수 있다.)
- **상세**: `spec/5-system/3-error-handling.md §1.4`(엔진 수준 에러 카탈로그, SoT)는 애초에
  `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 항목으로 **등재하지 않는다** — 이
  자체는 target 의 새 서술과 정합한다. 문제는 그 카탈로그가 아니라 **여러 도메인 spec**
  (컨테이너 노드 문서·워크플로우 에디터 문서·실행 엔진 문서)이 두 토큰을 "…에러로 실행
  실패/거부" 또는 표의 "코드" 열 값으로 적어, target 이 이번에 사용자 가이드에서 정정한
  바로 그 오독("이 토큰이 `output.error.code`/`error.code` 값이다")을 반복하고 있다는
  점이다.
- **라운드 간 변화 없음 확인**: 이번 라운드(a4b98eda8)가 건드린 것은
  `guide-identifier-scan.ts`(핵심 술어 `isMessagePrefixOnly` 스캐너 승격·`where` 다중 매치
  파싱)·`guide-identifier-existence.test.ts`(진리표 대조군·중복 제거)·`CHANGELOG.md`(자기모순
  정정, 아래 참고)뿐이며 `spec/` 파일은 이번에도 델타 0이다. 따라서 이 WARNING 은 라운드
  1(`19_23_31` cross_spec WARNING#1)·라운드 2(`19_51_39` cross_spec WARNING#1)와 상태가
  동일하다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3419-3439`
  (planner 소유, 미해결 `- [ ]`)에 대상 6파일·처분 선례(3-loop.md 형식 통일)·연관 항목
  (§1.4 앵커 없는 7종 표기 결정)까지 명시적으로 등재돼 있고, `error-code-emission-axis.md`
  §D-2 가 이 PR 스코프를 `02-nodes/logic{,.en}.mdx` 문장 2건으로 명시적으로 좁혔다는 사실도
  변함없다.
- **CRITICAL 이 아니라 WARNING 인 이유**: 순수 서술(문서) 층위 충돌이며 런타임 계약(양쪽 다
  결국 `Error.message` 로만 전파)에는 영향이 없다. 다만 이 6개 파일 중 하나를 근거로 "이
  토큰은 `output.error.code` 값이다" 라고 향후 판단(클라이언트 분기 작성·§1.4 카탈로그 추가
  등)하면 실측과 충돌한다.
- **제안**: 신규 조치 불요 — 3라운드 연속 동일 상태로 확인됐고 이미 planner 트래커에
  등재·위임돼 있다. 다음 planner 턴에서 `3-error-handling.md §1.4` backfill(a) 또는 6파일
  표기 정정(b) 중 하나를 택할 때, 그 처분이 이 PR 의 `GUIDE_NON_EMITTED_VOCABULARY` 등록
  2건과 카탈로그 탈출구(`collectCatalogCodes`, 현재 0회 발화로 테스트 고정됨)에도 영향을
  준다는 점(이미 트래커에 기재됨)만 재확인하면 된다.

### [INFO] `PROJECT.md:300` 의 SoT 표기가 `user-guide-evidence.md §2` 를 가리키지만 그 절이 `guide-identifier-existence.test.ts` 를 나열하지 않음 (3라운드 연속 불변, PR 이전부터 존재)

- **target 위치**: `PROJECT.md:300` — 이번 라운드도 같은 줄의 "발행 축" 서술 문구만 확장
  편집(round 2 문구 → round 3 재확인, 실질 변경 없음).
- **충돌 대상**: `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표 —
  `impl-anchor-existence.test.ts`·`integrations-coverage.test.ts`·`triggers-coverage.test.ts`
  3건만 등재, `guide-identifier-existence.test.ts` 는 여전히 없음(직접 확인).
- **상세**: `git show origin/main:PROJECT.md` 대비 이 SoT 불일치는 PR 이전부터 존재. 라운드
  1~3 모두 같은 줄의 다른 구절만 편집했을 뿐 SoT 꼬리표는 건드리지 않아 새로 만든 충돌이
  아니다.
- **제안**: 이 PR 책임 범위 밖(별건) — 다음에 `user-guide-evidence.md §2` 를 편집하는
  세션이 표에 네 번째 행을 추가하거나 `PROJECT.md` 의 SoT 꼬리표를 정정.

## 요약

라운드 3(diff: `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 하네스
정제(`where` 다중 위치 파싱·핵심 술어 스캐너 승격·중복 제거) + `CHANGELOG.md` 자기모순
정정, `spec/` 델타 0)은 라운드 1·2가 이미 드러낸 cross-spec 상태를 바꾸지 않았다.
`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "구조화된 코드 아님" 으로 고친
가이드 문구와, 여전히 그 두 토큰을 코드처럼 서술하는 6개 spec 파일(`4-execution-engine.md`·
`3-workflow-editor/{0-canvas,2-edge}.md`·`4-nodes/1-logic/{0-common,7-map,9-foreach}.md`)
사이의 정면 어긋남은 3라운드 연속 동일 상태로 확인됐고, 이미 planner 트래커에 대상·처분
선례까지 명시돼 등재·위임되어 있어 이번 PR 을 막을 사유가 아니다. 라운드 2가 지적했던
`CHANGELOG.md` 자기모순(카탈로그 탈출구 서술)은 이번 라운드에서 실제로 정정됐다(확인 완료).
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 정면 충돌은 없다. `PROJECT.md`
↔`user-guide-evidence.md §2` SoT 표 누락은 PR 이전부터의 별건 INFO 로 3라운드 연속 불변이다.

## 위험도

LOW
