# 요구사항(Requirement) 리뷰 — ws-event-types-extract (4라운드째)

## 검토 방법

`plan/in-progress/ws-event-types-extract.md` (spec_impact: none)를 요구사항 SoT로 삼아
diff 86개 파일(코드 27 + plan/review 문서 다수)을 대조했다. 이미 3라운드
(`19_27_37`→`20_05_17`→`20_27_08`)의 architecture/testing/security/dependency/scope/
side_effect 리뷰가 실질 결함을 전부 찾아 반영했으므로, 본 리뷰는 (a) 그 수정들이 실제 소스에
반영됐는지 재검증(`Read`) (b) requirement 관점에서 아직 안 짚인 갭이 있는지에 집중했다.

직접 실행한 검증:
- `websocket-events.types.ts`(신규, 266줄) 전문 정독 — import 0줄, `EXPECTED_EXPORTS` 12개
  (값 4: `ExecutionEventType`/`NodeEventType`/`BackgroundRunEventType`/`NotificationEventType`,
  타입 8) 전부 실재 확인. `KbEventType` union 11종(`grep -c "'document:"` = 11) 실측 일치.
- `websocket.service.ts` re-export 블록(`export {...}` 4 + `export type {...}` 8) 대조 — 신규
  모듈의 `EXPECTED_EXPORTS`와 1:1.
- `websocket.gateway.ts:23` — 3라운드 전(`19_27_37` W1)에 지적된 잔여 순환 노드가
  `./websocket-events.types` 로 전환돼 있음을 확인 (수정 커밋 `65da1a9d7` 반영 확인).
- `websocket-events.types.spec.ts`(신규 가드, 5 tests) 전문 정독 — module-specifier 5형태
  전수(`isImportDeclaration`/`isExportDeclaration`/`isImportEqualsDeclaration`/동적
  `import()`/`require()`) + `WebsocketService` 예외를 **원 식별자**(`propertyName ?? name`)로
  판정(`20_27_08` W2 FN 수정 반영) + `import type` 미표시 부류 가드(5번째 테스트, `20_27_08` W1
  반영) — 전부 코드에 실재.
- `npx jest src/modules/websocket/websocket-events.types.spec.ts` 단독 실행 → 5/5 PASS.
- `npx tsc --noEmit -p tsconfig.build.json` (실제 `nest build` 가 쓰는 설정, spec 제외) →
  **에러 0**.
- `npx eslint` 핵심 변경 파일 5개(`--max-warnings 0`) → 클린.
- `npx jest src/modules/websocket src/modules/execution-engine/events/execution-event-emitter.service.spec.ts src/modules/chat-channel/chat-channel.dispatcher.spec.ts src/modules/external-interaction` → 이 문서 최하단 노트 참고.
- `embedding.service.ts`/`graph-extraction.service.ts` 의 `private emitEvent(event: KbEventType, …)`
  시그니처가 실제로 `import type { KbEventType }` 로 좁혀져 있음을 확인 — union 밖 이벤트명
  컴파일타임 차단 주장이 소스와 일치.
- `execution-engine.service.ts` 의 `type ChatChannelRoutingInfo` 가 함수 반환 타입 주석으로만
  쓰이고 값으로 안 쓰임을 확인 — type-only 전환이 실제로 안전함.

## 발견사항

- **[INFO]** plan 문서의 re-export 개수 서술이 실제 구현과 하나 어긋난다 (기능 영향 없음)
  - 위치: `plan/in-progress/ws-event-types-extract.md` §"조치" 두 번째 항목 (`- [x] websocket.service.ts re-export (값 4 + 타입 9)`)
  - 상세: 실제 `websocket.service.ts` 의 `export type { … }` 블록은 8개(
    `ExecutionChannelEvent`/`ChatChannelRoutingInfo`/`ExecutionRoutingContext`/
    `ToolCallStartedPayload`/`UserMessagePayload`/`ToolCallCompletedPayload`/
    `NotificationNewPayload`/`KbEventType`)이며 값 4개와 합쳐 총 12개다.
    `websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS` 배열도 정확히 12개로, 코드와
    가드는 서로 일치한다 — 어긋난 쪽은 plan 서술("타입 9")뿐이다. 이 항목은 이미 `[x]` 체크된
    완료 기록이라 향후 "이 숫자를 세어 완료를 재확인"하려는 사람이 실측과 다른 숫자로 출발하게
    만드는 사소한 문서 정확성 문제다. plan/ 은 developer 쓰기 범위이므로 다음 편집 시 "타입
    8"로 정정 권장.
  - 제안: `plan/in-progress/ws-event-types-extract.md` 의 "타입 9"를 "타입 8"로 정정(다음
    plan 편집 turn에 묶어서). 코드 변경 불필요.

- **[INFO]** 병렬 리뷰 세션의 뮤테이션 테스트가 남긴 일시적 ENOENT — 재실행으로 무관함 확인 (참고 기록)
  - 위치: 해당 없음 (관측 시점의 파일시스템 상태, 소스 결함 아님)
  - 상세: 본 리뷰 중 `npx jest src/modules/websocket …` 1차 실행에서
    `websocket-events.types.spec.ts` 의 세 번째 테스트가
    `ENOENT: .../websocket/__probe_bare_require.ts` 로 실패했다. 저장소 어디에도 그런 파일이
    없고(`find`/`git status` 확인), 즉시 재실행하면 5/5 GREEN이다 — 이 저장소 메모리에 기록된
    "병렬 리뷰어가 공유 worktree 를 뮤테이션해 서로를 오염시킨다" 패턴과 일치한다(다른
    관점 리뷰어가 같은 가드 파일에 대해 뮤테이션 프로브 파일을 생성/삭제하는 도중 관측된
    것으로 추정). 코드 결함이 아니므로 SUMMARY 집계 시 이 항목을 CRITICAL/WARNING 으로 잡지
    말 것 — 재현 불가 & 재실행 GREEN 으로 확인됨.
  - 제안: 조치 불필요.

## 요약

`websocket.service.ts` 가 안고 있던 ES-module 순환 위 값 평가 순서 문제(#1174 재발 위험)를
의존성-프리 모듈 `websocket-events.types.ts` 로 물리적으로 분리한다는 plan 의 요구사항을
코드가 정확히 충족한다. 이미 3라운드의 리뷰가 실질 결함(순환 잔여 노드 gateway.ts 누락, 가드
테스트의 3중 판별 오류 — `^import`만 세기·로컬 별칭 오판정·`import type` 미표시)을 전부
찾아냈고, 이번 라운드에서 소스를 직접 열어 그 수정들이 실제로 반영됐음을 재확인했다(`tsc
--noEmit -p tsconfig.build.json` 에러 0, 신규 가드 5/5 PASS, 핵심 파일 lint 클린,
`KbEventType`/re-export 개수 실측 일치). export 표면은 완전히 보존되고(re-export facade), 종결
이벤트 조립(`TERMINAL_SHAPE`) 을 포함한 유일한 실행-순서 의존 변경도 근거·테스트가 모두
갖춰져 있다. spec 본문 자체의 잔여 stale 서술(`KbEventType` 정본 위치 6곳, `NotificationEventType`
개명, §4.4 Rationale 후속 등)은 developer 권한 밖(spec/ read-only)으로 이미 plan 문서에
planner-턴 인계 항목으로 명시돼 있어 이번 PR 의 결함이 아니다. 요구사항 충족 관점에서 새로
발견된 Critical/Warning 은 없다.

## 위험도
NONE
