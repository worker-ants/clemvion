### 발견사항

- **[INFO]** `emitCancellationEvent`/`processInBatches` 추출과 "기각된 대안 — 재개 식별 필드 hydration 전용 헬퍼" 선례의 구분을 명시적으로 남길 가치
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 신규 `emitCancellationEvent` private 헬퍼(4 호출부 통합), `codebase/backend/src/common/utils/process-in-batches.ts`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "기각된 대안 — 재개 식별 필드 hydration 전용 헬퍼" (line ~1415)
  - 상세: 저장소에는 "여러 사이트를 공용 헬퍼로 묶는" 리팩터가 **명시적으로 기각된 선례**가 존재한다 — `ai-turn-executor`/`information-extractor` 의 재개 식별 필드 조립을 단일 `pickResumeIdentificationFields()` 로 묶는 안은 (1) 오탈자-안전 목적이 이미 타입 시스템으로 달성됨, (2) 두 노드의 타이핑 SoT 가 애초에 다름, (3) 세 사이트의 실제 shape 이 진짜로 다름(3필드/5필드+fallback/조건부 undefined), (4) 안정화 직후 코드에 대한 churn 비용을 근거로 채택하지 않았다. 이번 diff 는 정확히 그 대칭 케이스(여러 사이트를 공용 헬퍼로 묶음)처럼 보일 수 있으나, 대상 4 호출부(`cancelParkedExecution`/`markExecutionCancelled`/`markQueueWaitTimeout`/`markWebChatIdleTimeout`)는 `try{ emitExecution(status=CANCELLED, cancelledBy, error?) }catch{ logger.warn }` 구조가 **완전히 동형**이고 차이는 `cancelledBy` 값·`error` 유무·로그 prefix 세 파라미터로만 존재한다 — 기각 사유 (2)(3)이 성립하지 않는 반대 케이스다. `processInBatches` 도 마찬가지로 `WebChatIdleReaperService.reap`·`InteractionTokenService.reconcileTerminalRevocations` 의 "동일 chunk 루프" 를 명시 코드 주석으로 근거를 남기며 추출했다.
  - 제안: 현재로선 실질 충돌이 아니므로 조치 불요. 다만 향후 유사 추출 PR 에서 "왜 이번엔 헬퍼 추출이 §Rationale 기각 사례와 다른가" 를 판단할 근거가 필요하면, 본 항목처럼 "구조 동형 여부(shape 동일 vs 상이)" 기준을 §Rationale 에 한 줄 원칙으로 명문화하는 것을 고려할 수 있다 (강제 아님).

### 요약

diff 는 두 축으로 구성된다 — (1) `WebchatIdleReaperService`/`markWebchatIdleTimeout`/`findIdleWebchatExecutionIds`/`resolveWebchatIdleReapGraceMs` 등 식별자의 `Webchat`→`WebChat` 대소문자 정정, (2) 4개 취소-emit try/catch 사이트를 `emitCancellationEvent` 헬퍼로, 2개 BullMQ sweep 청크 루프를 `processInBatches` 유틸로 통합하는 behavior-preserving DRY 리팩터(+ 신규 유닛 테스트로 `cancelledBy` 3값 닫힌 union·`error` 키 present-when-available 계약을 고정). (1)은 `spec/data-flow/15-external-interaction.md`·`spec/data-flow/0-overview.md`·`spec/7-channel-web-chat/*` 가 이미 `WebChatIdleReaperService`/`markWebChatIdleTimeout` 표기를 SoT 로 쓰고 있었으므로 코드가 뒤늦게 spec 표기를 따라잡은 것이며 새 결정이 아니다. (2)는 `spec/5-system/14-external-interaction-api.md §R19`(EIA-RL-07)이 명시한 "`cancelledBy` 닫힌 union 을 확장하지 않는다", "EIA-RL-06 형 sweep 의 형제(동일 데이터소스·동일 전역-1회 패턴)" 원칙과 `spec/5-system/6-websocket-protocol.md` (`execution.cancelled` 페이로드 — user cancel 은 `error` 부재, system/timeout 은 `error.code` 동행) 규약을 그대로 보존하며, 기존 4 호출부의 관측 가능한 emit payload·로그 문구·에러 흡수 정책을 하나도 바꾸지 않는다. 기각된 대안 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 어느 것도 발견되지 않았다.

### 위험도
NONE
