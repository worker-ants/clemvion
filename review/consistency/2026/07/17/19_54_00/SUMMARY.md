# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(정규식 → TS AST 파싱 전환, `interaction-type-exhaustiveness.test.ts`)은 5개 checker 전원이 "spec 위반 아님, 오히려 spec 이 최초부터 붙여온 'AST 가드' 명칭에 구현이 수렴하는 방향"으로 독립 수렴 판정했다. 유일한 잔여 항목은 spec 본문의 "grep" 병용 표현이 전환 후 서술적으로 다소 부정확해진다는 비차단 INFO.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision (5개 전원 공통 관찰) | spec 이 이 가드를 최초 도입(PR #272, `1305fdf03`)부터 일관되게 **"AST 가드"** 로 명명(§1.2 rule 3, §2.1 `system_error`/`rag` 행, §5 Rationale ②, 총 5회 인용)해왔으나, 병용 표현 "grep 대상 파일"/"grep 검증"/"grep 결과"는 실제 구현이 그동안 정규식이었을 때는 참이었고, target 전환(TS 컴파일러 API 기반 실제 AST 파싱) 후에는 문자 그대로는 부정확해진다. 검증 계약(매트릭스 각 enum 값이 각 등록 사이트에 string literal 로 등장하는가)·등록 사이트 목록·enum 값 목록은 불변이므로 계약 변경이 아니라 **이름-구현 수렴**(판정 (b))이며, spec 개정 의무 없음 | `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1, §5 Rationale ② ↔ target: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` | 차단 아님. project-planner 의 후속 트리비얼 doc-sync(별도 승인 불요 수준)로 "grep 대상 파일"→"등록 사이트 파일", "코드 grep 결과"→"코드 AST 파싱 결과" 등으로 다듬으면 명칭 일관성 향상. 이번 developer 작업의 필수 선행 조건 아님 |
| 2 | convention_compliance, rationale_continuity | 대상 테스트 파일 자체의 JSDoc 헤더("AST/grep guard for...", "This test grep-finds string literals...")와 `ENUM_VALUES` 위 "Known limitation: the grep matches backtick-quoted mentions too..." 주석도 AST 전환 후 사실과 어긋나게 됨 | `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` JSDoc 헤더 및 인라인 주석 | developer 소유 파일이므로 이번 코드 변경 시 "grep-finds"→"parses (TS AST)" 류로 함께 갱신 권장(별도 위임 불요, 이미 target 의 "채택 방안"에 구현 세부 명시돼 있어 착수 시 자연 반영 예상) |
| 3 | convention_compliance | 정규식/grep 기반 가드는 저장소에서 금지 패턴이 아니라 확립된 선례(`migrations.md` SQL_NAME_RE, `i18n-userguide.md` §113 `ui-label-parity.test.ts`가 이 문서의 "N 개 갱신 위치 동시 변경" 원칙을 명시적으로 원용) — 오탐 방지 기록 | `spec/conventions/migrations.md`, `spec/conventions/i18n-userguide.md` §113 | 조치 불요. 두 문서가 공유하는 것은 "매트릭스 SoT + 다중 사이트 동시 갱신" 원칙이지 "grep 기법 강제"가 아니므로, `interaction-type-registry.md` 만 AST 로 전환해도 상충 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 다른 spec 영역(데이터 모델·API·RBAC·계층 책임)과 충돌 없음. "AST 가드" 명칭은 cross-spec 상으로도 이미 통일(`conversation-thread.md` 도 동일 가드를 "frontend AST 가드"로 교차 참조) |
| rationale_continuity | LOW | 과거 결정 번복·기각 대안 재도입 없음. §5 Rationale 의 "가드는 '있다'가 아니라 '깨뜨려 봤다'로만 신뢰"라는 기존 원칙과 같은 계열의 보강으로 판정 |
| convention_compliance | NONE | 정식 규약 직접 위반 없음. 대상 spec 문서 자체를 편집하지 않는 변경이라 문서 구조·API 문서 규약은 적용 범위 밖 |
| plan_coherence | LOW | `plan/in-progress/**` 내 다른 미해결 결정과 충돌 없음. 선행 조건(PR #968 병합, `typescript` devDependency 존재)은 이미 충족. impl-done 단계에서 wording 이슈 재지적 시 트리비얼 spec 후속으로 위임 권고 |
| naming_collision | NONE | 신규 식별자 도입 없음(요구사항 ID·엔티티·API·이벤트·환경변수·파일 경로 전 범주 unchanged). "AST 가드" 는 spec 에 선재하는 이름이라 충돌 대상 아님 |

## 권장 조치사항
1. (비차단) 이번 target 변경(정규식 → TS AST 파싱)은 5개 checker 전원 NONE/LOW 로 수렴 — **developer 는 project-planner 위임 없이 코드 변경만으로 진행 가능**.
2. (선택, 코드 소유 범위) 대상 테스트 파일 JSDoc 헤더·"Known limitation" 주석을 AST 파싱 사실에 맞게 함께 갱신 — 이번 PR 에 자연스럽게 포함 권장.
3. (선택, 후속 doc-sync) `spec/conventions/interaction-type-registry.md` §1.2 rule 3 / §2.1 / §5 의 "grep" 계열 표현을 "AST"/"등록 사이트 파일" 등으로 정리 — project-planner 트리비얼 후속, 이번 작업의 선행 조건 아님.

---

## 산출 경위 (main 기록)

Workflow 반환의 `summary_written: false` / `summary_status: STATUS=write_blocked` — 하네스가 `SUMMARY.md` basename 을 sub-agent 에게 write 허용하지 않으므로, 본 파일은 main 이 반환 `summary_markdown` 을 그대로 persist 한 것이다 (consistency-check skill §3 규약). checker 5/5 usable, `unfinished[]` 없음.
