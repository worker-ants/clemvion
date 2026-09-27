# Plan 정합성 검토 — `spec/2-navigation/` (impl-prep: `plan/in-progress/cross-workspace-refs.md`)

## 발견사항

- **[INFO]** 데이터 모델·에러 처리 규약이 이미 이 처방을 승인한 상태 — 새 결정이 아니라 기존 선언의 뒤늦은 집행
  - target 위치: `spec/1-data-model.md` §2.5 Folder ("`parent_id` 는 **같은 워크스페이스**의 폴더만 가리킨다") · §2.7 Edge ("source_node와 target_node는 같은 workflow_id에 속해야 함") · `spec/5-system/3-error-handling.md` §1.11(AuthConfig binding cross-workspace = 리소스 부재가 아니라 입력값 유효성 → 400 `details.field`/`INVALID_FIELD`)
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` §처방
  - 상세: 이 문서들은 "같은 워크스페이스/워크플로만 가리켜야 한다"를 **이미 제약으로 선언**하고 있는데, `cross-workspace-refs.md` 자신의 전수 조사는 `POST /api/folders`(parentId)·캔버스 저장의 엣지(sourceNodeId/targetNodeId)에 대해 그 선언이 **아직 코드로 집행되지 않았음**을 확인했다. 즉 이 PR 은 새 규약을 만드는 게 아니라, spec 이 이미 참으로 서술해 온 불변식을 뒤늦게 참으로 만드는 작업이다 — "결정 필요" 항목과의 충돌이 아니라 정반대(선행 결정의 지연 집행)다.
  - 제안: 별도 조치 불필요. CHANGELOG/PR 설명에 "새 정책 도입"이 아니라 "기존 data-model 불변식 미집행 상태를 닫음"으로 적어 두면, 향후 리뷰어가 이를 spec 변경으로 오해하지 않는다 (`spec_impact: none` 과 정합).

- **[WARNING]** "이 PR 밖으로 넘기는 것" 두 항목이 아직 트래커에 등재되지 않았다
  - target 위치: `plan/in-progress/cross-workspace-refs.md` §"이 PR 밖으로 넘기는 것" (트리거 `config` 안의 비밀 참조 `botTokenRef`/`inboundSigningRef`/`notification.signing.secretRef` → "트래커 새 항목" / 실행 경로 방어선·운영 데이터 점검 → "트래커로")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "PATCH null 후속" 칸 (현재는 "교차 워크스페이스 참조(미검증)" 한 줄만 있고, 위 두 파생 항목은 아직 없음)
  - 상세: 두 항목 다 구체적 근거(소스 판독)까지 확보한 상태로 "따로 잰다 → 트래커 새 항목"이라 적혀 있지만, 이 세션 시점 트래커 파일에는 아직 반영되지 않았다. 체크리스트의 "구현 · 단위 · CHANGELOG · 트래커" 단계에서 처리될 예정이라 지금 단계(`--impl-prep`)에서 차단 사유는 아니지만, 두 항목은 보안 성격(비밀 참조 미검증)과 방어 심도(이미 저장된 교차 행) 관련이라 `--impl-done` 전에 실제로 등재되지 않으면 조사 내용이 유실된다.
  - 제안: `--impl-done` 직전에 두 항목이 `spec-draft-nullable-notation-followups.md`에 실제로 추가됐는지 확인. 새 plan 액션 불필요 — 같은 plan 의 남은 체크리스트 항목으로 이미 추적됨.

- **[INFO]** target 문서 frontmatter `pending_plans` 오래된 참조 — 이번 PR 과 직접 관련은 없음
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans: [marketplace-and-plugin-sdk.md, plan/complete/workflow-duplicate-nodes-edges.md]`
  - 관련 plan: `plan/complete/workflow-duplicate-nodes-edges.md`(`status: complete`, 이미 `plan/complete/`로 이동 완료) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(§3.2 `maxConcurrentExecutions` null 처리, 그리고 이번 `cross-workspace-refs.md`가 닫는 폴더 parentId 갭까지 — `1-workflow-list.md`를 두 차례 이상 직접 지목하지만 frontmatter 에는 없음)
  - 상세: `pending_plans` 가 이미 완료된 plan 을 여전히 걸고 있고, 정작 이 문서를 반복 지목하는 진행 중 트래커는 빠져 있다. `cross-workspace-refs.md` 는 `spec_impact: none` 이라 이 PR 이 직접 고칠 항목은 아니며(spec frontmatter 는 developer 쓰기 범위 밖), 이 gap 도 이번 세션 이전부터 있던 상태다.
  - 제안: 이번 PR 의 범위는 아님. planner 턴에서 `1-workflow-list.md` frontmatter 를 정리할 때 참고.

## 요약

`plan/in-progress/cross-workspace-refs.md`(교차 워크스페이스 참조 저장 전 검사)는 `spec/2-navigation/` 이 "결정 필요"로 남겨 둔 항목을 우회하거나 다른 진행 중 plan 과 충돌하지 않는다. 오히려 `spec/1-data-model.md`(Folder.parent_id·Edge.source/target_node_id 동일 워크스페이스/워크플로 불변식)와 `spec/5-system/3-error-handling.md` §1.11(cross-workspace 참조 = 입력값 유효성 = 400)이 이미 이 처방의 방향을 선언해 두었고, 이 PR 은 그 선언을 뒤늦게 코드로 집행하는 성격이다. 에러 코드·필드명의 spec 미러링을 planner 몫으로 명시적으로 남겨 둔 것도 developer/spec 쓰기 경계 규약과 정합한다. 유일한 절차적 잔여 항목은 "이 PR 밖으로 넘기는 것" 두 건이 `--impl-done` 전에 실제로 트래커에 등재되는지 확인하는 것과, 무관하게 이미 존재하던 `1-workflow-list.md` frontmatter `pending_plans` 의 staleness(완료 plan 잔존·관련 트래커 누락)다. 둘 다 이번 구현 착수를 막을 사유는 아니다.

## 위험도

LOW
