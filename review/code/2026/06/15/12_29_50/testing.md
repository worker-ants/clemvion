# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `validateFileField` — `required` + 파일 있음 양방향 검증 누락 (이미 해소됨)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` — `validateFileField` describe 블록
- **상세**: 이전 리뷰(12_09_39) 에서 INFO#3 으로 지적됐고, RESOLUTION.md 에 "062bd3e1 에서 추가" 로 기록되어 있다. 현재 diff 의 `'required + 파일 있음(충족) → null (양방향 검증)'` 케이스가 해당 보강을 포함한다. 양방향 검증 완비.
- **제안**: 해소 완료 — 추가 조치 불필요.

### [INFO] `extractFormFields` — `NaN/Infinity` 경계값 테스트 (이미 해소됨)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` — `extractFormFields` describe 블록
- **상세**: 이전 리뷰(12_09_39) INFO#4 에서 "Infinity 가 그대로 저장되면 size 검증 항상 통과" 위험 지적. RESOLUTION 에서 `Number.isFinite` 가드 추가 + 테스트 추가로 해소됐다. 현재 diff 에 `§1 file 필드 — NaN/Infinity 숫자 제약은 비유한수라 기본값 fallback` 케이스가 포함된다.
- **제안**: 해소 완료. `Infinity` 를 기본값으로 거부하는 명시적 의도도 주석으로 잘 기술되어 있어 회귀 방지 기여가 크다.

### [INFO] 프론트엔드 `maxTotalSize` 클라이언트 가드 테스트 (이미 해소됨)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx` — `DynamicFormUI — file 클라이언트 검증` describe 블록
- **상세**: 이전 리뷰(12_09_39) INFO#2 에서 누락 지적. RESOLUTION 에서 해소됐으며 현재 diff 에 `합계 크기 초과(maxTotalSize) → reject + 에러 표시` 케이스가 추가됐다. 서버측 `form-mode.spec.ts` 와 대칭성 달성.
- **제안**: 해소 완료.

### [INFO] 프론트엔드 `f.type === ''` 빈 확장자 skip 테스트 (이미 해소됨)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`
- **상세**: 이전 리뷰(12_09_39) INFO#5 에서 누락 지적. RESOLUTION 에서 해소됐으며 현재 diff 에 `확장자 없는 파일(File.type === '') → MIME 체크 skip → 통과(반영)` 케이스가 추가됐다. 구현 의도(브라우저가 MIME 미상 시 거부하지 않음)를 테스트로 명시하여 문서화 역할도 충족.
- **제안**: 해소 완료.

### [WARNING] 프론트엔드 테스트 — `useT` i18n mock 미명시, 전역 store 기본값 암묵 의존
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`
- **상세**: 테스트가 `screen.getByText("허용되지 않은 파일 형식입니다.")` 등 한국어 문자열로 단언한다. `dynamic-form-ui.tsx` 는 `useT()` hook 을 통해 i18n 메시지를 가져온다. 테스트 파일 및 vitest setup (`/codebase/frontend/src/test/setup.ts`) 에 `vi.mock('@/lib/i18n', ...)` 선언이 없다. 동작 근거는 `locale-store` 의 `DEFAULT_LOCALE = 'ko'` 가 jsdom 환경에서도 적용되어 `useT()` 가 ko 딕셔너리를 반환하기 때문이다. 이 의존성은 암묵적이며: (a) `DEFAULT_LOCALE` 이 `'en'` 으로 변경되면 모든 파일 관련 단언이 조용히 실패하고, (b) `locale-store` 에 테스트 간 잔류 상태가 생기면 locale 이 변경될 수 있다. 테스트 격리성이 전역 zustand store 의 초기 상태에 의존하므로 이전 테스트가 `setLocale('en')` 을 호출한 뒤 리셋하지 않으면 이후 테스트가 영향받는다.
- **제안**: (A) 테스트 파일 상단에 `vi.mock('@/lib/i18n', () => ({ useT: () => (key: string, params?: Record<string, unknown>) => translateKo(key, params), ... }))` 를 명시적으로 선언하거나, (B) setup.ts 에 `beforeEach(() => useLocaleStore.setState({ locale: 'ko' }))` 를 추가하여 격리를 보장. 현재 PASS 이지만 취약한 암묵적 의존이다.

### [INFO] 통합 테스트 — `file required` 미제출 → `assertFormSubmissionValid` chokepoint 통합 검증 누락
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — file 통합 블록
- **상세**: 이전 리뷰(12_09_39) INFO#16 에서 이미 식별되어 "단위 테스트로 커버, 통합 우선순위 낮음 — defer" 결론. 현재 diff 에 `§6.2 file 허용 MIME · 크기 이내 → 검증 통과 + publish 호출` 정상 경로는 있으나, `required: true` file 필드 + 빈 배열 제출 → `FormValidationError throw + publish 미호출` 통합 케이스는 없다. 단위(`validateFileField` required 케이스)로 충분히 커버되므로 차단 수준은 아니다.
- **제안**: 낮은 우선순위. 필요 시 `§6.2 file required 미제출 → FormValidationError throw + publish 미호출` 케이스 1개 추가 고려.

### [INFO] 프론트엔드 `multiple` attribute 조건 분기 테스트 미포함
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx`
- **상세**: `renderField` 에서 `multiple={typeof field.maxFiles === "number" && field.maxFiles > 1}` 조건이 적용된다. `maxFiles: 1` 시 단일 파일 피커, `maxFiles: 3` 시 multiple 피커가 되는 렌더링 계약이 테스트로 명시되어 있지 않다. 이전 리뷰(12_09_39) INFO#testing 항목에서도 지적됐으나 defer 처리. 기능 정확성보다 UI 계약 문서화 차원의 테스트 부재다.
- **제안**: 낮은 우선순위. `maxFiles: 1` 시 `<input>` 에 `multiple` 속성 부재, `maxFiles: 3` 시 `multiple` 속성 존재를 각각 단언하는 케이스 추가 고려.

### [INFO] `execution-engine.service.spec.ts` — `fileMeta` 헬퍼가 `describe` 블록 중간 위치
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `const fileMeta = ...` 정의 위치
- **상세**: `fileMeta` 헬퍼가 이전 `it` 블록들과 이후 `it` 블록들 사이에 삽입되어 있다. 동작상 문제 없으나 `form-mode.spec.ts` 패턴(describe 상단 헬퍼 선언)과 일관성이 없다. 이전 리뷰(12_09_39) maintainability INFO#11 에서 defer 처리된 cosmetic 이슈.
- **제안**: 단기 불필요. 향후 file 테스트가 별도 inner describe 로 묶이면 자연 해소.

### [INFO] `MB_IN_BYTES` import 미적용 — 리터럴 `1024 * 1024` 잔존 여부 확인
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- **상세**: RESOLUTION(062bd3e1)에서 INFO#10 — `MB_IN_BYTES` import 사용 조치가 기록되어 있다. 현재 diff 에 `import { MB_IN_BYTES } from '../chat-channel/shared/form-mode'` 가 추가되어 있어 최상단 import 는 반영됐다. diff 본문 내 `11 * MB_IN_BYTES`, `2 * MB_IN_BYTES` 로 사용하는 것도 확인된다. 해소 확인.
- **제안**: 해소 완료. 일관성 달성.

## 요약

이번 변경(A-2 file validation cluster)의 테스트 전략은 세 계층(form-mode 단위, execution-engine 통합, dynamic-form-ui 컴포넌트)을 TDD 순서로 망라하여 전반적으로 양호하다. 이전 리뷰(12_09_39) 에서 지적된 INFO 급 테스트 누락 항목(maxTotalSize 프런트엔드 케이스, required 양방향, NaN/Infinity 경계값, 빈 type 빈 문자열 skip)이 RESOLUTION 커밋(062bd3e1)에서 모두 추가됐다. 주요 잔여 이슈는 프런트엔드 `useT` i18n mock 이 명시적으로 설정되지 않고 `locale-store` 전역 기본값(`DEFAULT_LOCALE = 'ko'`)에 암묵적으로 의존하는 점으로, 현재는 PASS 하지만 격리성이 취약하다. 나머지 항목(required 미제출 통합 케이스, `multiple` attribute 테스트)은 단위 커버리지로 충분하며 우선순위가 낮다. Mock 적절성·테스트 격리(단위 간 상태 공유 없음)·가독성(헬퍼 함수명·한국어 it 설명)은 우수한 수준이며, D 후속 min/max·pattern 통합 케이스가 계획대로 포함되어 회귀 테스트 역할을 충족한다.

## 위험도

LOW

STATUS: SUCCESS
