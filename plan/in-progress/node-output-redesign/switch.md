# Switch output 개선안

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
