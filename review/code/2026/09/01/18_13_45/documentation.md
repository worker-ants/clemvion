# 문서화 리뷰 — retry-ie-residuals-c4a1b2 (18:13:45 라운드)

이번 diff 는 직전 라운드(`review/code/2026/09/01/17_55_50`)의 SUMMARY 가 지적한 WARNING 5건(W1
JSDoc 오귀속, W2·W3 관측 로그 미검증, W4 문서 drift, W5 CHANGELOG 누락)에 대한 fix 커밋을
포함한다. 소스(`retry-turn.service.ts`)를 직접 열어 W1(JSDoc 재배치)·W4(`executions.service.ts`
JSDoc 정정)가 실제로 적용됐음을 확인했고, W2/W3 신규 테스트도 실제 로그 문구·SQL 조각과 일치함을
`grep`/직독으로 대조했다. 그 위에서 이번 라운드 신규로 발견한 항목은 아래 두 건이다.

## 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md` 의 "1차 라운드 잔여" INFO 2 항목이, 바로 이 PR 이
  같은 파일에서 적용한 W3 수정으로 인해 **본문이 거짓이 됐는데도 미처분 상태로 방치**됐다.
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md:199-211` (항목 본문, 특히 `:209` "JSDoc
    :561-579 에 `@param` 없음"). 대조 대상 — 같은 파일 `:219-225`(W3, 2026-09-01 C-4 로 완료
    처리됨) 및 실제 정정 결과 `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:567-576`
    (신규 `@param execution` 블록, 이번 diff 가 추가). C-4 처분 테이블은 `:64`("남긴 **7건**의
    사유")·`:66-73`(표, 실제로는 6행).
  - 상세: `:199` INFO 2 항목은 `finalizeGuarded` 가 `execution.status`/`durationMs`/`finishedAt`
    을 in-place 로 되쓰면서도 JSDoc 에 그 계약이 없다는 지적이고, 그 실측 근거로 "JSDoc
    :561-579 에 `@param` 없음" 을 명시한다. 그런데 같은 파일의 "2차 라운드" W3 항목(`:219`)이
    바로 이 PR 에서 "완료(2026-09-01, C-4)" 로 닫히며 정확히 그 JSDoc 에 `@param execution`
    블록을 추가했다(대상 함수·라인 동일 — `:596` `execution.status = live.status` 를 갖는 그
    메서드). 즉 `:209` 가 자신의 근거로 인용한 "실측" 이 **이 PR 자신의 다른 수정으로 지금
    이 순간 거짓**이다. 이 항목은 W3 의 duplicate 로 종결(또는 W3 참조로 상호 정리)됐어야
    하는데 `[ ]` 미체크·C-4 처분 표 6행에도 없이 남았다. 부수로 `:64` 의 "남긴 7건" 이라는
    숫자와 표(`:67-72`, 6행)가 정확히 이 누락분만큼 어긋난다 — 실측(현재 파일의 미체크 항목을
    전수 `grep '^- \[ \]'` 하면 `:58·199·265·320·350·435·452` = 7건, 표는 6행)으로 확인.
  - 제안: `:199-211` INFO 2 항목을 W3(`:219`)과 상호 참조해 "duplicate — W3 로 해소" 로 닫거나,
    W3 만으로 부족한 잔여(있다면, 예: 시그니처 자체를 안전하게 만드는 후속 리팩터)만 남기고
    본문의 낡은 "실측" 문장을 취소선 처리한다. C-4 처분 표에도 7번째 행으로 편입해 "남긴 7건"
    수치와 표 행수를 일치시킬 것.

- **[INFO]** `assertLinkedTransitionApplied` 의 메서드 레벨 JSDoc(계약 문서)이 이번에 추가된
  마킹-실패 흡수(try/catch) 동작을 반영하지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:350-391`
    (메서드 JSDoc, 특히 `:378-386` "`shouldProceed === false`" 절 1번) — 실제 신규 동작은
    `:409-432`(diff 상 신규 try/catch, gate 409-432).
  - 상세: 메서드 JSDoc 은 `shouldProceed === false` 분기의 절차를 "1. …
    `markNodeCancelled` 로 CANCELLED 마킹 + terminal 이벤트 발행 … 2. `ExecutionCancelledError`
    를 던져 상위로 넘긴다" 로 서술하는데, 이번 diff 로 1번 단계가 실패(reject)할 수 있고 그
    경우 예외를 흡수·로깅한 뒤에도 2번(취소 예외 throw)은 그대로 진행한다는 새 계약이 생겼다.
    인라인 catch 블록 주석(`:416-425`)은 이 계약을 정확히 설명하지만, 이 파일이 다른 모든
    설계 결정을 메서드 상단 JSDoc 에 `ai-review WARNING #N` 형식으로 촘촘히 남기는 관행(바로
    위 단락들 참조)에 비추면, "markNodeCancelled 가 실패해도 분류는 유지하고 관측만 남긴다"
    는 이번 결정도 상단 계약 문서에 한 줄 편입되는 것이 그 관행과 일관적이다. 인라인 주석만
    읽고 메서드 JSDoc 을 안 읽는 차기 독자에게는 영향 없지만, 반대(메서드 JSDoc 만 보고 내부
    구현은 안 보는 경우)에는 실패 시 무엇이 일어나는지 알 수 없다.
  - 제안: `:378-386` 1번 항목 끝에 "`markNodeCancelled` 가 reject 해도 분류는 바뀌지 않는다 —
    실패는 로그로 관측하고 `ExecutionCancelledError` 는 그대로 던진다(C-4)" 한 줄 추가.

## 확인했으나 문제 없음 (검증 기록)

- CHANGELOG.md 신규 항목(`:3-40`)의 서술 3건(성공 retry `error` 잔류·중복 spawn 가드 무방비·
  취소 FAILED 오분류)을 각 소스 diff 와 대조 — 정확. 같은 파일에 `## Unreleased — <주제>` 형식
  다건 병존은 기존 저장소 관행(`grep -n '^## ' CHANGELOG.md` 로 27개 확인)과 일치, 이슈 아님.
- `executions.service.ts:74-90`, `:1056-1069` (W4 fix) — `error` 만 엔티티와 동일해졌다는 정정과
  `inputData`/`outputData` 는 논지가 유효하다는 구분이 실제 타입 선언(`:95-104`
  `ResponseExecution`)과 일치함을 확인.
- `retry-turn.service.ts:711-755` — W1 fix 로 `completeRetryExecution` JSDoc(`:757-777`)이 실제
  선언 바로 위로 복귀했고, 신규 헬퍼 `markSpawnedRowFailed`/`prepareSuccessTermination` 은 각자
  올바른 JSDoc 을 보유. 단 `markSpawnedRowFailed` JSDoc 에 `@param spawnedRow` 태그가 여전히
  없음(직전 라운드 INFO 11, "조치 불요"로 이미 처분됨 — 재지적 아님).
- `ai-turn-orchestrator.service.spec.ts`(W3 신규 테스트, gate 267-312)와
  `execution-engine.service.spec.ts`(W2 신규 spy, gate 3791-3832) 의 단언 문자열이 실제 로그
  문구·소스 위치와 일치함을 `grep`/직독으로 확인.
- `retry-turn.service.spec.ts` 신규 원자 consume 테스트(gate 245-265)의 기대값
  (`jsonb_exists(output_data, '_retryState')`, `output_data - '_retryState'`)이 실제
  `retry-turn.service.ts:224-228`(SQL 조각)과 정확히 일치.
- README·API 문서·환경변수 문서 업데이트 필요성: 없음. 이번 diff 는 내부 종결 경로 로직·엔티티
  타입 정정으로, 외부 API 계약(`ResponseExecution` 은 이미 `error: | null` 이었음)·설정·신규
  의존성 변경이 없다 — SUMMARY 의 router 배제 사유(api_contract·user_guide_sync)와 일치.

## 요약

직전 라운드 WARNING 5건은 실제로 정확하게 조치됐다(소스 직독·grep 대조로 확인). 이번 라운드
신규 발견은 두 건으로, 핵심은 `retry-turn-terminal-guard.md` 의 "1차 라운드 INFO 2" 항목이 이
PR 자신의 W3 수정으로 근거가 거짓이 됐는데도 미처분·미체크 상태로 남아 "남긴 7건" 수치와
처분 표 행수(6)가 어긋난 것이다 — plan 트래커의 신뢰도를 갉아먹는 정확히 그 클래스의 결함이라
WARNING 으로 기재한다. 두 번째는 `assertLinkedTransitionApplied` 메서드 계약 JSDoc 이 신규
실패-흡수 동작을 반영하지 않는 경미한 갭으로 INFO 다. CHANGELOG·JSDoc 재배치·신규 테스트 단언
등 직전 라운드 조치 품질은 전반적으로 높다.

## 위험도

LOW
