# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 범위: `spec/4-nodes/`
검토 일시: 2026-05-23

---

## 발견사항

### 1. [WARNING] Parallel 노드 `branches[i]` 구조 — 아카이브 제안 형태와 조용히 교체, 새 Rationale 부재

- **target 위치**: `spec/4-nodes/1-logic/10-parallel.md` §5.2 출력 구조, §5.7 컨트랙트 핵심
- **과거 결정 출처**: `plan/complete/archive/from-user-memo/node-specs-improvement/logic/parallel.md` §3 "제안된 Output 구조"
- **상세**: 아카이브 개선안은 `branches[i]` 를 `{ status: 'success' | 'failure', value?, error? }` 형태로 제안했다. 현재 target 문서는 `{ status: 'fulfilled' | 'rejected', value?, error: { code, message } }` 형태(Promise.allSettled 모델)를 사용한다. status 값 vocabulary 자체가 `success/failure` → `fulfilled/rejected` 로 교체되었고, error 구조도 `{ code, message }` 로 구체화되었다. 이 두 변경 모두 합리적인 개선이나, target 문서 안에 이 결정의 Rationale 이 없다. "Promise.allSettled 모델을 선택한 이유", "아카이브의 `success/failure` 를 기각한 이유"가 target 문서 어디에도 명시되어 있지 않다.
- **제안**: `spec/4-nodes/1-logic/10-parallel.md` 에 `## Rationale` 절을 신설하고, `branches[i]` 에 `Promise.allSettled` 의 `fulfilled/rejected` 어휘를 채택한 이유(JS 표준 어휘 재사용, LLM/사용자 인식 친숙도)와 아카이브의 `success/failure` 를 기각한 이유를 명문화한다.

---

### 2. [WARNING] Parallel 노드 `meta.branches` / `meta.successCount` / `meta.failureCount` — Principle 2 및 아카이브 제안 누락, 결정 미기록

- **target 위치**: `spec/4-nodes/1-logic/10-parallel.md` §5.1 / §5.2 출력 구조 (meta 필드 목록)
- **과거 결정 출처**: `plan/complete/archive/from-user-memo/node-specs-improvement/logic/parallel.md` §3 / §5 "근거" 및 `spec/conventions/node-output.md` Principle 2 "Container" 행 (`meta.branches?` 명시)
- **상세**: CONVENTIONS Principle 2 는 Container 노드의 권장 meta 필드로 `meta.branches?` 를 명시한다. 아카이브 개선안은 `meta.branches`(실제 완료된 분기 수), `meta.successCount`, `meta.failureCount`, `meta.concurrency`, `meta.errorPolicy` 를 Container 메트릭으로 제안했다. 현재 target 문서의 Parallel §5.1 / §5.2 출력 예시에는 `meta` 필드가 아예 없으며, §5.7 컨트랙트에도 meta 에 대한 언급이 없다. 아카이브 제안을 전면 기각한 것인지, 아니면 미처 반영하지 못한 것인지 불분명하다. 또한 `meta.durationMs` (Principle 2 공통 필수)도 §5.1 / §5.2 예시에 누락되어 있다.
- **제안**: ① Parallel 이 Container 이므로 적어도 `meta.durationMs` 를 §5.1 / §5.2 예시에 추가한다. ② `meta.branches?` / `meta.successCount?` / `meta.failureCount?` 를 포함할지 여부를 결정하고, 포함하지 않는다면 Rationale 에 "아카이브 제안을 기각하고 `branches.length` / `output.branches` 에서 직접 추론 가능한 값은 meta 로 중복하지 않는다"는 이유를 기록한다.

---

### 3. [WARNING] Switch 노드 `meta.switchPath` — 아카이브에서 제안 후 D6 보류 결정이 target 문서에는 존재하나, Rationale 절의 위치가 내부 불일치 야기 가능

- **target 위치**: `spec/4-nodes/1-logic/2-switch.md` §5.2 하단 "후속 정비안" 블록인용 (보류 D6 마킹)
- **과거 결정 출처**: `plan/complete/archive/from-user-memo/node-specs-improvement/logic/switch.md` §2 불일치 #1 (`meta.expression` → `meta.switchPath` 개선안)
- **상세**: target 문서는 §5.2 블록인용 안에서 `meta.switchPath` 추가를 "보류 D6" 로 마킹했다. 이 자체는 Rationale 연속성 관점에서 적절하다. 그러나 해당 보류 결정이 §8 Rationale 절이 아닌 §5.2 출력 예시 블록인용 안에 묻혀 있어, 향후 검토자가 "D6 보류" 를 §8 Rationale 에서 못 찾고 불필요하게 재도입을 시도할 우려가 있다.
- **제안**: §8 Rationale 에 "meta.switchPath 추가 보류 (D6)" 항목을 신설하고 아카이브 참조와 보류 근거("switchValue 가 config echo 에 그대로 존재하므로 별도 path 필드의 가치가 낮음")를 명시한다. 현재 §5.2 블록인용의 보류 마킹은 유지하되 Rationale 절을 SoT 로 삼는다.

---

### 4. [WARNING] Switch 노드 `waitAll` 필드 유지 — Parallel 개선안에서의 schema 제거 권고를 이행하지 않고 유지, 이유 미기록

- **target 위치**: `spec/4-nodes/1-logic/10-parallel.md` §1 설정 테이블, §2 설정 UI, §6 에러 코드
- **과거 결정 출처**: `plan/complete/archive/from-user-memo/node-specs-improvement/logic/parallel.md` §3 마이그레이션 "waitAll: false 는 Phase P1 에서 schema 에서 제거 또는 validate 단계 warn → reject"; §2 불일치 #5 (`waitAll: false` dead field — Principle 7)
- **상세**: 아카이브 개선안은 `waitAll: false` 를 dead field(Principle 7 위반)로 명시하고 "schema 제거 또는 validate 단계 reject" 를 권고했다. target 문서는 `waitAll` 을 schema 에 계속 노출하면서 "P1 에서는 항상 `true` 로 동작" 및 "dead field — fire-and-forget 은 Background 노드 사용" 이라 표기하고 있다. schema 에서 제거하지 않은 이유(예: 하위 호환, 기존 워크플로우 대응 등)가 target 문서 어디에도 기록되지 않았다.
- **제안**: `spec/4-nodes/1-logic/10-parallel.md` 의 Rationale 절에 "`waitAll` 필드를 schema 에서 제거하지 않고 dead field 로 유지한 이유" 항목을 추가한다. 예: 기존 저장된 워크플로우의 config 에 `waitAll: false` 가 있을 수 있으므로 schema 에서 제거하면 validation 오류 발생, P2 에서 fire-and-forget 모드를 구현할 때 schema 를 재사용할 예정 등.

---

### 5. [INFO] Loop 노드 `breakCondition` 평가 실패의 silent false 처리 — Rationale 은 §8 에 있으나 "평가 실패를 throw 하지 않는" 설계 원칙 연원이 불분명

- **target 위치**: `spec/4-nodes/1-logic/3-loop.md` §1 설정 테이블 `breakCondition` 행
- **과거 결정 출처**: 이 결정의 명시적 과거 Rationale 아카이브가 확인되지 않음
- **상세**: target 문서는 `breakCondition` 평가 실패를 "silent false (loop 진행)" 으로 처리한다고 명시한다. §8 Rationale 에는 이 항목이 없다. "평가 실패를 throw 하지 않고 loop 를 계속 진행"하는 결정은 Loop 의 break 조건이 optional 이라는 점과 "잘못된 표현식으로 무한 루프 방지 vs. 사용자 오류 감추기" 트레이드오프가 있어, 기각된 대안(throw, warning 로그만)을 명시하는 것이 유익하다.
- **제안**: `spec/4-nodes/1-logic/3-loop.md` §8 Rationale 에 `breakCondition` 평가 실패 silent false 선택 이유 항목을 추가한다.

---

### 6. [INFO] Background 노드 Rationale — URL 중첩 구조, WebSocket 채널 격리, AI 도구 노출 결정이 spec 문서에 잘 기록되어 있음 (확인)

- **target 위치**: `spec/4-nodes/1-logic/12-background.md` §8.1 ~ §8.7, `## Rationale` 절
- **과거 결정 출처**: 해당 없음 (Rationale 이 이미 상세히 기록됨)
- **상세**: Background 노드는 URL 중첩 구조, 페이지네이션 선적용, WebSocket 채널 격리, AI Assistant 도구 노출 결정을 Rationale 절에 상세히 기록하고 있으며, 기각된 대안(flat URL, 단순 배열 응답 등)도 명시되어 있다. Rationale 연속성 관점에서 모범적인 사례다.
- **제안**: 없음.

---

### 7. [INFO] Switch 노드 `requiredWhen` 화이트리스트 정책 — 기각된 `notEquals` 블랙리스트 방식이 Rationale §8.1 에 명시됨 (확인)

- **target 위치**: `spec/4-nodes/1-logic/2-switch.md` §8.1
- **과거 결정 출처**: 해당 없음 (Rationale 이 이미 상세히 기록됨)
- **상세**: `requiredWhen` DSL 을 `notEquals` 블랙리스트에서 `equals` 화이트리스트로 변경한 결정과, 기각된 대안(① `notEquals` 유지 + spec 텍스트 명시, ③ `oneOf` 방식)이 §8.1 에 명확히 기록되어 있다. Rationale 연속성 관점에서 모범 사례다.
- **제안**: 없음.

---

### 8. [INFO] Loop 노드 `count` default `'1'` 정책 — Rationale §8.1 에 기각된 대안 3가지가 명시됨 (확인)

- **target 위치**: `spec/4-nodes/1-logic/3-loop.md` §8.1
- **과거 결정 출처**: ai-review W-1 / consistency-check I-1 후속 결정 (2026-05-19)
- **상세**: `count` default `'1'` 유지 + warningRule 제거 + Rationale 명문화 결정과 기각된 두 대안(① `default('')` 변경, ③ 현 상태 유지 + dead rule 인지만 기록)이 §8.1 에 정확히 기록되어 있다. Rationale 연속성 관점에서 적절하다.
- **제안**: 없음.

---

## 요약

`spec/4-nodes/` 의 Rationale 연속성 관점에서 가장 중요한 미비점은 **Parallel 노드** 에 집중되어 있다. 아카이브 개선안(`plan/complete/archive/from-user-memo/node-specs-improvement/logic/parallel.md`)이 제안한 `branches[i]` 구조(`success/failure` 어휘), `meta.branches` / `meta.successCount` / `meta.failureCount` 등의 Container 메트릭, `waitAll` dead field 제거 권고 세 가지를 모두 현재 spec 이 다르게 결정했으나, 그 이유와 기각 근거가 Parallel 문서에 Rationale 절 자체가 없어 기록되지 않은 상태다. CONVENTIONS Principle 2 의 Container `meta.branches?` 필드 권장도 현재 target 에서 이행되지 않았다. Switch 노드의 `meta.switchPath` 보류 결정과 Background 노드의 각종 설계 결정은 적절히 기록되어 있으며 연속성 문제가 없다. Loop 노드도 `count` default 정책과 `validateLoopConfig` 설계가 Rationale 에 잘 기록되어 있다. 전체 위험도는 아카이브와의 조용한 이탈이 구현자 혼란을 일으킬 수 있는 수준으로 **MEDIUM** 이다.

---

## 위험도

MEDIUM
