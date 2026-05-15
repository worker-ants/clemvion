## 유지보수성 코드 리뷰

### 발견사항

---

- **[WARNING]** `pendingContinuations` Map의 명시적 정리 전략 미문서화
  - 위치: `execution-engine.service.ts` — `waitForButtonInteraction`, `waitForAiConversation`, `waitForFormInput` 함수 내 pendingContinuations 설정 구간
  - 상세: 타임아웃 기반 자동 cleanup이 모두 제거된 후, `pendingContinuations` 엔트리의 수명이 전적으로 외부 cancel에 의존한다. 클라이언트 비정상 종료, 서버 재시작, 네트워크 오류 등의 상황에서 pending 항목이 누적될 수 있는 구조임에도, 해당 Map의 정리 전략(execution cancel/fail 시 cleanup 로직 위치 등)에 대한 주석이 없다. 현재 코드를 처음 읽는 개발자는 메모리 누수 가능성을 오판할 수 있다.
  - 제안: `pendingContinuations` 선언부 또는 각 `pendingContinuations.set()` 호출 부근에 "실행 취소/실패 시 `X` 위치에서 cleanup됨"을 명시하는 주석을 추가할 것

---

- **[INFO]** `runExecution` 호출 중복 (두 브랜치에 동일 호출 존재)
  - 위치: `execution-engine.service.ts` — `executeSubWorkflow` 내 timeout/no-timeout 분기 (~line 640–650)
  - 상세:
    ```typescript
    if (timeoutPromise) {
      await Promise.race([this.runExecution(savedExecution, input), timeoutPromise]);
    } else {
      await this.runExecution(savedExecution, input);  // 동일 호출 반복
    }
    ```
    `Promise.race([p, null])`이 불가하여 분기가 불가피하지만, 향후 `runExecution` 호출 signature가 변경될 때 한 쪽 브랜치만 수정하는 실수가 발생할 수 있다.
  - 제안: 간단한 래퍼 패턴으로 중복 제거:
    ```typescript
    const executionPromise = this.runExecution(savedExecution, input);
    await (timeoutPromise ? Promise.race([executionPromise, timeoutPromise]) : executionPromise);
    ```

---

- **[INFO]** `executeSubWorkflow`의 `timeoutMs === 0` 코드 경로에 대한 서비스 레벨 테스트 누락
  - 위치: `execution-engine.service.ts` — `executeSubWorkflow` / `workflow.handler.spec.ts`
  - 상세: `workflow.handler.spec.ts`에 `timeout = 0` 유효성 검증 테스트가 추가되었으나, 실제 `timeoutMs === 0`일 때 `Promise.race`가 생략되고 `runExecution`이 직접 호출되는 서비스 레벨 동작에 대한 단위 테스트가 없다. 스펙 변경 취지(`0 = no timeout`)의 핵심 동작이 검증되지 않은 상태다.
  - 제안: `executeSubWorkflow`에 `timeoutMs: 0` 옵션 전달 시 timeout 없이 실행이 완료되는 시나리오 테스트 추가

---

- **[INFO]** `use-execution-events.ts`의 인라인 익명 타입
  - 위치: `frontend/src/lib/websocket/use-execution-events.ts` ~line 192
  - 상세:
    ```typescript
    convConfig?: {
      messages?: Array<{ role: string; content: string }>;
      turnCount?: number;
      maxTurns?: number;
    } | undefined;
    ```
    이 인라인 타입은 `turnTimeout`을 제거한 이번 변경에서도 그대로 유지됐다. 동일한 구조가 `execution-store.ts`의 `waitingConversationConfig`와 개념적으로 중복되며, 명명된 인터페이스가 없어 향후 필드 추가 시 동기화 실수가 발생하기 쉽다.
  - 제안: 공유 타입 파일에 `ConversationConfig` 인터페이스를 정의하고 두 곳에서 참조

---

- **[INFO]** `button.types.spec.ts` 테스트 설명이 의도를 정확히 전달
  - 위치: `button.types.spec.ts` — `'should ignore unknown buttonTimeout field (no longer supported)'`
  - 상세: 제거된 기능에 대해 "더 이상 지원하지 않음"을 명시하는 테스트 이름 패턴은 코드베이스 역사적 맥락 전달에 유용하다. 양호한 관행.

---

- **[INFO]** `execution-store.ts` 주석 업데이트
  - 위치: `frontend/src/lib/stores/execution-store.ts` line 328
  - 상세: `// Merge with existing config to preserve maxTurns, turnTimeout etc.` → `// Merge with existing config to preserve maxTurns etc.` — 제거된 필드를 주석에서도 정리한 것은 적절한 housekeeping이다.

---

### 요약

이번 변경은 timeout 관련 기능(버튼 타임아웃, 턴 타임아웃, 폼 타임아웃)을 스펙·백엔드·프론트엔드에 걸쳐 일관되게 제거한 대규모 정리 작업이다. `ButtonTimeoutError` 클래스 삭제부터 `pendingContinuations` 타이머 제거, 프론트엔드 카운트다운 UI 삭제, 스펙 문서 갱신까지 누락 없이 수행되었으며, 제거 후 잔류 참조나 데드코드가 없어 전반적인 유지보수성은 개선되었다. 다만 `pendingContinuations`의 생명주기 관리 전략이 문서화되지 않아 향후 개발자 혼란 가능성이 있고, timeout=0 경로의 서비스 레벨 테스트 부재가 회귀 리스크를 남긴다.

### 위험도

**LOW**