# 문서화(Documentation) 코드 리뷰

## 발견사항

### [INFO] `ButtonDef.userMessage` JSDoc — 내용 정확성 양호, 단 spec 섹션 참조 스타일 불일치
- 위치: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` 43번째 줄 추가 필드
- 상세: 신규 `userMessage` 필드에 JSDoc이 상세하게 기술되어 있으며 SoT 참조(`spec/4-nodes/6-presentation/0-common.md §1 ButtonDef`, §10.8)가 명시되어 있다. 다만 파일 내 다른 필드(`id`, `label`, `type`, `url`, `style`)에는 JSDoc이 없고 `userMessage`만 단독으로 상세 주석을 보유한다. 인터페이스 전체 필드에 일관된 주석 수준을 적용하거나 `userMessage`의 주석 수준을 최소화하는 방향으로 정합성을 맞추면 좋다.
- 제안: 다른 필드에도 한 줄 주석을 추가하거나, 인터페이스 레벨 JSDoc에 전체 필드 설명을 집약한다.

### [INFO] 로컬 `buttonDefSchema` 중복 정의 — 미러 포인트 주석 누락
- 위치: `carousel/carousel.schema.ts`, `chart/chart.schema.ts`, `table/table.schema.ts`, `template/template.schema.ts` — 각 파일의 `buttonDefSchema` 내 `userMessage` 추가
- 상세: 4개 파일 모두 독립적으로 `buttonDefSchema`를 정의하며 `userMessage` 필드를 동일한 `description` 텍스트로 추가했다. `_shared/button.types.ts`의 `MAX_BUTTONS_PER_NODE` 상수에는 "Mirror points: ..." 패턴의 주석이 존재하지만, 각 schema 파일의 로컬 `buttonDefSchema`에는 "`_shared/button.types.ts` 의 `ButtonDef` 인터페이스와 동기화 필요" 류의 미러 포인트 주석이 없다. 향후 `ButtonDef`에 필드가 추가될 때 누락 위험이 있다.
- 제안: 각 schema 파일의 `buttonDefSchema` 정의 상단에 "Mirror: `ButtonDef` interface in `_shared/button.types.ts`" 형태의 한 줄 주석을 추가한다.

### [INFO] `findButtonContext` / `composeUserMessage` — `@internal` 태그와 `export` 충돌 가능성
- 위치: `codebase/frontend/src/components/editor/run-results/renderers/assistant-presentations-block.tsx` — `findButtonContext`, `composeUserMessage` JSDoc
- 상세: 두 함수에 `@internal` 태그가 붙어 있으나 `export`로 공개되어 있다. 이는 테스트 파일에서 직접 import하기 위한 의도적 설계이며, 테스트 파일 상단 주석(`spec §10.8 검증`)이 이를 뒷받침한다. 그러나 `@internal` 태그만으로는 "테스트 목적 export"라는 의도가 불분명하다.
- 제안: JSDoc에 `@internal — exported for testing only; not part of the public API` 형태의 설명을 보충한다.

### [INFO] `carousel.schema.spec.ts` 테스트 suite 이름 — spec 섹션 참조가 describe 제목에 포함되어 유지보수 부담 가능
- 위치: `codebase/backend/src/nodes/presentation/carousel/carousel.schema.spec.ts` 198번째 줄, describe 제목
- 상세: `describe('buttonDefSchema — userMessage (spec/4-nodes/6-presentation/0-common.md §1, §10.8)', ...)` 형태로 spec 파일 경로가 describe 이름에 하드코딩되어 있다. spec 파일이 이동하거나 섹션이 재번호되면 describe 이름이 stale해진다. 다른 schema spec 파일(chart, table, template)도 동일한 패턴을 사용한다.
- 제안: spec 경로를 describe 제목에 직접 넣는 대신 테스트 파일 상단 블록 주석(`/**`)으로 이동하고 describe 이름은 `'ButtonDef — userMessage field'`처럼 경로-독립적으로 유지한다. 현재 수준은 INFO에 해당하며 강제 사항은 아니다.

### [INFO] `plan/in-progress/ai-agent-render-button-user-message.md` — TDD 체크리스트 항목이 미완료 상태
- 위치: `plan/in-progress/ai-agent-render-button-user-message.md` TDD 체크리스트 전체 (`- [ ]`)
- 상세: plan 파일의 모든 체크리스트 항목이 `- [ ]`(미완료)로 남아 있다. 변경 코드를 보면 backend schema 갱신, frontend 구현, 테스트 작성이 모두 완료된 것으로 보인다. 체크리스트가 업데이트되지 않으면 plan 상태와 실제 구현 상태가 불일치한다.
- 제안: 완료된 단계(`(C) backend test 선작성`, `(C) backend zod schema 갱신`, `(C) backend test PASS`, `(A) frontend test 선작성`, `(A) frontend findButtonContext + handlePortButtonClick 구현`, `(A) frontend test PASS`)를 `- [x]`로 표시하여 plan 상태를 실제와 동기화한다.

### [INFO] `validateButtons` 함수 — `userMessage` 필드 유효성 검사 주석 부재
- 위치: `codebase/backend/src/nodes/presentation/_shared/button.types.ts` `validateButtons` 함수 (111번째 줄)
- 상세: `validateButtons`는 `id`, `label`, `type`, `url`, `style` 필드를 검증하지만 새로 추가된 `userMessage` 필드는 검증하지 않는다(옵션 문자열이라 타입 체크 외 별도 제약 없음). 함수 JSDoc(`spec §1.6 and §1.7`)에 "`userMessage` 는 옵션 문자열이므로 별도 검증 없음" 한 줄을 추가하면 향후 유지보수자가 의도적으로 생략된 검증임을 이해할 수 있다.
- 제안: `validateButtons` JSDoc에 `userMessage` 관련 검증 생략 의도를 명시한다.

### [INFO] `backend-labels.ts` — `"User Message"` 번역 추가, 연관 주석 부재
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` 2614번째 줄
- 상세: `"User Message": "사용자 메시지"` 번역 항목이 추가되었다. 이 라벨이 어느 필드에서 사용되는지(buttonDefSchema의 `ui.label: 'User Message'`)를 i18n 파일 내 인라인 주석이나 관련 파일 참조로 남기는 관례가 있는지 확인 필요. 파일 내 다른 항목들이 주석 없이 순수 키-값 쌍으로만 관리되고 있으므로 현재 수준에서는 정합하다.
- 제안: 현행 스타일과 일치하므로 별도 변경 불필요.

### [WARNING] 테스트 파일 상단 모듈 레벨 주석 비일관성 — `assistant-presentations-block.test.tsx`에만 존재
- 위치: `codebase/frontend/src/components/editor/run-results/__tests__/assistant-presentations-block.test.tsx` 48번째 줄 (블록 주석)
- 상세: 신규 추가된 프론트엔드 테스트 파일에는 spec §10.8 합성 우선순위를 설명하는 모듈 레벨 JSDoc이 포함되어 있다. 반면 backend spec 파일들(carousel, chart, table, template)에는 이에 상응하는 파일 레벨 설명 없이 바로 describe 블록으로 시작한다. 일관성 측면에서 양쪽 동일한 패턴을 유지하는 것이 좋다. 단, 이는 backend 테스트 파일의 기존 관행을 따른 것이므로 INFO와 WARNING 경계에 해당한다.
- 제안: backend schema spec 파일들의 신규 describe 블록 앞에 "spec/4-nodes/6-presentation/0-common.md §10.8" 정책을 설명하는 단락 주석을 추가하거나, frontend 테스트의 파일 레벨 JSDoc을 describe 블록 안 주석으로 이동하여 양쪽 스타일을 통일한다.

## 요약

이번 변경은 `ButtonDef.userMessage` 신규 옵션 필드 도입과 AI Agent `render_*` 버튼 클릭 시 user-message 합성 로직을 구현한 작업이다. 전반적으로 문서화 품질이 양호하다. 핵심 로직인 `findButtonContext`와 `composeUserMessage`에 상세한 JSDoc(spec 섹션 참조 포함)이 작성되었고, `ButtonDef` 인터페이스의 `userMessage` 필드 주석도 동작 시맨틱, fallback 규칙, link 타입에서의 무시 정책을 명확히 기술한다. 다만 4개 schema 파일에 분산된 로컬 `buttonDefSchema` 정의에 mirror-point 주석이 없어 향후 `ButtonDef` 확장 시 미러 누락 위험이 있으며, plan 파일의 TDD 체크리스트가 실제 구현 상태와 불일치하는 점은 정리가 필요하다. 이 외의 발견사항은 모두 INFO 수준으로, 기능 동작이나 유지보수에 즉각적인 위험을 주지 않는다.

## 위험도

LOW
