# 보안(Security) 리뷰 결과

리뷰 대상: `code-node-isolated-vm` 워크트리 — `isolated-vm@6.1.2` 전환 변경 세트  
리뷰 일시: 2026-06-11

---

## 발견사항

### **[WARNING]** 에러 메시지에 내부 에러 코드(`legacyCode`) 노출
- 위치: `code.handler.ts` — `failure()` 메서드, `outputDetails: { legacyCode: errorCode }` (line 400)
- 상세: `output.error.details.legacyCode` 로 내부 분류 코드(`CODE_RUNTIME_ERROR`, `EXECUTION_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED`)가 클라이언트에 노출된다. 이 값들은 내부 코드패스 분류 목적이나, 외부 사용자에게 노출되면 내부 아키텍처 정보를 제공한다. 심각한 취약점은 아니지만 정보 최소 노출 원칙(OWASP A05)에 어긋난다.
- 제안: `exposeStack` 판정과 동일하게 비프로덕션 환경에서만 `legacyCode` 를 포함하거나, 클라이언트 API 문서에 "내부 분류 전용, 분기 금지" 명시를 코드 레벨 가드로 강화. 현재 spec §5.3 의 "후속 노드 분기 금지" 안내로는 불충분.

---

### **[WARNING]** `classifyError` 의 문자열 패턴 매칭 — 에러 분류 스푸핑 가능성
- 위치: `code.handler.ts` — `classifyError()` 함수 (line 431–438), 특히 `/timed out/i` / `/memory limit/i` / `/Isolate was disposed/i` 정규식
- 상세: 사용자 코드가 `throw new Error("Isolate was disposed")` 또는 `throw new Error("memory limit exceeded")` 를 실행하면, 실제 격리 경계 위반이 없음에도 `EXECUTION_MEMORY_EXCEEDED` → `CODE_MEMORY_LIMIT` 로 잘못 분류된다. 공격 표면은 제한적이지만(sandboxed 실행 내부), 에러 코드를 신뢰 기반으로 분기하는 하위 워크플로우가 오분류로 인해 의도와 다른 분기를 실행하는 로직 조작(Logic Manipulation) 위험이 있다.
- 제안: `isolated-vm` 이 실제로 던지는 에러의 특성(에러 타입, 특수 속성, `err.code` 등)을 먼저 확인하고, 메시지 패턴보다 에러 타입/코드를 우선 사용. 현재 `err?.code === 'EXECUTION_TIMEOUT'` 처럼 코드 속성 확인이 이미 첫 번째로 시도되는데, `isolated-vm` 메모리/타임아웃 에러도 동일하게 처리 가능한지 검토.

---

### **[WARNING]** `$vars` 동기화 실패 시 변수 유출 방지 로직의 안전망 불명확
- 위치: `code.handler.ts` — `context.variables = varsClone` (line 329, catch 블록)
- 상세: `jail.get('$vars', { copy: true })` 실패 시 `varsClone`(실행 전 스냅샷)으로 롤백한다. 이 자체는 올바르나, 사용자 코드가 실행 도중 `$vars`에 민감 데이터(예: 다른 노드가 넣은 인증 토큰, API 키)를 임의 키로 추가했을 경우, `copy: true` 실패 이유에 따라 스냅샷 이전 값이 보존될 수도 있다. JSON-safe 검증 없이 `varsClone` 전체를 상위 컨텍스트에 돌려보내는 패스는 원래 설계 의도(롤백)와 맞지만, `$vars`에 무엇이 들어있는지에 대한 상위 레이어의 인가 검증이 명시적으로 없다.
- 제안: 설계상 허용된 패턴이지만, `$vars` 에 저장 가능한 값의 크기·깊이 제한(deepClone 이전)을 추가해 DoS 벡터와 정보 폭발 위험을 줄이는 것을 고려.

---

### **[INFO]** `syntaxIsolate` 공유 싱글턴의 재사용 — 정보 유출 가능성 미미
- 위치: `code.handler.ts` — `let syntaxIsolate: ivm.Isolate | undefined` (line 172), `syntaxCheck()` 함수
- 상세: `compileScriptSync()` 는 코드를 실행하지 않으므로 컨텍스트 간 격리는 유지된다. 다만 모듈 수준 싱글턴이므로 해당 격리가 disposed 되거나 오류 상태가 될 경우 재생성 로직이 없다. 현재 구현은 `syntaxIsolate` 가 disposed 상태일 때 `compileScriptSync` 가 throws 하면 `syntaxCheck` 가 해당 에러 메시지를 그대로 `validate()` 에 반환하고, `validate()` 는 `code has a syntax error: ${syntaxError}` 형태로 응답한다. `isolated-vm` 내부 상태 메시지가 사용자에게 노출될 수 있다.
- 제안: `syntaxIsolate.isDisposed` 확인 후 재생성 로직 추가. 에러 메시지에 `isolated-vm` 내부 식별자 포함 여부를 필터링하는 래퍼 적용 고려.

---

### **[INFO]** `BOOTSTRAP_SOURCE` 내 `globalThis` 삭제 후 재접근 가능성
- 위치: `code.handler.ts` — `BOOTSTRAP_SOURCE` 상수 (line 78–149), `delete globalThis[key]` 루프
- 상세: `globalThis` 자체를 삭제하는 것은 삭제 이후 `globalThis` 참조를 갖는 코드에서 `undefined` 접근이 발생할 수 있다. 다만 isolated-vm 환경에서 `globalThis` 삭제 자체의 동작(전역 객체 참조를 실제로 무효화하지 않음, 단순히 바인딩 삭제)은 완전한 격리를 보장하지 않는다. 이미 `isolated-vm` 의 V8 Isolate 경계가 실질적 방어를 제공하므로 독립 취약점은 아니다. 단, bootstrap 이전에 주입된 `__host_*` 콜백들이 삭제되지 않고 남아있는 window가 없는지 확인이 필요하다.
- 제안: bootstrap 완료 후 `__host_*` 키가 실제로 제거됐는지 확인하는 테스트 케이스를 추가(현재 테스트가 `process` 접근만 확인). `jail.get('__host_hash')` 가 `undefined` 를 반환하는지 확인하는 회귀 테스트 권장.

---

### **[INFO]** `deepClone` 의 `JSON.parse(JSON.stringify(...))` — ReDoS/대용량 입력 처리
- 위치: `code.handler.ts` — `deepClone()` 함수 (line 41–44), `varsClone = deepClone(context.variables)` (line 223)
- 상세: `context.variables` 가 매우 깊거나 순환 참조를 가질 경우 `JSON.stringify` 가 throw 한다. 순환 참조는 `TypeError` 로 처리되지만, 수천 개의 키 또는 수 MB의 값을 가진 변수 객체가 주입될 경우 동기적으로 처리되어 이벤트 루프를 일시 점유한다.
- 제안: `context.variables` 직렬화 크기를 상위 레이어(실행 엔진)에서 제한하는 정책이 있는지 확인. 없다면 `deepClone` 진입 전 바이트 크기 체크 추가 고려.

---

### **[INFO]** `readFileSync(require.resolve('dayjs/dayjs.min.js'))` — 모듈 경로 조작 가능성 검토
- 위치: `code.handler.ts` — `DAYJS_SOURCE` 초기화 (line 32–35)
- 상세: `require.resolve` 는 `node_modules` 내 실제 경로를 반환하므로 경로 탐색 공격 표면은 거의 없다. 다만 빌드/배포 환경에서 `dayjs` 패키지가 변조되거나 npm 공급망 공격(Supply Chain Attack, OWASP A06)이 발생할 경우 해당 UMD 소스가 isolate 내부에서 실행된다. lockfile (`package-lock.json`) 의 `integrity` 해시(`sha512-GGfsHq...`)가 등록되어 있어 기본 보호는 적절하다.
- 제안: 현재 lockfile integrity 검증으로 충분. CI에서 `npm ci` (clean install) 사용 여부 확인 권장.

---

### **[INFO]** `isolated-vm@6.1.2` — 알려진 취약점 현황
- 위치: `package.json`, `package-lock.json`
- 상세: `isolated-vm` 은 네이티브 addon 이다. 2026-06-11 기준 `6.1.2` 에 공개된 CVE 는 확인되지 않는다. 그러나 V8 Isolate 자체의 JIT 취약점은 주기적으로 보고되므로(예: 역사적 V8 sbx escape), Node.js / V8 버전 업그레이드 시 `isolated-vm` 호환성과 함께 보안 패치 여부를 추적해야 한다. `engines: { node: ">=22.0.0" }` 핀이 유효하고 현재 `node:24-alpine` 기반이므로 지원 범위 내.
- 제안: Dependabot 또는 동등한 도구로 `isolated-vm` 업데이트 알림 구성 권장. 다중 테넌트 확장 시 gVisor 등 추가 레이어 검토(spec §7.1 Rationale 언급대로).

---

## 요약

이번 변경의 핵심인 `node:vm` → `isolated-vm` 전환은 기존의 prototype-chain 탈출(host takeover) 취약점을 V8 Isolate 경계로 구조적으로 차단한 올바른 조치다. 호스트 객체가 isolate 내부에 존재하지 않으므로 `this.constructor.constructor('return process')()` 류의 공격이 격리된 realm 내에서만 동작하며 실질적 탈출이 불가능하다. 데이터 주입은 `ExternalCopy.copyInto()` 로 복사되고, 함수 브리지는 `ivm.Callback` 을 통해 타입 검증 후 처리된다. 식별된 주요 보안 우려는 두 가지다: (1) 내부 레거시 에러 코드(`legacyCode`)가 프로덕션 응답에도 노출되어 정보 최소 노출 원칙을 위반하고, (2) `classifyError` 가 에러 메시지 패턴 매칭을 사용해 사용자 코드가 의도적으로 조작된 에러 메시지를 throw 하면 에러 분류가 변경되어 하위 워크플로우 분기를 조작할 수 있다. 나머지 항목들은 방어 심층도 강화 또는 운영 주의사항 수준이다.

---

## 위험도

MEDIUM

STATUS: SUCCESS
