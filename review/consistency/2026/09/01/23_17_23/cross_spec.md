# Cross-Spec 일관성 검토 — `spec/conventions/error-codes.md` (impl-done)

## 검토 범위 요약

- 실제 scope 델타는 `spec/conventions/error-codes.md` 1개 파일(§Overview "적용 범위" 문단
  뒤에 "대표 surface 는 둘이다" + "경계는 비대칭이다" 두 문단 추가, 11 insertions / 1
  deletion, `git diff origin/main -- spec/conventions/error-codes.md` 로 실측).
- 프롬프트가 예산 절단으로 "## 구현 변경 사항"(2개 파일/253줄) 섹션을 아예 생략했다.
  워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/easy-a-harness-hygiene`)를
  절대경로로 직접 열어 확인한 결과, 그 253줄은
  `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`(27줄) +
  `stray-tool-tags.test.ts`(198줄, diff 헤더 포함 253줄) — **별개 plan**
  (`plan/in-progress/harness-review-gate-followups.md` 계열, 문서 링크·도구 태그 잔재 검사
  하니스)의 산출물이다. `error-codes.md`/`ErrorCode`/`EngineErrorCode` 도메인과 무관해
  이 target 의 cross-spec 판정에 포함하지 않는다.
- target 텍스트 자체는 이미 같은 draft
  (`plan/complete/spec-draft-error-code-two-surfaces.md`)에 대해 `--spec` 6라운드
  (`21_30_10` ~ `21_56_30`)를 거쳐 BLOCK:NO·Critical 0·WARNING 0 로 착지했고, 적용된
  본문이 마지막 라운드가 승인한 문안과 일치함을 재확인했다(`21_56_30/_target/...md`의
  "변경 제안" vs 현재 `error-codes.md` §Overview 대조).

## 검증한 사실관계

- `ErrorCode`/`EngineErrorCode` 는 같은 파일(`codebase/backend/src/nodes/core/error-codes.ts`)
  의 자매 const — 확인.
- 키 disjoint 는 `error-codes.spec.ts:59-60` (`expect(overlap).toEqual([])`)가 고정 —
  확인.
- `EngineErrorCode`(`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/
  `SERVER_INTERRUPTED`/`WEBCHAT_IDLE_TIMEOUT`)와 `ErrorCode`(`EXECUTION_TIME_LIMIT_EXCEEDED`
  포함)가 실제로 "엔진도 쓰는" 코드를 양쪽에 걸쳐 갖는다는 target 의 "비대칭" 서술 — 소스
  코드 실측과 일치.
- `spec/5-system/4-execution-engine.md`의 2026-06-14 결정("신규 코드는 중앙 `ErrorCode`
  확장, `EXEC_*` 신규 네임스페이스 기각")과 target 은 경쟁하지 않는다 — target 은 기존
  4종의 사후 문서화일 뿐 신규 코드 배치 규칙을 선언하지 않는다. 원문 재확인 결과 이
  주장은 사실과 부합.

## 발견사항

- **[INFO]** 인접 문서 2건의 선재(先在) drift — 이미 별도 planner 항목으로 추적됨
  - target 위치: `spec/conventions/error-codes.md` §Overview (신규 문단은 이 drift 를
    만들지 않았고, 오히려 "카탈로그의 '엔진 수준 에러' 분류와 1:1 대응하지 않는다" 고
    명시해 아래 두 문서의 서술이 낡았음을 드러낸 쪽)
  - 충돌 대상:
    1. `spec/1-data-model.md` §2.13 Execution `error` 필드 설명(약 474행) — 엔진 인프라
       코드 6종(`SERVER_INTERRUPTED`/`WORKER_HEARTBEAT_TIMEOUT`/
       `EXECUTION_TIME_LIMIT_EXCEEDED`/`RESUME_FAILED`/`RESUME_CHECKPOINT_MISSING`/
       `RESUME_INCOMPATIBLE_STATE`)를 `EngineErrorCode`/`ErrorCode`/raw-literal 소속 구분
       없이 한 문장에 나열한다(실측 확인: `EXECUTION_TIME_LIMIT_EXCEEDED`·
       `RESUME_CHECKPOINT_MISSING` 류는 `ErrorCode`, `WORKER_HEARTBEAT_TIMEOUT`·
       `SERVER_INTERRUPTED` 는 `EngineErrorCode` — 두 const 가 섞여 있는데 표는 이를
       구분하지 않는다).
    2. `spec/5-system/3-error-handling.md` §1.4 "엔진 수준 에러" 표(108~120행) — 10개
       코드를 단일 집합처럼 나열하지만, named const 로 실제 등재된 것은 2종
       (`EXECUTION_TIME_LIMIT_EXCEEDED`=`ErrorCode`, `WORKER_HEARTBEAT_TIMEOUT`=
       `EngineErrorCode`)뿐이고 나머지(`RECURSION_DEPTH_EXCEEDED`·
       `MAX_ITERATIONS_EXCEEDED`·`CYCLE_DETECTED` 등)는 두 const 어디에도 없는 raw
       literal 로 보인다(삼분법).
  - 상세: target 이 세운 새 원칙("대표 surface 는 둘, 카탈로그 분류와 1:1 아님")을
    독자가 위 두 표에 적용하면 어느 코드가 타입 앵커를 가진 const 소속이고 어느 것이
    맨 문자열인지 알 수 없다 — "정의 중복" 이라기보다 **분류 축의 누락**에 가깝다.
  - 제안: 이미 `plan/in-progress/spec-conventions-engine-error-code-surface.md` 체크리스트
    "후속(별도 planner 턴) — 인접 문서의 선재 drift 2건" 항목으로 등재·추적 중이며, 이
    target 자신이 그 drift 를 만든 것이 아니라는 사실도 그 plan 이 명시했다(3차 `--spec`
    `21_39_47` cross_spec W1·W2 가 최초 검출). 재등재 불필요 — 다음 planner 턴에서 처리.

- **[INFO]** 소스 코드 주석의 "엔진 레이어" 이분법이 target 이 반증한 프레이밍을 아직 유지
  - target 위치: `spec/conventions/error-codes.md` §Overview 신규 문단("경계는 **비대칭**이다
    … 그 분류로 추론하지 말 것")
  - 충돌 대상: `codebase/backend/src/nodes/core/error-codes.ts:114-115`(`EngineErrorCode`
    JSDoc "**엔진 레이어** 에러 코드 — 노드 핸들러가 아니라 엔진 자신이…") 및 파일 최상단
    1-6행 `ErrorCode` JSDoc("Canonical error-code enum for **node handlers'**
    `output.error.code`" — 그러나 같은 const 안의 `EXECUTION_TIME_LIMIT_EXCEEDED` 는
    엔진이 `Execution.error.code` 로 싣는다, 68-73행 실측)
  - 상세: spec 문서 자체끼리의 충돌은 아니고(코드 주석 vs spec), target 이 정정한 "1:1
    아님" 원칙이 코드 주석에는 반영되지 않아 코드를 먼저 읽는 개발자는 여전히 낡은
    이분법으로 오독할 수 있다. `EngineErrorCode` JSDoc 건은 이미 plan 체크리스트에
    (`error-codes.ts:114-115`) 등재돼 있다. `ErrorCode` 최상단 docstring 의 "node
    handlers' output.error.code" 범위 서술은 그 목록에는 없지만 같은 근본 원인(사후
    반증)이며, 이전 라운드 `21_49_21 convention_compliance` 가 근거 인용 중 이미 같은
    줄을 지목한 바 있다(용어 충돌 지적의 증거로 인용됐을 뿐 별도 항목화되진 않음).
  - 제안: developer 트랙(소스 주석 수정) — 위 체크리스트 항목 처리 시 `ErrorCode` 최상단
    docstring 도 함께 훑을 것을 권장(신규 항목 추가는 planner 재량).

- **[INFO]** 이 라운드에 번들된 "구현 diff"(253줄)는 target 도메인과 무관
  - target 위치: 해당 없음
  - 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` ·
    `stray-tool-tags.test.ts`
  - 상세: 두 파일은 문서 링크 검사·도구 아티팩트 태그 잔재 검사 하니스 테스트로,
    `error-codes.md`/`ErrorCode`/`EngineErrorCode` 와 아무 식별자도 공유하지 않는다.
    이 impl-done 라운드가 같은 브랜치(`easy-a-harness-hygiene`)의 다른 plan 산출물을
    함께 diff-base 에 포함한 것으로 보인다.
  - 제안: 조치 불필요 — 그 harness plan 자체의 impl-done 라운드에서 별도로 다뤄질 사안.

## 요약

target(`spec/conventions/error-codes.md` §Overview 의 "대표 surface 는 둘, 경계는
비대칭" 병기)은 이미 6라운드 `--spec` 검토를 거쳐 데이터·근거가 세 번 반증되며 다듬어진
문안이고, 이번 재검토에서도 핵심 주장(자매 const·키 disjoint·비대칭 발행·2026-06-14
결정과 비경쟁)이 소스 코드·테스트 실측과 정확히 일치함을 재확인했다. target 자신이
새 모순을 만들지는 않았다. 다만 target 이 명문화한 "카탈로그 분류와 1:1 대응하지 않는다"
원칙을 인접한 두 spec 문서(`1-data-model.md` §2.13, `3-error-handling.md` §1.4)와
소스 주석 1곳이 아직 반영하지 못해 독자가 재분류를 유추해야 하는 자리가 남아 있으나,
이는 이 target 이 만든 것이 아니라 이미 별도 planner 후속 항목으로 명시 추적 중인
선재 drift 다. 번들된 "구현 diff" 253줄은 이 target 과 무관한 별개 plan 산출물이다.

## 위험도

LOW
