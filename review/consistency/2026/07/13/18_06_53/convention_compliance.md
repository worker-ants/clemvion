# 정식 규약 준수 검토 — spec/3-workflow-editor/ (--impl-prep)

대상: `spec/3-workflow-editor/0-canvas.md` · `1-node-common.md` · `2-edge.md` · `3-execution.md`
기준: `spec/conventions/**` (직접 파일시스템에서 재확인 — 아래 "검토 방법" 참조)

## 검토 방법 (중요 — 입력 payload 결함)

`prompt_file` 에 번들된 "정식 규약 모음(spec/conventions/)" 섹션은 `audit-actions.md` →
`cafe24-api-catalog/_overview.md` → `application.md` → `application/apps.md` 까지만 담기고
크기 한도로 잘려 있었다(`apps.md` 본문 중간에 `... (truncated due to size limit) ...`). 즉 이 세션의
prompt 페이로드에는 **`swagger.md`·`error-codes.md`·`node-output.md`·`cross-node-warning-rules.md`·
`execution-context.md`·`node-cancellation.md`·`interaction-type-registry.md`·`i18n-userguide.md`·
`migrations.md` 등 workflow-editor 리뷰에 실제로 쓰이는 규약 파일이 전혀 포함되지 않았다** — cafe24
API 카탈로그(무관 도메인)가 알파벳 순으로 먼저 덤프되며 예산을 소진한 탓이다.

이 사실만으로 판단했다면 "규약 없음 → 위반 없음" 식의 거짓 clean 판정이 나올 위험이 있었다(다른
세션의 disk-write gap 거짓 음성과 동형 실패 패턴). 본 리뷰는 이를 우회해 `.claude/worktrees/
edge-mid-insert-32edbe/spec/conventions/**` 를 직접 Read/Grep 하여 실제 규약 원문으로 대조했다.
**권고**: orchestrator 의 프롬프트 생성 스크립트가 `spec/conventions/**` 를 번들링할 때 알파벳 순
전량 덤프 대신 (a) target 영역과 관련도 높은 파일 우선 배치, 또는 (b) 용량 초과 시 목록만이라도
전체 나열(내용 생략)하도록 고쳐야 한다 — 그래야 sub-agent 가 결손을 인지하고 직접 보강할 수 있다.

---

## 발견사항

### [WARNING] convention_compliance 프롬프트 payload 의 `spec/conventions/**` 번들이 크기 한도로 조기 절단됨
- target 위치: N/A — 이 리뷰의 입력(`prompt_file`) 자체, target 문서 아님
- 위반 규약: 해당 없음 (harness 절차 이슈) — `.claude/docs/subagent-call-contract.md` §1 "prompt_file — 점검 관점 + 분석 대상이 결합된 markdown"의 완전성 전제가 깨짐
- 상세: `cafe24-api-catalog/**`(수십 개 리소스별 field-level 카탈로그, workflow-editor 와 무관)가 알파벳 순으로 먼저 나열되며 예산을 다 써서, 실제로 관련 있는 `swagger.md`/`error-codes.md`/`node-output.md`/`cross-node-warning-rules.md`/`interaction-type-registry.md`/`i18n-userguide.md` 등은 프롬프트에 전혀 도달하지 못했다.
- 제안: (1) 본 세션은 직접 파일시스템 Read 로 우회해 실제 규약 원문 대조를 완료함(아래 발견사항은 그 결과). (2) orchestrator 스크립트가 `spec/conventions/**` 번들 순서를 target 영역 관련도 기준으로 재정렬하거나, 크기 초과 시 최소한 파일 목록(제목만)을 전량 포함하도록 개선 권고.

### [INFO] `0-canvas.md` frontmatter `pending_plans`에 이미 완료된 plan 경로가 in-progress 항목과 함께 남아 있음
- target 위치: `spec/3-workflow-editor/0-canvas.md` frontmatter (`pending_plans:`)
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 정의 · §3 `status: partial` 규칙
- 상세: `pending_plans`가 `plan/in-progress/ai-agent-tool-connection-rewrite.md`(미완료)와 `plan/complete/spec-sync-canvas-gaps.md`(완료)를 동시에 나열한다. 가드(`spec-pending-plan-existence.test.ts`)는 `plan/complete/` 리터럴 경로도 그대로 실존 여부만 검사하므로 **기술적으로는 통과**하고, `status: partial`도 아직 한 항목이 in-progress라 규칙과 어긋나지 않는다. 다만 리포지토리 전체에서 `pending_plans`에 `plan/complete/` 항목을 직접 남긴 유일한 사례라(`grep` 결과 0-canvas.md 뿐), 다른 spec들의 관행(완료된 항목은 제거하거나 in-progress 표기만 유지)과 다르다.
- 제안: 위반은 아니므로 강제 조치 불요. 다만 `spec-sync-canvas-gaps.md`가 이미 완료됐다는 사실을 남기려는 의도라면 `pending_plans`보다 본문/Rationale의 각주로 옮기고 `pending_plans`는 실제로 남은 in-progress 항목만 유지하는 편이 §2.1 의미("미구현 surface를 책임지는 plan")에 더 부합.

### [INFO] 컨테이너 포트 색상 서술이 두 문서에 나뉘어 있어 오독 소지 (규약 위반 아님, 문서 명료성 참고)
- target 위치: `1-node-common.md` §1.2/§1.3 (`emit` 포트 = 보라) vs `2-edge.md` §3.1 (`body` 포트 기원 엣지 = 보라)
- 위반 규약: 해당 없음 — `spec/conventions/**`에 포트/엣지 색상을 규정하는 문서는 없음(canvas/edge/node-common 영역 자체 결정)
- 상세: 코드로 직접 대조함 — `custom-node.tsx`는 컨테이너의 **`emit` 입력 핸들**을 `bg-purple-400`으로 그리고, `edge-utils.ts`의 `resolvePortType`은 **`sourceHandle === 'body'`**(출력 포트)로 시작하는 **엣지 선**을 `container`(#a855f7) 타입으로 분류한다. 즉 1-node-common.md(포트 핸들 색)과 2-edge.md(엣지 선 색)는 서로 다른 시각 요소를 각각 정확히 서술하고 있어 **실제 모순은 아니다**. 다만 두 문서 모두 "컨테이너 포트=보라"라는 동일 표현을 쓰면서 대상(핸들 vs 엣지선, emit vs body)이 다르다는 점을 명시하지 않아, 향후 엣지 중간 삽입(§4, edge-mid-insert) 구현 시 "보라 = emit"과 "보라 = body 기원 엣지"를 혼동할 위험이 있다.
- 제안: 규약 위반이 아니므로 차단 사유 아님. §4 구현 착수 시 참고용으로, 2-edge.md §3.1 표의 "컨테이너 포트" 행 옆에 "(body 출력 기준 엣지 색상. emit 입력 핸들 자체의 보라색은 1-node-common.md §1.2 참조)" 정도의 상호 각주를 추가하면 명료해짐.

---

## 확인된 준수 사항 (참고 — 문제 없음)

- **에러 코드 명명**: `CONTAINER_INVALID_CHILD` / `CONTAINER_CYCLE` / `CONTAINER_MISSING_EMIT` / `CONTAINER_MULTIPLE_EMIT` (0-canvas.md §11.2.2) 모두 `UPPER_SNAKE_CASE` + 도메인 prefix(`CONTAINER_`)로 `error-codes.md` §1 원칙에 부합.
- **동적 포트 ID 네이밍**: Carousel/Table/Chart/Template의 `{button.id}` 직접 사용, `continue` 시스템 포트 예약어 사용은 `node-output.md` Principle 6 과 일치.
- **cross-node 경고 규칙**: 0-canvas.md §11.4 Rationale R-4("깊이 제한·배경 틴트 미도입 확정")와 `cross-node-warning-rules.md` §9("Loop/ForEach 중첩 깊이 정책 → 미도입 확정")가 상호 정합하게 갱신되어 있음.
- **interaction 표면 3값/4값 구분**: 3-execution.md §8.1의 `interactionType: form/buttons/ai_conversation`(3값)이 backend 내부 4값(`ai_form_render` 포함)을 다 열거하지 않는 것은 `interaction-type-registry.md` §1.1 이 명시적으로 "내부 관점 문서는 4값 전체를 열거하지 않아도 모순 아님"이라 규정한 예외에 정확히 해당 — 위반 아님.
- **frontmatter 스키마**: `id`/`status`/`code`/`pending_plans` 필드 형식, area 내 `id` 유일성(`canvas`/`edge`/`node-common`/`execution` 중복 없음), 4개 문서 모두 `## Rationale` 섹션 보유 — `spec-impl-evidence.md` 및 project-planner SKILL 의 3섹션 구성(다중 파일 영역이라 Overview 는 `_product-overview.md`에 위임)에 부합.
- **Swagger/DTO 패턴**: target 문서에 실제 TS DTO/컨트롤러 코드가 없어 `swagger.md`의 데코레이터 패턴 자체를 검증할 대상은 없음. 문서에서 언급하는 REST 엔드포인트(`POST /workflows/:id/save`, `GET /workflows/:id/graph-warnings` 등)는 설명 텍스트일 뿐이라 직접 위반 소지 없음.
- **node-cancellation / 실행 중단**: 3-execution.md §4 "Execution.status = cancelled"는 `node-cancellation.md` §5.1 의 상태 분류와 모순 없음.

---

## 요약

`spec/3-workflow-editor/`(0-canvas·1-node-common·2-edge·3-execution)는 `spec/conventions/**`(error-codes, node-output, cross-node-warning-rules, interaction-type-registry, swagger, node-cancellation, spec-impl-evidence 등)와 대조했을 때 **CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다**. 에러 코드 명명, 동적 포트 ID 규칙, cross-node 경고 규칙 상호참조, interaction-type 3값/4값 예외 규정 등 핵심 지점이 모두 정합하다. 다만 (1) 이 리뷰에 전달된 prompt payload 자체가 `spec/conventions/**`를 알파벳 순으로 번들링하다 크기 한도로 조기 절단되어 정작 관련 규약 파일들이 누락돼 있었던 절차적 결함을 발견했고(직접 파일시스템 대조로 우회 완료), (2) `0-canvas.md`의 `pending_plans`에 이미 완료된 plan 항목이 남아 있는 점과 (3) 컨테이너 포트 색상 서술이 `1-node-common.md`(emit 핸들)와 `2-edge.md`(body 기원 엣지)로 나뉘어 표현 대상이 다른데도 동일 문구("컨테이너 포트=보라")를 반복해 향후 엣지 중간 삽입(§4) 구현 시 오독 여지가 있는 점을 INFO 로 남긴다. 셋 다 구현 착수를 막을 사유는 아니다.

## 위험도
LOW
