# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위

- `spec/5-system/6-websocket-protocol.md` (§4.4 `llmCalls` strip 범위 확장, Rationale 항목 개명)
- `spec/5-system/14-external-interaction-api.md` (§6.2 webhook 봉투 재작성, §6.4 `error.code` nullable, §6.2 URL 상대경로화)
- `spec/1-data-model.md` (§2.14 `Execution.error` 구조 nullable 반영)
- 대응 구현: `codebase/backend/src/shared/utils/strip-external-only-fields.ts`(신규),
  `codebase/backend/src/modules/websocket/websocket.service.ts`,
  `codebase/backend/src/modules/external-interaction/interaction.service.ts`

target 스코프의 대부분(EIA/WS/1-auth/4-execution-engine 등 다수)이 프롬프트 예산 초과로 절단되어 있어,
위 diff 대상 파일은 절대경로로 직접 `Read`/`git diff`/`grep` 하여 실제 파일과 대조 검증했다
(코드 존재·anchor 유효성·인용 텍스트 정확성을 코드/문서 원문에서 직접 확인).

## 발견사항

- **[INFO]** `Planned` 라벨 표기가 같은 문서 안에서 두 가지 형태로 갈린다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.2 (webhook 예시 comment `// interaction — **Planned (미구현)**.` 및 바로 아래 blockquote `> **\`interaction\` 블록은 Planned 다**`)
  - 위반 규약: 문서 자체가 이미 확립한 표기 관례 — 같은 문서 §6(필드 집합 표, `result.outputs`/`durationMs` 행)이 **"미구현 (Planned)"**(한국어 우선 + 영어 괄호)로 일관되게 쓰고 있다(예: L573, L574, L736, L749, L770). CLAUDE.md의 "문서 구조/명명 컨벤션 일관성" 취지에 해당.
  - 상세: 신규로 추가된 §6.2 `interaction` 블록의 두 Planned 표기가 (a) `Planned (미구현)`(순서 역전) (b) `Planned 다`(한국어 짝 없이 영어 단독)로, 기존 "미구현 (Planned)" 형태와 다르다. 더구나 blockquote 본문이 "`durationMs`/`result.outputs` 에 쓴 것과 **같은 표기**"라고 명시적으로 동일성을 주장하는데, 실제 문자열은 다르다 — 주장과 실제 표기가 어긋난다.
  - 제안: 두 곳 모두 `**미구현 (Planned)**`으로 통일해 문서 내 기존 관례 및 self-referential 주장("같은 표기")을 실제로 일치시킨다. 사소한 형식 문제라 별도 planner 턴 없이 다음 spec 편집 시 함께 정리 가능.

## 확인했으나 문제 없음으로 판정한 항목 (근거 포함)

아래는 위반 가능성이 있어 보여 직접 코드/링크 대조까지 했으나 **실제로는 규약을 준수**하는 것으로 확인된 항목이다. false positive 방지를 위해 근거를 남긴다.

1. **§6.2 webhook 봉투 재작성** — 종전 flat 예시를 `{type, executionId, ..., payload:{node, interaction, context}}`로 바꿔 §6 도입부("채널별 봉투 — normative")의 webhook `payload` 래핑 규칙 및 §6.3/§6.4 형식과 통일했다. `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:134`(`payload: event.payload`)로 실측 대조해 정확함을 확인.
2. **SSE는 payload 래퍼 없음** 주석 — `interaction-stream.controller.ts:167`(`JSON.stringify(event.payload)`가 `data:` 라인 전체)로 대조 확인, 정확.
3. **§6.2 URL 상대경로화** — 종전 `https://api.clemvion.ai/v1/executions/{id}/...` → `/api/external/executions/{id}/...`로 정정. `2-api-convention.md §1`("버전은 URL 경로에 미포함")과 실제 컨트롤러 라우트(`interaction.controller.ts`/`interaction-stream.controller.ts`의 `@Controller('external/executions')`)에 정합.
4. **`error.code`/`nodeId` nullable 표기(`spec/1-data-model.md` §2.14, EIA §6.4)** — `2-api-convention.md §5.4`("부재 표현: 기본은 `null`(키 present)")를 명시 인용하며 규약대로 `null`을 채택. Swagger DTO(`ExecutionStatusDto.error: Record<string, unknown> | null`)가 이미 열린 map이라 필드 레벨 스키마 변경이 불필요함을 `execution-status-response.dto.ts`로 확인 — DTO drift 없음.
5. **인용 오귀속 정정** ("Conversation Thread §4.4.6" → "WS §4.4.6") — `conversation-thread.md`에는 §4.4.6이 없고 `6-websocket-protocol.md`에 `#### 4.4.6` 헤딩이 실존함을 확인. 정정이 올바르다.
6. **`llmCalls` strip 범위 확장** (top-level → 깊이 무관, `strip-external-only-fields.ts` 신규) — WS §4.4 Rationale 항목명이 `ai_message.llmCalls[]` → `llmCalls`로 넓어졌고 본문·EIA §R17/§6.2/§6.5 인용이 모두 갱신되어 SoT 불일치 없음. `MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH` 상수가 두 호출부(`interaction.service.ts`/`websocket.service.ts`) 및 그 자매 sanitizer와 정확히 대응.
7. **`## Rationale` 섹션 갱신** — WS/EIA 문서 모두 기존 "## Rationale" 최하단 섹션 구조를 유지한 채 항목을 갱신(신설 헤딩 추가가 아니라 기존 항목 확장)해 CLAUDE.md의 Overview/본문/Rationale 3섹션 문서 구조를 흩트리지 않았다.
8. **anchor 유효성** — 신규/변경된 상호참조 링크(`§R17` 긴 slug, `#44-...`, `#446-...`)를 GitHub 스타일 slug 규칙으로 직접 검산 및 대상 헤딩 실존 확인, 전부 유효.
9. **`__proto__` 오염 방어(`strip-external-only-fields.ts`)** — 자매 함수 `deepRedactSecrets`(`sanitize-error-message.ts`)도 동일한 "spread 먼저 → bracket 대입" 패턴을 쓰고 있어 방어 수준이 실질적으로 동등함을 확인(신규 함수의 `Object.defineProperty`는 JSDoc이 스스로 "중복 방어"라 명시). spec/conventions에 이 마이크로 패턴을 규정하는 문서가 없어 conventions 위반은 아니며, 이미 별도 보안 코드리뷰 라운드(`review/code/2026/08/14/**`, 커밋 `5df89cda6`)에서 다뤄진 사안이라 본 리포트에서는 참고로만 남긴다.

## 요약

이번 diff(`spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md`·`spec/1-data-model.md` + `strip-external-only-fields.ts` 보안 하드닝)는 오늘 이미 다수 라운드의 code-review/consistency-check를 거쳐 수렴된 상태이며, 명명·출력 포맷(webhook `payload` 래핑, REST URL 상대경로, `null` 부재 표현)·문서 구조(Overview/Rationale 유지)·API 문서(Swagger DTO의 열린 map과 spec 변경 정합)·금지 패턴 회피 관점 모두에서 `spec/conventions/**`와 실제 코드에 정합함을 직접 대조로 확인했다. 유일한 흠은 §6.2에 새로 추가된 두 "Planned" 라벨 표기가 같은 문서의 기존 관례("미구현 (Planned)")와 형식이 갈리고, 그 blockquote가 "같은 표기"라고 주장하는 부분이 문자 그대로는 성립하지 않는다는 사소한 일관성 이슈뿐이다.

## 위험도

LOW
