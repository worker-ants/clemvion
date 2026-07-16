# Rationale 연속성 검토 — impl-done 최종 pass (W4/W2 dedup 리팩터 + spec pointer/frontmatter 정정)

## 검토 범위 및 방법

- diff-base `origin/main` 대비 HEAD(`git diff origin/main..HEAD --stat`, 4 commits)로 변경 파일 전수 확인.
- 코드: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts`(신규) +
  `cafe24-mcp-tool-provider.ts` / `makeshop-mcp-tool-provider.ts` (기존 `buildCafe24JsonSchema`/`applyCafe24Allowlist`,
  `buildMakeshopJsonSchema`/`applyMakeshopAllowlist` 제거 → shared `buildOperationJsonSchema`/`makeEnabledToolsFilter` 위임).
- spec: `spec/conventions/cafe24-api-metadata.md`(frontmatter `code:` + §2/§7 pointer), `spec/4-nodes/3-ai/1-ai-agent.md`(frontmatter `pending_plans:` 1줄 추가).
- 신규 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md`(durable 앵커 분리) + `ai-agent-tool-payload-budget-followups.md` 체크리스트 갱신(자기모순 해소).
- 대상 target 문서 자체(`spec/4-nodes/3-ai/0-common.md`/`1-ai-agent.md`)의 `## Rationale` / §12.x Rationale 서브섹션은 본 diff 로 **문구가 전혀 수정되지 않음** — 직접 확인(`git diff origin/main -- spec/4-nodes/3-ai/`)으로 frontmatter 1줄 외 본문 변경 없음을 검증.
- 선행 `/consistency-check --impl-done`(14_46_28) 의 `rationale_continuity.md` 산출물을 대조군으로 재확인 — 그 시점 이후 커밋(`fe404a889` 1건)의 증분만 재검토.

## 발견사항

검토 관점 1~4 (기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 에 해당하는 CRITICAL/WARNING 없음.

- **[INFO] W4 dedup 리팩터는 순수 동작 보존 추출 — 과거 Rationale 과 충돌 없음 (재확인)**
  - target 위치: `operation-tool-schema.ts`(신규), `cafe24-mcp-tool-provider.ts` / `makeshop-mcp-tool-provider.ts` 의 제거 diff
  - 과거 결정 출처: 없음(어느 spec `## Rationale` 도 "provider 별 스키마 빌더를 분리 유지" 를 결정한 적이 없다) — 오히려 `spec/conventions/makeshop-api-metadata.md` `## Rationale`("cafe24 와 동형 형식이므로 결정 근거를 중복 기재하지 않고 cafe24 선례 + makeshop 분기만 참조") 및 코드 주석(`makeshop/metadata/types.ts`: "Form is isomorphic to the Cafe24 metadata model")이 이미 두 provider 를 동형으로 명시하고 있었다.
  - 상세: `buildOperationJsonSchema`/`makeEnabledToolsFilter` 는 기존 `buildCafe24JsonSchema`/`buildMakeshopJsonSchema`/`apply*Allowlist` 4개 함수와 라인 단위로 동일한 로직을 옮긴 것(원본 diff 확인 — 필드 타입 매핑·`oneOf→allOf/anyOf` 변환·allowlist 판정 로직 100% 보존, 신규 동작 없음). 이 dedup 자체가 선행 `/ai-review`(#955) W4 발견의 예정된 후속 조치로 `plan/in-progress/ai-agent-tool-payload-budget-followups.md` 에 사전 문서화돼 있었다 — 결정의 번복이 아니라 계획된 부채 상환.
  - 제안: 조치 불필요. 이미 선행 rationale_continuity 검토(`14_46_28`)에서 동일 결론으로 확인됨.

- **[INFO] spec pointer 정정 — 코드 이동 사실과 정합, Rationale 본문은 무변경**
  - target 위치: `spec/conventions/cafe24-api-metadata.md` §2(line 153 부근), §7 pseudo-code 주변(line ~391, ~398)
  - 과거 결정 출처: 해당 문서의 §2 "MCP/JSON Schema 매핑" 표 — 이 결정(`oneOf` 만 schema 변환, requiredFields+anyOf 결합 등)의 **내용은 그대로 유지**되고 구현 위치 pointer(`Cafe24McpToolProvider.buildJsonSchema()` → `operation-tool-schema.ts` 의 `buildOperationJsonSchema()`)만 갱신됨.
  - 상세: `## Rationale` 섹션 자체(line 441~) 는 diff 에 포함되지 않음 — timezone suffix 결정·`constraints` 구조화 결정·`label` 필드 제거 결정 등 기존 4개 Rationale 항목 모두 문구 불변. 사실관계(구현 위치) pointer 만 코드 리팩터를 따라간 것이라 "결정 번복" 범주에 해당하지 않는다.
  - 제안: 조치 불필요.

- **[INFO] frontmatter 정정(`code:`, `pending_plans:`) — spec-impl-evidence 컨벤션 준수**
  - target 위치: `spec/conventions/cafe24-api-metadata.md` frontmatter `code:` 배열에 `operation-tool-schema.ts` 추가, `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans:` 배열에 `spec-drift-ai-agent-outport-countmax.md` 추가
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` §R-5 ("`status: partial` 의 `pending_plans:` 의무화") + §4 frontmatter-evidence 가드("`code:` 는 실제 SoT 파일과 1:1 대응해야 함")
  - 상세: 두 frontmatter 변경 모두 이 기존 컨벤션을 **준수**하는 방향이다 — `1-ai-agent.md` 는 `status: partial` 이므로 신규 pending plan 등록이 컨벤션 상 의무이고, `cafe24-api-metadata.md` 의 `code:` 배열은 §2/§7 본문이 이미 가리키는 신규 SoT 파일과 evidence 를 일치시킨 것. 새로운 원칙 도입이 아니라 기존 원칙에 대한 정합 보완.
  - 제안: 조치 불필요.

- **[INFO] `spec-drift-ai-agent-outport-countmax.md` 신설 — 결정 번복이 아니라 미해결 모순의 durable 문서화**
  - target 위치: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` (신규), `1-ai-agent.md` frontmatter `pending_plans:`
  - 과거 결정 출처: `1-ai-agent.md` §3.2("Multi Turn 모드에는 `out` 포트가 존재하지 않는다") vs `_product-overview.md`(ND-AG-24 "조건 0개 시 `out`+`error` 하위호환") — 두 spec 문서 간 기존 자기모순. `1-ai-agent.md` §12.15 Rationale("개수 cap 은 값싼 2차 sanity 로만 둔다", `AI_AGENT_TOOL_COUNT_MAX=128`) vs `4-cafe24.md`("~180") / 실측 카탈로그(383건) 간 정합성 이슈.
  - 상세: 신규 plan 문서는 이 두 모순에 대해 **어느 쪽이 맞는지 결정하지 않고** "코드 동작을 SoT 로 확정 후 project-planner 가 처분할 것"이라고만 명시한다(본문 "처분:" 항목이 조건부 대안 나열이지 확정 결정이 아님). 즉 §12.15 의 기존 Rationale("bytes 가 1차 지표, count 는 2차 sanity")을 뒤집거나 재해석하지 않고 있는 그대로 인용만 한다. 이는 검토 관점 3(무근거 번복)에 해당하지 않는다 — 오히려 번복을 유보하고 추적 가능하게 만든 것.
  - 제안: 조치 불필요. project-planner 가 후속 task 에서 실제 코드 동작을 조사해 어느 쪽 spec 을 정정할지 결정할 때, 그 결정문에는 반드시 새 `## Rationale` 항목(왜 그 쪽이 맞는지)을 동반해야 한다 — 이는 이미 plan 문서 자체가 명시하고 있는 처리 원칙이다.

## 요약

이번 impl-done 최종 pass(commit `fe404a889` 증분 포함 4 commits 전체)는 `spec/4-nodes/3-ai/` 및 관련 conventions(`cafe24-api-metadata.md`)의 `## Rationale` 섹션 문구를 전혀 수정하지 않았다. 실질 변경은 (1) 코드 레벨의 순수 동작 보존 dedup 리팩터(W4) — 기존 "cafe24/makeshop 동형 모델" 서술과 정합하며 기각된 대안의 재도입이 아니다, (2) 그 리팩터를 반영한 spec pointer 정정 — 결정 내용 불변·구현 위치만 갱신, (3) `spec-impl-evidence.md` 컨벤션을 준수하는 frontmatter(`code:`/`pending_plans:`) 보완, (4) 기존에 이미 발견된 두 건의 spec 자기모순(out 포트, count_max)을 결정하지 않고 durable plan 으로 이관해 추적성을 강화한 것. 네 가지 모두 과거 Rationale 을 위반·번복·우회하지 않으며, 오히려 (4)는 향후 실제 번복이 발생할 때 새 Rationale 작성을 강제하는 방향의 프로세스 개선이다. 선행 검토(14_46_28, 위험도 NONE)의 결론과 일치하며 이번 증분에서 새로 제기할 리스크는 없다.

## 위험도

NONE
