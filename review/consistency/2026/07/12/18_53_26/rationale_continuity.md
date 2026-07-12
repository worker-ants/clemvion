# Rationale 연속성 검토 결과

## 대상
- target: `spec/4-nodes/7-trigger/1-manual-trigger.md` (diff: frontmatter `code:` 항목 추가, §6 저장 시점 발행 경로 각주 신설, `## Rationale` 신설)
- 동반 변경(같은 커밋 세트): `spec/5-system/3-error-handling.md`, `spec/data-flow/10-triggers.md`, `spec/data-flow/11-workflow.md` — 모두 "저장 경로(`POST /:id/save`)도 `INVALID_TRIGGER_PARAMETERS` 를 발행한다" 는 동일 사실의 문서 동기화.

## 검토 경위

target 의 `## Rationale`("`restoreVersion` 이 저장 시점 파라미터 스키마 게이트를 건너뛰는 비대칭")은 이번 diff 로 신설된 절이며, `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 의 항목 "(rationale_continuity WARNING) `restoreVersion` 이 저장 게이트를 skip 하는 비대칭을 해당 spec 의 `## Rationale` 에 근거 기재" 를 이행한 결과물이다 — 즉 본 항목은 **이전 회차 rationale_continuity 검토가 지적한 WARNING 을 이미 해소한 상태**로 제출됐다.

또한 `plan/in-progress/manual-trigger-default-param.md` (선행 구현 plan) 를 대조한 결과, 원 spec §6 은 이번 diff 이전부터 "handler.validate (저장 시점)" 문구로 **저장 시점 검증을 이미 규정**하고 있었고, 구현이 그 규정을 놓치고 있던 버그를 뒤늦게(`workflows.service.ts validateManualTrigger`) 채운 것이었다. 즉 이번 diff 는 새 설계 결정이 아니라 **기존 spec 의도 ↔ 구현 현실의 명칭·경로 정정** 문서화다.

## 발견사항

- **[INFO]** `skipLegacyDataGates` 비대칭 근거의 양방향 상호참조 부재
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` `## Rationale`
  - 과거 결정 출처: `spec/conventions/execution-context.md` §1 "강제 (3계층)" L0 항목 — "`restoreVersion` 은 사전-게이트 스냅샷 복원이라 이 게이트를 건너뛴다(`validateManualTrigger` 파라미터 스키마 게이트와 동일한 legacy-data escape)"
  - 상세: 두 문서가 **같은 메커니즘**(`saveCanvas(skipLegacyDataGates=true)` 에 의한 legacy-data escape)을 각자 독립적으로 서술한다. `execution-context.md` 쪽은 target 의 Rationale 을 명시적으로 인용("`validateManualTrigger` 파라미터 스키마 게이트와 동일한")하지만, target 의 신설 Rationale 은 역방향으로 `execution-context.md` 를 링크하지 않는다. 내용 자체는 완전히 일치하고 모순은 없으나, 두 SoT 가 각자 텍스트로 근거를 반복 서술하면 향후 한쪽만 수정되는 drift 위험이 있다.
  - 제안: target `## Rationale` 마지막 문단에 `[Execution Context 규약 §1](../../conventions/execution-context.md#1-...)` 로 상호 링크를 추가해 "동일 `skipLegacyDataGates` 메커니즘의 두 적용 사례" 임을 명시. 차단 사유 아님, 후속 편집 시 반영 권장.

## 정합성 확인 (문제 없음으로 판정한 항목)

- **기각된 대안의 재도입 없음**: `manual-trigger-default-param.md` 에 기록된 "되돌림" 항목 2건 — (a) 프론트 즉시 store 커밋(`0-canvas.md §8 R-3` 위반으로 반려), (①) resolve 레벨 lenient/partition 파싱(cross_spec CRITICAL 로 반려, strict all-or-nothing 유지) — 어느 것도 이번 target diff 에서 재도입되지 않았다. 이번 diff 는 순수 저장 시점 검증 경로 문서화 + Rationale 신설뿐이다.
- **Import 의 permissive config 정책과 비충돌**: `spec/2-navigation/1-workflow-list.md` Rationale §2 는 "JSON 가져오기(Import) 시 노드 config 파싱 실패해도 raw 보존" 을 규정하나, 이는 `importWorkflow` 경로 한정이다. 코드 확인 결과 `WorkflowsService.importWorkflow` 는 `validateManualTrigger` 를 호출하지 않는다(`saveCanvas` 경로만 호출) — 신설된 저장 시점 파라미터 스키마 게이트는 Import 의 permissive 정책 범위 밖이라 충돌하지 않는다.
- **CONVENTIONS Principle 3.1 과 비충돌**: target §6 이 인용하는 "Pre-flight 에러 throw" 원칙(`node-output.md` Principle 3.1)은 노드 핸들러 실행 시점(`handler.validate`)의 분류 원칙이다. 이번에 명확화된 저장 시점 게이트(`WorkflowsService.validateManualTrigger`)는 핸들러 실행 이전, 워크플로우 저장 API 레이어의 별도 관문이라 원칙의 적용 대상이 다르며 상충하지 않는다 — 오히려 target 의 신설 각주가 이 구분("handler.validate 가 아니라 서비스 계층 우회 구현")을 명시적으로 바로잡아 혼동을 줄였다.
- **동일 패턴의 확장으로 정합**: target Rationale 의 "저장 = 새 데이터 작성(엄격), 복원 = 과거 데이터 재현(완화)" 원칙은 `spec/conventions/execution-context.md` 의 `variables.__*` L0 게이트 legacy-data escape 와 완전히 동형이며(같은 `skipLegacyDataGates` 플래그를 공유), 새 예외를 만드는 것이 아니라 기존에 합의된 예외 패턴을 두 번째 게이트에 일관되게 적용한 것이다.

## 요약

target 의 `## Rationale` 신설과 4개 spec 파일의 동반 수정은 새로운 설계 결정이 아니라, (1) 이미 spec 이 의도했던 저장 시점 검증 규정과 뒤늦게 이를 이행한 구현 사이의 명칭 불일치 정정, (2) 선행 rationale_continuity WARNING("`restoreVersion` 비대칭에 Rationale 부재")의 이행 결과다. 과거 Rationale 이 명시적으로 기각한 대안(프론트 즉시 커밋, resolve 레벨 lenient 파싱)의 재도입은 없고, `variables.__*` 예약 게이트의 L0 legacy-data escape 패턴과 완전히 동형이라 원칙 위반도 없다. 유일한 지적사항은 같은 메커니즘을 설명하는 두 Rationale(`execution-context.md` ↔ `1-manual-trigger.md`) 사이의 단방향 상호참조 — 비차단 INFO.

## 위험도
NONE
