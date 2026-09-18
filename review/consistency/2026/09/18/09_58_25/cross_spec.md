# Cross-Spec 일관성 검토 — spec-draft-deletion-release-current-tense

## 검토 방법

프롬프트 번들은 컨텍스트 예산 초과로 target 이 고치는 7개 spec 파일과 관련 3개 파일(execution-engine.md 표・data-flow 3종・secret-store.md・chat-channel.md)의 본문이 스텁 처리돼 있었다. 프롬프트 하단 지시에 따라 아래 파일을 워킹트리에서 직접 `Read` 하고, target 이 인용하는 구현 코드(트리거・워크플로・워크스페이스・스케줄 삭제 경로)를 대조해 판정했다.

- `spec/data-flow/10-triggers.md` §1.4 (전문)
- `spec/data-flow/11-workflow.md` §1.5, §2.1, §3.1 (전문)
- `spec/data-flow/12-workspace.md` §1.10, §2.1, Rationale (전문)
- `spec/conventions/secret-store.md` (전문)
- `spec/5-system/15-chat-channel.md` R8 절
- `spec/2-navigation/3-schedule.md` (전문)
- `spec/1-data-model.md` 관련 행
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 대상 트래커 7행 표 + 인접 미해결 항목
- `plan/complete/spec-draft-deletion-releases-trigger-resources.md` (#1345, D1~D7)
- 구현: `trigger-resource-release.ts` · `trigger-resource-releaser.service.ts` · `workspaces.service.ts`(`deleteWorkspace`/`assertWorkspaceDeletable`) · `workflows.service.ts`(`remove`) · `schedules.service.ts`(`remove`) · `channel-listener.registry.ts` 소비처 전수 grep

## 발견사항

이번 draft 는 **계약을 바꾸지 않고 이미 머지된 구현(`a9288bf6e`)에 맞춰 서술만 현재형으로 정정**하는 성격이라, target 문서 자체가 코드와의 정합성 근거를 촘촘히 제시하고 있다. 코드 대조 결과 C1~C9 의 모든 실측 주장(부모 잠금 순서・5초 락 상한 적용 범위・schedule job 해제 실패 시 롤백・권한 선검사 위치・`unregister` 호출부 단일화)이 실제 구현과 일치했고, 다른 spec 영역과의 데이터 모델・API 계약・상태 전이・RBAC 충돌은 발견되지 않았다. CRITICAL/WARNING 급 교차 모순은 없다. 아래는 참고용 INFO 두 건이다.

- **[INFO]** `execution-engine.md §4.4` 배제가 만드는 카탈로그 분리
  - target 위치: draft 본문 "비대상 — 트래커 6행을 하지 않는 이유" 표
  - 충돌 대상: `spec/5-system/4-execution-engine.md §4.4` "순환 의존 처리" 표 (`ModuleRef.get(X, { strict: false })` 기법 카탈로그)
  - 상세: draft 는 트리거 자원 정리의 `resolveTriggerResourceReleaser`(못 찾으면 **던지는** 변형)를 이 표에 추가하지 않기로 결정했다. 근거(그 표는 실행 엔진・이벤트 발행 축에 한정된 사례만 담는다)는 표 자체의 서두 문구("엔진의 DI 순환은…")와 일치해 타당하다. 다만 그 결과 저장소 안에서 같은 DI 기법(`ModuleRef.get(…, {strict:false})`)이 (a) 이 표(엔진 축, no-op 변형)와 (b) `trigger-resource-release.ts` JSDoc(트리거 축, throw 변형) 두 곳에 나뉘어 기록되고, spec 레벨에서 이 기법을 한눈에 볼 수 있는 단일 카탈로그가 없다. 실측(코드 comment `resolveTriggerResourceReleaser`)은 정확하므로 정보 누락은 아니고, 향후 세 번째 소비처가 생기면 "카탈로그가 존재한다"는 착각으로 이 표에만 추가하고 트리거 축 변형을 놓칠 가능성이 남는다.
  - 제안: 현재 판단(비대상)을 뒤집을 필요는 없음 — draft 의 근거가 표 자체의 스코프 선언과 부합한다. 후속 조치가 필요하다면 `spec/5-system/4-execution-engine.md` 표 상단에 "이 표는 실행 엔진 모듈 축 한정, 다른 모듈의 지연 해석 사례는 각 모듈 spec/코드 참조" 정도의 각주만 추가해도 충분하다(이번 draft 범위 밖으로 두어도 무방).

- **[INFO]** 새로 문서화되는 "권한 선검사-재검사 창"이 `D7-N` 라벨 체계 밖에 있음
  - target 위치: C1 변경안 §4.3 다음 문단 "남는 창은 외부 자원 쪽이다…워크스페이스 삭제의 권한 선검사와 잠금 재검사 사이에 역할이 바뀌어…"
  - 충돌 대상: `plan/complete/spec-draft-deletion-releases-trigger-resources.md` §D7 (남는 창 D7-1~D7-3 라벨 카탈로그)
  - 상세: draft 의 Rationale 이 스스로 인정하듯 이 창은 #1345 결정 당시엔 없었고 구현이 권한 검사를 외부 해제 앞으로 당기면서 새로 생긴 것이다. `plan/complete/**`는 봉인된 이력이라 소급 수정 대상이 아니므로 이 자체는 문제가 아니지만, 향후 이 결정 문서를 참조하는 사람이 "D7 이 남는 창의 전체 목록"이라고 오인할 여지가 생긴다(target 이 편집하는 spec 본문 자체는 원래도 `D7-N` 라벨을 쓰지 않으므로 spec 본문 층에서는 문제 없음).
  - 제안: 선택사항 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커의 해당 항목을 닫을 때, 완료 메모에 "새 창(권한 선검사-재검사)은 D7 계열이 아니라 이 구현이 추가로 만든 것"이라는 한 줄을 남기면 이력 추적에 도움이 된다. spec 문서 수정은 불필요.

검증했지만 문제 없음으로 판정한 주요 항목(참고):
- C6 의 "권한 검사 → 외부 해제 → 트랜잭션(잠금 상한 5초, 워크스페이스→멤버십 순 재잠금)" 순서는 `workspaces.service.ts` `deleteWorkspace`/`assertWorkspaceDeletable` 실제 구현과 정확히 일치하며, 잠금 순서가 `transferOwnership`(소유권 이전)과 같다는 근거도 코드 주석과 일치.
- C2 의 "모든 락 대기(부모 행・멤버십・CASCADE 트리거 행)에 5초 상한" 은 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 과 `lockParentAndListTriggerIds` 가 트랜잭션 첫 호출로 `SET LOCAL lock_timeout` 을 거는 구현과 일치.
- C9 의 "`unregister` 호출부는 `TriggerResourceReleaserService` 한 곳" 은 저장소 전수 grep(`unregister(` 2건 — 정의부 1 + 호출부 1)으로 확인. 스케줄 삭제 경로(`schedules.service.ts`)가 이 호출을 하지 않는 것도 데이터 모델상 schedule 타입이 `chatChannel` 을 가질 수 없어(`config.chatChannel` 은 `webhook` 트리거의 변형) 대상이 아니라는 draft 의 설명과 일치.
- C7 의 `secret-store.md` `status: partial → implemented` 전환은 `git log`(commit `aaee17206`, #1345)이 이 문서를 `implemented → partial` 로 내린 유일한 사유였음을 확인했고, `spec/conventions/spec-impl-evidence.md` §3 의 `status` 라이프사이클 규칙(구현 완료 시 `pending_plans` 제거)과도 부합. `secret-store.md` 트래커에 남아 있는 별개의 미해결 질문(비밀-부재 헬퍼의 `code:` 등재 여부, line 1921)은 "미구현 surface" 가 아니라 문서 등재 여부에 관한 질문이라 `pending_plans` 의무 대상이 아니므로 C7 과 충돌하지 않음.
- C4~C6 이 제거하는 "미구현 (Planned)" 태그 6곳은 저장소 전체에서 이 트리거 삭제 자원 정리 주제에 대한 유일한 잔존 Planned 태그였음(`grep` 로 다른 영역에 동일 주제의 stale 태그가 남아있지 않음을 확인).
- draft 의 `spec_impact` 목록(7개 파일)이 트래커의 7행 표와 정확히 1:1 대응하며 누락・초과가 없음.

## 요약

target 은 이미 머지된 구현에 문서를 맞추는 순수 동기화 draft이며, 제시된 모든 실측 주장을 코드(트리거/워크플로/워크스페이스/스케줄 삭제 서비스, 락 타임아웃 상수, listener registry 소비처)와 대조한 결과 정확했다. 데이터 모델・API 계약・요구사항 ID・상태 전이・RBAC・계층 책임 어느 축에서도 다른 spec 영역과의 직접 모순은 발견되지 않았으며, 발견된 두 건은 모두 정보성(INFO) — 실행 엔진 DI 순환 카탈로그와 트리거 자원 정리의 "throw" 변형이 서로 다른 곳(spec 표 vs 코드 JSDoc)에 나뉘어 기록되는 점, 그리고 새로 문서화된 "권한 선검사-재검사 창"이 #1345 의 `D7-N` 라벨 체계 밖에 있다는 점이다. 둘 다 target 의 현재 판단을 뒤집을 필요는 없다.

## 위험도

LOW
