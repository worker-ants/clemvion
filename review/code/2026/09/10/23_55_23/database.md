# 데이터베이스(Database) 리뷰 — `impl-chat-channel-patch-token`

## 개요

이번 diff 는 `chatChannel` PATCH 가 사용자 비밀(`botToken`·`inboundSigningPlaintext`)을 받지
못하게 막는 DTO(`ChatChannelUpdateConfigDto`) 신설과 `TriggersService` 의 검증·secret 쓰기
게이팅 로직 변경이다. **스키마 변경·마이그레이션 파일·신규 인덱스·raw SQL 은 이 diff 에
없다** (`git diff c0f2a885c HEAD --stat -- '*migration*'` 결과 0건). `triggerRepository` 는
TypeORM `Repository<Trigger>` 를 그대로 쓰고, `find/save/update` 는 전부 파라미터화된 쿼리라
SQL 인젝션 표면이 없다. 아래는 그 안에서 DB 관점으로 살펴본 것이다.

## 발견사항

- **[INFO]** `chatChannel` PATCH 는 여전히 "DB 저장 + 외부 secret store 쓰기"가 하나의
  트랜잭션으로 묶여 있지 않다 — 이번 diff 가 새로 만든 문제는 아니고, 게이팅 로직만 그 위에
  얹혔다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 566~605행 —
    `this.triggerRepository.save(trigger)` (556행)로 트리거 본체를 먼저 커밋한 뒤, 별도
    비동기 흐름인 `setupChatChannel()` (587행 호출 → 정의는 1052행대) 안에서 `secrets.rotate()`
    (1111·1131·1185행)와 **두 번째** `triggerRepository.update()` (1207행 성공 경로 / 1239행
    실패 경로)가 다시 실행된다. 두 `triggerRepository` 쓰기는 서로 다른 statement 이고 그
    사이에 외부 어댑터 HTTP 호출(`adapter.setupChannel`)이 끼어 있어 원자적이지 않다.
  - 상세: 이 비원자성은 diff 안의 주석(`// [Spec R8 v1 적용]`, `best-effort — 실패 시
    chat_channel_health=degraded`, CCH-SE-01)이 스스로 "best-effort" 로 명시한 **기존 설계**다.
    `setupChannel` 이 실패해도 catch 블록이 `chatChannelHealth: 'degraded'`, `last_error` 를
    담아 두 번째 `update()` 로 저장하므로 완전한 유실은 아니다. 다만 이번 PR 이 손댄
    `inboundSigningRef` 보존 로직(`inboundSigningRefSurvives`)이 바로 이 비원자적 두-쓰기
    구조 위에서 동작한다는 점은 다음에 이 함수를 또 고칠 사람이 알아 둘 필요가 있다 — 첫
    번째 `save()` 커밋 이후 두 번째 `update()` 전에 프로세스가 죽으면(드묾) `chatChannelHealth`
    가 갱신 전 상태로 남아 실제 secret store 상태와 어긋날 수 있다.
  - 제안: 조치 불요(기존 설계·spec 이 이미 이 실패 모드를 인지·수용). 다만 향후 secret
    store 쓰기 실패 복구 로직을 다룰 때는 두 `triggerRepository.update()` 호출과 그 사이의
    외부 I/O 를 하나의 정합성 단위로 다시 검토할 만하다.

- **[INFO]** `update()` 안에서 "현재 상태 읽기 → 검증 판단 → 저장" 사이에 낙관적 잠금이나
  버전 체크가 없어 이론적으로 동시 PATCH 경합(TOCTOU) 이 가능하지만, 이번 diff 가 새로
  추가하는 검증(`assertChatChannelAlreadySetUp`)도 같은 패턴을 그대로 물려받는다.
  - 위치: `triggers.service.ts` `update()` 491행(`findById` 로 최초 로드) ~ 521행
    (`assertChatChannelAlreadySetUp(trigger, chatChannel)` 판단) ~ 556행(`save`).
  - 상세: 두 PATCH 요청이 같은 `trigger.id` 에 대해 동시에 도착하면, 둘 다 같은
    "provider 아직 없음" 스냅샷을 보고 통과할 수 있어 이론적으로 `assertChatChannelAlreadySetUp`
    의 "최초 setup 은 생성 POST 한정" 불변식이 두 번째 요청에서 우회될 여지가 있다. 다만
    이는 검증 실패를 400 으로 막는 가드일 뿐 데이터 손상·중복 과금 같은 심각한 결과로
    이어지지 않고(`setupChannel` 이 idempotent 로 설계돼 있다는 주석이 곳곳에 있음), 이
    저장소의 다른 트리거 PATCH 경로들도 동일한 read-modify-write 패턴을 쓴다 — 이번 PR 이
    새로 도입한 리스크가 아니라 기존 동시성 모델을 그대로 따른 것이다.
  - 제안: 조치 불요. 실제 동시 PATCH 트래픽이 관측되면 그때 낙관적 락(예: `updatedAt` 기반
    조건부 update) 도입을 검토.

## 확인된 것 — 위반 없음

- 스키마/마이그레이션 변경 없음 — 신규 컬럼·인덱스·제약조건이 이 diff 에 없다.
- N+1 없음 — 반복문 안에서 개별 쿼리를 실행하는 코드가 추가되지 않았다. `update()` 의 재조회
  (`triggerRepository.findOne`, 600행)는 PATCH 요청 1건당 정확히 1회이고 이 구조는 이번 diff
  이전부터 있던 패턴이다.
- 파라미터화된 쿼리 — `triggerRepository.save/update/findOne` 전부 TypeORM QueryBuilder/Repository
  API 를 통해 바인딩되며, 이번 diff 가 새로 만든 문자열 조합 쿼리는 없다.
- 대량 데이터 페이지네이션 — 이번 diff 가 건드리는 `create()`/`update()` 는 단건 트리거 조작이라
  대량 조회·페이지네이션과 무관하다.
- 커넥션 관리 — 신규 Repository/DataSource 주입이나 수동 커넥션 획득이 없다. 기존 `@InjectRepository`
  주입 패턴을 그대로 사용.
- `ChatChannelUpdateConfigDto` 는 순수 검증 계층(class-validator) 변경이라 DB 컬럼·JSONB 스키마와
  직접적인 관계가 없다 — `config` 컬럼(JSONB)에 저장되는 `chatChannel` 서브 객체의 필드 구성은
  기존과 동일(`botTokenRef`/`inboundSigningRef` 등 내부 필드는 그대로).

## 요약

이번 변경은 DTO 검증 계층과 서비스의 secret-쓰기 게이팅 로직에 집중된 애플리케이션 레벨
수정으로, 스키마 변경·마이그레이션·신규 인덱스·raw SQL·대량 조회 로직이 전혀 포함되지 않는다.
기존에 존재하던 "트리거 본체 저장(`save`)과 secret store 쓰기 + 두 번째 `triggerRepository.update`
가 하나의 트랜잭션이 아닌 best-effort 두-단계 커밋" 패턴 위에 이번 PR 의 `inboundSigningRef`
보존 로직이 얹혔다는 점만 참고사항(INFO)으로 남긴다 — 이는 spec 이 이미 인지·문서화한 기존
설계이지 이번 PR 이 새로 만든 결함이 아니다. 데이터베이스 관점에서 이 PR 을 막을 사유는 없다.

## 위험도

NONE
