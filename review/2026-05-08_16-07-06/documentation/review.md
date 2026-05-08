## 발견사항

### [WARNING] `plan/complete/` 이동이 CLAUDE.md 분류 규칙 위반
- **위치**: `plan/complete/ai-agent-tool-connection-rewrite.md`
- **상세**: CLAUDE.md 규칙 — "미체크 체크박스(`[ ]`), '남은 작업' ... 미해결 follow-up 항목이 하나라도 있으면 `in-progress/` 다." 해당 문서는 "남은 작업" 섹션에 8개의 미완 항목(재작성 작업 항목, ai-review 백로그, 미해결 설계 질문)을 포함한다. Deprecated 처리와 `complete/` 이동이 동시에 이루어졌으나, 규칙은 항목의 유효성이 아닌 **존재 여부**로 분류를 결정한다.
- **제안**: (a) "남은 작업" 섹션을 "~~남은 작업 (DEPRECATED — 재설계로 폐기됨)~~" 으로 이름을 바꾸고 항목들을 strikethrough(`~~...~~`)로 처리하거나, (b) 섹션 전체를 제거하고 역사 기록 목적의 내용만 남겨 분류 조건을 해소한다.

---

### [WARNING] `loop.handler.ts` — `parseNumeric` 사이드이펙트 주석이 사실과 불일치
- **위치**: `loop.handler.ts:58-60`
- **상세**: 주석이 "`parseNumeric` is still invoked for its side-effect of validating the resolved values"라고 기술하나, `parseNumeric`은 순수 함수(pure function)로 사이드이펙트가 없다. 반환값을 `void`로 버리므로 실제로는 **아무 효과가 없는 코드**다. 향후 개발자가 이 `void` 호출이 중요한 동작을 한다고 오해할 수 있다.
- **제안**: 주석을 "Discard resolved values — validation runs in validate(); these calls are retained only to signal the engine reads `node.config` directly, not `outputData.config`."로 수정하거나, 불필요한 `void parseNumeric(count)` 호출 자체를 제거한다.

---

### [WARNING] `table.handler.ts` — output에 `columns` 추가가 breaking change임을 명시하지 않음
- **위치**: `table.handler.ts` diff, `payload` 객체에 `columns: resolvedColumns` 추가
- **상세**: 이전에는 `resolvedColumns`가 `config`에만 있었는데, 이 변경으로 `output.columns`도 추가된다. 인라인 주석("Surface resolved (label-evaluated) columns on output for downstream nodes")이 의도를 설명하지만, 기존에 `config.columns`를 참조하던 다운스트림 노드가 이제 두 군데에서 동일 데이터를 볼 수 있다는 점 — 및 `config.columns`는 raw 템플릿을, `output.columns`는 evaluated 값을 담는다는 orthogonality — 을 명확히 하지 않는다.
- **제안**: 주석을 "output.columns: resolved (evaluated) labels — downstream nodes should read from here. config.columns retains the raw template per Principle 7."로 보완한다.

---

### [INFO] `chart.handler.ts` — `void chartType; void title;` 의도 미문서화
- **위치**: `chart.handler.ts:84-85`
- **상세**: 두 `void` 문이 변수 미사용 린트 경고를 억제하기 위한 것임이 코드에서 추론 가능하지만 주석이 없어 첫인상에 의도 불명이다.
- **제안**: `// suppress unused-variable lint — now sourced from rawConfig` 한 줄 추가.

---

### [INFO] `parallel.handler.ts` — `context?: ExecutionContext` 선택적 파라미터 문서화 부재
- **위치**: `parallel.handler.ts:32`
- **상세**: 다른 모든 핸들러는 `context: ExecutionContext`(필수)로 변경했으나 `parallel`만 `context?: ExecutionContext`(선택)으로 유지됐다. 인터페이스 계약과의 불일치 이유가 주석에 없다.
- **제안**: `// context is optional — parallel.handler.spec.ts calls execute() without context in legacy fixtures` 등 이유를 명시한다.

---

### [INFO] `ai-agent.handler.ts` — "Phase 1" 참조에 링크 없음
- **위치**: `ai-agent.handler.ts` 두 번째 rawConfig 주석 — "see Phase 1"
- **상세**: "multi-turn resume snapshots `state.rawConfig` separately, see Phase 1"과 "Engine snapshots `state.rawConfig` (frozen) at the first turn (Phase 1)"이라는 언급이 있으나, Phase 1이 어느 plan/spec 문서를 가리키는지 기술되지 않아 추적성이 낮다.
- **제안**: "see Phase 1 (`plan/complete/node-output-raw-config-echo.md` or equivalent)" 식으로 구체적 경로를 추가한다.

---

### [INFO] `prd/3-node-system.md`, `prd/6-phase2-ai.md`, `spec/3-workflow-editor/0-canvas.md`, `spec/4-nodes/3-ai-nodes.md` — 링크 갱신 일관성 양호
- **위치**: 4개 문서의 링크 `plan/in-progress/` → `plan/complete/` 변경
- **상세**: 모두 정확히 갱신됐으며 누락 없음. 별도 조치 불필요.

---

## 요약

이번 변경은 CONVENTIONS Principle 7 준수를 위해 36개 이상의 핸들러에 `rawConfig` echo 패턴을 일관되게 적용했으며, 인라인 주석 품질도 전반적으로 준수하다. 그러나 `loop.handler.ts`의 `parseNumeric` 사이드이펙트 주석은 순수 함수에 대한 잘못된 기술로 향후 혼란을 유발할 수 있고, `plan/complete/ai-agent-tool-connection-rewrite.md`는 CLAUDE.md의 분류 규칙("남은 작업 섹션 존재 시 in-progress")을 기계적으로 위반한다 — deprecated 의도는 이해되지만 규칙 준수를 위해 섹션 정리가 필요하다. `table.handler.ts`의 `output.columns` 추가는 raw/evaluated 분리를 명확히 설명하는 추가 주석이 없으면 다운스트림 노드 개발자에게 혼란을 줄 수 있다.

## 위험도

**LOW**