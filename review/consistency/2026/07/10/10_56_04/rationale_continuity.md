# Rationale 연속성 검토 — #886 docs-only 변경

## 대상
- `spec/5-system/4-execution-engine.md` §1.3 `interaction.data` 표 `form_submitted` 행 — `via?: 'ai_render'` + `ai_agent(render_form)` 추가.
- `spec/conventions/execution-context.md` §1 신설 "원칙 5 — `variables.__*` 시스템 예약 네임스페이스" (강제 갭 고지 포함, 수정 반영본).

## 조사 방법
- 두 target 의 실제 diff (`git diff origin/main`) 확인.
- `spec/conventions/node-output.md` §4.5 (선언된 SoT), `spec/4-nodes/3-ai/1-ai-agent.md` §6.1.d.ii/§6.2/§12.4~12.6, `spec/5-system/4-execution-engine.md` §6.1/§6.2 를 대조.
- `node-handler.interface.ts`, `execution-engine.service.ts` (`filterUserVariables`) 코드 확인.
- `spec/4-nodes/1-logic/4-variable-declaration.md`, `5-variable-modification.md`, `1-logic/0-common.md` 에서 `__` prefix 관련 기존 검증/Rationale 유무 확인 (없음 확인).
- `spec/4-nodes/6-presentation/1-carousel.md` 의 `__item_` schema-level reject 선례 대조.
- 전체 spec 에서 "충돌하지 않는다" / "double-underscore" / `__workspaceId` 관련 기존 Rationale 전수 grep.

## 발견사항

### 1. execution-engine.md §1.3 `form_submitted` 행 갱신 — 순수 SoT 동기화, Rationale 충돌 없음

- **[INFO]** node-output.md §4.5 신규 변경 없음, execution-engine.md 만 그 기존 SoT 를 뒤늦게 반영
  - target 위치: `spec/5-system/4-execution-engine.md` §1.3 (line 185)
  - 과거 결정 출처: `spec/conventions/node-output.md` §4.5 (변경 없음 — 이미 `via?: 'ai_render'` 보유), `spec/4-nodes/3-ai/1-ai-agent.md` §6.1.d.ii / §6.2 (변경 없음 — `data.via: 'ai_render'` sentinel 은 기존 결정)
  - 상세: `git diff origin/main -- spec/conventions/node-output.md` 는 무변경을 확인했다. 즉 이번 변경은 execution-engine.md 가 이미 확정된 타 문서의 SoT 를 뒤늦게 미러링한 것으로, 기각된 대안 재도입도 결정 번복도 아니다. AI Agent §6.2 step c 의 "form 의 경우 `data.via: 'ai_render'` sentinel 박힘" 서술과 정확히 일치하며 모순 없음.
  - 제안: 조치 불요. (참고: `spec/4-nodes/6-presentation/0-common.md:549` 와 `spec/conventions/conversation-thread.md:95` 는 여전히 `via` 를 언급하지 않고 `{ [fieldName]: value }` 로만 서술하지만, 이는 optional 필드 생략일 뿐 모순이 아니라 Rationale 연속성 범위 밖.)

### 2. execution-context.md 원칙 5 — 기존 미문서화 동작의 신규 공식화, 반박 없음

- **[INFO]** 원칙 5 신설은 기존 코드/타 spec 이 이미 전제하던 `__` 네임스페이스 관행을 문서화한 것으로, 기각된 대안 재도입이나 원칙 위반이 아님
  - target 위치: `spec/conventions/execution-context.md` §1 원칙 5 (line 63-70)
  - 과거 결정 출처: 없음(신설) — 대조 문서는 `node-handler.interface.ts` JSDoc, `spec/5-system/4-execution-engine.md` §6.1/§6.2, `spec/5-system/13-replay-rerun.md` §7.2, `spec/1-data-model.md` §dry_run
  - 상세: `__workspaceId`/`__workspaceTimezone`/`__dryRun`(`__workspaceName` 포함 4종)은 이미 `node-handler.interface.ts`·execution-engine.md §6.1/§6.2·replay-rerun.md §7.2 에 코드/spec 양쪽으로 선재하던 값들이다. 원칙 5 는 이를 사후적으로 "예약 네임스페이스" 규약으로 명명한 것이며, 이 값들의 존재나 park-filter 동작(`filterUserVariables` — `!key.startsWith('__')`)을 바꾸지 않는다. `filterUserVariables` 코드와 §6.1 표 서술(`variables.*` 행)도 정확히 일치. 기존 스펙 전체에서 "`__` 는 충돌하지 않는다" 류의 강한 보증을 명시한 선행 Rationale 은 발견되지 않았다(전수 grep 결과, "충돌하지 않는다" 용례는 모두 무관 주제). 즉 새 원칙 5 가 되돌리는 과거 결정이 없다.
  - **"강제 갭" 고지 정확성 검증**: `spec/4-nodes/1-logic/4-variable-declaration.md`/`5-variable-modification.md` 는 변수명(`variables[i].name` / `modifications[i].variable`)에 대해 타입 검증만 하고 `__` prefix 거부 로직이 없음을 코드 레퍼런스(`validateVariableDeclarationConfig`/`validateVariableModificationConfig`)와 spec 본문에서 확인했다 — "노드 레벨에서 강제되지 않는다" 서술은 사실과 일치한다. 선례로 인용한 carousel `button.id` 의 `__item_` schema-level reject(`carousel.schema.ts §validateCarouselItemButtons`, `1-carousel.md:368,450`)도 실재하는 정확한 대조 사례다.
  - 제안: 조치 불요. 검증이 정확함을 확인.

### 3. 원칙 5 에 대응하는 `## Rationale` 절 미러 항목 부재 (문서 내부 컨벤션 불일치)

- **[INFO]** 본 문서의 기존 관행(원칙 2/3/4 는 각각 `## Rationale` 절에 "왜 ~ 인가" 대응 항목 보유)과 달리 원칙 5 는 하단 `## Rationale` 절에 대응 항목이 없음
  - target 위치: `spec/conventions/execution-context.md` §1 원칙 5 (line 63-70) vs `## Rationale` 절 (line 92 이하)
  - 과거 결정 출처: 같은 문서 내 원칙 2(`왜 ParallelBranchContext 분리인가`), 원칙 3(`왜 "No sprawl" 를 신규 필드에만 적용하는가`), 원칙 4(`왜 _contextKey 를 엔진 내부 필드로 두는가`) — 모두 본문 원칙 서술과 별개로 `## Rationale` 절에 미러 단락을 둔다.
  - 상세: 이는 Rationale *충돌*이 아니라 문서 내부 구조 관행의 국소적 이탈이다. 원칙 5 본문 자체가 이미 "왜"(예약 네임스페이스로 두는 이유, top-level `_`-prefix 와의 구분, 영속 정책, 강제 갭)를 상당히 포함하고 있어 실질적 근거 누락은 아니지만, 향후 "누가 원칙 5 를 왜 도입했는가"를 `## Rationale` 절만 훑어 파악하려는 독자에게는 공백으로 보일 수 있다.
  - 제안: (선택) `## Rationale` 절 말미에 "**왜 원칙 5(`variables.__*` 예약 네임스페이스) 를 신설했는가**" 단락을 추가해 문서 내부 패턴과 정합시킬 것을 권장. 필수 아님 — Critical/Warning 아님.

## 요약

두 target 변경 모두 **신규 설계 결정이 아니라 이미 코드/타 spec 문서에 확정돼 있던 동작을 뒤늦게 문서화·동기화**하는 성격이다. execution-engine.md §1.3 의 `via?: 'ai_render'` 추가는 이미 `node-output.md §4.5`(무변경)와 `1-ai-agent.md §6.1/§6.2`(무변경)에 존재하던 사실을 미러링한 것으로 어떤 Rationale 도 반박하지 않는다. execution-context.md 원칙 5 는 `__workspaceId`/`__workspaceName`/`__workspaceTimezone`/`__dryRun` 4종의 기존 코드 관행(node-handler.interface.ts JSDoc)을 공식 규약으로 승격하면서, "규약일 뿐 강제되지 않는다"는 솔직한 갭 고지까지 포함해 코드 현실(변수 노드에 `__` 거부 로직 없음)과 정확히 일치한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 사례는 발견되지 않았다. 유일한 소소한 지적은 문서 내부 서술 관행(원칙별 `## Rationale` 미러 단락) 의 국소적 누락으로, 이는 근거 부재가 아니라 구조적 완결성 문제이며 INFO 등급이다.

## 위험도

NONE
