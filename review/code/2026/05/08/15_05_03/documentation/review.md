### 발견사항

---

**[WARNING] §1.3 공통 출력 구조가 §2.3 / §4.3 실제 구조와 불일치**
- 위치: `spec/4-nodes/4-integration-nodes.md` §1.3
- 상세: §1.3은 여전히 `"data": { ... }` + `"duration_ms"` 형태의 구 포맷을 보여주는데, 이번 변경으로 실제 출력은 `config` / `output` / `meta` / `port` 4-키 구조로 바뀌었다. 새로 합류하는 개발자가 §1.3을 먼저 읽으면 잘못된 멘탈 모델을 갖게 된다.
- 제안: §1.3 예시를 HTTP Request / Send Email 공통 골격(`{ config, output, meta, port }`)으로 교체하거나, "각 노드별 상세는 §2.3 / §4.3 참조" 안내로 대체.

---

**[WARNING] §6.3 Send Email 핸들러 반환 shape가 구 포맷**
- 위치: `spec/4-nodes/4-integration-nodes.md` §6.3
- 상세: §6.3의 "반환 shape" 예시는 `{ messageId, accepted, rejected, to, cc, subject, bodyType, status, durationMs }` 평탄 구조로, 이번 변경 후 실제 반환(`{ config, output: { messageId, accepted, … }, meta: { durationMs, deliveryStatus } }`)과 다르다. §4.3은 업데이트되었으나 §6.3은 누락.
- 제안: §6.3 반환 shape 예시를 §4.3 성공 예시와 동기화.

---

**[WARNING] `meta.duration` vs `meta.durationMs` 불일치가 문서에 명시되지 않음**
- 위치: `spec/4-nodes/4-integration-nodes.md` §2.3, §4.3
- 상세: HTTP Request는 `meta: { statusCode, duration }`, Send Email은 `meta: { durationMs, deliveryStatus }`를 사용한다. 두 노드의 필드명이 다르나 어디에도 이 차이가 의도적임을 명시하는 주석이 없다. 추후 DB Query 등 신규 노드 구현 시 혼동 가능성이 있다.
- 제안: §2.3 또는 §1.3에 "HTTP 노드는 `meta.duration(ms)`, 이메일 노드는 `meta.durationMs`" 처럼 노드별 편차를 명시하거나, 다음 리팩터 시 통일.

---

**[INFO] `sanitizeResponseHeaders` JSDoc — "mock-like inputs" 설명이 모호**
- 위치: `sanitize-response-headers.util.ts:57–65`
- 상세: "mock-like inputs that lack the iteration protocol" 문구는 왜 이 경로가 존재하는지(테스트 하네스에서 `.get()`만 stub된 객체 전달)는 설명하지만, 실제로 어떤 JavaScript 값이 해당하는지(`Symbol.iterator`가 없고 `instanceof Headers`도 아닌 비-null 객체) 명확히 드러나지 않는다.
- 제안: "objects that are neither `Headers` instances nor iterable (e.g. `{ get: jest.fn() }` mocks)" 처럼 한 줄 보강.

---

**[INFO] 출력 스키마의 `config.headers` 타입이 입력 스키마와 다르나 이유 미기재**
- 위치: `http-request.schema.ts:48`
- 상세: 입력 스키마(`httpRequestNodeConfigSchema`)는 `headers: z.array(keyValueSchema)`로 CRLF 검증을 포함하지만, 출력 스키마(`httpRequestNodeOutputSchema`)의 `config.headers`는 `z.array(z.unknown())`으로 느슨하다. 의도적이나 왜 더 느슨한지 설명이 없어 향후 실수로 조여질 수 있다.
- 제안: 출력 스키마 필드에 한 줄 주석: `// raw echo — validation is one-way (input-side only)`.

---

**[INFO] `requestBodyType`이 평가된 기본값(`'json'`)이 아닌 `rawConfig.bodyType`을 사용**
- 위치: `http-request.handler.ts:322–325`
- 상세: `rawConfig.bodyType`이 `undefined`이면 `requestBodyType`이 출력에서 생략된다. 하지만 실제로 body가 전송될 때는 `'json'`이 기본값으로 사용된다. 이 미묘한 동작(원시 값이 없으면 기본값도 echo하지 않음)이 코드 어디에도 문서화되어 있지 않아 spec 예시와 비교 시 혼동 가능성이 있다.
- 제안: `requestBodyOutput` 클로저 위에 한 줄 주석으로 "bodyType absent from rawConfig → omit requestBodyType (prefer raw fidelity over default inference)" 명시.

---

**[INFO] 테스트 파일의 `makeContext` 헬퍼 이중 정의**
- 위치: `http-request.handler.spec.ts:4–11`, 파일 내 최상위 `const context`(l.17)
- 상세: 파일 최상위에 `makeContext` 함수가 추가되었고, 기존에는 `const context` 리터럴이 `describe` 블록 안에 있다. 두 가지가 공존하는 이유(기존 테스트는 고정 컨텍스트, 신규 suite는 `rawConfig`가 필요한 가변 컨텍스트)가 자명하지 않아 다음 기여자가 중복처럼 보일 수 있다.
- 제안: 기존 `const context` 위에 `// legacy tests reuse a shared fixed context; new suites use makeContext()` 한 줄 추가.

---

### 요약

전체적으로 JSDoc과 인라인 주석은 변경 의도(CONVENTIONS Principle 7, raw-echo vs. evaluated 분리)를 충실히 반영하고 있으며, 스펙 문서 §2.3과 §4.3도 실제 구현과 잘 동기화되었다. 다만 **§1.3 공통 출력 구조**와 **§6.3 Send Email 반환 shape**가 구 포맷으로 남아 있어 스펙 내 일관성이 깨진 상태이고, HTTP와 이메일 노드의 `meta` 필드명 차이(`duration` vs `durationMs`)가 문서에 명시되지 않아 신규 노드 구현 시 혼동 가능성이 있다. 나머지 지적 사항은 표현 명확도 개선 수준이다.

### 위험도

**LOW** — 기능 동작에는 영향 없으나, §1.3·§6.3 스펙 예시 불일치는 개발자 온보딩 시 오해를 줄 수 있어 조기 수정이 권장됨.