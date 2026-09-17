# 신규 식별자 충돌 검토 — spec-draft-deletion-releases-trigger-resources

## 검토 범위 확인

target draft(`plan/in-progress/spec-draft-deletion-releases-trigger-resources.md`)는 **브랜드 뉴 식별자를
도입하지 않는다** — 기존 spec 7개 파일(`spec/2-navigation/1-workflow-list.md`,
`spec/2-navigation/2-trigger-list.md`, `spec/data-flow/{10-triggers,11-workflow,12-workspace}.md`,
`spec/1-data-model.md`, `spec/conventions/secret-store.md`)에 이미 존재하는 섹션·앵커·엔티티·엔드포인트·
필드명을 그대로 재사용해 문구를 보정하는 draft다. 실제 파일을 열어 각 변경안(S1~S7)이 가리키는 현재
문구와 대조한 결과는 다음과 같다.

- `spec/2-navigation/2-trigger-list.md` §4.3 "cascade 동작" — 이미 존재하는 섹션(line 269). draft 가
  인용한 line 275 원문("상류 — `workflow`·`workspace` 삭제 | 트리거도 FK CASCADE 로 함께 삭제된다…")과
  실측이 정확히 일치. S2 는 이 섹션 **끝에 문단을 추가**할 뿐 새 섹션·새 앵커를 만들지 않는다.
- `spec/data-flow/12-workspace.md` §1.10 "워크스페이스 삭제 / 나가기" — 이미 존재(line 184). draft 가
  인용한 원문(line 188, `DELETE /api/workspaces/:id` 행)과 실측 일치. S5 는 같은 표의 같은 셀 문구만
  확장한다 — 새 엔드포인트·새 액션명 추가 없음.
- `spec/1-data-model.md` §2.21.1 SecretStore — draft 가 "secret_store.workspace_id 행"이라 부른 자리는
  실제로는 line 791(필드 `workspace_id`)이며 원문이 정확히 일치. S6 는 이 필드 설명만 고친다.
- `spec/conventions/secret-store.md` R4(line 426~428) — draft 가 인용한 원문과 실측 일치. S7 은 이
  기존 R4 문구를 고치는 것이며 새 R-번호를 신설하지 않는다.
- `spec/data-flow/10-triggers.md` §1.4 "Schedule ↔ Trigger 동기화" 표 — 기존 행("Trigger(type='schedule')
  직접 삭제" 등)과 겹치지 않는 새 행 `Workflow·Workspace 삭제 (FK CASCADE)` 를 추가한다. 표 안의 다른
  행 라벨과 문자열이 겹치지 않아 혼동 소지 없음.
- `spec/data-flow/11-workflow.md` §3.1 `workflow.is_active` FK 파급 표의 `trigger` 행(line 195) — 이미
  `[트리거 목록 §4.3]` 을 인용하고 있으며, S4 는 그 셀 끝에 한 문장을 덧붙일 뿐 새 행·새 컬럼을 만들지
  않는다.
- `spec/2-navigation/1-workflow-list.md` §2 "삭제" 행(line 108) — 원문("연결된 트리거/스케줄도 함께
  비활성화") 확인. S1 은 문구를 고칠 뿐 새 액션·새 상태값을 도입하지 않는다.

## 발견사항

### [INFO] `CCH-AD-03` 요구사항 범위가 draft 로 암묵 확장되지만 ID 자체는 새로 만들지 않는다

- target 신규 식별자: 없음 (draft 는 새 요구사항 ID 를 발급하지 않는다)
- 기존 사용처: `spec/5-system/15-chat-channel.md:66` — `CCH-AD-03 | Trigger disable / 삭제 시 어댑터의
  teardownChannel() 자동 호출 | 필수`
- 상세: 이 draft 의 D1·S2·S5 는 "트리거 삭제"뿐 아니라 워크플로·워크스페이스 삭제(FK CASCADE 로 트리거를
  지우는 모든 경로)에도 `teardownChatChannel` 호출을 요구한다. 기존 `CCH-AD-03` 문면의 "삭제"가 이미
  "트리거 삭제" 한 경로만 가리키던 것과 정확히 같은 문제 패턴(§R4 가 겪은 것과 동일 — "행을 없애는 모든
  경로" 중 하나만 명시)이 이 요구사항 ID 에도 남는다. 이것은 **식별자 충돌**은 아니다 — 같은 ID 를 다른
  의미로 쓰는 것이 아니라, 기존 ID 의 서술 범위가 draft 결정과 조용히 벌어지는 것이다. 다만 이 draft 가
  spec_impact 목록에 `spec/5-system/15-chat-channel.md` 를 넣지 않았으므로, 이 벌어짐이 이번 draft 로는
  닫히지 않고 다음 사람이 또 "CCH-AD-03 은 트리거 삭제만 말한다"고 오독할 여지가 남는다.
- 제안: 이번 draft 스코프에서 필수는 아니나, S2(또는 별도 후속)에서 `CCH-AD-03` 문구를 "Trigger disable
  / 트리거 행이 없어지는 모든 경로(직접 삭제·워크플로·워크스페이스 삭제)" 로 확장하거나, 최소한
  `spec/5-system/15-chat-channel.md` 에 이 draft 로의 cross-ref 한 줄을 남겨 SoT 분산을 막는 편이 §R4
  재발을 예방한다.

## 요약

target draft 는 7개 spec 파일의 **기존** 섹션·앵커·필드·엔드포인트·표 행을 실측 대조로 확인한 뒤 그
문구만 정정·보강하는 성격이라, 요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·
파일 경로 6개 관점 모두에서 **새로 도입되는 식별자가 사실상 없다**. 인용된 원문(라인 번호 포함)을 모두
직접 열어 대조한 결과 어긋남 없이 일치했고, 새로 추가되는 것은 기존 표에 대칭적으로 끼워 넣는 한 개
행(`10-triggers.md §1.4`)과 기존 섹션 끝에 붙는 문단들뿐이라 다른 의미로 이미 쓰이는 이름과 충돌할
표면 자체가 없다. 유일한 관찰 사항은 CRITICAL/WARNING 급 충돌이 아니라, 기존 요구사항 ID `CCH-AD-03`
의 서술 범위가 이 draft 의 새 계약과 조용히 벌어진다는 INFO 수준의 정합성 메모다.

## 위험도

NONE
