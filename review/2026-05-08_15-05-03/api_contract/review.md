### 발견사항

- **[WARNING]** `config` 에코의 의미론적 파괴적 변경 (Breaking Semantic Change)
  - 위치: `http-request.handler.ts` — `buildConfigEcho()`, 이전 `configEcho` 인라인 구성
  - 상세: 이전에는 `config.method`, `config.url`, `config.authentication` 이 평가된(evaluated) 값을 반환했으나, 이제 `rawConfig.*` 에서 가져오므로 `{{ $input.endpoint }}`와 같은 raw 템플릿 문자열이 반환된다. 기존에 `$node["X"].config.url`·`$node["X"].config.body` 를 downstream 표현식에서 참조하는 워크플로가 있다면 평가된 값 대신 템플릿 문자열을 받게 된다.
  - 제안: CONVENTIONS §7 설계 결정임은 인지하나, 기존 워크플로 마이그레이션 가이드 또는 엔진 단의 호환 경고가 필요하다. 내부 표현 변경이 외부 expression resolver에도 영향이 없는지 `$node[].config.*` 참조 사례를 검토할 것.

- **[WARNING]** `requestBodyType`이 raw 값(템플릿) 참조 가능
  - 위치: `http-request.handler.ts` — `requestBodyOutput()` 내 `requestBodyType: rawConfig.bodyType`
  - 상세: `output.requestBodyType`은 실제 wire에 나간 evaluated bodyType을 표현해야 하지만 `rawConfig.bodyType`을 사용한다. `bodyType`이 표현식으로 설정된 경우(`{{ $input.type }}`) raw 템플릿이 그대로 노출되어 downstream 소비자가 유효하지 않은 값(`json`/`form-data` 아닌 문자열)을 받는다.
  - 제안: `requestBodyType`은 `config.bodyType`(평가된 값)을 사용하거나, 적어도 `serializeEvaluatedBody`에 bodyType을 함께 리턴하여 evaluated 값임을 보장할 것.

- **[INFO]** `responseHeaders: {}` 가 빈 응답 헤더에도 항상 포함됨
  - 위치: `http-request.handler.ts` — `requestBodyOutput()` 반환값
  - 상세: `sanitizeResponseHeaders(res.headers)`가 빈 객체 `{}`를 반환해도 `responseHeaders: {}` 키가 항상 포함된다. 반면 스키마는 `responseHeaders`를 `optional()`로 선언하므로 의미적 불일치가 존재한다. Transport 실패 시에는 `responseHeaders`가 omit되는 것과의 동작 차이가 명확히 문서화되어 있어 허용 범위 내이나, 일관성 측면에서 비어있을 때 omit하는 것이 스키마와 더 일치한다.
  - 제안: `Object.keys(responseHeaders).length > 0` 조건으로 빈 경우 필드를 생략하거나, 스키마에서 `optional()` 제거 후 항상 포함하도록 통일할 것.

- **[INFO]** `rawConfig ?? config` 폴백이 엔진 버그를 조용히 마스킹할 수 있음
  - 위치: `http-request.handler.ts:113`, `send-email.handler.ts:89`
  - 상세: 엔진이 `rawConfig`를 누락하는 경우 `config`(평가된 값)로 폴백되며, 오류 없이 평가된 값이 `config.*`에 포함된다. CONVENTIONS §7 위반이 런타임에 감지되지 않는다.
  - 제안: 프로덕션 환경에서 `rawConfig`가 없을 때 경고 로그를 남기는 것을 고려할 것. 현재는 테스트 전용 폴백이지만, 엔진 Phase 1 완료 후에는 `rawConfig` 부재를 에러로 처리해도 무방하다.

- **[INFO]** `config` 에코에 `body` raw 값 포함 — 하드코딩 시크릿 노출 가능성
  - 위치: `http-request.handler.ts` — `buildConfigEcho()` — `body: rawConfig.body`
  - 상세: 이전에는 `config`에 `body`가 포함되지 않았으나 이제 포함된다. 사용자가 `body`에 하드코딩된 시크릿(`{"api_secret": "hardcoded_value"}`)을 입력한 경우 NodeExecution 행과 websocket 이벤트에 raw body가 기록된다. URL credential strip처럼 body 내 민감 필드에 대한 추가 sanitization 정책이 없다.
  - 제안: 문서에 이 trade-off를 명시하거나, body 역시 credential-shape key를 REDACTED 처리하는 정책을 검토할 것.

---

### 요약

이번 변경은 CONVENTIONS Principle 7(raw config echo)을 HTTP Request 및 Send Email 핸들러에 구현하고, `output.requestBody`·`output.responseHeaders` 등 새 필드를 추가하는 Phase 2 마이그레이션이다. 스키마·핸들러·스펙 문서가 일관되게 갱신되었고, `sanitizeResponseHeaders`의 null guard 강화와 `truncateBodyForOutput` 256KB cap은 방어적으로 잘 구현되어 있다. 그러나 API 계약 관점에서 `config.*`가 raw 템플릿을 반환하는 것은 기존에 `$node[].config.url`이나 `config.body`를 downstream 표현식에서 참조하던 워크플로에 대한 **의미론적 파괴적 변경**이며, `requestBodyType`의 evaluated vs raw 값 혼용, 빈 `responseHeaders` 필드 항상 포함 등 소규모 API 계약 불일치가 존재한다.

### 위험도

**MEDIUM**