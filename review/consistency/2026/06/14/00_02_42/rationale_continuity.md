# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/audit-actions.md`
참조 Rationale: `spec/5-system/1-auth.md §Rationale 4.1.A`, `§Rationale 4.1.B`

---

## 발견사항

### [WARNING] §2 의 "한 resource 안에서 패턴을 혼용하지 않는다" 원칙과 §3 의 `workspace` 이중 패턴 간 표면적 모순

- **target 위치**: `spec/conventions/audit-actions.md` §2 ("verb 시제는 아래 세 패턴 중 하나를 **도메인(resource) 단위로 일관** 적용한다. 한 resource 안에서 패턴을 혼용하지 않는다.") 및 §3 레지스트리 표 (`workspace` 행 두 개 — §2.3 도메인 고유 동사 `transfer_ownership` + §2.1 과거분사 `created`/`updated`/`deleted`)
- **과거 결정 출처**: `spec/5-system/1-auth.md §Rationale 4.1.A` — "`workspace.transfer_ownership` 분류 (refactor 04 후속 A-2)": `transfer_ownership` 을 도메인 고유 동사(§2.3)로 분류하고, 향후 `created`/`updated`/`deleted` 은 §2.1 을 따를 것을 확정한 결정. 단, "한 resource 안에서 혼용 금지" 원칙을 이 결정이 예외적으로 허용한다는 명시는 4.1.A 에 없다.
- **상세**: §2 는 "한 resource 안에서 패턴을 혼용하지 않는다"를 규범으로 선언하지만, §3 은 `workspace` resource 가 두 패턴에 걸치는 것을 레지스트리 표에 수록하고 그 아래 주석으로 설명한다. 4.1.A Rationale 은 `transfer_ownership` 을 도메인 고유 동사로 분류한 근거를 제공하지만, "같은 resource 의 다른 verb 에는 다른 패턴을 허용한다"는 원칙 갱신을 §2 본문에 반영하지 않은 채 §3 주석만으로 처리하고 있다. 결과적으로 §2 를 문면대로 읽는 독자는 `workspace` 레지스트리가 규칙 위반처럼 보인다. 이는 기각된 대안의 재도입이나 합의 원칙의 직접 침해가 아니라, 규칙 진술과 실제 적용 사이의 표현 불일치다.
- **제안**: §2 의 "한 resource 안에서 패턴을 혼용하지 않는다" 문장을 "단, §2.3 도메인 고유 동사를 가진 verb 는 같은 resource 의 CRUD verb 와 패턴을 달리 분류할 수 있다 — 분류 기준은 resource 이름이 아니라 그 verb 가 어느 패턴에 속하는가다" 로 보완하거나, §3 주석의 예외 설명을 §2 하단으로 끌어올려 규칙 서술과 예외를 같은 자리에 둔다. 4.1.A Rationale 에 이 원칙 정교화를 명시 추가해도 된다.

---

### [INFO] §3 레지스트리 `integration` resource — `scope_changed`, `reauthorized` 는 복합어/과거분사로 분류 근거 명시 없음

- **target 위치**: `spec/conventions/audit-actions.md` §3 레지스트리 표 `integration` 행: `rotated`, `scope_changed`, `reauthorized`
- **과거 결정 출처**: `spec/5-system/1-auth.md §Rationale 4.1.A` — integration 계열을 과거분사(§2.1)로 명시한다 (`integration.created` 예시). `scope_changed` / `reauthorized` / `rotated` 는 4.1.A 에서 별도 언급 없이 묵시적으로 §2.1 에 포함된다.
- **상세**: `scope_changed` (과거분사 + noun compound) 와 `reauthorized` (과거분사) 는 §2.1 에 속하는 것이 맥락상 자명하지만, 레지스트리 표는 단순히 "과거분사 (§2.1)" 로 분류할 뿐 이 두 verb 가 합성어·재귀 구조라는 점을 따로 다루지 않는다. Rationale 도 이들을 개별 언급하지 않는다. 현재로선 규약 위반이 아니고 과거 기각된 대안 재도입도 아니다 — 단순 추가 가이드 부재.
- **제안**: `integration` resource 의 `rotated`·`scope_changed`·`reauthorized` 처럼 CRUD 4종 이외의 도메인 동사 variant 가 §2.1 에 속하는 근거(합성 과거분사도 §2.1 범주)를 §2.1 하단 또는 4.1.A Rationale 에 한 줄 보완하면 후속 도메인 설계자의 혼동을 줄인다.

---

### [INFO] `model_config` Planned 행 — `reveal` 미포함이 `auth_config` 와 다른 이유가 레지스트리에 미기재

- **target 위치**: `spec/conventions/audit-actions.md` §3 레지스트리 `model_config` 행: `create`, `update`, `delete`, `set-default` (4종)
- **과거 결정 출처**: `spec/5-system/1-auth.md §4.1` 본문: "reveal 미제공 — ModelConfig 는 평문 reveal 엔드포인트 없음"; `§Rationale 4.1.A` 에서 `model_config` 를 `auth_config` 와 동일 현재형 예외로 처리한다고 명시.
- **상세**: 1-auth §4.1 은 `model_config` 의 `reveal` 미제공 이유를 본문 주석으로 설명하지만, 규약 SoT 인 `audit-actions.md` §3 레지스트리에는 그 이유가 없다. 독자가 "왜 `auth_config` 에는 `reveal` 이 있는데 `model_config` 에는 없나"를 이 문서만 보고 알 수 없다.
- **제안**: §3 `model_config` 행 또는 표 하단 주석에 `reveal` 미포함 이유("ModelConfig 는 평문 reveal 엔드포인트 없음")를 한 줄 추가하거나, 1-auth §4.1 참조 링크를 표기한다.

---

## 요약

`spec/conventions/audit-actions.md` 는 `spec/5-system/1-auth.md §Rationale 4.1.A·4.1.B` 의 결정을 전반적으로 충실히 반영하고 있다. 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 내용은 없다. 단 한 가지 주요 표현 불일치가 있다: §2 의 "한 resource 안에서 패턴을 혼용하지 않는다" 원칙 서술이 `workspace` 의 이중 패턴(4.1.A 에서 확정된 §2.3 + §2.1 병존)을 §3 주석만으로 처리해, 규칙 진술 자체가 예외를 포섭하도록 갱신되지 않았다. 이는 기각된 대안의 재도입이 아니라 규칙 표현의 미완성에 해당하며, §2 본문에 단일 예외 조항 한 줄을 추가하거나 4.1.A Rationale 에 원칙 정교화를 명시함으로써 해소된다.

## 위험도

LOW
