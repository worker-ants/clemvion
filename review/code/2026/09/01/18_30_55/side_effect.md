# 부작용(Side Effect) Review

## 배경

이번 라운드(`18_30_55`)의 diff 는 `origin/main..HEAD` 3개 커밋(`59dd12869` 원 수정 ·
`15374b657` 1R fix · `91c817608` 2R fix)의 누적이며, 여기에 두 리뷰 라운드
(`review/code/2026/09/01/17_55_50/*`, `review/code/2026/09/01/18_13_45/*`) 산출물이 신규
파일로 동봉된다. 이 코드 표면은 이미 side_effect 리뷰어가 두 라운드(1R: WARNING 1건 →
fix, 2R: INFO 다수·WARNING 0)에 걸쳐 검토했으므로, 이번 라운드는 **재검증**(직접 소스 대조 ·
전 백엔드 grep)에 집중하고 새로 발견된 것만 별도로 표기한다.

## 검증 방법 (본 라운드 독립 실측)

- `git log --oneline origin/main..HEAD` → 3커밋, worktree `git status --short` 는 이번 세션
  출력 디렉터리(`review/code/2026/09/01/18_30_55/`) 외 clean.
- `Execution.error` 엔티티 타입 확장(`| null`)의 안전성을 **execution-engine/executions
  모듈 밖까지** 넓혀 재검증했다 — `grep -rln 'Execution\b' codebase/backend/src | xargs
  grep -l '\.error\b'` 로 잡힌 21개 파일(`alerts-evaluator.service.ts`,
  `terminal-revoke-reconciler.service.ts`, `websocket.gateway.ts`,
  `execution-failure-classifier.ts` 등)을 직접 열어 대조한 결과, `Execution` 엔티티의
  `.error` 필드를 null-check 없이 접근하는 코드는 없었다 — 잡힌 `.error` 참조는 전부
  `NodeExecution.error`/WS 이벤트 페이로드(`event.error?.code` 등, 이미 옵셔널 체이닝)처럼
  다른 타입이거나 이미 null-safe. 1R/2R side_effect.md 가 `execution-engine`/`executions`
  두 모듈 안쪽만 확인했던 것보다 넓은 범위에서 재확인.
- 2R `requirement.md`(`18_13_45`)가 자인한 "저장소 뮤테이션(주입한 `throw err;` 한 줄을
  `sed` 로 정밀 제거해 원복)" 잔여물이 현재 트리에 없는지 직접 소스로 재확인 —
  `ai-turn-orchestrator.service.ts` 의 `assertLinkedTransitionApplied` catch 블록(409~436행)을
  `Read` 로 열어 대조한 결과 원본 예외를 재-throw 하는 코드는 없고 diff 가 의도한 형태
  그대로다. 원복이 실제로 완료됐음을 이 세션에서 재확인.
- `retry-turn.service.ts` 의 JSDoc 오귀속(1R WARNING #1) 재발 여부 재확인 —
  `markSpawnedRowFailed`(711→724행) · `prepareSuccessTermination`(738→751행) ·
  `completeRetryExecution`(758→779행) 세 선언 모두 자신의 JSDoc 바로 아래 위치, orphan 없음.
- `plan/in-progress/retry-turn-terminal-guard.md` 의 미체크 항목 수 재실측 —
  `grep -c '^\s*- \[ \]'` = **6**, C-4 처분 표(64행 "남긴 6건") 행수(66~73행)도 6행으로 일치
  (2R WARNING #1 이 지적한 "7 vs 6" drift 는 이 라운드 기준 재발 없음).
- `finalizeGuarded` 의 신규 in-place mutation 계약(JSDoc `@param execution`)을 갖는
  호출부가 실제로 2곳(`completeRetryExecution` 785행, `failRetryExecution` 1021행)뿐임을
  `grep -n 'finalizeGuarded('` 로 확인 — 문서화되지 않은 제3의 호출부 없음.
- diff 전체(`git diff origin/main..HEAD -- codebase/`)에서 `process.env` · `console.*` ·
  `fs.*` · `fetch`/`axios`/`http.request` 신규 참조, module-level `const`/`let`/`var`
  신규 도입을 grep 으로 훑었으나 전부 0건.

## 발견사항

- **[INFO]** `assertLinkedTransitionApplied` 의 예외 흡수가 예외 타입을 결정론적으로
  재분류한다 — 이벤트/콜백 라우팅에 영향을 주는 변경이므로 관점 8(이벤트/콜백)에 해당
  하지만, 트레이드오프가 plan/코드 양쪽에 명시·수용돼 있고 1R·2R 이 이미 같은 결론에
  도달했다. 재발견 아님, 재확인 목적으로만 기록.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-436`
    (`try { await this.driver.markNodeCancelled(...) } catch (err) { ... }` 뒤
    무조건 `throw new ExecutionCancelledError(...)`).
  - 상세: `markNodeCancelled` reject 시 원본 예외(DB 쓰기 실패 등 임의 타입)가 항상
    `ExecutionCancelledError` 로 대체된다. 저장소 전역에서 `ExecutionCancelledError` 는
    `instanceof` 분기로 취소/실패를 가르는 데 쓰이므로, 마킹 실패의 원인과 무관하게
    다운스트림(BullMQ job 처리 등)은 항상 "정상 취소" 로 본다. plan
    (`ie-resume-turn-boundary-cancel.md` C-4)이 "BullMQ 자가 치유 경로 상실" 을 이미
    인지·수용했다.
  - 제안: 조치 불요.

- **[INFO]** `Execution.error` 타입 확장(`| null`)의 안전성을 diff 범위 밖까지 넓혀
  재확인 — 신규 결함 없음.
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`.
  - 상세: 위 "검증 방법" 절 참조. `execution-engine`/`executions` 두 모듈 밖에서
    `Execution.error` 를 null-check 없이 만지는 코드는 없다.
  - 제안: 조치 불요.

- **[INFO]** 1R·2R 이 지적·수정한 side-effect 관련 항목(JSDoc 오귀속, 예외 재분류,
  타입 확장에 따른 문서 drift)이 이번 라운드 기준 전부 안정 상태임을 재확인했다 — 새로
  등장한 회귀는 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:711-798`
    (JSDoc 배치), `plan/in-progress/retry-turn-terminal-guard.md`(카운트 정합).
  - 제안: 조치 불요.

전역 변수 도입/수정, 환경 변수 읽기·쓰기, 신규 네트워크 호출, 예상치 못한 파일시스템
부작용은 이번 diff(3개 커밋 누적)에서 발견되지 않았다. `review/code/2026/09/01/{17_55_50,
18_13_45}/**` 신규 파일 커밋과 `plan/in-progress/*.md` 의 `worktree:` frontmatter 갱신은
저장소의 표준 절차(리뷰 산출물 보관 위치, `plan_guard` 무장 요건)에 부합하는 예상된
부작용이라 별도 등재하지 않는다(1R/2R side_effect.md 가 이미 같은 결론).

## 요약

이번 라운드는 1R(WARNING 1건, 이미 fix)·2R(INFO 다수, WARNING 0)이 검토한 것과 동일한
코드 표면의 누적 diff를 독립적으로 재검증했다. `Execution.error` 타입 확장의 안전성을
`execution-engine`/`executions` 모듈 밖까지 넓혀 재확인했고(신규 결함 없음), 2R 리뷰어가
자인한 저장소 뮤테이션(mutation-testing 중 주입한 `throw err;`)이 현재 트리에 잔존하지
않음을 소스 직독으로 재확인했으며, JSDoc 배치·plan 체크리스트 카운트 정합성도 모두
안정 상태다. `markNodeCancelled` 실패 흡수에 따른 예외 타입 재분류(이벤트 라우팅 변경)는
여전히 유일하게 주목할 부작용이지만 의도된 트레이드오프로 plan·코드 양쪽에 문서화·수용돼
있다. 새로운 CRITICAL/WARNING 급 부작용은 발견하지 못했다.

## 위험도

LOW
