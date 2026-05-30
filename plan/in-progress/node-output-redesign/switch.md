# Switch output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `meta.value` deprecated alias 가 D4 마이그레이션으로 제거되었고 `meta.resolvedValue` 로 통일된 상태. (2026-05-16 구현 분석) handler `config` echo 가 `hasDefault` / `strictComparison` 두 raw 필드를 echo 하지 않아 spec §5.2 의 JSON 예시 (`hasDefault: true` echo) 와 미세 불일치 — Principle 7 정합 차원에서 보강 권고 발생.

> 대상 spec: `spec/4-nodes/1-logic/2-switch.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/2-switch.md:106-141` (Case 5.1 — 케이스 매칭):

```json
{
  "config": { "mode": "value", "switchValue": "{{ $input.user.role }}", "cases": [...] },
  "output": { "user": { "role": "admin", "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "mode": "value",
    "matchedCase": "case_admin",
    "matchedCaseLabel": "Admin",
    "matchedCaseIndex": 0,
    "resolvedValue": "admin"
  },
  "port": "case_admin"
}
```

§5.2 의 default 폴백은 `port: 'default'`, `meta.matchedCase: 'default'`, `meta.matchedCaseIndex: -1` 만 다르며 `output` 은 input pass-through.

## 진단

Switch 는 If/Else 와 동일한 **pass-through 분기 노드** (단계 1개) 다. "단계마다 채워지는 field" = input 그대로 = `output`. 현 spec 은 부합.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input pass-through | 적절 | Logic 공통 §10. case 매칭/default 모두 동일 |
| `meta.mode` (resolved) | 적절 | 실행 메트릭 — config default 적용 후 값 |
| `meta.matchedCase` | 적절 | 진단 (`port` 와 의미 중복이지만 default 시 `port='default'` ≡ `meta.matchedCase='default'`. `-1` sentinel 도 `meta` 에) |
| `meta.matchedCaseLabel` | 적절 | UI/로그용 label (config 의 raw label echo) |
| `meta.matchedCaseIndex` | 적절 | default 폴백 sentinel `-1` |
| `meta.resolvedValue` | 적절 | `mode='value'` 시 evaluated switchValue (Principle 7 ↔ 1.1 직교: raw 는 `config.switchValue`) |
| `config.cases` (raw) | 적절 | config echo |
| `port: <case.id> | 'default'` | 적절 | Principle 5 + 동적 포트 (Principle 6) |

부적절 항목 없음. 다만 spec 본문의 §5.2 末尾에 `meta.value` deprecated alias 가 D4 마이그레이션으로 제거됐다는 history 가 명시되어 있어 **현재 정의 자체는 깨끗**.

추가 점검:

- **`meta.matchedCase: 'default'` ↔ `port: 'default'` 의 의미 중복** — port 는 라우팅 키, meta 는 진단 — 둘 다 같은 'default' 문자열을 사용. `port` 만 봐도 알 수 있으나 `meta.matchedCaseIndex === -1` sentinel 과 함께 두면 case id 가 `default` 와 충돌하는 사용자 입력을 frontend 에서 거부하므로 안전 (Principle 6 시스템 예약어).

## 개선안 — 정리된 output

현 spec 은 conventions 부합. 변경 없음.

```json
{
  "config": { "mode": ..., "switchValue": ..., "cases": [...], "hasDefault"? },
  "output": { /* input 전체 pass-through */ },
  "meta": {
    "durationMs": <number>,
    "mode": "value" | "expression",
    "matchedCase": "<case.id>" | "default",
    "matchedCaseLabel"?: <string>,
    "matchedCaseIndex": <number | -1>,
    "resolvedValue"?: <unknown>  // mode='value' 시만
  },
  "port": "<case.id>" | "default"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- pass-through 분기 노드는 input 변형이 없어 `output` 에 들어갈 비즈니스 결과물이 input 자체 외에 없다.
- `meta.value` deprecated alias 는 D4 (logic-node-followups) 에서 제거 완료 (spec §5.1 footnote). 본 plan 시점 잔재 없음.
- 옛 개선안의 `meta.switchPath` 추가 제안은 spec 본문이 D6 에서 보류 결정 — switchValue 가 raw 표현식으로 `config` 에 echo 되므로 별도 필드 가치 낮음.

## 구현 분석 (2026-05-16)

대상 파일: `codebase/backend/src/nodes/logic/switch/{switch.handler.ts, switch.schema.ts, switch.handler.spec.ts, switch.schema.spec.ts, switch.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - `switch.handler.ts:115-143` 의 매칭 / default 분기 두 return 객체 모두 `{ config, output, meta, port }` — spec §5.1/§5.2 와 일치.
   - **gap A**: `configEcho` (`:86-90`) 가 `switchValue` / `cases` / `mode` 만 echo. `hasDefault` / `strictComparison` 미포함. spec §5.2 JSON 예시 (`spec/4-nodes/1-logic/2-switch.md:165`) 는 `hasDefault: true` 를 echo 한다고 명시 — 구현이 spec 예시와 어긋남.
   - **gap B**: `meta.matchedCaseLabel` 가 `undefined` 일 때 명시적으로 `undefined` 값을 반환 (`:122`, `:137`). spec §5.1 표 ("string \| undefined") 와 일치하지만 JSON.stringify 직렬화 후 키 자체가 사라지므로 expression 접근 시 일관됨.

2. **schema ↔ spec config 정합성**:
   - `switchNodeConfigSchema` (`switch.schema.ts:68-112`): `mode` / `switchValue` / `cases` / `hasDefault` / `strictComparison` 모두 spec §1 표와 동일. default 값 (`value` / `''` / `[]` / `false` / `false`) 일치.
   - `caseDefSchema` (`switch.schema.ts:8-41`): `id` regex `/^[a-zA-Z0-9_-]+$/` + 최대 64 — spec §3.3 와 일치. `id` 가 schema 단계에서 optional (`:17`) 이고 handler.validate 가 runtime-required 로 잡는 3계층 구조는 schema-spec (`switch.schema.spec.ts:62-65`) 가 의도로 가드.

3. **validate 일관성**:
   - `handler.validate()` (`switch.handler.ts:35-70`) 가 `evaluateMetadataBlockingErrors` + mode/hasDefault/strict guard + whitespace-only switchValue 보강 (`:50-56`) + non-array cases 만 추가. SSOT 침범 없음.
   - `warningRules` (`switch.schema.ts:208-222`) 가 `switchValue` / `cases` 비어있음 케이스를 담당, `validateSwitchConfig` (`:141-182`) 가 per-case id 중복 / reserved word / valueType / expression-condition. 분리 명확.

4. **에러 컨트랙트 (Principle 3)**:
   - pre-flight throw + runtime throw `'No matching case found and no default case configured'` (`:145`) 만 사용 — runtime `port:'error'` 없음. spec §6 와 일치.
   - 매칭 실패 + `hasDefault === false` 의 runtime throw 는 spec §6 마지막 항목과 일치 — Principle 3.1 의 "설정 실패 → throw" 경계 결정 적용.

5. **conventions Principle 0–11 위반 패턴**:
   - Principle 1.1: `output = input` pass-through, `output` 에 config 리터럴 echo 없음. 부합.
   - Principle 2: `meta.mode` / `matchedCase` / `matchedCaseLabel` / `matchedCaseIndex` / `resolvedValue` 모두 메트릭 — 부합.
   - Principle 6 (동적 포트): `case.id` 그대로 포트 ID 사용 + `RESERVED_CASE_IDS = ['default', 'out', 'error']` (`switch.schema.ts:140`) + slug regex — D7 마이그레이션 반영 완료. 부합.
   - Principle 7: switchValue/cases 는 `rawConfig` echo (`:85`). `hasDefault` / `strictComparison` 누락 (위 §1 gap A).
   - Principle 8: 이중 중첩 없음. `meta.value` deprecated alias 도 D4 에서 제거 (`switch.handler.ts:108-113` 주석).

6. **handler 테스트 (`switch.handler.spec.ts`)**:
   - mode=value / mode=expression / valueType coercion / loose vs strict / default fallback / hasDefault=false throw / matchedCaseLabel·Index·resolvedValue / rawConfig echo 모두 커버 (`:1-734`).
   - **미세 누락**: `configEcho` 에 `hasDefault` 가 누락된 사실은 테스트되지 않는다 — `expect(result.config).toMatchObject(...)` 가 일부 키만 확인하므로 회귀 감지 못함. `configEcho` 가 `mode` / `switchValue` / `cases` 외 다른 키를 가지는지 직접 검증하는 케이스 부재.

7. **횡단 일관성 (분기 4종)**:
   - Switch 의 `meta.matchedCase{,Label,Index}` 는 If/Else 의 `meta.conditionResult` + `meta.matchedConditions` 와 시멘틱 직교 — case 식별 vs condition 단위 평가 결과. 양호.
   - default 포트 `'default'` 는 시스템 예약어 — `RESERVED_CASE_IDS` 가 case id 와의 충돌을 차단. Principle 6 적용 일관.

8. **구현 품질**:
   - `coerceCaseValue` (`switch.handler.ts:165-182`) 가 `valueType='number'` 의 NaN fallback 을 원본 유지로 처리 — 안전. 매직 넘버 없음.
   - `matchByValueIndex` 의 `==` 사용 (`:161`) 은 eslint 의도적 무력화 — spec §3.2.1 default strict=false 와 일치하는 의도된 loose equality.

## 종합 개선안 (2026-05-16)

- [x] (impl) `switch.handler.ts:86-90` 의 `configEcho` 에 `hasDefault: rawConfig.hasDefault` 와 `strictComparison: rawConfig.strictComparison` 추가 — spec §5.2 JSON 예시 (`hasDefault: true`) 와 정합 회복. 근거: spec `spec/4-nodes/1-logic/2-switch.md:165` + Principle 7 "사용자 UI 설정 비민감 값 항상 echo".
- [ ] (impl) `switch.handler.spec.ts` 에 회귀 가드 테스트 추가 — `result.config` 의 키 셋을 `toEqual` 로 직접 비교하여 `hasDefault` / `strictComparison` 누락을 잡는 케이스. 근거: 현재 `toMatchObject` 가 누락 키를 감지하지 못함.
- [ ] (spec) §5.1 JSON 예시에 `strictComparison: false` echo 도 포함하거나, 반대로 §5.1/§5.2 두 예시에서 `hasDefault` echo 를 제거하여 일관성 확보. 현재 §5.1 은 미포함 / §5.2 는 포함 — 비대칭. 근거: `spec/4-nodes/1-logic/2-switch.md:107-127` vs `:157-177`.
