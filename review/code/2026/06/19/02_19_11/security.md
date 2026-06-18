# 보안(Security) 리뷰 결과

## 발견사항

### 파일 1: engine-driver.interface.ts

- **[INFO]** 이번 변경은 JSDoc 주석 추가·확장만 포함 (런타임·컴파일 산출물 무변)
  - 위치: 전체 diff (라인 60, 69-71)
  - 상세: 새로 추가된 주석은 `@internal` 선언, C-1 step 배경 설명, 타입 레벨 순환 해소 이유만 기술한다. 비밀 정보·내부 인프라 경로·보안 취약 정보가 주석에 노출되지 않는다.
  - 제안: 해당 없음.

### 파일 2: execution-engine.service.ts

- **[INFO]** 이번 변경은 import 주석 1줄 추가만 포함 (런타임·컴파일 산출물 무변)
  - 위치: 라인 284 (추가된 comment)
  - 상세: 타입 레벨 순환 해소 이유를 설명하는 단순 주석이다. 보안 관점 영향 없음.
  - 제안: 해당 없음.

- **[INFO]** 전체 파일 컨텍스트 — 입력 검증 패턴 양호
  - 위치: `applyContinuation` 메서드 (라인 1009-1035), `extractChatChannelFromInput` (라인 503-517)
  - 상세: `ai_message` 길이 상한(`MAX_MESSAGE_LENGTH`) 가드가 존재하고, `extractChatChannelFromInput` 은 `provider`·`conversationKey` 필수 문자열 검증을 수행한다. 타입 단언(`as`) 전 런타임 타입 검사를 선행하고 있어 입력 검증 구조는 적절하다.
  - 제안: 해당 없음 (기존 패턴 유지).

- **[INFO]** 전체 파일 컨텍스트 — 에러 메시지 노출 통제 양호
  - 위치: `rehydrateAndResume` catch 블록 (라인 1270-1283), `failFirstSegmentSetup` (라인 787-788)
  - 상세: `RehydrationError` 처리 시 `err.message` 를 외부에 노출하지 않고 `code`·`executionId`·`nodeExecutionId` 만 structured params 로 로깅한다(W19 대응). `failFirstSegmentSetup` 은 `err.message` 를 DB `row.error.message` 로 저장하지만, 이는 execution 오너가 접근하는 내부 레코드이며 직접 사용자 응답으로 반환되는 경로가 코드상 식별되지 않는다.
  - 제안: 향후 `row.error.message` 의 외부 반환 경로(REST/WS payload)가 생길 경우 내용 검열 또는 마스킹 레이어 추가를 고려한다.

- **[INFO]** 전체 파일 컨텍스트 — Sub-workflow 워크스페이스 격리 부분 미완
  - 위치: `assertSameWorkspace` (라인 841-857)
  - 상세: 호출자가 `parentWorkspaceId` 를 전달하지 않으면 경고 로그 후 통과(fail-open)한다. 코드 주석 자체가 "점진적 도입" 임을 명시하고 있으며, 이는 인가 우회 가능성을 내포한다. 이 동작은 이번 커밋에서 도입된 것이 아니라 기존 코드이므로 본 변경에 귀속되는 신규 위험은 아니다.
  - 제안: (기존 백로그) 모든 진입점이 `parentWorkspaceId` 를 전달하도록 정착되는 시점에 fail-closed(`throw`)로 전환한다.

- **[INFO]** 전체 파일 컨텍스트 — 재귀 깊이 상한 존재
  - 위치: `MAX_RECURSION_DEPTH = 10` (라인 831)
  - 상세: Sub-workflow 재귀 무한 루프 방지 상한이 정의되어 있다. 보안 통제로서 적절하다.
  - 제안: 해당 없음.

- **[INFO]** 전체 파일 컨텍스트 — `nodeOutputCache` 를 통한 경로 탐색 없음
  - 위치: `runNodeDispatchLoop` (라인 1552-), `rehydrateContext` (라인 1338-)
  - 상세: `nodeId` 는 DB 에서 로드된 UUID 이며, `nodeOutputCache` key 도 동일 UUID 를 사용한다. 사용자 제공 문자열이 파일 시스템 경로나 DB 쿼리 파라미터로 직접 삽입되지 않는다. TypeORM `findBy`·`findOne` 파라미터도 ORM 파라미터 바인딩 경로를 사용한다.
  - 제안: 해당 없음.

### 파일 3: graph-dispatch.types.ts

- **[INFO]** 이번 변경은 `executionId` 필드 JSDoc 주석 1줄 추가만 포함
  - 위치: 라인 1669 (diff: `+  /** 현재 처리 중인 Execution UUID. */`)
  - 상세: 순수 문서화 변경. 보안 관점 영향 없음.
  - 제안: 해당 없음.

---

## 요약

이번 커밋(8a9d8a06)은 JSDoc·import 주석 추가 전용이며, 런타임 및 컴파일 산출물에 변경이 없다. 새로 추가된 주석 어디에도 하드코딩된 시크릿, 내부 인프라 주소, 인증 정보 등 보안 민감 정보가 포함되지 않는다. 전체 파일 컨텍스트를 점검한 결과, 기존 코드는 입력 길이 가드·타입 검증·구조화 로깅(에러 코드 분리)·재귀 깊이 제한·워크스페이스 격리 체계를 갖추고 있어 전반적인 보안 자세는 양호하다. `assertSameWorkspace` 의 fail-open 동작(parentWorkspaceId 누락 시 경고 후 통과)은 기존 백로그로서 본 변경과 무관하며, 해당 경로를 fail-closed 로 전환하는 작업은 향후 계획에 따라 진행한다. 신규 Critical 또는 Warning 사항 없음.

---

## 위험도

NONE
