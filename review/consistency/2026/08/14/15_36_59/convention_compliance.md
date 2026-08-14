# 정식 규약 준수 검토 — spec/5-system/ (eia-r8-cache-scope, impl-done)

검토 범위: `origin/main...HEAD` diff (`spec/1-data-model.md` · `spec/5-system/6-websocket-protocol.md` ·
`spec/5-system/14-external-interaction-api.md` · `strip-external-only-fields.ts` ·
`websocket.service.ts` · `interaction.service.ts`). 대조 규약: `spec/conventions/swagger.md` ·
`spec/conventions/error-codes.md` · `spec/conventions/spec-impl-evidence.md` ·
`spec/5-system/2-api-convention.md §5.4` · `spec/5-system/14-external-interaction-api.md` 자체 SoT 섹션.

## 발견사항

- **[WARNING] Rationale 항목 인용 제목이 실제 heading 과 어긋남**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.4 캡션 (line 519, 이번 diff가 수정한 문장) vs `## Rationale` 소제목 (line 1056, 이번 diff는 미수정)
  - 위반 규약: 문서 내부 상호 참조 정확성 (CLAUDE.md "정보 저장 위치 단일 진실"·문서 구조 규약의 전제인 "인용은 실제 대상과 일치") — 별도 conventions 파일 조항이라기보다 본 문서 자신의 SoT 정합성 요구
  - 상세: 이번 diff가 §4.4 캡션의 인용 문구를 `"ai_message.llmCalls[]` 외부 수신자 strip"` → `"`llmCalls` 외부 수신자 strip"` 으로 바꿨다(스코프가 `ai_message` 전용에서 WS 전체 emit + REST `getStatus()` 로 일반화됐으므로 자연스러운 변경 의도로 보인다). 그런데 실제 `## Rationale` 절의 heading 텍스트는 여전히 `### `ai_message.llmCalls[]` 외부 수신자 strip (strip-only 결정)` 그대로다(변경 안 됨). 즉 본문이 인용하는 제목 문자열이 실제 heading 문자열과 더 이상 일치하지 않는다 — 독자가 인용된 문구를 검색해 heading 을 찾으면 실패한다. `strip-external-only-fields.ts` 새 JSDoc 의 SoT 코멘트도 이미 `llmCalls[]` (ai_message 접두 없이) 로 일반화해 부르고 있어, heading 쪽이 리네임을 놓친 쪽으로 보인다.
  - 제안: `## Rationale` heading 을 `### \`llmCalls\` 외부 수신자 strip (strip-only 결정)` 으로 함께 리네임하거나, §4.4 캡션의 인용 문구를 heading 원문 그대로(`ai_message.llmCalls[]`) 유지한다. 둘 중 하나로 통일.

- **[INFO] `spec/1-data-model.md` 의 신규 `details?` 필드가 자신이 인용하는 "원본" 행과 형태가 어긋나고, 근거 인용도 없음**
  - target 위치: `spec/1-data-model.md` §"Execution.error ↔ NodeExecution.error 관계" 표, "구조" 행 (line 562, 이번 diff 추가)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.4` ("키 생략은 (a)/(b) 중 하나에 해당할 때만 쓰고, 그 필드를 문서화하는 절에 사유를 명시") 의 취지 — `nodeId`/`code` 의 `null` 사유는 인라인으로 명시했으나, 같은 행에 새로 추가된 `details?` (키 생략) 는 아무 사유·출처가 없다
  - 상세: 같은 표의 바로 위 행("원본 | NodeExecution.error")이 가리키는 §2.13 NodeExecution.error 컬럼 정의(line 552)는 `{ code, message, stack? }` 뿐이고 `details` 가 없다. 그런데 "복사"(Execution.error, line 562)에는 `details?: {...}` 가 새로 붙었다 — 복사 대상이 원본에 없는 필드를 갖는 모양이 된다. 실제 코드(`execution-engine.service.ts`/`retry-turn.service.ts`/`ai-turn-orchestrator.service.ts` 의 모든 `.error = {...}` 대입 지점, 워크트리에서 직접 확인)에도 `Execution.error`/`NodeExecution.error` 어디에도 `nodeId`/`details` 를 채우는 지점이 없다 — 두 필드 모두 현재는 `{message}` 또는 `{message, code?}` 뿐이다. 단, `nodeId`/`code` 는 인라인 사유가 있고, EIA §6.2 필드 집합 표(사전 존재, line 570)가 이미 이 전체 shape(`{code, message, nodeId, details?}`)을 "목표(Planned)" 로 명시해 뒀으므로 완전히 근거 없는 것은 아니다. 다만 `spec/1-data-model.md` 자체에는 그 "목표/일부 string" 캐비어트가 인용돼 있지 않고, `details` 만 유독 무설명이다.
  - 제안: `details?` 옆에 `nodeId`/`code` 와 동일한 수준의 사유(출처: 어느 노드 error 의 `details` 를 복사하는지, 또는 EIA §6.2 필드 집합 표의 "목표" 캐비어트 링크)를 인라인으로 붙인다. 근거 링크가 마땅치 않으면 spec-impl-evidence 관점에서 "Planned" 표기를 병기하는 편이 §5.4 취지에 더 맞는다.

- **[INFO] "Planned" 표기 순서가 본 문서 기존 관용구와 다름**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2, line 662("Planned (미구현)")·line 687("`interaction` 블록은 Planned 다")
  - 위반 규약: 명명 규약이라기보다 본 문서 자체가 이미 확립한 표기 관용 (line 572, 573 필드 집합 표의 `**미구현 (Planned)**`)
  - 상세: 같은 파일의 필드 집합 표는 일관되게 `미구현 (Planned)` 순서를 쓰는데, 이번 diff가 추가한 두 곳은 `Planned (미구현)` 으로 순서가 뒤집혀 있다(§6.3 근처 line 728 의 기존 문구 `**Planned** 다` 와는 또 다른 제3의 변형). 기능상 문제는 없으나 같은 문서 안에서 3가지 표기가 혼재하게 된다.
  - 제안: 신규 두 곳을 `미구현 (Planned)` 으로 통일하거나, 아니면 향후 전역 정리 시 한 형태로 수렴.

## 준수 확인 (참고 — 위반 아님)

- 절대 URL·`/v1/` 버전 세그먼트(`https://api.clemvion.ai/v1/...`) 를 상대경로(`/api/external/...`)로 교체한 것은 `2-api-convention.md §1`("버전은 URL 경로에 포함하지 않음") 위반을 스스로 지적·수정한 개선.
- `error.code`/`nodeId` 를 `null` 로 표현하고 인라인 사유를 남긴 것은 `2-api-convention.md §5.4` 패턴(기본값 `null` + 문서화 사유)에 정확히 부합.
- webhook JSON 예시에 `payload` 래퍼를 추가한 것은 §"채널별 봉투 — 셋이 서로 다르다 (normative)" 규칙(webhook 전용 `payload` 래핑)과 정합.
- `strip-external-only-fields.ts` 의 `EXTERNAL_STRIPPED_FIELDS`/`MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH` 는 매직넘버 없이 자매 sanitizer 와 동일한 이름 있는 상수를 공유 — 이전 라운드에서 지적된 매직넘버 이슈가 재발하지 않았음을 확인.
- `error.code` 를 `null` 로 두고 억지 fallback 코드를 넣지 않은 결정은 `spec/conventions/error-codes.md §1` ("에러 코드 이름은 의미를 기술 — 의미 없는 코드를 만들지 않는다") 원칙과 부합.
- `execution-status-response.dto.ts` 의 `result`/`error`/`context` 필드는 이미 `swagger.md §1-3/§1-4` 의 "열린 map + `nullable: true` + `field?: T | null`" 패턴을 따르고 있고, 이번 diff의 런타임 변경(strip+redact 병행)이 DTO shape 자체를 바꾸지 않으므로 Swagger 갱신 불요 — 이 부분은 규약 위반 없음.

## 요약

이번 PR(eia-r8-cache-scope, `llmCalls` REST 경로 유출 차단)은 정식 규약 관점에서 대체로 개선 방향이다 — API URL 버전 세그먼트 위반을 스스로 고쳤고, `null`/키생략 선택에 §5.4 사유를 지켰으며, 매직넘버 없이 자매 상수를 공유하고, 에러 코드 명명 원칙(의미 없는 fallback 코드 금지)에도 부합한다. CRITICAL 급 규약 위반은 발견되지 않았다. 다만 (1) `6-websocket-protocol.md` 의 Rationale 인용 제목이 실제 heading 과 어긋나는 상호참조 drift, (2) `1-data-model.md` 신규 `details?` 필드가 자신이 가리키는 "원본" 행과 모양이 안 맞고 근거 인용이 빠진 점은 다음 커밋에서 바로잡는 편이 좋다. 둘 다 기능적 파손이 아닌 문서 정합성 수준의 이슈다.

## 위험도

LOW
