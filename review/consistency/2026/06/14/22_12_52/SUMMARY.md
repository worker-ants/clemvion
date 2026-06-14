# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없다.

## 전체 위험도
**LOW** — INFO 등급 5건 존재. 모두 문구 명확화 권장 수준이며 차단 요인 없음. convention_compliance checker 결과 파일 미수기(재시도 필요) 1건.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | D-2 Rationale — `details[]` "보통 길이 1" 표현이 EIA 배열 계약과 레이어 혼용 우려 | `spec-draft-form-hygiene.md` §D-2 Decision 1 | "현 구현은 항상 길이 1(FIRST 오류), 계약상 배열이므로 전수 수집 시 복수 가능"으로 구현 사실·계약 의미 분리 표기 권장 |
| 2 | Cross-Spec | D-2 Rationale — `continueExecution` chokepoint 기술이 form.md §6.2 와 중복, 충돌 없음 | `spec-draft-form-hygiene.md` §D-2 Decision 2 | Rationale 결정 2에 "§6.2 검증 지점 주석 참조" 크로스링크 추가 권장 |
| 3 | Cross-Spec | D-2 Rationale — `form-mode.ts L134` 코드 경로 직접 인용은 stale 위험 | `spec-draft-form-hygiene.md` §D-2 Decision 1 | 코드 파일·라인 인용 대신 동작 사실("publisher `continueExecution` 에서 FIRST 오류 반환")만 기술, 코드 위치는 구현 주석에서 관리 권장 |
| 4 | Rationale Continuity | D-2 Decision 1 `details[]` 표현 — EIA R13 다중 배열 계약과의 연속성 명시 필요 | `spec-draft-form-hygiene.md` §D-2 Decision 1 | 신설 Rationale 문구를 "EIA `details[]` 는 계약상 다중 배열, 현 구현은 항상 길이 1, 다중 확장 시 계약 변경 불필요"로 분리 |
| 5 | Plan Coherence | D-2 Rationale — "전수 수집은 file 검증 cluster 에서 확장" 표현이 미결정 사항을 기정사실처럼 서술 가능성 | `spec-draft-form-hygiene.md` §D-2 Rationale 항목 1 | "현재 단건 반환 — 복수 오류 수집은 필요 발생 시 별도 논의"로 약화하거나 `spec-sync-form-gaps.md`에 결정 보류 메모 추가 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | D-1·D-2 모두 기존 spec과 직접 모순 없음. INFO 3건(details[] 표현 정제, chokepoint 크로스링크, 코드 경로 인용 자제) |
| Rationale Continuity | LOW | details[] 레이어 혼용 표현 INFO 1건. EIA R13 계약 자체 번복 아님 |
| Convention Compliance | 재시도 필요 | 결과 파일 미수기 — 검토 결과 없음 |
| Plan Coherence | NONE | INFO 2건(전수 수집 표현 약화 권장, form-mode.ts 경로 표기 혼동 우려). 차단 없음 |
| Naming Collision | NONE | 신규 식별자 도입 없음. 모든 심볼·경로 기존 코퍼스 내 기확립 |

## 권장 조치사항
1. **(BLOCK 없음 — 즉시 진행 가능)** D-1·D-2 spec 변경을 그대로 적용해도 차단 요인 없음.
2. **(권장, 적용 시)** `details[]` Rationale 문구를 구현 사실(항상 길이 1)과 계약 의미(다중 배열 가능)로 명확히 분리 표기.
3. **(권장, 적용 시)** D-2 Rationale에서 코드 파일·라인 직접 인용 제거, 동작 사실 중심 기술로 전환.
4. **(권장, 적용 시)** D-2 Rationale 결정 2에 form.md §6.2 크로스링크 추가.
5. **(권장, 적용 시)** "전수 수집은 file 검증 cluster에서 확장" 표현을 미결정 표기로 약화.
6. **(후속)** convention_compliance checker 결과 파일이 미수기됨 — 필요 시 단독 재실행으로 확인. 현재 다른 4개 checker 결과 기준 차단 없음.
