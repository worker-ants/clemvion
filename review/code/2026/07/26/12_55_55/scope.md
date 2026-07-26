# 변경 범위(Scope) Review — linear-cancel-mechanism

대상: 28개 파일(코드 9 + plan/CHANGELOG 3 + 이전 ai-review 라운드(`11_48_55`) 산출물 16). `git diff origin/main...HEAD --stat` 결과와 프롬프트 대상 파일 목록이 정확히 일치(누락·숨은 변경 없음).

## 발견사항

- **[INFO]** 브랜치가 "선형 경로 cancel 전파 기전 규명"에서 컨테이너/Parallel/Sub-Workflow/Background 로 확장된 것 — **정당한 동일 결함 완성이며 별도 PR 분리는 불필요**하다고 판단.
  - 위치:
    - `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts:195-197`(C1 — `executeInline` 가드 무력화 수정, 재throw)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6480`(C3 — `executeContainerBody`, 아이템 경계 확장), `:7120`(C3 — `executeParallelBranchBody`, 노드 경계 확장)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:6881-6892`(W2 — `executeBackgroundSubgraph` catch, graceful swallow)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2620-2637`, `:4510-4538`(C4 — guarded UPDATE 전환)
    - `codebase/backend/src/modules/execution-engine/containers/foreach-executor.ts:92-101`(C3 — errorPolicy 우회 재throw)
    - `plan/in-progress/node-cancellation-residual-signal-propagation.md:73-116`(확장 경위를 투명하게 기록한 체크리스트 후속 항목)
  - 상세: 최초 커밋(`dad70c7b2`)은 "선형 3-루프"(`runExecution`/`runNodeDispatchLoop`/`executeInline`)로 정확히 스코프됐고, 그 시점의 1차 scope 리뷰(`review/code/2026/07/26/11_48_55/scope.md`, 이번 diff 파일 25)도 5개 파일이 단일 결함에 1:1로 묶여 있음을 확인했다 — 그 자체로는 위반 없음. 그런데 그 커밋의 JSDoc·plan 서술("Stop 버튼이 부수효과까지 멈추게 한다")이 조건 없이 절대적으로 서술돼 있었고, 같은 세션의 `/ai-review` 10-agent 라운드(`11_48_55`)가 실측(mutation·프로브)으로 그 주장을 반증했다: (a) `executeInline` 가드는 유일한 호출자가 예외를 삼켜 실제로는 작동하지 않았고(C1, `requirement.md` CRITICAL), (b) 컨테이너/Parallel 본문은 애초에 가드 범위 밖이라 같은 부수효과 버그가 그대로 재현되며(C3), (c) 신설 JSDoc의 "finishedAt/durationMs 보존" 주장이 실제 catch 코드와 모순됐다(C4). 세 항목 모두 **"새 기능을 추가"한 것이 아니라 "원 PR이 스스로 한 약속(Stop = 부수효과 정지)을 실제로 지키게 만드는" 동일 결함 클래스의 다른 발현 지점**이다. `CLAUDE.md`("구현 완료 후 자동 review/fix는 상시 승인된 강제 의무")는 이런 Critical/Warning 을 같은 턴에 처리하도록 명시적으로 규정하며, 별도 PR로 미루는 것이 오히려 규약 위반에 가깝다. W2(Background 오분류)는 C1 수정 자체가 만든 새 도달 경로(같은 executionId 를 공유하는 body)의 직접 파생 결과이지 독립된 관심사가 아니다. 반대로 W6(spec 문서 §2.3/§5.1/§6 갱신), W8(가드 헬퍼 승격), concurrency 리뷰의 shutdown(FAILED/SERVER_INTERRUPTED) 미탐지 지적은 developer 권한 밖이거나 별도 규모의 작업이라 **이번 PR 범위에 넣지 않고 위임 문서/plan 백로그로만 남겼다**(`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:228-296`, `RESOLUTION.md` "보류·후속 항목") — 이는 스코프를 무분별하게 넓히지 않았다는 반대 증거다.
  - 제안: 없음(확인 목적의 판정). 향후 유사 상황에서도 "원 커밋이 자체 주장한 계약을 반증하는 Critical/Warning" 은 같은 PR에서 닫고, "새로운 요구사항/별도 규모 리팩터"는 위임·백로그로 분리하는 이번 처리 패턴을 기준으로 삼을 만하다.

- **[INFO]** `review/code/2026/07/26/11_48_55/` 하위 16개 신규 파일(`SUMMARY.md`/`RESOLUTION.md`/서브에이전트 리포트 10건/상태 json 4건)이 이번 diff 에 포함됨 — 정책상 정상, 스코프 이탈 아님.
  - 위치: 파일 13~28 전체
  - 상세: `review/` 디렉토리는 `.gitignore` 상 `review/**/_prompts/` 만 제외되고 나머지는 추적 대상이다(`.gitignore:36-38` 확인). 이 16개 파일은 드라이브바이로 끼워진 무관한 파일이 아니라, 이 브랜치 자신의 1차 `/ai-review` 라운드(`11_48_55`, 대상 파일이 정확히 이 PR의 최초 5개 파일과 일치)가 생성한 산출물이며, `RESOLUTION.md`는 developer 워크플로가 의무적으로 남기는 처리 기록이다. 코드 변경과 인과관계가 명확하고(위 확장 전부가 이 리뷰 라운드의 SUMMARY C1-C4/W1-W3 항목 번호로 커밋 메시지·plan에 교차 인용됨), CLAUDE.md 가 규정한 review-resolution 워크플로와 일치한다.
  - 판정: 스코프 내.

- **[INFO]** 그 외 8개 항목(불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅·주석·임포트·설정 변경)에서 위반 없음.
  - `codebase/backend/src/modules/execution-engine/containers/loop-executor.ts:76-80` — 코드 변경 없이 주석만 추가(`ExecutionCancelledError` 는 이미 무수정으로 전파됨을 설명). 결함 수정을 위한 근거 기록이지 무관한 주석 추가가 아님.
  - `workflow-errors.ts:314-330` — `ExecutionCancelledError` 생성자를 옵션 `message` 로 확장, 기본값 보존으로 하위 호환 유지. 새 필드·새 클래스·새 옵션 플래그 등 over-engineering 없음.
  - `workflow.handler.ts:21`, `workflow.handler.spec.ts:12`, `foreach-executor.ts:3`, `foreach-executor.spec.ts:4` — 신규 import 전부 실제로 사용됨(`ExecutionCancelledError`). 미사용 import·불필요한 import 정리 없음.
  - `CHANGELOG.md`, `plan/in-progress/*.md` — 결함·원인·수정·추적 링크만 기록하는 이 저장소의 기존 관행과 일치. 설정 파일(`package.json`, CI yml 등) 변경 없음(`git diff --stat` 확인).
  - `execution-engine.service.spec.ts`(459줄 신규)의 모든 신규 테스트 블록은 이번에 확장된 가드 지점(C2 executeInline/runNodeDispatchLoop, C3 컨테이너/Parallel, W2 Background)과 1:1 대응하며, 그 외 무관한 테스트 추가·기존 테스트 리팩토링은 없음(직접 diff 확인).

## 요약

이번 diff 는 "Stop 이후에도 하류 노드 dispatch·부수효과가 계속되던" 단일 결함을 고치는 fix 이며, 원 커밋(선형 3-루프)에서 시작해 같은 세션의 `/ai-review` 가 그 커밋 자신의 절대적 주장(Stop=부수효과 정지)을 반증한 Critical/Warning(C1 executeInline 무력화, C3 컨테이너/Parallel 범위 밖, C4 finishedAt/durationMs 모순, W2 Background 오분류, W1/W3)을 같은 결함 클래스로 판단해 같은 턴에 닫은 것으로 확인된다. 이는 새 기능 추가가 아니라 원 PR의 미완성 부분을 완성한 것이며, 프로젝트가 명문화한 "구현 완료 후 review/fix 는 상시 승인된 강제 의무" 규약과 일치해 별도 PR 로 분리할 근거가 없다. 반대로 개발자 권한 밖(spec 갱신, W6)이거나 더 큰 규모(가드 헬퍼 승격, W8)이거나 이미 별도로 추적 중인 사안(shutdown FAILED 미탐지)은 이번 PR에 끌어들이지 않고 위임 문서·plan 백로그로 명확히 분리해, 스코프를 과도하게 넓히지 않으려는 절제도 함께 확인된다. `review/code/2026/07/26/11_48_55/` 산출물 16개가 diff 에 포함된 것도 이 저장소의 review-resolution 관행과 `.gitignore` 정책상 정상이다. 불필요한 리팩토링·포맷팅 오염·무관한 주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
