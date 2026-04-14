## 발견사항

- **[INFO]** 무기한 대기 상태의 Execution 레코드 누적 가능성
  - 위치: `execution-engine.service.ts` — `waitForFormInput`, `waitForAiConversation`, `waitForButtonInteraction` (타임아웃 제거 부분)
  - 상세: 이전에는 타임아웃 로직이 `CANCELLED`/`FAILED` 상태로 전이시켜 DB 레코드를 정리했지만, 이번 변경으로 모든 자동 정리 경로가 제거됨. 서버 재시작 시 메모리의 `pendingContinuations`는 초기화되지만, DB에는 `waiting_for_input` 상태의 Execution 레코드가 영구적으로 잔존할 수 있음. 외부 cancel 없이 서버가 재기동되면 해당 레코드는 자동 전이 없이 DB에 계속 쌓임.
  - 제안: 서버 시작 시(`OnModuleInit`) `waiting_for_input` 상태의 오래된 Execution을 `failed` 또는 `cancelled`로 전이시키는 재기동 정리 로직(startup cleanup) 추가를 고려. 또는 별도 스케줄러로 일정 시간 이상 `waiting_for_input`인 레코드를 주기적으로 정리.

---

## 요약

변경된 코드는 타임아웃 기반 실행 종료 메커니즘을 제거하고 외부 cancel에만 의존하도록 아키텍처를 단순화하는 내용이다. 직접적인 DB 쿼리 패턴(N+1, 트랜잭션, SQL 인젝션, 인덱스)에 대한 변경은 없으며, 기존 `executionRepository.save` / `findOneBy` 사용 패턴도 그대로 유지된다. 단, 타임아웃 제거로 인해 서버 재시작 시나리오에서 `waiting_for_input` 상태 레코드가 DB에 무기한 누적될 수 있는 운영상 리스크가 존재한다. 이 부분에 대한 startup cleanup 또는 주기적 정리 전략이 있는지 확인이 필요하다.

### 위험도
LOW