# Rationale 연속성 검토 — `plan/in-progress/multiturn-error-preserve.md`

검토 모드: `--spec` (spec draft 검토)
검토 일시: 2026-05-23

---

## 발견사항

### 발견사항 1
- **[WARNING]** `_resumeState` 무조건 strip 불변식(invariant)을 번복하면서 새 Rationale이 `§1.3` 본문 갱신 시 명시적 폐기 선언을 요구
  - target 위치: `plan/in-progress/multiturn-error-preserve.md` — §C "영향 spec" 표 `spec/5-system/4-execution-engine.md §1.3` 행, R1 채택 사유
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.3` — "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다." (무조건 strip)
  - 상세: 기존 §1.3은 "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` **양쪽 모두를 제거한다**"라는 무조건 invariant를 서술한다. target plan의 R1은 이 invariant를 "retryable error 종결 시 `_retryState` 는 strip 예외"라는 조건부 규칙으로 번복한다. 영향 spec 표에 §1.3 갱신을 명시했으므로 갱신 의도는 있으나, plan의 R1 채택 사유 Rationale에는 기존 무조건 strip rule을 명시적으로 폐기한다는 선언이 없다. `_resumeState` 와 `_retryState` 가 다른 필드임도 강조하고 있지만, 기존 §1.3의 "모두 제거한다"는 표현이 새 `_retryState`와 어떤 관계인지 — 기존 rule의 조건부 완화인지, 새 필드에 대한 별도 rule인지 — spec 갱신 시 명확하게 서술되지 않으면 drift 위험.
  - 제안: R1 채택 사유 Rationale 본문에 "기존 §1.3의 무조건 strip invariant를 `_resumeState`에 대해서는 그대로 유지하되, 새로 도입하는 `_retryState`는 처음부터 예외 대상으로 설계함"을 명시한다. §1.3 갱신 시 "단, retryable error 종결 시 `_retryState`는 strip 예외" 조항을 기존 문장 바로 뒤에 병기해 무조건 → 조건부 완화가 아니라 "기존 필드 동일 + 신규 필드 예외" 임을 독자가 오해하지 않도록 한다.

---

### 발견사항 2
- **[WARNING]** `node-output.md Principle 4.2` "폐기할 필드 / 구조" 목록과 신규 `_retryState` 예외의 명시적 관계 부재
  - target 위치: `plan/in-progress/multiturn-error-preserve.md` — §C "영향 spec" 표 `spec/conventions/node-output.md Principle 4.2` 행
  - 과거 결정 출처: `spec/conventions/node-output.md Principle 4.2` — "`_multiTurnState` → `_resumeState`로 통일. 노출되지 않는 internal 필드임을 문서에 명시." + "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다." (실행 엔진 §1.3 echo)
  - 상세: Principle 4.2는 `_multiTurnState` 폐기와 `_resumeState` 단일화를 정의하고, internal 필드 전체가 노출되지 않는다는 원칙을 세운다. target의 영향 spec 표에는 "폐기 / internal 필드 목록에 `_retryState` strip 예외 명시"라고 기술되어 있으나, plan의 Rationale 어디에도 "Principle 4.2의 폐기 목록 확장" 또는 "strip 예외가 internal-only 원칙과 어떻게 양립하는가"에 대한 설명이 없다. `_retryState`가 expression resolver 비노출 (`Principle 4.2`)을 동일하게 적용한다고 R1 사유에서 언급하지만, Principle 4.2의 "노출되지 않는 internal 필드" 목록에 `_retryState`가 추가되는 방식인지, 아니면 별도의 sub-section으로 처리되는지가 plan 내에 불분명하다.
  - 제안: plan의 "영향 spec" 표에서 `spec/conventions/node-output.md Principle 4.2` 행을 조금 더 구체화하거나 R1 Rationale 내에 "Principle 4.2의 internal 필드 원칙은 `_retryState`에도 동일 적용 — expression resolver 비노출, 단 stripControlFields() 에서는 `_resumeState`와 달리 보존됨"을 명시해 두어야 향후 spec 갱신 시 오해가 없다.

---

### 발견사항 3
- **[INFO]** `system_error` source 도입 — 기각된 `data.kind` discriminator 대안에 대한 Rationale은 충분하나, `source` enum 원칙("source → displayKind 1:1 매핑") 확장 정합성 보완 권장
  - target 위치: `plan/in-progress/multiturn-error-preserve.md` — §B "에러를 conversation thread의 system_error item으로 인라인 표시" + Rationale "system_error vs `system` source 재사용"
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §8.1 Rationale` — 대안 A (`displayKind` 신규 필드) 기각 사유: "`source` enum으로 이미 1:1 도출 가능 — 중복". 대안 C 채택: "source/nodeLabel/data 메타로 raw 파싱 없이 분기 가능"
  - 상세: 기존 Rationale §8.1은 `source` → `displayKind` 1:1 매핑이 성립하기 때문에 별도 `displayKind` 필드 신설을 기각했다. target이 `system_error`를 새 source로 추가하는 것은 이 원칙을 위반하지 않는다 — 오히려 올바른 확장 방법이다. 다만 target의 Rationale에서 기각된 대안은 `data.kind: 'error' | 'note'` discriminator 안인데, 기존 §8.1의 기각 이유(`displayKind` 중복 기각)와는 다른 결정 층이다. plan Rationale이 "source enum의 디스패치를 무력화한다"고 적절히 설명하지만, 기존 §8.1 Rationale에서 `displayKind` 기각 원칙과 신규 `system_error` 확장이 논리적으로 연속됨을 cross-ref로 확인하는 한 줄이 있으면 더욱 명확.
  - 제안: plan Rationale "system_error vs `system` source 재사용" 항목에 "기존 §8.1의 source 1:1 매핑 원칙을 따른 확장 결정"임을 한 줄 명시하면 연속성 검토가 용이해진다.

---

### 발견사항 4
- **[INFO]** `§9.7` store reset 정책 — 기존 §9.7에 `failExecution`/`completeExecution`의 conversation snapshot 클리어에 관한 명시적 invariant 부재로, 신규 Inv-6의 "번복"이 아닌 "신설" 성격이 명확하지 않을 수 있음
  - target 위치: `plan/in-progress/multiturn-error-preserve.md` — §A "CLEAR_WAITING 분리 정책" + "영향 spec" 표 `spec/conventions/conversation-thread.md §9.9` Inv-6 신설
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §9.7` (기존) — `failExecution`/`completeExecution` 시 store mutation에 대한 명시적 정의 없음. §9.9 (기존) — Inv-1 ~ Inv-5만 존재, 실패 시 conversation snapshot 보존에 관한 invariant 없음.
  - 상세: 기존 §9.7과 §9.9는 `failExecution`/`completeExecution` 시 `conversationMessages`가 클리어된다는 명시 규정이 없다. 즉 이 동작은 코드에서만 암묵적으로 정의되어 있었고, spec이 그 동작을 올바른 것으로 선언한 적이 없다. target의 Inv-6은 기존 spec Rationale 결정을 번복하는 것이 아니라 새 invariant를 신설하는 것이다 — 따라서 Rationale 연속성 관점에서 충돌은 없다. 다만 plan의 서술이 "CLEAR_WAITING 분리"를 기존 설계의 버그 수정처럼 설명하는데, spec 갱신 시 §9.9 서두에 "Inv-6 이전에는 이 동작이 spec화되지 않아 코드 레벨에서만 존재했다"는 역사적 메모를 한 줄 추가하면 미래 독자가 "왜 §9 변경 시 이 invariant를 돌이켜야 하는가"를 이해하기 쉽다.
  - 제안: §9.9 Inv-6 신설 시 "(신설 — 기존 코드 암묵적 동작을 spec invariant로 격상)"이라는 provenance 한 줄 추가 권장.

---

### 발견사항 5
- **[INFO]** `node-output.md Principle 3.2` — `details` 가 "선택적, 노드별 스키마"에서 LLM 계열 한정 필수로 격상되는 것은 기존 규칙의 축소 적용이 아닌 확장이나, 기존 Rationale에 "details 노드별 선택 이유"가 기술된 바 없어 충돌 없음
  - target 위치: `plan/in-progress/multiturn-error-preserve.md` — §C "영향 spec" 표 `spec/conventions/node-output.md Principle 3.2` 행
  - 과거 결정 출처: `spec/conventions/node-output.md §3.2` — "`details` 는 선택적, 노드별 스키마."
  - 상세: 기존 `Principle 3.2`의 `details` 정의에는 "왜 선택적인가"에 대한 Rationale이 없다. 따라서 LLM 계열 노드 한정 `retryable: boolean` 필수화는 기존 Rationale과 충돌하지 않는다. target의 "2계층 구조" 개편(LLM 계열 한정 필수 sub-section + 기존 노드별 선택 유지)은 기존 선택적 정책을 기각하지 않고 조건부로 세분화하는 올바른 방향이다.
  - 제안: `Principle 3.2` 갱신 시 "LLM 계열 노드 한정 `retryable` 필수화 이유 — retryable 분류가 없으면 frontend가 retry 진입점을 표시할 수 없음" 한 줄을 신규 sub-section의 Rationale로 추가하면 향후 비-LLM 노드 적용 확대 시 판단 기준이 된다.

---

## 요약

target 문서(`plan/in-progress/multiturn-error-preserve.md`)는 전반적으로 기존 Rationale과의 연속성을 의식하고 있다. R1/R2 선택 근거, `system_error` vs `data.kind` discriminator 기각, `resumeToken` 제거, Re-run과의 의미 분리, 상수명 spec 비노출 방침 등은 모두 기존 합의 원칙(`§8.1`, `§9.6`, `§9.7`, `Principle 5` 등)을 명확히 인지하고 따른다. 그러나 가장 중요한 변경인 `_resumeState` strip invariant 완화에 대해 — 기존 `spec/5-system/4-execution-engine.md §1.3`의 무조건 strip 서술과 신규 `_retryState` strip 예외의 관계를 plan의 R1 Rationale이 충분히 명시적으로 끊어서 설명하지 않아 WARNING 수준의 Rationale 간극이 있다. spec 갱신 시 기존 문장의 의미를 좁혀 `_resumeState`만 strip 대상으로 한정함을 명시하면 충분히 해소 가능한 수준이다. 나머지 발견사항은 INFO 수준의 보완 권장으로, 기각된 결정의 재도입이나 합의된 invariant 직접 위반은 확인되지 않는다.

---

## 위험도

MEDIUM

---

_ISSUES: 2 (WARNING) + 3 (INFO) = 5_
