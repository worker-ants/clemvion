# Code Review 통합 보고서

> 세션: `review/code/2026/05/16/01_50_28`
> 대상: Template 노드 글로벌 버튼 바 미표시 버그 수정 (template-buttons-fix-362d73)
> 리뷰어: 13개 전원 완료 (pending 0, fatal 0)

---

## 전체 위험도

**MEDIUM** — 핵심 버그 수정 자체는 올바르나, link 버튼 URL 유효성 검증 누락(잠재적 XSS 경로)과 `waiting_for_input` 상태 조건 미적용, plan 문서 미갱신이 복합적으로 지적되었다.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / 요구사항 | **link 버튼 URL에 `isHttpUrl()` 검증 누락** — `btn.url`이 프로토콜 검증 없이 `onLinkButtonClick` 콜백으로 전달됨. 핸들러 구현이 `window.open` / `<a href>` 방식이면 `javascript:` 스킴을 통한 XSS 가능 | `presentation-renderers.tsx` — 버튼 onClick 핸들러 (`btn.type === "link"` 분기) | 클릭 시 `isHttpUrl(btn.url)` 검증 통과한 URL만 `onLinkButtonClick`으로 전달. CarouselContent 아이템별 버튼도 동일 패턴 적용 |
| 2 | 요구사항 | **`waiting_for_input` 상태 조건 명시 부재** — spec §6.5는 `waiting_for_input` 상태에서만 버튼 바 표시를 명시하나, 구현은 `buttons.length > 0`이면 항상 렌더링 | `presentation-renderers.tsx` — 버튼 바 렌더링 조건 | 상태 기반 조건 추가 또는 설계 결정을 spec·주석에 명시 |
| 3 | 요구사항 | **legacy flat shape에서 `previewHeader`가 outputFormat 미반영** — `isStructured === false`이면 `envelopeConfig`가 `undefined`이므로 항상 `"Preview (text)"`로 고정 | `presentation-renderers.tsx` — `previewHeader` 계산부 | legacy path에서도 `rawInput.outputFormat`을 fallback으로 읽는 헬퍼 추가 |
| 4 | 요구사항 | **`PresentationContent`에서 배열 타입 `unwrapped` 처리 부재** — `Array.isArray` 체크 없어 배열 입력 시 `data.rendered`, `data.buttonConfig` 등이 `undefined`가 되어 빈 화면 렌더링 | `presentation-renderers.tsx` — `const raw = unwrapped` 이후 | `Array.isArray(raw)` 케이스에도 `JsonContent` fallback 가드 추가 |
| 5 | 유지보수성 | **`PresentationContent` 함수 복합 책임 / 과도한 길이** — payload 파싱, 인터랙션 언래핑, 노드 라우팅, 버튼 필터링, previewHeader 결정, JSX 렌더링을 단일 함수(~170줄)가 담당 | `presentation-renderers.tsx` — `PresentationContent` 함수 전체 | `unwrapPayload`, `extractButtons`, `resolvePreviewHeader` 등 보조 함수로 분리 |
| 6 | 유지보수성 | **테스트 블록 시나리오 중복** — Carousel/Template describe 블록이 nodeType만 다르고 구조가 동일한 3~4개 케이스를 각각 구현. 신규 노드 추가 시 중복 재발 | `presentation-renderers.test.tsx` — Carousel vs Template describe 블록 | 공통 버튼 시나리오를 `runButtonSuiteFor(nodeType, payloadBuilder)` 형태로 파라미터화 |
| 7 | 테스트 | **`previewOnly=true` 상태 Template 조합 미검증** — previewOnly 시 헤더 미표시 + 버튼 바 노출 여부 테스트 없음 | `presentation-renderers.test.tsx` — `describe("Template global buttons")` | `previewOnly=true` prop 전달 케이스 추가 |
| 8 | 테스트 | **`buttonItemMap` 필터링 Template 경로 미검증** — item-level 버튼이 글로벌 버튼 바에서 제외되는 로직의 Template 케이스 부재 | `presentation-renderers.tsx` — `buttons` 계산 (`buttonItemMap` 분기) | `buttonItemMap: { "item-btn": 0 }` 형태 입력으로 item-level 버튼 미표시 검증 케이스 추가 |
| 9 | 문서화 | **plan 문서 체크박스 미갱신** — 구현 완료 상태로 PR 리뷰 중이나 모든 항목이 `[ ]`. CLAUDE.md 규약 위반 | `plan/in-progress/template-preview-buttons-fix.md` — 라인 39–44 | 완료된 항목을 `[x]`로 표시; 미완료 항목만 `[ ]` 유지 |

---

## 참고 (INFO) — 18건

요약: I1 `style` 속성 허용, I2 `JsonContent` 민감 데이터 노출, I3 `previewHeader` switch 분기 산재, I4 legacy fallback 제거 시점 미명시, I5 `TemplateContent` null 반환 계약 암묵적, I6 `content === ""` 빈 문자열 처리, I7 link 버튼 `url` 누락 fallback, I8 `id`/`label` 누락 React key 경고, I9 `TemplateContent` 래퍼 div 중복, I10 `btnConfig` 이중 캐스팅, I11 매직 클래스명 분산, I12 핸들러 미전달 케이스 미검증, I13 `nodeType: "template"` 명시 누락, I14 `getByText().toBeDefined()` 패턴, I15 책임 변경 주석 부재, I16 spec 참조 누락, I17 `markdownToHtml` 미지원 문법 주석, I18 `sanitizeHtml` 메모이제이션 부재.

상세 항목은 각 `<role>/review.md` 참조.

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | link 버튼 URL 미검증(잠재 XSS), style 속성 허용 |
| performance | LOW | sanitizeHtml 메모이제이션 부재, markdownToHtml 정규식 체인 |
| architecture | LOW | previewHeader nodeType 이중 체크, legacy fallback 기술 부채 |
| requirement | MEDIUM | link URL 검증 누락, waiting_for_input 조건 부재, legacy flat previewHeader 오류, 배열 타입 처리 부재 |
| scope | NONE | 변경 범위 plan과 정확히 일치, 무관 수정 없음 |
| side_effect | LOW | TemplateContent fallback 동작 변경(의도됨), previewHeader nodeType 재체크 확장성 |
| maintainability | LOW | PresentationContent 복합 책임, 테스트 블록 중복 |
| testing | LOW | previewOnly+버튼 조합 미검증, buttonItemMap Template 경로 미검증, 핸들러 미전달 케이스 미검증 |
| documentation | LOW | plan 체크박스 미갱신, TemplateContent 책임 변경 주석 부재 |
| dependency | NONE | 신규 패키지 없음, 기존 devDependencies 심볼 추가 활용만 |
| database | NONE | 데이터베이스 관련 코드 없음 |
| concurrency | NONE | 동시성 요소 없음 |
| api_contract | NONE | 클라이언트 전용 리팩터링, API 계약 변경 없음 |

---

## 권장 조치사항

1. **[즉시] link 버튼 URL에 `isHttpUrl()` 검증 추가** — `onLinkButtonClick` 호출 전 `isHttpUrl(btn.url)` 검사.
2. **[즉시] plan 문서 체크박스 갱신** — 완료 항목을 `[x]`로.
3. **[단기] `waiting_for_input` 상태 조건 처리 명문화**.
4. **[단기] 누락 테스트 케이스 추가** — previewOnly+버튼, buttonItemMap 필터링, 핸들러 미전달.
5. **[단기] legacy flat shape에서 `previewHeader` outputFormat 반영**.
6. **[중기] `previewHeader` 계산을 switch 케이스 내부로 이동**.
7. **[중기] 테스트 블록 중복 해소**.
8. **[중기] `TemplateContent` 책임 변경 주석 추가**.
9. **[저우선] `style` 속성 허용 범위 검토**.
10. **[저우선] `sanitizeHtml` 메모이제이션 적용**.

본 SUMMARY 의 해소 결과는 동일 디렉토리의 `RESOLUTION.md` 참조.
