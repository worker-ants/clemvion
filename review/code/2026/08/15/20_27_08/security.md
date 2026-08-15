# Security Review

## 변경 개요

`origin/main...HEAD` 전체 diff(73개 파일)는 두 층으로 구성된다.

1. **코드 변경 (backend, 약 26개 소스/spec 파일)**: `websocket.service.ts` 가 함께 export 하던
   런타임 값(enum)·타입 정의를 의존성-프리 신규 모듈
   `codebase/backend/src/modules/websocket/websocket-events.types.ts` 로 추출하고, 소비 지점의
   import 경로를 갱신한 **순수 리팩터**(#1174 ES-module 순환 회귀 방지 목적). 유일하게 런타임
   동작이 바뀌는 지점은 `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 를 호출-시점
   파생에서 모듈-스코프 상수로 되돌린 부분이며, 계산 결과(shape)는 동일하다.
2. **문서/프로세스 산출물 (plan/review/spec, 나머지 파일)**: 이전 두 라운드
   (`review/code/2026/08/15/19_27_37`, `20_05_17`) 의 자체 코드 리뷰 산출물과 그 RESOLUTION,
   `review/consistency/2026/08/15/{18_53_27,20_05_19}` consistency-check 산출물, plan 문서 갱신,
   `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록 1줄 — 코드 실행에 영향 없는
   마크다운/JSON.

이 작업 라인은 이미 이 저장소 자체 프로세스로 2회의 독립 security 리뷰(`19_27_37/security.md`,
`20_05_17/security.md`)를 거쳤고 둘 다 위험도 NONE 으로 판정했다. 이번 라운드에서는 그 두 라운드가
남긴 처분(특히 `20_05_17` W1 — `ExecutionChannelEvent` 3곳 `import type` 누락, `19_27_37` W4 —
WARN #10 credential 마스킹 JSDoc 고아화)이 최신 커밋(`a6d764ac6`)에서 실제로 반영됐는지를 현재
소스에서 직접 재확인했고, 그 외 net-new 코드 변경이 없는지 `git diff origin/main...HEAD` 로 재검증했다.

## 검증 (직접 소스 대조)

- `chat-channel.dispatcher.ts:11`, `notification-fanout.service.ts:11`, `sse-adapter.service.ts:8`
  — 전부 `import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';` 로
  수정되어 있음을 `grep` 으로 확인 (직전 라운드 W1 반영 확인).
- `websocket.gateway.ts:23` — `import { ExecutionEventType } from './websocket-events.types';` 로
  전환되어 있음을 확인. gateway 는 더 이상 `websocket.service` 를 값으로 참조하지 않는다
  (`19_27_37` W1 이 지적했던 순환 당사자 노드 누락이 이미 해소된 상태 유지).
- `websocket.service.ts:52-59` — WARN #10 (Security, credential-like 키 마스킹) JSDoc 이
  `CREDENTIAL_KEY_PATTERN` 선언 바로 위에 정확히 위치. `websocket-events.types.ts` 를 `grep` 한
  결과 "WARN #10" 문자열이 더 이상 이 신규 타입 전용 모듈에 없음을 확인 — 구현 없는 고아 주석
  결함(`19_27_37` W4)이 해소된 상태로 유지되고 있다.
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `grep -c "^import"` = 0.
  이 모듈은 여전히 "의존성-프리(값/타입 선언 전용)" 계약을 지키고 있으며, 이는 순환-위-모듈-스코프
  파생이 `undefined` 로 평가되던 근본 원인(#1174)에 대한 안전장치의 전제 조건이다.
- `execution-event-emitter.service.ts` — `TERMINAL_SHAPE[payload.type]` 파생과
  `emitTerminalExecution` 의 `wire.error = payload.error` / `wire.result` 조립 로직은 이번 diff 로
  값·순서가 바뀌지 않았다(리터럴 인라인 → 모듈 상수 참조로 형태만 변경). §6/§6.5 계약(닫힌 3값
  union, user-cancel 시 `error` 키 자체 부재)도 그대로 보존.
- `git diff origin/main...HEAD -- codebase/` 를 하드코딩 시크릿 패턴(비밀번호/토큰/API 키
  리터럴 대입, PEM 헤더, AWS access key 형태)으로 재스캔 — 매치 0건.

## 발견사항

- **[INFO]** `emitTerminalExecution` 의 `failed`/`cancelled` 종결 이벤트가 `payload.error`
  (`TerminalErrorPayload`)를 가공 없이 `wire.error` 에 실음 — 이번 diff 의 변경 범위가 아닌
  기존 설계, 참고용 재기재
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (`emitTerminalExecution` 메서드, `wire.error = payload.error` 대입부)
  - 상세: 이 대입 로직 자체는 이번 diff 에서 손대지 않았다(변경은 `TERMINAL_SHAPE` 를 모듈
    스코프로 끌어올린 것뿐, 계산 결과는 동일). 이후 `emitExecution` → `websocketService.
    emitExecutionEvent` 경로에서 `sanitizePayloadForWs`(credential-key 패턴 마스킹, depth 상한)와
    외부 fanout 시 `stripExternalOnlyFields` 를 거치므로 credential-key 패턴에 해당하는 키는
    가려지지만, `payload.error` 안에 담긴 임의 에러 메시지/스택 조각 자체가 `sanitizeErrorMessage`
    계열 유틸을 통과하는지는 호출부(어떤 노드/실행 경로가 `TerminalErrorPayload.error` 를 채우는가)
    에 달려 있다. 이 축은 이미 `19_27_37/security.md` 에서 동일하게 INFO 로 지적·기록됐고 이번
    라운드에서도 로직 변경이 없어 새 결함이 아니다.
  - 제안: (이번 PR 범위 밖) `TerminalErrorPayload.error` 를 채우는 모든 호출부가
    `sanitizeErrorMessage` 계열 유틸을 거치는지 별도 turn 에서 전수 확인 — 이미 저장소에
    `background-execution.processor.ts` 주석("에러 메시지 새니타이징은 top-level 실행 실패 경로와
    공유하는 단일 util 로 둔다")이 이 방향의 관례를 명시하고 있으므로, 그 관례가 종결 이벤트 경로
    전체에 일관 적용되는지 확인하는 정도의 낮은 비용 후속 작업.

- **[INFO]** `websocket.service.ts` 가 credential 마스킹 로직·enum 값을 그대로 re-export 하는
  하위호환 facade — 잠재적 회귀 표면이지만 이미 자동 가드로 방어됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` (상단 re-export 블록)
  - 상세: 향후 신규 코드가 부주의로 enum 값을 `'.../websocket.service'` 에서 값으로 다시
    import 하면 ES-module 순환에 재편입될 수 있다는 리스크가 있으나,
    `websocket-events.types.spec.ts`(이번 diff 신설, TS 파서 기반 5개 모듈-간선 형태 전수 스캔,
    뮤테이션 6/6+M7~M11 RED 검증됨)가 저장소 전체 파일 트리에 대해 이 패턴을 정적으로 fail-closed
    시키므로 실질적 방어가 이미 확보돼 있다. 신규 조치 불요 — 참고 기록.

## 요약

이번 diff 는 WebSocket 이벤트 enum/타입 선언을 순환 참조 회피 목적의 의존성-프리 모듈로 옮기는
기계적 리팩터이며, 신규 엔드포인트·사용자 입력 처리 경로·인증/인가 로직·암호화·평문 전송·시크릿
관리 변경이 전혀 없다. 기존 보안 통제(credential-key 패턴 마스킹 `sanitizePayloadForWs`, 외부
fanout 필드 strip `stripExternalOnlyFields`, depth 상한을 통한 정보 누출/DoS 방지)는 원본
`websocket.service.ts` 에 문자 그대로 보존되어 있고, 직접 소스를 대조한 결과 리팩터 전후로 동작
변경이 없음을 확인했다. 이 작업은 이미 자체적으로 2회의 독립 security 리뷰를 거쳤고(둘 다 NONE),
그 라운드들이 지적한 유일한 보안 인접 항목 — WARN #10 credential 마스킹 JSDoc 이 구현 없는 신규
타입 모듈에 고아로 남았던 문서 배치 결함 — 은 최신 커밋에서 실제로 해소됐음을 이번 라운드에서
직접 재확인했다. 하드코딩 시크릿 재스캔 0건, `import type` 정리 완료, 순환 참여 노드
(`websocket.gateway.ts`) 전환 완료, 신규 타입 모듈의 "의존성 0" 계약 유지 및 그 계약을 지키는
전용 회귀 테스트(TS 파서 기반, 뮤테이션 검증)까지 갖춰져 있어 이번 PR 에서 새로 도입된 보안
취약점은 없다.

## 위험도

NONE
