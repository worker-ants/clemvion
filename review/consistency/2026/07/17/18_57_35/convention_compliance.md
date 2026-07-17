# 정식 규약 준수 검토 — spec/4-nodes/3-ai/

## 검토 범위 메모

- 검토 모드: `--impl-done`, scope=`spec/4-nodes/3-ai/`, diff-base=`origin/main`.
- `git -C <worktree> diff --stat origin/main -- spec/4-nodes/3-ai/` 결과, 실제 diff 는 **2개 파일에 각 2줄** 뿐이다:
  - `spec/4-nodes/3-ai/1-ai-agent.md` — §7 출력 구조 서두에 `endReason` 값 도메인 SoT 안내 blockquote 1개 추가.
  - `spec/4-nodes/3-ai/3-information-extractor.md` — §5.6 서두에 동일 패턴의 blockquote 1개 추가.
- 동일 브랜치에는 scope 밖의 변경도 존재한다 (`codebase/packages/ai-end-reason/` 신규 패키지, `spec/conventions/interaction-type-registry.md` §4 신설, `spec/7-channel-web-chat/*` 등). 본 검토는 지시된 target `spec/4-nodes/3-ai/` 만 평가하며, `spec/conventions/interaction-type-registry.md` 는 target 이 준수해야 할 "규약" 쪽으로 취급했다 (그 문서 자체의 적정성은 별도 판단이나, 참고차 전문을 읽고 내적 일관성을 확인함).
- 코드 확인은 모두 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/is-conversation-output-restructure-08f20e`) 기준으로 수행.

## 발견사항

- **[WARNING]** `0-common.md §5` 의 "Principle 11" 인용이 실제 node-output.md 의 Principle 11 내용과 어긋남 (target 전역 범위 이슈, 이번 diff 가 도입한 것은 아님)
  - target 위치: `spec/4-nodes/3-ai/0-common.md` §5 "응답 형식 규약 (Principle 11)" 제목(L81) 및 본문(L83) — `LLM 3 노드는 output.result.* / output.error.* / output.interaction.* wrapper 를 공유한다 (CONVENTIONS Principle 11)`. 동일 라벨이 `0-common.md` L144(자기 자신에 대한 앵커 링크)와 `3-information-extractor.md` L183(`[공통 §5](./0-common.md#5-응답-형식-규약-principle-11)`)에도 전파되어 인용된다.
  - 위반 규약: `spec/conventions/node-output.md` §Principle 11 (실제 정의는 "출력 예시 문서화 규칙" — Case 블록/undefined 필드 생략/5필드 표기 등 **문서 작성 형식** 규칙).
  - 상세: `output.result.*`/`output.error.*`/`output.interaction.*` 3-wrapper 구조 자체의 근거는 node-output.md 의 Principle 8.2("output.result 래핑은 LLM 계열 노드 한정"), Principle 3.2(`output.error` 표준 형태), Principle 4.5(`interaction.data` payload 규격) 이며, Principle 11 은 그 구조를 **어떻게 문서에 적을지**(Case: / json 블록 / undefined 생략)만 규정한다. `2-text-classifier.md` L130 과 `3-information-extractor.md` L181 은 "Principle 11 포맷"을 JSON 예시 작성 형식 의미로 **정확히** 사용하고 있어 대비된다 — 같은 문서군 안에서 "Principle 11"이 두 가지 다른 의미(①문서 형식 규칙, ②wrapper 구조 자체의 근거)로 혼용되고 있다. 향후 누군가 "왜 output.result 로 감싸는가"를 추적하다 Principle 11 로 가면 원하는 근거(Principle 8.2/3.2/4.5)를 찾지 못한다.
  - 제안: `0-common.md §5` 제목/인용을 `(Principle 1/3.2/4.5/8.2)` 등 실제 근거로 정정하거나, "Principle 11" 을 유지하고 싶다면 그 의도(3-wrapper 구조의 문서화 표준 전체를 가리키는 상위 라벨)를 node-output.md 쪽에도 명시해 두 문서의 정의를 일치시킨다. 이번 PR 의 diff 범위는 아니므로 별도 후속으로 처리해도 무방.

- **[INFO]** 신규 `endReason` SoT 안내 문구가 두 파일에 유사 문장으로 중복
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §7 서두(diff 추가분) / `spec/4-nodes/3-ai/3-information-extractor.md` §5.6 서두(diff 추가분).
  - 위반 규약: 없음 (형식 위반이 아니라 일관성 제안).
  - 상세: 두 blockquote 모두 "`endReason` 값 도메인의 SoT 는 `@workflow/ai-end-reason`... 값 목록 자체는 패키지가 소유한다"로 시작하는 거의 동일한 문장을 반복한다. `0-common.md` 가 AI 3 노드 공통 규약을 모으는 문서이므로(§1~§11 패턴), 원한다면 공통 문구를 `0-common.md` 에 1회 기술하고 각 노드 문서는 링크만 남기는 방식도 가능하나, 실제 값(`AiAgentEndReason` vs `InformationExtractorEndReason`)과 예시가 노드별로 다르고 §7/§5.6 이라는 "출력 구조" 절 서두라는 점에서 각자 위치에 두는 편이 발견성(discoverability) 면에서 유리하다 — 현재 방식도 무리 없는 선택으로 판단됨.

## 검증된 준수 항목 (참고용 — 발견사항 아님)

다음은 이번 diff 및 target 영역을 검토하며 명시적으로 대조·확인한 항목으로, 위반이 발견되지 않았다.

- **패키지 명명**: `@workflow/ai-end-reason` — `codebase/packages/*/package.json` 의 기존 6개 패키지(`@workflow/chat-channel-validation`, `@workflow/expression-engine`, `@workflow/graph-warning-rules`, `@workflow/node-summary`, `@workflow/sdk`, `@workflow/web-chat`)와 동일한 `@workflow/<kebab-case>` 패턴 준수.
- **상대경로 링크**: `spec/4-nodes/3-ai/1-ai-agent.md` → `../../../codebase/packages/ai-end-reason/` 및 `../../conventions/interaction-type-registry.md` 모두 워킹트리에서 실제 경로로 resolve 확인 (`spec/4-nodes/3-ai/` 기준 repo root 까지 3단계 up 정확).
- **앵커 정확성**: `#4-ai-노드-endreason--패키지가-sot-가드-비대상` — `interaction-type-registry.md` 의 `## 4. AI 노드 \`endReason\` — **패키지가 SoT** (가드 비대상)` 제목에서 backtick/bold/괄호 제거 + em-dash 주변 공백 2칸 → 더블 하이픈 규칙으로 정확히 파생됨. 동일 규칙 적용 사례(`spec-impl-evidence.md` 의 `#r-8-gate-c--plan-완료-시점-spec_impact-선언-의무화` 등)로 프로젝트 내 선례 확인. 헤딩 중복 없어 slug 충돌(`-1` suffix) 위험 없음.
- **타입명 일치**: 인용된 `AiAgentEndReason` / `InformationExtractorEndReason` 이 `codebase/packages/ai-end-reason/src/index.ts` 의 실제 export 타입명과 정확히 일치.
- **`retryable`/`retryAfterSec` invariant** (node-output.md §3.2.1 — "convention-compliance checker 가 발견" 대상으로 명시된 항목): `1-ai-agent.md`/`2-text-classifier.md`/`3-information-extractor.md`/`0-common.md` 전체에서 `retryAfterSec` 이 등장하는 모든 위치가 `retryable: true` 와 짝을 이루거나 invariant 를 명문화하고 있음 — 위반 없음.
- **에러 코드 명명**: `LLM_CALL_FAILED`/`LLM_RATE_LIMIT`/`LLM_RESPONSE_INVALID`/`TOOL_EXECUTION_FAILED`/`MAX_TOOL_CALLS_EXCEEDED`/`TOOL_DEFINITION_PAYLOAD_EXCEEDED` 등 모두 `UPPER_SNAKE_CASE` — `error-codes.md` §1 표기 규칙 준수.
- **금지 패턴 미재현**: `output.output.*`(이중 중첩), `output.metadata.*`, `output.data.*` 1차 wrapper 등 node-output.md Principle 8.1 이 금지한 legacy 패턴이 target 전역에 재도입되지 않음 (유일한 `output.output.` 언급은 "폐기됐다"는 서술적 언급).
- **frontmatter 스키마**: `1-ai-agent.md`(`status: partial` + `pending_plans:` 2건, 둘 다 `plan/in-progress/` 에 실존) / `3-information-extractor.md`(`status: implemented`, `code:` 비어있지 않음) / `2-text-classifier.md`(`status: implemented`) / `0-common.md`(`status: implemented`) 모두 `spec-impl-evidence.md` §2~§3 스키마 준수. `_product-overview.md` 는 `_` prefix 로 frontmatter 면제 대상에 정확히 해당.
- **문서 구조**: `1-ai-agent.md`(§12 Rationale) / `3-information-extractor.md`(§9 Rationale) / `0-common.md`(Rationale) 모두 본문 뒤 Rationale 섹션 보유 — project-planner SKILL 의 3섹션 권장 구조 준수. 다중 파일 영역이라 Overview 는 `_product-overview.md` 로 분리되어 있고 `0-`/`N-` prefix 명명도 일치.
- **포트/도구 명명**: `cond_*`/`kb_*`/`mcp_<sid>__<toolName>`/`render_*` prefix 체계, 시스템 예약 포트(`out`/`error`/`user_ended`/`max_turns`)가 node-output.md Principle 6 의 예약어·동적 포트 네이밍 규칙과 일치. `ai_agent:*` 형태의 `warningRules`/`graphWarningRules` id 도 `cross-node-warning-rules.md` 의 `<node>:<rule-name>` 패턴과 일치.
- **API 문서 규약(Swagger/DTO)**: target 영역에 REST controller/DTO 관련 서술이 없어 `swagger.md` 관점은 해당 없음(not applicable) — 별도 위반 없음.

## 요약

이번 검토의 실제 diff 는 `spec/4-nodes/3-ai/1-ai-agent.md`·`3-information-extractor.md` 에 각각 2줄씩 추가된 `endReason` 값 도메인 SoT 안내 blockquote 뿐이며, 명명(`@workflow/ai-end-reason` 패키지 규약)·상대경로·앵커·타입명 모두 실측 검증 결과 정식 규약 및 실제 코드와 정확히 일치해 위반이 없다. `retryable`/`retryAfterSec` invariant, 에러 코드 표기, 금지 패턴 미재현, frontmatter 라이프사이클 스키마, 3섹션 문서 구조, 포트/도구 명명 등 target 영역 전반을 표본 검증한 결과도 규약 위반은 발견되지 않았다. 유일한 지적 사항은 이번 diff 이전부터 존재하던 `0-common.md §5` 의 "Principle 11" 인용 오류(실제 근거는 Principle 8.2/3.2/4.5)로, 이번 변경이 만든 문제는 아니며 기능적 영향도 없는 문서 정확성 이슈다.

## 위험도

LOW
