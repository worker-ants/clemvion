# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 5개 checker 중 Critical·Warning 이슈 없음. INFO 수준 문서 gap 4건 (중복 1건 통합 후 3건) 만 존재.

## Critical 위배 (BLOCK 사유)

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Convention Compliance (통합) | `user_guide:` 필드 — 로케일 쌍 등재 규칙 선언, 대응 build-time 가드 없음 | `spec/conventions/spec-impl-evidence.md §2.1`, `§5.3` | §2.1 또는 §4 관계 절에 "user_guide 경로는 현재 가드 미적용" 임을 명시. 중장기적으로 전용 가드(`spec-frontmatter.test.ts` 또는 `spec-user-guide-paths.test.ts`) 추가 시 §4 표와 `user-guide-evidence.md §2.1` 도 동기화 |
| 2 | Cross-Spec | `spec/data-flow/` 영역 — §1 적용 대상 목록에서 의도적 제외 근거 미기재 | `spec/conventions/spec-impl-evidence.md §1` | §1 하단에 `spec/data-flow/` 를 "의도적 제외 — 데이터 흐름 다이어그램/스키마 매핑, 구현 lifecycle 추적 불요" 로 한 줄 추가 |
| 3 | Cross-Spec | `spec-area-index.test.ts` 면제 목록 — spec 본문과 테스트 코드가 독립 관리 → drift 위험 | `spec/conventions/spec-impl-evidence.md §4.2` vs `spec-area-index.test.ts` 내 면제 구현 | 테스트 코드 면제 목록 주석에 `SoT: spec/conventions/spec-impl-evidence.md §4.2` 추가 |
| 4 | Convention Compliance | §5.3 인라인 코멘트와 §2.1 표현 미묘한 불일치 ("양쪽으로 존재하면" vs "양쪽 존재 시") | `spec/conventions/spec-impl-evidence.md §5.3` (line 171) | §5.3 코멘트를 `# 선택 필드 — KO/EN 양쪽 존재 시 로케일 쌍 모두 등재 (§2.1)` 처럼 §2.1 을 명시적으로 참조하거나 표현을 동일하게 통일 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `user_guide:` 가드 미존재·`spec/data-flow/` 제외 미명시·`spec-area-index.test.ts` drift 위험 — 모두 INFO |
| Rationale Continuity | NONE | 기각된 대안 재도입 없음. 기존 R-1~R-9 invariant 충돌 없음. 순수 명료화 변경 |
| Convention Compliance | LOW | `user_guide:` 가드 미적용 선언 필요(INFO) + §5.3 표현 미미한 불일치(INFO) |
| Plan Coherence | NONE | `user_guide` 로케일 쌍 등재 관행 이미 #773/#774 커밋에서 실 spec 적용 완료. plan 무효화 없음 |
| Naming Collision | NONE | 신규 식별자 없음. `user_guide` 키·`telegram.en.mdx` 경로 모두 기존 코드베이스와 충돌 없음 |

## 권장 조치사항

1. **(선택 — 문서 명료화)** `spec/conventions/spec-impl-evidence.md §2.1` 또는 §4 관계 절에 "`user_guide:` 경로는 현재 build-time 가드 미적용 — 선언적 cross-link 용" 문구 한 줄 추가. 작성자가 경로를 잘못 적어도 빌드에서 검출되지 않음을 명시.
2. **(선택 — 문서 명료화)** `spec/conventions/spec-impl-evidence.md §1` 에 `spec/data-flow/` 를 의도적 제외 목록으로 추가.
3. **(선택 — drift 방지)** `spec-area-index.test.ts` 면제 목록 주석에 SoT 참조 추가.
4. **(선택 — 표현 통일)** §5.3 인라인 코멘트를 §2.1 표현과 동일하게 맞추거나 §2.1 참조 명시.

위 4건은 모두 INFO 등급이며 채택 차단 사유가 없다. 변경을 그대로 진행해도 무방하다.

---

## 후속 적용 메모 (main)

본 PR 에서 INFO #1·#4 를 즉시 반영 (변경 라인과 동일 위치라 self-complete):
- #1 → §2.1 `user_guide` 행에 "현재 build-time 가드 미적용 — 선언적 cross-link 전용" 명시.
- #4 → §5.3 인라인 코멘트를 `(§2.1)` 참조로 통일.

INFO #2·#3 은 본 변경 범위 밖(기존 문서 사안)이라 별건 후속으로 분리.
