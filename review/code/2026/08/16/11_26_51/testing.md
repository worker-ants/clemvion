# 테스트(Testing) 리뷰

## 컨텍스트 (실측)

이번 라운드(`11_26_51`)가 받은 프롬프트는 브랜치 누적 diff(`origin/main..HEAD`, 67개 파일)라
`terminal-error-payload.spec.ts`/`terminal-error-payload.ts`/`sanitize-error-message.ts` 가
전부 "변경된 코드"로 보이지만, 실제 **이번 라운드의 델타**(직전 `11_04_07` 라운드 이후 신규
커밋)는 `5d4d8dab7` 단 하나다. `git log --oneline -- codebase/backend/src/shared/utils/terminal-error-payload.spec.ts`
로 확인한 결과 그 파일은 `fb4a70b72`(10_41_55 라운드) 이후 커밋이 없다 — 즉 테스트 코드
자체는 이번 라운드에서 한 글자도 바뀌지 않았다. `git show --stat 5d4d8dab7` 로 실제 변경분을
확인하면 `codebase/**` 쪽은 `sanitize-error-message.ts`(JSDoc) 뿐이고, 로직(`redactSecrets`
호출·정규식·분기)은 diff 0줄이다. 나머지는 `plan/in-progress/*.md` 체크박스 정정과 이전
라운드(`11_04_07`) 산출물 커밋뿐이다.

## 실측 검증

- `codebase/backend` 에서 `npx jest src/shared/utils/terminal-error-payload.spec.ts
  src/modules/execution-engine/queues/background-execution.processor.spec.ts` 직접 실행 —
  **36/36 PASS** (26 + 10). 이번 delta 가 로직을 안 건드렸으므로 회귀 없음을 재확인.
- `sanitize-error-message.ts`(execution-engine) 의 새 JSDoc 표("호출부 실측 3곳: `execution-engine.service`
  / `schedule-runner.service` / `background-execution.processor`")가 실제 코드와 맞는지
  `grep -rln "sanitizeErrorMessage" codebase/backend/src --include="*.ts" | grep -v spec.ts` 로
  대조 — 정확히 그 3개 파일만 나온다. 문서 서술이 코드보다 넓지 않음을 확인.
- 그 표가 새로 주장하는 내용 — "`background-execution.processor` 는 알림 문구뿐 아니라 내부 WS
  채널(`background:run:<id>`)의 `errorMessage` 에도 싣는다" — 이 실제로 회귀 테스트로 잠겨
  있는지 확인: `background-execution.processor.spec.ts:160-175` 가
  `postgres://user:secret@db.internal:5432/app` + stack trace + 500자 초과 문자열을 던져
  `failedPayload.errorMessage` 가 `[REDACTED_URI]`/stack 제거/길이 상한을 모두 만족하는지
  단언한다. 즉 이번에 정정된 JSDoc 서술은 근거 없는 주장이 아니라 이미 존재하는 테스트가
  뒷받침하는 사실이다.

## 발견사항

- **[INFO]** (전 라운드 `11_04_07` 로부터 이월, 이번 라운드 신규 발생 아님) 5개 실제 emit
  호출부(`execution-engine.service.ts`, `retry-turn.service.ts`, `chat-channel.dispatcher.ts`)
  에서 `toTerminalErrorPayload` 를 거쳐 나가는 실제 WS/SSE/webhook payload 가 마스킹되는지
  검증하는 통합 테스트가 여전히 없다 — 순수 함수 단위 테스트(`terminal-error-payload.spec.ts`)만
  존재한다.
  - 위치: 함수 `toTerminalErrorPayload`(`codebase/backend/src/shared/utils/terminal-error-payload.ts:122`), 소비처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`, `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
  - 상세: `RESOLUTION.md`(`review/code/2026/08/16/11_04_07/RESOLUTION.md`)가 "의도적 무조치"로
    명시하며 근거로 단위 레벨 뮤테이션 7/7 RED(마스킹 제거 5/5 + code/nodeId 마스킹 2/2, `10_41_55`
    RESOLUTION 검증표) 와 side_effect 리뷰어의 fanout 경로 독립 확인을 든다. 이번 라운드는 그
    호출부 코드를 전혀 건드리지 않았으므로 새로 생긴 갭이 아니고, 5라운드째 `codebase/**` 를 또
    건드려 재리뷰를 유발하지 않겠다는 판단도 타당하다. 순수 함수 커버리지가 이미 두터워
    (26개 케이스, adversarial 입력 포함) 배선 실수 가능성 자체는 낮다.
  - 제안: 강제 조치 불요. plan 후속으로 이미 등재되어 있으니 그대로 둔다.

- **[INFO]** (동일 출처, 이월) `chat-channel.dispatcher.ts` 의 `toTerminalErrorPayload` 이중
  재적용이 fixed-point(idempotent)임을 고정하는 캐너리 테스트가 없다.
  - 위치: 함수 `redactTerminalError`(`codebase/backend/src/shared/utils/terminal-error-payload.ts:107`), 소비처 `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`
  - 상세: 위와 같은 이유로 이번 라운드 델타 밖이며, `SECRET_LEAK_PATTERNS` 가 확장돼 우연히
    `***` 자체나 마스킹된 형태를 다시 매칭하는 비-idempotent 패턴이 추가될 때만 실제로
    발현되는 잠재 리스크라 우선순위가 낮다는 이전 판단에 동의한다.
  - 제안: 강제 조치 불요.

## 회귀·격리·가독성 (변경 없음 재확인)

- 이번 델타는 주석/plan 문서뿐이라 테스트 스위트·mock·fixture 어느 것도 건드리지 않았다.
  `terminal-error-payload.spec.ts` 26개 케이스(null/undefined·레거시 문자열·스칼라
  3종·symbol·타입가드 3필드·details 3분기·secret 마스킹 6종·잔여 갭 캐너리 2종)와
  `background-execution.processor.spec.ts` 의 WS 마스킹 회귀 케이스 모두 이전과 동일하게
  통과한다 — mock 없이 실제 `deepRedactSecrets`/`redactSecrets`(shared SoT)를 그대로 태우는
  구조라 mock-실동작 괴리가 없고, 각 테스트가 리터럴을 새로 만들어 써서 상태 공유·flaky 위험도
  없다.
- `spec-sync-external-interaction-api-gaps.md` 체크박스 정정(§ 자격증명 없는 연결 문자열
  잔여 갭)은 이미 `terminal-error-payload.spec.ts:211-217`("자격증명 **없는** 연결 문자열·
  호스트명은 통과한다")이 캐너리로 고정해 둔 사실을 문서로 확정한 것뿐이라 테스트 관점에서
  추가 조치가 불필요함을 재확인.

## 요약

이번 라운드(`11_26_51`)가 받은 프롬프트는 브랜치 전체 누적 diff라 테스트 파일이 대량으로
"변경"된 것처럼 보이지만, `git log`/`git show --stat` 로 대조하면 실제 델타는 JSDoc/plan
문서 정정 커밋(`5d4d8dab7`) 하나뿐이고 `.spec.ts`/로직 코드는 0줄 변경이다. 정정된 JSDoc 의
새 주장("background-execution.processor 는 WS 에도 싣는다")은 실측(grep)과 기존 회귀 테스트
(`background-execution.processor.spec.ts`)로 이미 뒷받침되는 사실이라 문서-코드 정합성
문제가 없다. `npx jest` 로 직접 재실행해 관련 스위트 36/36 PASS 를 확인했다. 신규 Critical/
Warning 은 없으며, 이전 라운드부터 의도적으로 무조치 처리된 INFO 2건(통합 emit 회귀·idempotence
캐너리)만 그대로 이월된다 — 둘 다 이번 델타와 무관하고 근거가 타당하다.

## 위험도

NONE
