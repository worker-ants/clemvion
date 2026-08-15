# Code Review 통합 보고서

## 전체 위험도
**LOW** — 신규 CRITICAL 없음. `websocket.service.ts` 값/타입 분리 리팩터(#1174 순환 회귀 방지) 직전 라운드(`19_27_37`) Warning 5건은 소스 직접 대조로 전부 반영 확인됨. 이번 라운드에서 새로 발견된 WARNING 2건은 모두 이번 diff 자체가 만든 부수 결함(타입 import 누락, 회귀 가드 커버리지 갭)이며 기능/컴파일에는 영향 없음. forced reviewer 8명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `WebsocketService`(값)와 `ExecutionChannelEvent`(순수 interface)를 분리 import 하는 과정에서 production 파일 3곳이 `import type` 을 누락함 — 같은 치환을 받은 spec 파일들 및 `interaction-stream.controller.ts` 는 올바르게 처리됨. 기능/컴파일 영향은 없으나 이 PR 이 스스로 세운 "값/타입 import 명확 구분" 원칙 및 신규 회귀 가드의 판별 기준(`import type` 유무)에 정확히 어긋남 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:11`, `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:11`, `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts:8` | 세 곳 모두 `import type { ExecutionChannelEvent } from '../websocket/websocket-events.types';` 로 통일 (기계적 1줄 수정, 자매 spec 파일이 정답 형태 제시) |
| 2 | testing | 신설 회귀 가드(`websocket-events.types.spec.ts`)의 세 번째 테스트("enum 값을 `websocket.service` 경유로 가져오는 파일이 없다")가 파일 헤더 JSDoc·`moduleSpecifiersOf` 가 명시한 4종(import/export…from/import=require/동적 import) 중 `import` 형태만 검사 — `export … from` 재유입은 검출 못함. 스크래치 프로브(`export { ExecutionEventType } from '../websocket/websocket.service';`)로 실제 재현: 4/4 GREEN(미검출) 확인 후 즉시 제거·clean 확인 완료. 이는 정확히 이 가드가 막으려는 결함 클래스(#1174 재발)를 재현 가능한 경로이며, 직전 라운드 W1 의 근본원인("narrow 하게 짠 병렬 검사가 정밀 검사와 다른 커버리지")과 동일 패턴이 테스트 코드 자체에서 재발 | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 세 번째 `it` (gate 131-164, `ts.isImportDeclaration` 만 순회) | 세 번째 테스트도 `moduleSpecifiersOf` 를 재사용하도록 리팩터(`ts.isExportDeclaration(node) && !node.isTypeOnly && node.exportClause` 케이스를 추가하는 최소 수정). 뮤테이션 표에 "M7: export...from 재유입" 추가해 RED 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `websocket.service.ts` 의 stale 컨텍스트 주석("바로 아래 KB union 문서로 읽혔다")이 이번 리팩터로 참조 대상(`KbEventType` union)을 다른 파일로 잃었음 — 직전 라운드(`19_27_37`)가 이미 지적(급하지 않음 처분)했으나 이번 fix 커밋에서도 함께 정리되지 않음. 기능 영향 없음 | `codebase/backend/src/modules/websocket/websocket.service.ts:134-135` | "바로 아래 KB union 문서" 를 파일-불변적 표현으로 다듬거나 후속 커밋에서 정리(급하지 않음) |
| 2 | requirement / architecture / scope (중복 통합) | `spec/5-system/10-graph-rag.md:552` 가 `KbEventType` union 정본 선언 위치를 여전히 `websocket.service.ts` 로 서술 — re-export 로 문장 자체는 참이나 canonical 위치는 이제 `websocket-events.types.ts`. 이미 `plan/in-progress/ws-event-types-extract.md` 후속(PR 범위 밖) 섹션에 planner 턴 항목으로 등재됨 | `spec/5-system/10-graph-rag.md:552` | 별도 `project-planner` 턴에서 canonical 위치 서술 갱신 — 이번 PR 병합 차단 사유 아님 |
| 3 | side_effect / architecture | `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 상수 부활은 과거 실제 장애(#1174, 72 suites 실패)와 같은 형태이나, 값 출처가 의존성-프리 모듈로 바뀌어 순환 밖에 있음을 확인. 회귀 가드(6/6 뮤테이션 RED)와 역재현(66 suites 실패 → 425/425 통과)으로 실측 검증됨 | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (51-84행) | 조치 불필요 — 기록 목적 |
| 4 | testing | 신설 가드의 두 번째 테스트("값·타입 선언이 실제로 존재")가 `EXPECTED_EXPORTS ⊆ 실제 선언` 편도 검사만 수행 — allowlist 밖 신규 export 추가는 실패시키지 않음(의도된 설계로 보임) | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts:116-129` | 낮은 우선순위, 현재 설계가 의도라면 조치 불필요 |
| 5 | testing | 회귀 가드가 저장소 전체(~1,230 `.ts`)를 매 실행마다 TS 파서로 파싱하지만 실측 약 1초 내 완료 — 성능 문제 없음 | `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (`allTsFiles`, gate 96-104) | 조치 불필요, 기록 목적 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | credential 마스킹·외부 fanout strip·에러 payload 계약 바이트 단위 보존 확인. WARN #10 JSDoc 고아화(직전 라운드) 해소 재확인 |
| architecture | NONE | 순환 참여 노드 누락(W1)·클래스 JSDoc orphan(W2) 실제 반영 확인. TS 파서 기반 회귀 가드로 불변식 실행 가능하게 고정됨을 평가 |
| requirement | NONE | 이전 라운드 Warning 5건 전부 소스 대조로 반영 확인. spec §6 필드 계약(EIA) 일치 재확인. `nest build` 성공 |
| scope | NONE | plan 선언 범위(값/타입 분리 + 22곳 import 갱신) 그대로 준수. RESOLUTION 주장 4건 코드 반영 직접 대조 확인 |
| side_effect | NONE | 전역 상태·시그니처·emit 경로·env·네트워크 호출 불변 확인. `TERMINAL_SHAPE` 재발 위험은 근본 전제(순환) 제거로 해소 |
| maintainability | LOW | `import type` 누락 3곳(WARNING #1). 이전 라운드 Warning 5건 반영 재확인 |
| testing | LOW | 회귀 가드 3번째 테스트 커버리지 갭(WARNING #2, 스크래치 프로브로 실증). 핵심 fix(W1/W5) 자체는 실측 GREEN 견고 |
| documentation | LOW | stale "KB union" 주석 미정리(INFO #1). 나머지 WARNING 3건은 반영 확인 |

## 발견 없는 에이전트

security, architecture, requirement, scope, side_effect

## 권장 조치사항

1. **[WARNING #2]** `websocket-events.types.spec.ts` 세 번째 테스트를 `moduleSpecifiersOf` 재사용 방식으로 리팩터해 `export … from` 재유입 형태를 검출하도록 보강(뮤테이션 M7 추가) — 이번 리팩터가 막으려는 결함 클래스(#1174)를 실제로 놓치는 유일한 표면이므로 우선순위가 가장 높음.
2. **[WARNING #1]** `chat-channel.dispatcher.ts:11`, `notification-fanout.service.ts:11`, `sse-adapter.service.ts:8` 세 곳에 `import type` 추가 — 기계적 1줄 수정, 리스크 없음.
3. **[INFO #1]** `websocket.service.ts:134-135` stale "KB union" 주석을 파일-불변적 표현으로 정리 (급하지 않음, 후속 커밋 가능).
4. **[INFO #2]** `spec/5-system/10-graph-rag.md:552` 의 `KbEventType` canonical 위치 서술 갱신은 별도 `project-planner` 턴에서 처리(이미 plan 에 등재됨, developer 권한 밖).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 7명 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(순수 import 경로 재배선 + 모듈 분리)와 무관 |
  | dependency | 신규 외부 의존성 없음(기존 `typescript` 패키지만 사용) |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 공개 API/엔드포인트 변경 없음(내부 모듈 리팩터) |
  | user_guide_sync | 사용자 가이드 영향 없는 내부 리팩터 |