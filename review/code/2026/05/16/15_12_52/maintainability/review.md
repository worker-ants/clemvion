# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts`

- **[INFO]** 새로 추가된 5개 테스트 케이스에서 보일러플레이트가 반복됨
  - 위치: 88–151번째 줄 (diff 기준), 즉 `PUT without shop_no`, `POST`, `PUT with only shop_no`, `GET never wraps` 테스트들
  - 상세: 각 테스트가 `fetchMock.mockResolvedValueOnce(makeJsonResponse({ ok: true }))` → `makeIntegration()` → `client.call(...)` → `fetchMock.mock.calls[0][1] as RequestInit` → `JSON.parse(init.body as string)` 패턴을 그대로 반복한다. 이는 이미 기존 `happy path` 케이스들에서도 반복되는 패턴이었는데, 이번 변경이 이를 더 누적시켰다. 테스트 가독성보다는 중복이 문제로, 추후 fetch mock 구조가 바뀔 경우 모든 케이스를 개별 수정해야 한다.
  - 제안: `assertEnvelopedBody(method, body, expectedEnvelope)` 형태의 작은 헬퍼를 추출하거나, `it.each` 테이블 형식으로 PUT/POST 케이스를 통합하면 반복을 줄이고 새 케이스 추가 비용을 낮출 수 있다.

- **[INFO]** 첫 번째 PUT 테스트에만 Content-Type 헤더 단언이 중복 포함됨
  - 위치: `cafe24-api.client.spec.ts` 기존 PUT 케이스 → 신규 첫 번째 PUT 케이스 (diff 77–85번째 줄)
  - 상세: `Content-Type: application/json` 단언은 이미 원래 테스트에서 검증되었다. 신규 케이스 중 첫 번째 PUT에만 이 단언이 남아 있고, 나머지 케이스(POST, 두 번째 PUT 등)에는 없다. 일관성이 부족하며, Content-Type 검증을 의도적으로 특정 케이스에만 넣은 것인지 실수인지 불명확하다.
  - 제안: Content-Type 헤더 검증이 필요하다면 별도 단일 케이스로 분리하거나, envelope 케이스들에서는 일관되게 제거해 본문 구조 검증에만 집중한다.

- **[INFO]** `GET — never wraps in envelope (no body)` 테스트에서 `init.body`가 `undefined`임을 단언하지만, GET 케이스 검증은 이미 파일 상단의 `'GET — builds mall-specific URL...'` 케이스에서도 `expect(init.body).toBeUndefined()` 로 다루어진다
  - 위치: diff 138–151번째 줄
  - 상세: 중복 커버리지 자체는 해롭지 않으나, 이 테스트의 존재 이유가 "envelope이 GET에 적용되지 않음을 특별히 핀"하는 것이라면 테스트 이름이 그 의도를 잘 담고 있다. 반면, 기존 GET 테스트와 단언 내용이 사실상 겹친다는 점에서 나중에 읽는 사람이 혼란을 겪을 수 있다.
  - 제안: 테스트 이름에 "Regression: envelope must NOT be applied to GET requests" 처럼 명시적인 이유를 기재하거나, 기존 GET 케이스에 envelope 단언을 추가하고 이 케이스를 제거하는 방안을 검토한다.

---

### 파일 2: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts`

- **[INFO]** `wrapInCafe24Envelope` 함수는 `shop_no`라는 특정 필드명을 하드코딩함
  - 위치: `cafe24-api.client.ts` 라인 2092–2095 (전체 파일 기준)
  - 상세: Cafe24 API 문서상 `shop_no`는 top-level에 허용되는 유일한 예외 필드다. 현재 구현은 이 규칙을 알맞게 하드코딩했고, 주석도 충분히 설명하고 있다. 그러나 `shop_no`라는 문자열 리터럴이 함수 본문에 직접 등장하므로, 만약 Cafe24 API가 향후 `shop_no` 외의 top-level 예외 필드를 추가할 경우 수정 지점을 찾기 위해 코드를 뒤져야 한다.
  - 제안: 현재 범위 내에서는 허용 가능한 수준이다. 향후 top-level 예외 필드가 늘어난다면 `CAFE24_ENVELOPE_TOP_LEVEL_KEYS = new Set(['shop_no'])` 형태의 상수를 모듈 상단에 두는 것을 고려할 수 있다.

- **[INFO]** `wrapInCafe24Envelope`의 반환 타입이 `Record<string, unknown>`으로 선언되어 있어 `shop_no`가 앞에 오거나 뒤에 오는 키 순서가 보장되지 않음
  - 위치: `cafe24-api.client.ts` 라인 2089–2096
  - 상세: `const envelope: Record<string, unknown> = { request: rest }; if (shop_no !== undefined) envelope.shop_no = shop_no;` 구조상 `shop_no`가 `request` 뒤에 위치하게 된다. Cafe24 API가 키 순서에 민감하지 않으므로 기능상 문제는 없다. 다만 `{ shop_no, request }` 순서로 선호할 경우 초기화 방식 조정이 필요하다.
  - 제안: `return shop_no !== undefined ? { shop_no, request: rest } : { request: rest };` 형태로 단순화하면 타입 표현과 키 순서 모두 명확해지고, 중간 `envelope` 변수를 제거해 함수가 더 짧아진다.

- **[INFO]** `executeWithRateLimit` 메서드는 이미 상당한 길이이며, 이번 변경으로 새 로직 경로가 추가됨
  - 위치: `cafe24-api.client.ts` 라인 1919–2040 (전체 파일 기준, 약 120행)
  - 상세: 이번 변경 자체는 한 줄(`wrapInCafe24Envelope` 호출) 추가에 불과해 복잡도 증가는 미미하다. 그러나 `executeWithRateLimit`는 URL 빌드 → 헤더 구성 → body 직렬화 → fetch 실행 → 타임아웃 처리 → 네트워크 실패 기록 → 레이트 리밋 재시도 → auth 실패 처리 → 응답 파싱까지 다수의 책임을 순차적으로 처리하고 있다. 현재로서는 각 단계가 직선적으로 흘러 가독성은 유지되나, 향후 추가 변환이 이 함수에 더 들어올 경우 분리 고려가 필요하다.
  - 제안: 단기적으로는 현행 구조 유지. 장기적으로 body 직렬화 단계(`buildBodyString(opts)`)를 별도 private 메서드로 추출하면 `executeWithRateLimit` 길이를 줄이고 테스트 isolation도 개선된다.

---

### 파일 3 & 4: `plan/in-progress/cafe24-request-envelope-fix.md`, `plan/in-progress/spec-update-cafe24-request-envelope.md`

- **[INFO]** plan 문서 내 "점검 사항"과 "변경 결과 확인" 섹션이 구현 코드와 일치하며, 읽는 사람이 변경의 범위를 빠르게 파악할 수 있도록 잘 작성되어 있음
  - 위치: `cafe24-request-envelope-fix.md` 전체
  - 상세: 특이 사항 없음. 문서 자체의 유지보수성은 양호하다.

- **[INFO]** `spec-update-cafe24-request-envelope.md` 의 `owner` frontmatter 값이 `developer (→ project-planner 위임 필요)` 로 자유 형식 텍스트가 포함되어 있음
  - 위치: `spec-update-cafe24-request-envelope.md` 2번째 줄 (frontmatter)
  - 상세: CLAUDE.md 의 frontmatter 스펙은 `owner: <역할/이름>` 으로만 정의하고 있다. "→ project-planner 위임 필요" 같은 메모를 owner 값에 넣으면 consistency-checker의 plan_coherence 검사나 자동화 파싱이 예상치 못한 값을 보게 된다. 프로젝트가 아직 이 필드를 기계적으로 파싱하지 않는다면 당장은 문제없지만, 향후 파싱 자동화 시 오탐 원인이 될 수 있다.
  - 제안: `owner: developer` 로 단순화하고, 위임 메모는 문서 본문의 "후속 처리" 절에만 기재한다.

---

## 요약

이번 변경의 핵심인 `wrapInCafe24Envelope` 헬퍼는 짧고 명확하며, 단일 책임(Cafe24 wire format 변환)을 완벽히 분리했다. 함수 주석, 테스트 커버리지(PUT with/without `shop_no`, POST, degenerate case, GET no-op), plan 문서 모두 의도와 근거를 충분히 설명하고 있어 가독성 측면에서 우수하다. 발견된 항목들은 테스트 내 패턴 반복, `wrapInCafe24Envelope` 내부의 미세한 리팩토링 여지, plan frontmatter의 형식 비일관성 등 INFO 수준의 사항뿐이며, 전체 코드베이스의 유지보수성에 실질적인 위협이 되지 않는다.

## 위험도

LOW
