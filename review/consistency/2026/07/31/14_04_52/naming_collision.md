# 신규 식별자 충돌 검토 — spec-workflow-version-snapshot-drift

## 검토 대상

`plan/in-progress/spec-workflow-version-snapshot-drift.md` — `spec/1-data-model.md` §2.15
`WorkflowVersion.snapshot` 행의 서술 정정 (AS-IS/TO-BE 단일 표 셀 교체, `spec_impact: [spec/1-data-model.md]`).

## 분석

target 이 실제로 도입하는 변경은 다음 한 줄뿐이다.

- AS-IS: `워크플로우 전체 스냅샷 (nodes, edges, settings)`
- TO-BE: `워크플로우 캔버스 스냅샷 — name, description, nodes, edges. workflow.settings 는 포함하지 않는다 (...) SoT 는 data-flow §1.1`

이 변경은 **신규 식별자를 하나도 도입하지 않는다** — 기존에 이미 존재하는 필드(`WorkflowVersion.snapshot`)의 설명 문구만 코드/타 spec 과 일치하도록 정정한다. 6 개 점검 관점을 순서대로 확인했다.

1. **요구사항 ID 충돌** — target 은 어떤 요구사항 ID(`NAV-*`/`ND-*`/`ED-*` 등)도 신설하지 않는다. `spec/1-data-model.md` 는 애초에 요구사항 ID 체계를 쓰지 않는 데이터 모델 문서다. 해당 없음.
2. **엔티티/타입명 충돌** — `WorkflowVersion` 엔티티, `snapshot` 필드 모두 기존에 이미 존재(§2.15). TO-BE 가 나열하는 `name`/`description`/`nodes`/`edges` 는 새 타입명이 아니라 기존 JSONB 내부 키 이름이며, 다음 기존 소스들과 **정확히 일치**한다.
   - `spec/data-flow/11-workflow.md:39` sequence diagram: `snapshot=JSONB(name+description+nodes+edges)`
   - `spec/data-flow/11-workflow.md:52,235`: `workflow.settings` 는 포함되지 않는다는 동일 문구
   - `spec/3-workflow-editor/5-version-history.md:110-138` `interface VersionSnapshot { name; description; nodes: [...]; edges: [...] }` (코드 레벨 스키마 정의, `settings` 없음)
   - `codebase/backend/src/modules/workflows/workflows.service.ts:622-653` `buildSnapshot()` 실제 반환 키
   즉 TO-BE 가 쓰는 표기는 **이미 3곳(코드·data-flow·version-history)에서 합의된 기존 식별자**를 data-model 에도 동일하게 반영하는 것이라 충돌이 아니라 오히려 기존 산재 정의를 수렴시킨다.
   - 참고로 `workflow.settings` 자체는 `spec/1-data-model.md:121` (Workflow 엔티티, JSONB) 에 이미 정의된 기존 필드이며, target 은 이를 새로 정의하지 않고 "포함되지 않는다" 는 배제 진술로만 참조한다. AS-IS 문구가 `snapshot` 설명 안에 `settings` 라는 단어를 넣어 "snapshot 내부에도 settings 라는 하위 키가 있다" 는 오독을 유발했던 것이 오히려 기존의 잠재적 용어 혼선이었고, target 은 이를 **해소**하는 방향이다(신규 충돌 도입 아님).
3. **API endpoint 충돌** — target 은 어떤 endpoint 도 신설·변경하지 않는다. 표 셀 텍스트 변경뿐이며 API 표면 언급이 없다. 해당 없음.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트 이름 신설 없음. 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/설정키 없음. `workflow.settings` 는 기존 필드 참조일 뿐 신규 키가 아니다. 해당 없음.
6. **파일 경로 충돌** — target 은 기존 파일 `spec/1-data-model.md` 만 수정한다(신규 spec 파일 생성 없음). TO-BE 안의 링크 `./data-flow/11-workflow.md` 도 이미 존재하는 파일을 가리키는 상대 경로이며, fragment(`#anchor`) 없이 파일 단위 참조라 앵커 불일치 위험도 없다. 해당 없음.

## 부가 확인 (참고용, collision 아님)

- 동일 drift 를 미리 인지하고 있던 `plan/in-progress/workflow-duplicate-nodes-edges.md` §3(L170-173, 아직 `plan/complete/` 로 미이동)의 "후속 항목" 체크리스트 항목과 target 의 작업 범위가 정확히 일치 — 두 plan 이 같은 식별자를 겨냥한 **중복 작업**처럼 보일 수 있으나, target 자체의 "발견 경위" 절이 이 승계 관계를 이미 명시하고 있어 충돌이 아니라 의도된 인계다.
- `spec/3-workflow-editor/5-version-history.md` §7.2 의 `VersionSnapshot` TS interface 가 필드 구성의 가장 상세한 정의를 갖고 있으나, target 은 SoT 를 `data-flow/11-workflow.md` 로 지정한다. 이는 "구성 근거(왜 settings 제외인가)" 의 SoT 지정이라 "정확한 필드 스키마" SoT(version-history §7.2, `name`/`description`/`nodes`/`edges` 로 이미 target 의 TO-BE 와 100% 일치)와 서로 다른 관심사를 가리키는 것으로 판단되며 모순이 아니다.

## 발견사항

없음. target 은 신규 식별자를 도입하지 않으며, 사용하는 모든 표기(`workflow.settings`, `name`/`description`/`nodes`/`edges`)가 이미 코드·data-flow·version-history 세 곳에서 합의된 기존 식별자와 정확히 일치한다.

## 요약

target 문서는 `WorkflowVersion.snapshot` 필드에 대한 기존 표 셀 서술 1건을 코드·타 spec 과 일치하도록 정정하는 spec-only 경량 변경이며, 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 어느 범주에서도 신규 식별자를 도입하지 않는다. TO-BE 문구가 사용하는 모든 용어는 이미 `spec/data-flow/11-workflow.md`, `spec/3-workflow-editor/5-version-history.md`, 실제 코드(`workflows.service.ts`)에서 합의된 기존 식별자와 정확히 일치하며, 오히려 AS-IS 문구가 갖고 있던 "snapshot 안에도 settings 가 있다"는 기존 용어 혼선을 해소하는 방향이다. 신규 식별자 충돌 관점에서 문제가 될 소지가 없다.

## 위험도

NONE
