# Rationale 연속성 검토 — `spec/2-navigation/`(impl-prep, `plan/in-progress/trigger-deletion-release.md`)

## 검토 방법

`--impl-prep` 대상은 `spec/2-navigation/2-trigger-list.md`(§3·§4.3·§4.4)이지만, 착수 전 실측·설계는
`plan/in-progress/trigger-deletion-release.md` 가 담고 있고 그 결정 SoT 는
`plan/complete/spec-draft-deletion-releases-trigger-resources.md`(D1~D7)다. 번들 프롬프트가 컨텍스트
예산으로 절단한 `spec/conventions/secret-store.md` · `spec/data-flow/10-triggers.md` ·
`spec/data-flow/12-workspace.md` · `spec/5-system/4-execution-engine.md` · `spec/5-system/15-chat-channel.md` ·
`spec/data-flow/1-audit.md` 전체를 저장소에서 직접 읽어 대조했다. 이 결정 자체는 이미 이 워크트리에서
`--spec` 3회(16_32_44 → 17_05_02 → 17_20_54 BLOCK:NO)와 rationale_continuity 1회(LOW)를 거쳤으므로,
이번 라운드는 **그 결정을 구현 계획(`trigger-deletion-release.md`)이 정확히 이어받고 있는지**에 집중했다.

## 발견사항

- **[WARNING]** R8 "반드시 unregister" invariant 가 설계에는 포함됐지만 체크리스트 검증 대상에서 빠졌다
  - target 위치: `plan/in-progress/trigger-deletion-release.md` "설계" 절의
    `TriggerResourceReleaser` 불릿("외부 해제(schedule job · teardown · listener registry)")과
    "체크리스트" 절의 "e2e 먼저" / "단위" 두 항목
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R8 "Fan-out facade 의 분리" —
    *"`teardownChannel()` (또는 `TriggersService.remove`) 시 해당 `triggerId` 의 entry 를 **반드시**
    unregister — 누락 시 비활성화된 trigger 에 event 가 흘러갈 위험을 사전 차단"*
  - 상세: 이 draft/plan 이 넓히는 "정리 대상 넷"(schedule job·chat channel teardown·listener
    registry·`secret_store`) 중 listener registry 는 R8 이 "반드시" 라는 강한 단어로 못박은
    유일한 항목이다. `trigger-deletion-release.md` 의 설계 불릿은 이를 올바르게 포함시켰으나,
    바로 아래 체크리스트의 검증 항목은 "비밀 0행 + 대조군 생존 + schedule job 해제(e2e)" 와
    "순서·보상 5자리·ModuleRef 해석 실패 시 던짐·워크스페이스 선검사(단위)" 만 명시한다 —
    listener registry unregister 를 검증 대상으로 이름 붙이지 않았다. 인메모리 상태라 e2e 관측이
    상대적으로 어렵다는 사정은 있으나, 그렇다고 검증 항목에서 조용히 빠지면 TEST WORKFLOW 게이트가
    이 invariant 회귀를 못 잡는다 — 정확히 이 결함 클래스(«정리 대상 넷 중 하나만 실제로 됨»)가
    이번 DRT-2 자체의 출발점이었다.
  - 제안: 체크리스트의 "단위" 항목에 "네 경로 모두 `ChannelListenerRegistry.has(triggerId)` 가 정리
    후 false" 같은 명시적 서술을 추가하거나, e2e 항목에 chat-channel 트리거가 섞인 워크플로/워크스페이스
    삭제 케이스를 최소 1개 포함시켜 registry 상태를 관측한다.

- **[INFO]** `ModuleRef.get(TOKEN, { strict: false })` 의 새 실패 모드(throw)가 유일한 기존 선례
  문서와 다른데 그 문서에는 반영되지 않는다
  - target 위치: `plan/in-progress/trigger-deletion-release.md` "모듈 위치" 절 —
    *"하나가 다르다: 못 찾으면 no-op 이 아니라 던진다."*
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.4 표 — `ModuleRef.get(X, { strict: false })`
    행의 사례가 `ExecutionEngineService → NotificationsService`(*"미해소 시 `execution_failed` dispatch 가
    조용히 no-op"*)와 `NotificationsService → WebsocketService` 둘뿐이고, 이 표가 예시로 든 실패
    모드는 둘 다 **no-op** 이다.
  - 상세: `trigger-deletion-release.md` 는 이 차이를 스스로 인지하고 근거("알림은 빠져도 되지만
    여기서 조용히 넘어가면 이 결함이 그대로 재발한다")를 명시한다 — "결정의 무근거 번복"은 아니다.
    다만 이 근거는 이 plan 파일에만 있고, `spec_impact: none` 이라 `4-execution-engine.md` §4.4 표에는
    반영되지 않는다. 그 표는 "`ModuleRef.get(strict:false)` = DI 순환 우회" 라는 적용 기준만 규정하고
    실패 모드(no-op vs throw)를 규범화하지 않으므로 **원칙 위반은 아니다** — 다만 이 표만 읽는
    다음 개발자가 "이 패턴은 항상 no-op 로 흡수한다" 로 일반화해 트리거 쪽 throw 를 놓치거나, 반대로
    트리거 쪽 throw 를 다른 소비자에 그대로 복제할 위험이 있다.
  - 제안: 조치 불요로 볼 수도 있으나, DRT-2 구현 커밋 메시지 또는 후속 planner 턴에서
    `4-execution-engine.md` §4.4 표 사례 열에 세 번째 행(트리거 쪽, throw)을 추가해 실패 모드가
    사례마다 다르다는 것을 명문화하면 재발을 막는다.

- **[INFO]** DRT-2 트래커의 "부수 주의 둘"이 이 plan 파일에 재기술되지 않았다 — 설계상으로는 이미
  충족되는 것으로 보이나 명시적 체크 항목이 없다
  - target 위치: `plan/in-progress/trigger-deletion-release.md` 전체(해당 절 없음) vs
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 DRT-2 원문 "부수 주의 둘"
  - 과거 결정 출처: `spec/data-flow/1-audit.md` 123~124행 — *"`workspace.deleted` 는 의도적
    미기록 — `audit_log.workspace_id` ON DELETE CASCADE 로 삭제 감사 row 가 영속 불가하기
    때문"*(`spec/data-flow/12-workspace.md` §Rationale 과 교차 인용) + `secret-store.md` §2.1 †
    "prefix 불변식 2건"(LIKE 메타문자 거부).
  - 상세: 트래커 DRT-2 항목은 "커밋 뒤 정리 단계는 이미 지워진 `workspace_id` 를 참조하는 감사
    행을 남기지 않는다(FK 위반)" 와 "새 `deleteByPrefix` 호출부도 prefix 를 UUID 로 조립한다"를
    명시 "부수 주의"로 못박아 뒀다. `trigger-deletion-release.md` 의 설계는 실패 처리를
    `deleteTriggerSecretsAfterCommit(secrets, logger, ids, caller)` — **`logger`**(애플리케이션 로그)로
    명시해 `audit_log` DB 테이블에 쓰지 않는 것으로 보이므로 이 invariant를 사실상 지키는 설계이지만,
    그 사실이 이 plan 문서 안에 "왜 logger 이고 audit_log 가 아닌지"로 명시돼 있지 않다 — 구현 중
    누군가 실패를 감사 로그로 승격시키고 싶어질 때 이 FK 제약을 다시 실측하지 않고 넘어갈 위험이 있다.
  - 제안: "설계" 절의 `deleteTriggerSecretsAfterCommit` 불릿에 "audit_log 아님 — 워크스페이스 경로는
    커밋 뒤 시점에 `workspace_id` FK 가 이미 없다" 한 줄을 추가해 두면 향후 회귀를 막는다.

## 확인한 continuity 정합 — 반례를 찾지 못한 지점 (참고용, 위험 아님)

- **D2 "기각한 대안"(트리거마다 `DELETE /api/triggers/:id` 를 호출)** — plan 의 "네 삭제 경로" 설계는
  워크플로·워크스페이스 모두 "트리거 열거 → (부모 행) 삭제" 로 트리거 삭제를 FK CASCADE 단일
  트랜잭션에 맡기고 있어, 기각된 "트리거마다 API 재호출" 안을 재도입하지 않는다.
- **D4 "행 삭제 커밋 뒤 비밀 삭제" 순서 반전** — plan 은 트리거 경로에도 "커밋 뒤 비밀(순서 반전)"을
  명시해 `secret-store.md §R4`/§2.1/§5.3/§6(2026-09-17 개정)과 정합한다. 옛 "행 삭제 전 삭제" 순서를
  다시 쓰지 않는다.
- **`secret-store.md §3.4` "백엔드 swap 을 위해 워크스페이스 단위 삭제를 인터페이스에 두지 않는다"** —
  plan 은 D6 그대로 "부모 행을 잠근 뒤 같은 트랜잭션에서 열거" + 트리거 단위 prefix 로 워크스페이스
  삭제를 처리해, 1차 draft 에서 철회된 "workspace_id 로 직접 DELETE" 안을 재도입하지 않는다.
- **트리거 목록 §3 "외부 provider 호출은 락 밖"** — plan 의 네 경로 모두 외부 해제를 트랜잭션·락
  **밖**에 둔다는 원칙을 그대로 유지한다.
- **`#676`(`forwardRef` 순환 제거 선례)** — plan 은 이 선례를 직접 인용하며 새 순환을 `forwardRef` 로
  때우지 않고 모듈 위치 자체를 바꾸는 쪽을 택했다 — 인용이 실제로 트래커 텍스트("`e827ed2a7`")와
  일치함을 확인했다.

## 요약

`spec/2-navigation/2-trigger-list.md` §3·§4.3·§4.4 를 포함한 이번 impl-prep 대상 spec 은 이미 세 라운드의
`--spec` 검토(BLOCK→BLOCK→BLOCK:NO)와 독립된 rationale_continuity 검토(LOW)를 거쳐 커밋된 상태이고,
직접 대조한 결과 새로운 모순은 찾지 못했다. 구현 계획(`trigger-deletion-release.md`)도 D1~D7 결정과
"기각된 대안"을 재도입하지 않고 있으나, `spec/5-system/15-chat-channel.md` R8 이 "반드시" 로 못박은
listener registry unregister invariant 가 설계에는 있으면서 체크리스트 검증 대상에서는 빠져 있어
회귀를 게이트가 못 잡을 위험이 하나 있다(WARNING). 나머지 둘은 이미 설계로 사실상 충족되거나
새 근거가 함께 적혀 있어 낮은 수준의 문서 정합 보완 제안(INFO)에 그친다.

## 위험도

LOW
