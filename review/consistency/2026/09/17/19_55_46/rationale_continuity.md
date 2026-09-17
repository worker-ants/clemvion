# Rationale 연속성 검토 — 트리거 삭제 자원 정리 구현 (`--impl-done`, scope=`spec/2-navigation/`)

## 검토 방법

scope 델타는 0 파일이다 — 이 브랜치는 `spec/2-navigation/`을 바꾸지 않았다. 대신 이미 `origin/main`에
merge-base로 존재하는 `spec/2-navigation/2-trigger-list.md` §3/§4.3/§4.4의 "2026-09-17 결정"과
`spec/conventions/secret-store.md` §2.1/§3.4를 SoT로 삼아, HEAD 워킹트리의 구현 diff(21파일/2959줄,
커밋 `1544a1501`~`773cb8650`)가 그 결정과 인접 spec(`spec/5-system/15-chat-channel.md` R8,
`spec/data-flow/1-audit.md`/`12-workspace.md`)의 Rationale을 재도입 없이 이어받는지 대조했다. 이 결정
자체는 이미 이 트래커 앞선 라운드에서 `--impl-prep` rationale_continuity(LOW, `18_00_19`)를 거쳤으므로,
이번 라운드는 **impl-prep 이후 실제 구현·3라운드 `/ai-review`가 만든 코드가 그 결정을 정확히 지키는지**에
집중했다. 핵심 구현 파일(`trigger-config-lock.ts`, `trigger-resource-release.ts`,
`trigger-resource-releaser.service.ts`, `workflows.service.ts`, `workspaces.service.ts`)을 절대경로로
직접 읽었다.

## 발견사항

- **[INFO]** R8 "반드시 unregister" 문구의 괄호가 여전히 옛 범위(트리거 삭제 하나)만 명시한다 — 이미 추적됨
  - target 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`
    `releaseExternalMany()` — `channelListenerRegistry.unregister(trigger.id)` 를 트리거·워크플로·
    워크스페이스 삭제 세 경로 모두에서 호출(실제로 구현·뮤턴트 M12로 검증됨)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R8 — *"`teardownChannel()` (또는
    `TriggersService.remove`) 시 해당 `triggerId` 의 entry 를 **반드시** unregister"*
  - 상세: 구현은 R8의 invariant를 정확히 지키며 확장했다(재도입·번복이 아니라 적용 범위 확대) — 다만
    R8 원문 괄호는 아직 `TriggersService.remove` 하나만 나열해, 그 문장만 읽는 다음 사람이 "워크플로·
    워크스페이스 삭제 경로는 unregister 의무가 없다"로 오독할 여지가 있다. 이 gap은 이미
    `plan/in-progress/trigger-deletion-release.md`의 impl-prep 처분(W1)과 체크리스트 "트래커 반영"
    항목("`15-chat-channel.md` R8 괄호")에 planner 후속으로 명시돼 있어 새로 발견된 리스크는 아니다.
  - 제안: 별도 조치 불요 — 이미 계획된 planner 후속(§4.3 과도기 문구·Planned 태그 정리와 같은 배치)에서
    R8 괄호를 "(`TriggersService.remove`·`WorkflowsService.remove`·`WorkspacesService.deleteWorkspace`)"로
    확장하면 닫힌다.

- **[INFO]** §4.4 "락 대기 상한 5초"의 spec 원문 scope가 트리거·스케줄 삭제로만 한정돼 있는데, 구현은
  워크플로·워크스페이스 부모 잠금까지 같은 상한을 확장했다 — 이미 추적됨
  - target 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`
    `lockParentAndListTriggerIds()` (`setLocalLockTimeout(manager, TRIGGER_DELETE_LOCK_TIMEOUT_MS)`를
    트랜잭션 첫 호출로 건다) — 커밋 `d2184dcf2`
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §4.4 — *"락 대기 상한 5초: 삭제는 §3 의
    트리거 단위 락을 잡기 **전에** 되돌릴 수 없는 외부 자원 해제를 끝낸다(트리거 화면 삭제는 …,
    스케줄 화면 삭제는 BullMQ job 해제)"* — 문면상 워크플로·워크스페이스 부모 행 잠금은 언급되지 않는다
  - 상세: 이 확장은 "결정의 무근거 번복"이 아니다 — 코드 JSDoc과 커밋 메시지가 "트리거·스케줄 삭제에 둔
    5초 상한과 같은 클래스"라는 근거를 명시적으로 남기고, 3라운드 `/ai-review`(`19_40_27`)가 이를
    `[SPEC-DRIFT]`로 식별해 `plan/in-progress/trigger-deletion-release.md` 체크리스트 "트래커 반영"에
    "§4.4 «락 대기 상한 5초» 를 워크플로·워크스페이스 부모 잠금까지" planner 후속으로 이미 등재했다.
    다만 그 후속이 실행되기 전까지는 §4.4 문면과 실제 동작 사이에 범위 차이가 남는다.
  - 제안: 별도 조치 불요 — 등재된 planner 후속에서 §4.4에 워크플로·워크스페이스 부모 잠금(및 뒤따르는
    멤버십·CASCADE 트리거 행 잠금)까지 상한이 적용됨을 반영하면 닫힌다.

- **[INFO]** `data-flow/12-workspace.md` §1.10 · `data-flow/10-triggers.md` §1.4의 "미구현 (Planned)" /
  현재형 서술이 이 PR로 거짓(또는 현재형으로 참으로 전환)이 됐다 — 이미 추적됨
  - target 위치: 구현 전역(워크스페이스·워크플로 삭제 자원 정리가 이제 동작) vs
    `spec/data-flow/12-workspace.md` §1.10 표 "**트리거 자원 정리 — 미구현 (Planned)**" 행,
    `spec/data-flow/10-triggers.md` §1.4 "직접 삭제" 행
  - 과거 결정 출처: 위 두 spec 문서 자체(가장 최근 갱신은 이 브랜치 merge-base `aaee17206`의
    "2026-09-17 결정" 커밋)
  - 상세: `spec_impact: none`으로 진행된 이 PR은 spec 문서를 고치지 않으므로(허용된 정책 — developer는
    spec 변경 필요 시 planner에 위임), 구현이 앞서고 문서가 뒤처지는 짧은 창이 남는다. impl-prep 라운드
    W5가 이미 이 정확한 항목을 지적했고, plan 체크리스트 "트래커 반영"에 "Planned 태그·§4.3 과도기 문구
    제거 · `secret-store.md` `partial`→`implemented`"로 planner 후속이 등재돼 있다. 이는 결정 번복이
    아니라 문서-구현 동기화 지연이며, 이미 self-refutation 예외 대상이 아니라(제품 정의·계약 성격 문장이라)
    developer가 직접 고치지 않고 planner 턴으로 넘긴 것도 정책과 일치한다.
  - 제안: 별도 조치 불요 — 이미 등재된 planner 후속 턴에서 두 문서의 Planned 태그·현재형 서술을
    "구현됨"으로 갱신하면 닫힌다. `--impl-done`이 이 문서 드리프트를 이유로 BLOCK할 필요는 없다(spec_impact
    선언·후속 등재가 이미 존재).

## 확인한 continuity 정합 — 반례를 찾지 못한 지점 (참고용, 위험 아님)

- **Cafe24 lock 기각 선례 재인용 정합** — `trigger-config-lock.ts`의 `rewriteTriggerConfigLocked` JSDoc이
  인용하는 "`spec/2-navigation/4-integration.md`가 Cafe24 토큰 갱신에서 advisory lock을 명시적으로
  기각했다"는 실제로 그 문서에 있는 결정이며(DB 커넥션 점유 시간 증가 사유), 이 구현은 그 반론을 받아들여
  "외부 호출은 락 밖" 구조를 유지한다 — 기각된 대안의 재도입이 아니라 그 반론을 설계에 반영한 사례.
- **`#676` forwardRef 순환 제거 선례** — `TRIGGER_RESOURCE_RELEASER` 심볼 + `ModuleRef.get(..., {
  strict: false })` 지연 해석은 plan이 인용한 `#676` 선례(새 `forwardRef`로 순환을 때우지 않는다)를
  그대로 따른다. 새 `forwardRef` 도입 0건(실측: `workflows.module.ts`/`workspaces.module.ts` import 목록에
  `TriggersModule` 부재).
- **secret-store.md §2.1/§3.4 정합** — "행 삭제 커밋 뒤 비밀 삭제", "prefix는 UUID만", "SecretResolver는
  PostgreSQL 결합 없음(같은 트랜잭션에서 지우지 않는다)" 세 불변식 모두 `trigger-resource-release.ts`가
  그대로 구현하며, 옛 "행 삭제 전 비밀 삭제" 순서(트리거 삭제 경로가 이 PR 이전에 갖고 있던 순서)를
  다시 쓰지 않는다.
- **R8 listener registry invariant** — impl-prep 라운드에서 WARNING으로 지적됐던 "검증 항목 누락"은
  이번 구현에서 뮤턴트 M12(`releaser — listener unregister(R8) 제거`)로 실제로 검증됐다 — 해소 확인.
- **audit 미기록 원칙 비침해** — `deleteTriggerSecretsAfterCommit`의 "감사 행을 남기지 않는다"는
  `data-flow/1-audit.md`의 "`workspace.deleted`는 의도적 미기록(FK CASCADE로 감사 row 영속 불가)"
  원칙과 같은 방향이며, 이 PR이 새로 감사 기록 의무를 만들거나 어기지 않는다(트리거 직접 삭제 경로의
  `trigger.deleted` 감사는 기존 그대로 유지, cascade 경로는 애초에 애플리케이션 코드를 거치지 않아 감사
  대상 밖 — 이 PR 이전부터의 동작).
- **잠금 순서 선례(소유권 이전) 인용 정합** — `assertWorkspaceDeletable`의 "워크스페이스 → 멤버십" 순서가
  "`transferOwnership`과 같게"라는 주석 근거는 `spec/data-flow/12-workspace.md` §1.6 실제 구현
  (`workspace`·`workspace_member` 동일 트랜잭션 갱신)과 대조해 타당하다.
- **D2/D4/D6 기각 대안 비재도입** — 트리거별 API 재호출, 행 삭제 전 비밀 삭제, `workspace_id` 직접 DELETE
  세 기각안 모두 코드에 재도입되지 않았다(impl-prep 라운드에서 이미 확인, 실제 구현도 동일 구조 유지).

## 요약

이번 구현은 spec 문서(`2-trigger-list.md` §3/§4.3/§4.4, `secret-store.md` §2.1/§3.4)가 이미 merge-base에서
확정해 둔 "네 경로 모두 트리거 자원을 정리한다"는 결정을 재도입 없이, 그리고 상당수 지점에서 과거 기각
사유(Cafe24 lock 기각, `#676` forwardRef 회피)를 코드 주석에 명시적으로 재인용하며 충실히 구현했다.
CRITICAL 급 재도입·원칙 위반은 발견하지 못했다. 남은 세 항목은 모두 "결정 확장/구현 선행에 따른 spec
문면과의 일시적 범위 차이"이며, 셋 다 이미 이 PR의 plan(`trigger-deletion-release.md`) 체크리스트
"트래커 반영"에 planner 후속으로 명시 등재돼 있어 새로운 미추적 리스크가 아니다 — INFO로 하향한다.

## 위험도

LOW
