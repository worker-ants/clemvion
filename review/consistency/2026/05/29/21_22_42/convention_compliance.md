# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` frontmatter 변경 (diff vs `origin/main`)
검토 기준: `spec/conventions/spec-impl-evidence.md`
검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`

---

## 발견사항

### INFO — `_multiTurnState` 최종 출력 제거 서술 잠재 잉여성

- **target 위치**: `spec/5-system/4-execution-engine.md` § "재개 state 직렬화 필드" 내 마지막 bullet ("최종 출력 저장 시 엔진(`stripControlFields()`)이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다")
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `partial` 상태 spec 본문은 현재 구현 실상을 반영해야 하며, 폐기된 키에 대한 서술은 혼동을 줄 수 있음
- **상세**: 변경 diff 에서 동일 섹션의 다른 bullet 은 "`_multiTurnState` 키는 Stage 2 rename + Stage 5 제거가 완료되어 현재 코드·페이로드에 존재하지 않는다"고 명시한다. 그러나 바로 아래 bullet 에서 `stripControlFields()` 가 여전히 `_multiTurnState` 를 제거한다는 서술이 남아 있어 "이미 없는 키를 제거한다"는 논리적 잉여가 존재한다. defensive clean-up 코드로서 의도된 경우 규약 위반은 아니지만, spec 독자에게 혼동을 줄 여지가 있다.
- **제안**: `_multiTurnState` 가 코드에서 완전히 사라졌다면 해당 bullet 을 "엔진(`stripControlFields()`)이 `_resumeState` 를 제거한다"로 간결화하거나, 괄호 주석으로 "(`_multiTurnState` 잔존 페이로드 하위호환 제거 포함)"처럼 의도를 명시. INFO 수준이므로 차단 불필요.

---

## 핵심 규약 준수 판정 (각 항목)

### 1. 명명 규약

**PASS.**

- `id: execution-engine` — 파일 basename `4-execution-engine` 에서 숫자 prefix 를 제외한 kebab-case. `spec-impl-evidence §2.1` 의 "파일 basename 기반 권장" 서술과 일치.
- `pending_plans` 필드명 — `spec-impl-evidence §2` 스키마 예시와 정확히 일치.
- `code:` 필드명 — 동일 스키마와 일치.

### 2. `status` 값 및 라이프사이클 규약

**PASS.**

- `spec-only` → `partial` 전이. `spec-impl-evidence §3.1` 전이 규칙 "spec-only → partial: 최초 코드 머지 시점에 승격" 에 부합. `codebase/backend/src/modules/execution-engine/` 모듈이 실존함을 확인.
- `status: partial` 시 `pending_plans:` 의무(`spec-impl-evidence §3` 표) — 충족. `pending_plans:` 항목 1개 기재.

### 3. `code:` 경로 검증 (`status: partial` → ≥1 매치 의무)

**PASS.**

- `codebase/backend/src/modules/execution-engine/**` 글로브 — 실제 디렉터리 존재 확인 완료. `spec-impl-evidence §3` 의 "`partial` — code: ≥1 매치 의무" 를 만족.

### 4. `pending_plans:` 실존 검증

**PASS.**

- `plan/in-progress/execution-engine-residual-gaps.md` 실존 확인 완료. `spec-impl-evidence §4` 가드 `spec-pending-plan-existence.test.ts` 가 검증하는 invariant 를 선제적으로 만족.

### 5. `pending_plans` 계획 파일 frontmatter 적합성

**PASS.**

- `execution-engine-residual-gaps.md` frontmatter — `worktree`, `started`, `owner` 기재. plan-lifecycle 규약의 in-progress plan 필수 frontmatter 구조와 일치.
- 파일 본문에 본 spec(`spec/5-system/4-execution-engine.md`)과의 연결 사유가 명시적으로 서술되어 있어 역방향 링크(`spec-impl-evidence §R-5`) 의도를 충족.

### 6. 문서 구조 규약 (Overview / 본문 / Rationale 3섹션)

**PASS (변경 없음).**

- 변경 diff 는 frontmatter 와 본문 내 2개 서술 수정만 포함. 문서 구조 자체는 변경되지 않아 기존 구조 규약 준수 상태가 유지됨.

### 7. 2개 신규 plan 파일 명명 규약

**PASS.**

- `execution-engine-residual-gaps.md` — kebab-case, `plan/in-progress/` 위치. CLAUDE.md 정보 저장 위치 규약 ("진행 중 작업: `plan/in-progress/<name>.md`") 준수.
- `spec-frontmatter-status-migration.md` — 동일. `worktree` frontmatter 기재 확인.

### 8. 금지 항목 점검

**PASS.**

- `status: implemented` 인 spec 에 `pending_plans:` 기재 — 해당 없음 (`partial` 사용).
- `code:` 와 `pending_plans:` 동시 부재 (`partial` 상태에서) — 해당 없음. 양쪽 모두 기재.
- `spec-impl-evidence §2.2` 의미 도메인 혼동 — `status: partial` 은 spec frontmatter 도메인 값으로만 쓰임. 데이터 모델 엔티티 status 컬럼과 혼동 여지 없음.

---

## 요약

`spec/5-system/4-execution-engine.md` 의 frontmatter 변경(`spec-only` → `partial`, `code:` 추가, `pending_plans:` 추가)과 본문 2개 서술 수정은 `spec/conventions/spec-impl-evidence.md` 가 정의하는 모든 핵심 규약을 직접적으로 준수한다. `status: partial` 전이의 필수 조건인 `code: ≥1 매치`와 `pending_plans: 의무`가 모두 충족되고, 참조된 plan 파일과 코드 경로의 실존이 확인됐다. 단 하나의 INFO 수준 관찰(본문 내 `_multiTurnState` strip 서술의 잠재 잉여성)이 있으나, defensive code 관점에서 의도적일 수 있으며 규약 위반에 해당하지 않는다. 2개 신규 plan 파일도 명명 및 frontmatter 규약을 준수한다.

---

## 위험도

NONE

---

STATUS: SUCCESS
