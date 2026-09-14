# Security Review — trigger-config-lost-update

## 검토 범위

`trigger.config` 동시 PATCH lost-update(및 그로 인한 인입 웹훅 서명 검증 fail-open) 수정
전체를 확인했다. 핵심 변경:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규) — `pg_advisory_xact_lock`
  + 락 안 재읽기(`acquireTriggerConfigLock`/`rewriteTriggerConfigLocked`)
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()`(창 1, 인라인 락)·
  `rotateBotToken()`(창 4, `rewriteTriggerConfigLocked` 사용)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel()`
  성공·실패 경로(창 2·3, `rewriteTriggerConfigLocked` 사용) + `survivesWithFresh` presence 게이트
  재계산
- `codebase/backend/src/modules/hooks/hooks.service.ts` — 인입 hot path 두 자리, `save(trigger)`
  → 컬럼 한정 `update()`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `extractInboundSigningRef`
  헬퍼 추출(동작 동일, 중복 캐스트 통합)
- 나머지(테스트·가드·plan·이전 리뷰 산출물)는 비-런타임 코드이거나 정적 분석 테스트 유틸이라
  보안 표면에 직접 영향 없음.

이 배치가 고치는 결함 자체가 **보안 결함**이다 — 동시 PATCH/rotate 가 `trigger.config` 를
in-memory 스냅샷으로 통째로 덮어써 `chatChannel.inboundSigningRef` 를 유실시켰고,
`ChatChannelInboundAuthenticator` 의 `if (!config.inboundSigningRef) return;` 가 그 유실을
"서명 검증 없음(fail-open, legacy 취급)"으로 읽어 **인입 웹훅 서명 검증이 통째로 우회**됐다.
수정은 advisory lock(`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`)으로 같은
트리거의 재작성 넷(창 1~4)을 직렬화하고, 락 안에서 최신 행을 재읽어 서브키만 머지하는
방식으로 이를 닫는다.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock` 은 `triggerId` 만으로
  재읽기·잠금을 수행하고, 함수 자체는 workspace 소유권을 검증하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 함수
    `rewriteTriggerConfigLocked`(`m.findOne(Trigger, { where: { id: triggerId } })`)
  - 상세: 현재 프로덕션 호출부 3곳(`chat-channel-binder.service.ts` 의 `setupChatChannel`
    성공/실패 경로, `triggers.service.ts` 의 `rotateBotToken`)은 전부 `TriggersService.findById(id, workspaceId)`
    로 이미 workspace 소유권이 검증된 `trigger.id` 만 넘긴다 — 실제 cross-tenant 접근 경로는
    확인되지 않았다. 다만 이 함수는 공유 유틸리티로 설계됐고(JSDoc 이 재사용을 전제), 반환값도
    "행이 삭제됐는지" 만 신호할 뿐 workspace 불일치는 구분하지 않는다. 향후 이 함수를
    workspace 검증을 아직 거치지 않은 id(예: 컨트롤러 파라미터를 직접)로 호출하는 자리가
    추가되면 IDOR 로 이어질 수 있는 형태다.
  - 제안: JSDoc 에 "호출자가 이미 workspace 소유권을 검증한 `triggerId` 만 넘겨야 한다"는
    전제를 명시하거나, `where` 절에 선택적 `workspaceId` 파라미터를 추가해 함수 자체가
    이 불변식을 강제하도록 하면 향후 재사용 시 실수를 구조적으로 막을 수 있다. 지금 배치를
    막을 사유는 아니다(현재 호출부 3곳 모두 안전).

- **[INFO]** advisory lock 에 `lock_timeout` 이 없어 같은 트리거에 대한 동시 요청은 무기한
  대기한다 — 이미 별도 리뷰(concurrency)에서 지적·설계 근거와 함께 수용된 항목의 재확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-46`
    (`acquireTriggerConfigLock`), `triggers.service.ts:550`(`update()` 인라인 락 획득)
  - 상세: 임계 구간에 외부 HTTP 호출이 없어 보유 시간이 "DB 왕복 두 번" 으로 유계라는 설계
    근거가 JSDoc 에 명시돼 있고, 선례(`execution-engine.service.ts`)와 동일한 선택이다.
    다만 같은 트리거에 대한 PATCH/rotate 를 다수 동시에 보낼 수 있는 인증 사용자가 그 트리거
    자체(자신이 접근 가능한 리소스)에 대해 순차 대기 체인을 만들어 응답 지연을 유발할 수
    있다는 점에서 완전히 무해하지는 않다 — 단, 이는 자기 자신의 리소스에 대한 self-DoS 성격이라
    타 워크스페이스에 영향을 주지 않으며, `hashtext()` 32bit 충돌로 인한 타 트리거와의 우연한
    직렬화는 이미 `database.md`(18_17_44) 에서 별도 INFO 로 수용됐다.
  - 제안: 조치 불요(이미 수용). 향후 임계 구간에 외부 호출·긴 계산이 들어가는 변경을 할 때는
    JSDoc 이 예고한 대로 `SET LOCAL lock_timeout` 을 함께 추가할 것.

- **[INFO]** 삭제 레이스의 좁은 창 — `remove()` 는 `trigger-config` advisory lock 을 잡지 않는다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:113-114`(`rewriteTriggerConfigLocked`
    의 `if (!fresh) return false;`) vs `triggers.service.ts` 의 `remove()`(`triggerRepository.remove(trigger)`)
  - 상세: `rewriteTriggerConfigLocked`/`update()` 창 1은 락을 잡은 뒤 행 존재를 확인해 삭제된
    트리거가 고아로 되살아나는 것은 막았지만, `remove()` 자체는 같은 advisory lock 을 잡지
    않으므로 `findOne` 확인 **직후** 삭제가 끼어들면 뒤이은 `update()` 는 영향 0행으로 조용히
    "성공"을 반환한다. 데이터 손상·권한 우회는 없고(고아 UPDATE 는 무해), 이미 `database.md`
    (18_17_44)에서 같은 관점으로 INFO 등재된 항목의 재확인이다. 보안 관점에서 추가할 것 없음.
  - 제안: 조치 불요(이미 트래커/별도 리뷰에 기록).

## 관점별 확인

- **인젝션**: 신규/변경 쿼리 전부 파라미터 바인딩(`pg_advisory_xact_lock(hashtext($1))`,
  TypeORM `update()`/`findOne()`/`save()`, e2e 의 raw SQL도 `$1`/`$2` 사용) — SQL 인젝션 없음.
  경로 탐색·커맨드 인젝션·XSS 대상 표면 변경 없음.
- **하드코딩된 시크릿**: 없음. e2e 스펙의 `botToken: '111:e2eTelegramBotToken'` 은 격리된 로컬
  테스트 환경용 더미 값이며 실제 프로바이더 자격 증명이 아니다.
- **인증/인가**: 컨트롤러·가드 변경 없음. `update()`/`rotateBotToken()`/`setupChatChannel()`
  모두 이미 workspace 로 스코프된 `trigger`/`triggerId` 만 락·재읽기 대상으로 삼는다
  (`m.findOne(Trigger, { where: { id: trigger.id, workspaceId } })` — 창 1). 이 수정의 핵심
  목적 자체가 "인입 웹훅 서명 검증이 fail-open 되던 경로"를 닫는 것이고, 세 쓰기 지점(창 2·3·4)
  전부 presence 게이트를 락 안에서 재계산하도록 고쳐 그 목적을 달성했다.
- **입력 검증**: DTO·validation pipe 변경 없음. `extractInboundSigningRef(config: unknown)` 은
  optional chaining 으로 비객체 입력에도 안전하게 `undefined` 를 반환한다.
- **암호화/평문 노출**: secret store 쓰기 순서·게이팅(`storeUserSuppliedSecrets`) 변경 없음 —
  이 PR 은 `config` 재작성 시점만 바꿨고 secret 자체의 저장/전송 방식은 건드리지 않았다.
- **에러 처리**: `rewriteTriggerConfigLocked` 실패(트랜잭션 예외)는 기존 `update()`/`save()`
  예외 전파 경로와 동일하게 위로 던져진다. 새 에러 메시지에 내부 상태(스택트레이스·쿼리)가
  노출되는 지점 없음. `rotateBotToken` 의 provider 원문 에러는 여전히 서버 로그로만 가고
  응답에는 변환된 코드만 실린다(기존 정책 유지).
- **의존성 보안**: `package.json`/lockfile 변경 없음, 신규 외부 패키지 없음.
- **OWASP Top 10**: 이 수정이 닫는 결함은 A07(식별 및 인증 실패)/A04(안전하지 않은 설계) 성격의
  fail-open 이었고, 수정 후에는 락 안 재계산으로 해당 클래스가 닫혔다. 그 외 신규 표면 없음.

## 요약

이 변경은 동시 PATCH/rotate 가 `trigger.config` 를 스냅샷으로 통째 덮어써 인입 웹훅
`inboundSigningRef` 를 유실시키고, 그 유실이 기존 "ref 없으면 서명 검증 skip(legacy fail-open)"
로직과 결합해 서명 검증을 완전히 우회하게 만들던 실제 보안 결함을 닫는다. 수정은
`pg_advisory_xact_lock` 기반 트리거 단위 직렬화 + 락 안 재읽기·병합 패턴을 네 자리(창 1~4)
모두에 일관되게 적용했고, workspace 스코프 검증은 기존 경로(`findById(id, workspaceId)`)를
그대로 통과한 뒤의 트리거 id 만 사용해 인가 우회를 만들지 않는다. 모든 쿼리가 파라미터
바인딩을 사용하고, 신규 하드코딩 시크릿·의존성 변경이 없으며, 에러 처리도 기존 정책을
유지한다. 남은 항목(공유 유틸의 workspace 검증 비강제, lock timeout 부재, 삭제 레이스의
좁은 창)은 전부 INFO 수준이고 현재 호출부 기준으로는 악용 경로가 확인되지 않거나 이미
설계 근거와 함께 별도 리뷰에서 수용된 사항이다. 이 배치를 막을 보안 사유는 없다.

## 위험도

NONE
