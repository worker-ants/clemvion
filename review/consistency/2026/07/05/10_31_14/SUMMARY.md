# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 단, 최초 실행에서 3개 checker(cross_spec, plan_coherence, naming_collision) 결과 파일이 디스크에서 확인되지 않아 **재실행**함(아래 재실행 결과 반영).

## 전체 위험도
**LOW** — 확인된 2개 checker(rationale_continuity, convention_compliance) 결과 모두 LOW. 3개 checker(cross_spec, plan_coherence, naming_collision)는 최초 output_file 부재로 재실행(결과는 재실행 산출물 참조).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `swagger.md §2-5` 는 pass-through 예외를 `PaginatedResponseDto` **하나**로 명시("유일한 예외")하는데, target 은 `api-convention.md §5.2` 에만 두 번째 예외(비-페이징 고정 컬렉션)를 추가하고 `swagger.md` 는 갱신 대상에서 누락 — SoT 드리프트 위험 | draft `## 변경 1`/`## 변경 3` | `spec/conventions/swagger.md §2-5` | `swagger.md §2-5` 에 "비-페이징 고정 컬렉션(`items` 단일 배열)도 동일 pass-through 메커니즘의 두 번째 사례" 상호 참조 추가 (변경 4 신설) |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| 1 | rationale_continuity | `swagger.md §6` "레거시 패턴 제거" 기각 사례(페이징+items double-wrap 버그)와 표면 유사 → 오인 위험. 실질은 pagination 필드 유무로 구분 | 변경 3 Rationale 에 "swagger.md §6 기각 페이징 double-wrap 버그와 무관 — 순수 비-페이징 컬렉션 한정" 한 문장 추가 |
| 2 | convention_compliance | `9-user-profile.md` sessions 엔드포인트(line 329-331) 응답 wrapper 미기재 (오기는 아님) | 선택적 각주 |

## Checker별 위험도

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | 재실행 (최초 파일 부재) | 재실행 산출물 참조 |
| rationale_continuity | LOW | 결정 번복 아님·scope 명확화. swagger.md §6 유사성은 INFO |
| convention_compliance | LOW | 코드 근거 정확. 유일 WARNING = swagger.md §2-5 "유일한 예외" 미동기 |
| plan_coherence | 재실행 (최초 파일 부재) | 재실행 산출물 참조 |
| naming_collision | 재실행 (최초 파일 부재) | 재실행 산출물 참조 |

## 권장 조치사항
1. (WARNING #1 해소) `swagger.md §2-5` 에 비-페이징 고정 컬렉션 pass-through 예외 상호 참조 명시 — draft 변경 4 신설.
2. (INFO #1) 변경 3 Rationale 에 swagger.md §6 기각 사례 무관성 한 문장 추가.
