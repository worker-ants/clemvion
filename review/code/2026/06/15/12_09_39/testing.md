# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] 프론트엔드 `validateFilesClient` 에서 `f.type` 빈 문자열 처리 — 클라이언트 테스트 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L88
- 상세: `validateFilesClient` 에서 MIME 체크는 `if (f.type && !allowedMime.includes(f.type))` 로 `f.type` 이 빈 문자열이면 체크를 skip 한다. 서버 측 `validateFileField` 는 `typeof m.type === 'string'` 조건으로 동일 방어 패턴을 유지하나, 클라이언트 테스트(`dynamic-form-ui.test.tsx`)에는 `type` 이 빈 문자열인 파일을 선택했을 때 에러가 표시되지 않고 통과하는 케이스가 없다. 브라우저에서 확장자가 없거나 알 수 없는 파일을 선택 시 `File.type === ''` 이 될 수 있어 이 분기는 의도된 것으로 보이나 테스트로 명시되어야 한다.
- 제안: `dynamic-form-ui.test.tsx` 에 `type: ''` 인 파일이 MIME 목록에 없어도 통과(selection 반영)하는 케이스 추가. 의도를 코드 주석으로도 명시 권장.

### [INFO] `validateFileField` — `required` + 파일 있음 정상 통과 테스트 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` `validateFileField` describe 블록
- 상세: `required: true` 이고 파일가 있을 때 null 반환(통과)을 검증하는 테스트가 없다. 현재 테스트는 `required: true` + 빈/undefined → 오류 케이스만 다룬다. 정상 통과 경로(required 충족)의 명시적 확인이 없어 `required` 분기가 양방향으로 검증되지 않는다.
- 제안: `it('required + 파일 있음 → 통과', ...)` 케이스 추가.

### [INFO] `extractFormFields` — `maxFileSize/maxTotalSize` 가 유한수 양수가 아닌 경우(NaN, Infinity) 경계 테스트 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` `extractFormFields` describe 블록
- 상세: 구현 코드(`form-mode.ts`)의 `typeof f.maxFileSize === 'number' && f.maxFileSize > 0` 조건은 `NaN`(`NaN > 0 === false`) 및 `Infinity`(`Infinity > 0 === true`)를 각각 기본값 fallback / 명시 값 적용으로 처리한다. 기존 테스트는 0, 음수, 정상 양수만 다루며 `NaN` 및 `Infinity` 케이스가 없다.
- 제안: `maxFileSize: NaN` → 기본값, `maxFileSize: Infinity` → Infinity 그대로 저장 케이스를 추가. `Infinity` 가 실제 저장될 경우 바이트 변환 곱셈이 `Infinity` 가 되어 size 검증이 항상 통과되므로, 해당 동작이 의도인지 여부도 명시 필요.

### [INFO] 프론트엔드 클라이언트 검증 — `total size` 초과 테스트 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx` `DynamicFormUI — file 클라이언트 검증` describe 블록
- 상세: 서버 측 `form-mode.spec.ts`에는 `total size` 초과 케이스가 있으나, 프론트엔드 `dynamic-form-ui.test.tsx` 에서 동일 시나리오(각 파일은 per-file 한도 이내이나 합계가 `maxTotalSize` 초과)가 빠져 있다. 클라이언트-서버 검증 대칭성을 위해 프론트엔드에도 합계 초과 케이스가 있어야 한다.
- 제안: `DynamicFormUI — file 클라이언트 검증` 블록에 `totalSize 초과 → reject + 에러 표시` 케이스 추가.

### [INFO] 프론트엔드 `validateFilesClient` — `useT` mock 처리 확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`
- 상세: `validateFilesClient` 는 `t: TFunction` 을 받아 i18n 메시지를 반환하고, 컴포넌트는 `useT()` hook 을 사용한다. 테스트에서 `screen.getByText("허용되지 않은 파일 형식입니다.")` 를 한국어 문자열로 직접 단언하므로, 테스트 환경에서 `useT` 가 ko dict 를 반환하거나 key 를 그대로 반환하는 mock 이 있어야 통과한다. 현재 테스트가 통과(plan 기록 `PASS`)하므로 기존 mock 설정이 있는 것으로 추정되나, 명시적 mock 선언이 diff 에 보이지 않아 테스트 격리성이 암묵적 전역 설정에 의존할 수 있다. 이 상태에서 i18n 환경 변경 시 테스트가 조용히 실패할 가능성이 있다.
- 제안: 테스트 파일 내에서 `useT` 가 반환하는 t 함수가 ko 문자열을 돌려주는 것이 setUp 에 명시적으로 선언됐는지 확인하고, 없다면 `vi.mock('@/lib/i18n', ...)` 블록을 명시적으로 추가.

### [INFO] 통합 테스트 — `file required` + 파일 있음 → publish 호출 경로 통합 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` file 통합 블록
- 상세: `execution-engine.service.spec.ts` 의 file 통합 테스트 중 허용 MIME + 크기 이내 → publish 호출 케이스(`§6.2 file 허용 MIME · 크기 이내 → 검증 통과 + publish 호출`)는 존재하나, `required: true` 파일 필드가 존재할 때 파일 값이 누락/빈 배열로 제출되면 `FormValidationError` 로 표면되는 통합 케이스가 없다. 단위 테스트(`validateFileField`)에는 있지만 integration chokepoint(`assertFormSubmissionValid`) 수준에서는 미검증.
- 제안: `§6.2 file required 미제출 → FormValidationError throw + publish 미호출` 통합 케이스 추가(낮은 우선순위, 단위 테스트로 대부분 커버됨).

### [INFO] 프론트엔드 `multiple` attribute 분기 — `maxFiles > 1` 조건 테스트 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` L262
- 상세: `<input multiple={typeof field.maxFiles === "number" && field.maxFiles > 1}>` 로 `maxFiles === 1` 이면 단일 파일 선택만 허용한다. 이 조건에 대한 렌더링 테스트(multiple 속성 유무 검증)가 없다. 기능적 회귀보다는 UI 계약 문서화 차원의 테스트다.
- 제안: `maxFiles: 1` 시 input 이 `multiple` 없이 렌더, `maxFiles: 3` 시 `multiple` 있게 렌더 케이스 추가(낮은 우선순위).

## 요약

이번 변경은 `validateFileField`(서버), `validateFilesClient`(클라이언트), `extractFormFields` 기본값 주입이라는 세 축의 순수 함수를 신규 도입하고, 각각에 대응하는 단위/통합 테스트를 TDD 방식으로 선작성한 구조다. `form-mode.spec.ts` 의 `validateFileField` describe 는 통과/required/MIME/per-file size/total size/count/순서/방어적 shape 총 9케이스, `extractFormFields` 의 file 기본값 주입 3케이스, `execution-engine.service.spec.ts` 의 file 통합 5케이스 + min/max·pattern D-후속 2케이스, `dynamic-form-ui.test.tsx` 의 클라이언트 reject 4케이스로 핵심 경로가 양호하게 커버된다. 발견사항은 전부 INFO 수준으로, 빈 `type` 문자열 처리·`required` 양방향·`total size` 프론트 테스트 누락·통합 수준 required 미검증 등 보강하면 좋은 케이스들이다. Mock 적절성 측면에서 `meta()` 헬퍼가 서버/클라이언트 test fixture 를 명확히 분리하고 있으며, 테스트 간 상태 공유가 없어 격리성도 충족한다.

## 위험도

LOW
