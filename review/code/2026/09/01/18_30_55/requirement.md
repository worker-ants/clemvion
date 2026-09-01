# 요구사항(Requirement) 리뷰

## 범위 요약

이번 세션 changeset(`origin/main...HEAD`, 3커밋: `59dd12869`→`15374b657`(1R fix)→`91c817608`(2R
fix))은 `ie-resume-turn-boundary-cancel.md`(8R)·`retry-turn-terminal-guard.md` 두 plan 트래커의
잔여 항목을 코드/테스트로 닫는 누적 diff다. 이미 이 changeset 자체에 대해 두 라운드의
`/ai-review` (`review/code/2026/09/01/17_55_50`, `18_13_45`)가 수행돼 WARNING 6건이 모두
조치·검증됐고, 그 산출물(RESOLUTION/SUMMARY/각 관점 리포트)이 이번 diff 에 신규 파일로
포함돼 있다. 본 라운드는 그 누적 diff 전체를 독립적으로 재검증한다.

핵심 코드 변경 5가지:
1. `ai-turn-orchestrator.service.ts` — `assertLinkedTransitionApplied` 의 `markNodeCancelled`
   호출을 `try/catch` 로 감싸, 마킹 실패(reject)가 취소 분류(`ExecutionCancelledError`)를
   삼키지 않게 한다. 실패는 로그로만 관측.
2. `execution-engine.service.ts` — `executeSync` timeout catch 가 `updateExecutionStatus` 의
   반환값(`persisted`)을 소비해 동시 cancel 선점 시 형제 경로(`failFirstSegmentSetup`)와
   동일한 warn 로그를 남긴다.
3. `retry-turn.service.ts` — (a) `markSpawnedRowFailed` 헬퍼로 두 not-found 분기의 중복
   4단계(로그·status·error·finishedAt+save) 추출, (b) `prepareSuccessTermination` 헬퍼로
   성공 종결 시 `execution.error` 를 명시적으로 비움(이전 시도의 stale error 잔류 방지),
   (c) `finalizeGuarded` JSDoc 에 in-place mutation 계약 명시.
4. `execution.entity.ts` — `error: Record<string, unknown>` → `Record<string, unknown> | null`
   (DB `nullable: true` 와 타입 정합, `prepareSuccessTermination` 의 `error = null` 대입이
   이 정정 없이는 컴파일되지 않는다).
5. 테스트 다수 신규(`ai-turn-orchestrator.service.spec.ts` 1건, `execution-engine.service.spec.ts`
   1건, `retry-turn.service.spec.ts` 다수) — 원자 consume SQL 형태 고정, 관측 로그 페이로드
   단언, 3개 미검증 분기(row 부재·`retryAfterSec` fallback·양쪽 타임스탬프 부재) 커버, 성공
   종결 2경로의 `error` 클리어 회귀 고정.

## 검증 방법 (독립 재실측)

- 소스를 직접 열어 diff 서술과 대조: `ai-turn-orchestrator.service.ts`
  `assertLinkedTransitionApplied`(파일 오프셋 397-441) — `try` 블록이 `markNodeCancelled`
  호출만 감싸고, `catch` 는 로그만 남긴 뒤 함수 하단의 무조건 `throw new
  ExecutionCancelledError(...)` 로 흐름이 그대로 이어짐을 확인(재-throw 은닉 없음).
- `reparkAiResumeTurn`(파일 오프셋 458-495) 을 따라가 신규 테스트
  (`ai-turn-orchestrator.service.spec.ts` "markNodeCancelled 가 실패해도…")의 mock 배선
  (`driver.updateExecutionStatus.mockResolvedValueOnce(false)` → `parked=false` →
  `assertLinkedTransitionApplied(false, ...)` → `nodeExec` 분기 진입 → `markNodeCancelled`
  reject)이 실제 호출 경로와 정확히 일치함을 확인 — `phase='AI turn — re-park'` 단언도
  실제 호출부 인자와 일치.
- `execution-engine.service.ts`:659 (`failFirstSegmentSetup`)와 :4319 (신규 timeout catch)의
  로그 문구("동시 cancel 이 이미 terminal 로")가 `grep` 으로 문자 그대로 일치함을 확인 —
  CHANGELOG/plan 이 주장하는 "형제 경로와 로깅 대칭" 서술과 부합.
- `retry-turn.service.ts` 를 `grep -n markSpawnedRowFailed\|prepareSuccessTermination` 으로
  전수 조회 — `prepareSuccessTermination` 호출부가 정확히 2곳
  (`completeRetryExecution`:783, `resumeGraphAfterRetry` 자연 종결:959)이고, CHANGELOG 의
  "두 성공 종결 경로" 서술과 일치. `markSpawnedRowFailed` 호출부도 정확히 2곳(두 not-found
  분기)으로 중복 제거 주장과 일치.
- 1R 이 발견한 JSDoc orphan(WARNING #1)이 2R 이후 실제로 정정됐는지 소스로 직접 확인 —
  `completeRetryExecution`(:779) 바로 위(:758-778)에 자신의 JSDoc 이 있고,
  `markSpawnedRowFailed`(:724)/`prepareSuccessTermination`(:751) 도 각자 정확한 JSDoc 을
  보유 — orphan 없음.
- `retry-turn.service.spec.ts` 신규 테스트(자연 종결/fallback 종결의 `error` 클리어 검증,
  원자 consume SQL 형태 고정, 3개 미검증 분기) 를 직접 읽어 `NOT_CALLED` sentinel 로
  vacuous 통과를 차단하는 패턴, 호출 시점 스냅샷(사후 참조 회피) 설계를 확인 — 프롬프트가
  주장하는 뮤테이션 RED(가드 제거 → RED, `jsonb_exists` 무력화 → RED)를 재현하지는
  않았으나(이미 2라운드가 실측), 코드·테스트 정합성은 직접 대조로 확인.
- plan 문서 두 건의 자기서술 수치 정합성 실측: `retry-turn-terminal-guard.md` — "잔여 13건 중
  7건 처리, 남긴 6건" 주장을 `grep -c '^- \[ \]'` = **6** 으로 확인(표 행수와 일치, 2R 이
  발견한 "7건 vs 6행" 어긋남이 실제로 해소됨). `ie-resume-turn-boundary-cancel.md` — "잔여
  12건 중 2건 처리, 남긴 10건" 주장을 `grep -c '^- \[ \]'` = **10** 으로 확인, C-4 로
  체크된 항목도 정확히 2건(반환값 소비 비대칭, `markNodeCancelled` reject 경로).
- `plan/in-progress/ie-resume-turn-boundary-cancel.md` 의 `worktree:` 필드가 실제 워킹
  디렉터리 basename(`retry-ie-residuals-c4a1b2`)과 일치함을 `pwd` 로 확인.
- `execution.error` 를 null-check 없이 체이닝하는 프로덕션 코드 `grep` 재확인 —
  `.error.message`/`.error.code` 매치는 전부 주석/무관 식별자(`workflow-errors.ts` 등)이고
  실제 프로퍼티 접근 코드는 없음(3라운드 리뷰가 이미 확인한 것과 동일 결론).
- `git status --short` — 조사 과정에서 저장소에 아무것도 쓰지 않았음(리뷰 산출물 디렉터리만
  untracked로 남음, 정상).

## 발견사항

- **[INFO]** spec fidelity — 관련 spec 문서 식별 및 대조 완료, 이번 diff 의 세부 구현(마킹
  실패 시 catch 흡수 정책, guarded UPDATE 반환값 로깅, 성공 종결 시 `error` 클리어)을
  규정하는 spec 본문 없음(회색지대, spec 침묵) — CRITICAL/SPEC-DRIFT 아님.
  - 위치: `spec/5-system/4-execution-engine.md`(§1.1 전이표, "retry_last_turn 재진입" 단락),
    `spec/conventions/node-cancellation.md`(§2.4 "retry 재진입 종결 경로 terminal 가드"),
    `spec/1-data-model.md:474`(`Execution.error` 필드, 이미 `JSONB?` 로 nullable 명시).
  - 상세: `markNodeCancelled` reject 흡수·`assertLinkedTransitionApplied` 예외 분류 유지는
    코드 레벨 구현 세부라 spec 이 규정하지 않는다(convention 문서가 상태 전이·guarded UPDATE
    "0행이면 skip" 원칙만 정의). `Execution.error` nullable 정정은 오히려 spec 과의 기존
    불일치(코드 타입만 `| null` 없이 선언, DB·spec 은 처음부터 nullable)를 해소하는 방향이라
    spec 과 **더 정합**해졌다 — 되돌릴 이유 없음. 성공 종결 시 `error` 클리어도 spec
    §1-data-model.md:562 의 "Execution.error = 워크플로우 실행이 failed 로 전이될 때 복사"
    라는 서술(즉 non-failed 상태에서는 error 가 없어야 한다는 암묵적 불변식)과 부합하는
    방향의 정정이다.
  - 제안: 없음 — 회색지대로 분류, spec 반영 불요.

- **[INFO]** 1R/2R 이 발견한 WARNING(JSDoc orphan·관측 로그 미검증·엔티티 타입 변경의 문서
  drift·plan 트래커 수치 불일치)이 최종 상태에서 모두 실제로 해소됐음을 독립적으로 재확인.
  - 위치: `retry-turn.service.ts:758-779`(JSDoc 위치), `ai-turn-orchestrator.service.spec.ts`
    (신규 로그 단언), `execution-engine.service.spec.ts`(신규 warn 단언),
    `plan/in-progress/retry-turn-terminal-guard.md`(`grep -c` 재실측 6=6).
  - 상세: 새로 열어 본 결과와 프롬프트의 RESOLUTION 서술이 line-level 로 일치 — 재발/부분
    수정 흔적 없음.
  - 제안: 없음(확인 목적).

새로운 CRITICAL/WARNING 급 요구사항 결함은 발견하지 못했다.

## 요약

이 changeset 은 두 plan 트래커가 명시적으로 등재한 항목만을 정확히 겨냥하며, 5개 처방
(취소 마킹 실패 흡수·guarded UPDATE 반환값 로깅·성공 종결 시 `error` 클리어·엔티티 nullable
타입 정정·중복 로직 헬퍼 추출) 모두 소스 코드에 의도대로 구현돼 있음을 직접 읽어 확인했다.
이미 두 차례의 `/ai-review` 라운드가 이 changeset 자체를 검토해 WARNING 6건(JSDoc 오귀속,
관측 로그 미검증, 타입 변경의 문서 drift, CHANGELOG 누락, plan 트래커 중복 등재·수치 불일치)
을 발견·조치했고, 본 라운드에서 그 조치들이 실제로 최종 소스/plan 문서에 반영돼 있는지
line-level 로 재대조해 전부 해소됐음을 확인했다. 관련 spec 문서(`5-system/4-execution-engine.md`,
`conventions/node-cancellation.md`, `1-data-model.md`)와 대조한 결과 이번 diff 의 구현 세부를
규정하는 본문은 없어(회색지대) spec fidelity 불일치도 없으며, `Execution.error` nullable
정정은 오히려 기존에 spec/DB 와 어긋나 있던 TS 타입을 바로잡는 방향이라 spec 과 충돌하지
않는다. 반환값 미소비, 예외 흡수로 인한 오분류, 헬퍼 추출 시 인자 순서 등 엣지 케이스는
전부 뮤테이션 테스트 또는 신규 회귀 테스트로 고정돼 있다. 새로운 요구사항 결함(기능
미완성·TODO/FIXME·의도-구현 괴리·미정의 에러 시나리오·검증 누락·반환값 누락)은 발견하지
못했다.

## 위험도

LOW
