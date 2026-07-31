# Rationale 연속성 검토 — spec/data-flow/

## 검토 범위 확인 (선행 사실관계)

- 검토 모드: `--impl-done`, target=`spec/data-flow/`, diff-base=`origin/main`.
- 실제 `git diff origin/main...HEAD` 확인 결과, 이번 세션(브랜치 `claude/review-info-followups`,
  merge-base `40026ad5c`)의 변경분은 **spec 파일을 전혀 건드리지 않는다**. 변경된 파일은:
  - `codebase/backend/src/modules/workflows/workflows.service.ts` (변수명 `nodeEntities`/`edgeEntities`
    → `nodeRows`/`edgeRows` 통일, `edge.condition` 얕은 복사 방어)
  - `codebase/backend/src/modules/workflows/workflows.controller.ts` (Swagger description 줄바꿈
    포맷팅 — 문자열 내용은 byte-identical)
  - `codebase/backend/src/modules/workflows/workflows.service.spec.ts` (테스트 2건 추가)
  - `plan/in-progress/review-info-followups.md` (본 작업의 plan — `spec_impact: none` 명시)
- 즉 이번 diff 는 이미 병합된 `#1033`(워크플로우 복제 결함 수정 — 캔버스 전체 복제)의 코드 리뷰
  보류 INFO 10건에 대한 후속 정리이며, plan 이 스스로 "동작 계약 변경 없음" 을 선언하고 실제 diff 도
  이를 뒷받침한다.
- 따라서 본 검토는 (a) 이 diff 가 `spec/data-flow` 의 기존 Rationale 과 충돌하는지, (b) prompt 에
  target 으로 첨부된 `spec/data-flow/*.md` 현재 상태 자체가 교차 참조된 다른 spec 의 Rationale 과
  충돌·번복·기각된 대안 재도입을 일으키는지 두 축으로 수행했다.

## 검증 방법

1. prompt 에 포함된 `spec/data-flow/0-overview.md`, `11-workflow.md`, `3-execution.md`, `1-audit.md`,
   `10-triggers.md`, `12-workspace.md`, `13-agent-memory.md`, `14-chat-channel.md` 전문과 각 `## Rationale`
   을 전수 통독.
2. 교차 인용된 `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`,
   `spec/2-navigation/4-integration.md`, `spec/2-navigation/5-knowledge-base.md`,
   `spec/2-navigation/8-marketplace.md`, `spec/2-navigation/9-user-profile.md`,
   `spec/3-workflow-editor/0-canvas.md`, `spec/3-workflow-editor/3-execution.md` 의 Rationale 발췌와
   대조.
3. 가장 근본적인 검증 대상인 "duplicate 는 캔버스 전체를 복제한다 (메타-only 였던 서술의 철회)"
   Rationale 이 인용하는 세 근거(`NAV-WF-04`, `2-navigation/1-workflow-list.md §2.6`,
   `3-workflow-editor/3-execution.md R-2.2`)를 **실제 워킹트리 파일을 직접 Read/Grep** 해 인용이
   조작·과장되지 않았는지 확인 (과거 사례: 근거 없는 "기각된 대안" 서술은 checker 가 반드시 잡아야
   할 결함 클래스).
4. `spec/` 전체에서 "메타만 복제" 류의 옛 서술 잔존 여부 grep.
5. prompt 밖(컨텍스트 예산 초과로 생략된) `spec/data-flow/9-observability.md` 등 일부 파일을 직접
   Read 해 "번복" 표기가 있는 항목의 서술 완결성 샘플 확인.

## 발견사항

- **[INFO]** "Manual Trigger" 용어가 노드-타입과 Trigger 엔티티를 동시에 가리켜 문단 내 오독 위험
  - target 위치: `spec/data-flow/11-workflow.md` `## Rationale` → "복제가 버전 이력·트리거·데이터셋을 승계하지 않는 이유"
  - 과거 결정 출처: 동일 문서 §1.1 "Manual Trigger 정확히 1개" DTO 검증 (누락/중복 시 400)
  - 상세: 같은 문단에서 "`trigger`(webhook/schedule)는 승계 시 ... 두 워크플로우를 동시에 발화" (Trigger
    **엔티티** 를 가리킴, §1.5 "복제 범위 밖" 목록과 동일 개념) 라고 말한 바로 다음 문장에서 "기각한
    대안 — **복제본에도 Manual Trigger 를 자동 생성**(`create()` 처럼)" 이 등장한다. 후자의 "Manual
    Trigger" 는 §1.1 sequence 의 "Manual Trigger 시작 노드 자동 생성" 을 가리키는 **노드 타입**이며
    Trigger 엔티티가 아니다. 두 문장을 빠르게 훑으면 "Manual Trigger 도 (webhook/schedule 처럼) 복제
    범위 밖"으로 오독할 소지가 있으나, 실제 사실관계는 정반대(Manual Trigger 노드는 캔버스 전체 복제에
    포함되어 함께 복사됨)이고 추론 자체는 정확하다 — 표현의 중의성 문제일 뿐 결정의 충돌은 아니다.
  - 제안: 해당 문장을 "복제본에도 Manual Trigger **노드**를 `create()` 처럼 자동 생성" 으로 노드임을
    명시하거나, "(Trigger 엔티티가 아니라 §1.1 의 시작 노드)" 각주를 추가해 동일 문단 내 두 "trigger"
    용례의 지시 대상을 분리.

- **[INFO]** (확인 결과 — 조치 불요, 참고용) "duplicate 캔버스 전체 복제" Rationale 의 인용 근거는
  실제 파일과 정합함을 직접 대조 확인
  - target 위치: `spec/data-flow/11-workflow.md` `## Rationale` → "duplicate 는 캔버스 전체를 복제한다"
  - 상세: 해당 Rationale 이 인용하는 `NAV-WF-04`(`spec/2-navigation/_product-overview.md:51`),
    `spec/2-navigation/1-workflow-list.md §2.6`("복제 | 워크플로우 복사본 생성 — 노드·엣지를 포함한
    캔버스 전체가 복사되고 ..."), `spec/3-workflow-editor/3-execution.md R-2.2`("workflows 의 duplicate
    선례와 동일한 '복제 후 자기 소유' 패턴")를 워킹트리에서 직접 Read/Grep 로 재확인한 결과 인용이
    정확했다 — 지어낸 "기각된 대안"·"counter-reference" 없음. `1-workflow-list.md §2.6` 도 이미 "캔버스
    전체" 서술로 갱신되어 있어 두 문서 간 drift 도 없다.
  - 이 항목은 결함이 아니라, 이번 검토에서 가장 의심스러워 보였던 지점(과거 유사 사례에서 "기각된
    대안"이 실제 이력 없이 서술된 적 있었음)을 실측으로 배제했다는 감사 기록 목적의 기재.

- 그 외 아래 항목들은 검토했으나 결함 없음으로 판정:
  - `spec/data-flow/11-workflow.md §1.5` duplicate 행의 "config 는 원본 그대로(defaults 재적용·LLM
    주입 없음)" ↔ `spec/2-navigation/1-workflow-list.md` Rationale #2 "`settings`(admission-gate)는
    permissive 예외에서 제외, strict DTO 로 hard-fail" — 상충 없음. duplicate 는 사용자 입력이 아니라
    **이미 검증을 통과한 원본 DB 값**을 그대로 복사하는 경로라 재검증 게이트 자체가 적용 대상이 아님
    (동일 문서의 "duplicate 가 export/import 를 재사용하지 않는 이유" Rationale 이 이 원칙을 직접
    명시: "원본은 이미 그 게이트들을 통과해 저장된 데이터이므로 재검증 자체가 불필요").
  - `duplicate()` 가 `workflow_version` 스냅샷을 만들지 않고 `current_version=1` 로만 시작하는 것은
    `create()` (신규 생성) 와 동일한 기존 동작이며 duplicate 가 새로 도입한 차이가 아니다 — Rationale
    위반 아님.
  - `spec/data-flow/9-observability.md` "liveness / readiness probe 분리 (기존 결정 번복)" — "구
    결정(폐기)" / "신 결정" 을 명시적으로 구분해 서술한 정상적인 번복 패턴 확인 (이번 diff 와는 무관한
    도메인).
  - `spec/data-flow/3-execution.md` "폐기된 서술 (본 문서 이전 버전)" 4개 항목이 본문(§1.2 execution_node_log
    완료-시점 기록, §3.2 node_execution 이 `running` 으로 직행 INSERT)에 재도입되지 않았음을 대조 확인.
  - `spec/1-data-model.md` "WorkflowVersion.snapshot 구성 서술 정정 (2026-07-31)" 이 `data-flow/11-workflow.md`
    의 "버전 스냅샷 = JSONB" Rationale 을 SoT 로 정확히 위임 — 두 문서 간 순환 인용이 아니라 단방향
    위임으로 일관.

## 요약

이번 세션의 실제 코드 diff(`workflows.service.ts`/`.controller.ts`/`.spec.ts`)는 spec 을 전혀 변경하지
않았고, plan(`review-info-followups.md`)이 `spec_impact: none` 을 선언한 대로 변수명 통일·`edge.condition`
참조 격리·Swagger 포맷팅 등 순수 내부 정합성 보강에 그쳐 target 인 `spec/data-flow/` 의 어떤 Rationale
과도 충돌하지 않는다. target 문서 자체(8개 전문 + 교차 참조 9개 문서의 Rationale 발췌)를 전수 통독한
결과, 이미 기각된 대안이 이유 없이 재도입되거나 합의된 설계 원칙이 무시된 사례는 발견되지 않았다.
특히 이 도메인의 최근 최대 변경점인 "duplicate 는 이제 캔버스 전체를 복제한다"(과거 "메타-only" 서술의
명시적 철회)는 기각한 대안·근거·counter-reference 를 모두 갖춘 모범적인 Rationale 갱신이며, 인용된
외부 근거(NAV-WF-04, 워크플로우 목록 §2.6, 실행 §2.2/R-2.2)를 직접 대조해 조작·과장이 없음을 확인했다.
유일한 지적 사항은 워딩 수준의 INFO 하나(동일 문단 내 "Manual Trigger 노드"와 "Trigger 엔티티" 용어
중의성)로, 결정의 충돌이 아니라 가독성 보완 제안이다. 다만 `spec/data-flow` 16개 문서 중 8개(external-interaction,
auth, file-storage, integration, knowledge-base, llm-usage, notifications, observability)는 prompt
컨텍스트 예산 초과로 본문이 전달되지 않아 이번 통독 대상에서 제외됐다는 커버리지 한계는 남는다(단,
이번 diff 는 그 도메인들과 무관).

## 위험도

NONE
