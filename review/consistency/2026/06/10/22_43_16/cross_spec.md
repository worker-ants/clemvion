# Cross-Spec 일관성 검토 결과

- target: `plan/in-progress/spec-update-deadcode-cleanup.md`
- 검토 시각: 2026-06-10
- 검토 모드: --spec (spec draft 검토)

---

## 발견사항

### 1. [WARNING] §1: spec 상수명 ↔ getter 표현 불일치 — 이미 실제 코드와 어긋남

- **target 위치**: draft §1, 제안 변경 대상 `spec/5-system/16-system-status-api.md` :90, :94
- **충돌 대상**: `spec/5-system/16-system-status-api.md §3` (현재 텍스트), `codebase/backend/src/modules/system-status/system-status.constants.ts`
- **상세**: 현 spec :90 은 `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 상수명을 기술하고 있으나, 코드에는 이 상수들이 이미 존재하지 않는다. 코드는 `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` getter 함수만 노출한다(`system-status.constants.ts:88-93`). spec :94 의 "코드상수 ↔ env 매핑" 서술도 동일하게 상수명을 언급한다. 즉, spec 이 존재하지 않는 코드 심볼을 가리키는 상태이므로 독자가 spec 과 코드를 대조할 때 즉시 불일치가 드러난다.
- **제안**: draft §1 의 변경 내용(getter 표현으로 갱신)을 그대로 적용한다. 다른 spec 파일에는 해당 상수명이 나타나지 않으므로 추가 파급 없음.

---

### 2. [INFO] §1b: `structuredOutputCache` 가 `execution-context.md §1 Stable core` 목록에 누락

- **target 위치**: draft §1b, 제안 변경 대상 `spec/conventions/execution-context.md §1`
- **충돌 대상**: `spec/conventions/execution-context.md §1 원칙 1 — Stable core`
- **상세**: `execution-context.md §1 원칙 1` 의 "실행 표준" 목록은 `variables`, `nodeOutputCache`, `rawConfig`, `recursionDepth` 만 거론하고 `structuredOutputCache` 는 빠져 있다. 그러나 `node-handler.interface.ts:66` 은 `structuredOutputCache` 를 `ExecutionContext` 의 non-optional 필드로 정의하며, `execution-context.md §3` 진단 정책에서 `setStructuredOutput` 을 best-effort setter 로 언급한다. spec §1 목록 발췌 범위에 대해 "전체 필드 정의는 `node-handler.interface.ts` 가 SoT" 라는 면책 주석이 있으므로 논리적 모순은 아니지만, `nodeOutputCache` 는 나열되고 `structuredOutputCache` 는 빠져 있어 독자가 두 필드의 대칭 격리 규약을 파악하기 어렵다. draft §1b 가 제안한 `structuredOutputCache` 추가는 이 불완전한 나열을 보완한다.
- **제안**: draft §1b 를 그대로 적용한다. `execution-context.md §1 원칙 1` 의 "실행 표준" 목록에 `structuredOutputCache` 를 추가할 때, 동일 절에서 `nodeOutputCache` 와 `structuredOutputCache` 가 branch-local shallow copy 로 격리된다는 표현을 병기하면 `parallel.md §Rationale` 추가 내용과 자연스럽게 연결된다.

---

### 3. [INFO] §1b: freeze invariant 가 `execution-context.md §1` 에 추가될 경우 `parallel.md` P1 구현 상태 노트(:14)와 일관성 유지 필요

- **target 위치**: draft §1b, `spec/4-nodes/1-logic/10-parallel.md §Rationale`
- **충돌 대상**: `spec/4-nodes/1-logic/10-parallel.md` :14 (P1 구현 상태 노트), `spec/conventions/execution-context.md §1`
- **상세**: `parallel.md :14` 는 "분기 간 `variables` 는 `structuredClone` 으로 deep clone, `nodeOutputCache` 는 shallow copy 로 격리된다" 고 기술한다. draft §1b 는 `parallel.md §Rationale` 에 `nodeOutputCache` 값 객체의 내부 mutate 금지 invariant + dev/test 환경 `Object.freeze` 강제를 추가하고, `execution-context.md §1` 에 `structuredOutputCache` 의 동일 격리 규약을 추가하려 한다. 이때 :14 의 P1 구현 상태 노트에는 `nodeOutputCache` 만 언급되고 `structuredOutputCache` 의 shallow copy 격리 서술이 빠져 있다 — 향후 독자가 :14 를 읽고 `structuredOutputCache` 의 격리 방식을 알 수 없다. 단, 기능적 모순은 없다.
- **제안**: draft §1b 를 적용할 때 `parallel.md :14` P1 구현 상태 노트도 함께 `structuredOutputCache` shallow copy 격리 서술을 추가하면 §Rationale 의 invariant 설명과 일관성이 유지된다. 동일 PR 에서 반영하도록 체크리스트에 포함 권장.

---

### 4. [INFO] §2 (선택): `spec/5-system/4-execution-engine.md §7.4` 날짜 갱신이 다른 spec 과 충돌하는 항목 없음

- **target 위치**: draft §2
- **충돌 대상**: 없음
- **상세**: draft §2 는 `execution-engine.md §7.4` Worker 동작 셀의 날짜를 2026-06-10 으로 갱신하는 선택적 항목이다. 해당 §7.4 는 이미 "full B3 완료", "in-process pendingContinuations Map 제거" 등 완성된 동작으로 기술되어 있으며, 날짜 갱신은 서술 변경이 아니어서 다른 spec 영역과의 교차 충돌이 없다.
- **제안**: 적용 여부는 재량이며 크로스 스펙 관점에서 차단 이유 없음.

---

## 요약

Cross-Spec 일관성 관점에서 target draft 는 크리티컬 모순을 유발하지 않는다. §1 의 상수명 → getter 갱신은 코드에 이미 존재하지 않는 심볼을 참조하는 spec 오류를 교정하는 것으로, 조속히 반영해야 한다(WARNING). §1b 의 `structuredOutputCache` 추가는 `execution-context.md §1` 의 Stable core 나열이 `nodeOutputCache` 와 대칭인 해당 필드를 빠뜨린 불완전한 발췌를 보완하며, `parallel.md :14` P1 상태 노트와도 동기화가 권장된다(INFO 2건). §2 날짜 갱신은 타 spec 과 무관하다. 전체적으로 제안된 변경은 기존 spec 과 기능적으로 모순되지 않으며, 다른 영역의 API 계약·상태 머신·RBAC 모델·요구사항 ID 와 충돌하는 항목은 발견되지 않았다.

## 위험도

LOW

STATUS: SUCCESS
