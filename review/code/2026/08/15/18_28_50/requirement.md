# 요구사항(Requirement) Review — 종결 emit 타입 초크포인트 + retry-turn `cancelledBy` 흡수

## 검토 범위 메모

이 diff 는 `codebase/` 5개 소스 파일(파사드 도입 + 11곳 이관 + `retry-turn` `cancelledBy` 결함
흡수)에, **동일 세션의 이전 `/ai-review` 라운드(`17_54_32`, CRITICAL 0 / WARNING 7)의 산출물과
그 라운드가 만든 fix-up 커밋(`b7c22d922`)까지 포함된 누적 diff**다. 즉 이번 라운드가 처음 보는
코드가 아니라, 이미 한 차례 검토·수정된 최종 상태를 다시 검토하는 것이다. 아래는 (a) 이전
라운드 WARNING 7건이 실제로 해소됐는지 저장소 현재 상태로 재검증하고, (b) 그 라운드가 못 보던
새 결함이 있는지 독립적으로 점검한 결과다.

## 검증한 것 (결함 없음 확인)

- **facade 구현 정확성**: `execution-event-emitter.service.ts` `emitTerminalExecution` 이
  `type` 에서 `eventType`/`status` 를 파생하고, `failed` 는 `error` 를, `cancelled` 는
  `result: {cancelledBy}` + 조건부 `error` 를 조립한다 — `spec/5-system/14-external-interaction-api.md`
  §6 필드 집합 표·§6.5 행동 계약과 line-level 로 일치(직접 파일 열람으로 재확인, diff 와 동일).
- **직접 호출 이관 완전성 재확인**: `grep -n "EXECUTION_COMPLETED\|EXECUTION_FAILED\|EXECUTION_CANCELLED"` 로
  `execution-engine.service.ts`/`retry-turn.service.ts` 를 전수 검사 — 리터럴 직접 참조는 주석뿐이고
  실제 emit 호출은 모두 `emitTerminalExecution`(12곳: engine 8 + retry-turn 4) 경유. 잔존
  `emitExecution` 직접 호출 3곳(`execution-engine.service.ts:3017,4436,6134`)은 `EXECUTION_STARTED`
  ×2 / `EXECUTION_MESSAGE` ×1 로 종결 3종 밖 — 파사드 범위 밖 서술과 정확히 일치.
- **`retry-turn-terminal-guard.md` #2 흡수 실질 확인**: `failRetryExecution`(`retry-turn.service.ts:981-995`)의
  cancelled 분기가 `cancelledBy: 'user'` 를 명시적으로 채운다. 근거(트리거가
  `ExecutionCancelledError` 로 취소 주체 미상 → §6.5 규칙상 `error` 미동행이 곧 `'user'` 와
  자기정합 → 자매 `finalizeCancelledExecution` 도 동일값)가 코드 주석에 남아 있고, 실제로
  `finalizeCancelledExecution` 호출부(`execution-engine.service.ts:4945`)도 `cancelledBy: 'user'`.
- **소비자 영향 검증**: `chat-channel.dispatcher.ts:533,587` 이 `(event.payload as ...).result ?? {}`
  로 `result` 부재를 방어 — CHANGELOG 의 "저장소 내 소비자는 무해" 주장이 코드로 확인됨.
- **판별력 주장 실측 재확인**: `python3 scripts/check-backend-typecheck-ratchet.py` 실행 결과
  `199건 / 38파일 — baseline 과 일치`. plan/RESOLUTION 이 주장하는 "cancelledBy 제거 시
  199→200" 강제 메커니즘(tsc ratchet, jest 아님)이 실제로 존재하고 baseline 파일 수치도 일치.
- **테스트 통과 재실행**: `npx jest execution-event-emitter.service.spec.ts`(10 passed),
  `npx jest retry-turn.service.spec.ts`(44 passed) 모두 GREEN.
- **이전 라운드 WARNING 7건 해소 재검증** (저장소 현재 상태 직접 열람, RESOLUTION.md 주장을
  액면 그대로 받지 않음):
  - W4(scope, 클래스 JSDoc 삭제) — `execution-event-emitter.service.ts:51-67` 에 원본 클래스
    docstring("C-6 strangle step 1" 등)이 복원돼 있고, 타입 JSDoc(11-30줄)은 타입 위에 분리됨.
  - W1(documentation, CHANGELOG 누락) — `CHANGELOG.md:3-18` 에 신규 섹션 존재, wire 변화
    ("`result.cancelledBy: 'user'` 신규 emit")와 수신자 영향을 명시.
  - W2(documentation, 취소선 절반) — `retry-turn-terminal-guard.md:311-321` 옛 문단 전체가
    `~~...~~` 로 취소선 처리되고 안내 문장이 붙음.
  - W3(requirement, SoT 표 #2 행 미갱신) — `retry-turn-terminal-guard.md:372` 표 #2 행이
    "**P2 완료**" + 근거 링크로 갱신됨(이전 라운드 requirement reviewer 가 지목한 정확한 위치).
  - W5(maintainability/testing, `TYPE_TO_EVENT` 중복) — `retry-turn.service.spec.ts:49-53` 모듈
    스코프 단일 선언, 두 헬퍼(`:799`,`:966`)가 공유.
  - W6(testing, 판별력 주석 오류) — 현재 스펙 주석(`execution-event-emitter.service.spec.ts:34-40`)이
    "jest 는 no-op, 실제 강제는 tsc 래칫" 으로 정정돼 있고 해당 주장은 위에서 직접 재현 확인.
  - W7(architecture, 순환 import) — 근본 해소는 아니지만 `spec-sync-external-interaction-api-gaps.md`
    에 신규 항목으로 등재됨(호도·은폐 아님, plan 자신도 "미해소" 로 정직하게 표기).
  → 7건 전부 코드/문서 현재 상태로 실측 재확인, 재발/거짓 완료 표시 없음.
- **TODO/FIXME/HACK/XXX**: 이번 diff 의 5개 코드 파일에 없음(재확인).

## 발견사항

- **[INFO]** `TerminalEventPayload` 의 `cancelled.error` 가 spec §6.5 의 "optional" 명시보다 코드가
  더 엄격하다 (기존 라운드가 이미 식별·처분한 항목의 잔존 확인 — 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:48`
    (`error?: { code: string; message: string }`)
  - 상세: `spec/5-system/14-external-interaction-api.md` "`execution.cancelled` 의 행동 계약"
    절은 "시스템 취소는 `error?: { code, message? }` 를 동행한다"고 적어 `message` 를 optional 로
    규정한다. 코드 타입은 `message: string` 을 필수로 강제한다. 시스템/타임아웃 취소 3개 호출부
    (`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`, `execution-engine.service.ts:1206,2852,2901`)
    전부 리터럴로 `code`+`message` 를 채우므로 런타임 결함은 아니다. spec 이 code 보다 느슨한
    방향의 불일치라 CRITICAL 대상이 아니며, `project-planner` 재량으로 spec 문구를 "message 는
    현재 전 경로 필수" 로 좁힐지 결정하면 된다.
  - 제안: 코드 유지. spec 갱신 여부는 planner 재량(이전 라운드 RESOLUTION 도 동일 결론으로
    "무조치" 처분함 — 재확인 결과 이견 없음).

## 요약

핵심 변경(`ExecutionEventEmitter.emitTerminalExecution` 판별 union 파사드 도입, 종결 3종
직접 호출 12곳 전수 이관, `retry-turn.service.ts` `failRetryExecution` 의 선존 `cancelledBy`
누락 결함 흡수)은 `spec/5-system/14-external-interaction-api.md` §6/§6.4/§6.5 와 line-level 로
정합하며, 판별력(필수 필드 강제)은 jest 가 아니라 `tsc` 타입 래칫 게이트로 실제로 강제됨을
재실행으로 확인했다. 이 diff 는 동일 세션 이전 `/ai-review` 라운드의 WARNING 7건(문서 삭제 사고,
판별력 주장 오류, CHANGELOG 누락, plan SoT 표 미갱신, 테스트 헬퍼 중복 등)을 이미 흡수한 최종
상태이며, 저장소 현재 파일을 직접 열람해 그 해소를 하나씩 재확인했고 거짓 완료 표시나 재발은
없었다. 잔존하는 유일한 항목은 이전 라운드가 이미 식별·"무조치" 로 처분한 INFO(코드가 spec 보다
엄격한 `cancelled.error.message` 필수화)뿐이며 신규 결함이 아니다. Critical/Warning 급 요구사항
결함 없음.

## 위험도
NONE
