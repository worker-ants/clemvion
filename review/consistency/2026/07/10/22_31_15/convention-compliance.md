# 정식 규약 준수 검토 — llm_usage_log 문서 정합화 draft

대상: `/private/tmp/claude-501/-Volumes-project-private-clemvion--claude-worktrees-llm-usage-doc-alignment-01d7a4/9b5ca835-aa0d-4284-9bf6-3602bfcb6c7a/scratchpad/spec-draft.md`
검토 기준: `spec/conventions/**`, `.claude/skills/project-planner/SKILL.md`, CLAUDE.md

## 발견사항

### [Warning] `### 2.16.1 LlmUsageLog` 를 §2.16 Rationale **뒤**에 두는 배치는 본 문서 heading 관례상 선례 없음

- target 위치: draft "변경 2" — "위치: §2.16 ModelConfig 의 `#### Rationale (ModelConfig 통합)` 뒤, `### 2.17 AuthConfig` 앞."
- 위반 규약: 명시적 규약 문서는 없음 — `spec/1-data-model.md` 자체의 **일관된 heading 배치 관례**(자매 sub-entity 전 사례)에 대한 drift.
- 상세: `spec/1-data-model.md` 안의 모든 부모→자식(sub-table) heading 쌍을 전수 확인했다.
  - `### 2.10 Integration` → `### 2.10.1 IntegrationUsageLog` (`spec/1-data-model.md:283`→`:312`, 필드 표 직후 즉시)
  - `### 2.12 Document` → `### 2.12.1 DocumentChunk`/`2.12.2 Entity`/`2.12.3 Relation`/`2.12.4 ChunkEntity` (`:364`→`:388,406,427,445`)
  - `### 2.13 Execution` → `### 2.13.1 ExecutionNodeLog` (`:457`→`:493`, 여러 narrative blockquote 뒤에 오지만 **entity 자체 Rationale 은 없음**)
  - `### 2.18 AuditLog` → `### 2.18.1 RefreshToken`/`2.18.2 LoginHistory` (`:656`→`:672,691`)
  - 위 4쌍 전부 "부모 필드 표(+보조 설명) 직후, 부모 자신의 로컬 Rationale 이전" 위치에 자식 sub-entity heading 이 온다.
  - 유일하게 로컬 `Rationale` 서브섹션을 가진 부모는 `### 2.17 AuthConfig` (`2.17.1`→`2.17.2`→`2.17.3 Rationale`, `:607`~`:656`) 인데, 여기서는 `Rationale` 이 **그 엔티티 자신의 마지막(terminal) 서브섹션**이고, 그 뒤에 오는 것은 다른 번호의 엔티티(`### 2.18 AuditLog`)이지 같은 `2.17.x` 자식이 아니다.
  - 즉 "부모의 로컬 Rationale **뒤**에 그 부모의 `.1` 자식 sub-entity 를 넣는" 조합은 문서 전체에 선례가 **전무**하다. `### 2.16 ModelConfig` 는 이 문서에서 처음으로 "로컬 Rationale 보유 + 자식 sub-entity 필요"가 동시에 발생하는 케이스다.
- 제안: `### 2.16.1 LlmUsageLog` 는 `spec/1-data-model.md:600` "**참조 관계 (kind 별)**: ..." 문단 **직후**, `#### Rationale (ModelConfig 통합)` (`:602`) **이전**에 삽입 — 기존 4개 선례(2.10.1/2.12.x/2.13.1/2.18.x)와 동일하게 "필드 표 직후, 부모 로컬 Rationale 이전"을 유지한다. 이 경우 `#### Rationale (ModelConfig 통합)` 은 여전히 §2.16 섹션의 terminal 서브섹션으로 남아, `### 2.17 AuthConfig` 의 `2.17.3 Rationale` terminal 패턴과도 정합한다.
- 참고: heading **레벨**(H3 `### 2.16.1`) 자체는 자매 sub-entity 전부(H3)와 일치해 옳다 — 문제는 레벨이 아니라 **Rationale 대비 상대 위치**뿐이다.

### [Info] `7-llm-usage.md` cross-ref 링크 스타일(anchor 없음)은 draft 가 기존 로컬 관례를 정확히 따름 — 위반 아님

- target 위치: draft "변경 1" — `spec/data-flow/13-agent-memory.md:231`, `spec/data-flow/6-knowledge-base.md:348` 의 `[`llm-usage.md`](./7-llm-usage.md)` 링크 유지.
- 근거: `spec/data-flow/7-llm-usage.md` 를 가리키는 기존 6개 인용 전부가 anchor 없는 bare-file 링크다 — `spec/data-flow/6-knowledge-base.md:280,283,348`, `spec/data-flow/13-agent-memory.md:188,231`, `spec/data-flow/3-execution.md:308`, `spec/data-flow/0-overview.md:131`, `spec/data-flow/11-workflow.md:169,215,242`. `grep -rn "llm-usage.md#" spec/` 결과 0건 — anchor 인용 선례가 저장소 전체에 전무함을 확인.
- 비교: `spec/1-data-model.md:600` 서술의 "#216-modelconfig" 류 anchor(`#210-integration`, `#213-execution`, `#221-webauthncredential`, `#2101-integrationusagelog` 등)는 **다른 문서(`1-data-model.md`, `2-navigation/*.md`, `5-system/*.md`)가 특정 엔티티 섹션을 정밀 인용할 때** 쓰는 별개의 지역 관례이며, "LLM Usage | cross-ref" 표 행이 `7-llm-usage.md` 자체를 가리킬 때는 애초에 이 anchor 관례를 쓴 적이 없다. 두 관례는 인용 대상 문서·용도가 달라 draft 가 후자(bare-file)를 그대로 이어가는 것은 **로컬 선례와의 일관성 유지**이지 규약 위반이 아니다.
- 부가: `spec/5-system/4-execution-engine.md:713` 은 `([data-flow/7-llm-usage §1.3](../data-flow/7-llm-usage.md))` 형태로 — 링크 **label** 에 절 번호(§1.3)를 넣되 href 는 bare-file 을 유지하는 절충 패턴을 이미 쓰고 있다. draft 가 본문 괄호 `(§1.3)` 로 절 번호를 별도 병기하는 방식도 "URL anchor 없이 절 번호만 텍스트로 표기"라는 동일 원칙 위에 있어 이질적이지 않다. (선호 시 다듬을 수 있는 미세한 스타일 차이 — 링크 label 안에 `§1.3` 을 접어넣는 편이 engine 문서 선례와 더 타이트하게 일치하나, 필수 아님.)

### [Info] `spec/1-data-model.md` 는 spec-impl-evidence 가드 대상에서 명시적으로 제외 — `code:` 갱신 의무 없음

- target 위치: draft "변경 2" 전체 (신규 `### 2.16.1 LlmUsageLog` 서브섹션 추가), 및 draft "영향 없음 선언".
- 근거: `spec/conventions/spec-impl-evidence.md:51` — "basename `1-data-model.md` · `6-brand.md` (단순 overview 성격) — `EXCLUDE_BASENAMES` 에 등재." 실제 가드 구현(`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:56-58,79`)에서도 `EXCLUDE_BASENAMES` 셋에 `"1-data-model.md"` 가 포함되어 `spec-code-paths.test.ts`/`spec-status-lifecycle.test.ts` 등 frontmatter-evidence family(§4) 전체가 이 파일을 검증하지 않는다.
- 상세: `spec/1-data-model.md` 는 그럼에도 자체적으로 frontmatter(`id: data-model`, `status: implemented`, `code: [codebase/backend/src/modules/**/entities/*.entity.ts, codebase/backend/migrations/V*.sql]`, `spec/1-data-model.md:1-7`)를 보유하지만, 이는 가드가 검증하지 않는 **장식적 필드**다. 설령 가드가 적용된다 해도 기존 glob `codebase/backend/src/modules/**/entities/*.entity.ts` 는 이미 `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts` (확인됨, `find` 결과 존재)에 매치하므로 신규 `code:` 항목 추가는 불필요하다. 마이그레이션 인용(V014/V018/V088)도 `codebase/backend/migrations/V014__llm_usage_logs.sql`, `V018__llm_usage_thinking_tokens.sql`, `V088__model_config_rename_kind.sql` 실존을 확인했다 — glob `V*.sql` 매치.
- 결론: docs-only 정합화가 `status`/`code:`/`pending_plans` 갱신을 유발하지 않는다는 draft "영향 없음 선언"은 규약상 정확하다. 별도 조치 불필요.

### [Info] CHANGELOG "Unreleased" 항목 사후 정정 — 명문 규약 없으나 직접 선례 존재(허용)

- target 위치: draft "변경 3" — `CHANGELOG.md:25` (`## Unreleased — 멀티턴 resume 턴 llm_usage_log attribution ...` 항목, `CHANGELOG.md:21`) 본문 정정.
- 위반 규약: 없음. `spec/conventions/**` 어디에도 CHANGELOG 작성/수정 전용 규약 문서가 없다 (`grep -rln CHANGELOG spec/ .claude/`는 코드 리뷰 라우팅 분류(`.claude/skills/code-review-agents/README.md:69-70`, `.claude/agents/documentation-reviewer.md:21`)만 매치 — "documentation 관점에서 리뷰 대상"이라는 정도이며 사후수정 허용/금지 규정은 없음). 이 사실 자체를 명시한다.
- 근거(직접 선례): `git show 26bd1fe1 -- CHANGELOG.md` (PR #839, "feat(notifications): team_invite channel in_app 하향") 커밋 메시지 — "docs(notifications): ai-review 후속 — CHANGELOG team_invite 채널 정정 ... CHANGELOG PR3 Unreleased 항목이 team_invite=`both` 로 남아 in_app 하향과 불일치하던 것을 정정." 이 커밋은 **이전에 이미 머지된 PR(#838)의 CHANGELOG 문단을 그 자리에서 in-place 수정**했다 (`diff` 확인: 같은 `## Unreleased —` 헤딩 아래 1번 항목 본문 교체, 신규 항목 추가가 아님).
- 상세: 이 저장소 CHANGELOG 는 git tag 기반 릴리스 컷이 전혀 없고(`git tag` 결과 0건) 모든 항목이 영구히 `## Unreleased —` 헤딩을 유지한다. draft 대상 항목(`CHANGELOG.md:21`)도 현재 `## Unreleased` 상태다. 따라서 "머지된 PR 의 CHANGELOG 항목을 이후 PR 에서 in-place 정정"은 **본 저장소에서 실제로 반복 사용된 패턴**이며, draft 의 변경 3(Text Classifier 단발 명시)도 동일한 유형(과거 기술이 사실과 어긋난 것을 후속 조사가 정정)이다.
- 제안: 그대로 진행 가능. 다만 이런 사후정정이 반복되는 만큼, 원한다면 "CHANGELOG Unreleased 항목은 릴리스 컷 전까지 in-place 정정 가능"이라는 한 줄을 `spec/conventions/` 또는 CLAUDE.md 에 명문화하는 편이 향후 검토자의 판단 부담을 줄인다(규약 갱신 제안, 필수 아님).

### [Info] §2.16.1 신설 시 `> 관련 문서:` 라인 권장 — 강제 아니나 자매 사례 다수가 채택

- target 위치: draft "변경 2" 필드 목록 — heading 직후 관련 문서 라인 언급 없음.
- 상세: `### 2.10.1 IntegrationUsageLog`(`spec/1-data-model.md:314`), `### 2.12.1 DocumentChunk`(`:390`), `### 2.12.2 Entity`(`:408`) 는 heading 직후 `> 관련 문서:` 인용 라인을 둔다. 반면 `### 2.13.1 ExecutionNodeLog`, `### 2.18.1 RefreshToken`/`2.18.2 LoginHistory` 는 이 라인 없이 바로 설명 문단/표로 들어간다 — 즉 **필수는 아니고 선택적 관례**다.
- draft 자신이 "SoT: `spec/data-flow/7-llm-usage.md §1.3`"·"채움 현황 SoT 는 data-flow §1.3 (중복 금지)" 라고 명시한 만큼, `### 2.16.1 LlmUsageLog` heading 바로 아래에 `> 관련 문서: [Spec LLM Usage](../data-flow/7-llm-usage.md)` 류의 라인을 추가하면 §2.10.1 선례와 일치하고 "중복 금지" 의도가 링크로 실체화된다.
- 제안: 필수 아님(정합 위반 아님) — 포함 시 §2.10.1 패턴과 더 일치. INFO 로 기록.

### [Info] 신규 인덱스 3행·ERD 트리 1행 추가 위치 — 선례와 정합

- target 위치: draft "변경 2" 동반 사항 (§1 ERD 트리 `LlmUsageLog (1:N)` 삽입, §3 인덱스 표 3행 추가).
- 확인: ERD 트리(`spec/1-data-model.md:15-49`)에서 `IntegrationUsageLog` 가 `Integration` 바로 다음 줄에 Workspace 자식으로 나열된 것과 동일하게, draft 는 `ModelConfig` 다음 줄에 `LlmUsageLog` 를 넣겠다고 명시 — 선례와 정합. §3 인덱스 전략 표(`:826-877`)도 entity 번호 순서를 엄격히 따르지 않는 flat 목록이라(`IntegrationUsageLog` 행이 `Integration` 관련 행 사이 임의 위치, `Notification` 이 맨 끝 등) 위치 제약이 약하다 — 위반 소지 없음.

## 요약

docs-only 정합화 draft 는 명명·표 포맷·frontmatter 의무·CHANGELOG 처리 관점에서 대체로 저장소 정식 규약과 선례를 정확히 따른다 — 특히 `7-llm-usage.md` 링크 스타일(anchor 미사용)은 기존 6개 인용과 완전히 일치하고, `1-data-model.md` 가 spec-impl-evidence 가드 제외 대상(`EXCLUDE_BASENAMES`)이라 frontmatter 갱신 의무가 없다는 draft 의 "영향 없음" 판단도 근거가 확인된다. CHANGELOG "Unreleased" 항목의 사후 정정은 명문 규약은 없지만 동일 유형의 직접 선례(PR #839, commit 26bd1fe1)가 존재해 허용 범위로 판단된다. 유일한 실질 지적은 신설 `### 2.16.1 LlmUsageLog` 의 배치 — 문서 전체에서 "부모 엔티티의 로컬 Rationale **뒤**에 자식 sub-entity heading 을 두는" 조합은 선례가 없고, 4개 기존 자매 사례(§2.10.1/§2.12.x/§2.13.1/§2.18.x) 모두 "필드 표 직후, 로컬 Rationale 이전" 위치를 취한다 — 이는 build 가드가 강제하는 invariant 는 아니므로 WARNING 등급으로, `#### Rationale (ModelConfig 통합)` 이전(§2.16 "참조 관계" 문단 직후)으로 옮길 것을 제안한다. 금지 항목(1회성 문서 신규 생성 등) 위반은 발견되지 않았다.

## 위험도

LOW

STATUS: DONE
