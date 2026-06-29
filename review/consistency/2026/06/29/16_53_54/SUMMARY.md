# Consistency Check 통합 보고서 (Principle 3-C cross-ref 추가 후 재검)

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 5개 checker 중 4개 NONE, 1개(Cross-Spec) LOW. Critical·Warning 없음(WARNING 2건은 stale-read). 모든 발견은 INFO 또는 stale-read 수준.

> **main 검증 노트**: WARNING #1·#2 (Principle 7 판별 정의 line 172 / 가드 요약표 line 189) 는 **stale-read** — 본 커밋(029a9499c)에 이미 올바른 내용이 반영됨. checker 가 "이미 적용 완료 상태라면 추가 조치 불필요" 로 명시. origin/main 미머지 구버전과의 diff 산물이지 실제 갭 아님.
>
> **P2-b 항목(INFO-3)**: 사용자 요청의 pre-existing "P2-b" 건은 검증 결과 **오기가 아님** — P-code(P1-B/P1-C/P3-C/P2-b)는 Principle 번호와 별개의 phase 라벨 체계(`parallel-p2-followups.md` 의 P2 phase)이고, Rationale "왜 P2-b 는 hard fail 이 아닌 ratchet 인가"(line 207) 헤딩에서도 동일하게 쓰인다. "P1-b" 로 바꾸면 cross-ref 가 깨지므로 변경하지 않음. INFO-3 의 "출처 명시 보강" 은 선택적 형식 nit 으로 본 종결 범위 밖.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING) — 전부 stale-read (이미 반영됨)

| # | Checker | 위배 | target | 비고 |
|---|---------|------|--------|------|
| 1 | Cross-Spec | Principle 7 GUI 흐름 절 판별 정의 stale (line 172) | i18n-userguide.md | **이미 반영됨** (029a9499c). origin/main diff 산물 |
| 2 | Cross-Spec | 자동 가드 요약표 Principle 7 행 stale (line 189) | i18n-userguide.md | **이미 반영됨** (029a9499c) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 처리 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `user-guide-evidence.md §5` 예고 문장 stale 가능성 | user-guide-evidence.md §5 | **이미 #777 에서 현재형으로 정정 완료** (stale 판단은 origin diff 기준) |
| 2 | Convention Compliance | 명시적 `## Overview` heading 없이 인트로 문단이 대체 | i18n-userguide.md 상단 | pre-existing 구조 nit, conventions 군 관행. 본 범위 밖 |
| 3 | Convention Compliance | P2-b 코드 출처(plan phase)가 본문에 형식 정의 안 됨 | 가드 요약표 Principle 1 행 | pre-existing. P2-b 는 의도된 라벨(검증 완료) — 변경 안 함 |
| 4 | Convention Compliance | frontmatter `status` 와 HTML 주석 내 중복 선언 | line 17-18 | pre-existing 형식 nit. 본 범위 밖 |
| 5 | Plan Coherence | `parallel-p2-followups.md §6` Principle 3-C 이미 `[x]` 완료 — 본 cross-ref 와 정합 (확인) | plan | 변경 불요 |
| 6 | Naming Collision | 신규 식별자 전무, 기존 식별자 설명 보강·교차 참조만 | 변경 4 파일 | 이상 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | WARNING 2건(stale-read, 이미 반영) |
| Rationale Continuity | NONE | 합의 번복 없음. 영문 SoT·ratchet 분리·개념 절 수동 경계 유지 |
| Convention Compliance | NONE | frontmatter 스키마 완전 준수. INFO 4건은 pre-existing 형식 제안 |
| Plan Coherence | NONE | in-progress plan 충돌 없음. cross-ref 가 완료 결정과 정합 |
| Naming Collision | NONE | 신규 식별자 없음 |

## 권장 조치사항

1. **(WARNING — 이미 해소)** i18n-userguide.md line 172·189 는 본 커밋에 반영 완료. 머지 시 origin/main 과 정합.
2. **(INFO — 본 범위 밖)** Overview heading·HTML 주석 중복·P2-b 출처 명시는 본 종결 체인과 무관한 pre-existing 형식 nit. 끌어들이지 않음.
