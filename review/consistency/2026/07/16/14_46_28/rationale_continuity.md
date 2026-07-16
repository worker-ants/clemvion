# Rationale 연속성 검토 — cafe24/makeshop 도구 스키마 shared 추출 (operation-tool-schema.ts)

## 검토 대상

- 코드: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts` (신규) +
  `cafe24-mcp-tool-provider.ts` / `makeshop-mcp-tool-provider.ts` (기존 `buildCafe24JsonSchema`/`applyCafe24Allowlist`,
  `buildMakeshopJsonSchema`/`applyMakeshopAllowlist` 제거 → shared `buildOperationJsonSchema`/`makeEnabledToolsFilter` 위임)
- spec: `spec/conventions/cafe24-api-metadata.md` §2/§7 pointer 정정 (신규 shared 함수 반영)
- 근거 문서: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` "후속 PR #3" 체크리스트,
  선행 ai-review `08_36_49`(#955) W4 발견 → 본 리팩터로 해소

diff-base `origin/main` 대비 `git diff origin/main --stat` 로 변경 파일 전수 확인, `operation-tool-schema.ts` 전문 Read,
관련 spec Rationale 섹션(`spec/4-nodes/3-ai/1-ai-agent.md` §12.15, `spec/conventions/cafe24-api-metadata.md` `## Rationale`,
`spec/conventions/makeshop-api-metadata.md`) 을 절대경로로 직접 확인했다.

## 발견사항

검토 관점 1~4 (기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 어느 것에도 해당하는 CRITICAL/WARNING 없음.

- **[INFO] "per-provider 중복"이 Rationale 에 기록된 의도적 결정이었던 적이 없음 — 오히려 반대 근거가 이미 존재**
  - target 위치: `codebase/.../tool-providers/operation-tool-schema.ts` (신규 shared 모듈), `cafe24-mcp-tool-provider.ts` / `makeshop-mcp-tool-provider.ts` 의 dedup diff
  - 과거 결정 출처: 어느 spec 의 `## Rationale` 에도 "cafe24/makeshop 의 JSON Schema 매핑·allowlist 필터를 provider 별로 분리 유지한다"는 결정은 **없음**. 오히려 `spec/conventions/makeshop-api-metadata.md`(§ 서두, "결정 근거를 중복 기재하지 않고 cafe24 선례 + makeshop 분기만 참조한다")와 코드 주석(`makeshop/metadata/types.ts`: "Form is isomorphic to the Cafe24 metadata model" / constraint 정의는 "Copied verbatim from the Cafe24 model")이 이미 두 provider 를 **동형(isomorphic) 모델로 명시**하고 있었다. `Cafe24FieldConstraint`/`MakeshopFieldConstraint` union 도 4-kind(`oneOf`/`allOrNone`/`implies`/`impliesValue`)로 코드 레벨까지 완전히 동일함을 직접 확인(`codebase/backend/src/nodes/integration/{cafe24,makeshop}/metadata/types.ts`).
  - 상세: 이전의 "provider 별 별도 함수" 상태는 설계 원칙이 아니라, `plan/in-progress/ai-agent-tool-payload-budget-followups.md` "후속 백로그" 항목이 명시하듯 선행 PR(#955)에서 "module-level pure 함수로 승격만 했고(신규 중복 아님)" 남겨둔 **의도적으로 잠정 방치된 기술부채**였다. 이는 같은 PR 의 `/ai-review` W4 발견("라인 단위 100% 동일")으로 이미 공식 지적됐고, 본 리팩터는 그 W4 후속 조치를 그대로 수행한 것이다. 즉 이번 변경은 과거 Rationale 의 번복이 아니라 **명시적으로 예정된 부채 상환**이다.
  - 제안: 조치 불필요. 다만 향후 유사 감사에서 다시 헷갈리지 않도록, `operation-tool-schema.ts` 상단 주석(이미 "동형" 근거를 인용 중)과 `cafe24-api-metadata.md` §2 "MCP/JSON Schema 매핑" 표가 shared 함수를 SoT 로 가리키는 현재 상태(커밋 `b2990accb`로 이미 정정 완료 확인)를 유지하면 충분.

- **[INFO] spec pointer 정합 — 이미 자체 교정된 상태 확인**
  - target 위치: `spec/conventions/cafe24-api-metadata.md` §2 (line 153), §7 pseudo-code 주변 (line ~391, ~398)
  - 과거 결정 출처: 해당 문서 자체가 SoT 로 지목하던 대상(`Cafe24McpToolProvider.buildJsonSchema()`/`applyCafe24Allowlist`)이 이번 리팩터로 제거됨
  - 상세: `git diff origin/main -- spec/conventions/cafe24-api-metadata.md` 로 확인한 결과, 세 지점 모두 `tool-providers/operation-tool-schema.ts` 의 `buildOperationJsonSchema()`(cafe24/makeshop 공유)로 이미 정정되어 있다. 이는 선행 ai-review(`14_32_05`) W1 발견의 조치 결과(`RESOLUTION.md` 확인)이며, 별도 SPEC-DRIFT 로 남아있지 않다.
  - 제안: 조치 불필요 (이미 완료).

## 요약

이번 변경은 `spec/4-nodes/3-ai/` 나 관련 conventions(`cafe24-api-metadata.md`, `makeshop-api-metadata.md`) 의 어떤 `## Rationale` 항목도 기각·번복하지 않는다. 오히려 "두 provider 의 metadata 모델이 의도적으로 동형"이라는 기존 코드/spec 서술과 정합하며, 선행 `/ai-review`(#955) 가 W4 로 명시 지적한 라인 단위 중복을 예정대로 해소한 것이다(같은 PR 의 후속 백로그 항목으로 사전에 문서화됨). `oneOf`/`allOrNone`/`implies`/`impliesValue` 4종 constraint union 이 두 provider 간 코드 레벨까지 완전히 일치함을 직접 확인했으므로 구조적 타입(`OperationSchemaSource`)을 통한 순수 함수 통합에 암묵적 가정 충돌도 없다. spec pointer(`cafe24-api-metadata.md`)도 이미 신규 함수 위치로 정정 완료된 상태다. Rationale 연속성 관점에서 이 리팩터는 기존 합의를 위반하지 않고, 오히려 기존에 문서화된 후속 계획을 이행한 사례다.

## 위험도

NONE
