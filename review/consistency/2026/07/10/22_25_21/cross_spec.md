# Cross-Spec 일관성 검토 — `getStatus()` projection 최적화 (impl-prep)

- 대상 코드: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` (line 241-354, 변경 예정)
- 대상 변경: Execution row 1단계 얇은 projection(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`) +
  `WAITING_FOR_INPUT` 일 때만 2단계 재조회로 `conversationThread` 컬럼 fetch(대기 NodeExecution 조회와 `Promise.all` 병렬).
  HTTP wire 응답 형식 무변경.
- 검토 SoT: `spec/5-system/14-external-interaction-api.md` §5.3/§R17, `spec/conventions/conversation-thread.md` §4/§8.4,
  `spec/7-channel-web-chat/1-widget-app.md` §3.1, (보조) `spec/7-channel-web-chat/3-auth-session.md`,
  `spec/1-data-model.md` §2.13(엔티티 컬럼 정의), `spec/data-flow/15-external-interaction.md`,
  `spec/5-system/6-websocket-protocol.md`, `spec/5-system/4-execution-engine.md`

## 검토 방법

1. §5.3 응답 스키마(`id`/`workflowId`/`status`/`currentNode`/`context`/`result`/`error`/`seq`/`updatedAt`)와
   현재 `getStatus()` 구현이 `execution` 엔티티에서 실제로 읽는 필드를 1:1 대조.
2. `conversationThread` 노출 범위에 대한 spec 서술을 `14-external-interaction-api.md`(§5.3 안내문 + §R17 전문),
   `conversation-thread.md`(§4 영속화 표 + §8.4 소비처 갱신 문단), `1-widget-app.md`(§3.1 재동기화 계약),
   `3-auth-session.md`(구현 현황 각주), `execution.entity.ts` 의 컬럼 JSDoc까지 5곳에서 교차 확인.
3. 다른 영역(6-websocket-protocol, 4-execution-engine, data-flow/15-external-interaction)에서 `getStatus`/해당
   Execution 조회 형태에 의존하는 서술이 있는지 전문 grep.
4. `getStatus()`의 유일한 호출자(controller) 및 `executionRepository.findOne` 의 다른 사용처(`refresh-token`,
   `loadAndAssertAlive`)와의 패턴 일관성 확인.

## 발견사항

### 검토 질문 1 — §5.3 응답 필드 vs projection 목록 완전성

**결론: 충돌 없음.** 현재 `getStatus()` 본문이 `execution` 객체에서 실제로 읽는 필드는 다음 7개뿐이며, 계획된
1단계 projection(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`) + 2단계
`conversationThread` 로 정확히 1:1 커버된다.

| §5.3 응답 필드 | 소스 | 계획된 projection 포함 여부 |
|---|---|---|
| `id` | `execution.id` | 1단계 포함 |
| `workflowId` | `execution.workflowId` | 1단계 포함 |
| `status` | `execution.status` | 1단계 포함 |
| `result` (COMPLETED) | `execution.outputData` | 1단계 포함 |
| `error` (FAILED) | `execution.outputData` | 1단계 포함 |
| `updatedAt` | `execution.finishedAt ?? execution.startedAt ?? new Date()` | 1단계 포함 (두 컬럼 모두) |
| `context.conversationThread` | `execution.conversationThread` | 2단계(WAITING_FOR_INPUT 한정) 포함 |
| `currentNode` / `context.{buttonConfig,nodeOutput,formConfig,conversationConfig}` | `NodeExecution` 별도 테이블(`nodeExecutionRepository.findOne`) | Execution projection 과 무관 — 기존 로직 그대로 |
| `seq` | 상수 `SSE_SEQ_PLACEHOLDER` | DB 비의존 |

누락 컬럼 없음. `executionRepository.findOne` 이 이 함수 안에서 이 7개 필드 외의 어떤 `execution.*` 필드도
참조하지 않는다는 것을 소스 라인 단위로 확인했다(`grep execution\.` 결과 전량 위 표에 포함).

### 검토 질문 2 — waiting-only fetch 와 §5.3/§R17 "durable thread 없으면 키 생략" 계약의 충돌 여부

**결론: 충돌 없음 — 오히려 계획이 spec 이 이미 명시한 제약과 정확히 일치.** `context.conversationThread` 는 spec
전체에서 예외 없이 **"waiting_for_input 상태에서만"** 노출되는 것으로 일관되게 기술되어 있다:

- `14-external-interaction-api.md` §5.3 안내문(line 436-442): "`context.conversationThread` 에는 durable
  스냅샷을 ... 동봉한다" 는 문단이 바로 위 "`waiting_for_input` 상태에서는 `currentNode`...`context` 도 채워진다"
  문단 아래 종속돼 있어 waiting 한정.
- 같은 파일 §R17(line 1130): "`getStatus` 가 **waiting 시** durable thread 를 동봉하도록 **좁게 확장**"
- `conversation-thread.md` §8.4(line 351): "공개 REST 표면 `GET .../:id`(`getStatus`)가 **`waiting_for_input`
  한정으로** 이 스냅샷을 `context.conversationThread` 에 read-only 로 동봉"
- `execution.entity.ts` 컬럼 JSDoc(line 161-162): "EIA `getStatus` ... 는 **waiting_for_input 시** 이 스냅샷을
  read-only 로 노출한다"

waiting 이외 상태(`pending`/`running`/`completed`/`failed`/`cancelled`)에서 `context.conversationThread` 를
요구하는 spec 서술은 어디에도 없다(`ExecutionStatus` enum 6종 전수 확인). 따라서 "`WAITING_FOR_INPUT` 일 때만
2단계 재조회" 설계는 spec 이 이미 강제하는 노출 범위와 정확히 일치하며, 오히려 현재 구현(전 컬럼 fetch 후 조건부
사용)이 이 제약을 코드 레벨에서 더 느슨하게 반영하고 있었을 뿐이다.

### 검토 질문 3 — `1-widget-app.md` §3.1 재동기화 계약이 waiting 이외 상태에서도 thread 를 기대하는가

**결론: 기대하지 않음 — 충돌 없음.** §3.1 "페이지 새로고침/이동" 행(line 89)이 원문에 조건을 명시한다:
"`GET /:id`(**`waiting_for_input` 상태면** durable `conversationThread` 동봉 — 그 경우 5분 SSE buffer 무관·서버
재시작 무관하게 전체 히스토리 복원 ...)". 즉 위젯 spec 자신이 이미 "waiting 상태일 때만" 이라는 조건을 명시하고
있어, 대상 변경의 waiting-only fetch 와 완전히 합치한다. `3-auth-session.md` 의 구현 현황 각주도 동일하게
"`getStatus` 응답이 `waiting_for_input` 이면 그 표면 + `context.conversationThread`... 시드" 로 기술한다.

### 검토 질문 4 — 다른 영역(6-websocket-protocol, 4-execution-engine, data-flow/15-external-interaction) 의존 여부

**결론: 의존 서술 없음.** 세 문서 전문 grep 결과 `getStatus`/`GET /api/external/executions/:id` 에 대한 참조가
전혀 없다. `getStatus()` 의 유일한 런타임 호출자는 `interaction.controller.ts` 하나이며(grep 결과 전수 확인),
다른 백엔드 모듈이 이 메서드를 in-process 로 호출하거나 그 DB 조회 형태에 의존하는 코드도 없다. `EIA-NF-05`
("§5.3 의 lock 전략으로 직렬화")는 표기상 `§5.3`을 참조하나 본 문서 §5.3(단발 상태 조회, read-only GET)에는
lock 전략 서술이 없어 pre-existing 오참조로 보인다 — `interact` 커맨드 동시성에 관한 것으로 대상 변경(순수 읽기
경로인 `getStatus`)과 무관하므로 본 리뷰 범위 밖으로 판단, 별도 조치 불요.

## 추가 관찰 (INFO, 비차단)

- **[INFO] 2-쿼리 분리로 인한 이론적 time-of-check/time-of-use 간극**: 현재 구현은 `status` 와
  `conversationThread` 를 **단일 쿼리**(단일 스냅샷)로 읽는다. 계획대로 분리하면 stage-1(`status` 확인)과
  stage-2(`conversationThread` 조회) 사이 수 ms 간극 동안 실제 execution 상태가 바뀔 이론적 가능성이 생긴다.
  다만 (a) `conversationThread` 는 park 진입 시에만 갱신되고 상태 전이만으로는 값이 지워지지 않으며, (b) 응답의
  `status` 필드는 여전히 stage-1 스냅샷 값을 반환하므로 응답 자체의 내적 일관성(“이 응답이 보고하는 status” ↔
  “이 응답에 담긴 thread”)은 유지된다. spec 어디에도 두 필드의 원자적 동일-트랜잭션 읽기를 요구하는 문구가 없어
  cross-spec 충돌은 아니나, 구현 시 인지하고 있을 사항으로 기록.
- **[INFO] 기존 파일 내 컨벤션과의 정합**: 같은 파일의 `refresh-token`(line 207-210)과 `loadAndAssertAlive`
  (line 356-360)는 이미 `select: ['id', 'status']` 얇은 projection 을 쓰고 있다. 대상 변경은 이 기존 패턴을
  `getStatus()` 에도 확장하는 것으로, 파일 내부 관례와도 합치한다(cross-spec 범위 밖이지만 참고로 기록).
- **[INFO] 인라인 주석 갱신 필요(코드 리뷰 영역, spec 은 무변경)**: `getStatus()` 상단 JSDoc(line 250-256)이
  현재 "전체 row 를 한 번에 읽어 conversationThread 를 조건부로 사용" 하는 뉘앙스로 쓰여 있어, 2단계 조회로
  바뀌면 주석 갱신이 필요하다. spec 문서 자체의 갱신은 불요(§5.3/§R17 서술은 "waiting 시 노출"이라는 계약만
  명시하고 내부 쿼리 전략을 규정하지 않는다).

## 요약

대상 변경은 순수 내부 DB 조회 최적화이며 HTTP wire 응답 형식을 그대로 유지한다. §5.3 이 요구하는 9개 응답
필드는 계획된 1단계 projection(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`) +
`WAITING_FOR_INPUT` 조건부 2단계(`conversationThread`)로 누락 없이 전부 커버됨을 소스 라인 단위로 확인했다.
더 나아가 `conversationThread` 를 waiting 상태에서만 fetch 하는 설계는 `14-external-interaction-api.md`
§5.3/§R17, `conversation-thread.md` §4/§8.4, `execution.entity.ts` 컬럼 JSDoc, `1-widget-app.md` §3.1,
`3-auth-session.md` 5곳 모두가 예외 없이 "waiting_for_input 한정 노출"이라고 이미 명시한 제약과 정확히
일치한다 — 오히려 현재(변경 전) 구현이 이 제약보다 더 넓게(전 상태에서 전 컬럼) fetch 하고 있었을 뿐이다.
다른 영역 spec(6-websocket-protocol, 4-execution-engine, data-flow/15-external-interaction)에는 `getStatus`
의 DB 조회 형태나 반환 표면에 의존하는 서술이 없으며, 호출 경로도 controller 단일 진입점으로 국한된다.
CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았고, 구현 시 참고할 만한 INFO 3건만 기록한다.

## 위험도

NONE

---

STATUS: OK
