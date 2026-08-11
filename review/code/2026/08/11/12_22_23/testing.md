# 테스트(Testing) 리뷰 — trigger 시크릿/토큰 회전 3종 감사 회귀

## 재현 방법

`.claude/tests`·`codebase/backend` 를 건드리지 않고, `codebase/backend` 를
repo 밖 scratch(`/private/tmp/.../scratchpad/trigger-audit-mutation/backend`)로
`rsync`(node_modules 는 원본에 symlink)한 뒤 그 사본에서만 파일을 뮤테이션하고
`npx jest --config jest.config.ts modules/triggers/triggers.service.spec.ts
modules/triggers/triggers.controller.spec.ts` 로 재현했다. 원본 baseline —
`80 passed, 1 skipped`. 뮤테이션마다 원본을 `.orig` 백업에서 복원 후 재검증했고,
마지막에 원 worktree(`git status --short`)가 무변경임을 확인했다.

## 발견사항

- **[CRITICAL]** `rotateBotToken` 의 감사 기록(성공/실패 불변식 모두)이 어떤 테스트로도 검증되지 않는다 — 뮤테이션 2종이 전부 GREEN
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1113`(`recordAudit` 호출) / 테스트 부재 지점: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1652`(`describe('TriggersService.rotateBotToken — 6단계 오케스트레이션'`) 및 `:2248`(`describe('TriggersService — 감사 로깅 (trigger.*)'`)
  - 상세: `rotateNotificationSecret`/`revokePerTriggerToken` 은 "감사 로깅" describe 에 성공 기록 + "실패하면 남기지 않는다" 두 축이 모두 있지만(`:2327`, `:2346`, `:2368`), `rotateBotToken` 은 이 describe 에 항목 자체가 없다. `6단계 오케스트레이션` describe 는 `AuditLogsService.record` 를 mock 만 하고(`:1679` — `// 감사 로깅은 부수 효과 ... 실제 기록 여부는 audit 전용 describe 가 따로 단언한다`) 그 describe 블록 안에는 `record` 에 대한 `expect` 가 **단 한 건도 없다**(전수 grep 확인). 즉 주석이 "다른 곳에서 검증된다" 고 가리키는 대상이 실제로는 `rotateBotToken` 을 다루지 않아, 그 주석 자체가 커버리지 착시를 만든다.
  - 재현: scratch 사본에서 두 가지 독립 뮤테이션을 각각 적용 — (1) `recordAudit` 호출 블록(`triggers.service.ts:1111-1119`) 전체 삭제, (2) 같은 호출을 `findById` 직후·모든 가드절(`CHAT_CHANNEL_NOT_CONFIGURED`/`PROVIDER_UNKNOWN`/`ENDPOINT_REQUIRED`)과 6단계 전부보다 앞으로 옮겨 무조건 발화하도록 변경(원래 있던 호출은 제거). 둘 다 `triggers.service.spec.ts` + `triggers.controller.spec.ts` 전체 81건(80 pass+1 skip) 기준 **실패 0건**으로 GREEN — 완전한 사각지대다.
  - 영향: `rotateBotToken` 은 코드 주석(`triggers.service.ts:1111-1112`, "위 6단계 중 어디서든 던지면 회전은 일어나지 않은 것이고, 그때 감사 row 만 남으면 '회전됐다' 는 거짓 기록이 된다")이 스스로 명시한 불변식을 갖고 있는데, 그 불변식을 지키는 테스트가 하나도 없다. 이 메서드는 세 회전/폐기 메서드 중 유일하게 6단계·다중 외부 I/O(`secrets.resolve`, `secrets.rotate`×3, `adapter.setupChannel`, `triggerRepository.update`)를 거치므로 실패 지점도 가장 많다 — 향후 리팩터링이 `recordAudit` 위치를 앞으로 옮기거나(사고 조사 시 거짓 "회전됨" 행 생성) 아예 지워도(감사 공백 재발) 어떤 테스트도 이를 잡지 못한다. 이번 PR 이 메꾸려는 "감사 공백" 문제가 세 메서드 중 가장 복잡한 곳에서 형태만 바뀌어 재발할 수 있는 상태다.
  - 제안: `TriggersService — 감사 로깅` describe 에 최소 2건 추가 — ① 성공 시 `auditLogs.record` 가 `action: 'trigger.chat_channel_bot_token_rotated'` 로 호출됨을 단언(해당 describe 의 `createBaseProviders` 에 `ChannelAdapterRegistry.has/get`·`SecretResolverService.resolve/rotate`·`chatChannel` config 를 이 테스트 전용으로 override), ② `adapter.setupChannel` 이 던지는 등 6단계 중간 실패 시 `auditLogs.record` 가 `not.toHaveBeenCalled()` 임을 단언(이미 존재하는 "6단계 오케스트레이션" describe 의 실패 케이스들 — `chatChannel 미설정`/`provider 미등록`/`endpointPath 누락` — 에 이 단언을 추가하는 것으로도 충분).

- **[INFO]** 오케스트레이션 describe 의 안내 주석이 가리키는 대상이 실제로 비어 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:1677-1678`
  - 상세: 위 CRITICAL 항목의 근본 원인이자 별도로 짚을 가치가 있는 문서화 결함 — "실제 기록 여부는 audit 전용 describe 가 따로 단언한다" 는 주석이 리뷰어·차기 작성자에게 "이미 커버됐다" 는 잘못된 확신을 준다. CRUD 3종(`create`/`update`/`remove`)에는 실제로 대응 항목이 있어 이 패턴이 신뢰를 얻었지만, 회전/폐기 3종 중 2개만 그 패턴을 따랐고 `rotateBotToken` 은 빠졌다.
  - 제안: 위 CRITICAL 항목 해결 시 자연히 해소된다. 별도 조치 불필요, 함께 처리.

- **[INFO]** 신규 감사 단언 3건이 `details: { type: ... }` 를 검증하지 않는다 — 형제 테스트 대비 완화된 단언
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2327`(`rotateNotificationSecret`), `:2346`(`revokePerTriggerToken`) — `expect.objectContaining` 에 `details` 필드 없음
  - 상세: 바로 위 `create`(`:2281`)/`update`(`:2302`) 테스트는 `details: { type: 'webhook' }` 까지 명시적으로 단언하는데, 신규 3종 중 성공 케이스 2건은 `workspaceId`/`userId`/`action`/`resourceType`/`resourceId` 만 검증하고 `details` 는 비검증이다. `recordAudit` 헬퍼(`triggers.service.ts:212-227`)가 `details: { type: params.type }` 를 항상 채우므로 `type` 배선이 깨져도(예: `type: trigger.type` 을 다른 값으로 오기) 이 3건 중 어느 것도 잡지 못한다.
  - 제안: 경미하다 — `type` 배선 자체는 세 메서드 모두 `trigger.type` 을 그대로 넘기는 동일 패턴이라 회귀 가능성은 낮지만, 형제 테스트와의 단언 수준 불일치는 다음 리뷰에서 "왜 여기만 details 를 안 보나" 로 반복 지적될 소지가 있다. `details: { type: 'webhook' }` 한 줄씩 추가 권장 (CRITICAL 아님, 시간 나면).

- **[PASS/확인]** orchestrator 가 보고한 3종 뮤테이션 — 전부 독립 재현, RED 확인, vacuous 아님
  - (1) 감사 호출 제거(`rotateNotificationSecret` 의 `recordAudit` 블록, `triggers.service.ts:925-931` 삭제) → `TriggersService — 감사 로깅 (trigger.*) › rotateNotificationSecret 는 trigger.notification_secret_rotated 를 남긴다` 딱 1건만 실패(71개 중 69 pass+1 skip+1 fail).
  - (2) `revokePerTriggerToken` 의 액션을 `TRIGGER_INTERACTION_TOKEN_REVOKED` → `TRIGGER_NOTIFICATION_SECRET_ROTATED` 로 스왑 → `revokePerTriggerToken 는 trigger.interaction_token_revoked 를 남긴다` 딱 1건만 실패, `Received` 값이 스왑된 액션명으로 정확히 관측됨.
  - (3) `rotateNotificationSecret` 의 `recordAudit` 호출을 가드절(`NOTIFICATION_NOT_CONFIGURED` 검증) **앞**으로 이동 → `rotateNotificationSecret 가 던지면 감사를 남기지 않는다` 딱 1건만 실패(`Received number of calls: 1`). 세 뮤테이션 모두 의도한 단일 테스트만 정확히 잡아내 vacuous 패턴(과다실패로 원인 불명·혹은 무실패) 이 아님을 확인.
  - 컨트롤러 배선 3건도 각각 독립 뮤테이션(인자 스왑: `rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` 의 `workspaceId`↔`userId`)으로 재현 — 신규 등재 테스트가 정확히 그 스왑을 잡았고, `rotateBotToken` 스왑은 기존 `TriggersController.rotateBotToken` describe 의 위임 검증 테스트와 신규 배선 테스트 양쪽에서 이중으로 잡혔다(과잉이 아니라 두 describe 의 관심사가 겹치는 지점이라 자연스러움).

- **[정보]** 세 번째 뮤테이션의 최초 시도가 GREEN 이었다는 orchestrator 서술은 타당한 자기 검증 사례
  - 상세: "검증문 뒤였다" — 즉 최초 위치가 가드절 통과 후·`save()` 앞 어딘가였다면, 원래 코드도 가드절 뒤에서 실행되므로 실패 경로에서는 애초에 도달하지 않아 동작 차이가 없는(관측 불가능한) 뮤턴트였을 가능성이 높다. 이는 이 저장소에 기록된 "뮤턴트 유효성 선검증" 교훈과 일치하는 자체 발견·교정이며, 별도 조치가 필요하지 않다. (직접 그 잘못된 위치를 재구성해 재검증하지는 않았다 — 서술만으로도 판단 가능한 자명한 사례라 재현 비용 대비 가치가 낮다고 판단.)

- **[INFO]** `.claude/tests/test_consistency_bundle_priority.py` — 범위 밖(harness), 완화된 단언이 근거 있음
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:525-528`(`assertLess(got["rank"], got["tier0_size"], ...)`), `:562-568`(`collect_context` 케이스)
  - 상세: `assertEqual(rank, 0)` → `assertLess(rank, tier0_size)` 로 완화됐지만 `assertTrue(got["tier0"], ...)` 단언은 유지되고 `tier0_size` 를 함께 emit 해 "드롭 구간 밖" 이라는 원래 재려던 성질은 여전히 검증한다. 완화 근거(같은 디렉터리 spec 을 커밋한 브랜치에서 정상 코드가 RED 였다는 실측, `1-auth.md` 사례)가 주석에 명시돼 있어 임의 완화가 아니다. 이 PR 의 핵심 변경(감사 회귀)과는 무관한 별도 harness 결함 수정이라 이번 리뷰의 주된 관심사는 아니며, 조치 불필요.

## 요약

핵심 회귀(컨트롤러 행위자 배선 3건 + 서비스 감사 기록 3건)는 견고하다 — orchestrator 가 보고한 뮤테이션 3종을 scratch 사본에서 독립적으로 재현한 결과 전부 RED 였고, 각 뮤테이션이 정확히 의도한 단일 테스트만 실패시켜 vacuous 하지 않음을 확인했다. 다만 요청대로 "아직 안 잡히는 축"을 전수로 탐색한 결과, `rotateBotToken`(6단계 오케스트레이션, 가장 복잡한 회전 경로)의 감사 기록은 성공 케이스와 "중간 실패 시 미기록" 불변식 **둘 다** 어떤 테스트로도 검증되지 않는다 — 두 개의 독립 뮤테이션(호출 완전 삭제, 무조건 조기 발화)이 81개 테스트 전체를 통과시켰다. 이는 이번 작업이 메우려던 "특권 회전 작업의 감사 공백" 문제가 세 메서드 중 가장 위험도가 높은 곳(성공 경로 자체가 6단계·외부 I/O 다중)에서 미해결로 남아 있다는 뜻이며, 코드 자신의 불변식 주석과 어긋난다. 이 CRITICAL 하나를 닫으면(성공 단언 + 실패-시-미기록 단언 각 1건) 이번 PR 의 테스트 커버리지는 완결된다.

## 위험도

CRITICAL
