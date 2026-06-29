# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 1건(§5 미완료 TODO vs `status: implemented` 불일치)이 있으나 실제 구현은 이미 완료 상태이며 서술 교정만 필요. 데이터 모델·API 계약·요구사항 ID·상태 전이·권한 충돌은 없음.

> **main 검증 노트 (stale-read false positive)**: WARNING #1 이 지목한 §5 "후속으로 … 명시한다" 미래형 문구는 **이미 본 작업에서 수정됨** (working tree line 161 = "본 가드의 부분 커버 범위는 … 이미 반영돼 있다"). checker 가 제안한 대체 문구가 실제 적용된 문구와 **verbatim 일치**하는 것이 증거 — 미커밋 working-tree 변경을 제외하고 committed HEAD 를 읽은 stale-read 다. 별도 조치 불필요. (직전 15_23_09 run 의 CRITICAL "R-10 dangling" 도 false positive 였음 — R-10 은 #776 으로 merge 되어 spec-impl-evidence.md line 252 에 실존; 본 run 에서는 정상 해소.)

## Critical 위배 (BLOCK 사유)

해당 없음.

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `status: implemented` 선언 문서에 §5 마지막 단락이 미완료 TODO 미래형으로 잔존 (※ **stale-read false positive — 이미 수정 완료**, 위 main 노트 참조) | `spec/conventions/user-guide-evidence.md §5` 마지막 단락 | `spec/conventions/i18n-userguide.md §Principle 7` | (이미 적용됨) §5 마지막 단락을 현재완료형으로 교체 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `i18n-userguide.md §Principle 7` 의 `findGuiFlowSections()` strong 신호 기준이 "시작 한정" 으로 서술돼 target 의 "절 본문 어디든" 보다 좁아 보임 | `i18n-userguide.md §Principle 7` | 동기화 (선택). target(SoT) 변경 불필요 |
| 2 | Cross-Spec | `spec/2-navigation/13-user-guide.md §8` ImplAnchor 표에 `api-endpoint` kind 검증 규칙 미기재 | `13-user-guide.md §8` | 주석 추가 (선택) |
| 3 | Cross-Spec | `spec-impl-evidence.md §4.1` 관계 기술에 신규 가드 3건 미포함 | `spec-impl-evidence.md §4.1` | 동기화 (선택) |
| 4 | Cross-Spec | `i18n-userguide.md §자동 가드 요약` 표 Principle 7 행이 `—`(수동)으로만 남음 | `i18n-userguide.md` 요약 표 | 가드 3건 추가 (선택) |
| 5 | Rationale Continuity | `user-guide-evidence.md Rationale` 에 `user_guide:` 가드 미적용 R-N 부재 (§2.1 인라인 참조로 충분) | `user-guide-evidence.md Rationale` | R-6 추가 (선택) |
| 6 | Rationale Continuity | Rationale 에 "개념 설명 절 커버 불포함 이유" 자기 완결성 낮음 | `user-guide-evidence.md Rationale R-4` | 한 줄 추가 (선택) |
| 7 | Convention Compliance | Rationale R-4·R-5 항목 미기재 | `user-guide-evidence.md Rationale` | 항목 추가 (선택) |
| 8 | Convention Compliance | §2.1 `nodes-coverage.test.ts` "방향이 동일" 표현 혼동 소지 | `user-guide-evidence.md §2.1` | 명확화 (선택) |
| 9 | Naming Collision | `id: user-guide-evidence` 와 `id: user-guide` 인접 — 충돌 없음 | frontmatter | 변경 불필요 |
| 10 | Plan Coherence | 미해결 결정 충돌 없음. 선행 조건(§Principle 7 반영, §2.1·R-10 존재) 모두 해소 확인 | — | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·API·요구사항 ID·권한 충돌 전무. INFO 4건(표현 불일치·요약 누락) |
| Rationale Continuity | NONE | 합의 원칙 번복·기각 대안 재도입 없음. INFO 2건(Rationale 자기 완결성 보완) |
| Convention Compliance | LOW | WARNING 1건(stale-read false positive, 이미 수정). INFO 2건 |
| Plan Coherence | NONE | 미해결 결정 충돌·선행 조건 미해소·후속 누락 모두 없음 |
| Naming Collision | NONE | 신규 식별자 전체 충돌 없음 |

## 권장 조치사항

1. **(WARNING — 이미 해소)** §5 마지막 단락 현재완료형 교체 — 본 작업에서 적용 완료 (stale-read 로 재플래그됨).
2. **(INFO — 선택적, 별건)** `i18n-userguide.md §Principle 7` / 자동 가드 요약 표 동기화 (INFO-1/4).
3. **(INFO — 선택적, 별건)** `user-guide-evidence.md Rationale` R-4·R-5·R-6 보완 (INFO-5/6/7).
4. 나머지 INFO 는 현행 유지 가능 — 실제 구현·동작 모순 없음.
