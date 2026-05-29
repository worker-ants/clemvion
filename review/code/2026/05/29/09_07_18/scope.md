# 변경 범위(Scope) 리뷰

## 리뷰 대상 커밋

Staged 변경 기준. 총 16개 파일, +708 / -52 라인.

---

## 발견사항

이 커밋은 두 가지 명시된 목표를 수행한다:

1. **Phase 3.1** — `ContinuationDlqMonitorService` + processor `onFailed` 신설 (BullMQ retry 율 / DLQ 알람).
2. **변경 2.3** — `resolveWaitingNodeExecutionId` sentinel 우회(`__no_node_exec__`) 제거, `InvalidExecutionStateError` 동기 throw 전환 + 3개 진입점(WS gateway / REST controller / EIA interaction.service) 반영.

각 점검 관점에 대한 세부 분석:

---

### 1. 의도 이상의 변경

- **[INFO]** `executions.controller.ts` — `continueExecution` 에 기존에 빠져있던 `await` 가 추가됐다. 이는 변경 2.3 의 직접 목적(동기 에러 surface)을 위해 필수적이며, 동시에 기존의 fire-and-forget 버그도 수정된다. 의도 이상이 아니라 범위 내 수정이다.
- **[INFO]** `interaction.service.ts` — 4개 dispatch 도 동일하게 `await this.dispatchContinuation(...)` 래핑으로 변경됐다. 기존 코드가 `void`(fire-and-forget) 였으므로 `await` 추가는 변경 2.3 동기 에러 전파를 위한 필수 변경이다. 범위 내.

### 2. 불필요한 리팩토링

없음. `resolveWaitingNodeExecutionId` 의 try/catch 재구조화는 "DB 실패와 비즈니스 실패를 구분"하는 변경 2.3 의 핵심 로직 변경이다.

### 3. 기능 확장 (over-engineering)

없음. `ContinuationDlqMonitorService` 는 plan `3.1` 에 명시된 항목이다. 환경변수 4개 + enabled 토글 + cooldown 모두 plan 에 언급된 범위다.

### 4. 무관한 수정

없음. 변경된 16개 파일은 모두 다음 중 하나다:
- Phase 3.1 DLQ 모니터 신규 파일 2개 (service + spec)
- 변경 2.3 에 의해 직접 영향받는 실서비스 파일 5개
- 위 변경에 대응하는 테스트 파일 5개
- plan 상태 갱신 2개
- spec 구현 상태 노트 갱신 1개 + execution-engine.module.ts 등록 1개

### 5. 포맷팅 변경

없음. 의미 없는 공백·줄바꿈 변경은 발견되지 않았다.

### 6. 주석 변경

- **[INFO]** `continuation-execution.processor.ts` — `onFailed` 메서드 JSDoc 추가. Phase 3.1 의 목적(retry/dead-letter 가시성) 설명으로, 신규 기능의 일부로 적절하다.
- **[INFO]** `execution-engine.service.ts` — `resolveWaitingNodeExecutionId` JSDoc 갱신. 기존 주석이 sentinel 반환 동작을 기술했으므로 변경 2.3 이후 실제 동작과의 괴리를 해소하기 위한 필수 갱신이다.
- **[INFO]** `InvalidExecutionStateError` 클래스 JSDoc 신설. 신규 exported symbol 에 대한 설명으로 적절하다.

### 7. 임포트 변경

- **[INFO]** `OnWorkerEvent` 임포트 추가 (`@nestjs/bullmq`) — `onFailed` 데코레이터 적용에 필요한 임포트. 사용됨.
- **[INFO]** `InvalidExecutionStateError` 임포트 — controller / gateway / interaction.service / 해당 spec 파일 4곳에 추가. 각 파일에서 실제로 사용됨.
- **[INFO]** `UnprocessableEntityException`, `ApiUnprocessableEntityResponse` 임포트 추가 (`executions.controller.ts`) — 422 응답 처리에 사용됨.
- 사용하지 않는 임포트 추가나 불필요한 정리는 없음.

### 8. 설정 변경

- **[INFO]** `execution-engine.module.ts` — `ContinuationDlqMonitorService` 를 providers 배열에 등록. Phase 3.1 신규 서비스 등록으로, 의도된 변경이다.

---

## 요약

변경 범위 관점에서 이 커밋은 plan에 명시된 두 항목(Phase 3.1 DLQ 모니터링, 변경 2.3 publisher 측 동기 에러 전환)을 정확히 구현한다. 16개 파일 모두 해당 두 목표와 직접 연결되며, 의도하지 않은 코드 영역의 수정, 관련 없는 리팩토링, 불필요한 포맷팅 변경은 발견되지 않았다. `await` 추가로 기존 fire-and-forget 버그가 함께 수정되는 부수 효과가 있으나, 이는 변경 2.3 의 동기 에러 전파를 위한 필수 변경이지 추가 scope가 아니다. spec 구현 상태 노트 갱신과 plan 상태 갱신도 각 변경이 완료됐음을 반영하는 정합적인 문서 수정이다.

## 위험도

NONE
