# Rationale 연속성 검토 — spec/data-flow/ (impl-done)

## 검증 방법

`git diff origin/main --stat` 로 실제 변경 파일을 먼저 확정했다 — 프롬프트에 포함된 `spec/data-flow/`
번들(15개 도메인 + 0-overview) 중 실제로 diff 가 있는 파일은 `spec/data-flow/11-workflow.md`(§1.5
duplicate 계약 정정 + `## Rationale` 3개 절 신설)와 `spec/2-navigation/1-workflow-list.md`(더보기
메뉴·API 표 문구 보강) 두 곳뿐이다. 코드 변경은 `codebase/backend/src/modules/workflows/
workflows.service.ts`(`duplicate()` 재구현) / `workflows.controller.ts`(Swagger) /
`workflows.service.spec.ts` / `test/workflow-crud.e2e-spec.ts`.

본 changeset 은 같은 세션에서 이미 두 차례 Rationale 연속성 검토를 거쳤다 —
`review/consistency/2026/07/30/16_45_59/rationale_continuity.md`(`--spec`, INFO 2건, LOW) 와
`review/consistency/2026/07/30/17_03_26/rationale_continuity.md`(`--impl-prep`, INFO 1건, LOW).
본 라운드(`--impl-done`)에서는 (a) 두 차례가 남긴 INFO 가 최종 커밋 상태에 실제 반영됐는지 재대조,
(b) **구현 코드**(스펙 정정 시점엔 존재하지 않았던 `duplicate()` 실제 구현·테스트)가 새 Rationale 의
구체적 주장(REPEATABLE READ·llmConfigId 비주입·범위 제외)과 1:1 대응하는지, (c) `db496a3c2`/
`8ff4e8564` 등 인용 커밋을 `git show`/`git log -L` 로 독자적으로 재검증, (d) `spec/` 전체에서
"duplicate"/"복제" 키워드로 번들 밖 상충 Rationale 유무를 재검색했다.

## 발견사항

- **[INFO]** 새 Rationale 이 코드 수준 "신뢰 경계" 선례를 명시 인용하지 않음
  - target 위치: `spec/data-flow/11-workflow.md` `## Rationale` > "duplicate 가 export/import 를
    재사용하지 않는 이유"
  - 과거 결정 출처: `codebase/backend/src/modules/workflows/workflows.service.ts` 의
    `importWorkflow()`/`restoreVersion` 관련 기존 주석 — "Imported JSON is new data, never a
    historical snapshot of this workspace — the legacy-data escape that `restoreVersion` gets does
    not apply" (워크스페이스 내부의 이미 검증된 과거 데이터 vs 외부·신규 미신뢰 데이터를 구분해
    전자만 게이트를 생략하는 기존 코드 수준 원칙).
  - 상세: 신설 Rationale 은 "원본이 이미 그 게이트들을 통과해 저장된 데이터이므로 재검증이 불필요하다"
    는 동일한 논리를 독자적으로 재도출하지만, 정확히 같은 신뢰-경계 구분을 코드가 이미
    `restoreVersion`/`importWorkflow` 주석으로 선언해 두었다는 사실을 인용하지 않는다. 결론은
    일치하고 충돌은 전혀 없다 — 이 항목은 이전 `--spec` 라운드(`16_45_59`)에서 이미 검토되어 "INFO
    수준 보강 여지는 있으나 별도 발견사항으로 등재할 정도의 리스크는 아니다" 로 명시적으로 판단된
    사안이며, 본 라운드도 그 판단에 동의한다(신규 리스크 아님, 계보 추적성 보강 제안일 뿐).
  - 제안: (선택, 비차단) Rationale 문단에 "이는 `restoreVersion`/`importWorkflow` 가 이미 구분해 둔
    '워크스페이스 내부의 이미 검증된 데이터' vs '외부·신규 미신뢰 데이터' 경계의 세 번째 적용" 한
    문장을 추가하면 코드-스펙 간 원칙 계보가 더 명확해진다.

## 확인됨 (발견사항 아님 — impl-done 단계 독자 재검증 결과)

- **철회 대상 문구의 출처 재확인**: `spec/data-flow/11-workflow.md` 의 옛 "**nodes/edges 는 복제하지
  않는다**" 는 `git show db496a3c2 -- spec/data-flow/11-workflow.md` 로 대조한 결과 그 커밋에서
  신규 추가(`+`)된 라인이며, 그 커밋의 diff 안에 duplicate 를 정당화하는 trade-off `## Rationale`
  서술은 존재하지 않는다(`git show db496a3c2 | grep -n "메타.*만"` 결과 §1.5 표 항목 1건뿐, 인접
  Rationale 문단 없음). target 이 "제품 결정이 아니라 감사 시점 drift 동기화 산출물" 이라 주장하는
  핵심 전제는 사실과 일치 — criterion 3("결정의 무근거 번복") 에 해당하지 않는다.
- **구현 이력 재확인**: `WorkflowsService.duplicate()` 는 `plan/in-progress/
  workflow-duplicate-nodes-edges.md` 가 인용한 `git log -L 216,233:...workflows.service.ts` 근거와
  일치 — 초기 골격 커밋 `8ff4e8564` 이후 이번 changeset 전까지 실제로 수정된 적이 없다.
- **counter-reference 3건 정확도**: `NAV-WF-04`(`spec/2-navigation/_product-overview.md:51`,
  "워크플로우 생성/복제/삭제 기능", 필수 ✅), 옛 workflow-list §2.6 "워크플로우 복사본 생성" 문구,
  `spec/3-workflow-editor/3-execution.md` R-2.2("workflows 의 duplicate 선례와 동일한 '복제 후
  자기 소유' 패턴") 모두 실측 확인. 특히 R-2.2 인용은 이전 `--impl-prep` 라운드가 지적한 섹션 라벨
  오류("§7"→"§2.2 / R-2.2")가 현재 커밋 텍스트에 이미 정정되어 있음을 확인했다(`../3-workflow-editor/
  3-execution.md#r-22-테스트-데이터셋-저장--권한소유-모델-2026-06-14` 앵커, "소유권 패턴의 선례일 뿐
  노드 내용 복사를 직접 진술하지는 않는다" 는 스코프 한정 문구도 그대로 존재).
  `spec/2-navigation/1-workflow-list.md` 자체 checklist 에도 "Rationale 인용 §7 → §2.2 / R-2.2 앵커
  정정(I1)" 이 완료로 기록돼 있어 plan 서술과도 일치한다.
  1차(`16_45_59`) 라운드가 지적한 "`## Rationale` 전체(기각한 대안 포함) 이관" INFO 도 현재
  `spec/data-flow/11-workflow.md` 에 "기각한 대안 — spec 을 코드에 맞춰 '메타만 복제' 로 하향 확정"
  및 "기각한 대안 — 복제본에도 Manual Trigger 를 자동 생성" 두 항목이 실제로 존재해 반영이
  확인된다.
  결과적으로 이전 두 라운드가 남긴 INFO 전건(2+1건)이 impl-done 시점 커밋 상태에 모두 반영됐다.
- **불변식 정합**: "복제본에도 Manual Trigger 를 자동 생성" 기각은 같은 문서 §1.1 의 기존 "Manual
  Trigger 정확히 1개(누락/중복 시 400)" 불변식과 정확히 부합한다 — criterion 2("합의된 원칙 위반")
  미해당, 기존 invariant 를 근거로 대안을 기각한 정공법.
- **구현-Rationale 1:1 대응 (impl-prep 단계엔 검증 불가능했던 부분)**: 신설 Rationale 의 각 구체적
  주장을 실제 `codebase/backend/src/modules/workflows/workflows.service.ts` 코드와 대조했다.
  - "동시 편집 read skew 차단" → `this.dataSource.transaction('REPEATABLE READ', ...)` 로 구현됨
    (코드 리뷰 WARNING #1 로 지적된 뒤 커밋 `a7ab2750a` 로 조치 완료, `executions.service.ts` 의
    기존 REPEATABLE READ 선례를 실제로 `git show`/`grep` 대조해 동일 패턴임을 확인).
  - "AI 노드 `llmConfigId` 는 원본 값을 그대로 유지(기본 LLM 미주입)" → `config: { ...node.config }`
    로 전체 config 를 얕은 복사하며 `llmConfigId` 별도 처리 없음. 대응 unit 테스트에 "원본이
    의도적으로 비워둔 `llmConfigId` — 복제가 기본 LLM 을 주입하면 안 된다" 단언이 실제로 존재
    (`workflows.service.spec.ts` `duplicate` describe).
  - "복제 범위 밖: 버전 이력·트리거·테스트 데이터셋" → `duplicate()` 는 `WorkflowVersionsService`나
    `TriggerRepository`/`WorkflowTestDataset` 리포지토리를 아예 주입받지 않아 구조적으로 건드릴
    표면이 없다. e2e 케이스가 복제 후 `workflow_version` row 0건을 단언해 이 범위 제외를 실증한다.
  - code review SUMMARY(`review/code/2026/07/30/17_54_27/SUMMARY.md`)와 RESOLUTION 모두 "spec 관련
    항목·SPEC-DRIFT 없음" 으로 결론지어, 구현 단계에서 spec Rationale 과 충돌하는 임의 변형이
    도입되지 않았음을 별도로 확인했다.
- **audit_log 갭과의 무관성**: `spec/data-flow/1-audit.md` §1.1 은 "`workflow.*` 액션은 audit_log
  기록 미구현(workflows 모듈에 `AuditLogsService` import 없음)" 을 기존에 이미 알려진 커버리지
  갭으로 명시하고 있다. `duplicate()` 가 audit_log 를 기록하지 않는 것은 이 changeset 이 새로
  만들거나 악화시킨 문제가 아니라 pre-existing 상태이며, target 의 Rationale 범위(§1.5 duplicate
  계약)가 이를 다룰 의무도 없다.
- **다른 도메인 Rationale 과의 충돌 없음**: `spec/2-navigation/1-workflow-list.md` 자체 `## Rationale`
  4개 항목(공유 워크플로우 정의·import permissive config·폴더 계층 무결성·태그 필터 하향),
  `spec/conventions/cross-node-warning-rules.md`(그래프 경고는 저장 시점 평가 — duplicate 는
  이미 유효했던 그래프를 구조 변경 없이 복사하므로 재평가 불필요와 상충하지 않음), `spec/1-data-model.md`
  의 Rationale 어느 것도 이번 변경과 충돌하지 않는다. `spec/` 전체 "duplicate"/"복제" grep 재검색
  결과 번들 밖에 숨은 상충 Rationale 은 발견되지 않았다.

## 요약

target(`spec/data-flow/11-workflow.md` §1.5 + 신설 `## Rationale` 3개 절, `spec/2-navigation/
1-workflow-list.md`)은 Rationale 연속성 관점에서 모범 사례로 평가된다. 뒤집는 대상 문구("nodes/edges
는 복제하지 않는다")가 합의된 trade-off 결정이 아니라 `db496a3c2`(전수 감사) 시점 drift-sync
부산물이었다는 target 의 핵심 전제를 `git show`/`git log -L` 로 독자 재검증해 사실과 일치함을
확인했고, 뒤집기에는 새 `## Rationale` 3개 절과 명시적 "기각한 대안" 2건(Manual Trigger 자동생성 —
기존 §1.1 불변식으로 기각, spec 하향 확정 — counter-reference 악화로 기각)이 함께 붙어 있어 criterion
3("결정의 무근거 번복")을 정확히 피한다. impl-prep 단계엔 존재하지 않았던 실제 구현 코드
(`WorkflowsService.duplicate()`, REPEATABLE READ 트랜잭션·llmConfigId 비주입·버전/트리거/데이터셋
비접근)와 테스트를 대조한 결과 Rationale 의 모든 구체적 주장이 코드·테스트와 1:1 대응했다. 이번
세션 내 이전 두 라운드(`--spec`, `--impl-prep`)가 남긴 INFO 3건(기각한 대안 spec 이관 누락, R-2.2
인용 라벨 오류, 소유권 패턴 스코프 한정)은 현재 커밋 상태에서 모두 반영이 확인됐다. 다른 도메인
spec 의 Rationale·invariant(§1.1 Manual Trigger 유일성, cross-node-warning-rules, audit_log
`workflow.*` 커버리지 갭 등) 어느 것과도 충돌하지 않는다. 유일한 신규 발견은 INFO 1건(코드 수준
"신뢰 경계" 선례 미인용) 으로, 이미 이전 라운드에서 비차단 판단이 내려진 사안에 대한 선택적 보강
제안이다. 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 결정 번복, 암묵적 invariant 우회 중 어느
것도 발견되지 않았다.

## 위험도

NONE
