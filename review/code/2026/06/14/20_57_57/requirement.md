# 요구사항(Requirement) Review

## 발견사항

### [INFO] [SPEC-DRIFT] spec form §6.2 표 — file MIME/size/count 검증이 "구현됨"으로 기술돼 있으나 코드는 명시적 Planned scope-out
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` §6.2 표 vs `execution-engine.service.ts` `assertFormSubmissionValid` JSDoc
- 상세: spec §6.2 에는 `type: 'file'` MIME / 크기 / 개수 초과가 "폼 재표시(status 유지)" 처리 항목으로 나열되어 있으나, 코드는 의도적으로 이 검증을 제외하고 JSDoc 에 "file MIME/size/count 검증은 Planned — 본 단계 미적용" 으로 명시했다. `validateFormSubmission`에도 file 검증 로직이 없음(required 판정을 위해 빈 배열 → '' coerce 처리만). 코드의 scope-out 결정이 합리적(단계적 구현)이며 되돌릴 이유 없음.
- 제안: 코드 유지 + spec 반영. `/Volumes/project/private/clemvion/spec/4-nodes/6-presentation/4-form.md` §6.2 표에서 `type: 'file' MIME / 크기 / 개수 초과` 행을 "(Planned — 미구현)" 으로 표시 (`project-planner` 위임).

### [INFO] [SPEC-DRIFT] EIA spec §5.1 에러 표 — form field-level 검증이 "일부 Planned" 로 표기돼 있으나 코드는 이제 구현됨
- 위치: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §5.1 `VALIDATION_ERROR` 행 ("현재 form field-level 검증 자체는 일부 Planned — interaction.service 는 data 객체 형식만 확인") vs 이번 변경
- 상세: 이번 변경으로 `assertFormSubmissionValid`(required/email/number/minLength/maxLength/select-choices 검증)가 구현됐으므로 EIA spec §5.1 표의 Planned 주석이 낡아졌다. 코드가 의도적으로 더 많은 검증을 구현한 것이며 되돌릴 이유 없음.
- 제안: 코드 유지 + spec 반영. `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §5.1 `VALIDATION_ERROR` 행 설명의 "현재 … Planned" 문구를 구현 완료 상태로 갱신 (`project-planner` 위임).

### [INFO] details[] 배열이 항상 단일 요소(first-error only)인 점이 spec 본문에 미명시
- 위치: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` §5.1 에러 표
- 상세: EIA spec §5.1 의 `VALIDATION_ERROR` 행은 `details[]` 배열 형식을 예시로 보이나, 배열이 항상 길이 1(first-error only)임을 spec 본문에서 명시하지 않는다. 코드(JSDoc, CHANGELOG)에서는 "현재 단계 FIRST 오류만, details 배열 길이 항상 1"을 명시했다. API 계약의 혼란을 막으려면 spec에도 기술이 필요하나 이는 코드 버그가 아닌 spec 갱신 누락.
- 제안: spec §5.1 `VALIDATION_ERROR` 행 설명에 "현재 단계 FIRST 오류만 surface (details 배열 길이 항상 1)" 주석 추가 권고 (`project-planner` 위임).

### [INFO] file 필드 required 판정 — spec form §1.5 와 coerceFormValue 정합 확인
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `coerceFormValue` 배열 분기
- 상세: spec form §1.5 에서 "file 필드 required: true 인데 빈 배열이면 §6.2 의 필수 필드 미입력 검증 실패 흐름" 이라고 명시한다. `coerceFormValue` 에서 빈 배열 → `''` 로 coerce 하므로 `validateFormSubmission` 의 `isEmpty = value.trim().length === 0` 체크에서 올바르게 실패 처리된다. 비어있지 않은 배열은 콤마 join → `isEmpty` false → file type 은 email/number/select 분기 비해당 → 통과. spec 의도와 일치. file MIME/size 검증은 현 단계 명시적 scope-out.

## 요약

이번 변경은 EIA-IN-10(spec EIA §5.1 / form §4·§6.2)이 요구하는 `submit_form` 서버 측 field 검증(required / email / number / minLength·maxLength / select 선택지)을 publisher 사전 검증 패턴(publish 전 동기 throw → `waiting_for_input` 유지)으로 완전히 구현한다. `FormValidationError` 는 `ExecutionError` 계층으로 WS ack 와 EIA REST 양 표면에 자동 매핑된다. 에러 응답 shape(`400 VALIDATION_ERROR` + `details[{field, message, code: 'INVALID_FIELD'}]`) 과 `code` 값이 spec 본문 예시(EIA spec §5.1 line 301~307)와 정확히 일치하며, `execution.status` 는 검증 실패 시 `waiting_for_input` 을 유지해 EIA-IN-10·EIA-RL-03 를 충족한다. 단위 테스트(5개 경로 + 9개 타입 분기), controller/service/gateway spec 테스트, e2e 케이스 G 모두 추가됐고 192/192 통과. file MIME/size/count 검증은 의도적 단계적 scope-out 이며 JSDoc 에 명시됨. 발견된 사항은 모두 INFO(SPEC-DRIFT 2건 포함)이며 코드 수정 대상 없음 — spec 갱신 누락만.

## 위험도

NONE
