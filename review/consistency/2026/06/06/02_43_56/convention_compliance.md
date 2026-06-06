# 정식 규약 준수 검토 — spec-draft-exec-park-b2-durable.md

검토 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-06

---

## 발견사항

### 1. **[INFO]** 문서 목적·위치 적합성 — spec draft 는 `plan/` 에 두는 것이 관행이며 이상 없음

- target 위치: 파일 경로 `plan/in-progress/spec-draft-exec-park-b2-durable.md`
- 위반 규약: 없음 (CLAUDE.md §정보 저장 위치 — 진행 중 작업은 `plan/in-progress/`)
- 상세: `plan/in-progress/` 위치, frontmatter `worktree`/`started`/`owner` 3필드 모두 존재. `plan-lifecycle §4` 스키마를 준수한다.
- 제안: 없음.

---

### 2. **[WARNING]** 마이그레이션 번호 지정 방식 — `V087` 선언 후 "착수 직전 재확인" 단서에도 불구하고 spec draft 내 번호가 고정 기재됨

- target 위치: C1 섹션 — "마이그레이션: `V087__execution_resume_call_stack.sql` (현재 next=**V087**; 최고 V086 #482. migrations.md §5 대로 **구현 착수 직전 `ls migrations/V08* | tail -2` 재확인** 후 확정)"
- 위반 규약: `spec/conventions/migrations.md §2` — "신규 V번호는 항상 현재 main 의 max(V) **+1**", §5 — "`ls codebase/backend/migrations | tail -2` 로 현재 max V 를 확인"
- 상세: spec draft 에 `V087` 을 잠정 번호로 기재하고 착수 직전 재확인을 요구하는 서술은 인간 리뷰어에게 혼동을 줄 수 있다. draft 수준이라면 `V<TBD>` 로 두고 착수 직전 확정하는 편이 migrations.md 정책 취지(단조성·race 방지)와 더 잘 맞는다. 단, "착수 직전 재확인" 단서를 명시했으므로 규약을 직접 위반하지는 않는다.
- 제안: `V087` 표기를 `V<TBD — 착수 직전 migrations.md §5 절차로 확정>` 형식으로 변경하면 draft 단계에서 번호 선취로 인한 오해·충돌 위험을 줄일 수 있다. 규약을 강제로 위반한 것은 아니므로 WARNING 수준.

---

### 3. **[INFO]** `data-model §2.13 병기 번호도 동일` — 마이그레이션 번호와 data-model 절 번호 혼동 가능성

- target 위치: C1 섹션 — "data-model §2.13 병기 번호도 동일"
- 위반 규약: 없음 (직접 규약 위반 아님)
- 상세: `§2.13` 과 `V087` 이 "동일"하다는 표현이 마이그레이션 파일 번호와 data-model 절 번호를 같게 유지한다는 의미인지, 단순히 같은 컬럼을 가리킨다는 의미인지 불명확하다. 명명 규약 관점에서 혼동을 줄 수 있다.
- 제안: "data-model.md §2.13 Execution 컬럼 표에 반영 — 마이그레이션 번호와 연동" 처럼 의미를 분리해서 기술하면 독자 혼동이 줄어든다.

---

### 4. **[INFO]** 문서 구조 — Overview / 본문 / Rationale 3섹션 구성 준수 확인

- target 위치: 전체 문서
- 위반 규약: CLAUDE.md §문서 구조 규약 — "Overview / 본문 / Rationale 3섹션 권장"
- 상세: 본 문서는 `plan/in-progress/` 의 spec draft이며 정식 spec 파일이 아니다. 정식 spec 파일(`spec/**`)에 적용되는 3섹션 구조 권장은 본 파일에 의무로 적용되지 않는다. 실제로 문서는 "변경 요지(C1~C5)" + "Rationale" 구조로 되어 있어, Rationale 섹션은 갖추고 있다. Overview 성격의 메타 정보는 상단 `>` 인용 블록으로 처리되어 있는데, 이는 spec draft plan 문서로서 허용 가능한 형태다.
- 제안: 없음. plan 문서로서의 구조는 적절하다.

---

### 5. **[INFO]** `spec/conventions/migrations.md` 참조 방식 — 외부 링크 없이 경로명만 나열

- target 위치: 첫 번째 `>` 인용 블록 — "`spec/conventions/migrations.md`(신규 마이그레이션)"
- 위반 규약: 없음 (직접 위반 아님)
- 상세: plan 문서 내 spec 참조는 경로 기재만으로도 충분하다. `spec/conventions/migrations.md §5` 를 `[migrations.md §5](../spec/conventions/migrations.md)` 형태의 링크로 제공하면 독자 탐색이 편해지나 plan 파일에서 필수 요건은 아니다.
- 제안: 필수 아님. 독자 편의 차원에서 마크다운 링크 형식 사용 권장.

---

### 6. **[INFO]** C5의 "spec 갱신 선행 금지" 조건부 전제 명시 — 규약 준수 양호

- target 위치: C5 섹션 첫 번째 callout (W3 적용 전제)
- 위반 규약: 없음
- 상세: "PR-B2 코드와 같은 PR 로 함께 머지될 때만 spec 완료형 갱신 적용" 조건을 명시한 것은 `spec/conventions/spec-impl-evidence.md §3.1 전이 규칙`(spec 먼저 `implemented` 로 올리면 역전 발생)과 정합한다. spec draft 로서 이 조건부 기재는 오히려 규약 준수 의식의 표현이다.
- 제안: 없음.

---

### 7. **[INFO]** `_continuationCheckpoint` 기각 항목 설명 — 기존 §Rationale 참조 행 번호(L1174) 기재

- target 위치: Rationale 섹션 — "과거 §Rationale L1174 는..."
- 위반 규약: 없음 (직접 위반 아님)
- 상세: spec draft 에서 기존 spec 파일의 행 번호(L1174)를 직접 참조하는 것은 해당 spec 파일이 수정될 경우 stale 참조가 될 위험이 있다. 규약에서 명시적으로 금지하지는 않으나, heading anchor 로 참조하는 편이 더 안정적이다.
- 제안: `L1174` 대신 해당 Rationale 항목의 heading slug(`#_continuationcheckpoint-...`) 로 교체. 단 현재 draft 단계에서는 INFO 수준.

---

## 요약

`plan/in-progress/spec-draft-exec-park-b2-durable.md` 는 plan frontmatter 3필드(`worktree`/`started`/`owner`) 를 모두 갖추고 있으며, spec 문서가 아닌 plan draft 로서 3섹션 구조 의무는 적용되지 않는다. 가장 주목할 사항은 마이그레이션 번호 `V087` 을 draft 단계에 확정 기재한 부분으로, `migrations.md §2·§5` 의 "착수 직전 max(V)+1 확인" 정책과 경합 가능성이 있다 — 단 문서 자체에 "착수 직전 재확인" 단서를 달았으므로 직접 위반은 아니다(WARNING). 나머지 발견사항은 모두 사소한 형식 일관성 또는 독자 편의 제안(INFO) 수준이며, conventions 에서 명시적으로 금지한 패턴은 없다.

## 위험도

LOW
