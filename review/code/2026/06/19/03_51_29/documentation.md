# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `StructuredInteraction.type` 유니온에 `form_submitted`/`message_received` 포함 — 문서 맥락 불일치 가능성
- 위치: `button-interaction.service.ts` — `StructuredInteraction` 인터페이스
- 상세: JSDoc 주석 `/** 통합 상호작용 형태 (CONVENTIONS §4.5 — ...) */` 는 버튼 관련 용례를 전제하는데, 실제 `type` 유니온에는 `form_submitted`, `message_received` 도 포함되어 있다. 이 인터페이스가 범용 공유 타입으로 확장된 의도라면 파일 모듈 위에 그 범위를 명시하는 것이 좋다. 반면 버튼 전용이라면 해당 두 변형을 제거하거나 TODO 코멘트를 달아야 한다. 현재 JSDoc 한 줄로는 어느 쪽인지 독자가 추론해야 한다.
- 제안: JSDoc을 `/** 버튼·폼·메시지 채널 통합 상호작용 형태 공통 타입 (CONVENTIONS §4.5). 현재 ButtonInteractionService 에서만 사용하나, 여기 정의해 공유한다. */` 처럼 범위를 명시하거나, `form_submitted`/`message_received` 변형에 각각 짧은 인라인 코멘트를 추가한다.

### [INFO] `resolveButtonInteraction` JSDoc 분기 설명 (a)/(b)/(c) 중 (c) 기술 오류 가능성
- 위치: `button-interaction.service.ts` — `resolveButtonInteraction` JSDoc `@param` 블록 위 4개 분기 목록
- 상세: 분기 (a) 설명에 "(c) item-level" 을 별도 항목으로 기술했으나, 실제 구현에서 item-level 처리는 (a) port 버튼 분기 내부에 포함된다 (`buttonId.includes('__item_')` 검사와 `selectedItem` 해석). 분리된 별도 경로처럼 보이는 목록은 구현을 읽지 않은 독자에게 잘못된 이해를 줄 수 있다.
- 제안: JSDoc 분기 목록을 "(a/c) `button_click` port 버튼 — ..." 로 묶거나, "(c) item-level 은 (a)/(b) 내부에서 공통 적용" 과 같이 중첩 관계를 명시한다.

### [INFO] `buildResumedStructuredOutput` JSDoc — `cleanNodeOutput` `@param` 설명 약함
- 위치: `button-interaction.service.ts` — `buildResumedStructuredOutput` JSDoc
- 상세: `@param cleanNodeOutput` 설명이 "`prevStructured?.output` 부재 시 fallback"으로만 기술되어 있다. 실제로는 `prevStructured?.output ?? cleanNodeOutput`이 `rawPrevOutput` 의 기본값이 되며, Array 분기에서도 이 값은 무시된다. 내부 동작에 비해 설명이 과소하다.
- 제안: `@param cleanNodeOutput prevStructured?.output 부재 시 사용되는 fallback output (Array 분기에서는 무시됨).` 처럼 제한 조건을 명시한다.

### [INFO] 테스트 파일 최상단 블록 주석 — `step3` 참조가 실제 커밋 범위와 불일치 가능성
- 위치: `button-interaction.service.spec.ts` — 파일 상단 블록 주석 (lines 426–437 of context)
- 상세: 주석에 "C-1 step3 — ButtonInteractionService 단위 테스트" 라고 명시되어 있으나, 이번 변경에서는 `resolveButtonInteraction` / `buildResumedStructuredOutput` 두 모듈-레벨 순수 함수 테스트가 추가되었다. 이 함수들은 step4(FINAL) 커밋에서 추출된 것으로 보이므로, 주석이 step3 범위만 가리켜 새 테스트 describe 블록의 맥락을 커버하지 못한다.
- 제안: 상단 블록 주석에 "C-1 step4 에서 추출된 `resolveButtonInteraction` / `buildResumedStructuredOutput` 순수함수 테스트 포함" 한 줄을 추가한다.

### [INFO] `buildResumedStructuredOutput` 내부 주석 — `memory/node-specs-improvement-progress.md` 경로 참조
- 위치: `button-interaction.service.ts` — `buildResumedStructuredOutput` 함수 본문 내 인라인 주석
- 상세: 인라인 주석이 `memory/node-specs-improvement-progress.md`를 "Phase 3 precondition" 추적처로 언급한다. 이 경로가 실제 파일 시스템에 존재하는지 또는 리네임·이동 가능성이 있는지 확인 필요. 외부 파일 참조가 부패(stale reference)되면 독자가 관련 컨텍스트를 찾지 못한다.
- 제안: 해당 파일 경로가 현재 저장소 레이아웃에서 유효한지 확인하고, 유효하지 않으면 현행 spec 경로로 교정한다. 현행이라면 그대로 유지.

### [INFO] spec `CONVENTIONS §4.2` / `§4.4` / `§4.5` 참조 — 해당 spec 파일 경로 미명시
- 위치: `button-interaction.service.ts` — 여러 인라인 주석 및 JSDoc
- 상세: 코드 내에서 `CONVENTIONS §4.2`, `§4.4`, `§4.5` 를 여러 곳에서 참조하나, 어떤 파일의 섹션인지 경로를 명시하지 않는다. `spec/conventions/` 하위 어느 파일인지 독자가 알아야 한다.
- 제안: 첫 등장 위치에 `(spec/conventions/<파일명>.md §4.x)` 형태로 전체 경로를 한 번이라도 명시해 독자가 원문을 쉽게 찾도록 한다.

## 요약

이번 변경은 `resolveButtonInteraction` 과 `buildResumedStructuredOutput` 두 순수함수를 공개 API 로 추출하고 JSDoc 을 상세히 작성하여 전반적으로 문서화 수준이 높다. 공개 타입·인터페이스·함수 모두 `@param` 블록과 설계 의도 설명이 포함되어 있으며, 테스트 파일에도 분기별 의도를 설명하는 블록 주석과 인라인 코멘트가 충분하다. 발견된 항목은 모두 INFO 등급으로, JSDoc의 일부 부정확한 분기 기술, 테스트 파일 상단 주석의 step 범위 불일치, spec 파일 경로 미명시 등 명확성 보완 수준이다. 기능 동작이나 유지보수에 즉각적인 위험을 주는 문서 누락은 없다.

## 위험도

NONE
