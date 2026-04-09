### 발견사항

---

**[WARNING] PRD ND-CL-10: `source` 표현식 resolve가 핸들러에서 수행되지 않음**
- 위치: `carousel.handler.ts` - dynamic mode `execute()`
- 상세: PRD ND-CL-10에서 "실행 엔진이 표현식을 resolve하여 배열 데이터를 전달"한다고 명시하지만, 핸들러 내부에서 `config.source`를 직접 읽고 있음 (`const sourceData = config.source`). 표현식 resolve가 이미 핸들러 호출 전에 완료되어 `config.source`가 이미 평가된 배열이라면 문제없으나, validate에서 `source` 필드를 `'{{ $input }}'` 형태의 raw 문자열로 테스트하는 것과 일관성이 없음.
- 제안: 표현식 resolve 책임 소재를 명확히 문서화하거나, validate 테스트에서도 resolve된 배열을 넘기는 형태로 검증 추가

---

**[WARNING] PRD ND-CL-08: Dynamic 모드 아이템별 버튼 클릭 후 `selectedItem`이 다운스트림에 실제로 전달되는지 E2E 검증 없음**
- 위치: `execution-engine.service.ts` - `handleClick()` 개선 부분
- 상세: PRD ND-CL-09에서 "아이템 버튼 클릭 시 `selectedItem`에 해당 아이템 데이터 포함하여 다운스트림 전달"을 요구함. `interactionData`에 `selectedItem`이 추가되었지만, 이 `interactionData`가 실제로 다운스트림 노드의 input으로 어떻게 전달되는지에 대한 테스트가 없음. `_selectedPort`는 stripped되지만 `selectedItem`은 input에 포함되어야 함.
- 제안: 아이템 버튼 클릭 → 다운스트림 input에 `selectedItem` 포함 여부를 검증하는 integration 테스트 추가

---

**[WARNING] PRD EH-LIST-03: `waiting_for_input` 필터 버튼 누락**
- 위치: `executions/page.tsx` - `FILTER_BUTTONS` 배열
- 상세: PRD EH-LIST-03에서 "Waiting for Input" 상태 필터를 명시적으로 요구하고 있으나, RESOLUTION.md에서 "Warning #6 조치 완료"로 기록되어 있는데 실제 `page.tsx` diff를 보면 `FILTER_BUTTONS`에 해당 항목이 추가되었는지 확인이 필요함. `execution-list-page.test.tsx`의 filter buttons 테스트에서도 `Waiting` 버튼에 대한 assertion이 없음.
- 제안: `execution-list-page.test.tsx`에 `expect(screen.getByRole("button", { name: "Waiting" })).toBeDefined()` 추가

---

**[WARNING] PRD EH-DETAIL-07: 선택된 버튼 하이라이트 요구사항 미구현**
- 위치: `presentation-renderers.tsx` (diff 미포함)
- 상세: PRD EH-DETAIL-07에서 "버튼이 있는 노드는 모든 버튼 표시 + 선택된 버튼 하이라이트"를 요구함. `buttonConfig`를 `cleanNodeOutput`에 유지하기로 변경(`delete cleanNodeOutput.buttonConfig` 제거)하여 버튼 표시는 가능해졌으나, 클릭된 버튼(`interactionData.buttonId`)을 하이라이트하는 UI 구현 여부를 확인할 수 없음.
- 제안: Preview 탭에서 `interactionData.buttonId`와 일치하는 버튼에 선택 표시를 렌더링하는 로직 확인 및 테스트 추가

---

**[INFO] PRD EH-DETAIL-09: 이전/다음 실행 이동 — 100건 초과 시 기능 부재를 PRD에서 "권장" 등급으로 하향**
- 위치: `prd/7-execution-history.md` - EH-DETAIL-09
- 상세: RESOLUTION.md에서 "백엔드 adjacent 엔드포인트 추가가 필요하여 현재 스코프 외"로 처리했으나, `currentIndex === -1` 가드는 추가됨. 단, 실행 내역이 100건을 초과하면 인접 탐색 자체가 불가능하다는 제약사항이 PRD나 UI에 명시되어 있지 않음.
- 제안: UI에 "최대 100건 이내에서만 이전/다음 탐색 가능" 안내 또는 PRD에 현재 제약 명시

---

**[INFO] `carousel-buttons.handler.spec.ts` validate 테스트에 `source` 추가 시 backward compatibility 테스트 불일치**
- 위치: `carousel.handler.spec.ts` L34
- 상세: "should pass without source in dynamic mode (backward compatible)" 테스트를 신규 추가하면서, 기존 `carousel-buttons.handler.spec.ts`의 validate 테스트에는 `source` 필드를 추가함. 두 파일 간 backward compatibility에 대한 접근이 일관되지 않음. `carousel-buttons.handler.spec.ts`에도 source 없는 backward compat 케이스 추가 필요.
- 제안: `carousel-buttons.handler.spec.ts`에 source 없는 valid 케이스 테스트 추가

---

**[INFO] Dynamic mode itemButtons: 런타임에 버튼 ID `{defId}__item_{idx}` 생성 시 최대 4개 제한 검증 누락**
- 위치: `carousel.handler.ts` - `validateItemButtons()` vs dynamic mode execute
- 상세: `validateItemButtons`에서 "maximum 4 buttons per item" 검증을 수행하지만, 이는 config 시점에만 동작함. Dynamic 모드에서 `itemButtons`가 4개 이하임을 config에서 검증하는데, 런타임에 아이템 수가 많아져도 개별 아이템당 4개는 유지되므로 문제없음. 그러나 `allButtons` 배열에 global + 모든 아이템 버튼이 합산되는 구조에서 전체 버튼 수 상한선이 없어, 아이템이 많으면 `buttonConfig.buttons` 배열이 무한 증가할 수 있음.
- 제안: 전체 `allButtons` 수에 대한 상한선 검토 또는 문서화

---

### 요약

핵심 요구사항(ND-CL-06~10, EH-LIST, EH-DETAIL)은 대체로 구현되어 있으며, `_selectedPort` 스트리핑, `selectedItem` 다운스트림 전달, `buttonConfig` 보존 등 중요한 비즈니스 로직이 올바르게 반영되었다. 다만 PRD ND-CL-10의 `source` 표현식 resolve 책임 소재가 불명확하고, EH-DETAIL-07의 선택된 버튼 하이라이트 요구사항의 UI 구현 여부가 diff에서 확인되지 않으며, `waiting_for_input` 필터 버튼 조치가 테스트 레벨에서 검증되지 않은 점이 주요 미비점이다.

### 위험도
**MEDIUM**