## 성능 코드 리뷰 결과

### 발견사항

- **[WARNING]** `send-email.handler.ts` — 항상 동일한 값을 반환하는 dead branch `instanceof` 검사
  - 위치: `send-email.handler.ts` error catch 블록
  - 상세: `const code = err instanceof IntegrationError ? 'EMAIL_SEND_FAILED' : 'EMAIL_SEND_FAILED';` — 두 분기가 동일한 리터럴을 반환하므로 `instanceof` 체크 자체가 불필요한 연산
  - 제안: `const code = 'EMAIL_SEND_FAILED';` 로 단순화

- **[INFO]** `http-request.handler.ts` — 동일 URL에 대한 이중 파싱
  - 위치: `sanitizeUrlCredentials()` 함수 + 앞서 호출되는 `assertSafeOutboundUrl()`
  - 상세: `assertSafeOutboundUrl`이 이미 URL을 파싱·검증하는데, 이후 `sanitizeUrlCredentials`에서 다시 `new URL(raw)`를 호출. 성공 경로와 에러 경로에서 각각 한 번씩 호출되어 최소 1회 중복 파싱 발생
  - 제안: `assertSafeOutboundUrl`이 파싱된 URL 객체를 반환하도록 수정하거나, `sanitizeUrlCredentials`에 파싱된 URL을 인자로 넘겨 재파싱을 생략

- **[INFO]** `output-shape.ts: extractIeSnapshot` — fallback 체인 증가로 인한 traversal 심도 상승
  - 위치: `extractIeSnapshot()`, 새 `partial` 처리 블록
  - 상세: `partialTopLevel`, `partialNested`, `convConfig`, `unwrapNodeOutput` 순으로 4단계 fallback을 거치며 각 단계에서 `toRecord()`(object 복사 포함)를 최대 6회 호출. 실행 결과 폴링 중 매 렌더마다 호출되면 GC 압력이 누적될 수 있음
  - 제안: 한 번의 순회로 모든 후보 경로를 탐색하는 단일 함수로 병합하거나, live 경로와 history 경로를 명시적으로 분기해 불필요한 fallback 탐색 생략

- **[INFO]** `conversation-utils.ts: parseHistoryMessages` — 메타 조회를 위한 다중 object lookup
  - 위치: `topMeta` 산출 블록
  - 상세: `raw` → `meta` → `wrapper._turnDebugHistory` → `wrapper.metadata` 순으로 최대 4회의 개별 property 접근 + `as` 캐스팅이 중첩. 자체 비용은 낮지만, 이 함수가 스트리밍 메시지마다 호출될 경우 미세한 누적 비용 발생
  - 제안: 함수 상단에서 `raw`, `wrapper`, `topMeta`를 한 번에 구조분해하여 중복 lookup 최소화

---

### 요약

이번 변경의 핵심은 핸들러 출력 형상을 통일하는 구조적 리팩토링으로, 실행 엔진과 표현식 리졸버 등 핫 패스에 대한 알고리즘적 변화는 없다. 주요 성능 위험은 `send-email.handler.ts`의 dead branch (항상 같은 값을 반환하는 `instanceof` 분기)와 HTTP 핸들러에서의 이중 URL 파싱이며, 프론트엔드의 `extractIeSnapshot`·`parseHistoryMessages`는 backward-compatibility fallback 체인이 깊어져 GC 부담이 소폭 증가했다. 전반적으로 성능 위험은 낮은 수준이다.

### 위험도

**LOW**