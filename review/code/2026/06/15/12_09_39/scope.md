# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] execution-engine.service.spec.ts — D 후속 min/max·pattern 통합 테스트가 file 검증과 함께 포함됨
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` +619 ~ +659 (`§6.2 number min/max 위반`, `§6.2 pattern(정규식) 위반` 케이스)
- 상세: 해당 2개 테스트는 이전 PR(#610, A-1 완료) 시점의 INFO 후속 항목("D 후속")으로, 기술적으로는 A-1 범위에 속하는 통합 검증이다. 그러나 plan(`impl-form-file-validation.md` step 5~7, line 48)에 "execution-engine.service.spec(file 통합 + D 후속 min/max·pattern 통합 1건씩)"으로 명시적으로 포함돼 있어, 계획된 범위 내 작업이다. 이미 완료된 선행 PR의 follow-up을 현 PR에 묶는 번들 방식이지만, plan이 이를 사전 승인하고 있으므로 미허가 범위 이탈이 아니다.
- 제안: 변경 불필요. plan 항목이 명시적이므로 허용 범위.

### [INFO] dynamic-form-ui.tsx — `useT`/`TFunction` 임포트 추가 및 i18n 의존성 도입
- 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` +3 (`import { useT, type TFunction } from "@/lib/i18n"`)
- 상세: 파일 검증 클라이언트 가드 메시지를 i18n으로 처리하기 위한 임포트이다. 클라이언트 검증 기능 자체가 이번 작업 범위(A-2 §1.5)에 속하므로, i18n 의존성 추가는 직접적으로 필요한 변경이다. 새 임포트는 모두 실제로 사용된다(`validateFilesClient(files, field, t)`, `const t = useT()`).
- 제안: 변경 불필요. 임포트가 신규 기능에 필요한 최소 의존성.

### [INFO] coerceFormSubmission 제거 — 이전에 존재하던 private 메서드 삭제
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` -781 ~ -800 구간 (diff의 `-` 라인들)
- 상세: `coerceFormSubmission`은 `Record<string,string>` 전체 맵을 반환하던 메서드로, 신규 단일 루프(per-field 처리) 방식과 중복돼 제거됐다. 이는 plan에 "coerceFormSubmission(이제 미사용) 제거"로 명시된 범위 내 결정이다. `coerceFormValue` private 메서드는 유지되며, JSDoc 주석 1줄이 "multi-select·file 메타 배열 대응" → "multi-value(multi-select 등) 배열 대응"으로 갱신됐다. 이 주석 변경은 file 배열을 이제 `validateFileField`가 별도 처리하는 것을 반영하는 것으로, 의미 있는 수정이다.
- 제안: 변경 불필요. 삭제 및 주석 갱신 모두 기능 범위에 부합.

### [INFO] plan/complete/form-validation-minmax-pattern.md — spec_impact 필드 추가
- 위치: `plan/complete/form-validation-minmax-pattern.md` +spec_impact 3행
- 상세: 이전 완료된 plan 파일(A-1 PR #610)에 `spec_impact` frontmatter가 추가됐다. plan/in-progress 체크리스트의 "(ISSUE-FIX) pre-existing 게이트" 항목으로 명시적으로 계획된 수정이다. 완료된 plan 파일을 소급 수정하는 것은 이례적이나, 게이트 도구가 이를 요구한 사전 조건 수정이다.
- 제안: 변경 불필요. plan 체크리스트에 명시적으로 포함된 항목.

### [INFO] review/consistency/2026/06/15/11_33_17/ — 5개 consistency 리뷰 산출물 신규 추가
- 위치: 파일 12~19 (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md)
- 상세: 이번 작업의 impl-prep consistency check 산출물이다. CLAUDE.md 규칙상 developer는 구현 착수 직전 `consistency-check --impl-prep`을 의무적으로 수행해야 하며 결과를 `review/consistency/` 에 저장한다. 해당 파일들은 리뷰/검토 기록물로서 정상적인 워크플로우 산출물이다.
- 제안: 변경 불필요. 규약 준수 산출물.

## 요약

이번 변경(A-2 파일검증 cluster)의 범위는 plan(`plan/in-progress/impl-form-file-validation.md`)에 명시된 대로 유지됐다. 핵심 변경(file 검증 상수·`extractFormFields` file 기본값 주입·`validateScalarField`·`validateFileField` 신규·`assertFormSubmissionValid` 단일 루프·`dynamic-form-ui.tsx` 클라이언트 가드·i18n 키)은 모두 A-2 설계 결정의 직접적인 구현이다. D 후속 min/max·pattern 통합 테스트 2건은 선행 PR(A-1)의 INFO follow-up으로 current plan에 사전 포함된 항목이며, consistency 산출물 및 plan 파일 수정도 모두 workflow 규약 내 조치다. 범위를 이탈한 무관한 수정, 불필요한 리팩토링, 또는 미허가 기능 확장은 발견되지 않았다.

## 위험도

NONE
