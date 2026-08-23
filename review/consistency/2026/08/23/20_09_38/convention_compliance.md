# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md` (nodeOutput allowlist)

## 검토 범위 및 방법

`--impl-done` 모드, target 영역 `spec/5-system/`, diff-base `origin/main`. `_prompts/convention_compliance.md` 번들의 `spec/conventions/**` 섹션 상당수(특히 `node-output.md`·`node-cancellation.md`·`secret-store.md`·`swagger.md` 등)와 `<git diff origin/main...HEAD -- code_areas>` 자체가 컨텍스트 예산 초과로 절단돼 있었으므로, worktree(`/Volumes/project/private/clemvion/.claude/worktrees/nodeoutput-allowlist-17a6f5`) 파일시스템에서 직접 `git diff origin/main...HEAD`, `spec/conventions/node-output.md`(전문), `spec/conventions/egress-masking.md`(번들 발췌 대조), `spec/conventions/spec-impl-evidence.md`(전문), 변경된 코드(`node-output-allowlist.ts`/`.spec.ts`, `interaction.service.ts` diff), `plan/complete/nodeoutput-allowlist.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` diff를 읽어 대조했다.

이번 작업의 실제 diff: `spec/5-system/14-external-interaction-api.md`(§R17 불릿 갱신, 25줄), `codebase/backend/src/shared/utils/node-output-allowlist.ts`(신규, `allowlistNodeOutputKeys`), `codebase/backend/src/modules/external-interaction/interaction.service.ts`(배선), 테스트·plan·CHANGELOG.

## 발견사항

- **[WARNING]** 신규 구현 파일이 spec frontmatter `code:` 에 미등재
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 목록 (파일 상단 5~26행)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1/R-1 — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로"(책임 목록)
  - 상세: 이번 PR 이 신설한 `codebase/backend/src/shared/utils/node-output-allowlist.ts` 는 지금 이 문서가 편집 중인 바로 그 단락(§R17 "`nodeOutput` 일반 키 allowlist … 해소")이 가리키는 핵심 구현체(`allowlistNodeOutputKeys`)이고, `interaction.service.ts` 의 JSDoc 도 "EIA §R17" 을 명시적으로 인용해 되돌아 참조한다. 그런데 frontmatter `code:` 목록에는 이 파일이 없다. 같은 계열의 자매 파일 `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 는 이미 등재돼 있어(9행) 패턴상 나란히 등재돼야 자연스럽다. `spec-code-paths.test.ts` 가드는 글로브가 ≥1 파일에 매치하기만 하면 통과하므로(다른 항목들 덕에 빌드는 안 깨짐) 이 누락은 build-time 으로 잡히지 않는다 — 그래서 사람이 봐야 하는 유형의 drift다.
  - 제안: `code:` 목록에 `codebase/backend/src/shared/utils/node-output-allowlist.ts` 추가.

- **[WARNING]** `node-output.md` Principle 0 의 "5필드 + 3개 내부 예외" 닫힌 레지스트리가 새 `NODE_OUTPUT_ALLOWED_KEYS`(wire-only 4키)와 어긋난 채로 남음
  - target 위치: `spec/conventions/node-output.md` Principle 0 (5필드 불변 + `_resumeState`/`_resumeCheckpoint`/`_retryState` 예외 목록) — 이번 diff 로 **변경되지 않음**
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 자체("이 5필드의 의미는 어떤 노드에서든 동일해야 합니다" + 명시된 3개 예외로 닫힌 목록)
  - 상세: 이번 PR 이 신설한 `NODE_OUTPUT_ALLOWED_KEYS`(`node-output-allowlist.ts`)는 `NodeHandlerOutput` 공개 5키 외에 `formConfig`/`conversationConfig`/`buttonConfig`/`interactionType` 4개의 "wire 전용" 최상위 키를 **의도적으로 함께 허용**한다고 자체 JSDoc 이 밝히고 있고, 실측(`interaction.service.spec.ts` 의 `nodeOutput.conversationConfig` mock, `interaction.service.ts` 의 `structured.buttonConfig` legacy-flat 분기)으로도 이 키들이 실제 `NodeExecution.outputData` 최상위에 등장함을 확인했다. 즉 코드 레벨에서는 이제 "5필드+3예외" 가 아니라 "5필드+3예외+4 wire-only" 가 컴파일타임으로 결속된 사실상의 SoT 다. 반면 `node-output.md` Principle 0 은 여전히 3개 예외만 나열해 두 정식 규약 문서(node-output.md ↔ 이 PR 이 갱신한 EIA §R17)가 같은 `nodeOutput` 최상위 키 구성에 대해 서로 다른 그림을 그린다. 이 드리프트 자체는 이번 PR 이 새로 만든 것이 아니라(`conversationConfig` wire 키는 2026-07-09 재조정부터 이미 존재) 이번 PR 이 그것을 **코드의 닫힌 SoT 로 처음 명문화**했으므로, 지금이 `node-output.md` 를 동반 갱신할 자연스러운 시점이었다. 이전 라운드(`18_30_40` 리뷰, INFO 항목 2)가 정확히 이 후속을 예고했지만, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 이번 diff 가 등재한 두 잔여 항목(SSE/fanout allowlist, 파일 재배치) 어디에도 "node-output.md Principle 0 갱신"은 없어 추적이 끊겼다.
  - 제안: `spec/` 쓰기 권한이 없는 `developer` 역할이 이 턴에서 직접 고칠 수 없으므로(SKILL 체계상 정상), `project-planner` 턴에서 `node-output.md` Principle 0 에 "EIA wire 조립 레이어가 top-level 에 추가하는 `formConfig`/`conversationConfig`/`buttonConfig` 및 `meta.interactionType` 은 `NodeHandlerOutput` 계약의 일부가 아니라 EIA/WS 조립부가 합성하는 wire-only 필드" 라는 각주를 추가하거나, 최소한 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이 항목을 정식 잔여 항목으로 등재해 유실을 막을 것을 권고.

- **[INFO]** (carry-over, 이번 diff 밖) `EIA-NF-05` 의 plain-text 섹션 참조가 여전히 어긋남
  - target 위치: `spec/5-system/14-external-interaction-api.md` §3.5, `EIA-NF-05` 행 — "동일 노드에 대한 race 는 §5.3 의 lock 전략으로 직렬화"
  - 위반 규약: 특정 conventions 항목은 아니고 문서 내부 정확성(하이퍼링크가 아닌 산문 섹션 번호 인용이라 `spec-link-integrity` 가드 사각지대) 문제.
  - 상세: 실제 lock/직렬화 서술은 §5.6 "동시성 / Lock (EIA-NF-05)"에 있고 §5.3(단발 상태 조회)에는 없다. 직전 라운드(`18_30_40`)에서 이미 지적됐고 이번 PR 의 diff 범위(§R17 불릿)와 무관해 그대로 남아 있다.
  - 제안: `§5.3` → `§5.6` 정정 (이번 PR 스코프는 아니므로 별도 처리해도 무방).

## 조사했으나 위반 없음 확인 (positive findings)

- **파일·식별자 명명**: `node-output-allowlist.ts`(kebab-case), `allowlistNodeOutputKeys`(camelCase 함수), `NODE_OUTPUT_ALLOWED_KEYS`(UPPER_SNAKE_CASE 상수) 모두 자매 파일(`strip-external-only-fields.ts`/`EXTERNAL_STRIPPED_FIELDS`/`MAX_REDACT_DEPTH`)과 동일한 명명 패턴.
- **egress-masking.md 범위 경계**: 신규 allowlist 는 마커·값 치환이 없는 **키 단위 fail-closed 필터**라, "마스킹(marker/depth 좌표계)" 을 다루는 `egress-masking.md` 의 SoT 범위(§Overview 가 스스로 "자격증명을 가리는 마스커·스캐너 협업"으로 명시) 밖이다. `code:` frontmatter 에 등재하지 않은 것, §3 "이 문서는 기계가 지키지 않는다" 절의 stale 트리거("마스커가 늘거나·합쳐지거나·상한/연산자가 바뀌는 것")에 해당하지 않아 좌표계 표를 갱신하지 않은 것 모두 문서 자체가 정의한 경계와 정합한다.
- **컴파일타임 결속 패턴**: `assertAllowlistCoversHandlerContract`(타입 레벨 검사) + `Object.freeze`(런타임 불변) 조합은 이 저장소가 다른 곳에서도 쓰는 "손으로 나열한 목록의 2차 동기화 지점 제거" 패턴과 정합하며 별도 규약 위반 없음.
- **plan frontmatter**: `plan/complete/nodeoutput-allowlist.md` 의 `status: complete` + `spec_impact: [spec/5-system/14-external-interaction-api.md]` 는 `spec-impl-evidence.md` Gate C(R-8) 요건과 정합.
- **API/Swagger 표면**: 이번 diff 는 컨트롤러·DTO·swagger 데코레이터를 건드리지 않는다(서비스 내부 유틸 배선만) — swagger.md 관련 위반 대상 자체가 없음.
- **audit-actions.md / error-codes.md**: 이번 변경은 신규 audit action·에러 코드를 도입하지 않아 해당 규약과 접점 없음.

## 요약

이번 PR(`nodeoutput-allowlist`)의 spec 편집(§R17 불릿)은 실제 구현(`allowlistNodeOutputKeys`)과 정확히 대응하고, `egress-masking.md`·`spec-impl-evidence.md` 등 인접 정식 규약과의 경계 설정도 정합하다. CRITICAL 급 위반은 없다. 다만 두 가지 WARNING 급 evidence-trail/문서-정합 갭이 있다 — (1) 이 PR 의 핵심 산출물 파일이 정작 spec frontmatter `code:` 에 등재되지 않았고, (2) 이 PR 이 코드에서 처음으로 명문화한 "wire-only 4키" 사실이 그 상위 규약 문서(`node-output.md` Principle 0)의 닫힌 5필드+3예외 레지스트리에는 반영되지 않은 채 두 정식 문서가 서로 다른 그림을 그리고 있다. 두 항목 모두 빌드를 깨뜨리지 않고 즉각적 위험도 낮지만, 이전 리뷰 라운드가 예고했던 후속 조치가 이번에도 어느 트래커에도 잡히지 않아 유실 위험이 있다.

## 위험도

LOW
