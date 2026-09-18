# Plan 정합성 검토 — trigger `(workflow_id)` 인덱스 (--impl-prep, scope=spec/2-navigation/)

## 검토 대상 및 방법

`--impl-prep` 요청의 명목 scope 는 `spec/2-navigation/`(`1-workflow-list.md` · `2-trigger-list.md`) 이지만, 실제
착수 대상은 `plan/in-progress/spec-draft-trigger-workflow-index.md`(V111 `trigger(workflow_id)` 인덱스 +
`releaseExternalForParent` select 좁히기)이고, 그 코드 변경(`trigger-resource-releaser.service.ts`)이
`2-trigger-list.md` 의 `code:` glob 에 걸려 scope 에 들어왔다. 이 plan 은 상위 공유 트래커
`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "부모 삭제 경로의 성능 후속" 항목(첫째·셋째 불릿)을
닫는 자식 draft다. 아래는 이 구조를 기준으로 한 정합성 점검이다.

## 발견사항

없음. 아래는 확인한 근거다.

1. **미해결 결정과의 충돌 — 없음**
   - `2-trigger-list.md`·`1-workflow-list.md` 안에 남아 있는 유일한 "결정 필요/TBD" 항목은 chat-channel
     `inboundSigning` rotation API(§2.3.1, `~~TBD (미결정)~~` 취소선 처리됨)뿐이며, 트리거 삭제 성능·인덱스
     주제와 무관하다.
   - 트래커(`spec-draft-nullable-notation-followups.md`)·다른 in-progress plan 어디에도 `trigger.workflow_id`
     인덱스 전략에 대해 이 draft 와 다른 결정을 요구하는 "결정 필요" 항목이 없다(`integration_usage_log` 등
     나머지 6개 FK 는 이 plan 이 스스로 "따로 재야 한다" 며 범위 밖으로 명시적으로 미룬 것이지, 외부에서
     걸어 둔 미해결 결정이 아니다).

2. **선행 plan 미해소 — 없음**
   - 이 draft 가 전제하는 선행 작업(`#1345`/`#1346` 트리거 자원 정리 구현, `#1347` 삭제 서술 현재형화,
     `#1348` stale 주석 정리)은 모두 `git log`(`aaee17206` → `a9288bf6e` → `e63a5bc5d` → `44bcad9aa`)에
     이미 머지돼 있고, 대응하는 트래커 하위 항목도 `[x]` 로 닫혀 있다.
   - draft 자신의 체크리스트도 `--spec BLOCK: NO` 까지만 완료(`[x]`)이고 `--impl-prep` 이하는 아직
     미착수(`[ ]`)로 정확히 표시돼 있다 — 실측(`spec/1-data-model.md` §3·`## Rationale`, `spec/data-flow/10-triggers.md`
     §2.1 은 이미 draft 의 S1~S3 문구 그대로 커밋됨(`fa1153e64`), 반면 `codebase/backend/migrations/V111__*`
     파일과 `trigger-resource-releaser.service.ts` 의 `select` 좁히기는 아직 코드에 없음)이 이 체크리스트
     상태와 일치한다. spec 이 code 보다 앞서 나가 있는 상태이지만, 이는 draft 가 명시한 순서(spec 확정 →
     `--impl-prep` → 구현)이지 미해소 선행 조건이 아니다.
   - `releaseExternalForParent` 를 `select: { id, type, config }` 로 좁혀도 소비처
     (`ChatChannelBinderService.teardownChatChannel` → `trigger.config`/`trigger.id`,
     `releaseExternalMany` 의 `trigger.type` 필터, `channelListenerRegistry.unregister(trigger.id)`)가
     읽는 필드는 그 세 개뿐임을 코드로 확인했다 — draft 의 "판정할 것" 항목이 실제로 통과할 조건임을 뒷받침한다.

3. **후속 항목 누락 — 없음(현 단계 기준)**
   - draft 의 "트래커 반영" 절은 (a) "부모 삭제 경로의 성능 후속" 첫째·셋째 불릿 해소 표시, (b) 나머지
     6개 FK(`integration_usage_log` 등)에 대한 새 트래커 항목 추가를 **구현 완료 후**에 하도록 명시돼
     있다. 실측상 트래커(`spec-draft-nullable-notation-followups.md:4590`)의 해당 항목은 아직 원문 그대로
     열려 있고 새 항목도 아직 없는데, 이는 draft 의 체크리스트 순서(구현 → 트래커 반영, 아직 구현 전)와
     정확히 일치하는 상태이지 누락이 아니다. `--impl-done` 단계에서 이 반영이 실제로 이뤄지는지는 이후
     라운드에서 다시 확인이 필요하다.
   - `spec/2-navigation/2-trigger-list.md` 의 `pending_plans` 는 개별 하위 draft(`spec-draft-trigger-workflow-index.md`)가
     아니라 공유 트래커(`spec-draft-nullable-notation-followups.md`)를 계속 가리키고 있다 — 이는
     `spec-impl-evidence.md §3.1`/R-11 이 정한 "공유 트래커일 때 승격 시점은 파일 이동이 아니라 그 문서 몫의
     미구현 surface 0" 규칙과 일치하며(트리거 관련 다른 미해소 항목이 아직 있으므로 상태를 올릴 시점도
     아니다), 개별 draft 를 추가로 나열할 의무는 없다.
   - `spec/1-data-model.md` 의 `code:` 는 `codebase/backend/migrations/V*.sql` glob 이라 신규 `V111__*.sql`
     파일이 생기면 별도 frontmatter 갱신 없이 자동으로 커버된다 — 구현 단계에서 추가 조치가 필요 없다.

## 요약

명목 scope(`spec/2-navigation/`)와 실제 착수 대상(`spec-draft-trigger-workflow-index.md`, V111 인덱스 + select
좁히기)의 관계를 추적한 결과, spec 커밋(S1~S3)이 이미 draft 문구와 정확히 일치하게 반영돼 있고, 선행
트리거 삭제 자원 정리 작업(#1345~#1348)은 모두 머지 완료 상태이며, 남겨둔 6개 FK 후속과 트래커 반영은
draft 자신의 체크리스트가 "구현 완료 후" 로 명시해 둔 순서대로 아직 미착수일 뿐 계획과 어긋나지 않는다.
target 문서 내에 이 주제와 충돌하는 미해결 결정도 없다. Plan 정합성 관점에서 `--impl-prep` 진행을 막을
근거를 찾지 못했다.

## 위험도

NONE
