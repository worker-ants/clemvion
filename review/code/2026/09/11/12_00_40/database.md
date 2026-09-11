# 데이터베이스(Database) 리뷰

## 발견사항

해당 없음.

이번 diff(17개 파일, `origin/main...HEAD` 3개 커밋)는 `chatChannel` PATCH/POST 검증 에러 페이로드에
`details[].code`(`INVALID_FIELD` 등)를 배선하는 작업, `botToken` 빈 문자열을 막는
`@MinLength(1)` 데코레이터 추가, 거부 메시지를 공유 상수(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)로
묶는 리팩터링, 그리고 이를 고정하는 unit/e2e 테스트·CHANGELOG·plan·user-guide 문서 갱신으로
구성된다.

실제 애플리케이션 코드 변경 파일을 개별 확인했다:

- `codebase/backend/src/common/utils/password.util.ts` / `.spec.ts` — `BadRequestException` 페이로드
  객체 리터럴에 `code` 키 추가. DB 접근 없음.
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규) — 문자열
  상수 테이블. DB 접근 없음.
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `@MinLength(1)` class-validator
  데코레이터 추가, 메시지 문자열을 공유 상수 참조로 치환. 순수 입력 검증(DTO) 계층.
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `assertChatChannelInputSafe` /
  `assertPatchCarriesNoSecrets` / `assertChatChannelAlreadySetUp` /
  `assertInboundSigningPlaintextByProvider` 등 가드 메서드의 `throw new BadRequestException({...})`
  객체 리터럴 13곳에 `code: ErrorCode.INVALID_FIELD` 필드만 추가됐다. 실제로 `git diff` 로 전체
  변경분을 직접 열어 확인했으며, 리포지토리 쿼리(`triggerRepo.*`)·`SecretResolverService.rotate()`
  호출·트랜잭션 경계·커넥션 사용 코드는 이번 diff 에서 **일절 손대지 않았다**. 해당 서비스가 DB에
  쓰는 지점(`SecretResolver.rotate()`)은 CHANGELOG 상 배경 설명(과거 결함 서술)으로만 언급될 뿐,
  이번 diff 의 실제 변경 라인이 아니다.
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 신규 단언은 모두 `triggerRepo`
  등 **mock 리포지토리**를 대상으로 한 unit 테스트이며, `expect(triggerRepo.create).not.toHaveBeenCalled()`
  같은 호출 여부 검증만 있다. 실 DB/ORM 쿼리 실행 없음.
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` — `CustomValidationPipe`
  를 직접 호출하는 파이프 단위 테스트. DB 접근 없음.
- `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` — e2e 응답 바디 단언에 `code` 필드만
  추가. 파일 상단에 기존 `pg` `Client` import 가 있으나 이는 이번 diff 로 신규 도입된 것이 아니라
  기존 e2e 인프라(DB 상태 셋업/정리용)이고, 이번 변경에서 그 쿼리 로직 자체는 건드리지 않았다.
- `CHANGELOG.md`, `plan/in-progress/impl-details-code-wiring.md`, `spec` 아닌 user-guide mdx 2건,
  `review/**` 산출물 — 전부 문서/트래킹 자료이며 DB 스키마·마이그레이션과 무관하다.

즉 리포지토리 쿼리, ORM 엔티티/스키마 정의, 마이그레이션 파일, 트랜잭션 경계, 커넥션 풀 설정,
원시 SQL, 페이지네이션 로직 중 어느 것도 이번 diff 에 등장하지 않는다. 직전 라운드
(`review/code/2026/09/11/11_33_35/database.md`)의 판정과 이번 라운드에서 새로 추가된 커밋
(`0f...` ErrorCode 상수화, `2d0270fbd` user-guide 문서 갱신)을 포함해 재확인한 결과가 동일하다.

## 요약

이번 diff 는 순수하게 HTTP 에러 응답의 `details[].code` 필드 배선, `class-validator` 검증 강화
(`@MinLength`), 에러 메시지 문자열의 상수화, 그리고 이를 뒷받침하는 테스트/문서 갱신에 국한된다.
데이터베이스 인덱스·N+1 쿼리·트랜잭션·마이그레이션 안전성·스키마 설계·커넥션 관리·SQL 인젝션·
대량 데이터 페이지네이션 중 어느 관점에도 해당하는 코드 변경이 없다.

## 위험도

NONE
