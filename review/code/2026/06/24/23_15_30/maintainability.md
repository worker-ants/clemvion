# 유지보수성(Maintainability) 리뷰

**대상**: M-2 — ShutdownStateService shutdown 중 시작 노드 추적 포기 드리프트 수정
**검토 파일**:
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.spec.ts`
- `review/consistency/2026/06/24/22_32_23/` (산출물 파일 군)

---

## 발견사항

### [WARNING] 테스트 내 mock chain 순회 코드 — 가독성 저하 및 중복

- **위치**: `shutdown-state.service.spec.ts` 라인 81–88 (새 테스트), 라인 218–230 (`graceMs 초과` 테스트), 라인 268–276 (`WHERE 절` 테스트)
- **상세**: `createQueryBuilder → update → set → where` mock chain 결과를 손으로 순회하는 패턴이 세 군데에 반복된다. 각각 동일한 구조체 접근 방식(`(mock.results[0].value as { ... })`)을 사용하지만 서로 다른 체인 깊이를 추적해 읽는 비용이 높다. 특히 신규 테스트(`whereCall` 추출 시)와 기존 `WHERE 절` 테스트는 코드가 사실상 동일하다.
- **제안**: 헬퍼 함수를 추출한다.

  ```ts
  function extractNeWhereArgs(repo: typeof nodeExecutionRepo) {
    const chain = (repo.createQueryBuilder as jest.Mock).mock.results[0].value as { update: jest.Mock };
    const whereChain = (chain.update.mock.results[0].value as { set: jest.Mock })
      .set.mock.results[0].value as { where: jest.Mock };
    return whereChain.where.mock.calls[0];
  }
  ```

  이렇게 하면 두 테스트 모두 `JSON.stringify(extractNeWhereArgs(nodeExecutionRepo))` 한 줄로 단언할 수 있어 chain 변경 시 한 곳만 수정하면 된다.

---

### [WARNING] `pollMs` 매직 넘버 200 — 상수 미사용

- **위치**: `shutdown-state.service.ts` 라인 455 (`this.pollMs = pollMs ?? 200;`)
- **상세**: `graceMs` 의 기본값은 `DEFAULT_GRACE_MS` 상수로 분리되어 있으나, `pollMs` 의 기본값 `200`은 인라인 리터럴로 남아 있다. 이 숫자가 무엇을 뜻하는지(드레인 폴링 간격) 상수명 없이는 즉시 파악하기 어렵고, 값을 바꿀 때 매직 넘버를 직접 찾아야 한다.
- **제안**: `shutdown.constants.ts`에 `DEFAULT_POLL_MS = 200`을 추가하고 `this.pollMs = pollMs ?? DEFAULT_POLL_MS;`로 변경한다.

---

### [INFO] `registerInFlight` JSDoc — 삭제된 동작 설명 흔적 없음(양호) / 새 설명 길이

- **위치**: `shutdown-state.service.ts` 라인 488–499 (JSDoc 블록)
- **상세**: 옛 "shutdown 진행 중이면 무시" 설명이 깔끔하게 제거되고 M-2 결정 근거가 상세히 기록된 점은 긍정적이다. 다만 JSDoc이 11줄로 길어져 메서드 본체(1줄)보다 현저히 크다. spec 참조(§11.2, §4.2, §11.4)와 아키텍처 결정(WorkerHost lifecycle, queue.pause() 금지)이 혼재한다.
- **제안**: 현 상태는 허용 가능하다. 장기적으로 스펙 참조를 인라인 주석으로 남기고 아키텍처 결정 근거는 spec Rationale에 위임한다면 JSDoc을 3–4줄로 단축할 수 있다. 이번 변경에서 즉각 수정 필수는 아님.

---

### [INFO] 테스트 `it` 제목 길이

- **위치**: `shutdown-state.service.spec.ts` 라인 233
- **상세**: 새 테스트 제목이 82자로 길다. 맥락과 의도가 담긴 점은 좋으나, CI 리포트나 IDE의 테스트 탐색기에서 잘릴 수 있다.
- **제안**: `'shutdown 중 register 된 노드도 grace 만료 시 마킹된다 (M-2 §11.4)'` 정도로 단축 검토. 강제 사항 아님.

---

### [INFO] `waitForDrain` 내 `new Promise` 래퍼 — 일관성

- **위치**: `shutdown-state.service.ts` 라인 558 (`await new Promise<void>((resolve) => setTimeout(resolve, pollMs));`)
- **상세**: `setTimeout`을 `Promise`로 감싸는 패턴은 일반적이나, 코드베이스 내에 `sleep` 혹은 `delay` 유틸이 이미 존재한다면 중복이 된다. 현재 파일만 보면 일관성 이슈는 없다.
- **제안**: 코드베이스에 `sleep` 유틸이 있다면 교체 검토. 현재 범위에서는 변경 불요.

---

### [INFO] `markRemainingAsInterrupted` — 두 블록의 구조적 중복

- **위치**: `shutdown-state.service.ts` 라인 569–621 (NodeExecution UPDATE 블록, Execution UPDATE 블록)
- **상세**: 두 블록은 각각 `try/catch`, `createQueryBuilder().update().set().where().andWhere().execute()`, `logger.error()` 패턴이 거의 동일하다. 변경된 코드(이번 PR)는 이 부분을 수정하지 않으므로 현 PR 범위 외이다.
- **제안**: 중장기적으로 공통 private 메서드로 추출 검토. 이번 변경의 직접 문제는 아님.

---

## 요약

이번 변경(M-2)의 핵심 수정은 `registerInFlight`에서 4줄 early-return 제거이며, 구현 자체는 단순하고 명확하다. 서비스 코드의 가독성과 네이밍은 양호하고, 클래스 길이·순환 복잡도도 적정 수준이다. 주요 유지보수성 우려는 테스트 내 mock chain 순회 패턴의 중복(세 군데)으로, 리포지토리 mock 구조가 변경될 경우 같은 보일러플레이트를 여러 위치에서 수정해야 한다. `pollMs` 기본값 200이 상수 없이 인라인 리터럴로 남아 있는 점도 소소한 일관성 결함이다. 나머지 발견사항은 모두 INFO 수준의 장기 개선 사항이다.

---

## 위험도

LOW
