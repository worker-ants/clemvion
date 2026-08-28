# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** 이전에 "죽어있던" 콜백 경로가 프로덕션에서 실제로 처음 발동한다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:906-911` (`handleNodeFailed` 의 `extractNodeErrorPayload(payload.error, payload.output)` 호출), `codebase/frontend/src/lib/websocket/use-execution-events.ts:812` (`handleNodeCompleted` 의 동일 헬퍼 호출)
  - 상세: `extractNodeErrorPayload` 의 `nested` 분기가 `rawOutput.error`(1단계) → `rawOutput.output.error`(2단계, `asRecord` 헬퍼 경유)로 바뀌었고, `handleNodeFailed` 가 이전에 넘기던 `undefined` 대신 `payload.output` 을 실제로 전달한다. 그 결과 `useExecutionStore.getState().addConversationMessage(...)` (system_error 배너 APPEND)가 `handleNodeFailed`·`handleNodeCompleted` 두 호출부 모두에서 **처음으로 실제 조건을 만족해 발동**하게 된다. 이 콜백은 이번 PR 의 명시적 목적(정본 트래커 CRITICAL `12_24_55` 수정)이므로 결함이 아니라 의도된 활성화이지만, "이전에 한 번도 실행되지 않던 프로덕션 코드 경로가 이번 배포부터 실행된다"는 점은 부작용 관점에서 명시적으로 인지해 둘 가치가 있다(예: 배포 후 다수의 실행에서 배너가 새로 나타나는 것이 회귀가 아니라 의도된 결과임을 온콜/QA 가 알아야 함).
  - 제안: 별도 코드 수정 불요. 배포 노트/PR 설명에 "이 변경으로 system_error 배너가 프로덕션에서 처음 실질적으로 노출된다"는 점을 명시해 관측 시 회귀로 오인하지 않도록 하면 충분.

- **[INFO]** `extractNodeErrorPayload` 의 시맨틱 변경은 비공개(private) 함수이고 호출부가 파일 내부 2곳뿐 — 외부 파급 없음 확인
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` — `extractNodeErrorPayload` 함수 정의(구 §4.1 주석 → 신 §4.1-a 주석, gate 61-90) / 호출부 gate 812, gate 906-911
  - 상세: `grep` 로 확인한 결과 `extractNodeErrorPayload` 는 export 되지 않고, 같은 파일의 `handleNodeCompleted`·`handleNodeFailed` 두 콜백에서만 호출된다. 두 호출부 모두 이번 PR 에서 함께 갱신되었으므로(내부 헬퍼의 unwrap 깊이 변경과 호출 인자 변경이 짝을 이룸) 시그니처/인터페이스 파손이나 호출자 불일치 위험은 없음.
  - 제안: 없음 (확인 목적의 기록).

- **[INFO]** 신규 plan 파일 생성은 프로젝트 컨벤션에 따른 예상된 파일시스템 부작용
  - 위치: `plan/in-progress/system-error-banner-live-ws.md` (신규 파일 전체)
  - 상세: `codebase/` 바깥의 `plan/in-progress/**` 파일 신규 생성으로, 이 저장소의 작업 추적 컨벤션(`CLAUDE.md` "정보 저장 위치")에 명시된 정상 산출물이다. 애플리케이션 런타임에 영향을 주는 파일시스템 부작용이 아니며, 코드 변경으로 인한 의도치 않은 파일 생성이 아니다.
  - 제안: 없음.

## 검증된 안전 항목 (부작용 없음 확인)

- **전역 변수**: 새 전역 변수 도입 없음. `asRecord` 는 순수 함수(모듈 스코프, 인자 외 상태 참조/변경 없음).
- **상태 변경 경로**: 스토어 조작은 전부 기존 공식 Zustand 액션(`addConversationMessage`, `updateNodeStatus`, `addNodeResult`)을 통하며, 상태 객체를 직접 mutate 하지 않음(`execution-store.ts` 의 `addConversationMessage` 는 `set((state) => ({ conversationMessages: [...state.conversationMessages, item] }))` 형태의 불변 갱신).
- **네트워크 호출**: 없음. 이번 변경은 이미 수신한 WS payload 를 파싱하는 순수 로직 변경뿐, 신규 fetch/axios/WS emit 없음.
- **환경 변수**: 읽기/쓰기 변경 없음 (`process.env.NODE_ENV` 등 기존 사용 지점 불변).
- **테스트 파일 부작용**: `use-execution-events.test.ts` 의 fixture 변경(문자열 `error` + 래퍼 `output`)과 신규 캐너리 테스트는 기존에 이미 mock 된 WS client/store 를 사용하며, `beforeEach` 의 `vi.resetAllMocks()` + `useExecutionStore.setState({...})` 리셋 패턴을 그대로 따름 — 테스트 간 상태 누출 위험 없음.

## 요약

핵심 변경은 `extractNodeErrorPayload` 의 중첩 unwrap 깊이를 `rawOutput.error`(1단계)에서 `rawOutput.output.error`(2단계)로 바로잡고, `handleNodeFailed` 가 이전에 누락했던 `payload.output` 인자를 실제로 전달하도록 고친 것이다. 두 지점 모두 파일 내부 비공개 함수·콜백이고 호출부는 이번 커밋에서 함께 갱신되어 시그니처·인터페이스 파손이나 외부 파급은 없다. 유일하게 주목할 부작용은 "의도된" 것 — 종전에 항상 `null` 로 죽어있던 `addConversationMessage`(system_error 배너 APPEND) 경로가 프로덕션에서 처음으로 실질 조건을 만족해 실행되게 된다는 점이며, 이는 이 PR 의 명시적 수정 목표와 정확히 일치한다. 전역 변수 도입, 직접적 상태 mutation, 예상 밖 파일시스템/네트워크/환경변수 접근은 발견되지 않았다.

## 위험도
LOW
