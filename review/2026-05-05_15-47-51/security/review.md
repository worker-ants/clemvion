### 발견사항

---

**[WARNING] HTTP 헤더 인젝션 — CRLF 검증 누락**
- 위치: `http-request.schema.ts` — `keyValueSchema` (`key`, `value` 필드)
- 상세: `key`와 `value`가 순수 `z.string()`으로 선언되어 있어 `\r\n` 문자가 포함된 값이 스키마 단계에서 거부되지 않는다. 예: `value: "Bearer xyz\r\nX-Injected: evil"`. HTTP 핸들러가 이 값들을 그대로 헤더에 삽입할 경우 CRLF 헤더 인젝션 공격이 가능하다.
- 제안: 스키마 수준에서 `z.string().refine(v => !/[\r\n]/.test(v), 'header value must not contain newline')` 으로 제한하거나, HTTP 핸들러에서 반드시 헤더 값의 CRLF를 strip 처리해야 한다.

---

**[WARNING] SSRF — URL 필드에 프로토콜·호스트 제약 없음**
- 위치: `http-request.schema.ts` — `httpRequestNodeConfigSchema.url` (`z.string().optional()`)
- 상세: URL 필드는 프로토콜(`file://`, `ftp://`, `gopher://`)과 호스트 범위(`169.254.0.0/16`, `10.0.0.0/8`, `127.0.0.1`)에 아무런 제한이 없다. 워크플로 실행자가 내부 메타데이터 서버(AWS의 `169.254.169.254` 등) 또는 사내 인프라에 요청을 보낼 수 있다.
- 제안: 스키마 또는 핸들러에서 허용 프로토콜을 `http`/`https`로 제한하고, 사설 IP 대역 차단 로직을 핸들러 실행 직전에 적용해야 한다.

---

**[INFO] `z.unknown().default('')` — 다운스트림 처리 시 타입 무결성 주의**
- 위치: `form.schema.ts` — `optionSchema.value`
- 상세: `value`가 `unknown` 타입이므로 object, array 등 임의 구조가 들어올 수 있다. 이 값이 SQL 쿼리 파라미터·HTML 렌더링·쉘 명령에 직접 사용되는 경우 인젝션 벡터가 된다. 스키마 자체의 문제는 아니나, 다운스트림 소비 코드에서 타입 확인 없이 `.toString()` 또는 템플릿 삽입이 이루어지지 않도록 주의가 필요하다.
- 제안: 핸들러 및 렌더러에서 `value`를 사용할 때 `typeof` 가드 또는 명시적 직렬화를 적용한다.

---

**[INFO] `verifySsl: false` 허용 — MITM 위험**
- 위치: `http-request.schema.ts` — `httpRequestNodeConfigSchema.verifySsl`
- 상세: 기본값은 `true`로 안전하지만, 사용자가 `false`로 설정할 수 있다. 이 옵션이 감사 로그나 UI 경고 없이 허용될 경우 운영 환경에서 MITM 공격에 노출된다.
- 제안: `verifySsl: false` 사용 시 핸들러 또는 메타데이터 `warningRules`에 경고 규칙을 추가하고, 실행 로그에 명시적으로 기록한다.

---

**[INFO] `passthrough()` 누적으로 인한 공격 표면 확대**
- 위치: `http-request.schema.ts` — `keyValueSchema`, `httpRequestNodeConfigSchema`, `httpRequestNodeOutputSchema` 전반
- 상세: 여러 스키마에 `.passthrough()`가 중첩 적용되어 있다. 이 자체는 의도된 확장성이지만, 향후 핸들러가 임의 필드를 반복문으로 순회(예: `Object.entries(header)` 전체를 HTTP 헤더로 전송)하는 실수가 발생하면 데이터 누출이나 헤더 오염으로 이어질 수 있다.
- 제안: 핸들러에서는 반드시 구조적 분해(`{ key, value }`)로 필요한 필드만 추출하고, passthrough 필드가 실제 HTTP 요청에 포함되지 않도록 코드 리뷰 기준을 명문화한다.

---

### 요약

이번 변경의 핵심 보안 위험은 두 가지다. 첫째, `keyValueSchema`의 `key`/`value` 필드에 CRLF 제거 로직이 없어 헤더 인젝션이 스키마 단계에서 차단되지 않는다. 둘째, `url` 필드에 프로토콜·사설 IP 제한이 없어 SSRF 경로가 열려 있다. 두 이슈 모두 스키마 수준에서 막지 못하면 반드시 핸들러 실행 직전에 방어 로직이 있어야 한다. `optionSchema.value`의 `unknown` 타입과 `verifySsl: false` 허용은 낮은 위험이지만 다운스트림 코드 품질과 운영 정책 수립이 필요하다.

### 위험도

**MEDIUM**