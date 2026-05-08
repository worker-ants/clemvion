## 발견사항

---

### [WARNING] `output.requestBodyType`에 평가된 값 대신 rawConfig 값 사용
- **위치**: `http-request.handler.ts`, `requestBodyOutput()` 클로저
- **상세**: `requestBodyType` 필드는 `rawConfig.bodyType`을 사용한다. `output.*` 필드는 CONVENTIONS Principle 7에 따라 **평가된** 값을 담아야 하는데, `bodyType`이 표현식으로 설정된 경우 `{{ $input.type }}`와 같은 미평가 템플릿이 `output.requestBodyType`에 노출된다. `requestBody` 자체가 평가된 바디임에도 불구하고 그 타입 필드가 raw 값인 것은 계약 위반이다.
  ```ts
  // 현재
  ...(rawConfig.bodyType !== undefined ? { requestBodyType: rawConfig.bodyType } : {}),
  // 의도한 동작
  ...(bodyType ? { requestBodyType: bodyType } : {}),
  ```
- **제안**: `requestBodyType`은 `rawConfig.bodyType` 대신 이미 평가된 지역 변수 `bodyType`(`(config.bodyType as string) ?? 'json'`)을 사용해야 한다.

---

### [WARNING] `bodyType` 기본값 'json'이 `output.requestBodyType`에 반영되지 않음
- **위치**: `http-request.handler.ts`, `requestBodyOutput()` 클로저
- **상세**: 사용자가 `bodyType`을 명시하지 않으면 평가된 `bodyType`은 `'json'`으로 기본화되지만, `rawConfig.bodyType`은 `undefined`이므로 `requestBodyType`이 출력에서 누락된다. 스펙 §2.3 예시는 `"requestBodyType": "json"`을 포함하고 있으며, 실제로 JSON으로 전송된 바디에 타입 필드가 없으면 다운스트림 노드가 바디 형식을 판단하지 못한다. 상기 WARNING과 동일하게 평가된 `bodyType`을 사용하면 이 문제도 해결된다.

---

### [WARNING] 스펙 §6.3 SMTP transport 생명주기 설명이 구현과 불일치
- **위치**: `spec/4-nodes/4-integration-nodes.md`, §6.3 Send Email
- **상세**: 스펙은 "SMTP transport를 **매 호출마다 생성하고** `finally`에서 `transporter.close()`한다"고 기술하나, 실제 구현(`send-email.handler.ts`)은 `integrationId + credentials hash` 기준으로 transport를 **캐시 재사용**하며, `close()`는 `shutdown()`/`invalidateTransport()` 호출 시에만 수행된다. 스펙이 구현 계약과 다르므로 이를 읽는 개발자가 잘못된 동작을 가정할 수 있다.
- **제안**: 스펙 §6.3을 "transport는 `integrationId + credentials hash` 기준으로 캐시되며 자격증명 변경 시 무효화된다"로 갱신한다.

---

### [INFO] transport 오류 경로에서 `requestBodyOutput()` 헬퍼 미사용으로 중복 코드
- **위치**: `http-request.handler.ts`, catch 블록
- **상세**: `try` 블록의 HTTP 오류 경로는 `requestBodyOutput()` 헬퍼를 사용하지만, catch 블록의 transport 오류 경로는 동일한 spread 로직을 직접 복사한다. `responseHeaders` 부재가 이유이나, `requestBodyOutput()` 내부에 조건 분기를 두거나 별도 `requestBodyFields()` 헬퍼를 추출하면 세 곳의 로직이 분산되는 유지보수 위험을 줄일 수 있다.

---

### [INFO] `config` 스키마의 `headers`/`queryParams` 타입이 레거시 형식 미포함
- **위치**: `http-request.schema.ts`, `httpRequestNodeOutputSchema`
- **상세**: `config.headers`와 `config.queryParams`를 `z.array(z.unknown())` 으로 선언하나, `buildConfigEcho`는 `rawConfig.headers`를 그대로 echo한다. 레거시 Record-shaped 입력(`{ 'X-Custom': 'val' }`)이 rawConfig에 있으면 스키마 타입과 실제 출력 형태가 불일치한다. `.passthrough()`로 런타임 에러는 발생하지 않으나 스키마 계약의 정확성이 떨어진다.
- **제안**: `z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional()`로 확장하거나, 스펙에 Record 형식을 지원 중단 예정임을 명시한다.

---

### [INFO] 스펙 §2.3 Success 예시의 `config.url` vs `config.body` 일관성 부재
- **위치**: `spec/4-nodes/4-integration-nodes.md`, §2.3
- **상세**: Success 포트 예시에서 `config.body`는 `"{{ $input.name }}"` 템플릿을 보여주지만 `config.url`은 평가된 URL `"https://api.example.com/users"`를 보여준다. 동일 예시 내에서 raw 필드와 평가 필드가 혼재하여 Principle 7의 동작을 직관적으로 전달하지 못한다.
- **제안**: `config.url`도 `"{{ $input.endpoint }}"` 형태의 템플릿으로 수정하거나, 별도 Note로 "URL도 표현식일 경우 raw 템플릿이 유지된다"고 명시한다.

---

## 요약

핵심 기능인 raw-config echo와 request/response body 노출은 전반적으로 스펙과 일치하게 구현되었으나, **`output.requestBodyType`에 평가된 `bodyType` 대신 `rawConfig.bodyType`을 사용하는 점**이 CONVENTIONS Principle 7 계약(output.*는 평가 결과)을 위반한다. 이로 인해 `bodyType`이 기본값에 의존하는 요청에서 `output.requestBodyType`이 누락되고, 표현식 기반 `bodyType`을 사용하면 미평가 템플릿이 output 필드에 노출되는 문제가 발생한다. 보안 관련 요구사항(자격증명 redact, URL credential strip, 바디 truncation)은 올바르게 구현되었으며, 스펙 §6.3의 transport 캐싱 설명 불일치와 스키마 타입 미완성은 추가로 정비가 필요하다.

## 위험도

**MEDIUM**