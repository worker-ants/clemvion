# 요구사항(Requirement) Review — Code Node Sandbox API Gap

**대상 커밋**: 8419923bac23ad5199dece783643ccc8944c8e87  
**관련 Spec**: `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md`

---

## 발견사항

### **[WARNING]** `meta.durationMs` 누락 — spec §5.1 / §5.3 필드 요구 미충족
- **위치**: `code.handler.ts` — `execute()` 성공 반환값 (line ~941) 및 `failure()` 메서드
- **상세**: Spec §5.1 의 성공 출력 예시와 §5.3 의 에러 출력 예시, 공통 필드 표 모두에서 `meta.durationMs` 를 **handler return** 필드로 명시한다. 현재 handler 는 `meta: { success: true, logs }` / `meta: { success: false, logs }` 를 반환하며 `durationMs` 를 계산·포함하지 않는다. Spec 은 이 필드의 주석을 "engine inject" 로 표기하지만 §5 필드 표 `출처` 컬럼이 "handler return" 으로 기재되어 있어 handler 책임인지 engine 책임인지 이중 표기 충돌이 있다. 현재 코드는 측정 로직 자체가 없으며 engine 이 post-inject 하는 코드도 본 diff 에 포함되지 않는다.
- **제안**: (1) spec §5.1 `출처` 컬럼 `engine inject` 표기와 본문의 `handler return` 표기 중 어느 쪽이 SoT 인지 `project-planner` 에서 확정. (2) handler 책임이라면 `performance.now()` / `Date.now()` 차이로 측정하여 `meta.durationMs` 에 포함. engine 책임이라면 spec 필드 표 수정.

### **[WARNING]** `$helpers.crypto.hash` — 허용 알고리즘 범위 미정의 / 에러 처리 없음
- **위치**: `code.handler.ts` `buildHelpers()`, line ~647–649
- **상세**: `createHash(algorithm)` 는 Node.js 가 지원하지 않는 알고리즘 문자열이 전달되면 `Error: Digest method not supported` 를 throw 한다. 현재 구현은 이 예외를 잡지 않아 sandbox 내 런타임 에러로 전파된다 (`error` 포트 분기). Spec §2.2 는 "md5, sha256 등" 을 언급하지만 허용 알고리즘 목록이나 에러 처리 규칙을 명시하지 않는다. 이 throw 가 의도된 동작(사용자 코드 런타임 에러로 취급)인지 명시적 validation 이 필요한지 spec 에서 침묵.
- **제안**: Spec §2.2 에 허용 알고리즘 목록 또는 "지원하지 않는 알고리즘은 사용자 코드 런타임 에러로 전파된다" 는 명시 추가를 `project-planner` 에 요청. 현재 코드 동작 자체는 기술적으로 허용 가능하나 계약이 불명확한 상태.

### **[WARNING]** `$helpers.base64.decode` — UTF-8 외 인코딩 처리 미정의
- **위치**: `code.handler.ts` `buildHelpers()`, line ~654–656
- **상세**: `decode` 는 항상 `'utf-8'` 로 디코딩한다. 이진 데이터(이미지, PDF 등)를 Base64 디코딩하면 문자열 변환 과정에서 데이터가 손실된다. Spec §2.2 는 단순히 "Base64 디코딩" 만 기술하며 반환 타입(`string` vs `Buffer`)을 명시하지 않아 이진 사용 케이스가 지원 범위 외인지 불분명하다.
- **제안**: Spec §2.2 에 `base64.decode` 반환 타입이 UTF-8 string 임을 명시, 이진 데이터 사용이 지원 범위 외임을 기재. 현재 구현은 spec 이 침묵하는 회색지대이므로 INFO 격상 가능하나 사용자 혼동 위험으로 WARNING 기재.

### **[INFO]** `$node` fallback 값이 빈 문자열(`''`) — spec 침묵 회색지대
- **위치**: `code.handler.ts` line ~881, `code.handler.spec.ts` 테스트 `should expose $node with empty-string fallbacks`
- **상세**: `context.nodeId ?? ''` / `context.nodeLabel ?? ''` 로 fallback 처리한다. `ExecutionContext` 인터페이스는 "consumers should fall back to `''`" 를 `nodeId` JSDoc 에 명시하므로 구현은 인터페이스 계약에 부합한다. Spec §2.1 은 fallback 값을 명시하지 않는다. 현재 코드와 테스트는 일관되게 빈 문자열을 사용하므로 위험은 낮다.
- **제안**: Spec §2.1 의 `$node` 필드 표에 "engine이 미주입 시 `id`/`label` 은 `''` 로 fallback" 주석 추가를 `project-planner` 에 요청 (옵션).

### **[INFO]** `$helpers.date(value)` — `undefined` 입력 허용 / dayjs 객체가 sandbox 에 노출되는 방식
- **위치**: `code.handler.ts` `buildHelpers()`, line ~646
- **상세**: `$helpers.date(value)` 는 dayjs 객체를 반환한다. dayjs 객체 메서드 (`.format()`, `.year()` 등)는 host realm 함수로, sandbox 코드가 이를 호출하는 것은 허용된 헬퍼 API 사용 패턴이다. 그러나 dayjs 객체가 sandbox 에 노출될 경우 dayjs 내부가 참조하는 host realm 전역(Date 등)에 접근 통로가 생길 수 있다. `Date` 는 sandbox 에 이미 허용되므로 이 경로의 위험은 낮다. Spec §2.2 는 "dayjs 호환" 만 기술하며 반환 객체의 메서드 허용 범위를 명시하지 않는다.
- **제안**: 현재 구현 위험 낮음. Spec §2.2 에 반환 객체가 dayjs 인스턴스임을 명시하는 정도로 충분.

### **[INFO]** 테스트에서 `context.nodeId`/`context.nodeLabel` 에 직접 할당
- **위치**: `code.handler.spec.ts` line ~62–64
- **상세**: `context.nodeId = 'node-42'; context.nodeLabel = 'My Code Step';` 직접 할당은 TypeScript strict 환경에서 `ExecutionContext` 인터페이스에 `nodeId?: string`, `nodeLabel?: string` 이 optional 로 선언되어 있으므로 타입 안전하다. 이는 테스트 코드의 일반적인 fixture 패턴으로 문제 없음.

### **[INFO]** `timeout` 필드 — schema 의 `.default(30)` 과 `validateCodeConfig` 의 이중 관리
- **위치**: `code.schema.ts`
- **상세**: `z.number().default(30)` 은 schema parse 시 기본값을 주입하지만, `validateCodeConfig` 는 `timeout` 이 `undefined` 일 때 검증을 건너뛴다. schema 의 `.default(30)` 이 적용된 후의 parsed config 는 항상 숫자이므로 두 계층이 일관성 있게 동작한다. 단 `validateCodeConfig` 가 raw config (zod parse 전) 에 직접 호출될 경우 `undefined` 가 허용된다는 점은 설계 의도이므로 문제 없음 (주석으로 명확히 설명됨).

---

## Spec Fidelity 점검 요약

| Spec §섹션 | 점검 항목 | 결과 |
|---|---|---|
| §1 timeout 필드 (1~120s, default 30) | schema `z.number().default(30)`, validateCodeConfig 범위 | 일치 |
| §2.1 `$node` (`{id, label}`) | buildSandbox nodeMeta 주입, fallback `''` | 일치 |
| §2.2 `$helpers` API 목록 | `date`/`crypto.hash`/`crypto.uuid`/`base64.encode`/`base64.decode` | 일치 |
| §7.3 `setTimeout`/`setInterval`/`setImmediate` undefined 셰도잉 | 명시 셰도잉 추가됨 | 일치 |
| §5.1 `meta.durationMs` 필드 | 없음 | **불일치** (WARNING) |
| §5.3 에러 코드 정규화 (`CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`) | `normalizedCode` 매핑 | 일치 |
| §5.3 `details.legacyCode` | `outputDetails.legacyCode = errorCode` | 일치 |
| §5.3 `details.stack` — production 미노출 | `exposeStack = process.env.NODE_ENV !== 'production'` | 일치 |
| §6 pre-flight throw 메시지 포맷 | `code has a syntax error: <msg>` | 일치 |
| §7.1 `codeGeneration: {strings: false, wasm: false}` | `vm.createContext` 옵션 | 일치 |
| §7.2 이중 타임아웃 (`runInContext timeout` + `Promise.race`) | 구현 확인됨 | 일치 |

---

## 요약

변경 코드는 spec §1(timeout 스키마), §2.1(`$node` 주입), §2.2(`$helpers` 주입), §7.3(timer 셰도잉)의 핵심 계약을 충실히 구현하고 있다. 보안 sandbox 구조, 에러 코드 정규화(`CODE_TIMEOUT`/`CODE_EXECUTION_FAILED`), `$vars` 원자적 교체, pre-flight throw 패턴 등 기존 spec 요구사항도 유지된다. 주요 미충족은 spec §5.1/§5.3 이 `handler return` 으로 표기한 `meta.durationMs` 필드가 코드에 없다는 점이다 — 다만 spec 자체가 "engine inject" 와 "handler return" 을 혼용 표기하는 결함이 있으므로 책임 소재 확정이 우선이다. `$helpers.crypto.hash` 의 잘못된 알고리즘 입력 시 에러 처리 계약이 spec 에서 미정의된 점은 사용자 혼동 위험이 있어 추가 명시가 권장된다.

---

## 위험도

**LOW** — 핵심 기능(sandbox 주입, 타임아웃, 에러 라우팅)은 spec 과 일치. `meta.durationMs` 누락은 spec 자체 표기 충돌로 현재 코드가 엔진 레이어에서 처리 중일 가능성이 있어 즉각적 프로덕션 장애 위험은 낮다.
