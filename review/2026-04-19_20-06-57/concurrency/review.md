### 발견사항

- **[INFO]** `_resumeState` 동시 재개 시 스냅샷 충돌 가능성
  - 위치: `ai-agent.handler.ts` — `_resumeState` 반환 블록 (line ~453, ~623, ~883)
  - 상세: 핸들러가 `_resumeState`를 반환하면 엔진이 이를 저장하고 다음 사용자 메시지 수신 시 주입한다. 동일 실행에 두 개의 사용자 메시지가 거의 동시에 도달하면 엔진이 두 재개 요청 모두에 **동일한 stale 스냅샷**을 주입할 수 있다. 변경된 코드 자체는 이 패턴을 도입하지 않았지만 `_multiTurnState` → `_resumeState` 명칭 변경으로 경계가 더 명확해졌으므로 엔진 측 직렬화(재개 큐 또는 낙관적 락)가 보장되는지 확인이 필요하다.
  - 제안: `execution-engine.service.ts`에서 동일 `executionId`의 resume 요청이 직렬화되는지 검증. 필요하면 재개 수신 즉시 `_resumeState`를 무효화(버전 카운터 또는 DB 레벨 CAS)하여 이중 소비를 방지.

- **[INFO]** `Date.now()` 이중 호출로 인한 `durationMs` 측정 오차
  - 위치: `send-email.handler.ts` catch 블록 — `logUsage` 호출과 `return` 구문에서 각각 `Date.now() - start` 계산
  - 상세: 동시성 버그는 아니지만 `logUsage` await 사이에 수 ms 차이가 발생해 로그와 출력의 `durationMs` 값이 불일치할 수 있다.
  - 제안: catch 진입 시점에 `const durationMs = Date.now() - start`를 한 번만 캡처해 두 곳에 재사용.

- **[INFO]** `execution-engine.service.ts` diff 누락 — 컨테이너 결과 수집 안전성 미확인
  - 위치: `execution-engine.service.ts` (diff omitted due to prompt size limit)
  - 상세: 테스트 변경(`items/iterations/mapped, count` 봉투)은 ForEach·Map·Loop의 결과 수집 로직이 수정되었음을 시사한다. 병렬 body 실행 시 결과 배열에 push하는 코드가 단순 `Array.push`라면 `Promise.allSettled` 병렬 실행 컨텍스트에서 인덱스 순서가 보장되지 않을 수 있다.
  - 제안: 결과 수집을 인덱스 기반(`results[i] = value`)으로 처리하거나, 수집 완료 후 정렬하도록 구현됐는지 확인.

---

### 요약

이번 변경의 핵심은 핸들러 출력 형태 표준화(레거시 포트 셀렉터 제거, `output.result.*` 통일)와 예외 전파를 에러 포트 라우팅으로 전환하는 것이다. 대부분은 순수 데이터 변환 또는 try/catch 래핑이므로 새로운 동시성 문제를 도입하지 않는다. 주목할 지점은 `_resumeState` 재개 패턴으로, 코드 자체는 올바르지만 동시 재개 직렬화가 엔진 레벨에서 보장되는지 별도 검토가 필요하다. 또한 `execution-engine.service.ts` diff가 누락되어 컨테이너 결과 수집 로직의 스레드 안전성을 직접 확인하지 못했다.

### 위험도
**LOW**