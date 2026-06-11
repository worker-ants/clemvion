# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/4-integration/1-http-request.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-11

---

## 발견사항

### 1. [WARNING] CONVENTIONS `node-output.md` Principle 3.1 이 D4 결정과 여전히 충돌 — 갱신 미완료
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.8 (D4 — handler.validate 실패만 throw, 나머지 모두 §5.3 으로 라우팅), 동일 §4 step 8 (SSRF 가드 → `port: 'error'`, `HTTP_BLOCKED`)
- **과거 결정 출처**: `spec/conventions/node-output.md` Principle 3.1 표 — "Pre-flight 에러 (config 오류, credential 누락, SSRF 차단 등) → `throw` → 엔진이 실행 실패로 마킹"
- **상세**: `node-output.md` Principle 3.1 은 SSRF 차단을 Pre-flight 에러(throw 경로)의 예시로 명시하고 있다. D4 결정은 `0-common.md` 와 target 문서 §5.8 에서 IntegrationError 전체(SSRF 포함)를 `port: 'error'` 로 라우팅하도록 번복했다. target 문서 §5.8 과 `0-common.md §4.2` 는 D4 을 명문화했으나, **CONVENTIONS SoT 인 `node-output.md` Principle 3.1 은 "SSRF 차단 → throw" 예시를 그대로 유지한 채 D4 의 번복을 반영하지 않았다**. 두 문서가 동일 동작에 대해 상반된 기술을 하고 있어, 이후 reviewer 가 CONVENTIONS 만 보면 D4 결정과 충돌하는 내용을 참조하게 된다. target 문서 자체가 잘못된 것이 아니라, CONVENTIONS 의 갱신이 누락된 상태다.
- **제안**: `spec/conventions/node-output.md` Principle 3.1 표의 Pre-flight 에러 예시에서 "SSRF 차단" 을 제거하거나, D4 각주를 추가한다. 예: "Integration 노드의 SSRF 차단·credential 실패는 D4 결정([공통 §4.2](../4-nodes/4-integration/0-common.md#42-공통-에러-코드))으로 `port: 'error'` 경로로 재분류됨" 을 표 하단에 명시. target 문서 측 변경은 불필요하다 — D4 Rationale 이 §5.8 에 이미 명확히 기술돼 있다.

---

### 2. [INFO] §8.2 "기각된 대안 (B)·(C)" 명시 — Rationale 연속성 양호, 보완 제안 1건
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §8.2 기각된 대안 항목
- **과거 결정 출처**: 해당 없음 — 기각 결정이 이번 §8.2 에서 최초로 명문화됨
- **상세**: §8.2 는 (B) `none` 전용 별도 allowlist env 와 (C) 현상 유지 + "none 은 의도적 무가드" 명문화를 기각된 대안으로 명시하고 기각 근거를 제시하고 있다. 새로운 결정(SSRF 전 인증 방식 공통 적용)의 근거·기각 대안·운영 영향이 모두 기술되어 있어 Rationale 구조 요건을 충족한다. 다만 **`ALLOW_PRIVATE_HOST_TARGETS` 플래그를 "통합 노드 전반의 SSRF 가드를 공통 제어한다"** 고 §105 박스가 이미 명문화하고 있었는데, 이전 코드 주석이 이 spec 을 무시하고 `none` 을 무가드로 방치했다는 점이 §8.2 문제 절에 "어느 spec 에도 근거가 없었다(키워드 검색 0건)" 로 기술되어 있다. 정확한 기록이다. 추가 보완으로: §8.2 에서 언급하는 "§105 와의 모순" 의 직접 링크(현재 `§105` 로만 인라인 언급)가 anchor link 형태로 보완되면 후속 검토자가 원문을 즉시 확인할 수 있다.
- **제안**: `§105` 참조를 `[§105 ALLOW_PRIVATE_HOST_TARGETS](./1-http-request.md#4-실행-로직)` 처럼 anchor 링크로 교체하거나, §4 본문의 SSRF opt-out 박스 앞에 numbered anchor 를 추가. 경미한 사항이므로 강제 수정 불필요.

---

### 3. [INFO] `output.error.code = 'HTTP_BLOCKED'` — node-output.md Principle 3.1 의 기존 예시 코드와 name mismatch 없음 (확인 완료)
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표, §5.8
- **과거 결정 출처**: `spec/4-nodes/4-integration/1-http-request.md` §5.8 각주 — "종전 아카이브 개선안의 `HTTP_SSRF_BLOCKED` → error 포트 전환 P1 후보는 D4 결정과 함께 완료 (코드명은 기존 `HTTP_BLOCKED` 유지)"
- **상세**: 옛 제안 코드명 `HTTP_SSRF_BLOCKED` 를 채택하지 않고 기존 `HTTP_BLOCKED` 를 유지한 결정이 §5.8 각주에 명시되어 있다. target 문서 전체에서 `HTTP_SSRF_BLOCKED` 는 한 번만(각주 역사 기록으로) 등장하고, 실제 spec 약속은 모두 `HTTP_BLOCKED` 를 사용한다. 일관성 이상 없음.
- **제안**: 없음 — 확인용 INFO.

---

## 요약

target 문서(`1-http-request.md`)의 핵심 변경 사항(SSRF 가드 전 인증 방식 공통화, §8.2)은 결정의 배경·기각된 대안·운영 영향을 모두 갖춘 완전한 Rationale 구조를 갖추고 있으며, 기각된 대안이 다시 도입된 흔적은 없다. D4 결정(IntegrationError → `port: 'error'` 라우팅)도 §5.8 과 `0-common.md` 에서 일관되게 적용되고 있다. 단, CONVENTIONS SoT인 `spec/conventions/node-output.md` Principle 3.1 이 "SSRF 차단 → Pre-flight throw" 예시를 D4 이후에도 갱신하지 않아, CONVENTIONS 단독 조회 시 D4 및 target 문서의 동작과 상충하는 기술이 남아 있다. 이는 target 문서의 오류가 아니라 CONVENTIONS 문서의 후행 갱신 누락으로, WARNING 수준의 Rationale 연속성 문제다.

---

## 위험도

LOW
