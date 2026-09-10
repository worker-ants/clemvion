# 데이터베이스(Database) 리뷰 — `impl-chat-channel-patch-token`

## 개요

이번 diff 는 `chatChannel` PATCH 가 사용자 비밀(`botToken`·`inboundSigningPlaintext`)을 받지
못하게 막는 DTO(`ChatChannelUpdateConfigDto`, `OmitType`) 신설, 서비스 계층 검증 게이팅
(`assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`),
그리고 직전 라운드에서 CRITICAL 로 판정된 `inboundSigningRef` 소실(카드 편집 PATCH 후 인입
서명 fail-open)의 수정으로 구성된다. **스키마 변경·마이그레이션 파일·신규 인덱스·엔티티
변경·raw SQL 은 이 diff 에 없다** — `git diff c0f2a885c HEAD --stat -- '*migration*'` /
`-- '*entity*'` 모두 0건. `triggerRepository` 는 TypeORM `Repository<Trigger>` 를 그대로
쓰고 `find/save/update` 는 전부 파라미터화된 쿼리다.

이 PR 은 같은 세션에서 이미 두 라운드(`review/code/2026/09/10/23_55_23` 포함) `/ai-review`
를 거쳤고, 그 라운드의 database 리뷰(`review/code/2026/09/10/23_55_23/database.md`)가 이번
diff 의 핵심 서비스 로직(`update()`/`setupChatChannel()`)을 이미 검토해 위험도 NONE 으로
판정했다. 그 이후 커밋(`83d5f3f94`)은 `assertChatChannelInputSafe` 를 오버로드 2개로 타입
결속하는 컴파일 타임 변경과 문서·테스트 수정뿐이라, DB 관점에서 새로 달라진 부분이 없음을
`git show 83d5f3f94 -- triggers.service.ts` 로 확인했다. 아래는 그 전제 위에서 독립적으로
재확인한 결과다.

## 발견사항

- **[INFO]** `chatChannel` PATCH 는 여전히 "트리거 본체 저장 + secret store 쓰기 + 두 번째
  `triggerRepository.update()`" 가 하나의 트랜잭션으로 묶여 있지 않다 — 이번 diff 가 새로
  만든 문제가 아니라 기존 best-effort 2단계 커밋(CCH-SE-01) 설계 위에 `inboundSigningRef`
  보존 로직이 얹힌 것이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` 의
    `this.triggerRepository.save(trigger)` 호출(문서화 시점 556행 부근)이 트리거 본체를
    먼저 커밋하고, 이어서 `setupChatChannel()`(정의는 `mergeExternalConfig` 바로 뒤,
    문서화 시점 1075행) 안에서 `secrets.rotate()`(세 지점)와 성공/실패 두 경로 각각의
    **별도** `triggerRepository.update()`(성공 경로 1219행 부근, 실패 경로 1251행 부근)가
    다시 실행된다. 그 사이에 외부 어댑터 HTTP 호출(`adapter.setupChannel`)이 끼어 있어
    원자적이지 않다.
  - 상세: 실패해도 catch 블록이 `chatChannelHealth: 'degraded'` · `chatChannelLastError`
    를 담아 두 번째 `update()` 로 저장하므로 완전한 유실은 아니다. 다만 이번 PR 이 정확히
    이 비원자적 두-쓰기 구조 위에서 `inboundSigningRefSurvives`(`providerIssuedStored ||
    Boolean(preservedInboundSigningRef)`) 로 ref 보존을 계산하고, 성공(`newConfig`)·실패
    (`fallbackConfig`) 두 경로 모두에 `...(trigger.config ?? {})` 스프레드 뒤
    `chatChannel` 키를 덮어써 두 ref(`botTokenRef`/`inboundSigningRef`)를 함께 보존하도록
    고쳤다 — 코드를 직접 읽어 두 경로 모두에서 실제로 적용됨을 확인했다. 첫 번째 `save()`
    커밋 이후 두 번째 `update()` 전에 프로세스가 죽으면(드묾) `chatChannelHealth` 가 갱신
    전 상태로 남아 실제 secret store 상태와 어긋날 수 있다는 잔여 위험은 이전 라운드와
    동일하게 남아 있다.
  - 제안: 조치 불요(기존 설계·spec 이 이미 이 실패 모드를 인지·수용, 이번 PR 범위 아님).

- **[INFO]** `update()` 는 "현재 상태 읽기 → 검증 판단 → 병합 전 `inboundSigningRef` 캡처 →
  저장" 사이에 낙관적 잠금·행 잠금이 없어, 동시 PATCH 가 겹치면 나중에 커밋되는 요청이
  먼저 반영된 `inboundSigningRef` 를 오래된 스냅샷으로 되돌려 쓸 수 있다(lost update).
  이는 이번 PR 이 막 닫은 "카드 편집 PATCH 후 인입 서명 fail-open" CRITICAL 과 같은 증상을
  동시성 경로로 재발시킬 수 있는 지점이다.
  - 위치: `triggers.service.ts` `update()` — `findById` 로 최초 로드 → `previousInboundSigningRef`
    캡처(`trigger.config` 읽기, mergeExternalConfig 호출 직전) → `save(trigger)` →
    `setupChatChannel(saved, chatChannel, { preservedInboundSigningRef })`. 자매 패턴으로
    `rotateChatChannelBotToken()` 도 동일한 read-modify-write 형태다.
  - 상세: 이미 `review/code/2026/09/10/23_55_23` 라운드에서 concurrency 리뷰가 WARNING 으로,
    database 리뷰가 TOCTOU 로 각각 별도 확인했고, `plan/in-progress/spec-draft-nullable-notation-followups.md:2116-2126` 에 사전 존재 설계(CCH-SE-01 best-effort 2단계 커밋)로 명시
    등재돼 있다 — 이번 PR 이 새로 만든 취약점이 아니라 그 위에서 재현 가능한 경로다. 이번
    라운드의 `security.md`/`testing.md` 도 같은 지점을 재확인하고 등재 상태를 재검증했다.
    developer SKILL §ISSUE FIX 수렴 예외 (a)(b)(c) 로 커밋 `83d5f3f94` 에서 이미 후속
    항목으로 처리됐다(advisory lock/`FOR UPDATE` 처방이 `update()` 와 `rotateChatChannelBotToken()`
    을 함께 바꿔야 해 이 PR 범위를 넘는다는 판단).
  - 제안: 이번 PR 을 막을 사유 아님(이미 등재·수렴 처리됨). 실제 동시 PATCH 트래픽이
    관측되거나 후속 트래커 항목을 착수할 때, 트리거 단위 advisory lock 또는 `config`
    낙관적 버전 비교 도입을 검토.

## 확인된 것 — 위반 없음

- 스키마/마이그레이션/엔티티 변경 없음 — 신규 컬럼·인덱스·제약조건이 이 diff 에 없다
  (`git diff c0f2a885c HEAD -- '*migration*' '*entity*'` 0건).
- N+1 없음 — 반복문 안에서 개별 쿼리를 실행하는 코드가 추가되지 않았다. `update()` 의
  chatChannel 재조회(`triggerRepository.findOne`)는 PATCH 요청 1건당 정확히 1회이고, 이번
  PR 이 `relations: ['workflow']` 를 명시적으로 유지하도록 고친 것 외에 조회 횟수 자체는
  바뀌지 않았다.
- 파라미터화된 쿼리 — `triggerRepository.save/update/findOne` 전부 TypeORM Repository API
  를 통해 바인딩되며, 이번 diff 가 새로 만든 문자열 조합 쿼리·raw SQL 은 없다. DTO 레이어
  (`ChatChannelUpdateConfigDto`)는 class-validator 검증만 수행하고 쿼리에 관여하지 않는다.
- 대량 데이터/페이지네이션 — 이번 diff 가 건드리는 `update()`/`create()`/`setupChatChannel()`
  은 단건 트리거 조작이라 대량 조회·페이지네이션과 무관하다.
- 커넥션 관리 — 신규 Repository/DataSource 주입이나 수동 커넥션 획득이 없다. 기존
  `@InjectRepository` 주입 패턴을 그대로 사용, 트랜잭션 매니저를 직접 열고 닫는 코드도 없다.
- `ChatChannelUpdateConfigDto`(`OmitType` 기반)는 순수 검증 계층 변경이라 `config` 컬럼
  (JSONB)의 저장 스키마와 직접 관계가 없다 — 저장되는 `chatChannel` 서브 객체의 내부 필드
  구성(`botTokenRef`/`inboundSigningRef` 등)은 기존과 동일하다.

## 요약

이번 diff 는 DTO 검증 계층 분리와 서비스의 secret-쓰기 게이팅/ref 보존 로직에 집중된
애플리케이션 레벨 수정으로, 스키마 변경·마이그레이션·신규 인덱스·raw SQL·대량 조회 로직이
전혀 포함되지 않는다. 직전 라운드(`23_55_23`)의 database 리뷰가 이미 핵심 로직을 NONE 으로
판정했고, 그 이후 유일한 서비스 코드 변경(오버로드 타입 결속)은 DB 와 무관함을 확인했다.
남아 있는 것은 기존에 문서화·등재된 두 가지 pre-existing 패턴 — (1) 트리거 본체 저장과
secret store 쓰기가 하나의 트랜잭션이 아닌 best-effort 2단계 커밋, (2) 동시 PATCH 에 대한
낙관적 잠금 부재로 인한 이론적 lost update — 뿐이며 둘 다 이번 PR 이 새로 만든 결함이
아니고 후속 트래커에 근거와 함께 명시 등재돼 있다. 데이터베이스 관점에서 이 PR 을 막을
사유는 없다.

## 위험도

NONE
