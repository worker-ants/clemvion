# 보안(Security) 리뷰

## 발견사항

- **[INFO]** 트리거 회전 secret 정화(`sanitizeForResponse`)가 **4개의 독립된 deny-list**
  (`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` · `NOTIFICATION_SIGNING_STRIP_KEYS` ·
  `INTERACTION_RESPONSE_STRIP_KEYS` · `TRIGGER_RESPONSE_STRIP_COLUMNS`)로 구성돼 있다 —
  구조적으로 fail-open 이다(새 비밀 필드를 엔티티/JSONB 에 추가하면서 해당 목록에 키를
  추가하지 않으면 기본값이 "노출"이다).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — 함수
    `sanitizeForResponse` 와 그 위 네 상수 선언부(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS`,
    `NOTIFICATION_SIGNING_STRIP_KEYS`, `INTERACTION_RESPONSE_STRIP_KEYS`,
    `TRIGGER_RESPONSE_STRIP_COLUMNS`).
  - 상세: 이 PR 자신의 JSDoc(`sanitizeForResponse` 바로 위, "## 왜 세 목록인가 — 이 메서드가
    두 번 좁게 틀렸다" 절)이 정확히 같은 형태의 실패가 이미 세 번 재발했음을 기록하고
    "다음에 비밀 축이 하나 더 생기면 목록을 늘리지 말고 선언적 SoT(엔티티 데코레이터)로
    옮길 것"이라고 스스로 적어 두었다. 즉 이 PR 은 그 위험을 새로 만든 것이 아니라 인지하고
    문서화한 상태이고, 뮤테이션 테스트(`triggers.service.spec.ts`, e2e 2건)로 현재 네 축을
    모두 회귀 테스트로 고정했다. 다만 **다섯 번째 비밀 축**이 생기면 같은 패턴이 다시
    터질 구조적 위험은 여전히 남아 있다.
  - 제안: 조치 불요(현 PR 범위). 다음에 비밀 필드가 하나 더 추가되는 시점에는 deny-list
    확장 대신 `@Sensitive()` 데코레이터 같은 선언적 allow-list/SoT 전환을 우선 검토할 것 —
    코드 자신의 다짐과 동일.

- **[INFO]** `notification_secret_v2` 가 24h rotation grace 동안 평문으로 DB 에 저장되고
  `SecretResolver` 를 우회한다는 사실이 이번 diff 의 코드 주석·CHANGELOG 로 처음 명문화됐고,
  이는 `spec/5-system/14-external-interaction-api.md §7.1`("ref 만 보관")과 모순된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` —
    `TRIGGER_RESPONSE_STRIP_COLUMNS` 상수 JSDoc 및 `rotateNotificationSecret` 메서드 JSDoc.
    `CHANGELOG.md` "Unreleased — 트리거 회전 secret 이 두 엔드포인트로 나갔다" 절.
  - 상세: 이 설계 자체는 **이 PR 이 만든 결함이 아니다** — 이 PR 은 오히려 그 평문이
    두 엔드포인트(`/api/triggers`, `/api/schedules` 조인)로 새어 나가던 것을 막는
    수정이다. spec 문서와의 모순은 이미 `review/consistency/2026/09/05/19_08_19/RESOLUTION.md`
    가 Critical 로 잡아 developer 권한 밖(spec 쓰기 권한 없음)이라 planner 인계로
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재해 둔 상태다. 중복
    차단을 피하기 위해 여기서는 정보로만 남긴다.
  - 제안: 조치 불요(이미 등재·인계됨). planner 턴에서 (1) spec 을 실측대로 정정 +
    `secret-store.md §1` 예외 목록 등재, 또는 (2) 코드 측을 실제 ref 저장으로 전환하는
    설계 변경 중 하나를 선택해야 한다.

- **[INFO]** `CHANGELOG.md` 가 이번 유출("이미 나간 것은 회수되지 않는다")에 대해 영향 범위·
  권고 조치(로그/APM/캐시 점검, 해당 트리거의 notification secret 회전 권고)를 명시적으로
  적어 두었다 — 사고 후속 조치 관점에서 바람직한 패턴으로 특기할 만하다.
  - 위치: `CHANGELOG.md` (신규 절 "Unreleased — 트리거 회전 secret 이 두 엔드포인트로
    나갔다").
  - 제안: 조치 불요. 참고용 긍정 관찰.

## 점검한 항목 (결함 없음 확인)

- **비밀 스트립 경로 완전성**: `TriggersService.findAll`/`findOneDetail`/`create`/`update`
  네 경로 모두 `sanitizeForResponse` 를 거치고, `deleteSecretColumns` 는 `Object.assign` 으로
  만든 **새 객체**에서만 컬럼을 지운다(원본 엔티티·DB 저장 경로는 건드리지 않음) — 응답
  정화가 영속 계층에 부작용을 남기지 않는다.
- **스케줄 조인 유출**: `SchedulesService.findAll`(`leftJoinAndSelect('s.trigger','t')`)·
  `findById`(`relations:['trigger','trigger.workflow']`) 가 싣는 Trigger 엔티티 전체를
  `SchedulesController.toResponse` 가 응답 경계에서 `{id, name, workflowId, workflow?.name}`
  4필드로 좁힌다 — `runNow`/`getPreview` 등 다른 서비스 메서드는 스케줄/트리거 엔티티를
  반환하지 않아 우회 경로가 없음을 확인했다(`getWorkflowIdForSchedule` 은 내부용, 응답에
  노출 안 됨).
  `Schedule` 엔티티 자체에도 `trigger` 관계 외 별도 비밀 컬럼은 없다.
- **감사 로그**: `rotateNotificationSecret`/`revokePerTriggerToken` 모두 신규 평문 secret 을
  `recordAudit` 의 `details` 에 담지 않는다(`{ type: params.type }` 뿐) — 앞선 PR(#1288)의
  감사 로그 자격증명 유출 수정과 일관됨.
- **`allowMissing` 신규 옵션**(`response-contract.ts`): required 필드의 "누락" 만 면제하고
  "선언되지 않은 키(undeclared)" 축은 건드리지 않는다 — 이 옵션으로 비밀 유출 검증을
  우회할 수 없음을 `response-contract.spec.ts` 의 `allowMissing 은 undeclared 를 면제하지
  않는다` 테스트로 확인했다. 실사용도 `formatVersion`(Planned 갭, 비-비밀) 1건뿐.
  `contractForDto` 메모이제이션도 DTO 클래스의 정적 데코레이터에서만 계약을 도출하므로
  캐시 오염을 통한 검증 우회 경로는 없다.
- **입력 검증**: `assertChatChannelInputSafe`/`assertInboundSigningPlaintextByProvider` 가
  내부 전용 필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`) 외부 입력을 차단하고,
  provider 별 형식(hex 정규식)을 강제한다 — 이번 diff 에서 변경되지 않은 기존 로직이며
  퇴행 없음.
- **하드코딩된 시크릿·인젝션·SQL/커맨드 인젝션**: 이번 diff 에서 새로 추가된 쿼리는 없고
  (기존 `createQueryBuilder`/`ILIKE` 파라미터 바인딩 방식 유지), 신규 상수·테스트 fixture
  값(`wsk_should_not_leak` 등)은 전부 테스트 전용 placeholder — 실제 자격증명 아님.

## 요약

이번 diff 는 §5.4 응답-계약 검증자를 넓히는 과정에서 실측으로 발견한 트리거 회전 secret
(`notificationSecretV2` 평문, `chatChannelTokenV2` ref)의 이중 유출 경로(트리거 자신의
API 4곳 + 스케줄 조인)를 막는 **보안 수정**과, 이미 응답에 실리고 있었으나 DTO 선언이
누락됐던 필드 24개를 문서화하는 계약 스윕이 함께 묶인 PR 이다. 수정 자체는 응답 경계에서
넷으로 분리된 비밀 축(chat-channel JSONB·notification.signing JSONB·interaction JSONB·
엔티티 컬럼)을 전부 덮고, 각 축마다 뮤테이션 테스트로 되돌림을 확인한 unit·e2e 회귀를
새로 붙였으며, 스케줄 쪽은 컨트롤러 응답 경계에서 트리거를 참조 4필드로 좁혀 조인 유출을
차단한다. 감사 로그에는 신규 평문이 남지 않고, 신규 `allowMissing` 계약 옵션도 undeclared
축(유출 탐지)을 면제하지 못하도록 설계·테스트돼 있다. 이번 diff 가 새로 만든 취약점은
발견되지 않았다. 유일하게 남는 구조적 우려는 비밀 정화가 4개의 개별 deny-list 에 의존해
다섯 번째 비밀 축이 추가될 때 같은 실패가 재발할 수 있다는 것인데, 이는 코드 자신의
JSDoc 이 이미 인지·경고하고 있는 사항이라 이번 리뷰에서는 정보성으로만 남긴다. 또한 이
diff 가 드러낸 `notification_secret_v2` 평문 저장과 spec 문서(§7.1 "ref 만 보관") 간의
모순은 이 PR 의 결함이 아니라 선행 아키텍처 결정이며, 이미 별도 consistency 리뷰가
Critical 로 잡아 planner 인계 트래커에 등재돼 있다.

## 위험도

NONE
