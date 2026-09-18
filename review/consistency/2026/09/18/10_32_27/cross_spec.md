# Cross-Spec 일관성 검토 — 트리거 삭제 자원 정리 현재형 전환 draft

## 검토 범위와 방법

target: `plan/in-progress/spec-draft-deletion-release-current-tense.md` (C1~C10, `spec_impact` 8개 파일).
번들이 컨텍스트 예산으로 대부분 파일을 스텁 처리했으므로, 프롬프트 하단 "번들 누락 보정" 지시에 따라
draft 가 고치는 8개 spec 파일 전문과 관련 plan·구현 코드를 워킹트리에서 직접 Read/grep 했다:

- `spec/2-navigation/2-trigger-list.md`(§3 註·§4.3·§4.4·frontmatter `code:`), `1-workflow-list.md`(frontmatter),
  `data-flow/10-triggers.md`(§1.4), `data-flow/11-workflow.md`(§2.1·§3.1), `data-flow/12-workspace.md`(§1.10·§2.1),
  `conventions/secret-store.md`(전문), `5-system/15-chat-channel.md`(R8), `conventions/spec-impl-evidence.md`(§2.1·§3·§3.1·R-5)
- 구현 코드: `trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`, `workspaces.service.ts`
  (`deleteWorkspace`/`assertWorkspaceDeletable`/`transferOwnership`), `workflows.service.ts`(`remove`),
  `schedules.service.ts`(`remove`), `trigger-config-lock.ts`(`TRIGGER_DELETE_LOCK_TIMEOUT_MS=5000`),
  `ChannelListenerRegistry.unregister(` 호출부 전수(1곳)
- `spec-links.ts` 의 실제 `slugify`(mdast-util-from-markdown + mdast-util-to-string + github-slugger) 를
  node 로 직접 실행해 C10 이 신설하는 R-11 앵커·기존 R-5 앵커·기존 `43-cascade-동작` 앵커를 재계산 대조
- 직전 두 라운드 `review/consistency/2026/09/18/{09_58_25,10_18_33}/SUMMARY.md` (둘 다 BLOCK: YES)

## 발견사항

이번 라운드에서 cross-spec 관점의 **새 CRITICAL/WARNING 은 없다**. 직전 두 라운드가 지적한 cross-spec
관련 항목(WARNING — 공유 트래커를 가리키는 문서 수 "3개"가 실제 4개, `chat-channel-adapter.md` 누락)은
draft 의 R-11 문단에서 "spec/ 4개 문서(`1-workflow-list.md`·`2-trigger-list.md`·`secret-store.md`·
`chat-channel-adapter.md`)" 로 이미 정정되어 있고, `pending_plans:` 를 YAML 로 재파싱해 4개 문서 전부를
직접 grep 으로 재확인했다 — 정정이 정확하다. 직전 라운드의 convention_compliance CRITICAL(placeholder
앵커 `#r-5-…`)도 cross-spec 링크 무결성과 맞닿아 있어 함께 재검증했다: `spec-links.ts` 의 실제 slugger
로직을 그대로 실행한 결과 draft 의 `#r-5-status-partial-의-pending_plans-의무화--plan-라이프사이클-역방향-강제`
와 신설 `#r-11-공유-트래커를-가리키는-partial-의-승격-시점--파일-이동이-아니라-그-문서-몫의-항목` 앵커
모두 실제 heading 슬러그와 정확히 일치했다(대조군으로 기존 `43-cascade-동작` 앵커도 같은 함수로 재현해
검증 방법 자체를 교차 확인).

- **[INFO]** `5-system/15-chat-channel.md` §R8 "리스너 dedup/라이프사이클 정책" 의 사전 존재 모호성 — draft 범위 밖
  - target 위치: C9 는 `teardownChannel() (또는 TriggersService.remove)` → `teardownChannel() 시 — 그리고 트리거
    행을 없애는 경로(트리거·워크플로·워크스페이스 삭제) — ...` 로 바꾼다. 이 문장은 여전히 "`teardownChannel()`
    호출"과 "삭제 경로들"을 별개 조건인 것처럼 병렬로 남긴다.
  - 충돌 대상: 실제 코드에서 `ChatChannelBinderService.teardownChatChannel`(그 안에서 provider adapter 의
    `teardownChannel()` 을 호출)의 유일한 호출부는 `TriggerResourceReleaserService.releaseExternalMany`
    (grep 결과 1곳)뿐이다 — 즉 "삭제 경로 3종"과 별개로 독립적으로 일어나는 "`teardownChannel()` 호출"은
    현재 코드에 없다(예: 트리거 `PATCH { isActive:false }` 비활성화가 채널을 teardown 하는 경로는 없음 —
    `CCH-AD-03`("Trigger disable / 삭제 시 teardownChannel() 자동 호출")의 disable 절반이 실제로 구현돼
    있는지는 이 draft 의 실측 범위 밖이다).
  - 상세: 이 모호성은 draft 가 새로 만든 것이 아니라 원문에 이미 있던 것이고(원문도 "또는" 으로 두 조건을
    병렬 나열), C9 는 괄호 안의 "TriggersService.remove" 를 정확한 세 경로로 넓혔을 뿐 이 구조적 모호성
    자체는 그대로 옮겨졌다. draft 의 실측(row 5)도 "unregister 호출부는 저장소 전체에 `TriggerResourceReleaserService`
    한 곳" 이라고만 확인했지, `teardownChannel()` 이 그 경로 밖에서 독립적으로 불리는 사례가 있는지는
    확인하지 않았다.
  - 제안: 이번 PR 범위에서 조치 불요(draft 가 이 절을 "리스너 lifecycle" 만 좁혀 고치는 것으로 스스로 범위를
    선언했고, cross-spec 충돌이 아니라 spec-vs-code coverage 성격의 별개 질문이다). 후속으로 `CCH-AD-03` 의
    disable 절반이 실제로 구현됐는지 `/spec-coverage` 나 별도 트래커 항목으로 확인할 가치는 있다.

## 요약

draft 가 손대는 8개 spec 문서 간 사실관계 — 잠금 순서(워크스페이스 → 멤버십, `transferOwnership` 과 동일),
5초 락 대기 상한이 부모 행·멤버십·CASCADE 트리거 행 전체에 걸리는 것(`SET LOCAL lock_timeout`), 권한
선검사→외부 해제→잠금 재검사의 순서, schedule job 해제 실패 시 롤백·재등록, `secret_store` 정리가 네
삭제 경로(트리거·스케줄·워크플로·워크스페이스) 전부를 지나는 것, `ChannelListenerRegistry.unregister`
호출부가 단일 서비스로 수렴한 것, `spec-impl-evidence.md` §2.1 의 "미구현 surface" 용어를 그대로 재사용한
신설 규약(R-11) — 을 코드와 대조한 결과 전부 일치했다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·
계층 책임 여섯 관점 중 어느 것도 draft 가 다른 spec 영역과 새로 모순을 만들지 않는다. 직전 두 라운드가
지적한 cross-spec 인접 항목(문서 개수 오기, 자기참조 앵커 placeholder)은 이번 draft 에서 실측 재검증 결과
모두 정정되어 있다. 유일한 잔여 관찰은 `chat-channel.md` §R8 의 기존 모호 서술 하나이며, draft 범위 밖의
pre-existing 사안이라 INFO 로만 남긴다.

## 위험도

NONE
