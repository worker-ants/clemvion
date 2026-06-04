# Cross-Spec 일관성 검토 결과

**대상 문서**: `spec/conventions/spec-impl-evidence.md`
**검토 모드**: `--impl-done` (scope=spec/conventions/spec-impl-evidence.md, diff-base=origin/main)
**검토 일시**: 2026-06-04

---

## 발견사항

### 발견사항 없음 — 충돌 없음

이번 구현 diff(신규 테스트 파일 4개 + 공유 헬퍼 1개)와 `spec/conventions/spec-impl-evidence.md` 본문, 그리고 연관 spec 영역(`spec/0-overview.md`, `spec/1-data-model.md`, `.claude/docs/plan-lifecycle.md`) 사이에 아래 6개 점검 관점 기준 충돌은 없다.

#### 1. 데이터 모델 충돌 — 없음

신규 파일들은 spec/plan frontmatter(`worktree`, `started`, `owner`, `spec_impact`)를 파싱하는 테스트다. 이 필드들은 `.claude/docs/plan-lifecycle.md §4·§5 Gate C`에 정확히 정의되어 있고, `spec/1-data-model.md`의 어떤 DB 엔티티와도 겹치지 않는다.

#### 2. API 계약 충돌 — 없음

신규 코드는 REST API endpoint를 정의하거나 참조하지 않는다. 순수 파일시스템·frontmatter 파싱 테스트다.

#### 3. 요구사항 ID 충돌 — 없음

신규 테스트 파일에 요구사항 ID가 부여되지 않는다. `spec-plan-completion.test.ts`가 참조하는 cutoff 날짜(`2026-06-04`)와 gate 명칭("Gate C")은 `plan-lifecycle.md §5 Gate C`와 완전히 일치한다.

#### 4. 상태 전이 충돌 — 없음

`spec-plan-completion.test.ts`가 강제하는 `spec_impact` 필드 라이프사이클(완료 plan이 `started ≥ 2026-06-04`일 때 필수)은 `plan-lifecycle.md §5 Gate C`의 기술과 일치한다. `spec/conventions/spec-impl-evidence.md §4 표`에도 동일 Gate C 설명이 병기되어 있고 cutoff·sentinel 값이 모두 동일하다.

#### 5. 권한·RBAC 모델 충돌 — 없음

신규 파일은 RBAC에 영향을 주지 않는다.

#### 6. 계층 책임 충돌 — 없음

- `plan-frontmatter.test.ts` — `plan/in-progress/*.md` 최상위 파일의 frontmatter guard. SoT(`plan-lifecycle.md §4`)와 일치.
- `spec-area-index.test.ts` — spec 영역 폴더 TOC 완결성 guard. `spec/conventions/spec-impl-evidence.md §4.0` 참조 목록에 명시된 가드.
- `spec-link-integrity.test.ts` — spec 내 in-repo 링크·앵커 실존 guard. 동일 §4.0 참조 목록에 명시.
- `spec-links.ts` — 위 두 링크 가드의 공유 헬퍼. `codebase/frontend/src/lib/docs/__tests__/` 위치는 `spec-impl-evidence.md §4 본문`이 지정한 위치와 일치.

`spec/conventions/spec-impl-evidence.md` frontmatter의 `code:` 목록에 신규 5개 파일이 올바르게 등재되어 있고(`plan-frontmatter.test.ts`, `spec-plan-completion.test.ts` 포함), `status: implemented`이므로 frontmatter-evidence 가드(`spec-code-paths.test.ts`)도 통과한다.

---

## 요약

이번 diff는 `spec/conventions/spec-impl-evidence.md §4.0`에 기술된 인접 지식저장소 가드 3건(`spec-link-integrity`, `spec-area-index`, `plan-frontmatter`)과 Gate C 가드(`spec-plan-completion`)의 실제 구현 코드다. 각 가드의 cutoff·sentinel·허용값·면제 조건이 `plan-lifecycle.md §4·§5`와 완전히 정합한다. 다른 spec 영역(데이터 모델, API, RBAC, 실행 엔진 등)과의 교차 충돌 항목은 발견되지 않았다.

---

## 위험도

NONE
