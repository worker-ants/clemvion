### 발견사항

---

**[WARNING]** `listModels()` 실시간 API 호출 — 결과 캐싱 없음
- 위치: `anthropic.client.ts:132-137`, `google.client.ts:490-507`
- 상세: 기존 하드코딩 목록 반환(`Promise.resolve(ANTHROPIC_MODELS)`)에서 프로바이더 실제 API 호출로 전환됐다. `preview-models` 엔드포인트에 Throttle(10/60s)이 있지만 같은 `(provider, apiKey)` 조합으로의 반복 요청마다 네트워크 왕복이 발생한다. 단일 사용자가 10회 연속 클릭하면 10회 모두 실제 API를 호출한다.
- 제안: 응답을 짧은 TTL(예: 60s)로 메모리 캐싱. 키는 `hash(provider + apiKey + baseUrl)`로 구성해 API Key 원문이 캐시 키에 노출되지 않도록 한다.

---

**[WARNING]** `withTimeout` — 타임아웃 후에도 네트워크 요청이 계속 실행됨
- 위치: `llm.service.ts:220-235`
- 상세: `Promise.race`로 30초 타임아웃을 구현하지만, 타임아웃 발생 후에도 `client.listModels()` 내부의 네트워크 요청은 취소되지 않는다. 요청이 결국 완료되거나 에러로 끝날 때까지 소켓/스레드 자원이 점유된다.
- 제안: `AbortController`를 생성해 `listModels()`에 `AbortSignal`을 전달하거나, 클라이언트 생성 시 HTTP 타임아웃 옵션을 직접 설정한다.

---

**[WARNING]** `google.client.ts` `listModels()` — 페이지네이션 상한 없음
- 위치: `google.client.ts:491-507`
- 상세: `for await (const m of pager)` 루프에 항목 수 제한이 없다. Google AI API가 수백 개 이상의 모델을 반환하기 시작하면 페이지 수만큼 추가 HTTP 요청이 발생하고 응답 시간이 선형으로 증가한다.
- 제안: 카운터를 두고 일정 수(예: 100개) 초과 시 early break하거나, SDK의 `pageSize` 파라미터로 최대 한 페이지만 조회한다.

---

**[INFO]** `google.client.ts` `embed()` — N개 직렬 호출에서 단일 배치 호출로 개선
- 위치: `google.client.ts:488-490`
- 상세: 기존 코드는 `texts.length`만큼 `embedContent`를 순차적으로 호출했다. 신 SDK의 배치 호출로 전환해 왕복 횟수가 N → 1로 감소했다. 성능 향상.
- 제안: 대용량 `texts` 배열의 경우 단일 요청 페이로드 크기 한도를 초과할 수 있으므로, 필요시 청크 분할(예: 최대 100개씩) 배치 처리를 고려한다.

---

**[INFO]** `buildGenerationConfig` — 조건부 스프레드 다중 사용
- 위치: `google.client.ts:140-168`
- 상세: 6개의 조건부 스프레드(`...(cond ? { key: val } : {})`)가 각각 임시 객체를 생성한다. 호출 빈도가 높은 경로(스트림 요청마다 호출)이지만 객체 크기가 작아 실질 영향은 미미하다.
- 제안: 가독성 손실 없이 최적화하려면 조건부 스프레드 대신 `if (cond) cfg.key = val` 방식의 직접 할당으로 교체한다.

---

**[INFO]** Jest `transformIgnorePatterns` 정규식 복잡도 증가
- 위치: `backend/package.json:124`
- 상세: 중첩 비캡처 그룹이 추가됐다. 테스트 전용이므로 프로덕션 성능에는 무관하나, pnpm 심볼릭 링크 구조에서 모든 `node_modules` 경로 매칭 시 정규식 역추적(backtracking)이 증가할 수 있다.
- 제안: 현 수준에서 실용적 문제는 없다. 필요시 정규식 성능 프로파일링 후 판단.

---

### 요약

이번 변경의 성능 핵심은 `listModels()` 구현 전환이다. 하드코딩 목록에서 실시간 프로바이더 API 호출로 바꾸면서 UI 정확도는 올라갔지만, 결과 캐싱 없이 요청마다 네트워크 왕복이 발생한다. Throttle로 남용을 막고 있지만, 같은 자격증명 반복 조회 시 캐싱이 없어 불필요한 API 비용이 발생한다. Google `embed()` 배치화는 명확한 성능 향상이다. `withTimeout`의 미취소 요청 문제는 자원 낭비이나 30초 후 자연 해소되므로 즉각적 장애 요인은 아니다.

### 위험도
**LOW**