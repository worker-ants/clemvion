# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 1: external-interaction.module.ts

- **[INFO]** JSDoc 의존성 목록이 실제 `TypeOrmModule.forFeature([Trigger, Execution, ExecutionToken, NodeExecution])` 와 일치하도록 갱신됨. 코드·JSDoc 불일치 해소. 별다른 이상 없음.

---

### 파일 2: interaction.service.ts

- **[INFO]** `SSE_SEQ_PLACEHOLDER = 0` 명명 상수 추출 — 마법의 숫자를 제거하고 의미를 명시. 기능 무변경.
  - spec §5.3: `seq` 항상 `0` placeholder 라는 동작은 이전부터 구현됐고 spec 의 `> 단 conversationThread snapshot 과 seq(항상 0 placeholder)는 SSE replay... 가 권위` 문구와 일치.
  - 반환값 경로 모두 `SSE_SEQ_PLACEHOLDER` 로 교체 완료.

- **[INFO]** `rawInteractionType` 변수명 교체(`it` → `rawInteractionType`) — 가독성 개선. 로직 동일. 세 분기 비교(`'form'`/`'buttons'`/`'ai_conversation'`) 모두 동일하게 적용.

- **[INFO]** `getStatus()` JSDoc 추가 — `outputData` 보안 제약, `seq` placeholder 동작 설명. 구현과 일치.

- **[INFO]** `getStatus()` 내 `updatedAt` 계산: `finishedAt ?? startedAt ?? new Date()`. `Execution` 엔티티에 `updatedAt` 컬럼이 없어 이 fallback 체인으로 대신하는데, running/waiting_for_input 상태에서는 `startedAt` 이 반환된다. 이는 "마지막 상태 변경 시각"이 아니라 "시작 시각"이다. spec §5.3 응답 형식은 `updatedAt: "ISO8601"` 만 명시하고 계산 규칙을 정의하지 않으므로 spec 위반은 아니나, 클라이언트가 `updatedAt` 을 "최근 변경 시각"으로 사용한다면 오해 가능. (사전 존재하는 제약이며 본 커밋 변경 범위 외.)

- **[WARNING]** spec §5.4 cancel 응답 필드명 drift (사전 존재, 본 커밋 미도입):
  - 위치: `interaction.service.ts` `cancel()` 메서드 + `responses.dto.ts` `InteractAckDto`
  - 상세: spec §5.3 preamble 및 §5.4 본문은 cancel 응답을 `{ executionId, status }` 로 표기하나, 코드는 `InteractAckDto`(`{ executionId, accepted, currentStatus }`)를 반환. 필드명이 `status` 가 아니라 `currentStatus`. 본 커밋이 변경한 내용은 아니나, 리뷰 범위(interaction.service.ts 전체 파일)에 포함되어 있어 표기.
  - 단, spec §5 preamble 의 `Rationale R14` 블록(`§5.1 InteractAckDto { executionId, accepted, currentStatus }, §5.4 { executionId, status }`)은 두 endpoint 가 다른 DTO 를 써야 한다는 의도로 읽힌다. 의도적 설계인지 표기 오류인지 판단 모호 → spec 담당자 확인 필요.

---

### 파일 3: node-execution.entity.ts

- **[INFO]** `@Index(['executionId', 'status'])` 추가. `synchronize: false` 로 TypeORM 이 DDL 을 자동 실행하지 않으므로 DB 변경 없음. V095 Flyway partial index 가 이미 적용되어 있음(파일 존재 확인). 기능·스키마 영향 없음.

- **[INFO]** JSDoc 에 `outputData` 보안 제약 명기. 구현 제약이 코드 가까이 문서화됨 — 필드 오용 예방. 유효.

---

### 파일 4: use-widget.ts (seedWaitingFromStatus)

- **[INFO]** 인라인 주석 → JSDoc 블록 변환. 의미·정책 상세화. 로직 무변경.

- **[INFO]** `seedWaitingFromStatus` JSDoc 의 의존성 배열 `[]` 설명: `dispatch`(stable) + `parseWaitingForInput`/`threadToMessages`(pure import)라 빈 배열이 안전하다고 기술. 실제 코드 `useCallback(..., [])` 와 일치. 클로저에서 외부 변경 state 를 캡처하지 않으므로 stale closure 위험 없음.

- **[INFO]** `status.context as WaitingForInputEvent` cast: `getStatus()` 가 반환하는 `context` 객체는 `{ interactionType, waitingNodeId, buttonConfig? | nodeOutput? }` 형태로, `WaitingForInputEvent` 의 top-level 필드와 정렬됨. `parseWaitingForInput` 이 `ev.interactionType`, `ev.waitingNodeId`, `ev.buttonConfig`, `ev.nodeOutput` 을 읽으므로 올바른 재사용.

- **[WARNING]** `seedWaitingFromStatus` 는 `start()` 경로에서 `await seedWaitingFromStatus(client, session)` 이후 `openStream(session, "0")` 을 호출한다. `seedWaitingFromStatus` 가 soft-fail 이므로, 네트워크 오류로 getStatus 가 실패해도 SSE 스트림은 열린다 — 이는 의도된 동작(JSDoc "soft-fail" 정책). 그러나 `seedWaitingFromStatus` 가 성공해서 `WAITING` 상태를 dispatch 했는데 직후 SSE replay 가 같은 이벤트를 재전송하면 `WAITING` 액션이 중복 dispatch 된다. `widgetReducer` 가 `WAITING` 를 멱등하게 처리하는지 확인이 필요하다.
  - 위치: `use-widget.ts` `start()` 내 `seedWaitingFromStatus` + `openStream` 순서
  - 제안: `widgetReducer` 의 `WAITING` 케이스가 현재 이미 동일 interactionType/nodeId 로 덮어쓰는 방식이라면 멱등 — spec §R6 설계 의도에 부합. 확인 후 문제 없으면 무시.

---

### 파일 5: spec/5-system/14-external-interaction-api.md (EIA-IN-07)

- **[INFO] [SPEC-DRIFT]** `EIA-IN-07` 에 `?lastEventId=0` 을 명시하면 버퍼 내 seq≥1 이벤트 전체를 replay 한다는 동작 설명 추가.
  - 배경: 코드(`use-widget.ts` `openStream(session, "0")`)는 이미 이 패턴을 구현해 동작 중. spec 이 구현을 따라잡는 갱신.
  - 판단: 코드가 명백히 옳고 spec 만 낡았던 케이스 — SPEC-DRIFT 적절. 코드 변경 불필요.
  - 갱신 대상: `spec/5-system/14-external-interaction-api.md` `§3.2 EIA-IN-07` 행 (이미 본 커밋으로 갱신 완료됨).

---

## 요약

본 커밋의 변경 4개는 모두 기능 보강/JSDoc/명명 개선 수준으로, 핵심 비즈니스 로직(`getStatus()` 쿼리 로직, `context` 구성 방식, `seedWaitingFromStatus` 실제 실행 흐름)은 무변경이다. `SSE_SEQ_PLACEHOLDER` 상수 추출과 `rawInteractionType` 변수명 교체는 기능 동치이며, `@Index` 데코레이터 추가는 `synchronize: false` 환경에서 DDL 영향이 없다. spec EIA-IN-07 갱신은 기존 구현 동작을 spec 에 반영하는 SPEC-DRIFT 해소다. `seedWaitingFromStatus` + `openStream` 중복 WAITING dispatch 에 대해 `widgetReducer` 멱등성 확인이 권장되나, 설계 의도("soft-fail + SSE replay 병용")와 일치하는 패턴이다. cancel 응답 `status` vs `currentStatus` 필드명 불일치는 사전 존재 문제로 본 커밋 범위 외. 전반적으로 요구사항 충족 수준은 높고 의도·구현 간 괴리가 없다.

## 위험도

LOW
