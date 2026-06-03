# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/spec-impl-evidence.md`
검토 모드: `--impl-done` (scope=spec/conventions/spec-impl-evidence.md, diff-base=origin/main)

---

## 발견사항

### 1. [WARNING] `plan-frontmatter.test.ts` 가드 규약 SoT 위임 불완전 — `(unstarted)` sentinel·플레이스홀더 거부 기준이 plan-lifecycle §4 에 미등재

- **target 위치**: `spec/conventions/spec-impl-evidence.md §4.2` 표 비고 — "가드 규약 SoT = plan-lifecycle §4"
- **과거 결정 출처**: `spec/conventions/spec-impl-evidence.md` R-5 (plan-lifecycle 역방향 링크 SoT 위임 패턴) + `.claude/docs/plan-lifecycle.md §4` (Frontmatter 스키마 SoT)
- **상세**: `spec-impl-evidence.md §4.2` 는 `plan-frontmatter.test.ts` 의 "규약 SoT = plan-lifecycle §4"라고 위임하지만, `.claude/docs/plan-lifecycle.md §4` 에는 `worktree` 필드가 `<task_name>-<slug>` 형식으로만 기술되어 있고, `(unstarted)` sentinel 허용, `TBD`/`assigned at impl`/`미정`/`착수 시`/`pending` 같은 레거시 플레이스홀더 거부 규칙이 전혀 기재되지 않아 있다. 가드 구현(`plan-frontmatter.test.ts` 41–56행)이 적용하는 핵심 판단 기준(`WORKTREE_SENTINEL`, `WORKTREE_PLACEHOLDER` 정규식)이 SoT 로 위임된 문서에 없다. 즉 "SoT = plan-lifecycle §4" 선언이 실제 규약 내용의 진실을 담고 있지 않다.
- **제안**: `.claude/docs/plan-lifecycle.md §4` 에 `(unstarted)` sentinel 허용 및 레거시 플레이스홀더 (`TBD`, `assigned at impl`, `미정`, `착수 시`, `pending`) 거부 규칙을 명시적으로 추가. 또는 spec-impl-evidence §4.2 비고에서 "규약 SoT = plan-lifecycle §4" 위임을 "필드 정의 SoT = plan-lifecycle §4, sentinel·플레이스홀더 규칙 SoT = spec-impl-evidence §4.2" 로 구분 명시.

---

### 2. [INFO] Gate C `spec_impact` cutoff 상수 "3곳 동기" 의무 — plan-lifecycle 갱신 언급 누락

- **target 위치**: `spec/conventions/spec-impl-evidence.md` R-8 ("cutoff 값은 spec-impl-evidence·plan-lifecycle·test 3곳에 동기 유지")
- **과거 결정 출처**: R-8 자체 (cutoff 동기 의무를 R-8 에서 선언)
- **상세**: R-8 은 cutoff `2026-06-04` 를 `spec-impl-evidence·plan-lifecycle·test 3곳에 동기 유지` 해야 한다고 명시했으나, `.claude/docs/plan-lifecycle.md` 어디에도 `spec_impact` 필드나 Gate C cutoff 기준이 등재되어 있지 않다. 현재 `plan-lifecycle §4` 의 Frontmatter 스키마에는 `worktree/started/owner` 만 있고 `spec_impact` 는 없다. R-8 이 의무화한 "3곳 동기" 중 plan-lifecycle 쪽이 미달성 상태.
- **제안**: `.claude/docs/plan-lifecycle.md §4` 또는 §5(이동 commit 자가점검) 에 `spec_impact` 필드와 Gate C cutoff (`2026-06-04`) 를 추가. 대안으로 R-8 의 "3곳 동기" 선언을 "2곳(spec-impl-evidence + test) 동기" 로 범위 축소하고, plan-lifecycle 에는 참조 링크만 둘 수도 있음.

---

### 3. [INFO] `spec-area-index.test.ts` 의 `spec/conventions/` 면제 — 기존 Rationale 에 근거 미기재

- **target 위치**: `spec/conventions/spec-impl-evidence.md §4.2` 표 `spec-area-index.test.ts` 비고 — "`spec/conventions/`(flat reference, 무-index)"
- **과거 결정 출처**: `spec/conventions/spec-impl-evidence.md` 본 문서 어디에도 `spec/conventions/` 의 flat reference 설계 결정이 Rationale 로 기재된 바 없음
- **상세**: `spec-area-index.test.ts` 코드 주석(158행)은 "`spec/conventions/` is a FLAT reference collection (no entry/index doc by design) and is exempt"라고 설계 의도를 밝히지만, 이 invariant 의 근거가 spec-impl-evidence Rationale 에 없다. `spec/conventions/` 가 왜 index 문서를 두지 않는 flat 컬렉션인지, 어떤 의사결정으로 그렇게 됐는지가 Rationale 로 남아있지 않아 추후 index 문서 추가 시 가드와 충돌이 발생할 수 있다.
- **제안**: spec-impl-evidence R-9 에 `spec/conventions/` flat-reference 설계 이유를 한 줄 추가. 또는 spec-impl-evidence §1 제외 항목 설명부에 면제 근거 보완.

---

### 4. [INFO] Gate C `plan/complete/` 재귀 수집에서 `archive/` 하위만 제외 — 비고 규약 SoT 불명확

- **target 위치**: `spec-plan-completion.test.ts` 655–675행 (`collectCompletePlans` 함수의 `archive/` 제외 로직)
- **과거 결정 출처**: `.claude/docs/plan-lifecycle.md §1` — "`plan/complete/archive/from-*/` — 옛 1회성·역사 문서 보관. 신규 생성 금지."
- **상세**: `collectCompletePlans` 는 `archive/` 디렉토리를 통째로 스캔 제외하는데, plan-lifecycle §1 은 `archive/from-*/` 하위만 역사 문서라고 명시한다. 현재 `archive/from-*/` 외 다른 archive 하위 경로를 두지 않는다면 동등하지만, 미래에 `archive/` 아래 정식 완료 plan 이 들어올 경우 Gate C 가 그것을 누락할 수 있다. 이 "archive 통째 제외" 결정이 spec-impl-evidence R-8 혹은 §4.2 에 명시되어 있지 않다.
- **제안**: spec-impl-evidence R-8 또는 §4.2 표 비고에 "Gate C 는 `plan/complete/archive/` 하위를 역사 보관용으로 제외" 한 줄 추가. plan-lifecycle §1 의 "신규 생성 금지" 정책과 연계해 일관성 확보.

---

## 요약

이번 diff 는 `spec/conventions/spec-impl-evidence.md` 에 §4.2 지식저장소·plan 무결성 가드 family 와 R-8·R-9 Rationale 을 신설하는 형태로 spec 과 구현이 동시에 갱신됐다. 명시적으로 기각된 대안(R-8 의 원안 git-history 분석 방식 → frontmatter 선언 대체)에 대한 번복 Rationale 이 R-8 에 작성되어 있어 결정 번복 자체는 적절히 문서화됐다. 그러나 세 가지 SoT 위임의 실질적 공백이 확인된다: (1) plan-lifecycle §4 가 `plan-frontmatter.test.ts` 의 sentinel/플레이스홀더 규칙을 포함하지 않아 "SoT = plan-lifecycle §4" 선언이 실제 규약보다 좁다(WARNING), (2) R-8 이 의무화한 cutoff "3곳 동기" 중 plan-lifecycle 이 미달성(INFO), (3) `spec/conventions/` flat-reference 면제의 Rationale 기재 부재(INFO). 심각한 기각된 대안 재도입이나 합의 invariant 직접 위반은 없다.

---

## 위험도

LOW
