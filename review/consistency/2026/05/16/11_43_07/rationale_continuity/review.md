# Rationale 연속성 검토 — Cafe24 Spec Update (2026-05-16)

검토 대상:
- `spec/4-nodes/4-integration/4-cafe24.md` §9.3 갱신
- `spec/conventions/cafe24-api-metadata.md` intro + §4 갱신
- 신규 `spec/conventions/cafe24-api-catalog/` 전체

점검 기준 과거 결정:
- §9.1 단일 노드 + 메타데이터 (option C 채택, A/B 기각)
- §9.3 노드 Resource/Operation 메타데이터 위치 (spec 본문 enumeration 금지 — drift 방지)
- §9.5 5필드 invariant
- §9.6 Rate limit 범위 한정

---

### 발견사항

- **[INFO]** §9.3 — drift 방지 원칙의 적용 범위 이동: spec 본문 → 카탈로그 도큐먼트
  - target 위치: `4-cafe24.md` §9.3 세 번째 bullet ("spec 본문에 endpoint enumeration 을 인라인하지 않는다 — drift 방지 목적")
  - 과거 결정 출처: 구 §9.3 ("spec 본문에 ~180개 enumeration 을 적지 않는다" — drift risk)
  - 상세: 과거 결정의 의도는 "spec 문서 안에 endpoint 목록을 직접 나열하지 않는다"는 것이었다. 신규 §9.3은 이 원칙을 본문(`4-cafe24.md` 자체)에는 여전히 적용하되, 그 enumeration 을 `spec/conventions/cafe24-api-catalog/` 라는 spec/ 하위의 별도 문서로 내보냈다. 카탈로그는 여전히 spec/ 트리 안에 있으므로 "spec 문서에 두지 않는다"는 원칙의 글자 뜻과 미묘하게 긴장 관계에 있다. 그러나 과거 결정의 실질 목적(drift 방지)은 `catalog-sync.spec.ts` 양방향 동기 테스트로 오히려 더 강하게 보호되고 있어, 원칙의 정신은 유지된다. spec 본문 자체에는 inline enumeration 이 없으므로 직접 위반은 아니다.
  - 제안: §9.3 에 "과거 결정의 drift 방지 목적이 `spec/conventions/` 수준의 카탈로그 + CI 동기 테스트로 이관됨"을 1~2문장으로 명시하면 미래 독자가 원칙 이동의 맥락을 즉시 파악할 수 있다. 예: "(구 §9.3 은 spec 본문 inline enumeration 금지만 명시했으나, 이 갱신으로 단일 진실을 `cafe24-api-catalog/` 로 이동하고 drift 방지를 동기 테스트로 전환한다.)"

- **[INFO]** `cafe24-api-metadata.md` intro — "메타데이터 row 1 추가"에서 "row 1 추가 + 카탈로그 row 1 갱신"으로 변경
  - target 위치: `cafe24-api-metadata.md` intro 7번째 줄 ("신규 endpoint 추가는 메타데이터 row 1 추가 + 카탈로그 row 1 갱신으로 끝나야 한다")
  - 과거 결정 출처: 구 intro 문구 ("신규 endpoint 추가는 메타데이터 row 1 추가로 끝나야 한다") — §9.1 Rationale에서 "신규 endpoint = 메타데이터 row 1 추가"로 인용됨
  - 상세: 구 문구는 개발자 부담을 최소화하는("row 1개로 끝") 단순성 약속이었다. 새 문구는 카탈로그 row 갱신을 의무로 추가했으므로 step 수가 2로 늘었다. §9.1 본문("신규 endpoint = 메타데이터 row 1 추가")과 surface-level 불일치가 남아 있어, §9.1 Rationale 설명도 함께 갱신되어야 일관성이 완성된다. §9.1은 아직 "신규 endpoint = 메타데이터 row 1 추가"라는 구 문구 그대로 남아 있다.
  - 제안: `4-cafe24.md` §9.1 의 "(C, 채택)" 설명을 "신규 endpoint = 메타데이터 row 1 추가 + 카탈로그 row 1 갱신"으로 갱신한다. 변경의 이유("카탈로그 SoT 도입으로 2-step, CI 동기 테스트가 강제")를 한 줄 추가.

- **[INFO]** §9.1 기각된 대안 (A, B) 과 신규 카탈로그의 관계 명시 부재
  - target 위치: `4-cafe24.md` §9.1
  - 과거 결정 출처: §9.1 "(A) endpoint 당 도메인 노드": 캔버스 가독성 무너짐으로 기각
  - 상세: 신규 카탈로그(`cafe24-api-catalog/`)는 option C(단일 노드)를 유지하면서 endpoint 전수 목록을 spec 안에 두는 구조다. 이것이 기각된 option A(endpoint 당 노드)와 혼동될 여지는 없으나, "카탈로그는 노드 분리(A)가 아니라 메타데이터 가시성 확보 목적"임을 §9.3 또는 §9.1에 한 줄 추가하면 향후 독자에게 명확해진다.
  - 제안: §9.3 의 카탈로그 도입 근거 문장에 "카탈로그는 option A(endpoint 당 도메인 노드) 재도입이 아니라 단일 노드 유지하면서 endpoint 가시성을 spec 수준으로 끌어올리는 보완책"임을 명시.

---

### 요약

이번 갱신(§9.3 재작성 + 카탈로그 신설 + cafe24-api-metadata.md intro 확장)은 과거 Rationale 의 핵심 결정을 직접 뒤집지 않는다. option C(단일 노드 + 메타데이터)는 완전히 유지되며, option A/B 기각 사유와 충돌하지 않는다. §9.5 5필드 invariant 및 §9.6 rate limit 범위는 변경 없이 온전하다. 주요 변화는 drift 방지 수단의 이동(spec 본문 배제 → 별도 카탈로그 + CI 동기 테스트)과 신규 endpoint 추가 절차의 step 수 증가(1 → 2)이다. 이 두 변화는 과거 결정의 정신(drift 방지·단순성)을 오히려 강화하는 방향이나, §9.1 본문에 남아 있는 구 문구("신규 endpoint = 메타데이터 row 1 추가")가 아직 갱신되지 않아 작은 불일치가 존재한다. CRITICAL 또는 WARNING 수준의 위반은 발견되지 않았으며, 모두 Rationale 명시 보완 수준의 INFO 사항이다.

### 위험도

LOW
