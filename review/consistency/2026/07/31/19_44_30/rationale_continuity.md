# Rationale 연속성 검토 — spec/data-flow/ (재검토, 19_20_50 이후)

## 선행 사실관계 — 실제 diff와 이전 라운드 확인

- 검토 모드: `--impl-done`, target=`spec/data-flow/`, diff-base=`origin/main`.
- `git diff origin/main...HEAD --stat` 로 실제 변경분을 재확인한 결과, 이번 라운드(19_44_30)까지 누적된
  `spec/` 변경은 여전히 **`spec/data-flow/12-workspace.md` 단 1개 파일(20줄, +14/-6)** 뿐이다. 그 외
  변경은 `codebase/backend/.../workflows.{service,controller}.ts`(#1033 후속 리뷰 조치, INFO 10건 처분)와
  `plan/**`·`review/**` 산출물이다.
- 본 target 프롬프트에는 (이전 라운드와 마찬가지로) `## 구현 변경 사항` diff 블록이 포함되지 않았으므로,
  실제 diff 는 `git -C <워크트리> diff origin/main...HEAD` 로 직접 재확인했다.
- 직전 라운드(`review/consistency/2026/07/31/19_20_50/rationale_continuity.md`, 이 checker의 이전
  실행분)는 위험도 NONE 을 보고했고, 같은 라운드의 `cross_spec` checker 가 **CRITICAL 1건**
  (`spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 viewer "실행" 셀이 `✓ (수동 실행 only)` 로
  잘못 기재 — 코드(`@Roles('editor')`, `ROLE_HIERARCHY`)·`1-auth.md §3.2`·`9-user-profile.md §4.2`
  전부와 불일치)를 냈다. 이번 라운드가 검토하는 diff 는 그 CRITICAL 을 해소한 조치
  (커밋 `9fa06cd4c docs(spec): impl-done 게이트 Critical 조치 — RBAC 요약표 viewer 실행 권한 정정`)다.
  본 라운드의 임무는 **그 수정 자체가 새로운 Rationale 연속성 문제를 만들지 않았는지** 검증하는 것.

## 검증 방법

1. `git diff origin/main...HEAD -- spec/data-flow/12-workspace.md` 로 실제 변경 라인을 전문 확인.
2. 변경이 인용한 코드 근거를 워킹트리에서 직접 재확인:
   - `codebase/backend/src/modules/workflows/workflows.controller.ts` — `POST :id/execute` 의
     `@Roles('editor')` 데코레이터.
   - `codebase/backend/src/common/guards/roles.guard.ts` — `ROLE_HIERARCHY`
     (`viewer:1 < editor:2`).
   - `spec/5-system/1-auth.md §3.2` — `Workflow 실행` 행(owner/admin/editor=✅, viewer=—),
     `Integration (Org)`/`Model Config` 행 및 "Model Config Editor CRUD 근거" 각주.
3. `spec/` 전체에서 옛 표현("수동 실행 only", 병합 컬럼 "LLM Config / Integration") 잔존 여부 grep —
   정정 후 dangling 사본이 남았는지 확인.
4. target 8개 파일(`0-overview`·`1-audit`·`3-execution`·`10-triggers`·`11-workflow`·`12-workspace`·
   `13-agent-memory`·`14-chat-channel`) 및 교차 인용된 9개 spec 문서(`0-overview.md`·`1-data-model.md`·
   `2-navigation/{1-workflow-list,4-integration,5-knowledge-base,8-marketplace,9-user-profile}.md`·
   `3-workflow-editor/{0-canvas,3-execution}.md`)의 `## Rationale` 를 재통독해 diff 와 무관한 잔여
   충돌이 없는지 재확인 (이전 라운드와 동일 범위, drift 여부 재확인 목적).
5. 이전 라운드가 가장 의심했던 "duplicate 는 캔버스 전체를 복제한다" Rationale 의 인용 근거
   (`NAV-WF-04`, `1-workflow-list.md §2.6`, `3-execution.md R-2.2`)를 이번에도 독립적으로
   Read/Grep 재대조 — 두 라운드가 같은 결론에 수렴하는지 확인(교차검증).
6. `buildSnapshot()`(`workflows.service.ts`) 실제 반환 필드를 읽어 `1-data-model.md` "WorkflowVersion.snapshot
   구성 서술 정정 (2026-07-31)" 의 근거(설정 제외)가 코드와 일치하는지 재확인.

## 발견사항

- **[INFO]** RBAC 뷰어 실행 권한 정정 주석이 `## Rationale` 절이 아닌 §3.2 인라인에 위치
  - target 위치: `spec/data-flow/12-workspace.md:250-256` (§3.2 RBAC 매트릭스 표 직후 blockquote)
  - 과거 결정 출처: 없음(신규 결정이 아니라 오기재 정정) — 다만 같은 폴더의 `1-audit.md` §Rationale
    "'모든 도메인 service 가 호출하는 cross-cutting concern' 서술 폐기", `3-execution.md` §Rationale
    "폐기된 서술 (본 문서 이전 버전)" 4항목은 동일 성격("과거 서술이 실제와 달랐다, 왜 정정하는가")의
    correction 을 모두 `## Rationale` 절 하위에 배치하는 문서 내 확립된 패턴이다.
  - 상세: 이번 커밋은 "이 셀이 오랫동안 `✓ (수동 실행 only)` 로 잘못 적혀 있었다" 는 correction 근거를
    §3.2 표 바로 아래 blockquote 로 인라인 배치했다. 내용 자체(코드 인용·타 문서 대조)는 정확하고
    상충도 없으나, CLAUDE.md 의 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 원칙 및 같은
    문서군의 "폐기된 서술" correction 관례에 비추면 `## Rationale` 절에도 미러링하는 편이 문서 내
    일관성이 더 높다. 단, `12-workspace.md` 자체의 `## Overview`(§상태 2026-07-07 구현완료 note)도
    유사한 인라인 정정/상태 주석 선례가 있어 이 배치가 규약을 "위반"한다고까지는 볼 수 없다 —
    스타일 수준 제안.
  - 제안: `## Rationale` 절 말미에 "RBAC 요약표 viewer 실행 권한 정정 (2026-07-31)" 소절을 추가해
    §3.2 인라인 note 를 1줄로 요약·링크하거나, 현행 유지 시 조치 불요(비차단).

- **[INFO]** (확인 완료 — 조치 불요) RBAC 정정이 인용한 코드·교차문서 근거를 재확인, 정확함
  - target 위치: `spec/data-flow/12-workspace.md:239-256` (§3.2 표 + 신설 note 2건)
  - 과거 결정 출처: `spec/5-system/1-auth.md §3.2`("정식 권한 매트릭스") — line 370 `Workflow 실행 | ✅ | ✅ | ✅ | —`,
    line 379 `Integration (Org) | CRUD | CRUD | R | R`, line 384 `Model Config | CRUD | CRUD | CRUD | R`,
    line 402 "Model Config Editor CRUD 근거" 각주.
  - 상세: `POST /api/workflows/:id/execute` 는 실측 결과 `@Roles('editor')`이고
    `ROLE_HIERARCHY = {viewer:1, editor:2, admin:3, owner:4}` 이므로 "viewer(1) < editor(2)" 서술이
    정확하다. 신설된 "LLM Config"/"Integration" 분리 컬럼 값(editor: ✓/view, viewer: view/view) 도
    `1-auth.md` 의 `Model Config`(Editor=CRUD)·`Integration (Org)`(Editor=R) 행과 정확히 대응한다.
    `spec/` 전체에서 옛 "수동 실행 only" 문구·옛 병합 컬럼 헤더의 dangling 잔존은 없음(grep 확인).
    이전 라운드(19_20_50, `cross_spec`)가 지목한 CRITICAL 을 정확히, 과대·과소 수정 없이 해소했다.
  - 이 항목은 결함이 아니라 감사 기록 목적의 확인성 기재.

- **[INFO]** (carry-over, 미해결·비차단) "Manual Trigger" 용어가 노드-타입과 Trigger 엔티티를 동시에
  가리켜 문단 내 오독 위험 — 직전 라운드(19_20_50)에서 이미 보고, 이번 diff 가 해당 파일을 건드리지
  않아 그대로 잔존
  - target 위치: `spec/data-flow/11-workflow.md` `## Rationale` → "복제가 버전 이력·트리거·데이터셋을
    승계하지 않는 이유"
  - 상세: 같은 문단에서 "`trigger`(webhook/schedule)는 승계 시 ... 두 워크플로우를 동시에 발화"
    (Trigger **엔티티** 지칭, §1.5 "복제 범위 밖"과 동일 개념) 라고 말한 바로 다음 문장에서 "기각한
    대안 — **복제본에도 Manual Trigger 를 자동 생성**(`create()` 처럼)" 이 등장한다. 후자는 §1.1 의
    "Manual Trigger 시작 노드 자동 생성" 을 가리키는 **노드 타입**이며 Trigger 엔티티가 아니다.
    빠르게 훑으면 "Manual Trigger 도 webhook/schedule 처럼 복제 범위 밖"으로 오독할 소지가 있으나,
    실제 사실관계는 정반대(Manual Trigger 노드는 캔버스 전체 복제에 포함되어 함께 복사됨)이고 추론
    자체는 정확 — 결정 충돌이 아니라 가독성 문제.
  - 제안: "복제본에도 Manual Trigger **노드**를 `create()` 처럼 자동 생성" 으로 명시하거나 각주로
    두 용례를 구분. 이번 diff 범위 밖이라 이번 라운드에서 조치 강제 대상 아님.

- 재확인 결과 결함 없음(직전 라운드와 동일 결론, 이번 라운드에서 재검증):
  - `duplicate 는 캔버스 전체를 복제한다 (메타-only 였던 서술의 철회)` Rationale
    (`spec/data-flow/11-workflow.md`)이 인용하는 `NAV-WF-04`(`_product-overview.md:51`),
    `1-workflow-list.md §2.6`("노드·엣지를 포함한 **캔버스 전체**가 복사되고"),
    `3-workflow-editor/3-execution.md R-2.2`("workflows 의 duplicate 선례와 동일한 '복제 후 자기
    소유' 패턴")를 재차 Read/Grep 대조 — 인용 정확, 조작·과장 없음. `WorkflowsService.duplicate()`
    실제 코드(`workflows.service.ts:228-335`)도 node/edge 를 UUID 재매핑해 전량 INSERT 함을 확인해
    Rationale 의 "이제 캔버스 전체를 복제한다" 주장과 정확히 일치. 인용된 커�밋(`db496a3c2`,
    `8ff4e8564`)도 실존·날짜 정합 확인.
  - `1-data-model.md` "WorkflowVersion.snapshot 구성 서술 정정 (2026-07-31)" — `buildSnapshot()`
    (`workflows.service.ts:618-649`) 실제 반환 필드가 `{name, description, nodes, edges}`(settings
    미포함)임을 재확인, `data-flow/11-workflow.md` Rationale "버전 스냅샷 = JSONB"(settings 의도적
    제외)을 SoT 로 정확히 위임하는 단방향 인용 유지.
  - 그 외 target 8개 파일·교차 인용 9개 문서의 `## Rationale` 전체에서 기각된 대안의 무단 재도입,
    합의 원칙 위반, 근거 없는 결정 번복, invariant 우회는 발견되지 않음(WAITING_FOR_INPUT 불가침,
    persistent 전략 전용 파이프라인, 자동 비활성화 금지(CCH-SE-01), personal 워크스페이스 유일성,
    token-claim SoT 등 명시된 invariant 모두 본문에서 일관되게 준수).

## 요약

이번 라운드가 검토한 실제 diff는 `spec/data-flow/12-workspace.md` §3.2 RBAC 요약표 1건이며, 이는
직전 라운드에서 `cross_spec` checker 가 지목한 CRITICAL(viewer 실행 권한 오기재)을 해소하는 순수
사실 정정이다. 코드(`@Roles('editor')`, `ROLE_HIERARCHY`)와 이미 정확했던 "정식" 매트릭스
(`1-auth.md §3.2`) 양쪽을 직접 대조한 결과 정정 내용은 완전히 일치하며, 병합돼 있던 "LLM Config /
Integration" 컬럼을 분리한 부수 조치도 `1-auth.md` 의 리소스별 값과 정확히 대응한다. 이 정정은 설계
결정의 번복이 아니라 스펙 표기 결함의 시정이므로 "기각된 대안 재도입"·"합의 원칙 위반"·"invariant
우회" 어느 기준에도 해당하지 않으며, 근거를 인라인 note 로 충분히 남겼다(다만 `## Rationale` 절이
아닌 §3.2 본문 인라인에 위치한 점은 이 문서군의 "폐기된 서술" 배치 관례와 비교하면 미러링 여지가
있는 스타일 수준 제안). target 문서 8개 전문과 교차 인용 9개 문서의 Rationale 을 재통독한 결과 이번
diff 와 무관한 잔여 충돌도 없다. 유일하게 남아있는 항목은 직전 라운드에서 이미 보고한 저우선순위
용어 중의성(11-workflow.md, "Manual Trigger" 노드 vs 엔티티) 뿐이며 이번 diff 범위 밖이라 그대로
이월한다. `spec/data-flow/` 16개 중 8개(external-interaction·auth·file-storage·integration·
knowledge-base·llm-usage·notifications·observability)는 이번에도 컨텍스트 예산 초과로 본문이
전달되지 않아 통독 대상에서 제외됐으나, 이번 diff 는 그 도메인들과 무관함을 재확인했다.

## 위험도

NONE
