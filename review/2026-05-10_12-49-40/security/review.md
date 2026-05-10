## 발견사항

### [WARNING] HMAC 알고리즘 값 미검증
- **위치**: `hooks.service.ts`, `verifyAuth()` — `const algorithm = config.hmacAlgorithm ?? 'sha256';`
- **상세**: `config.hmacAlgorithm`은 DB에 저장된 값으로, `crypto.createHmac(algorithm, secret)` 호출 전 허용 알고리즘 화이트리스트 검증이 없습니다. 잘못된 알고리즘 문자열이 저장되어 있으면 `crypto.createHmac`이 `Error: Unknown message digest`를 throw하며 `verifyAuth()` 내에 try-catch가 없으므로 401 대신 500이 반환됩니다. 트리거 설정 편집 권한을 가진 사용자가 의도적으로 잘못된 알고리즘을 설정하면 해당 웹훅 엔드포인트를 영구 500 상태로 만들 수 있는 서비스 거부(DoS) 경로가 됩니다.
- **제안**: 허용 알고리즘 집합을 화이트리스트로 두거나, `verifyAuth()`에 try-catch를 추가해 파싱 오류를 401 UnauthorizedException으로 래핑하십시오.

```typescript
const ALLOWED_HMAC_ALGORITHMS = new Set(['sha256', 'sha1', 'sha512']);
const algorithm = config.hmacAlgorithm ?? 'sha256';
if (!ALLOWED_HMAC_ALGORITHMS.has(algorithm)) {
  throw new UnauthorizedException({ code: 'AUTH_FAILED', message: 'Unsupported HMAC algorithm' });
}
```

---

### [WARNING] `__triggerSource` 마커 스프레드 순서 취약점 (hooks.service.ts)
- **위치**: `hooks.service.ts:105` — `{ __triggerSource: 'webhook', parameters, ...input }`
- **상세**: JavaScript 객체 리터럴에서 나중에 오는 키가 앞선 키를 덮어씁니다. `...input`이 `__triggerSource` 뒤에 위치하므로, 런타임에 `input` 객체에 `__triggerSource` 프로퍼티가 존재할 경우 서버가 스탬프한 `'webhook'` 값이 덮어써집니다. TypeScript 타입(`WebhookInput`)은 이를 컴파일 타임에 방지하지만 타입 어서션이나 런타임 조작(e.g., 컨트롤러 레이어에서의 `as any` 처리)이 발생하면 우회될 수 있습니다. 비교: `workflows.controller.ts`는 `{ ...(body?.input ?? {}), __triggerSource: 'manual', parameters }`로 마커를 스프레드 **뒤**에 배치하여 올바르게 처리합니다.
- **제안**: `hooks.service.ts`도 동일하게 마커를 마지막에 배치하도록 수정하십시오.

```typescript
// Before (취약한 순서)
{ __triggerSource: 'webhook', parameters, ...input }

// After (방어적 순서)
{ parameters, ...input, __triggerSource: 'webhook' }
```

---

### [INFO] 웹훅 전송 필드 미살균화(raw passthrough)
- **위치**: `manual-trigger.handler.ts:133-138` — `output.request = { method, headers, query, body }`
- **상세**: `output.request.headers`, `output.request.body`, `output.request.query`는 외부 HTTP 요청의 원시 데이터를 변환 없이 그대로 실행 컨텍스트에 노출합니다. 다운스트림 노드(예: HTTP Request 노드)가 이 값을 검증 없이 사용하면 헤더 인젝션, SSRF 등의 2차 취약점이 발생할 수 있습니다. 현재 이 핸들러 자체는 passthrough 역할을 하므로 직접적인 취약점은 아니지만, 소비 노드에서의 추가 검증이 보장되어야 합니다.
- **제안**: 다운스트림 노드(특히 HTTP Request)가 `output.request.*`를 사용할 때 헤더 값에 대한 sanitize/allowlist 검증을 적용하도록 컨벤션으로 명시하십시오.

---

### [INFO] `body?.input` 임의 키 스프레드
- **위치**: `workflows.controller.ts:260` — `{ ...(body?.input ?? {}), __triggerSource: 'manual', parameters }`
- **상세**: 사용자가 요청 본문의 `input` 필드에 임의의 키를 포함시키면, 해당 키들이 실행 입력 객체에 포함됩니다. 핸들러는 출력 구성 시 명시적인 키만 사용하므로 데이터 누출은 없지만, 불필요한 사용자 데이터가 실행 엔진 내부까지 전달됩니다. `body.input`이 `{ __triggerSource: 'webhook', ... }`을 포함하더라도 이후에 `__triggerSource: 'manual'`로 안전하게 덮어써지므로 마커 오염은 방지됩니다.
- **제안**: 선택적으로 `body?.input`에서 허용된 키(`parameterValues` 등)만 화이트리스트로 추출하거나, 현재 설계 의도를 API 문서에 명시하십시오.

---

### [INFO] 후방 호환 웹훅 감지 로직 — 파라미터 이름 충돌 가능성
- **위치**: `manual-trigger.handler.ts:50-55` — `TRANSPORT_KEYS.some((k) => k in input)`
- **상세**: `__triggerSource` 마커가 없을 때 `body`, `headers`, `query`, `method` 키 존재 여부로 웹훅을 탐지합니다. 사용자가 이 이름으로 워크플로 파라미터를 정의하고 스케줄/매뉴얼 어댑터가 해당 값을 전달하면, 의도하지 않게 `'webhook'` 출처로 분류될 수 있습니다. 모든 어댑터가 `__triggerSource`를 올바르게 스탬프하므로 현재는 실질적 위험이 낮지만, 명시적 마커 없이는 예상치 못한 동작을 유발할 수 있습니다.
- **제안**: 현재 구현에서 모든 어댑터가 `__triggerSource`를 스탬프하므로 안전합니다. 폴백 경로는 문서상에 "어댑터 마커 누락 시 임시 대응"임을 명확히 하고 향후 제거를 검토하십시오.

---

## 요약

이번 변경은 `__triggerSource` 내부 마커를 서버 측 어댑터에서만 스탬프하고 핸들러가 output 노출 전 제거하는 방어적 설계를 채택하여 전반적으로 보안을 강화했습니다. HMAC은 `crypto.timingSafeEqual`을 사용한 상수 시간 비교로 타이밍 공격을 방지하고 있으며, Bearer 토큰 검증도 동일하게 처리됩니다. 다만 `config.hmacAlgorithm`의 화이트리스트 미검증으로 인한 잠재적 DoS 경로와, `hooks.service.ts`에서의 마커 스프레드 순서(`__triggerSource`가 `...input` 앞에 위치)는 런타임에서의 오버라이드 위험을 완전히 배제하지 못합니다. 나머지 발견 사항들은 정보성 수준으로, 직접적인 익스플로잇 경로는 없습니다.

## 위험도

**LOW**