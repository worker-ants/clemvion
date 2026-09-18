# Rationale 연속성 검토 — spec-draft-deletion-release-current-tense.md

## 검토 범위와 방법

target(`plan/in-progress/spec-draft-deletion-release-current-tense.md`)이 고치는 8개 spec 문서 중
Rationale 이 실재하는 자리(직접 Read, 번들 스텁이 아닌 원본)를 대조했다:

- `spec/conventions/secret-store.md` — 전문(§1~§7, Rationale R1~R5)
- `spec/conventions/spec-impl-evidence.md` — 전문(§1~§6, Rationale R-1~R-10)
- `spec/2-navigation/2-trigger-list.md` — Rationale R-1~R-17(번들)
- `spec/5-system/15-chat-channel.md` — R8 원문(리스너 dedup/라이프사이클 정책)
- `spec/data-flow/12-workspace.md` — §1.10 원문 + `workspaces.service.ts` (`deleteWorkspace`/`assertWorkspaceDeletable`) 코드 대조
- `spec/5-system/4-execution-engine.md` — §4.4 순환 기법 표 원문
- `plan/complete/spec-draft-deletion-releases-trigger-resources.md`(#1345, D1~D7 결정·기각한 대안 전문)
- `plan/in-progress/spec-draft-nullable-notation-followups.md`(공유 트래커) — 스크립트로 top-level 항목 파싱
- 4개 spec frontmatter 의 `pending_plans` — YAML 파서로 재확인

## 발견사항

### [INFO] C10/R-11 예외는 자동 가드가 아니라 사람의 감사에 의존한다

- target 위치: `## 변경안` C10 (`spec/conventions/spec-impl-evidence.md §3.1` 신설 자식 불릿 + R-11)
- 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §3.1` "`partial` → `implemented`: 마지막
  `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 **(가드)**" — 이 전이는
  `spec-status-lifecycle.test.ts` 가 기계적으로 강제하는 유일한 지점이다.
- 상세: C10 은 "`pending_plans` 가 **공유 트래커**일 때" 라는 새 예외를 만들어, 트래커 파일 자체가
  `complete/` 로 이동하지 않아도(다른 문서 몫이 아직 남아 있어도) 그 문서 몫의 "미구현 surface" 가
  0 이면 사람이 판정해 승격할 수 있게 한다. target 스스로 "가드는 이 방향을 보지 않으므로... 판정
  근거를 승격 commit 에 남긴다" 고 명시해, 이 경로에는 자동 가드가 없고 **판정 근거를 커밋 메시지에
  남기는 절차적 규율**이 유일한 안전장치임을 인정하고 있다. 이는 결정을 번복하면서 새 Rationale
  (R-11)을 함께 쓴 정상 경로(위 검토 관점 3)를 충족하지만, 향후 같은 예외를 원용하는 PR 이 "감사
  전수·미구현 surface 0" 절차를 생략해도 빌드는 막지 못한다 — 정합성은 다음 리뷰어의 주의에 의존한다.
- 제안: 조치 불요(이미 R-11 자체가 이 한계를 "가드가 이 방향을 보지 않는다" 로 명문화했고, 2회차
  `--spec` WARNING 2 가 같은 지점을 지적해 이해상충 문단으로 이미 반영됨). 후속으로 이 예외가 재사용될
  경우를 대비해 `/spec-coverage` 나 별도 advisory 가드에 "공유 트래커 승격 판정 커밋 존재" 체크를
  추가하는 것을 고려할 수 있다는 점만 기록해 둔다.

### [INFO] `spec-impl-evidence.md §3.1` 자식 불릿 위치는 구조적으로 안전

- target 위치: `## 변경안` C10
- 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §3.1` 전이 규칙 4-불릿 목록
- 상세: 실제 §3.1 은 `partial → implemented` 불릿이 세 번째 항목이며, C10 이 그 아래 2칸 들여쓴
  자식 불릿을 추가하는 배치는 문서의 기존 리스트 구조와 충돌하지 않는다. 확인만 하고 별도 조치는
  불요.
- 제안: 없음(확인 완료).

## 검증 결과 (참고 — 신규 위반 없음)

Rationale 연속성 관점에서 target 이 실제로 손대는 자리를 과거 결정과 대조한 결과, **기각된 대안의
재도입·합의 원칙 위반·무근거 번복·암묵적 가정 충돌 중 어느 것도 발견되지 않았다.**

- **D1~D7 (#1345) 무변경 주장은 사실이다.** `plan/complete/spec-draft-deletion-releases-trigger-resources.md`
  의 "기각한 대안"(D2: 트리거마다 `DELETE /api/triggers/:id` 재호출 — 감사 이중화·트랜잭션 분리 우려로
  기각, D4 철회안: 워크스페이스 삭제가 `secret_store` 를 `workspace_id` 로 트랜잭션 안에서 명시
  DELETE)을 target 이 재도입하는 곳은 없다. target 의 C6(`12-workspace.md §1.10`)은 D3(외부 자원은
  트랜잭션 밖·행 삭제 전 해제)·D6(부모 잠금 뒤 같은 트랜잭션에서 열거)의 문면화이고, 실제 코드
  (`workspaces.service.ts` `deleteWorkspace`/`assertWorkspaceDeletable`)와 락 순서·권한 재검사 시점까지
  정확히 일치한다(직접 대조 완료 — `lockParentAndListTriggerIds` 가 트랜잭션 첫 호출, 잠금 순서
  워크스페이스→멤버십은 JSDoc "`transferOwnership` 과 같게 둬야 교착(`40P01`)이 나지 않는다" 와 일치).
- **`secret-store.md §R4`(트리거 FK 미설정)의 "명시적 cleanup 책임은 트리거 행을 없애는 모든 경로가
  진다"는 이미 2026-09-17 정정을 반영한 현재 문면**이며, target 은 이 Rationale 문장 자체를 건드리지
  않고 frontmatter 상태만 정합화한다(C7) — 충돌 없음.
- **C9(`15-chat-channel.md` R8)의 재도입이 아니라 예고된 후속 이행.** #1345 의 "비대상" 표가 이 자리를
  "listener registry 해제 호출부가 실제로 늘어난 뒤 그 실측과 함께 넓힌다 — DRT-2 에 후속으로
  적었다" 고 명시적으로 유예했었다. `ChannelListenerRegistry.unregister` 호출부를 저장소 전체
  grep 하면 `TriggerResourceReleaserService.releaseExternalMany` 한 곳뿐이고, 이는 트리거 단건 삭제
  (`TriggersService.remove` → `releaseExternal`)와 워크플로·워크스페이스 삭제(`releaseExternalForParent`)
  양쪽에서 호출되며, 스케줄 삭제(`SchedulesService.remove`)는 이 경로를 타지 않는다 — target C9 의
  "트리거·워크플로·워크스페이스, 스케줄은 대상 아님" 서술과 코드가 정확히 일치한다. 즉 유예했던
  약속을 실측과 함께 이행하는 것이지, 결정을 뒤집는 것이 아니다.
- **`4-execution-engine.md §4.4` 순환 기법 표를 넓히지 않기로 한 target 의 "비대상" 판정도 근거가
  맞다.** 표는 "DI 인스턴스화 순서 함정"(`ModuleRef.get(X, {strict:false})`)과 "ES-module 순환 봉인"
  (`forwardRef`) 두 사례만 다루며, 트리거 자원 해제의 `TRIGGER_RESOURCE_RELEASER` 토큰 지연 해석은
  코드 JSDoc 이 밝히듯 **모듈 import 순환**(`TriggersModule → SchedulesModule → ExecutionEngineModule
  → WebsocketModule → WorkflowsModule`) 회피가 목적이라 그 표의 적용 기준과 다르다 — 표를 넓히지
  않은 판단은 과잉 일반화를 피한 것으로 정당하다.
- **C10 의 사실 관계(6감사 항목 수·4개 문서 공유)는 독립 재현으로 검증됨.** 트래커 파일을
  top-level 체크박스 블록 단위로 파싱하면 `secret-store.md` 를 본문에 포함하는 블록은 정확히 17개,
  그중 미해결(`- [ ]`)은 정확히 6개다(target 의 "17개, 열린 6개" 와 일치). `spec/**.md` frontmatter 를
  YAML 로 파싱해 `pending_plans` 가 이 트래커를 가리키는 문서를 세면 정확히 4개
  (`1-workflow-list.md`·`2-trigger-list.md`·`secret-store.md`·`chat-channel-adapter.md`) — R-11 의
  "4개 문서" 주장과 일치한다(본문 인용까지 포함하는 단순 grep 은 8개가 나와 다르므로, target 이
  frontmatter 필드로 좁힌 정의를 썼다는 점도 확인됨).
- **선례 판정(`aecf877c1`)도 정확하다.** 해당 커밋은 "같은 PR 에서 완전 구현되어 지연 surface 가
  아니므로 `pending_plans` 를 제거"한 것이며 `status: spec-only` 를 유지했다 — "공유 트래커가 열린
  채 `partial → implemented` 승격"과는 다른 시나리오라는 target 의 반박이 커밋 메시지와 일치한다.

## 요약

target 은 #1345 의 계약 결정(D1~D7)과 그 "기각한 대안"을 하나도 재도입하지 않으며, `secret-store.md`
§R4·`15-chat-channel.md` R8 등 기존 Rationale 이 예고했던 후속(트리거 삭제 자원 정리 넷째 경로 문서화,
listener unregister 범위 확장)을 실측과 함께 정확히 이행한다. 유일하게 새로운 정책인 C10
(`spec-impl-evidence.md §3.1` 의 공유 트래커 승격 예외)은 결정을 번복하면서 새 Rationale(R-11)을
함께 쓰는 정상 경로를 따랐고, 역사적 선례 부재 확인·이해상충 공개·감사 근거(17개 중 6개 열림, 전부
미구현 surface 아님)까지 독립 재현으로 사실 확인됐다. 이는 이미 두 차례 `--spec` 라운드(BLOCK: YES ×2)가
집중 검증한 지점이며, 그 처분들이 실제 코드·git 이력과 어긋나지 않음을 이번 라운드에서 재확인했다.
Rationale 연속성 관점에서 신규 CRITICAL/WARNING 은 없다.

## 위험도

LOW
