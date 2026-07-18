# 신규 식별자 충돌 검토 — spec/4-nodes/3-ai (--impl-done)

## 조사 방법 / 전제

- prompt payload 의 "Target 문서" 섹션은 `spec/4-nodes/3-ai/0-common.md` 전문 +
  `spec/4-nodes/3-ai/1-ai-agent.md` 일부(§7.4 부근까지 truncate)를 포함하지만,
  `git -C <worktree> diff origin/main HEAD -- spec/4-nodes/3-ai/` 결과는 **0줄**이다 —
  즉 payload 에 실려온 이 대용량 spec 본문은 이번 태스크에서 새로 쓰인 diff 가
  아니라, scope 표기(`spec/4-nodes/3-ai`)에 딸린 **이미 origin/main 에 있는 안착된
  본문**의 스냅샷이다 (동일 결론을 낸 직전 `--impl-prep` 라운드:
  `review/consistency/2026/07/18/11_19_02/naming_collision.md`, 위험도 NONE).
- 실제로 이번 라운드에서 origin/main 대비 변경된 파일은 다음 4개뿐이다
  (`git diff --stat origin/main HEAD`):
  - `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
  - `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts`
  - `codebase/backend/src/nodes/core/node-handler.interface.ts`
  - `plan/in-progress/ie-endmultiturn-errorpayload-contract.md`
  (+ `spec/conventions/interaction-type-registry.md` 의 "AST" → "grep" 용어 정정 —
  본 태스크와 무관한 문구 교정, 신규 식별자 없음)
- `spec/4-nodes/3-ai/*.md` 자체는 이번 태스크에서 **한 글자도 바뀌지 않았다**. 따라서
  신규 식별자 충돌 검토의 실질 대상은 위 코드/plan diff 4개다.

## 변경 내용 요약 (신규 식별자 후보 추출)

`IE(InformationExtractorHandler).endMultiTurnConversation` 시그니처에 3개 파라미터를
추가:

```ts
endMultiTurnConversation(
  stateRaw: Record<string, unknown>,
  endReason: EndReason,
  _errorPayload?: { code: string; message: string; details?: unknown },
  _failedUserMessage?: string,
  _failedUserMessageSource?: ResumableMessageSource,
): unknown
```

+ `ResumableMessageSource` import 추가 + docblock 정정(동작 무변경, behavior-preserving).

## 발견사항

특기할 CRITICAL/WARNING 없음 — 이번 diff 는 새 식별자를 "도입"하는 것이 아니라
**이미 인터페이스가 선언한 기존 식별자에 구현을 정렬**시키는 변경이다.

- **[INFO]** 신규처럼 보이는 파라미터명은 실제로는 기존 계약의 재사용
  - target 표기: `_errorPayload` / `_failedUserMessage` / `_failedUserMessageSource`
    (`information-extractor.handler.ts` `endMultiTurnConversation`)
  - 기존 사용처: `codebase/backend/src/nodes/core/node-handler.interface.ts:489,497,498`
    — `ResumableNodeHandler.endMultiTurnConversation` 이 2026-05-19 부터 선언해온
    `errorPayload?` / `failedUserMessage?` / `failedUserMessageSource?` 와 동일한
    이름 + 동일한 타입(`{ code, message, details? }` / `string` / `ResumableMessageSource`)이다.
    `AiAgentHandler.endMultiTurnConversation`(`ai-agent.handler.ts:198`)도 같은 이름으로
    이미 구현하고 있다.
  - 상세: 밑줄(`_`) 접두사는 프로젝트의 표준 "선언되지만 미사용" lint 컨벤션이며,
    이름 자체는 인터페이스가 이미 소유한 식별자를 그대로 재사용한 것 — **새 의미를
    부여하지 않는다**. IE 구현체는 이 세 값을 의도적으로 무시(self-fill)하고,
    그 사유(§5.3 code-기반 retryable invariant, `_retryState` 미지원)를 docblock 에
    명시했다. 이름 충돌 관점에서는 "동일 식별자 · 동일 의미(인터페이스 계약) ·
    구현체별 소비 여부만 다름"이라 문제 없음.
  - 제안: 조치 불요.

- **[INFO]** `ResumableMessageSource` import 는 신규 타입이 아니라 기존 export 재사용
  - target 표기: IE handler 파일 상단 `import { ..., ResumableMessageSource } from '../../core/node-handler.interface'`
  - 기존 사용처: `node-handler.interface.ts:373` — `export type ResumableMessageSource = 'ai_message' | 'form_submitted'`
    (기존에 `AiAgentHandler` 쪽에서 이미 소비 중이던 타입)
  - 상세: 새 유니온 값 추가나 새 타입 선언이 아니라 이미 존재하는 export 를 IE 파일이
    처음 import 하는 것뿐. 충돌 없음.
  - 제안: 조치 불요.

- **[INFO]** 테스트 파일에 등장하는 에러 코드 (`LLM_CALL_FAILED` / `LLM_RATE_LIMIT`)
  도 신규 코드가 아니라 이미 §5.3/§7.9 에 정의된 기존 코드의 재사용 (pinning test 목적).
  새 `output.error.code` enum 값 추가 없음.

- **[INFO]** `spec/conventions/interaction-type-registry.md` 의 "AST 가드/AST 로 스캔" →
  "grep 검증/grep 가드/grep 결과" 표현 정정은 본 태스크(IE errorPayload 계약)와 무관한
  용어 교정이며 신규 식별자를 도입하지 않는다 (기존 서술이 실제 구현(regex/grep 기반
  검증)과 불일치했던 것을 바로잡는 문서 정정으로 보인다). 신규 식별자 충돌 관점에서는
  범위 밖.

- **[INFO]** payload 커버리지 한계 (직전 라운드와 동일 소견 유지)
  - payload 의 "Target 문서" 섹션이 `2-text-classifier.md`/`3-information-extractor.md`
    전문을 포함하지 않는다. 다만 이번 라운드는 애초에 그 두 파일에 diff 가 없으므로
    (전체 `spec/4-nodes/3-ai/` diff 0줄) 이 한계가 실질적 검토 공백으로 이어지지 않는다.

## 점검한 구체 후보 (충돌 없음 확인)

| 식별자 | 검증 결과 |
|---|---|
| `_errorPayload` / `_failedUserMessage` / `_failedUserMessageSource` (IE) | `node-handler.interface.ts` 의 기존 `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 파라미터와 동일 계약 재사용(밑줄 접두사만 추가) — 신규 의미 없음 |
| `ResumableMessageSource` (IE import) | `node-handler.interface.ts:373` 기존 export, AI Agent 가 이미 소비 중이던 타입 재사용 |
| `LLM_CALL_FAILED` / `LLM_RATE_LIMIT` (신규 pinning test) | §5.3/§7.9 기존 에러 코드 재사용, 신규 코드 추가 없음 |
| `spec/4-nodes/3-ai/*.md` 전체 (0-common/1-ai-agent 의 §11 System Context Prefix, `render_*` Presentation Tool Family, `memoryStrategy` 계열, `AI_AGENT_TOOL_*` ENV 4종 등) | origin/main 대비 **diff 0줄** — 이번 라운드에서 신규 도입된 식별자가 아니다. 직전 `--impl-prep` 라운드(`11_19_02/naming_collision.md`)가 이미 이 전체 집합을 codebase/spec 교차검증 완료(위험도 NONE) — 재검토 불필요 |

## 요약

이번 `--impl-done` 라운드의 실제 diff(origin/main → HEAD)는 `spec/4-nodes/3-ai/*.md`
를 전혀 건드리지 않았고, IE(`InformationExtractorHandler`) 의 `endMultiTurnConversation`
시그니처를 `ResumableNodeHandler` 인터페이스가 이미 선언해둔 기존 파라미터명
(`errorPayload`/`failedUserMessage`/`failedUserMessageSource`, 밑줄 접두사로 미사용
표시)에 맞춰 정렬하고 그 divergence 사유를 docblock/plan 에 문서화한 것이 전부다.
새로 만들어진 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV 변수·파일 경로는 없으며,
유일한 "새로 보이는" 이름들(`_errorPayload` 등)도 기존 계약의 재사용이라 의미 충돌이
없다. payload 에 실려온 대용량 `spec/4-nodes/3-ai` 본문(§11 System Context Prefix,
Presentation Tool Family, `memoryStrategy` 필드군 등)은 이미 이전 라운드에서 전량
충돌 없음으로 검증된 안착 상태이며 이번 diff 로 재도입되지 않았다.

## 위험도

NONE
