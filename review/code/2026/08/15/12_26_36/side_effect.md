STATUS=success

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (9차 누적 라운드)

## 방법론

프롬프트 번들이 핵심 소스(`execution-engine.service.ts`/`retry-turn.service.ts`/
`terminal-duration.ts`/`terminal-duration.spec.ts`/`plan/in-progress/eia-terminal-payload.md`/
`spec-sync-external-interaction-api-gaps.md`)의 diff 를 예산 초과로 생략했다. `git diff
origin/main --`/`git show <commit>`/`Read`/`grep`으로 실제 소스를 직접 열어 대조했다. 직전(8차,
`11_59_09`) side_effect 라운드가 **WARNING**으로 남긴 "대시보드·통계 AVG 집계 오염" 항목이 이번
diff 에서 실제로 어떻게 처리됐는지를 코드 레벨로 재검증하는 데 집중했고, 그 결과 그 값을
**소비하는 쪽**을 백엔드 3곳(대시보드·통계 요약·통계 Top workflows) + 프런트엔드 1곳(실행 목록
Duration 컬럼) 전수로 다시 따라갔다.

## 발견사항

- **[WARNING]** 이 PR 이 새로 채우는 `duration_ms`(대기 시간)가 프런트엔드 실행 목록의
  "Duration" 컬럼을 여전히 오염시킨다 — 이번 diff 는 백엔드 2곳만 고쳤고 프런트엔드는
  손대지 않았다
  - 위치(쓰기 쪽, 원인): `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    의 `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/
    `markQueueWaitTimeout`/`finalizeStalledExhausted` 5경로 — 취소·타임아웃 실행에 `duration_ms`
    를 처음으로 채운다(park 취소는 상한 24.8일, 위젯 idle 은 기본 grace 1시간).
  - 위치(읽는 쪽, 미수정 확인): `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx:292`
    — `{formatDuration(execution.durationMs)}`. `formatDuration`(`codebase/frontend/src/lib/utils/execution-status.ts:57`)
    은 `status` 인자를 받지 않고 ms 값만 그대로 포맷한다. `git diff origin/main --stat --
    codebase/frontend` 결과가 **빈 출력**이라 이 PR 은 프런트엔드를 전혀 건드리지 않았음을 확인했다.
  - 상세: 이 문제 자체는 새로 발견한 것이 아니라 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:184-189`
    (`10_34_51` W3 등재)가 이미 소비처 4곳(대시보드/통계 요약/통계 Top workflows/프런트 Duration
    컬럼)을 표로 나열해 뒀다. 그런데 이번 diff(커밋 `f79792621`, "fix(stats): duration_ms 를
    채우기 시작하자...")가 **표 안의 세 소비처 중 두 곳(`dashboard.service.ts`/`statistics.service.ts`)만
    실제로 고쳤다** — `dashboard.service.ts:100`, `statistics.service.ts:97,225` 세 AVG 식에
    `AND e.status = :completedStatus` / `AND e.status = 'completed'` 가드가 새로 추가돼 있고,
    `dashboard.service.spec.ts`/`statistics.service.spec.ts`에 이를 고정하는 회귀 테스트도
    함께 들어갔다(직접 확인). **하지만 같은 표의 세 번째 소비처(`executions/page.tsx:292`)는
    이번 diff 범위 밖으로 그대로 남았다** — park 로 3일 대기 후 취소된 실행이 "Duration" 컬럼에
    259,200,000ms(≈3일)로 표시되는 시나리오가 여전히 살아 있다. (같은 행에 상태 배지가
    함께 표시되긴 하나, 컬럼명이 "Duration"인 이상 대기 시간과 실행 시간의 구분은 여전히
    독자의 유추에 맡겨진다.)
  - 제안: 이번 diff 범위 밖 후속으로 유지하는 것 자체는 합리적이나(별도 스택), plan 문서와
    CHANGELOG 양쪽에 "백엔드 집계 2곳은 이 커밋에서 해소, 프런트 Duration 컬럼은 여전히
    미해소"라는 **정확한 잔여 범위**를 남길 것을 권한다 — 바로 아래 항목 참조.

- **[INFO]** plan 트래커 표가 같은 커밋에서 적용된 부분 수정(backend 2/3)을 반영하지 못해
  전체 항목이 여전히 "미해결"로 보인다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:184-192`
    (`## ⚠️ duration_ms 에 "대기 시간" 이 섞여 집계를 오염시킨다` 절의 소비처 표 및 체크박스)
  - 상세: 표는 여전히 `dashboard.service.ts:96` `avgExecutionTime`과 `statistics.service.ts:95,221`
    `avgDurationMs`를 "오염"으로, 체크박스("집계 쿼리에서 대기-시간 생성 경로를 제외...")도
    `[ ]`(미완료)로 남아 있다. `git show f79792621 -- plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    로 대조한 결과, 이 커밋은 같은 파일의 다른 절(§`markQueueWaitTimeout` 테스트 체크박스,
    타입 초크포인트 신규 항목)은 갱신했지만 **이 표 자체는 건드리지 않았다** — 코드
    수정(2곳)과 문서 상태가 어긋난 상태로 커밋됐다. 이 세션 자신의 기록된 교훈
    ("유예의 근거로 '등재했다'를 인용할 때, 그 등재를 실측하지 않았다" — 같은 파일
    §"종결 이벤트 emit 에 타입 초크포인트가 없다" 절 인용부)이 정확히 같은 형태의 재발이다:
    이번엔 반대 방향(고쳤는데 문서가 안 됐다고 말함)이라는 차이만 있다.
  - 제안: 표의 `dashboard.service.ts`/`statistics.service.ts` 행을 "해소(`f79792621`)"로
    갱신하고, 체크박스를 프런트엔드 Duration 컬럼 전용으로 좁혀 다시 쓸 것. 이렇게 두면
    "부분 완료를 전체 미완료로 오독"하거나 반대로 "부분 완료를 근거로 전체를 닫아버리는"
    두 실패 모드를 모두 막는다.

- **[INFO]** (재확인, 이번 diff 로 실제 소스에서 검증) 종결 이벤트 wire 계약 확장은 3개
  인터페이스·3개 dispatcher 캐스트 지점 전부 일관되게 동기화됨
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts`의 `EiaCompletedEvent`/
    `EiaFailedEvent`/`EiaCancelledEvent` (`durationMs?: number | null`), `chat-channel.dispatcher.ts`
    의 대응 3개 캐스트(`{ durationMs?: number | null }`), 신규 dispatcher 회귀 테스트
    (`chat-channel.dispatcher.spec.ts` `durationMs 전파` describe, 5 tests: 숫자 3종 ×
    `it.each` + null + 레거시 키부재)로 확인. 순수 필드 추가(제거·개명 없음)이고 CHANGELOG
    가 "수신자 영향"을 명시했다. 새로운 문제 없음.

- **[INFO]** (재확인) `emitCancellationEvent`(private 헬퍼) 시그니처에 `durationMs?: number | null`
  이 추가됐고, 호출부 5곳(`execution-engine.service.ts:1077,1210,2860,2909,4886`) 전부가
  이번 diff 에서 명시적으로 값을 넘긴다 — `grep -c` 실측으로 5곳 일치 재확인. private 스코프라
  외부 호출자 영향 없음.

- **[INFO]** (재확인) `cancelParkedExecution`/`markWebChatIdleTimeout`의 트랜잭션 클로저 안에서
  `cancelledDurationMs`를 먼저 대입하고 `(result.affected ?? 0) === 0`이면 조기 `return`하는
  구조를 직접 코드로 재확인했다 — 이후 `if (!cancelled) return;`가 `emitCancellationEvent` 호출
  **앞**에 있어, UPDATE 가 0행 매칭(이미 terminal/RUNNING)인 경우 `cancelledDurationMs`가
  계산돼 있어도 취소 이벤트가 발행되지 않는다. 멱등 no-op 경로에 잘못된 `durationMs`가 실릴
  side effect 는 없음.

- **[INFO]** 환경 변수·네트워크 호출·전역 변수: 이번 diff 범위(`terminal-duration.ts`,
  `execution-engine.service.ts`, `retry-turn.service.ts`, `chat-channel.dispatcher.ts`,
  `chat-channel/types.ts`, `dashboard.service.ts`, `statistics.service.ts`)에 신규
  `process.env` 읽기/쓰기, 외부 HTTP 호출, 모듈 최상위 mutable 전역 변수가 없음을 `grep`으로
  재확인. `duration_ms`를 읽는 나머지 두 자리(`alerts-evaluator.service.ts:166`은 이미
  `status = 'completed'` 필터 보유 — 우연이 아니라 원래부터 안전, `triggers.service.ts:1341`의
  `getHistory`는 평균이 아니라 `status`와 `durationMs`를 함께 반환하는 원본 목록이라 집계
  오염 클래스가 아님)도 함께 확인했다 — 새로운 위험 없음.

## 요약

직전(8차) 라운드가 WARNING 으로 남긴 크로스-모듈 side effect(취소·타임아웃 경로가 새로
채우는 `duration_ms`가 status 필터 없는 AVG 집계를 오염시키는 문제)는 이번 diff 에서
`dashboard.service.ts`/`statistics.service.ts` 두 소비처에 대해 실제로 코드 수정 +
회귀 테스트로 해소됐음을 직접 확인했다. 다만 같은 plan 트래커가 처음부터 나열해 둔 세
번째 소비처인 프런트엔드 실행 목록 "Duration" 컬럼은 이번 diff 범위 밖으로 여전히
남아 있어, 대기 시간이 실행 시간으로 표시되는 side effect 자체는 아직 살아 있다 — 그
자체를 이 라운드에서 처리하라는 요구는 아니지만, plan 트래커의 소비처 표/체크박스가
이 부분 완료를 반영하지 못한 채 그대로 남아 있어 "전부 미해결" 또는 "이미 해결"
어느 쪽으로도 오독될 수 있는 문서-코드 drift 를 새로 만들었다. 그 외 시그니처 확장
(`emitCancellationEvent` 옵션 필드), wire 인터페이스 확장(`durationMs?: number | null`
3종 동기화), 트랜잭션 가드 로직은 전부 소스 레벨로 재확인했고 새로운 문제를 발견하지
못했다. 환경 변수·네트워크 호출·신규 전역 변수는 없다.

## 위험도

MEDIUM
