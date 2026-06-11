# 보안(Security) Review

## 발견사항

### [WARNING] MD5/SHA-1 허용 해시 알고리즘 — 암호학적으로 취약
- **위치**: `code.handler.ts` — `ALLOWED_HASH_ALGORITHMS` 상수 및 `hostHash()` 함수
- **상세**: `ALLOWED_HASH_ALGORITHMS` 에 `sha1` 과 `md5` 가 포함되어 있다. MD5 는 충돌 공격(collision attack)이 실용화되어 있고, SHA-1 은 SHAttered(2017) 이후 충돌 취약점이 증명되었다. 사용자 코드에서 `$helpers.crypto.hash("md5", data)` 또는 `$helpers.crypto.hash("sha1", data)` 를 호출하면 호스트 Node.js `crypto.createHash` 를 통해 해당 알고리즘으로 실제 해시를 계산한다. 이 API 가 체크섬 용도(무결성 검증 없이 식별자 생성 등)에만 사용된다면 위험도는 낮지만, 사용자가 암호학적 보안 목적(패스워드 해시 등)으로 이를 쓸 경우 결과물이 안전하지 않다. `spec/4-nodes/5-data/2-code.md §2.2` 는 단순히 "해시 생성 (md5, sha256 등)" 이라고만 기술하고 있어 사용자가 보안 목적 사용을 시도할 수 있다.
- **제안**: API 문서(spec §2.2)에 `md5`/`sha1` 은 비암호학적(non-cryptographic) 용도(체크섬, 레거시 시스템 호환)에만 적합하다는 경고를 명시한다. 장기적으로는 `md5`/`sha1` 을 허용 목록에서 제거하거나 `deprecated` 플래그로 분리하고, 암호학적 목적에는 `sha256` 이상을 사용하도록 안내한다.

---

### [WARNING] 스택 트레이스의 non-production 노출 — 정보 유출 경계 의존성
- **위치**: `code.handler.ts` — `failure()` 메서드, `exposeStack` 조건
- **상세**: `exposeStack = process.env.NODE_ENV !== 'production'` 조건으로 스택 트레이스를 `output.error.details.stack` 에 포함한다. 스택 트레이스는 내부 파일 경로(`code.handler.js`의 실제 경로), isolated-vm 라인 오프셋, 서버 내부 구조 정보를 노출한다. 코드 자체의 보안 제어는 올바르지만, 배포 시 `NODE_ENV=production` 이 반드시 설정되어야 한다는 운영 전제가 보안의 단일 의존점이 된다. `NODE_ENV` 가 `undefined` 이거나 `staging`/`test`/기타 값이면 스택이 노출된다. 또한 `spec §5.3.1` 샘플 JSON 에 `"stack": "Error: boom\n    at code-node.js:3:7"` 와 같이 스택이 기본 포함된 것으로 보여 사용자에게 해당 노출이 정상임을 암시한다.
- **제안**: `exposeStack` 조건을 `process.env.NODE_ENV === 'development'` 처럼 명시적 화이트리스트 방식으로 바꾸는 것을 검토한다. 혹은 스택을 `output.error.details.stack` 이 아닌 서버사이드 로그로만 남기고 응답 페이로드에서는 완전히 제거하는 방향을 고려한다. 현재 구조가 유지된다면 인프라 배포 체크리스트에 `NODE_ENV=production` 설정을 필수 항목으로 명문화한다.

---

### [WARNING] `output.error.details.legacyCode` 를 통한 내부 분류 코드 노출
- **위치**: `code.handler.ts` — `failure()` 메서드; `spec/4-nodes/5-data/2-code.md §5.3`
- **상세**: `output.error.details.legacyCode` 에 `EXECUTION_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED`, `CODE_RUNTIME_ERROR` 등 내부 에러 분류 코드가 항상(production 포함) 응답에 포함된다. spec 은 "후속 노드는 `output.error.code` 사용" 이라고 안내하지만, 이 내부 코드는 `classifyError()` 의 분류 로직 세부 사항과 에러 처리 내부 구조를 외부에 노출한다. 직접적인 취약점은 아니나 공격자가 에러 분류 경계(예: `EXECUTION_TIMEOUT` vs `CODE_RUNTIME_ERROR`)를 탐색하는 데 사용될 수 있는 정보다. 특히 W2(스푸핑 방어) 관련 우선순위 로직이 실제로 존재함을 간접적으로 암시한다.
- **제안**: `legacyCode` 를 production 환경에서도 노출해야 할 기능적 이유가 있는지 재검토한다. 후속 노드 분기 기준으로 실제로 사용되지 않는다면 production 에서 `details` 객체 자체를 생략하거나 `legacyCode` 만 제거하는 것을 고려한다.

---

### [INFO] `__host_b64encode` / `__host_b64decode` — 입력 유효성 검사 없음
- **위치**: `code.handler.ts` — `__host_b64encode`, `__host_b64decode` Callback 등록
- **상세**: `Buffer.from(String(data), 'utf-8').toString('base64')` 와 `Buffer.from(String(data), 'base64').toString('utf-8')` 는 `data` 를 `String()` 으로 강제 변환한 뒤 Buffer 에 넘긴다. 객체나 대형 배열이 전달될 경우 `String()` 변환이 `[object Object]` 등을 생성하지만 예외를 던지지 않는다. 현재 스펙 문서에서도 `$helpers.base64.decode("!!!not-valid-base64!!!")` 가 "silent-failure" (spec INFO 10) 임을 인정하고 있다. 보안 위협보다는 사용자 혼란 가능성이 크다. 단, 매우 큰 문자열이 `String()` 변환되면 메모리 압박이 발생할 수 있으나 isolate 메모리 리밋(128MB)과 copy-boundary가 이를 제한한다.
- **제안**: `typeof data !== 'string'` 검사를 `hostHash` 처럼 추가하고 비문자열 입력에 `TypeError` 를 던지도록 일관성을 부여한다.

---

### [INFO] `syntaxIsolate` 모듈 레벨 상태 — 장기 프로세스에서 격리 재사용
- **위치**: `code.handler.ts` — `syntaxIsolate` 모듈 변수, `syntaxCheck()` 함수
- **상세**: `syntaxIsolate` 는 모듈 레벨 shared 상태로, 프로세스 수명 내내 재사용된다. 이번 변경에서 `syntaxIsolate.isDisposed` 체크가 추가되어 OOM 후 재생성이 가능해졌다(W4/INFO#3). 이 isolate 는 코드를 **컴파일만** 하고 실행하지 않으므로 보안 위협은 낮다. 그러나 멀티-스레드 환경(클러스터 등)에서 동일 모듈 인스턴스가 공유된다면 동시 접근이 발생할 수 있다. 주석에 "JS is single-threaded so concurrent compiles serialize" 라고 명시되어 있어 현재는 안전하지만, 향후 worker_threads 등을 도입할 경우 재검토가 필요하다.
- **제안**: 현재 단일 스레드 Node.js 모델에서는 허용 가능하다. worker_threads 도입 시 스레드 로컬 격리로 변경을 검토한다.

---

### [INFO] `ISOLATE_MEMORY_LIMIT_MB` 하드코딩 — 런타임 조정 불가
- **위치**: `code.handler.ts` — `ISOLATE_MEMORY_LIMIT_MB = 128`
- **상세**: W15 주석에서 인지하고 있듯 128MB 가 하드코딩되어 있다. 다중 테넌트 환경에서 워크스페이스 플랜 또는 구성에 따라 메모리 제한을 다르게 적용하려 해도 코드 변경 없이는 불가능하다. 보안 위협은 아니지만, 제한이 충분히 낮지 않으면 메모리 DoS 위험이 있다.
- **제안**: W15 에서 제안하듯 `CODE_NODE_MEMORY_LIMIT_MB` 환경 변수로 추출하되 안전한 상한(예: 512MB 이하)을 강제한다.

---

### [INFO] 에러 메시지에 사용자가 제공한 알고리즘 문자열 직접 반영
- **위치**: `code.handler.ts` — `hostHash()` 함수, 에러 메시지
- **상세**: `throw new Error(\`Unsupported hash algorithm: "${String(algorithm)}". ...\`)` 에서 사용자 제공 `algorithm` 값이 에러 메시지에 직접 포함된다. 이 에러는 isolate를 통해 사용자 코드의 `error` 포트로 전달되므로 사용자가 자신이 입력한 값을 다시 받는 구조다. XSS 위협은 없다(JSON 응답이므로). 다만 `String(algorithm)` 변환이 매우 긴 문자열을 허용해 메시지가 과도하게 커질 수 있다.
- **제안**: 에러 메시지에 포함되는 알고리즘 문자열을 최대 길이로 자른다(예: 50자).

---

## 요약

이번 변경의 핵심은 `node:vm` 에서 `isolated-vm` (V8 Isolate)으로 전환하는 것으로, 이는 이전 sandbox escape 가능성(prototype-chain 탈출)을 구조적으로 제거한 긍정적인 보안 개선이다. `classifyError` 에 `isolate.isDisposed` 우선순위 도입으로 스푸핑 방어가 강화되었고, `syntaxIsolate` 재사용 시 disposed 체크 추가도 견고성을 높인다. 주요 보안 우려는 암호학적으로 취약한 MD5/SHA-1 이 `$helpers.crypto.hash` API 에 허용된 것(비보안적 용도라면 낮은 위험), 스택 트레이스 노출이 `NODE_ENV` 환경 변수에만 의존하는 점(운영 설정 누락 시 내부 구조 노출), 그리고 `output.error.details.legacyCode` 가 production 응답에 항상 포함되어 내부 분류 코드를 외부에 노출하는 점이다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회 문제는 없다. i18n 파일(`backend-labels.ts`) 변경은 순수 문자열 번역 추가로 보안 위험이 없다.

## 위험도

MEDIUM
