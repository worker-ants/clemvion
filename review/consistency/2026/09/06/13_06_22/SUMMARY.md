# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건(3개 checker 중복 지적 통합)이 있어 호출자가 차단해야 함

## 전체 위험도
**CRITICAL** — 변경안 (A) 의 §3 정정 표가 "DTO·컨트롤러 JSDoc 카브아웃" 전체가 강제된다고 적지만, 실제 신규 가드는 응답 DTO 만 검사하고 컨트롤러 JSDoc 은 미검사 — 같은 초안의 변경안 (C) 서술과도 자기모순.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance, cross_spec (중복 지적 통합) | 변경안 (A) 표가 "§3 (DTO·컨트롤러 JSDoc 카브아웃)" 을 한 덩어리로 "예 — 위 가드" 라 적어 컨트롤러까지 강제되는 것처럼 과대주장. 신규 가드(`dto-jsdoc-citation-guard.ts`)는 `isResponseDtoFile()` 필터로 응답 DTO 파일만 스캔하며 컨트롤러(`*.controller.ts`)를 검사하는 코드는 없음. 같은 초안의 변경안 (C) 는 정확히 "§3 의 **DTO** 카브아웃" 으로 좁혀 써서 (A)·(C) 사이에 표현 폭이 다른 자기모순 존재. `review-citations.md` 자신의 Rationale 이 이미 두 차례 "실측 없는 범위 확장 주장" 실패를 명시했는데, 이번 정정문이 §3 커버리지 서술에서 같은 패턴을 재생산 | `plan/in-progress/spec-draft-review-citations-enforcement.md` 변경안 (A) 표(라인 58 부근, 산문은 라인 27) 및 변경안 (C)(라인 92) | `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(`isResponseDtoFile` — DTO 전용), `dto-jsdoc-citation.spec.ts`; `spec/conventions/review-citations.md §3` 원문 표; 변경안 (C) 자신의 서술 | 표의 해당 행을 "§3 (**응답 DTO** JSDoc 카브아웃)" 으로 좁히거나 DTO/컨트롤러 두 행으로 분리해 컨트롤러 쪽을 "**아니오** — 컨트롤러 JSDoc 은 여전히 사람이 본다" 로 명시. (C) 의 좁은 표현과 일치시킬 것. 이 정정은 target 문서(초안) 자체를 spec 에 반영하기 전에 고치면 되는 국소 편집 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 은 planner 자신이 작성 중인 초안(`plan/in-progress/spec-draft-review-citations-enforcement.md`)의 표현 폭 오류이며, 스코프 확장이나 별도 코드 변경 없이 초안 문구 수정만으로 해소 가능. 호출자 권한 밖 요소 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 변경안 (B)(`review-citations.md` `code:` 에 `dto-jsdoc-citation*.ts` 등재)가 자매 plan 의 열린 3축 등재 항목 중 JSDoc 축 1개를 사실상 선행 실행하는데, 그 사실이 어느 문서에도 동기화되지 않음 | target `## 종결 조건` | `plan/in-progress/spec-draft-nullable-notation-followups.md:521-560` 미체크 항목 "신규 검출 3축을 §5.4 「검증 층」과 code: 에 등재"(구조축·이름축·JSDoc 인용축 3행) | target 종결 조건에 "자매 plan 의 JSDoc 축 행을 완료 표시(또는 2축으로 좁힘)" 추가, 또는 커밋 메시지에 상호 참조 명시 |
| 2 | naming_collision | 같은 Critical 에서 파생된 두 병렬 plan 이 `review-citations.md` 의 동일 `code:` 슬롯에 서로 다른 폭의 glob 을 쓰라고 적음 — target 은 `dto-jsdoc-citation*.ts`(guard+spec 모두 매치), 자매 plan 은 `dto-jsdoc-citation-guard*.ts`(`.spec.ts` 미매치). 좁은 쪽이 최종 반영되면 `.spec.ts` 테스트 파일이 spec-linked 판정에서 다시 빠지는 부분 재발 위험 | target 변경안 (B) YAML 블록(라인 72) | `plan/in-progress/spec-draft-nullable-notation-followups.md:398` 의 동일 등재 항목(glob `dto-jsdoc-citation-guard*.ts`) | 두 plan 의 glob 을 동일하게(`dto-jsdoc-citation*.ts`, guard+spec 양쪽 포함) 맞추고 자매 plan 쪽 체크박스를 처리 완료로 표시하거나 상호 참조 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 변경안 (B) 가 `dto-jsdoc-citation*.ts` 를 `review-citations.md` 의 `code:` 에만 등재하고 `swagger.md` 의 `code:` 에는 등재하지 않는 것은 이미 자매 plan(`spec-draft-nullable-notation-followups.md:398-401`)에서 명시적으로 검토·결정된 의도된 설계 — 충돌 아님 | target 변경안 (B) YAML 블록 | 조치 불요. target/커밋 메시지에 "swagger.md 미등재는 의도" 한 줄 교차 참조 추가 시 재조사 비용 절감 |
| 2 | cross_spec | "함께 처리할 것" 절 3개 항목(§5.4 나열형 전환·`User` 7컬럼 노출 금지 규범·verifier-registration plan 이동) 모두 `spec-draft-nullable-notation-followups.md` 에 실존 등재 확인 — 중복·누락 없음 | target "함께 처리할 것" 절 | 없음 |
| 3 | plan_coherence | "함께 처리할 것" 3건은 target 자신의 종결 조건에 포함되지 않아, target 이 단독 머지되면 이행 여부가 추적되지 않음(권고 수준) | target "함께 처리할 것" 절 | 실행 여부를 별도 추적(스크래치 체크리스트 등). 구속력 있는 종결 조건 승격 여부는 판단 재량 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 변경안 (A) 표의 DTO·컨트롤러 과대주장(WARNING), swagger.md 미등재는 의도 확인(INFO), "함께 처리할 것" 3건 실존 확인(INFO) |
| rationale_continuity | CRITICAL | 변경안 (A)·(B) 가 §3 전체 강제를 주장하지만 실제 가드는 DTO 만 검사 — 변경안 (C) 와 자기모순, `review-citations.md` 자신의 "실측 없는 범위 확장 금지" 원칙을 재위반 |
| convention_compliance | MEDIUM (개별 항목은 CRITICAL 판정 포함) | 동일 §3 과대주장 지적. `spec-impl-evidence.md §2.1`·`review-citations.md` 자체 Rationale 원칙 위반으로 판정 |
| plan_coherence | LOW | 변경안 (B) 가 자매 plan 의 JSDoc 축을 선행완료시키는데 미동기화(WARNING), "함께 처리할 것" 추적 공백(INFO) |
| naming_collision | LOW | 두 병렬 plan 간 `code:` glob 폭 불일치로 `.spec.ts` spec-linked 판정 사각지대 재발 위험(WARNING) |

## 권장 조치사항
1. (BLOCK 해소 우선) target 변경안 (A) 표의 "§3 (DTO·컨트롤러 JSDoc 카브아웃)" 행을 실제 가드 스캔 범위(응답 DTO 전용)에 맞춰 좁히거나 DTO/컨트롤러 두 행으로 분리하고, 컨트롤러 쪽은 "아니오 — 미검증"으로 명시. 변경안 (C) 의 좁은 표현과 일치시킨다.
2. 변경안 (B) 적용 시 `plan/in-progress/spec-draft-nullable-notation-followups.md:398, 521-560` 의 JSDoc 축 항목/glob 을 동일 폭으로 맞추고 완료 표시 또는 상호 참조를 추가한다.
3. "함께 처리할 것" 3건(§5.4 나열형 전환 · `User` 7컬럼 노출 금지 규범 · verifier-registration plan 이동)의 실행 여부를 이번 세션 내에서 추적하거나 target 종결 조건에 반영할지 판단한다.
4. (조치 불요, 기록용) swagger.md 미등재는 의도된 설계임을 커밋 메시지에 한 줄 남긴다.
