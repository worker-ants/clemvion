# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] execution-engine.service.spec.ts — D 후속 min/max·pattern 통합 테스트 포함
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` +306 ~ +348 (§6.2 number min/max 위반, §6.2 pattern 위반 케이스)
- 상세: 이 2개 테스트는 선행 PR(A-1, #610) 당시의 INFO 후속("D 후속")으로, 기술적으로는 A-1 범위 항목이다. 그러나 `plan/in-progress/impl-form-file-validation.md` step 5~7에 "execution-engine.service.spec(file 통합 + D 후속 min/max·pattern 통합 1건씩)"으로 명시적으로 등재되어 있어, plan이 사전 승인한 범위다. 미허가 범위 이탈이 아니다.
- 제안: 변경 불필요. plan 명시 항목.

### [INFO] execution-engine.service.spec.ts — MB_IN_BYTES 임포트 추가
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` +298 (`import { MB_IN_BYTES } from '../chat-channel/shared/form-mode'`)
- 상세: file 통합 테스트에서 바이트 단위 계산에 `MB_IN_BYTES`를 사용하기 위한 임포트다. 이전 리뷰(12_09_39 RESOLUTION INFO#10)에서 매직 넘버 `1024 * 1024` 대신 named 상수를 쓰도록 조치된 결과다. 실제로 사용되는 임포트이며 테스트 범위에 부합한다.
- 제안: 변경 불필요. 사용되는 임포트.

### [INFO] hooks.service.ts — file 검증 부재 의도 주석 추가
- 위치: `codebase/hooks/hooks.service.ts` +582 ~ +585 (NOTE 주석 4줄)
- 상세: `validateFormSubmission` 호출 위에 "scalar 전용, file 은 chat-channel modal 미수용이라 미도달, 검증은 execution-engine publisher chokepoint에서만" 주석이 추가됐다. 이는 이전 리뷰(12_09_39 SUMMARY W3, RESOLUTION W3)에서 요구한 문서화 조치이며, 기능 코드 변경이 없고 의도를 명확히 하는 설명 주석이다. 범위에 부합한다.
- 제안: 변경 불필요. 리뷰 후속 조치.

### [INFO] execution-engine.service.ts — coerceFormValue JSDoc 및 인라인 주석 수정
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` +517 ~ +521, +528
- 상세: `coerceFormValue` JSDoc에 "scalar 필드 전용 — `type:'file'`은 raw metadata 배열로 `validateFileField`가 별도 검증" 주석이 추가됐고, Array 항목 설명에서 "file 메타" 참조가 제거됐다. file 배열을 이제 `validateFileField`가 처리하므로 현실을 반영하는 올바른 수정이다.
- 제안: 변경 불필요. 의미 있는 주석 갱신.

### [INFO] workflow-errors.ts — FormValidationError JSDoc 갱신
- 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts` +555 ~ +561
- 상세: `FormValidationError` JSDoc에서 "chat-channel `validateFormSubmission` 와 동일하게" 참조가 제거되고 `validateScalarField`/`validateFileField` 호출 방식으로 갱신됐으며 검증 항목 열거도 file MIME·크기·개수를 포함하도록 확장됐다. 이는 이전 리뷰(12_09_39 RESOLUTION INFO#6) 후속 조치다.
- 제안: 변경 불필요. 낡은 참조 수정.

### [INFO] form-mode.spec.ts — extractFormFields file 기본값 테스트 + NaN/Infinity 경계값 테스트 추가
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` +49 ~ +121
- 상세: `extractFormFields` describe 블록에 file 필드 기본값 주입 3개 케이스(미설정 시 기본값, 무효값 fallback, NaN/Infinity 경계값)가 추가됐다. NaN/Infinity 케이스는 이전 리뷰(12_09_39 RESOLUTION INFO#4) 후속으로 `Number.isFinite` 가드를 검증하기 위한 것이다. 현 작업 범위(extractFormFields file 기본값 주입 + 가드 강화) 내 테스트다.
- 제안: 변경 불필요. 범위 내 테스트 추가.

### [INFO] form-mode.spec.ts — validateFileField describe 블록에 required+충족→null 케이스 추가
- 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` +151 ~ +153
- 상세: `validateFileField` required + 파일 있음 → null(통과) 케이스 1개가 추가됐다. 이전 리뷰(12_09_39 RESOLUTION INFO#3)에서 "양방향 검증 미완"으로 지적한 사항의 후속 조치다. 범위에 부합한다.
- 제안: 변경 불필요. 리뷰 후속 조치.

### [INFO] dynamic-form-ui.test.tsx — 합계 크기 초과 + 빈 type 통과 + 유효→재선택 에러 해제 케이스 추가
- 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx` +666 ~ +789
- 상세: 이전 리뷰(12_09_39 RESOLUTION INFO#2, INFO#5)에서 지적한 "maxTotalSize 클라이언트 reject 테스트 누락"과 "빈 type 파일 MIME skip 통과 케이스 미명시"를 해소하는 테스트 추가다. 재선택 시 에러 해제 케이스도 동일 describe 블록 내 동작 검증이다. 범위에 부합한다.
- 제안: 변경 불필요. 리뷰 후속 조치.

### [INFO] plan/complete/form-validation-minmax-pattern.md — spec_impact frontmatter 추가
- 위치: `plan/complete/form-validation-minmax-pattern.md` +spec_impact 3행
- 상세: 이전 완료된 plan(A-1)에 `spec_impact` frontmatter가 소급 추가됐다. `plan/in-progress/impl-form-file-validation.md` step 5~7에 "(ISSUE-FIX) pre-existing 게이트"로 명시된 항목이다. 완료 plan 소급 수정이 이례적이나, 게이트 도구가 요구한 사전 조건 수정으로 plan에 사전 포함된 조치다.
- 제안: 변경 불필요. plan 명시 조치.

### [INFO] review/ 산출물 파일 다수 신규 추가
- 위치: `review/code/2026/06/15/12_09_39/` 하위 RESOLUTION.md, SUMMARY.md, 각 reviewer 결과, meta.json, _retry_state.json + `review/consistency/2026/06/15/11_33_17/` 하위 파일들
- 상세: CLAUDE.md 규약상 의무인 impl-prep consistency check 산출물 및 /ai-review 산출물이다. 리뷰 워크플로 결과물로서 정상 범위다.
- 제안: 변경 불필요. 규약 준수 산출물.

## 요약

이번 변경(A-2 파일검증 cluster, RESOLUTION 후속 fresh review 대상)의 범위는 plan `impl-form-file-validation.md`에 명시된 범위와 이전 리뷰(12_09_39) RESOLUTION 조치 항목 내에 정확히 수렴한다. 핵심 변경(validateFileField · validateScalarField · extractFormFields file 기본값 · assertFormSubmissionValid 단일 루프 · dynamic-form-ui.tsx 클라이언트 가드 · i18n 키)은 A-2 설계 결정의 직접 구현이며, 추가된 테스트와 JSDoc 갱신은 모두 RESOLUTION 테이블의 Info·Warning 조치 항목으로 추적 가능하다. D 후속 min/max·pattern 통합 테스트 2건은 plan에 사전 명시된 항목이다. 범위를 이탈한 무관한 수정, 불필요한 리팩토링, 미허가 기능 확장은 발견되지 않았다.

## 위험도

NONE
