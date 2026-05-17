# Code output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 사용자 `return` 값 root 자유 형태(Principle 8 예외) + 에러 시 표준 `output.error` envelope 분기 유지. (2026-05-16 구현 분석) **spec ↔ schema/handler 갭 3건 발견**: (a) `codeNodeConfigSchema` 에 `timeout` 필드 누락, (b) sandbox 에 `$node` / `$helpers` 미주입, (c) `setTimeout`/`setInterval`/`setImmediate` 명시 셰도잉 누락. 모두 사용자 가시 영향이 있어 spec 결정 후 impl 보강 필요.

> 대상 spec: `spec/4-nodes/5-data/2-code.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/5-data/2-code.md:130-148` — §5.1 정상 종료 (port `success`):

```json
{
  "config": { "language": "javascript", "code": "return $input.value * 2;", "timeout": 30 },
  "output": 42,
  "meta": { "durationMs": 7, "success": true, "logs": [] },
  "port": "success"
}
```

`spec/4-nodes/5-data/2-code.md:191-220` — §5.3.1 사용자 코드 throw (port `error`):

```json
{
  "config": { "language": "javascript", "code": "throw new Error('boom');", "timeout": 30 },
  "output": {
    "error": {
      "code": "CODE_EXECUTION_FAILED",
      "message": "boom",
      "details": { "legacyCode": "CODE_RUNTIME_ERROR", "stack": "Error: boom\n    at code-node.js:3:7" }
    }
  },
  "meta": { "durationMs": 5, "success": false, "logs": [] },
  "port": "error"
}
```

§5.3.2 타임아웃: `output.error.code: 'CODE_TIMEOUT'`.

## 진단

Code 는 사용자 정의 JS 실행 노드 (단계 1개). 정상 / 런타임 throw / 타임아웃 = 3 케이스.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = 사용자 `return` 값 | 적절 — Principle 8.2 예외 | spec footnote: "shape 은 사용자 코드가 결정. `output.result` 래핑은 적용하지 않음 — 개선안 §5 근거". Transform 과 동일 의도 (사용자 자유 형태 보존) |
| `output: undefined` (return 없음) 시 생략 | 적절 | Principle 11 |
| `output.error.{code, message, details?}` (런타임) | 적절 | Principle 3.2 |
| `output.error.details.legacyCode` | 적절 | 내부 분류용 (`CODE_RUNTIME_ERROR` / `EXECUTION_TIMEOUT`) — 후속 노드는 `output.error.code` 사용 |
| `output.error.details.stack` (`NODE_ENV !== 'production'` 한정) | 적절 | 프로덕션 내부 경로 노출 방지 |
| `meta.success: boolean` | 적절 (meta) | Code 노드 전용 편의 필드 (Principle 2 권장) |
| `meta.logs: string[]` (`console.*` 캡처, 100줄 cap) | 적절 (meta) | 디버깅 메트릭 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.language` / `config.code` / `config.timeout` (raw echo) | 적절 | Principle 7. `code` 는 expression 평가 안 됨 (`expression-exclusions`) |

부적절 항목 없음.

추가 점검:

1. **`output` root 자유 형태 (vs `output.result` wrapper)** — Transform 과 같은 의도. 사용자가 `return { items: [...] }` 하면 다운스트림이 `$node["X"].output.items` 로 직접 접근. wrapper 강제는 사용자 경험 악화. spec 명시 폐기.
2. **`output.error` (런타임) wrapper 사용** — 정상은 root 자유 형태이지만 에러는 표준 envelope. 시멘틱 분기로 합리적: 다운스트림은 `output.error` 존재 여부 / `port === 'error'` 로 판별.
3. **`meta.success` boolean 필드** — Principle 2 가 권장 필드로 명시 (Code 계열). `port === 'success'` 와 의미 중복이지만 expression 안정성을 위해 유지.
4. **`output.error.details.legacyCode`** — 내부 정규화 매핑 가시화. `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED` 매핑 spec footnote 표 참조.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// 정상
{
  "config": { "language": "javascript", "code": <raw>, "timeout": <number> },
  "output": <사용자 return 값 — primitive | object | array | undefined>,
  "meta": { "durationMs": <number>, "success": true, "logs": [<string>, ...] },
  "port": "success"
}

// 런타임 throw / 타임아웃
{
  "config": {...},
  "output": {
    "error": {
      "code": "CODE_EXECUTION_FAILED" | "CODE_TIMEOUT" | "CODE_MEMORY_LIMIT" /* 로드맵 */,
      "message": <string>,
      "details": {
        "legacyCode": <string>,
        "stack"?: <string>           // NODE_ENV !== 'production'
      }
    }
  },
  "meta": { "durationMs": <number>, "success": false, "logs": [<string>, ...] },
  "port": "error"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 (의도적 Principle 8 예외) |

## Rationale

- Code 노드는 사용자가 직접 정의한 JS 의 결과를 그대로 노출 — Transform 과 같은 "shape 자유" 패턴.
- 정상 vs 에러 시 `output` shape 이 다른 것은 시멘틱 분기 — `port` 또는 `output.error` 존재 여부로 판별. spec 이 명시.
- `meta.success` 는 Principle 2 가 명시 권장 — Code 계열 노드의 빠른 분기 키.
- 사용자 코드 throw 와 타임아웃을 모두 `port: 'error'` 로 흘리는 결정 (Data 공통 §4.1) 은 "사용자 코드의 throw / 타임아웃은 정상 시나리오의 일부" 라는 시멘틱 — 코드는 외부 호출과 같은 신뢰성 모델로 다루는 것이 합리적.
- 컴파일 실패는 pre-flight throw (사용자 코드를 단 한 번도 실행하지 못한 상태이므로 runtime 에러 포트 부적절).

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/data/code/{code.handler.ts, code.schema.ts, code.handler.spec.ts, code.schema.spec.ts, code.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - **정상 (`port: 'success'`)**: `code.handler.ts:199-208` 의 return `{ config: {code,language,timeout}, output: result, meta: {success:true, logs}, port: 'success' }` 가 spec §5.1 JSON 예시와 완전 일치.
   - **에러 (`port: 'error'`)**: `failure()` (`:225-275`) 가 `{ config, output: {error:{code,message,details:{legacyCode,stack?}}}, meta: {success:false, logs}, port: 'error' }` 반환 — spec §5.3 표와 일치. `details.stack` 은 `process.env.NODE_ENV !== 'production'` 일 때만 노출 (`:240, 252`) — spec §5.3 footnote "프로덕션에서는 내부 파일 경로 노출 방지로 생략" 일치.
   - **에러 코드 정규화**: `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED` (`:245-250`) — spec §5.3 footnote "에러 코드 정규화 매핑" 표와 일치. `details.legacyCode` 에 원본 보존 (`:251`).
   - **`meta.error` / `meta.errorCode` / `meta.stack` 제거** (`:243` 주석 명시 — Phase 1 (D) 마이그레이션): 테스트 (`code.handler.spec.ts:156-165`) 가 명시 검증. spec footnote 와 일치.

2. **schema ↔ spec config 정합성 (gap 발견)**:
   - spec §1 표: `language` (필수, default `javascript`), `code` (필수, default `''`), **`timeout` (선택, default 30, 1-120초)**.
   - `code.schema.ts:37-57` 의 `codeNodeConfigSchema` 는 `language` + `code` 만 정의 — **`timeout` 필드가 zod schema 에 없다** (`.passthrough()` 가 있어 런타임에는 통과하지만, frontend NodeConfigForm 이 schema 기반으로 UI 를 자동 생성한다면 spec §2 UI mockup 의 "Timeout : [30] sec (1–120)" 슬라이더가 렌더되지 않는다).
   - `code.handler.ts:130-131` 은 `typeof config.timeout === 'number' ? config.timeout : DEFAULT_TIMEOUT_SEC` 로 fallback — handler 동작은 spec 일치. `validateCodeConfig` (`code.schema.ts:76-93`) 도 timeout 범위 검증을 imperative 로 구현. 즉 spec ↔ handler/validate 는 일치하지만 **spec ↔ schema 가 비대칭**.

3. **validate 일관성**:
   - `code.handler.ts:99-122` 의 `handler.validate()` = `evaluateMetadataBlockingErrors(metadata, config)` (warningRules `code:no-code` + `validateCodeConfig` SSOT) + 비-string code guard + **vm.Script syntax check**.
   - vm.Script syntax check (`:113-120`) 는 사용자 코드를 한 번도 실행하지 못한 상태이므로 pre-flight throw 로 분류 (spec §6 "code 컴파일 실패" 표 row). CONVENTIONS Principle 3.1 부합.
   - `execute()` 의 second-pass syntax check (`:151-157`) — engine 이 validate 를 호출했다면 도달 불가능. 안전망으로 throw (handler 가 engine 외부 경로로 호출되는 경우 대비). 테스트 `code.handler.spec.ts:167-173` 이 명시 검증.

4. **에러 컨트랙트 (Principle 3)**:
   - Pre-flight throw 5종 (`code.handler.spec.ts:23-81` + spec §6): `code` 빈/누락, 비-string, `timeout` 범위 밖, `language` enum 미일치 (zod), syntax error. 모두 throw 로 처리.
   - Runtime `port:'error'` 2종 (spec §5.3): 사용자 코드 throw, timeout (sync `vm.runInContext timeout` + async `Promise.race`). `code.handler.ts:161-179` 의 sync timeout 캐치 + `:181-193` 의 async race 가 이중 적용 (spec §7.2 "이중 적용" 부합).
   - 메모리 초과는 spec §5.3 footnote 에 `CODE_MEMORY_LIMIT` 로드맵 — 현재 `node:vm` 한계로 미구현. handler 코드에 `EXECUTION_MEMORY_EXCEEDED` 케이스 분기 없음. 일관.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `config` (raw echo) ↔ `output` (사용자 return 값 / error envelope) 직교. 부합.
   - Principle 2: `meta.success` (Code 권장), `meta.logs` (디버깅 메트릭). 부합. `meta.durationMs` 는 엔진 inject — handler return 에 없음.
   - Principle 3.2: `output.error.{code, message, details?}` envelope 표준. `details.legacyCode` / `details.stack?` 노드별 확장. 부합.
   - Principle 5: `port: 'success' | 'error'` 정적 분기. 부합.
   - Principle 7: `rawConfigForEcho = context.rawConfig ?? config` (`:159`) 로 raw echo. expression-exclusions 가 `code` 필드를 제외 (`expression/expression-exclusions.ts:8`) — 사용자 코드는 평가되지 않으므로 raw 와 evaluated 가 동일. 부합.
   - Principle 8.2 예외: 정상 시 `output` root 자유 형태 (spec footnote 명시). 에러 시 `output.error.*` envelope. 합리적 분기.
   - Principle 11: `output: undefined` 시 JSON 예시에서 생략 (`code.handler.spec.ts:175-183` 가 검증). 부합.

6. **handler 테스트 (`code.handler.spec.ts`)**:
   - validate 7건 (`:23-81`) — spec §6 표 row 5종 모두 커버 + empty code 시 syntax check 미실행 보장.
   - execute basic 11건 (`:83-217`) — 동기/비동기, top-level await, runtime throw 정규화, deprecated `meta.error/errorCode/stack` 미발생 검증, config echo 정상/에러 양쪽.
   - **security 11건** (`:219-317`) — `require` / `process` / `global` / `Buffer` / `fetch` / `setTimeout` / `setInterval` / `setImmediate` / `Reflect` / `Proxy` / `globalThis` / dynamic `import()` / `eval` / `new Function` / approved globals / console.log 캡처 / 100줄 cap 모두 검증.
   - timeout 2건 (`:319-355`) — 동기 무한루프 (vm timeout) / 비동기 무한 대기 (Promise.race) 모두 `CODE_TIMEOUT` 정규화.
   - `$vars` atomic replace 2건 (`:357-378`) — 정상 시 전체 교체, throw 시 롤백.
   - **누락**: spec §2.1 의 `$node` (현재 노드 메타데이터 `{id, label}`) 및 §2.2 의 `$helpers` (date/crypto/uuid/base64) 가 sandbox 에 노출되는지 검증하는 테스트 부재 — 다음 §8 gap 참고.

7. **횡단 일관성 (Data 2종)**:
   - Transform / Code 모두 정상 시 `output` root 자유 형태 — "shape 자유" 패턴 일관 (Principle 8.2 예외 두 노드 동일).
   - Code 만 runtime 에러 포트 (`error`) 보유. Transform 은 pre-flight throw 만. 차이는 시멘틱 (Code = 외부 I/O 동급 신뢰성, Transform = 순수 변형) 으로 정당.
   - `meta.success` 가 Code 만 사용 (Transform 은 `operationsApplied`/`operationsSkipped`). spec Data 공통 §4 의 카테고리별 패턴 차이 일치.

8. **구현 품질 — sandbox 안전성 (gap 발견)**:
   - **gap (a) — `$node` / `$helpers` 미주입**: `buildSandbox` (`code.handler.ts:35-90`) 는 `$input` / `$vars` / `$execution` / `console` / 기본 globals 만 주입한다. **spec §2.1 의 `$node` (현재 노드 메타데이터 `{id, label}`) 와 §2.2 의 `$helpers` (`date`/`crypto.hash`/`crypto.uuid`/`base64.encode`/`base64.decode`) 는 sandbox 에 노출되지 않는다**. 사용자가 코드에서 `$node` / `$helpers` 를 참조하면 `ReferenceError` 발생 → runtime 에러로 분기됨. spec §2.1 / §2.2 / §7.3 "허용" 표가 약속하는 컨텍스트와 불일치.
   - **gap (c) — 명시 셰도잉 누락**: spec §7.3 "차단" 표는 `setTimeout` / `setInterval` / `setImmediate` 를 "비결정적 스케줄링 차단 (Promise.race 타임아웃 흐름 단순화)" 으로 명시하지만 `buildSandbox` 의 셰도잉 목록 (`:78-89`) 에는 이 셋이 없다. 테스트 (`code.handler.spec.ts:226-228`) 는 셋 다 `result.meta.success === false` 만 확인 — 실제로는 `node:vm` 의 격리 context 가 host globals 를 노출하지 않기 때문에 `setTimeout` 등이 `undefined` 라 `TypeError` 가 발생해 통과한다. 즉 우연한 통과이지 명시 차단이 아니다. spec 의 의도 (셰도잉으로 명시 차단) 와 실제 동작 (격리 context 의 기본 동작에 의존) 사이의 의도 차이.
   - **이중 타임아웃 (spec §7.2 부합)**: vm.Script timeout 옵션 (sync 무한루프) + outer `Promise.race` 의 `setTimeout` reject (async 무한 대기). `timeoutHandle` 의 `clearTimeout` finally 블록 (`:220-222`) 으로 leak 방지.
   - **`$vars` 보호**: `deepClone(context.variables)` (`:135`) 로 격리. 정상 종료 시 `context.variables = varsClone` (`:194`) — 전체 교체 (spec §4.5 부합). throw 시 `context.variables` 미변경 (롤백).
   - **codeGeneration 차단**: `vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } })` (`:143-145`) — `eval` / `new Function` / WASM 차단. spec §7.1 표와 일치.
   - **dynamic import / require / fetch**: `vm.createContext` 가 모듈 로더를 제공하지 않으므로 dynamic `import(...)` 는 SyntaxError, `require` / `fetch` 는 `ReferenceError`. 테스트 검증 완료.
   - **로드맵 (`isolated-vm` 또는 컨테이너)**: spec §7.1 표가 명시 — 메모리 하드 리밋(128MB) 필요 시 전환. 현재 미구현은 의도된 트레이드오프 (배포 단순성).

## 종합 개선안 (2026-05-16)

- [ ] (spec) `codeNodeConfigSchema` 에 `timeout` 필드를 추가할지 확정 — spec §1 표가 `timeout: Number, 기본 30, 1-120초` 로 명시하고 §2 UI mockup 이 "Timeout : [30] sec (1–120)" 슬라이더를 보여주지만, 현 zod schema (`code.schema.ts:37-57`) 에는 `timeout` 정의가 없다. frontend NodeConfigForm 의 자동 UI 생성 동작에 영향. 결정 후 (a) schema 에 추가 또는 (b) spec 표/UI 에서 "schema 외 imperative 검증" 으로 명시. 근거: spec `2-code.md:9-17` ↔ `code.schema.ts:37-57`.
- [ ] (impl) `codeNodeConfigSchema` 에 `timeout: z.number().min(1).max(120).default(30).meta({ ui: { label: 'Timeout (sec)', widget: 'number' } }).optional()` 추가 — 위 spec 결정에서 (a) 노선일 경우. 기존 `validateCodeConfig` 의 imperative 검증과 zod 의 default/range 가 중복되지만 `validateCodeConfig` 가 비-numeric/Infinity/NaN 등 zod 가 놓치는 케이스를 잡으므로 둘 다 유지. 근거: `code.schema.ts:76-93` (imperative validator), `code.handler.ts:130-131` (fallback).
- [ ] (impl) `buildSandbox` 에 `$node` 와 `$helpers` 주입 — spec §2.1 / §2.2 / §7.3 "허용" 표가 약속한 두 컨텍스트 객체가 실제 sandbox 에 없다. `$node` 는 `context` 의 `nodeId` / `nodeLabel` (또는 metadata 에서 얻는 형태) 으로 노출, `$helpers` 는 `dayjs` + `node:crypto` 의 `createHash` / `randomUUID` + `Buffer.from(...).toString('base64')` 등을 래핑. 근거: `code.handler.ts:35-90` ↔ `spec/4-nodes/5-data/2-code.md:60-78`.
- [ ] (impl) `buildSandbox` 의 명시 셰도잉 목록에 `setTimeout` / `setInterval` / `setImmediate` 를 `undefined` 로 추가 — spec §7.3 차단 표 명시. 현재 `node:vm` 격리로 우연 차단되지만 명시 셰도잉이 spec 의도. 근거: `code.handler.ts:78-89` ↔ `spec/4-nodes/5-data/2-code.md:347` ("setTimeout, setInterval, setImmediate | 비결정적 스케줄링 차단").
- [ ] (impl) `code.handler.spec.ts` 에 `$node` / `$helpers` 접근 테스트 추가 — 위 impl 보강 동시 진행. 예: `code: 'return { id: $node.id, hash: $helpers.crypto.hash("sha256", "x") };'` 가 정상 종료하는지 검증. 근거: 현 테스트 (`code.handler.spec.ts:83-217`) 에 `$input`/`$vars`/`$execution` 만 검증 — `$node`/`$helpers` 누락.
