# 보안(Security) Review

## 발견사항

### [WARNING] `$helpers.crypto.hash` — 알고리즘 인자 무검증 (커맨드 인젝션 유사 위험)
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` — `buildHelpers()` 내 `crypto.hash`
- **상세**: `createHash(algorithm)` 호출 시 `algorithm` 인자가 사용자 코드에서 임의 문자열로 전달 가능하다. Node.js `crypto.createHash`는 허용되지 않는 알고리즘명에 대해 `ERR_OSSL_EVP_UNSUPPORTED` 또는 유사한 오류를 throw하며, 이 오류 메시지가 error output의 `message` 필드를 통해 사용자에게 노출된다. 직접적인 코드 인젝션은 아니나, 허용 알고리즘 목록을 화이트리스트로 제한하지 않으면 향후 OpenSSL 버전 차이로 인한 예상치 못한 동작이 가능하고, 오류 메시지를 통한 내부 OpenSSL 버전 정보 노출 우려도 있다.
- **제안**: `algorithm` 인자를 허용 목록(`['sha256', 'sha512', 'sha1', 'md5']` 등)으로 제한하고, 목록 외 값은 즉시 `throw new Error('Unsupported algorithm')` 처리.

```typescript
const ALLOWED_HASH_ALGORITHMS = new Set(['sha256', 'sha512', 'sha384', 'sha1', 'md5']);
hash: (algorithm: string, data: string): string => {
  if (!ALLOWED_HASH_ALGORITHMS.has(algorithm)) {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
  return createHash(algorithm).update(data).digest('hex');
},
```

---

### [WARNING] 스택 트레이스 — 비-production 환경 노출 정책 문서화 필요
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` — `failure()` 메서드, 라인 981
- **상세**: `process.env.NODE_ENV !== 'production'` 조건으로 스택 트레이스를 `output.error.details.stack`에 포함한다. 이 결과는 `NodeHandlerOutput.output`으로 반환되어 워크플로 실행 결과 API를 통해 클라이언트(프론트엔드, 채널 등)에 노출될 수 있다. 스택 트레이스에는 서버 내부 경로, 파일명, 라이브러리 버전 정보가 포함되며, 스테이징 환경이 `NODE_ENV=development`로 운영된다면 외부 접근 가능한 엔드포인트에서도 이 정보가 유출된다. 코드 내 주석에 "server-side debugging only (log ingestion pipeline, not rendered by the run-results UI)"라고 명시되어 있으나, API 응답에서 실제로 필터링되는지는 현재 diff 범위에서 확인 불가.
- **제안**: 스택 트레이스 필드를 `output`이 아닌 `meta`로만 내보내거나, API 레이어에서 `output.error.details.stack` 필드를 클라이언트 응답에서 제거하는 미들웨어가 있는지 확인 및 문서화. 현재 구조를 유지한다면 `exposeStack` 조건을 더 엄격하게(`process.env.EXPOSE_STACK === 'true'` 등 명시적 플래그)로 변경 권장.

---

### [WARNING] `$helpers.crypto.hash` — `data` 인자 타입 강제 없음 (잠재적 정보 누출)
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` — `buildHelpers()` 내 `crypto.hash`
- **상세**: `hash` 함수의 `data` 파라미터는 `string`으로 선언되어 있으나, 런타임에서 사용자 코드가 객체나 배열을 전달하면 `createHash(algorithm).update(data)` 호출 시 Node.js 내부 동작에 의존하게 된다. `update()`는 `string | Buffer | TypedArray | DataView`를 받으므로 TypeScript 타입 선언과 실제 런타임 허용 타입이 불일치한다. 악의적 사용자가 `$helpers.crypto.hash("sha256", largeObject)`로 대량의 메모리를 직렬화 시도하거나 예상치 못한 해시 결과를 이용할 수 있다.
- **제안**: 함수 진입부에서 `String()` 강제 변환 또는 타입 가드 추가:

```typescript
hash: (algorithm: string, data: unknown): string => {
  if (typeof data !== 'string') throw new Error('hash data must be a string');
  // ...
}
```

---

### [INFO] Sandbox — `Symbol` 셰도잉으로 인한 `well-known Symbol` 동작 변경 가능성
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` — `buildSandbox()`, `Symbol: undefined` 라인
- **상세**: `Symbol`을 `undefined`로 셰도잉하면 사용자 코드에서 `Symbol.iterator`, `Symbol.toPrimitive` 등 well-known Symbol에 접근할 수 없다. 이는 의도된 제한(spec §7)으로 보이며 보안 측면에서는 올바른 방향이다. 다만 `$helpers`에서 반환되는 dayjs 객체나 배열 등이 내부적으로 Symbol을 사용하는 경우, 샌드박스 외부(host realm 클로저)에서 이미 Symbol이 사용된 상태로 전달되므로 실제 동작에는 영향 없다. 현재 구현이 올바름을 확인했으나 향후 `$helpers` 반환 객체가 Symbol을 노출하는 방식으로 변경될 경우 주의 필요.
- **제안**: `$helpers` 반환 객체가 Symbol 속성을 포함하지 않음을 문서화 또는 테스트로 명시.

---

### [INFO] `$helpers.base64.decode` — 비-UTF-8 Base64 입력 처리
- **위치**: `/codebase/backend/src/nodes/data/code/code.handler.ts` — `buildHelpers()` 내 `base64.decode`
- **상세**: `Buffer.from(String(data), 'base64').toString('utf-8')`는 잘못된 Base64 입력이나 비-UTF-8 바이너리를 디코딩 시 `�` (replacement character)가 포함된 문자열을 반환한다. 오류를 throw하지 않으므로 사용자 코드가 잘못된 디코딩 결과를 정상으로 오인할 수 있다. 보안 취약점보다는 데이터 무결성 문제이나, 해당 결과가 이후 암호 검증 등에 사용될 경우 의도치 않은 통과 가능성 있음.
- **제안**: 현재 동작을 JSDoc 주석으로 명시하거나, strict 모드 옵션을 제공. 현 단계에서 critical 이슈는 아님.

---

### [INFO] 하드코딩된 시크릿 — 없음
- 변경된 코드 전체에 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿 없음. 확인 완료.

---

### [INFO] 인증/인가 — 핸들러 레벨 미적용 (설계상 의도)
- `CodeHandler`는 워크플로 실행 엔진이 호출하는 내부 컴포넌트로, 인증/인가는 상위 엔진 레이어에서 처리됨. 이번 변경은 핸들러 내부 sandbox API 확장이므로 인가 로직 추가는 불필요. 다만 `$node.id`와 `$node.label`이 사용자 코드에 노출되는 점은 메타데이터 노출이나 민감 정보가 노드 라벨에 포함되지 않도록 워크플로 작성 가이드라인 필요.

---

### [INFO] vm 샌드박스 — `codeGeneration: { strings: false, wasm: false }` 올바르게 적용됨
- `vm.createContext`에 `codeGeneration: { strings: false, wasm: false }` 옵션이 적용되어 `eval()`, `new Function()`을 통한 동적 코드 생성이 차단됨. 이번 변경에서 이 설정이 유지되는 것을 확인.

---

### [INFO] 의존성 보안 — `dayjs`
- `dayjs`가 신규 추가되었다. 현재 알려진 CVE는 없으나 버전 고정 및 정기 업데이트 정책 확인 권장. 기존 `package.json` 확인은 이번 diff 범위 밖.

---

## 요약

이번 변경의 핵심 보안 관심사는 sandbox 내부에 주입되는 `$helpers` 유틸리티, 특히 `$helpers.crypto.hash`의 `algorithm` 인자가 화이트리스트 없이 `node:crypto.createHash`에 직접 전달되는 점이다. 이는 허용되지 않는 알고리즘 명을 통한 내부 오류 메시지(OpenSSL 버전 등 정보) 노출과 예기치 않은 동작의 위험이 있다. 또한 비-production 환경에서 스택 트레이스가 API 응답으로 노출될 수 있는 경로가 있으며, 이를 API 레이어에서 확실히 필터링하고 있는지 확인이 필요하다. `setTimeout`/`setInterval`/`setImmediate` 명시 셰도잉, `vm.createContext`의 `codeGeneration` 제한, `eval`/`new Function` 차단, `globalThis` 셰도잉 등 sandbox 제한 조치는 전반적으로 올바르게 구현되어 있다. 하드코딩된 시크릿이나 인젝션 취약점은 없으며, 전체적인 보안 자세는 양호하나 위 두 WARNING 항목의 개선이 권장된다.

## 위험도

**MEDIUM**

(crypto.hash 알고리즘 무검증으로 인한 잠재적 정보 노출 + 스택 트레이스 노출 경로 미확인이 주요 근거. 원격 코드 실행이나 인증 우회는 없으므로 HIGH 미달.)
