## 발견사항

---

### [CRITICAL] CONVENTIONS 문서 미제공

- **위치**: 전체 (handler-output.adapter.ts, node-handler.interface.ts, carousel.handler.ts, chart.handler.ts, workflow.handler.ts 외 다수)
- **상세**: `CONVENTIONS §3.2`, `§4.3`, `§7`, `§8`, `§9.2` 등이 20회 이상 참조되지만, 해당 CONVENTIONS 문서는 diff에 포함되지 않았고 어디에 위치하는지도 불명확합니다. 코드를 읽는 개발자가 규약의 원문을 확인할 수 없습니다.
- **제안**: CONVENTIONS 문서 경로를 코드 내 주석에 명시하거나 (`spec/` 혹은 `CLAUDE.md`에 위치 기재), 또는 해당 문서가 이번 변경에 포함되어야 합니다.

---

### [CRITICAL] "Principle 1.1" 계열 참조 정의 불명확

- **위치**: carousel.handler.ts, chart.handler.ts, table.handler.ts, template.handler.ts, form.handler.ts
- **상세**: `Principle 1.1`, `Principle 1.1.4`, `Principle 4.3` 등이 주석에 등장하지만 어느 문서의 원칙인지, CONVENTIONS와 같은 문서인지 다른 문서인지 알 수 없습니다.
- **제안**: Principle의 출처를 명시 (`CONVENTIONS §1.1` 또는 `spec/node-output-conventions.md §1.1` 등) 하거나, 첫 등장 위치에 문서 경로를 anchor로 남기세요.

---

### [WARNING] "Stage N" 마이그레이션 타임라인 주석이 혼란 유발

- **위치**: handler-output.adapter.ts JSDoc, information-extractor.schema.ts 주석, spec/4-nodes/3-ai-nodes.md
- **상세**: "Post Phase-3 (node-specs-improvement plan §Stage 7)", "Stage 2 에서 구현", "Post Stage 1 of the node-specs-improvement rollout" 등 Stage 참조가 많지만, 마이그레이션 계획 문서가 어디 있는지 제시되지 않습니다. 특히 `information-extractor.schema.ts`의 주석은 `_resumeState`를 "post-Stage-2 rename"으로 설명하는데, 실제 rename은 이 PR에서 발생하고 있어 시제가 맞지 않습니다.
- **제안**: 마이그레이션 계획 문서 경로를 명시하거나, 타임라인 주석을 "이 PR에서 완료됨 / 다음 PR에서 예정됨" 형식으로 명확히 구분하세요.

---

### [WARNING] handler-output.adapter.ts JSDoc가 실제 구현을 과장 기술

- **위치**: `handler-output.adapter.ts` 상단 JSDoc (라인 1–14)
- **상세**: "legacy `{port,data}` port-selector envelope...have been removed"라고 명시하지만, 하단에 bare-object coercion 분기가 여전히 존재하며 주석("Test fixtures and a handful of one-off mock handlers still return bare objects")으로 예외를 인정하고 있습니다. JSDoc과 실제 동작 사이에 괴리가 있습니다.
- **제안**: JSDoc을 "isLegacyPortSelector 분기는 제거되었으나, bare-object coercion은 테스트 더블을 위해 유지됨"으로 정확히 기술하세요.

---

### [WARNING] 에러 코드 레지스트리 문서 없음

- **위치**: database-query.handler.ts (`DB_QUERY_FAILED`), workflow.handler.ts (`SUB_WORKFLOW_FAILED`), send-email.handler.ts (`EMAIL_SEND_FAILED`), http-request.handler.ts (`HTTP_4XX`, `HTTP_5XX`, `HTTP_TRANSPORT_FAILED`), code.handler.ts (`CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`)
- **상세**: 이번 변경으로 신규 에러 코드가 다수 도입되었지만 어디에도 공식 에러 코드 목록이 없습니다. 특히 `database-query.handler.ts`는 `QUERY_FAILED` → `DB_QUERY_FAILED`로 코드명을 변경했는데, 이는 breaking change임에도 변경 이유가 문서화되지 않았습니다.
- **제안**: `spec/` 또는 별도 문서에 에러 코드 레지스트리를 만들고 각 코드의 의미와 발생 조건을 기술하세요.

---

### [WARNING] send-email.handler.ts 주석과 코드 불일치

- **위치**: `send-email.handler.ts` (새 에러 처리 블록)
- **상세**: 주석에 "legacy `IntegrationError` code (e.g. INTEGRATION_INCOMPLETE, INTEGRATION_NOT_FOUND) is preserved in `details.integrationCode`"라고 명시하지만, 실제 `code` 결정 ternary는:
  ```typescript
  const code = err instanceof IntegrationError ? 'EMAIL_SEND_FAILED' : 'EMAIL_SEND_FAILED';
  ```
  양쪽 모두 동일한 값입니다. 이는 코드 버그이자 주석이 의도를 잘못 기술한 사례입니다.
- **제안**: ternary를 제거하거나, IntegrationError의 경우 `err.code`를 그대로 사용하는 등 의도를 코드로 명확히 표현하세요.

---

### [WARNING] workflow 노드 에러 포트 스펙 문서 누락

- **위치**: `spec/4-nodes/1-logic-nodes.md`, `workflow.schema.ts`
- **상세**: `workflow.schema.ts`에서 `error` 포트가 추가되었고 `workflow.handler.ts`에 `buildSubWorkflowError` 메서드가 JSDoc과 함께 추가되었지만, spec 문서(`1-logic-nodes.md`)에는 workflow 노드의 에러 라우팅 동작이 기술되지 않았습니다.
- **제안**: `spec/4-nodes/1-logic-nodes.md` 또는 별도 workflow 노드 스펙 파일에 에러 포트 동작(`SUB_WORKFLOW_FAILED`, 에러 발생 시 라우팅)을 문서화하세요.

---

### [WARNING] send-email 에러 포트 스펙 미기재

- **위치**: `send-email.schema.ts` (error 포트 추가), spec 관련 문서
- **상세**: `send-email.schema.ts`에 `error` 포트가 추가되었으나, 이에 대응하는 스펙 문서 변경이 diff에 없습니다. 사용자 문서(`docs/`)에도 send-email 노드의 에러 포트 관련 설명이 없습니다.
- **제안**: 관련 spec 문서에 send-email 노드의 에러 포트와 가능한 에러 코드를 추가하세요.

---

### [INFO] `_resumeState` 필드명 의도 설명이 한 곳에만 있음

- **위치**: `node-handler.interface.ts` (새 JSDoc 추가됨)
- **상세**: `_resumeState`의 설계 의도(expression resolver와 UI autocomplete에서 노출 제외)는 인터페이스 JSDoc에 잘 설명되어 있습니다. 그러나 `ai-agent.handler.ts`의 `CONVENTIONS §4.3` 주석 3곳에서는 단순히 "runtime conversation snapshot at top level"만 언급하고, 왜 `output` 밖에 두는지를 반복 설명하지 않아 산재된 맥락으로 남습니다.
- **제안**: 인터페이스 JSDoc 경로를 `// See NodeHandlerOutput._resumeState JSDoc for rationale` 형식으로 짧게 back-reference 하면 충분합니다.

---

### [INFO] 사용자 문서 변경 범위가 Information Extractor에 한정

- **위치**: `frontend/src/content/docs/02-nodes/ai.mdx`, `overview.mdx`
- **상세**: `$node["Info Extractor"].output.result.extracted.orderNumber`로 경로 변경이 반영되었습니다. 하지만 AI Agent의 `output.result.response`, Text Classifier의 `output.result.category` 등 다른 LLM 노드들도 동일한 구조 변경을 받았음에도 사용자 문서에 반영이 없습니다.
- **제안**: AI Agent, Text Classifier의 expression 예제도 새 경로로 업데이트하세요.

---

### [INFO] conversation-utils.ts 주석에 미래 시제 혼용

- **위치**: `conversation-utils.ts` (debugHistory 블록 주석)
- **상세**: "Debug trace moved from `output._turnDebugHistory` to `meta.turnDebug`" 주석은 이미 이번 PR에서 완료된 변경인데, "moved"(과거형)와 "check both"(현재형)가 혼용되어 레거시 대응 주석인지 의도적 backward-compat인지 불명확합니다.
- **제안**: "새 실행은 `meta.turnDebug`, 마이그레이션 이전 기록은 `output._turnDebugHistory`를 사용" 형식으로 명확히 구분하세요.

---

## 요약

이번 변경은 노드 출력 구조를 `{ config, output: { result/error }, meta }` 형식으로 통일하는 대규모 아키텍처 리팩터링입니다. spec 문서와 사용자 문서(MDX)가 함께 업데이트된 점은 긍정적이나, 변경 전반을 지배하는 **CONVENTIONS 문서와 Principle 문서가 코드베이스 어디에 있는지 전혀 제시되지 않아** 신규 기여자나 코드 리뷰어가 규약의 근거를 추적하기 어렵습니다. 추가로 에러 코드 레지스트리 부재, send-email 핸들러의 dead-code ternary, 사용자 문서의 LLM 노드 expression 예제 불완전 업데이트가 보완이 필요한 항목으로 식별됩니다.

## 위험도

**HIGH** — CONVENTIONS/Principle 문서 미제공은 이후 이 패턴을 따라야 하는 모든 핸들러 구현자에게 직접적인 혼란을 초래합니다.