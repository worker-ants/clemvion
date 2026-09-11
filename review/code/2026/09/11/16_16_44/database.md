# 데이터베이스(Database) 리뷰

## 검토 범위

이번 리뷰 대상(브랜치 `claude/impl-chat-channel-binder-9d3f1e` vs `origin/main`, 커밋
`2ae81077c`·`6dc2b7d60`·`81d2a8c18`)에서 실제 코드 변경이 있는 파일은 2개뿐이다:

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규) — `TriggersService`
  의 chat-channel 입력 검증/변환 함수 6개를 module-level 순수 함수로 추출
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (신규) — 위 함수들의
  전용 단위 테스트

`codebase/backend/src/modules/triggers/triggers.service.ts` 는 호출부만
`this.assertX(...)` → `assertX(...)`(import) 로 바뀌었을 뿐 로직·순서는 동일하다
(`git diff origin/main..HEAD -- .../triggers.service.ts` 로 직접 대조). 나머지
(`plan/in-progress/*.md`, `review/code/2026/09/11/15_31_54/**`, `review/code/2026/09/11/15_57_42/**`)
는 plan·이전 라운드 리뷰 산출물로 DB 관점 검토 대상이 아니다.

## 발견사항

없음. DB 관점 점검 항목(인덱스·N+1·트랜잭션·마이그레이션·스키마·커넥션·SQL 인젝션·대량 데이터)
중 어느 것도 이번 diff 가 건드리지 않는다:

- 이동된 6개 함수(`assertChatChannelInputSafe`(+오버로드 2)·`assertPatchCarriesNoSecrets`·
  `assertChatChannelAlreadySetUp`·`stripChatChannelPlaintext`·
  `assertInboundSigningPlaintextByProvider`·`translateSetupChannelError`)는 전부 DTO/엔티티
  객체를 메모리에서만 읽고 던지거나 새 객체를 반환하는 **순수 함수**다. Repository 호출
  (`triggerRepository.save`/`find`/`update`), `SecretResolverService`, `QueryRunner`,
  트랜잭션 어느 것도 이 파일 안에 없다.
- `triggers.service.ts` 전체를 열어 `create()`/`update()`/`setupChatChannel` 주변 실제 DB
  접근 경로(`triggerRepository.save`, `secrets.rotate` 등)를 확인했으나, 호출 순서·인자·
  트랜잭션 경계가 이번 diff 로 달라진 지점은 없다. 이 파일에는 원래 `@Transaction`/
  `queryRunner` 사용이 없으며(사전 존재하는 설계) 이번 변경이 그것을 새로 만들거나 없애지도
  않는다.
- `stripChatChannelPlaintext` docstring 이 언급하는 "첫 `triggerRepository.save` 시 DB JSONB
  에 일시 기록되는 시간 창 제거"라는 DB 관련 설계 의도는 **이동 전 코드에 이미 있던 서술**이며
  본문 로직도 문자 그대로 동일하게 옮겨졌다(diff 대조 확인) — 이번 PR 이 새로 만든 결정이
  아니다.
- 신규 테스트 파일(`chat-channel-input-rules.spec.ts`)은 대상 함수가 의존성 0(협력자 없음)
  이라 `Test.createTestingModule`/repository mock 없이 함수를 직접 호출한다. DB 커넥션·풀·
  트랜잭션을 다루지 않으므로 커넥션 관리 관점에서도 무관하다.
- 인덱스·페이지네이션·대량 데이터 접근 패턴 변경 없음 — 이 diff 는 트리거 목록 조회 경로를
  건드리지 않는다.
- SQL 인젝션 관점: TypeORM repository/DTO 검증 로직만 다루며 원시 SQL 문자열 조합은 이번
  diff 어디에도 없다.

## 관측한 이상 상태 (뮤테이션 규약에 따른 보고)

리뷰 도중 두 차례 `git status`/`git diff` 를 실행한 사이에 저장소 워킹트리 파일
(`chat-channel-input-rules.ts` → 이후 `chat-channel-input-rules.spec.ts`)의 미커밋 diff 내용이
관찰 시점마다 달라졌다(예: 처음엔 `mode === 'create' &&` 가드 3곳 추가, 다음엔
`incoming.provider !== current.provider` 한 줄 변경, 마지막엔 다시 clean 하고 spec 파일이
modified 상태). 이 reviewer 는 해당 파일을 직접 수정하지 않았다 — 병렬로 실행 중인 다른
reviewer(들)가 가설 검증을 위해 같은 워킹트리에 뮤테이션을 적용/원복하는 중인 것으로 보인다.
DB 관점 판정은 커밋된 3개 커밋(`2ae81077c`/`6dc2b7d60`/`81d2a8c18`, `origin/main` 대비 diff)만을
근거로 삼았고 이 일시적 미커밋 상태는 반영하지 않았다. `git checkout`/`git restore` 등 원복
시도는 하지 않았다(타인의 진행 중 검증을 지울 위험이 있어 규약상 금지).

## 요약

이번 PR 은 `TriggersService` 안에 있던 chat-channel 입력 검증·정화·에러 변환 로직(외부
협력자 의존 0)을 별도 모듈로 추출하고 전용 단위 테스트를 붙이는 순수 리팩터 + 테스트 보강이다.
DB 쿼리·트랜잭션·스키마·마이그레이션·커넥션 관리·인덱스·페이지네이션 어느 것도 변경하지
않았으며, `triggerRepository`/`SecretResolverService` 를 다루는 `create()`/`update()`/
`setupChatChannel` 의 호출 순서도 그대로 유지된다. 데이터베이스 관점에서 해당 없음.

## 위험도

NONE
