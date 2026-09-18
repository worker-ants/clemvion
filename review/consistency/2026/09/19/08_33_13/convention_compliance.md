# 정식 규약 준수 검토 — `spec/3-workflow-editor/`

검토 모드: `--impl-prep` (scope=`spec/3-workflow-editor/`). 대상 문서: `_product-overview.md`,
`0-canvas.md`, `1-node-common.md`, `2-edge.md`, `3-execution.md`, `4-ai-assistant.md`,
`5-version-history.md`. 대조 규약: `spec/conventions/**` 전체(cafe24/makeshop API 카탈로그 계열
제외 — 도메인이 겹치지 않아 해당 없음을 확인).

## 검토 범위에 대한 참고

이번 작업(`plan/in-progress/entity-schema-declaration-drift.md`)은 엔티티의 인덱스·제약 선언
정정(코드 전용, `spec_impact: none`)이라 `spec/3-workflow-editor/` 문서 자체를 변경하지 않는다.
따라서 이 검토는 신규 편집분에 대한 위반이 아니라, 이번 impl-prep 게이트가 요구하는 **현재
spec 텍스트의 정식 규약 준수 상태**에 대한 standing 점검이다. `4-ai-assistant.md` 는 직전 커밋
(`ff530fc8a`, §13 i18n 표 정정)으로 최근 갱신됐으나 워킹트리에는 그 외 미커밋 변경이 없다
(`git diff --stat HEAD` 결과 없음).

## 발견사항

### [INFO] `5-version-history.md` 의 워크플로 id path param 표기가 문서 내에서 갈린다

- target 위치: `spec/3-workflow-editor/5-version-history.md` §6 (`POST /workflows/:id/versions/:versionId/restore`) vs §7.1/§7.2 (`GET /workflows/:wfId/versions`, `GET /workflows/:wfId/versions/:versionId`) vs §7.3 (`POST /workflows/:id/versions/:versionId/restore`)
- 위반 규약: 명시적인 단일 조항은 없음 — `spec/conventions/**` 안에 REST path parameter 식별자 표기(`:id` vs `:wfId` 등)를 못박은 규약 파일이 없어 "직접 위반"으로 단정할 근거는 없다. 다만 이 checker 의 관점 1(API endpoint 명명 일치)에 해당하는 관찰이라 기록한다.
- 상세: 같은 문서 §6 은 `:id`, §7.1~§7.2 는 `:wfId` 를 같은 리소스(워크플로우)에 쓴다. 인접 스펙 `3-execution.md` §9 는 동일 리소스에 일관되게 `:id` 를 쓴다(`POST /api/workflows/:id/execute` 등). 규약으로 강제되진 않지만 같은 문서 내부·인접 문서 간 표기가 갈리는 것은 API 문서 규약(swagger.md `@ApiParam`) 의 취지("경로 UUID 파라미터는 일관 적용", §5-4)와 결이 어긋난다.
- 제안: 실제 컨트롤러의 `@Param()` 이름을 확인해 `:id`/`:wfId` 중 하나로 스펙 표기를 통일하거나, spec/conventions 에 path param 명명 규칙이 없다면 이번 발견을 계기로 별도 규약 신설 여부를 project-planner 가 판단. 이번 PR(엔티티 인덱스 정정)의 스코프는 아니므로 즉시 수정을 요구하지는 않음.

### [INFO] `5-version-history.md` 에 `## Rationale` 섹션이 없고 설계 근거가 본문에 산재

- target 위치: `spec/3-workflow-editor/5-version-history.md` 전체 (다른 6개 파일은 모두 `## Rationale` 보유 — `0-canvas.md:772`, `1-node-common.md:347`, `2-edge.md:244`, `3-execution.md:741`, `4-ai-assistant.md:812`)
- 위반 규약: CLAUDE.md `## 정보 저장 위치` 및 `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — "각 spec 문서는 3섹션(Overview/본문/Rationale)", "결정 배경·근거는 `## Rationale`"
- 상세: "권장"이라 강제는 아니지만, 본문 §7.1 에 "`snapshot` 필드는 응답에서 의도적으로 제외된다(목록 over-fetch 방지, m-3)" 같은 설계 근거가 이미 산문으로 섞여 있다. `m-3` 같은 내부 식별자가 각주 없이 본문에 등장해, Rationale 섹션이 있었다면 자연스럽게 담겼을 내용이 본문에 흩어진 형태다. 같은 영역의 나머지 5개 파일은 전부 별도 Rationale 섹션을 갖고 있어 `5-version-history.md` 만 구조가 다르다.
- 제안: 필수 정정 사항은 아님. 이 문서를 다음에 편집할 때 `## Rationale` 섹션을 신설해 `m-3` 근거 등 산재된 설계 배경을 이관하는 정도로 충분. 이번 엔티티 인덱스 정정 PR 이 이 파일을 건드리지 않으므로 지금 고칠 필요는 없음.

### [INFO] AI Assistant 편집 도구 인자 케이싱 혼재 — 이미 자체 문서화된 기술 부채

- target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §4.3 도입부 (라인 320 부근, "인자 네이밍 관례 (혼재 — 실제 tool schema 기준)")
- 위반 규약: 해당 없음 — `spec/conventions/**` 전체를 확인했으나 LLM tool-call 인자(JSON Schema key) 의 케이싱을 규정하는 문서가 없다(`migrations.md`의 snake_case 는 SQL 파일명 전용, `error-codes.md`의 UPPER_SNAKE 는 에러 코드 전용). 따라서 이 혼재는 어떤 conventions 문서도 위반하지 않는다.
- 상세: `add_edge` 는 `source_id`/`source_port`/`target_id`/`target_port` (snake_case) 를, 나머지 편집 도구(`add_node`/`update_node`/`remove_node`/`remove_edge`)와 `planStepId`/`planStepIds` 는 camelCase 를 쓴다. spec 본문이 이를 "혼재"라고 명시하고 실제 `tool-definitions.ts` 스키마를 그대로 따른다고 밝혀, 사실을 숨기지 않고 투명하게 기록한 상태다.
- 제안: 규약 위반은 아니므로 이번 PR 범위에서 조치 불필요. 다만 이런 스펙 전반의 명명 규칙(REST DTO 는 swagger.md §1-7 이 있는데, LLM tool schema 케이싱엔 대응 규약이 없음)이 필요하다고 판단되면 project-planner 가 별도로 `spec/conventions/` 신설을 검토할 수 있음 — 이번 검토의 결론은 "규약 부재"이지 "위반"이 아니다.

## 확인했으나 위반 없음 (양성 결과, 참고용)

- **frontmatter/`code:` 증거 규약** (`spec-impl-evidence.md`): 7개 파일 중 frontmatter 대상 6개(`_product-overview.md` 는 `_` prefix 로 면제 대상, §1 확인) 모두 `id`/`status`/`code:` 보유. `code:` glob 이 가리키는 경로·디렉토리를 전수 확인 — 전부 실존. `pending_plans:`(`0-canvas.md`, `2-edge.md`) 항목도 `plan/in-progress/` 및 `plan/complete/` 에 실존해 `spec-pending-plan-existence.test.ts` 조건 충족. `status: partial` 두 파일 모두 pending_plans 가 전부 `complete/` 로 이동한 상태가 아니므로 `implemented` 미승격은 정상.
- **에러 코드 명명** (`error-codes.md`): `4-ai-assistant.md` §7 의 `ASSISTANT_*` 8종은 전부 도메인 prefix + `UPPER_SNAKE_CASE` 로 §1 원칙 준수. `retryable`/`retryAfterSec` invariant(§3.2.1, node-output.md) 도 `3-execution.md` 전 사용처에서 `retryable===true` 조건부로만 노출해 위반 없음.
- **리뷰 인용 표기** (`review-citations.md`): target 7개 파일 전수에서 `hh_mm_ss` 형태의 세션 인용 자체가 없음 — 적용 대상 없음(위반도 아니고 준수 사례도 아님).
- **동적 포트/시스템 포트 예약어** (`node-output.md` Principle 6): `1-node-common.md`/`2-edge.md` 가 언급하는 `out`/`error`/`user_ended`/`max_turns`/`done` 등이 규약의 예약어 목록과 일치.
- **Swagger DTO 명명** (`swagger.md` §1-7, §5-1): target 문서가 언급하는 DTO 는 `WorkflowVersionListItemDto`·`PaginatedResponseDto` 두 건뿐이며 `Update` 접두 오남용 등 위반 패턴 없음.
- **i18n 키·해요체 문체** (`i18n-userguide.md` Principle 6): `4-ai-assistant.md` §13 의 `assistant.*` 키 39개 점검 — 문장형 값은 해요체(`~해요`/`~했어요`/`~세요`) 준수, 금지어(`엣지`→`연결선` 등) 회피(`assistant.edgeAdded`="연결선 추가") 확인. 예시 프롬프트 칩(`assistant.exampleAddCancelFlow` 등)의 "~해줘" 는 UI가 사용자에게 말하는 문장이 아니라 사용자가 보낼 문구의 예시라 Principle 6 적용 대상으로 보기 어려움 — 위반으로 잡지 않음.
- **5-version-history.md §8 데이터 모델 표**: 실제 `WorkflowVersion` 엔티티(`workflow-version.entity.ts`)와 컬럼·FK·onDelete 까지 대조해 정합 확인(이번 entity-index-drift 정정 대상 8곳에도 포함되지 않음).

## 요약

`spec/3-workflow-editor/` 대상 7개 문서를 `spec/conventions/**` 전 항목과 대조한 결과 CRITICAL·
WARNING 급 정식 규약 위반은 발견되지 않았다. frontmatter 증거(`code:`/`pending_plans:`) 규약,
에러 코드 명명, 포트 예약어, DTO 명명, i18n 문체 규약은 전부 준수 상태다. 발견된 세 건은 모두
INFO 수준으로 — (1) `5-version-history.md` 내부의 워크플로 id path param 표기 불일치, (2) 같은
파일의 `## Rationale` 섹션 부재(권장 사항, 강제 아님), (3) AI Assistant 편집 도구의 인자 케이싱
혼재(스펙이 이미 투명하게 명시했고 대응 규약 자체가 없음) — 이며 셋 다 이번 엔티티 인덱스/제약
정정 작업의 스코프 밖이라 즉시 조치를 요구하지 않는다. `spec_impact: none` 인 이번 작업의
impl-prep 게이트를 차단할 사유는 없다.

## 위험도

LOW
