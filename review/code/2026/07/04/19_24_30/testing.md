# 테스트(Testing) Review — priority 3-tier (triggerType threading)

## 검증 메모

payload 는 `git diff origin/main...HEAD` 와 코드/스펙 변경분(파일 1~8)이 정확히 일치 — mis-scope 아님. 단, 대상 커밋 이력을 확인한 결과 이번 diff 의 실질 코드(`execution-engine.service.ts`/`.spec.ts`, `hooks.service.ts`/`.spec.ts`, `schedule-runner.service.ts`/`.spec.ts`)는 이미 동일 세션 계보의 이전 리뷰(`review/code/2026/07/04/19_02_17`)가 검토했고, 그 세션 자체의 산출물(SUMMARY/RESOLUTION/testing.md 등, 파일 9~13)과 그 W1 조치 커밋(`73af2682c`, 주석 1줄)까지 이번 diff 범위에 포함돼 있다. 그 위에 추가된 유일한 후속 커밋(`190c4060f`)은 spec/consistency 문서 전용(코드·테스트 파일 변경 0)이다. 따라서 테스트 관점에서 새로 나타난 코드 변경은 없으며, 아래는 기존 코드/테스트 diff 에 대한 독립 재검증 결과다 (이전 세션 결론과 부합).

## 발견사항

- **[INFO]** chat-channel XFF 테스트가 `triggerType` regression 을 assert 하지 않음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:689-699` (`'chat-channel: x-forwarded-for 헤더 있으면 sourceIp 가 execute options 로 전달된다 (W-12)'`)
  - 상세: 같은 호출부(`hooks.service.ts` chat-channel 분기, 파일 4 diff L235 부근)에 `triggerType: 'webhook'` 이 신규 추가됐고, 인접 테스트(`hooks.service.spec.ts:647-656`, "비활성 아닌 chatChannel 정상 202" 계열)는 이를 `objectContaining` 목록에 포함해 검증하도록 diff 로 갱신됐다. 그러나 XFF 전용 테스트(라인 666 `it` 블록)는 동일 호출부를 재검증하면서도 `expect.objectContaining({ triggerId, sourceIp, responseCode })` 에 `triggerType` 을 포함하지 않는다 — `objectContaining` 은 나열되지 않은 키를 검사하지 않으므로, 이 테스트만 놓고 보면 `triggerType: 'webhook'` 이 이 호출부에서 실수로 제거돼도 실패 신호를 주지 못한다.
  - 근거: 값이 리터럴 상수이고 같은 호출부(같은 코드 라인)를 검증하는 형제 테스트가 이미 커버하므로 실질 회귀 갭은 낮음. 기능 결함 아님.
  - 제안: 일관성을 위해 `triggerType: 'webhook'` 1줄 추가 권장(선택 사항, 낮은 비용).

- **[INFO]** `execute()` 내부 fallback(`?? 'webhook'`)과 `resolveExecutionRunPriority` 내부 fallback(`undefined → 'schedule'`)의 비대칭이 통합 시나리오 테스트로 명시되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`options?.triggerType ?? 'webhook'`) vs `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` (`resolveExecutionRunPriority` 의 `undefined` 분기 → `schedule`)
  - 상세: `execute()` 는 항상 문자열로 정규화한 값을 `resolveExecutionRunPriority` 에 넘기므로 `resolveExecutionRunPriority(undefined)` 분기는 이 콜러 경로에서 절대 실행되지 않는(dead) fallback 이다. `execution-run.queue.spec.ts` 의 순수 함수 테스트와 `execution-engine.service.spec.ts` 의 신규 threading 테스트가 각각 자기 계층에서는 정확하지만, 두 계층의 "모름" 기본값이 다르다는 설계 의도(webhook vs schedule, 서로 다른 방어 목적)를 교차 확인하는 테스트/주석은 없다.
  - 제안: 필수는 아님. 리팩터링 시 두 fallback 을 실수로 "통일"하지 않도록 주석 또는 짧은 통합 코멘트로 남겨도 좋음(INFO, 선택).

## 검증한 항목 (문제 없음)

- 신규 테스트 `'triggerType threading — manual>webhook>schedule 3-tier + fallback (PR2)'` (`execution-engine.service.spec.ts:3022-3045`) 는 webhook/schedule/미지정(fallback) 3 케이스 + 순서 불변식(`manual < webhook < schedule`)을 한 테스트 안에서 명확히 검증. `asRecorder()` 로 큐 mock 을 매 호출 성공시키고 `mock.calls[i][2]` 인덱스로 각 호출의 옵션을 분리 — 가독성 양호, 다른 `it` 블록과 상태 공유 없음(외곽 `beforeEach` 가 모듈 전체 재생성).
- 프로덕션 `execute()` 호출부(webhook/chat-channel/schedule cron 3곳 `triggerId` variant, `schedules.service.runNow` 등 `executedBy` variant)를 전수 확인 — `triggerType?: never` 판별 유니온이 컴파일 타임에 `executedBy` variant 쪽 오용을 차단해, 해당 경로는 애초에 회귀 테스트가 불필요(타입 시스템이 보장).
- `schedules.service.spec.ts` 의 기존 `runNow` 테스트(`{ executedBy: 'user-1' }`, `triggerType` 미기재)는 diff 밖 — 변경 없이 그대로 유효한 회귀 가드로 남음(union 타입상 `triggerType` 부여 자체가 컴파일 에러이므로 테스트도 정합).
- `resolveExecutionRunPriority`/`EXECUTION_RUN_PRIORITY` 자체의 순수 함수 단위 테스트(`execution-run.queue.spec.ts`)는 이번 diff 이전부터 존재(pre-existing) — mock 없이 로직만 검증하는 좋은 구조이며 `undefined` 입력 케이스도 이미 커버.
- `hooks.service.spec.ts`/`schedule-runner.service.spec.ts` 갱신 3곳은 실제 프로덕션 트리거 발화 경로(webhook, chat-channel, schedule cron) 각각에 대응하며 mock 대상(`engine.execute`)이 실제 시그니처와 일치 — mock 이 실제 동작과 괴리되는 부분 없음.

## 요약

이번 diff 의 테스트 변경은 3-tier priority 로직의 핵심 불변식(manual > webhook > schedule, 미지정 fallback)과 3개 실제 호출부(webhook/chat-channel/schedule) 전부를 회귀 테스트로 명확히 커버하며, 판별 유니온 타입(`triggerType?: never`)이 `executedBy` 경로의 오용을 컴파일 타임에 차단해 별도 런타임 테스트 필요성을 낮춘다. 발견된 두 항목은 모두 INFO 수준 — 하나는 `objectContaining` 사용으로 인한 특정 XFF 테스트의 미세한 회귀 방지력 저하(형제 테스트가 이미 커버), 다른 하나는 두 계층 fallback 비대칭에 대한 설계 의도 문서화 부족이며 둘 다 기능적 결함이 아니다. 또한 이번 코드/테스트 diff 자체는 동일 계보의 선행 리뷰(`19_02_17`)가 이미 Critical/Warning 0 으로 검증했고 그 조치 커밋까지 diff 범위에 포함돼 있어 신규 코드 변경은 없음을 확인했다(후속 커밋은 문서 전용). 전체적으로 테스트 용이성(판별 유니온으로 인한 타입 차단), 테스트 격리(단일 `it` 블록 내 순차 호출 인덱싱), 가독성 모두 양호하다.

## 위험도

LOW
