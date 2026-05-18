# 신규 식별자 충돌 검토 — loop-count-policy plan draft

검토 대상: `plan/in-progress/loop-count-policy.md`
검토 모드: plan draft (--plan)

---

### 발견사항

충돌로 분류되는 사항이 없음을 확인하였다. 아래는 점검 항목별 결과다.

---

**[INFO] 신규 plan 파일 `loop-count-policy.md` — 기존 파일과 충돌 없음**
- target 신규 식별자: `plan/in-progress/loop-count-policy.md`
- 기존 사용처: `plan/in-progress/` 디렉토리 내 파일 목록 (node-config-required-defaults-sweep.md 포함)
- 상세: 동일 디렉토리에 `loop-count-policy.md` 와 겹치는 파일명이 없다. `node-config-required-defaults-sweep.md` 는 이미 이 plan 을 `loop-count-policy` 로 분리했다고 역참조(`~~loop.count default 합의~~`) 하고 있어 두 plan 이 동일 작업을 중복 추적하는 상황이 아님을 확인했다.
- 제안: 없음.

---

**[INFO] `§8 Rationale` 섹션 — `3-loop.md` 내 기존 `§8` 부재 확인**
- target 신규 식별자: `spec/4-nodes/1-logic/3-loop.md` 의 `## 8. Rationale` 섹션
- 기존 사용처: `3-loop.md` 는 `§1`(설정) ~ `§7`(캔버스 요약) 까지만 존재했으며 `§8` 미사용. `0-common.md` 의 `§8` 은 "캔버스 요약"이나 이는 별도 파일이므로 앵커 충돌 없음. 현재 worktree 기준 이미 `## 8. Rationale` 이 추가된 상태임을 확인.
- 상세: plan 이 제안하는 `§8 Rationale` 신설은 `3-loop.md` 의 문서 내 충돌이 없다. `0-common.md#8-캔버스-요약` 링크는 `3-loop.md §7` 내에서 `./0-common.md#8-캔버스-요약` 으로 명시 경로를 포함하고 있어 `3-loop.md §8` 과 혼동되지 않는다.
- 제안: 없음.

---

**[INFO] `loop:no-count` warningRule ID — 제거 대상이며 신규 도입 아님**
- target 신규 식별자: 해당 없음 (plan 이 이 ID 를 제거하는 방향)
- 기존 사용처: `loop.schema.ts` (warningRules), `loop.schema.spec.ts` (describe 블록), `execution-engine.service.spec.ts:4506` 주석
- 상세: 충돌 관점에서 신규 도입이 아니므로 충돌 가능성 없음. 제거 작업이 여러 파일(schema, spec, e2e, backend-labels)에 걸쳐 있어 일관성 관점의 누락 리스크만 존재하나, plan 의 작업 항목이 이를 명시적으로 열거하고 있다.
- 제안: 없음.

---

**[INFO] "최소 반복 1회 정책" 정책명 — 기존 사용처 없음**
- target 신규 식별자: `"최소 반복 1회 정책"` (spec Rationale 에 명문화할 정책 명칭)
- 기존 사용처: 현재 worktree 기준 `spec/4-nodes/1-logic/3-loop.md §8.1` 에만 등장. 타 spec 파일·plan 문서에 동일 명칭이 다른 의미로 사용된 사례 없음.
- 상세: 새로 도입되는 정책 명칭이며 충돌 없음.
- 제안: 없음.

---

**[INFO] `frontend backend-labels.ts` 한국어 매핑 제거 — 신규 식별자 도입 아님**
- target 신규 식별자: 해당 없음 (plan 이 `"Count must be entered."` ko 매핑 제거 작업)
- 기존 사용처: `frontend/src/lib/i18n/backend-labels.ts:328` (기존 매핑)
- 상세: 제거 작업이므로 충돌 관점에서 검토 불필요. `spec/conventions/i18n-userguide.md` 에 따르면 warningRule message 와 backend-labels 매핑은 동일 PR 안에서 함께 처리해야 하며, plan 작업 항목이 schema 제거 (`loop.schema.ts`) 와 labels 제거 (`backend-labels.ts:328`) 를 모두 포함하고 있어 규약 준수 상태임을 확인.
- 제안: 없음.

---

### 요약

`loop-count-policy` plan 이 도입하는 신규 식별자는 새 plan 파일명(`loop-count-policy.md`), spec Rationale 섹션명(`§8 Rationale`), 정책 명칭("최소 반복 1회 정책") 세 가지다. 이 중 기존 코퍼스에서 다른 의미로 사용 중인 식별자는 없다. plan 이 제거하는 `loop:no-count` warningRule ID 와 ko 레이블은 신규 도입이 아니므로 충돌 검토 대상에서 제외된다. `spec/4-nodes/1-logic/0-common.md §8`("캔버스 요약")과 `3-loop.md §8`("Rationale") 의 번호 중복은 서로 다른 파일이고 링크가 명시적 경로(`./0-common.md#8-캔버스-요약`)를 포함하여 앵커 혼동이 없다. 전체적으로 식별자 충돌 위험이 없는 plan 이다.

### 위험도

NONE
