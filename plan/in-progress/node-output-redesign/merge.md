# Merge output 개선안

> **6차 갱신 (2026-06-25 코드 재검증)**: 핸들러 미분할(단일 `merge.handler.ts` 유지) — 라인만 이동. §8 5개 항목 중 3개 해소 / 2개 잔여. **해소**: (1) `meta.strategy`/`meta.outputFormat` 중복 결정 — spec §5.1 표(`spec:138-139`)·§5.2(`spec:192-193`)가 "(b) 유지, config echo 와 동일 값이나 meta 분기 키로도 사용 가능" 으로 명문화. (3) `rawConfig.* ?? DEFAULT` echo 정책 — spec §4 step5(`spec:82`)·§5.1 표가 default 폴백 의도를 명시(`merge.handler.ts:127,138-139`, `context.rawConfig ?? config`). (5) frontend `mergeSummary`/FORMATTERS 마이그레이션 — FORMATTERS 전면 제거, `node-config-summary.ts:71` 이 `evaluateWarnings(config, def?.warningRules)` SSOT 직소비, `inputCount` 룰은 의도적으로 미추가. **잔여**: (2) `timeout` zod `.nonnegative()` 미추가 (`merge.schema.ts:37-47` 여전히 `z.number().int().default(300)`, handler 가드만 `merge.handler.ts:59-61`); (4) `context.rawConfig ≠ config` 우선 echo 테스트 부재. **새 변화(CHANGED)**: D1(이전 갱신) 로 `config` echo 가 4필드 전체(`timeout`/`partialOnTimeout` 포함, `merge.handler.ts:140-141`)로 확장 — 기존 "dormant echo 안 함" 진단 무효화. 또한 warningRules 가 3개로 증가(`merge.schema.ts:90-113`) — `merge:timeout-dormant`/`merge:partial-on-timeout-dormant` 가 `severity` 미명시 → 기본 `blocking` 이라 `timeout>0`/`partialOnTimeout=true` 가 이제 validate 에서 **차단됨**(spec §6 명문화). 잔여: 이 dormant-blocking 동작의 validate 테스트 부재.

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. silent 실패 가시화 (`skippedKeys`, `dormantFields`) 유지.
> 잔여 권고 항목:
> - `meta.strategy` / `meta.outputFormat` 가 `config.strategy` / `config.outputFormat` 와 의미 중복 (default 폴백 후 같은 값). 호환성 영향 평가 후 제거 검토.
> - (2026-05-16 구현 분석) handler 의 `config` echo (`merge.handler.ts:138-142`) 가 `strategy` / `outputFormat` 만 — schema 의 `timeout` / `partialOnTimeout` 은 echo 안 함 (P1 dormant 의도). spec §1 표가 두 필드를 schema 존재로 명시하므로 사용자 혼동 가능 — `meta.dormantFields` 노출로 보강은 됐으나 echo 정책 명시 권장. → (2026-06-25) 해소: D1 baseline 으로 `config` echo 가 4필드 전체로 확장 (`merge.handler.ts:137-142` — `timeout: rawConfig.timeout`, `partialOnTimeout: rawConfig.partialOnTimeout` 폴백 없이 echo), spec §4 step5(`spec:82`)·§5.1 표(`spec:133-134`)가 echo 정책 명문화.

> 대상 spec: `spec/4-nodes/1-logic/11-merge.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/11-merge.md:104-119`:

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "array" },
  "output": [{ "a": 1 }, { "b": 2 }],
  "meta": {
    "durationMs": 0,
    "inputCount": 2,
    "strategy": "wait_all",
    "outputFormat": "array",
    "skippedKeys": [],
    "dormantFields": []
  }
}
```

§5.1.1 의 outputFormat 별 변형:
- `merge_object` → `output: { a: 1, b: 3, c: 4 }` (객체 shallow merge)
- `indexed` → `output: { in_0: ..., in_1: ... }` (인덱스 키)

## 진단

Merge 는 **데이터 변형 노드** (단계 1개). 여러 입력 → `outputFormat` 에 따라 다른 shape 으로 합침.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output: unknown[] | object` | 적절 — shape 가변 (output) | spec footnote: "merge 의 본질적 기능". 후속 노드는 `$node["X"].config.outputFormat` 으로 shape 식별 |
| `meta.inputCount` | 적절 (meta) | 실제 병합된 입력 수 |
| `meta.strategy` / `meta.outputFormat` (resolved) | **약간 부적절 — config 와 중복** | `config.strategy` / `config.outputFormat` 와 동일 값. spec footnote: "shape 판별용 분기 키" 라고 정당화하지만, `config` 만으로 충분 |
| `meta.skippedKeys` | 적절 (meta) | `merge_object` 에서 prototype pollution 으로 drop 된 키 진단 (Principle 3 silent failure 해소) |
| `meta.dormantFields` | 적절 (meta) | P1 dormant 처리된 config 필드 (`timeout`, `partialOnTimeout`) 가시화 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.strategy` / `config.outputFormat` (raw echo) | 적절 | Principle 7. → (2026-06-25) `timeout` / `partialOnTimeout` 도 이제 echo 함 (D1 baseline, `merge.handler.ts:140-141` — 폴백 없이 raw echo, 미설정 시 undefined→생략). spec §4 step5(`spec:82`)·§5.1 표 갱신됨 |

핵심 점검:

1. **`meta.strategy` ↔ `config.strategy` 의 의미 중복** — spec footnote: "default 폴백 후 값" 으로 의미 다름이라 주장하나, `config.strategy` echo 가 raw 값이고 default 도 schema 단계에서 적용되므로 사실상 동일. 한쪽 제거 검토 가치 있으나 다운스트림 표현식이 `meta.outputFormat` 을 분기 키로 사용 중일 가능성 → 호환성을 위해 유지.
2. **dormant config 필드 echo 정책** — ~~`timeout` / `partialOnTimeout` 은 raw echo 안 함 (P1 미구현)~~ → (2026-06-25) 해소: D1 baseline 으로 `config` 가 4필드 전체 echo (`merge.handler.ts:137-142`), 추가로 `meta.dormantFields` 로 dormant 가시화 + warningRule `merge:timeout-dormant`/`merge:partial-on-timeout-dormant` 가 validate 차단 (이중 가시화). schema 존재 사실이 이제 출력·검증 양쪽에 노출됨.
3. **`output` shape 가변성 위험** — 후속 노드 표현식 `$node["X"].output[0]` (array) vs `$node["X"].output.a` (merge_object) 가 다름. spec 이 명시적으로 경고. 본질적 기능이라 변경 불가.

## 개선안 — 정리된 output

현 spec 거의 부합. 미시 보강:

- `meta.strategy` / `meta.outputFormat` 은 `config` 와 중복이므로 제거 검토 — 단 호환성 영향 평가 필요. 제거 시 다운스트림은 `$node["X"].config.outputFormat` 만 사용.

```json
{
  "config": { "strategy": "wait_all" | "first" | "append", "outputFormat": "array" | "merge_object" | "indexed" },
  "output": <array | object — outputFormat 별 shape>,
  "meta": {
    "durationMs": <number>,
    "inputCount": <number>,
    // "strategy": <enum>,           // ⚠ 검토: config 와 중복 — 제거 또는 유지
    // "outputFormat": <enum>,       // ⚠ 검토: config 와 중복 — 제거 또는 유지
    "skippedKeys": [<string>, ...],  // merge_object 한정, 그 외 []
    "dormantFields": [<string>, ...] // P1 dormant ['timeout', 'partialOnTimeout']
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| `meta.strategy` (검토) | 제거 또는 `config.strategy` 만 사용 | 중복 |
| `meta.outputFormat` (검토) | 제거 또는 `config.outputFormat` 만 사용 | 중복 |

## Rationale

- output shape 가변성은 merge 의 본질이므로 수정 대상 아님 — `config.outputFormat` 으로 분기 식별.
- `meta.skippedKeys` 와 `meta.dormantFields` 는 silent 실패 가시화 (Principle 3) — 필수.
- `meta.strategy` / `outputFormat` echo 의 의미는 약하나 호환성 영향 있어 본 plan 은 검토 항목으로만 표시 — 결정은 review 단계.
- P1 → P2 활성화 시점에 `MERGE_TIMEOUT` 코드와 함께 `error` 포트가 추가될 가능성 (spec §6 footnote) — 본 plan 은 P1 시점 정의만 다룸.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/logic/merge/{merge.handler.ts, merge.schema.ts, merge.handler.spec.ts, merge.schema.spec.ts, merge.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - `merge.handler.ts:136-151` 의 return 객체 `{ config: { strategy, outputFormat, timeout, partialOnTimeout }, output: formatted, meta: { inputCount, strategy, outputFormat, skippedKeys, dormantFields } }` — spec §5.1 JSON 과 정합. 단일 출력 데이터 변형 노드. → (2026-06-25) `config` echo 가 D1 baseline 으로 4필드 전체 (`timeout`/`partialOnTimeout` 포함, `merge.handler.ts:140-141`) 로 확장됨.
   - `output` shape 은 `outputFormat` 에 따라 `array | merge_object | indexed` 가변 (`merge.handler.ts:168-210`) — spec §4.2 표 부합.
   - `port` 미반환 (`undefined`) — spec §3.2 단일 `out` 포트, Principle 5 부합.

2. **schema ↔ spec config 정합성**:
   - `mergeNodeConfigSchema` (`merge.schema.ts:27-59`): `strategy` (enum, default `wait_all`) / `outputFormat` (enum, default `array`) / `timeout` (int, default 300) / `partialOnTimeout` (boolean, default false). spec §1 표와 일치.
   - **gap1 (잔여)**: schema 의 `timeout` 은 `z.number().int().default(300)` (`merge.schema.ts:37-47`) 으로 음수 거부 안 함 — handler.validate (`merge.handler.ts:59-61`) 가 `timeout < 0` 거부. zod 의 `.nonnegative()` 보강 권장. (2026-06-25 재확인: 여전히 미적용.)

3. **validate 일관성**:
   - `merge.handler.ts:39-70` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors` (warningRules SSOT) + enum / type guard (strategy / outputFormat / timeout / partialOnTimeout) 를 추가. **comment(`:40-43`)에 의도 명시** — raw fixtures / direct callers 가 zod parse 우회할 수 있어 handler-side 가드를 유지.
   - `warningRules` (`merge.schema.ts:90-113`) 가 이제 3개 정의: `merge:no-strategy` + `merge:timeout-dormant` (`when: 'timeout > 0'`) + `merge:partial-on-timeout-dormant` (`when: 'partialOnTimeout'`). → (2026-06-25) **CHANGED**: 후자 둘은 `severity` 미명시 → evaluator 기본 `blocking` (`metadata-validation.ts:evaluateMetadataValidation` declarative 기본값) 이라 `timeout>0` / `partialOnTimeout=true` 가 이제 validate 에서 **차단 에러로 집계**됨 (spec §6 명문화 — "dormant = 런타임 무영향이지 검증 무영향이 아니다"). 2026-05-16 시점엔 `merge:no-strategy` 단일이라 dormant 필드가 validate 를 통과했음.
   - **gap2 (해소)**: `merge.schema.ts:75-89` 의 주석이 frontend formatter 의 `inputCount` 필드를 schema 에 미반영 사실을 명시 — 마이그레이션 노트. → (2026-06-25) 해소: FORMATTERS 전면 제거, frontend `node-config-summary.ts:71` 이 `evaluateWarnings(config, def?.warningRules)` SSOT 직접 소비. `inputCount` 룰은 의도대로 미추가 (fan-in count 는 predecessor edge 에서 암시).

4. **에러 컨트랙트 (Principle 3)**: pre-flight throw 만 — runtime `port:'error'` 없음 (spec §6 명시). 부합. P2 에서 `MERGE_TIMEOUT` 도입 가능성 footnote.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1 (config ↔ output 직교): `output` 은 runtime 변형 결과, `config.strategy` / `outputFormat` 은 raw. 직교 부합.
   - Principle 2: `meta.inputCount` / `skippedKeys` / `dormantFields` 는 실행 메트릭 / silent 실패 가시화. 부합. **`meta.strategy` / `outputFormat` 는 `config` 와 의미 중복** — 잔여 권고 항목 (plan 본문 §"진단" 점검 1). → (2026-06-25) 해소: spec §5.1 표(`spec:138-139`)·§5.2(`spec:192-193`)가 "config echo 와 의미 동일하나 meta 측에서도 분기 키로 사용 가능" 으로 "유지" 결정을 명문화.
   - Principle 3: `merge_object` 의 prototype pollution drop 키를 `meta.skippedKeys` 로 노출 (`merge.handler.ts:175-198`) — silent 실패 해소.
   - Principle 5: `port` 미반환 (단일 출력). 부합.
   - Principle 7: `merge.handler.ts:138-139` 의 `rawConfig.strategy ?? DEFAULT_STRATEGY` 패턴 — raw 가 undefined 일 때 default 폴백 (`rawConfig = context.rawConfig ?? config`, `:127`). enum 필드라 raw === evaluated 이긴 하나 `?? DEFAULT_STRATEGY` 가 raw 의 의도(`undefined`)를 덮어쓸 위험. → (2026-06-25) 해소: spec §4 step5(`spec:82`)·§5.1 표(`spec:131-132`)가 `rawConfig.strategy ?? 'wait_all'` (DEFAULT 폴백) 을 echo 정책으로 명문화 — undefined 그대로 echo 가 아니라 default 폴백이 정답으로 확정.
   - Principle 10: `normalizeInputs` (`:154-166`) 가 null/undefined/primitive 를 `[input]` 으로 wrap, `{}` 와 `[]` 는 `[]` — Principle 10 의 fallback 정책 부합 (단 primitive wrap 은 spec §4.1 표에 명시).

6. **handler 테스트 (`merge.handler.spec.ts`)**:
   - validate (defaults / missing strategy / unknown strategy / outputFormat default / unknown outputFormat / timeout 0 / negative timeout / multiple errors)
   - execute defaults / explicit values / input normalization (object/array/primitive/key sort) / strategies (wait_all / first / append) / outputFormats (array / merge_object / indexed) / merge_object prototype pollution (`__proto__` / `constructor` / `prototype`) / edge cases (null / undefined / empty)
   - **meta 블록 (`:261-389`)**: inputCount / strategy / outputFormat / skippedKeys / dormantFields / first inputCount=1 / merge_object skippedKeys / clean inputs empty skippedKeys / indexed empty skippedKeys / timeout dormantFields / timeout=0 omitted / partialOnTimeout dormantFields / both dormant / inputCount=0.
   - **5-field invariant 블록 (`:391-415`)**: 5필드 (config / output / meta) + no port / status + 허용 키 set 검증 (allowed set 에 `_resumeState` 포함, `:403-410`).
   - **누락 (잔여)**: (a) `rawConfig` 우선 사용 (`context.rawConfig ≠ config`) 명시적 테스트 부재 — `{{ }}` template 시나리오는 enum 필드라 의미 약함. (b) (2026-06-25) dormant warningRule blocking validate 테스트 부재 — `timeout > 0` / `partialOnTimeout = true` 가 이제 validate 에서 차단되는데(`merge.schema.ts:100-112`), validate describe 블록(`:23-102`)에 timeout=0 valid / negative reject 만 있고 `timeout>0` blocking 케이스 미검증.

7. **횡단 일관성 (데이터 변형 2종 — Split / Merge)**:
   - Split: 단일 출력, `output` shape 일관 (배열).
   - Merge: 단일 출력, `output` shape 가변 (outputFormat 별). 후속 노드는 `config.outputFormat` 으로 분기 — spec 명시. 정합.
   - Merge 만 `meta.skippedKeys` / `meta.dormantFields` 보강 — silent 실패 가시화 패턴. Split 도 옵션상 도입 가능 (spec/impl 검토).

8. **구현 품질**: clean. `Object.create(null)` (`:176`) 으로 prototype-less 객체 시작, `blockedKeys` Set (`:177`) 으로 pollution 차단, `skippedKeys` Set (`:180`) 으로 중복 제거 — 보안성 우수. `Logger.warn` (`:89-101`) 으로 dormant 필드 가시화. 매직 넘버 없음.

## 종합 개선안 (2026-05-16)

- [x] (spec) `meta.strategy` / `meta.outputFormat` 중복 처리 결정 명시 — (a) 제거 후 `config.*` 만 사용, (b) 유지 (현 정책) 중 하나로 spec footnote 명문화. 호환성 영향: 다운스트림 expression 이 `$node["X"].meta.outputFormat` 을 분기 키로 사용 중일 가능성. — ✅ (2026-06-25) (b) 유지 결정 명문화: spec §5.1 표(`spec/4-nodes/1-logic/11-merge.md:138-139`) "config echo 와 의미 동일하나 meta 측에서도 분기 키로 사용 가능" + §5.2(`spec:192-193`) "meta echo, 동일한 값". 구현 echo 는 `merge.handler.ts:146-147`.
- [ ] (impl) `merge.schema.ts:37-47` 의 `timeout` zod 에 `.nonnegative()` 추가 — schema 단계에서 음수 거부. 현 handler.validate 와 중복 가드 제거 가능. 근거: `merge.handler.ts:59-61` (handler 가드만 존재) vs `merge.schema.ts:37-47` (여전히 `z.number().int().default(300)`, 2026-06-25 재확인 잔여).
- [x] (impl) `merge.handler.ts:138-139` 의 `rawConfig.strategy ?? DEFAULT_STRATEGY` 패턴 검토 — undefined echo 가 Principle 7 의도라면 `??` 제거, default 폴백 의도라면 spec 본문에 echo 정책 명시. — ✅ (2026-06-25) default 폴백 의도로 확정·명문화: spec §4 step5(`spec:82`) + §5.1 표(`spec:131-132`)가 `rawConfig.strategy ?? 'wait_all'` (DEFAULT 폴백) echo 를 명시. 구현 `merge.handler.ts:127`(`rawConfig = context.rawConfig ?? config`), `:138-139`.
- [ ] (impl) `merge.handler.spec.ts` 에 `rawConfig` 우선 echo 테스트 추가 — `context.rawConfig ≠ config` 케이스 (enum 필드는 의미 약하나 일관성). 2026-06-25 재확인: validate/execute describe 블록 모두 `context.rawConfig` 를 별도 세팅하는 테스트 없음 (잔여). 함께 권장: dormant warningRule blocking validate 테스트 (`timeout>0` 차단, `merge.schema.ts:100-112`).
- [x] (frontend) `mergeSummary` 의 `inputCount` warning 처리 — schema 의 SSOT 마이그레이션 (Step 5 of `merge.schema.ts:75-89` comment) 진행 시 plan 갱신. — ✅ (2026-06-25) 해소: FORMATTERS 전면 제거 (frontend lib/components 어디에도 `FORMATTERS`/`mergeSummary` 없음), `codebase/frontend/src/lib/utils/node-config-summary.ts:71` 이 `evaluateWarnings(config, def?.warningRules)` SSOT 직접 소비. `inputCount` 룰은 의도대로 미추가 (fan-in count 는 predecessor edge 에서 암시).
