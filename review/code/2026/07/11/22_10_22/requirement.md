# 요구사항(Requirement) 리뷰 — reaper/engine DRY 리팩터 + WebChat naming 정렬

대상 커밋: `407ad70eb` (`plan/in-progress/refactor-reaper-dry.md` 가 SoT). 스코프: (1) `Webchat`→`WebChat`
식별자 4종 rename, (2) `processInBatches` bounded-concurrency 헬퍼 추출(W4), (3)
`emitCancellationEvent` private 헬퍼로 emit try/catch/warn 통합(W3). "동작 무변경(behavior-preserving)"
을 명시적으로 표방.

## 검증 방법

- `grep -rn "Webchat" codebase/ spec/` — 전역 0건 (rename 누락 없음, 파일명/큐 문자열/env 는 원래 전부 소문자라 불변).
- `npx tsc --noEmit -p tsconfig.build.json` — 0 errors (프로덕션 코드 클린 컴파일).
- 관련 5개 spec 파일 직접 `jest` 실행 — `process-in-batches.spec.ts`, `interaction-token.service.spec.ts`,
  `webchat-idle-reaper.service.spec.ts`, `webchat-idle-reaper.types.spec.ts`,
  `execution-engine.service.spec.ts` → **5 suites / 470 tests 전부 PASS**.
- `emitCancellationEvent` 4개 호출부(`cancelParkedExecution`·`markExecutionCancelled`·
  `markQueueWaitTimeout`·`markWebChatIdleTimeout`) 각각의 원본 payload(`cancelledBy`·`error` 유무)를
  diff 대조 — 전부 원본과 동일하게 보존됨(`cancelParkedExecution` 만 `error` 미포함 — helper 의
  `...(opts.error ? {error} : {})` 로 정확히 재현).
- `processInBatches` 순서 보존 계약(`results[i]` ↔ `items[i]`) — 두 호출처(`rows[idx]`·`executionIds[idx]`)
  모두 flatten 된 전체 인덱스로 정확히 매핑됨을 코드 추적으로 확인.

## 발견사항

- **[INFO]** 계획서(`refactor-reaper-dry.md`)가 명시한 3개 스코프(naming·W4·W3) 외에 미문서화된 부수 변경 존재.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:756-757`
  - 상세: `verify(jwtPart, this.secret, {...}) as { sub?: unknown; aud?: unknown; jti?: unknown }` 의
    `as` 캐스트가 제거됨. `payload` 변수가 이미 동일 타입으로 `let` 선언돼 있어 컴파일에는 문제 없음
    (`tsc --noEmit -p tsconfig.build.json` 0 errors 로 확인) — 순수 잉여 타입 단언 제거로 런타임 영향 없음.
    다만 커밋 메시지·plan 은 이 변경을 언급하지 않아 "무엇을 왜 바꿨는지" 추적성이 약함.
  - 제안: 다음 리팩터 커밋 시 이런 drive-by 정리는 별도 라인으로 명시하거나 별 커밋으로 분리 권장(기능 영향 없어 blocking 아님).

- **[INFO]** 테스트 제목이 실제 커버리지보다 넓게 주장.
  - 위치: `codebase/backend/src/common/utils/process-in-batches.spec.ts:87-93`
  - 상세: `'concurrency 0/음수는 1(직렬)로 floor 되어 무한 루프를 피한다'` 테스트가 실제로는 `concurrency=0`
    한 값만 검증하고 음수(`-1` 등) 케이스는 파라미터화되지 않음. 구현(`Math.max(1, Math.floor(concurrency))`)은
    0/음수 모두 동일 경로라 실질 결함은 아니나, 제목이 주장하는 커버리지와 실제 assertion 사이 괴리.
  - 제안: `it.each([0, -1, -100])` 로 확장하면 제목과 커버리지가 정확히 일치.

- **[INFO]** 로그 메시지 워딩 미세 변경(기능·테스트 영향 없음).
  - 위치: `execution-engine.service.ts` `emitCancellationEvent` vs 원본 `markExecutionCancelled` catch 블록.
  - 상세: 원본은 `"cancel 은 DB 에 반영됨"`(조사 "에" 포함)이었으나 통합 헬퍼는 `"cancel 은 DB 반영됨"`(조사 생략)으로
    4개 호출부에 공통 적용됨. 테스트는 `stringContaining('emit 실패')` 부분 문자열만 검증해 회귀 없음
    (`execution-engine.service.spec.ts:2991` 확인).
  - 제안: 조치 불요 — 운영 로그 가독성에 미치는 영향이 무시할 수준.

- **[WARNING]** `plan/in-progress/refactor-reaper-dry.md` frontmatter `spec_impact: - none` 이 diff 사실과
  이미 불일치.
  - 위치: `plan/in-progress/refactor-reaper-dry.md` frontmatter, vs 파일 14~18
    (`spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/1-widget-app.md`,
    `spec/7-channel-web-chat/3-auth-session.md`, `spec/data-flow/0-overview.md`,
    `spec/data-flow/15-external-interaction.md`).
  - 상세: 이번 커밋은 `WebchatIdleReaperService`→`WebChatIdleReaperService` 등 클래스명 언급을 5개
    spec 문서에서 실제로 동기화했다(코멘트성 naming sync, 신규 요구사항 아님). `.claude/docs/plan-lifecycle.md §5`
    에 따르면 `spec_impact` 는 **완료(Gate C) 시점에만 강제**되므로 in-progress 단계에서는 build guard 위반은
    아니다. 다만 지금 상태 그대로 `plan/complete/` 로 이동하면 `spec_impact: none` 이 실제로는 5개 spec 파일을
    건드린 사실과 모순되는 오기재로 굳어진다.
  - 제안: 완료(Gate C) 이동 직전 frontmatter 를 `spec_impact:` 리스트로 갱신
    (`spec/5-system/14-external-interaction-api.md` 등 5개 경로 나열) — 코드 수정이 아니라 문서 정합 조치이므로
    `project-planner`/plan 소유자가 완료 처리 시 반영.

## 요구사항 충족 관점 평가

계획서가 스코프로 명시한 3항목(naming 정렬·`processInBatches` 추출·`emitCancellationEvent` 추출) 모두
정확히 구현됐고, "동작 무변경" 주장은 (a) 전역 grep 으로 잔존 `Webchat` 식별자 0건, (b) 프로덕션 tsc 클린,
(c) 관련 5개 spec 파일 470 테스트 전부 green, (d) 4개 emit 호출부 payload 대조 로 실증됐다. wire 계약
(큐 이름 `webchat-idle-reaper`, env `WEBCHAT_IDLE_REAP_*`, error.code `WEBCHAT_IDLE_TIMEOUT`, 파일명)도
계획서 약속대로 전부 불변이며, spec 문서(EIA §14, widget-app, auth-session, data-flow 2건)의 클래스명
언급도 코드와 동기화됐다. 발견된 항목은 모두 INFO 수준의 사소한 워딩/커버리지 갭이거나, 절차상 완료 시점에
바로잡으면 되는 WARNING(빈 스코프 재확인용 `spec_impact` 갱신) 하나뿐이며 기능적 결함이나 spec-코드 불일치는
없다. 계획서에서 명시적으로 기각한 두 항목(full W3 4-into-1, `MinuteRepeatableSweepWorker` 추상클래스)도
diff 에 등장하지 않아 스코프 이탈이 없음을 확인했다.

## 위험도

LOW
