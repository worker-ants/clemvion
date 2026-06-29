# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 변경을 차단할 사유가 없습니다.

## 전체 위험도
**LOW** — 모든 checker 가 NONE 또는 LOW 를 보고했으며, Critical/WARNING 급 위배는 전무합니다. 유일한 LOW 는 Rationale 기록 누락(INFO 수준)에서 비롯됩니다.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/data-flow/**` 제외 설명 범위 오독 가능성 — 독자가 "어떤 가드도 미적용"으로 오해할 수 있으나, 실제로는 frontmatter-evidence 가드(`INCLUDE_PREFIXES`)만 제외이며 링크 무결성·area-index 가드는 data-flow 에도 적용됨 | `spec/conventions/spec-impl-evidence.md §1` 추가 blockquote | §1 설명 문장에 "frontmatter-evidence 가드(`INCLUDE_PREFIXES`)에서만 제외; 링크 무결성·area-index 가드(§4.2)는 data-flow 에도 적용"임을 보강 |
| 2 | Cross-Spec | `user_guide` KO/EN 쌍 등재 규칙이 `user-guide-evidence.md` 에 미등재 | `spec/conventions/spec-impl-evidence.md §2.1` `user_guide` 행 | `user-guide-evidence.md` 에 "로케일 쌍 등재 기준은 `spec-impl-evidence.md §2.1` 참조" 한 줄 추가 고려 |
| 3 | Rationale Continuity | `user_guide:` build-time 가드 미적용 결정 근거가 Rationale 에 미기재 — 번복이 아닌 기록 누락 | `spec/conventions/spec-impl-evidence.md §2.1` + `## Rationale` | Rationale 에 R-10(또는 R-6 하위) 추가: "`user_guide:` 는 선언적 cross-link 전용이라 stale 경로가 spec 약속(surface 정의)을 훼손하지 않으므로 build 차단 불필요" |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 구현(`INCLUDE_PREFIXES`, `collectSpecMarkdown`, `data-flow/` 파일 frontmatter 부재)과 모두 일치. INFO 2건 (오독 방지 설명 보강·인접 문서 동기화 권장) |
| Rationale Continuity | LOW | `user_guide:` 가드 미적용 설계 결정이 Rationale 에 기재되지 않은 기록 누락. 기존 결정 번복은 아님 |
| Convention Compliance | NONE | CLAUDE.md 3섹션 구조·정식 규약 범위 내 편집. 규약 위반 없음 |
| Plan Coherence | NONE | `plan/in-progress/` 전체 검색 결과 data-flow frontmatter 의무화·`INCLUDE_PREFIXES` 확장 선행 조건 없음. 충돌·후속 누락 없음 |
| Naming Collision | NONE | 신규 식별자 4건 모두 충돌 없음(`INCLUDE_PREFIXES` 구현 상수와 의미 일치, `spec/data-flow/**` 기존 경로 참조, 신규 용어 선점 사례 없음) |

## 권장 조치사항

1. **(선택 — 오독 방지)** `spec/conventions/spec-impl-evidence.md §1` blockquote 에 "frontmatter-evidence 가드(`INCLUDE_PREFIXES`)에서만 제외이며, 링크 무결성·area-index 가드는 `spec/data-flow/`에도 적용됨"을 한 문장 추가하면 독자 혼란을 예방할 수 있습니다.
2. **(선택 — Rationale 완결성)** `## Rationale` 에 R-10 항 추가: `user_guide:` 가 §4 가드 대상에서 제외된 이유(선언적 cross-link 전용, stale path 가 spec surface 정의를 훼손하지 않음)를 명문화합니다.
3. **(선택 — 문서 동기화)** `spec/conventions/user-guide-evidence.md` 에 `user_guide:` 로케일 쌍 등재 기준 참조 링크(`spec-impl-evidence.md §2.1`) 한 줄 추가를 고려합니다.

위 3건은 모두 선택 사항이며, 미조치 시에도 차단 사유가 되지 않습니다.

---

## 후속 적용 메모 (main)

본 PR 에서 INFO #1·#3 즉시 반영 (변경 라인과 동일 영역, self-complete):
- #1 → §1 blockquote 에 "§4.2 링크 무결성·area-index 가드는 data-flow 에도 적용 — 제외는 frontmatter-evidence family 한정" 명시.
- #3 → `## Rationale` 에 **R-10** 신설 (`user_guide:` 가드 미적용 근거 = 선언적 cross-link 전용, stale 경로가 surface invariant 훼손 안 함).

INFO #2 (`user-guide-evidence.md` 동기화) 는 인접 다른 convention 파일이라 별건 후속으로 분리.
