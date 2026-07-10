# 코드 리뷰 — 요구사항 충족 관점

- 대상: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` 2단계 컬럼 projection
- diff base: `origin/main` (`git diff origin/main...HEAD`)
- 관련 spec: `spec/5-system/14-external-interaction-api.md` §5.3/§R17, `spec/conventions/conversation-thread.md` §4/§8.4, `spec/7-channel-web-chat/1-widget-app.md` §3.1
- 관련 plan: `plan/in-progress/eia-getstatus-column-projection.md`
- 선행 검토: `review/consistency/2026/07/10/22_25_21/` (`--impl-prep`, BLOCK: NO, Critical 0)

## 발견사항

- **[INFO]** JSDoc 주석의 "500 turn × turn 당 4000자 ≒ 2MB" 상한 추정이 실제로는 두 개의 서로 다른 cap 을 합성한 근사치
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:247-249` (`getStatus()` 1단계 주석)
  - 상세: `STORAGE_MAX_TURNS=500` (`codebase/backend/src/modules/execution-engine/conversation-thread/conversation-thread.service.ts:68`) 은 실제 DB 저장(append) 시점의 turn 개수 상한이 맞다. 그러나 `MAX_TURN_TEXT_CHARS=4000` (`spec/conventions/conversation-thread.md` §5.3 "Cap (v1)")은 **LLM 컨텍스트 주입 시점**(`thread-renderer.ts` `applyCap`)의 cap 이지 storage/append 시점의 turn 텍스트 truncation 이 아니다 — `conversation-thread.service.ts` 의 `appendInternal` 은 `text.length` 를 `totalChars` 누적에만 쓰고 truncate 하지 않는다(grep 결과 truncate 로직 없음). 즉 개별 turn 텍스트 길이에는 storage 단에서 상한이 없어, 실제 최악 case 행 크기는 주석이 제시하는 "≒2MB" 보다 커질 수 있다.
  - 제안: 최적화 근거 자체(“상태 무관 fetch 는 낭비”)는 여전히 유효하므로 기능 변경은 불필요. 다만 주석의 근거 수치를 "500 turn (storage cap, STORAGE_MAX_TURNS) × 가변 길이 — turn 당 상한 없음, 다만 실측상 대개 수백 KB~수 MB" 정도로 정정하면 향후 독자의 오해를 줄일 수 있음(코드 정확성/스펙 합치성에는 영향 없는 경미한 주석 정밀도 이슈).

- **[INFO]** 1단계·2단계 사이 이론적 TOCTOU 간극 — 이미 코드 주석·consistency-check 에서 인지·문서화됨
  - 위치: `interaction.service.ts:276-301`
  - 상세: `execution.status`(1단계 스냅샷)로 분기한 뒤 `conversationThread`/`nodeExec` 를 별도 쿼리(2단계)로 재조회하므로, 그 사이 실제 DB 상태가 바뀔 수 있다. 그러나 응답의 `status` 필드는 항상 1단계 스냅샷 값이고, `conversationThread` 는 park 시에만 갱신되며 상태 전이만으로 지워지지 않으므로 응답의 내적 일관성은 유지된다. row 자체가 사라지는 극단 케이스도 `threadRow?.conversationThread` 옵셔널 체이닝으로 "durable thread 없음"과 동일한 graceful 경로로 흡수되며, 이는 테스트(`waiting_for_input.*재조회.*null`, `interaction.service.spec.ts:848-865`)로 고정돼 있다. spec 어디에도 두 필드의 원자적 동일 트랜잭션 읽기를 요구하는 문구가 없어 계약 위반은 아님.
  - 제안: 조치 불요. 참고 기록.

## 검토 항목별 확인 결과

1. **응답 계약 무변경**: §5.3 이 약속하는 9개 필드(`id`/`workflowId`/`status`/`currentNode`/`context`/`result`/`error`/`seq`/`updatedAt`) 전부가 1단계 projection(`id`/`status`/`workflowId`/`startedAt`/`finishedAt`/`outputData`) + 조건부 2단계(`conversationThread`)로 line-level 로 커버됨을 직접 대조 확인. `execution.*` 참조가 이 7개 필드 밖으로 나가는 지점이 코드에 없음(`interaction.service.ts:352-380`). `updatedAt = finishedAt ?? startedAt ?? new Date()` 의 두 소스 컬럼(`startedAt`/`finishedAt`) 모두 1단계 select 목록에 명시적으로 포함돼 있고(`interaction.service.ts:257-258`), 이를 전용으로 고정하는 회귀 테스트(`interaction.service.spec.ts:869-887`, `finishedAt` 우선/`startedAt` fallback 두 케이스)가 실값 문자열 비교로 존재함(`typeof==='string'` 같은 형식 단언이 아님) — 침묵 fallback(`new Date()`) 회귀를 실제로 차단한다.
2. **"durable thread 없으면 키 생략" 계약 유지**: `const conversationThread = threadRow?.conversationThread ? redactThreadForPublic(...) : undefined;` + `...(conversationThread ? { conversationThread } : {})` 스프레드로 `null`/`undefined` 모두 키 생략으로 흡수(`interaction.service.ts:299-301, 334`). null(배포 이전 row)·2단계 재조회 자체가 실패(row 소멸)한 두 케이스 모두 테스트로 고정(`interaction.service.spec.ts:723-742`, `848-865`) — "null 값 vs 키 부재" 구분(§5.3 line 441-442)이 정확히 지켜짐.
3. **위젯 계약(§3.1)이 waiting 이외 상태에서도 thread 를 기대하는지**: `1-widget-app.md:89`("`GET /:id`(**`waiting_for_input` 상태면** durable `conversationThread` 동봉...)")가 명시적으로 waiting 한정 조건을 걸어 두고 있어, 본 diff 의 waiting-only 2단계 fetch 와 완전히 합치. `3-auth-session.md` 각주도 동일 조건. non-waiting 상태(`streaming`≒backend `running`)에서 SSE 버퍼가 만료되는 이론적 엣지(§3.1 line 94-101, 5분 버퍼 만료 fallback)는 spec 이 이미 "SSE = 라이브 증분의 권위"로 역할을 분리해 둔 기존 설계이며, 이 diff 가 변경한 것도 아니고(if-분기 조건 `execution.status === WAITING_FOR_INPUT` 자체는 diff 전후 동일) 새로 만든 gap도 아님.
4. **엣지 케이스**:
   - waiting 인데 대기 NodeExecution 이 없는 경우: `nodeRepo.findOne` 이 `null` 을 반환하면 `currentNode`/`context` 는 초기값 `null` 유지(`interaction.service.ts:274-275, 302`) — 정확. 이 경우 2단계에서 재조회한 `conversationThread` 는 미사용으로 낭비되지만, 이는 diff 전 코드도 동일했던 기존 특성(원래도 `if (nodeExec?.node)` 안에서만 `conversationThread` 를 사용)이라 diff 로 인한 회귀가 아니며 응답 정확성에도 영향 없음. 테스트로 고정(`interaction.service.spec.ts:527-536`, `791-802`).
   - 2단계 재조회(Execution 재조회)가 null 반환: `threadRow?.conversationThread` 옵셔널 체이닝으로 안전하게 "thread 없음"과 동일 경로로 흡수, 키 생략. 별도 테스트로 고정(`interaction.service.spec.ts:848-865`).
   - non-existent execution (1단계 자체가 null): 기존 `NotFoundException` 경로 그대로 유지, 회귀 없음(diff 로 건드리지 않은 코드 경로, 기존 테스트 커버).
5. **테스트 커버리지**: `interaction.service.spec.ts` 에 신규 5개 테스트(2단계 조회 describe 블록) 추가 — (a) 1단계 select 컬럼 목록 검증(누락 방지), (b) 비-waiting 5개 상태 전부 1회 조회만 발생·NodeExecution 미조회 검증, (c) waiting 시에만 2단계 조회 발생 검증, (d) 2단계 결과도 `redactThreadForPublic` 마스킹 통과(secret egress 가드), (e) 2단계 null → 키 미동봉, (f) `updatedAt` fallback 체인 실값 검증. 로컬 실행 결과 `interaction.service.spec.ts` 41/41 전부 PASS(직접 재실행 확인, `npx jest src/modules/external-interaction/interaction.service.spec.ts`). plan 상 lint/build/e2e(`execution-park-resume`·`external-interaction` e2e 포함)도 PASS 로 기록됨.
6. **TODO/미완 흔적**: 코드·주석 전체에 TODO/FIXME/HACK/XXX 없음. plan 체크리스트 9번("REVIEW WORKFLOW")만 미완인데 이는 본 리뷰 자체가 그 단계이므로 정상.
7. **의도-구현 일치**: JSDoc(`interaction.service.ts:222-244`)이 "조회는 2단계... wire 형식은 두 경로 모두 동일"이라고 서술한 그대로 구현됨. 함수 시그니처·에러 코드·기본값·검증 규칙·상태 전이 어느 것도 변경되지 않음(diff 는 `interaction.controller.ts`/`dto/responses.dto.ts` 미변경으로 wire 계약 불변 재확인).

## 요약

`getStatus()` 의 2단계 컬럼 projection 최적화는 §5.3 응답 스키마 9개 필드를 line-level 로 빠짐없이 재구성하며, `conversationThread` 의 "waiting_for_input 한정 노출 + null 값과 키 부재 구분" 계약을 정확히 보존한다. 위젯 §3.1 재동기화 계약도 이미 waiting-only 로 명시돼 있어 스코프 축소가 아니라 spec 이 이미 요구하던 범위로의 정합화에 가깝다. `updatedAt` fallback 체인처럼 projection 누락 시 침묵 회귀할 수 있는 지점은 실값 비교 테스트로 구체적으로 고정돼 있고, "재조회 row 소멸"·"대기 NodeExecution 부재" 등 diff 가 새로 만든 엣지 케이스도 모두 graceful 경로로 흡수되며 테스트로 커버된다. 발견된 사항은 기능적 결함이 아닌 주석 정밀도(500turn/4000자 cap 합성 근사치) 및 이미 문서화된 이론적 TOCTOU 간극(spec 미요구) 두 건의 INFO 뿐이며, CRITICAL/WARNING 급 요구사항 미충족은 없다.

## 위험도

NONE

---

STATUS: OK
