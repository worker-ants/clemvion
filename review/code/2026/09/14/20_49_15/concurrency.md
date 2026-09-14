# 동시성(Concurrency) 코드 리뷰 — trigger-config-lost-update (5라운드, 20_49_15)

## 검토 범위

이전 네 라운드(`18_17_44` → `19_07_43` → `19_44_08` → `20_17_16`)를 거치며 핵심
lost-update/fail-open(동시 PATCH 가 `chatChannel.inboundSigningRef` 를 지우는 것)와 "삭제된
트리거의 부활"(`update()` 창 1의 `save` insert-on-missing) 이슈는 모두 닫혔다. 이번 라운드
diff(직전 두 커밋 `369852b4f`·`889c93cd9`)는 그 마지막 잔여 WARNING(`remove()` 가 config 락에
참여하지 않아 "쓰기 시점" 삭제 경합이 남는다 — `20_17_16` database·concurrency WARNING#2)을
닫는 변경이다. `triggers.service.ts`(`update`/`remove`/`rotateBotToken`), `trigger-config-lock.ts`,
`chat-channel-binder.service.ts`, `hooks.service.ts`, `trigger-transaction-mock.ts` 를 `Read`/
`grep` 으로 직접 열어 대조했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 로 재확인
— 본 리뷰 산출물 디렉터리만 존재).

## 발견사항

- **[WARNING]** `remove()` 의 config 락 참여로 **트리거 DB 행**의 삭제-경합은 닫혔지만, 같은
  경합이 **secret store 행**과 **provider 쪽 webhook 등록**에는 여전히 열려 있다 — advisory
  lock 이 보호하는 것은 `trigger` 테이블뿐이고, 두 별도 자원은 그 락을 전혀 모른다
  - 위치:
    - 쓰기(잠재적 orphan): `chat-channel-binder.service.ts:138`·`:158`(setup 성공 경로 진입
      전, `storeUserSuppliedSecrets`/provider-issued plaintext 저장), `:244`
      (`adapter.setupChannel` — provider 쪽 webhook 등록), `:257`(server-issued 서명 저장) —
      이 넷 모두 `:266` 의 `rewriteTriggerConfigLocked`(락 획득·재읽기) **이전**에 실행된다.
      `triggers.service.ts:1146`·`:1154`·`:1159`(`rotateBotToken` 의 botToken/v2 백업 저장),
      `:1171`(`adapter.setupChannel` 재호출), `:1192`(issuedInboundSigning 저장) 도 전부
      `:1208` 의 `rewriteTriggerConfigLocked` **이전**이다.
    - 정리(선점 시점 고정): `triggers.service.ts:945`(`teardownChatChannel` — provider
      unregister) · `:950`(`secrets.deleteByPrefix('secret://triggers/<id>/')`) — 둘 다
      `:961`(`acquireTriggerConfigLock`)·`:962`(`m.remove`) **이전에, 즉 config 락을 잡기도
      전에** 실행되고 **그 시점 이후로는 다시 호출되지 않는다.**
  - 상세: 이 PR 이 세 라운드에 걸쳐 반복해서 닫은 것은 "삭제 뒤 트리거 **행**이 되살아난다"는
    문제였다. 그런데 `setupChatChannel`/`rotateBotToken` 이 만드는 부작용은 `trigger` 행 하나가
    아니다 — **secret store 쓰기**(`SecretResolverService.rotate`, 별도 테이블·UPSERT, 락
    무관)와 **provider 쪽 webhook 등록**(`adapter.setupChannel`, 외부 HTTP, 이 PR 의 설계상
    의도적으로 락 밖)이 함께 딸려 있고, 이 둘은 최종 `rewriteTriggerConfigLocked` 호출
    **훨씬 이전**, 즉 트리거가 여전히 존재한다고 믿는 시점에 **무조건** 실행된다.

    경합 시나리오: 요청 A(`rotateBotToken` 또는 `chatChannel` 을 실은 PATCH)가
    `secrets.resolve`/`secrets.rotate`/`adapter.setupChannel` 을 진행하는 동안(이 구간은
    네트워크 I/O 를 포함해 수 차례의 `await` 지점을 가지므로 창이 좁지 않다), 요청
    B(`DELETE /api/triggers/:id`)가 `teardownChatChannel` + `secrets.deleteByPrefix` 를
    **먼저** 끝내고 config 락을 잡아 행을 지운다. 이어서 A 가 `rewriteTriggerConfigLocked` 를
    부르면 락 안 재읽기가 `!fresh` 를 보고 **`false` 를 올바르게 반환**한다 — 이번 라운드가
    닫은 것 덕분에 `config` 컬럼 자체는 더는 오염되지 않고, `rotateBotToken` 은 새로 추가된
    `if (!wrote) throw NotFoundException` 으로 404 를 낸다(`triggers.service.ts:1221-1226`).

    **그러나 A 가 그 전에 이미 만들어 둔 부작용은 아무도 되돌리지 않는다.** `secrets.rotate`
    로 새로 쓴 `secret://triggers/<id>/bot-token`·`.../bot-token.v2`·`.../inbound-signing` 행은
    B 의 `deleteByPrefix` 가 이미 지나간 뒤에 생성된 것이라 **정리 대상에서 영구히 빠진다** —
    삭제된 트리거의 id 를 가리키는 평문(암호화 저장이지만 논리적으로는 유효한 비밀)이 secret
    store 에 고아로 남는다. 마찬가지로 `adapter.setupChannel` 이 provider(Slack/Discord/
    Telegram)에 등록한 webhook 도, `teardownChatChannel` 이 이미 끝난 뒤에 등록된 것이라
    **아무도 해제하지 않는다** — 인입 쪽은 `hooks.service.ts` 가 삭제된 트리거를 endpointPath
    로 조회하지 못해 요청을 거부하므로 기능적 오작동(오배달)은 없지만, provider 쪽에는 이미
    끊었다고 생각한 통합이 외부에 그대로 남는다.

    이 클래스는 이 PR 이 지금까지 다뤄 온 "같은 자원(`trigger.config`)에 대한 lost update"와는
    축이 다르다 — **서로 다른 두 영속 자원(trigger 행 vs secret store 행 vs 외부 provider
    상태)에 걸친 하나의 논리적 연산이 원자적이지 않다.** advisory lock 은 `trigger` 테이블
    쓰기만 직렬화하도록 설계됐고(그 자체는 JSDoc 이 명시한 대로 올바른 설계 — 외부 호출을 락
    안에 두지 않는다), `remove()` 의 정리 호출들이 "한 번만, 락 밖에서" 실행되는 시점 고정
    액션이라는 점이 맞물려 이 갭을 만든다. `plan/in-progress/trigger-config-lost-update.md`
    를 전수 grep 했으나 `secrets.rotate`/`deleteByPrefix`/"고아" 조합으로 이 경로를 추적하는
    항목은 없다 — 4라운드에 걸친 review 파일에도 이 정확한 경로는 등재돼 있지 않다(기존
    "secret_store 고아 row" 논의는 전부 e2e teardown 의 raw `DELETE FROM trigger` 얘기이고,
    "프로덕션 삭제 경로(`remove()`→`deleteByPrefix`)는 이 문제와 무관하다"고 명시적으로
    구분해 왔다 — 이번에 발견한 경로는 바로 그 "무관하다"던 프로덕션 삭제 경로 안에서, 삭제와
    **동시에 진행 중인 rotate/setup** 이 있을 때만 열린다).
  - 제안: 이 PR 의 스코프(트리거 config 컬럼의 lost-update)를 넘는 별도 결함 클래스이므로
    이번 배치를 막을 사유는 아니지만, 후속으로 등재를 권고한다. 두 방향이 있다: (a)
    `rewriteTriggerConfigLocked` 가 `false` 를 반환하면 그 호출부가 자신이 방금 쓴 secret
    ref 들을 `secrets.deleteByPrefix` 로 다시 정리한다(간단하지만 provider 쪽 webhook 등록
    해제는 못 막는다), 또는 (b) `remove()` 자체가 config 락을 **가장 먼저**(`teardownChatChannel`/
    `deleteByPrefix` 보다도 먼저) 잡아 "삭제 결정"을 커밋한 뒤에만 정리를 진행하도록 순서를
    바꾸고, `rotateBotToken`/`setupChatChannel` 도 외부 호출 **직전**에 같은 락을 짧게 잡아
    "그 순간 삭제되지 않았음"을 재확인한다(다만 이러면 외부 호출이 락 보유 중에 시작되어 이 PR
    이 지키려던 "외부 호출은 락 밖" 제약과 정면으로 부딪힌다 — 쉬운 절충이 없다는 점 자체가
    이 항목을 이번 배치가 아니라 별도 설계 검토로 넘겨야 하는 이유다).

- **[INFO]** (수정 확인) `remove()` 의 config 락 참여가 올바르게 배선됐고, 락을 관측하는
  회귀 테스트도 갖춰졌다
  - 위치: `triggers.service.ts:960-963`(`manager.transaction` 안에서
    `acquireTriggerConfigLock(m, id)` → `m.remove(trigger)`), `trigger-transaction-mock.ts`
    의 `onLock` 훅(advisory lock SQL 의 첫 파라미터를 가로채 관측), `triggers.service.spec.ts:3823`
    (`remove() 도 같은 config 락을 잡는다`)
  - 상세: `pg_advisory_xact_lock` 은 SQL 실행 자체라 mock 테스트로는 "호출됐는지"를 관측할
    방법이 원래 없었는데, `onLock` 이 `query()` mock 안에서 SQL 문자열과 파라미터를 가로채
    락 키를 노출하게 만들어 그 결함 부류(락을 빼는 뮤턴트가 조용히 통과하는 것)를 테스트가
    잡을 수 있게 했다. `update()`(창 1)와 `remove()` 가 **같은 락 키**(`trigger-config:<id>`)
    를 잡으므로 두 트랜잭션은 서로를 배제한다 — 락 획득 순서가 항상 한 종류(`trigger-config:*`)
    뿐이라 데드락 경로는 생기지 않는다(4라운드 리뷰의 결론과 동일, 재확인).
  - 제안: 없음 — 의도한 대로 동작.

- **[INFO]** (기존 지적 재확인, 변화 없음) advisory lock 대기 상한 없음 / 32비트 해시
  네임스페이스 공유 — 두 사항 모두 3~4라운드에 걸쳐 이미 문서화·수용됨
  - 위치: `trigger-config-lock.ts:39-46`(`acquireTriggerConfigLock`)
  - 상세: `SET LOCAL lock_timeout` 없이 무한 대기하는 트레이드오프와, `hashtext()` 32비트
    공간을 `exec-cap:*`(execution-engine)과 공유하는 점 모두 이번 라운드 diff 로 바뀐 것이
    없고, 이미 `18_17_44`/`20_17_16` concurrency·database 리뷰가 근거와 함께 수용했다. 새
    위험 아님.

## 요약

이번 라운드(`369852b4f`·`889c93cd9`)는 4라운드 concurrency WARNING("삭제가 config 락에
참여하지 않아 읽기-시점 가드만으로는 못 막는 쓰기-시점 삭제 경합이 남는다")을 `remove()` 를
같은 advisory lock 트랜잭션 안에 넣어 정확히 닫았고, `onLock` 관측 훅으로 그 배선 자체를
뮤테이션에도 잡히게 만들었다 — `trigger` 행 수준의 lost-update/부활 문제는 이제 네 창 모두
동일한 "행이 없으면 쓰지 않는다" 계약으로 수렴한다. 다만 이번 수정으로 그 문제가 완전히
사라진 것은 아니고, **원자성의 경계가 옮겨졌을 뿐이다**: `setupChatChannel`/`rotateBotToken`
이 `trigger` 행을 쓰기 전에 무조건 실행하는 secret-store 쓰기와 provider `setupChannel` 호출은
advisory lock 의 보호 범위 밖에 있고, `remove()` 의 대응 정리(`teardownChatChannel`·
`deleteByPrefix`)는 "락을 잡기도 전에, 딱 한 번" 실행되는 시점 고정 액션이다. 그 결과 삭제와
동시에 진행 중인 rotate/setup 요청이 있으면, `config` 컬럼 자체는 이번 수정 덕분에 정확히
보호되지만 그 요청이 이미 만들어 둔 secret store 행과 provider 쪽 webhook 등록은 정리되지
않고 고아로 남는다 — 4라운드에 걸친 review/plan 어디에도 이 정확한 경로는 아직 등재돼 있지
않다. 이 PR 의 원래 스코프(`trigger.config` 컬럼의 lost-update)를 넘는 별도 클래스의 결함이고
발생 확률도 "PATCH-PATCH 경합"보다는 낮은 "PATCH/rotate-DELETE 경합"이라 이번 배치를 막을
사유는 아니지만, 조치 없이 다음 라운드로 넘기면 놓치기 쉬운 위치라 WARNING 으로 남긴다. 그 외
`remove()` 수정 자체의 락 배선·데드락 위험·기존에 수용된 lock-timeout/네임스페이스 공유
트레이드오프는 모두 건전하다.

## 위험도

MEDIUM
