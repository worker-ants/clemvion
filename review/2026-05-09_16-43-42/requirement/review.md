## 요구사항 코드 리뷰 — Requirement 관점 분석

---

### 발견사항

- **[WARNING]** `rendered` HTML이 cap 이전의 전체 items/rows로 생성됨
  - 위치: `carousel.handler.ts` (`renderHtml` 호출 → `truncateArrayForOutput` 적용 순서), `table.handler.ts` (`renderHtml` 동일)
  - 상세: `spec/4-nodes/6-presentation/0-common.md`는 "`rendered` HTML은 cap 대상이 아니다 — items/rows가 잘리면 자동으로 함께 작아진다"고 기술하지만, 구현상 `rendered`는 cap 적용 전 전체 배열로 생성된다. 6개 × 200KB 아이템 시나리오에서 `output.items`는 ~1MB로 잘리지만 `output.rendered`는 원본 ~1.2MB 크기 HTML로 유지되어 JSONB row가 ~2.2MB에 달할 수 있다. 스펙의 "자동으로 함께 작아진다"는 근거가 사실과 다르다.
  - 제안: `renderHtml`을 `cappedItems.value`로 호출하도록 순서를 바꾸거나, 스펙에서 "rendered는 전체 items를 사용해 렌더링되므로 cap 이후에도 더 클 수 있다"는 정확한 사실로 수정한다.

- **[WARNING]** `buildMultiTurnConfigEcho`에서 빈 `conditions` 배열이 에코되지 않음
  - 위치: `ai-agent.handler.ts` `buildMultiTurnConfigEcho` 내 `raw.conditions` 분기
  - 상세: `conditions` 필드만 유일하게 `Array.isArray(raw.conditions) && (raw.conditions as unknown[]).length > 0` 조건으로 비어있는 경우를 필터링한다. 사용자가 명시적으로 `conditions: []`를 설정해도 에코에서 누락된다. 다른 배열 필드(`knowledgeBases`)는 길이 체크 없이 `undefined` 여부만 확인한다. 동작 불일치다.
  - 제안: `knowledgeBases`와 동일하게 `if (raw.conditions !== undefined) echo.conditions = raw.conditions;`로 단순화하거나, 의도적 설계라면 스펙에 빈 배열 제외 정책을 명시한다.

- **[WARNING]** `information-extractor.handler.ts`에서 `inputField`가 state에 저장되지 않아 rawConfig 없는 legacy state에서 완전한 fallback 불가
  - 위치: `information-extractor.handler.ts` `buildMultiTurnFinalOutput` — `inputField` 처리
  - 상세: `rawConfig` 없는 legacy state (engine이 첫 waiting tick 이전에 종료하는 엣지 케이스)에서는 `raw.inputField`가 `undefined`이고 `state.inputField`로 fallback할 필드 자체가 `MultiTurnState`에 없다. `defined()`로 필터되어 `output.config`에 `inputField`가 아예 누락된다. 다른 필드(`model`, `instructions` 등)는 state fallback이 있다.
  - 제안: `MultiTurnState`에 `inputField?: string`을 추가해 stateBase에 저장하거나, 의도적으로 legacy에서 누락 허용이라면 스펙에 명시한다.

- **[INFO]** `truncateArrayForOutput`에서 비배열 입력 시 `truncated: false` 반환이 의미론적으로 불명확
  - 위치: `truncate-body.util.ts` 비배열 early-return 경로
  - 상세: `'not an array'` 입력 시 `{ value: [], truncated: false, originalLength: 0 }` 반환. `truncated: false`는 "잘림 없음"을 의미하지만 실제로는 전체 값이 빈 배열로 교체된 상황이다. Carousel/Table 핸들러는 이미 배열로 확보한 후 호출하므로 현재 코드 경로에서는 문제없지만, 미래 재사용 시 혼동 가능성이 있다.
  - 제안: 비배열 경우를 호출자에서 사전에 방어하거나 별도의 `invalidInput: true` 플래그를 추가하는 방안 검토.

- **[INFO]** `buildMultiTurnConfigEcho` 호출 시 첫 번째 call site(line ~622)의 `rawConfig` 변수 참조 출처가 diff만으로 확인 불가
  - 위치: `ai-agent.handler.ts:622`
  - 상세: diff에서 `rawConfig,`가 추가되었으나 해당 스코프에서 `rawConfig`가 `context.rawConfig`인지, 별도로 선언된 로컬 변수인지 주변 코드 없이 검증 불가. plan 문서는 "4곳 모두 context.rawConfig 또는 state.rawConfig 전달"이라 기술하지만 spec 레벨 확인만 있고 실제 코드 확인은 diff 범위 밖이다.
  - 제안: 코드 리뷰 시 해당 함수의 전체 컨텍스트에서 `rawConfig` 선언 위치를 확인한다.

- **[INFO]** Table `totalRows` 의미 이중성 — truncation 후에도 pre-cap 값 유지
  - 위치: `table.handler.ts` payload 조립부
  - 상세: `totalRows: dataRows.length` (cap 전 전체)와 `rowsTotalCount: cappedRows.originalLength` (역시 cap 전 전체)가 동일한 값을 의미한다. `rows.length !== totalRows`만으로 잘림을 감지하는 용도로는 유용하지만, `rowsTruncated`가 없는 상태에서 `totalRows !== rows.length`가 되는 경우는 pageSize 적용과 truncation 두 가지로, 이를 구분하는 방법이 명확하지 않다.
  - 제안: 스펙 또는 doc comment에서 "pageSize 적용으로도 `rows.length < totalRows`가 될 수 있으므로 `rowsTruncated` 플래그가 명시적 구분자"임을 명확히 한다.

---

### 요약

두 follow-up 모두 의도한 기능(AI Agent multi-turn rawConfig 에코, Carousel/Table 1MB cap)을 전체적으로 구현했으며 테스트 커버리지도 각 케이스(pass-through, truncation, fallback)를 충분히 다루고 있다. 그러나 핵심적인 요구사항 Gap이 하나 있다: `rendered` HTML이 items/rows cap 이전에 생성되므로 스펙이 주장하는 "items가 잘리면 rendered도 함께 작아진다"는 동작이 실제 구현과 다르다 — 1MB cap을 적용해도 rendered HTML로 인해 총 출력이 2MB를 초과할 수 있다. 추가로 `conditions: []` 빈 배열 에코 누락, information-extractor `inputField` state fallback 부재, `truncated: false` 의미론적 모호성은 향후 기능 확장 또는 재사용 시 혼동 원인이 될 수 있다.

### 위험도

**MEDIUM** — rendered HTML 생성 순서 문제가 1MB cap의 실효성을 부분적으로 무력화할 수 있으나, 실제 대규모 트래픽이 발생하기 전까지는 즉각적인 장애로 이어지지 않는 수준이다.