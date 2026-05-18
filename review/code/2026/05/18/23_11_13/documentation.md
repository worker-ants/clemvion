# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 인라인 주석이 `ui.required` / `requiredWhen` 추가의 이유를 일관되게 설명하고 있으나, 주석 수준이 파일마다 미묘하게 다름
  - 위치: 여러 schema 파일 — `http-request.schema.ts`, `if-else.schema.ts`, `form.schema.ts`
  - 상세: `http-request.schema.ts` 의 `url` 필드 주석은 `.optional()` 유지 이유와 SSOT 참조(`node-component.interface.ts:222-226`)까지 풀어서 설명한다. 반면 `database-query.schema.ts`, `foreach.schema.ts`, `map.schema.ts`, `split.schema.ts`, `variable-declaration.schema.ts`, `variable-modification.schema.ts` 의 동일한 패턴 추가는 한 줄(`// warningRule X 와 정렬.`) 으로만 기술된다. 같은 설계 의도이므로 어느 수준을 표준으로 삼을지가 불명확하다.
  - 제안: 짧은 주석으로 통일하거나, `.optional()` 유지 이유가 처음 등장하는 `http-request.schema.ts` 처럼 전체 설명을 한 곳에 두고 나머지는 짧은 주석으로 통일하는 방향 중 하나를 선택한다. 현재처럼 혼용되면 향후 기여자가 상세 주석이 있는 파일을 참고 패턴으로 삼아야 한다는 것을 알기 어렵다.

- **[INFO]** `logic-ui-required.spec.ts` 의 파일 수준 JSDoc 이 자체 목적은 잘 설명하지만, `uiMeta` 헬퍼 함수에 독스트링이 없음
  - 위치: `codebase/backend/src/nodes/logic/logic-ui-required.spec.ts` — `function uiMeta`
  - 상세: 파일 최상단 블록 주석에서 배경과 목적을 충분히 설명하고 있다. 그러나 `uiMeta` 헬퍼는 `z.toJSONSchema` 호출, `unknown` 캐스팅, optional chaining 조합으로 타입이 불투명하다. 테스트 파일이지만 동일 패턴이 per-node spec 파일(`database-query`, `http-request`, `send-email`, `form`)에도 반복 인라인 구현되어 있고, 이 파일은 그것을 공통 헬퍼로 추출한 유일한 파일이다.
  - 제안: 헬퍼가 무엇을 반환하고 `schema as ZodObject` 캐스팅이 왜 필요한지 한 줄 주석 추가. 또한 per-node spec 파일들이 동일 패턴을 인라인 반복하고 있어, 중앙화 의도가 있는지(`logic-ui-required.spec.ts`), 아니면 각 노드 spec에도 동일 헬퍼를 복사-유지할 것인지 명확히 하는 짧은 주석이 도움이 된다.

- **[INFO]** `sendEmailNodeConfigSchema` 의 `subject` / `body` 필드에 `.default('')` 를 쓰는 이유 주석이 분리되어 있음
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` — `.default('')` 설명 주석 (라인 1471)
  - 상세: 주석 `// .default(''): LLM 이 optional 로 오인해 인자 생략하는 것을 차단 (review I-4)` 가 `cc` 필드 직전에만 있고, `subject`·`body` 두 필드 위쪽에는 없다. 변경 diff 에서 `subject`·`body` 에 `required: true` 메타가 추가됐는데, 이 메타와 `.default('')` 의 조합이 만들어내는 의미(`required` 표시가 뜨지만 schema 는 빈 문자열을 허용해 handler 단에서 런타임-required 체크)가 두 필드에 동일하게 적용되나 주석이 맥락 없이 `cc` 위에만 있다. 독자 입장에서 `subject`·`body` 의 새 `required: true` 가 `cc` 위 주석의 설명과 연결된다는 것을 파악하기 어렵다.
  - 제안: `subject`·`body` 블록 또는 그 `meta` 주석 안에 "`.default('')` 로 zod optional 이 아님에도 빈값 허용 — handler 단의 런타임-required 체크와 쌍을 이룸" 을 한 줄 추가한다.

- **[INFO]** `node-config-required-defaults-sweep.md` plan 문서의 "관련 문서" 섹션이 `node-component.interface.ts:222-236` 을 가리키지만 diff 상에서 해당 파일은 변경되지 않음
  - 위치: `plan/in-progress/node-config-required-defaults-sweep.md` — "관련 문서" 섹션
  - 상세: plan 자체가 "이 sweep 은 interface 파일을 건드리지 않는다" 라는 전제 하에 설계됐으므로 자연스럽다. 하지만 `node-component.interface.ts:222-236` 이 `ui.required` / `requiredWhen` 의 타입 정의 위치라면, 해당 타입에 `requiredWhen.notEquals` 가 이번에 추가됐는지 아닌지 plan 문서가 언급하지 않는다. `switch.schema.ts` 에서 `{ field: 'mode', notEquals: 'expression' }` 가 새롭게 등장하는데, 이 키가 기존 타입 정의에 포함돼 있는지 plan 문서에서 확인이 안 된다.
  - 제안: plan 문서의 "관련 문서" 또는 "방침" 섹션에 `requiredWhen.notEquals` 가 기존 interface 에 이미 정의된 것임을 한 줄 명시한다. 새로 추가된 키라면 해당 interface 파일도 sweep 범위에 포함됐어야 하므로 별도 확인이 필요하다.

- **[INFO]** `presentation-button-render-investigation.md` plan 문서 내 "관련 파일 색인" 의 라인 번호 참조가 향후 코드 변경 시 낡아질 위험
  - 위치: `plan/in-progress/presentation-button-render-investigation.md` — "관련 파일 색인"
  - 상세: 해당 문서는 분석 메모 성격이고 in-progress 상태이므로 라인 번호가 빠르게 무효화되는 것은 어느 정도 수용된다. 그러나 본 sweep PR 에서 form/foreach 등 schema 파일들이 변경됐고, 향후 carousel/table schema 도 변경 가능성이 있다. 라인 번호가 3~5개 파일에 걸쳐 명시됐다.
  - 제안: 라인 번호 대신 함수명·export 명이나 섹션 제목을 식별자로 사용한다. 또는 완료 시점(fix worktree merge 후) plan 을 complete 로 이동하기 전에 라인 번호 정확성을 재검증한다는 메모를 추가한다.

- **[INFO]** README 업데이트 필요성 없음 — 이번 변경은 내부 schema 메타데이터 추가이며, 외부 API 또는 사용자-facing 설정에는 변경 없음
  - 위치: 전체 변경 범위
  - 상세: `ui.required` / `requiredWhen` 는 frontend 설정 패널의 시각적 asterisk 표시에만 영향을 주며, 노드의 동작·API 엔드포인트·환경변수·외부 설정 인터페이스는 변경 없다. README / API 문서 / CHANGELOG 추가 필요 없음.

- **[INFO]** `form.schema.ts` 의 `formFieldSchema.required` 필드와 `formNodeConfigSchema.fields` 의 `ui.required: true` 가 이름이 동일해 혼동 가능
  - 위치: `codebase/backend/src/nodes/presentation/form/form.schema.ts` — `formFieldSchema.required` vs `formNodeConfigSchema.fields.ui.required`
  - 상세: plan 문서 자체에 "form.fields[i].required 는 의미가 다른 layer" 라는 경고 주석이 있고 sweep 대상 아님을 명시했다. 그러나 schema 파일 안에서 두 `required` 의 다른 의미를 독자에게 안내하는 주석은 없다. 코드를 처음 보는 기여자가 `formFieldSchema` 의 `.required` 필드와 `formNodeConfigSchema.fields.meta.ui.required` 를 혼동할 수 있다.
  - 제안: `formNodeConfigSchema` 의 `fields` 필드 meta 주석에 "이 `required` 는 UI 패널 asterisk 용 메타데이터 — 폼 사용자에게 입력을 강제하는 `formFieldSchema.required` 체크박스와 무관" 을 한 줄 추가한다.

## 요약

이번 변경은 19개 backend schema 파일에 `ui.required` / `ui.requiredWhen` 메타데이터를 추가하고, 이를 검증하는 잠금 테스트를 신규·기존 spec 파일에 삽입한 작업이다. 문서화 관점에서 전반적으로 양호하다: warningRule SSOT 와의 정렬을 명시하는 인라인 주석이 각 추가 지점에 일관되게 달려 있고, plan 문서 2종이 배경·방침·적용 범위를 충실히 기술하며, `logic-ui-required.spec.ts` 에는 목적과 배경을 설명하는 파일 수준 JSDoc 이 갖춰져 있다. 개선 여지는 모두 INFO 수준으로, 주석 상세도의 일관성 부재(http-request 의 상세 주석 vs 나머지의 한 줄 주석), `subject`/`body` 필드의 `.default('')` + `required: true` 조합 설명 분리, `form.fields[i].required` 와 `ui.required` 동명 혼동 가능성, `requiredWhen.notEquals` 키의 interface 정의 소재 미확인 정도이다. API 문서·README·CHANGELOG 업데이트가 필요한 외부 인터페이스 변경은 없다.

## 위험도

LOW
