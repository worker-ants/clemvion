# API 계약(API Contract) 리뷰

## 검증 방법

프롬프트가 `triggers.service.ts`/`triggers.service.spec.ts` 전체 diff 를 크기 제한으로 생략해,
`git diff 94e19be8d..HEAD -- codebase/`(fork point `94e19be8d` = `origin/main`)로 두 파일의 실제
누적 diff 를 직접 재구성하고, `Read`/`grep`으로 `chat-channel-config.dto.ts`·
`chat-channel-rejection-messages.const.ts`·`password.util.ts`·`error-codes.ts`·
`http-exception.filter.ts`·`2-api-convention.md` §5.3 을 저장소 최종 상태로 직접 대조했다.
저장소 파일은 뮤테이션하지 않았다 — `git status --short` 확인 결과 이 리뷰가 만든 변경은 없다
(유일한 untracked 항목은 이 라운드의 출력 디렉터리 자신).

이 diff 는 이미 세 라운드(`review/code/2026/09/11/{11_05_27,11_33_35,12_00_40}`)가 검토했고,
`12_00_40`의 WARNING 1(`authConfigId` 자리의 top-level 특화 코드 + generic `details.code` 병기)은
`RESOLUTION.md`에서 **"판정 자체가 spec 사안이라 developer PR 에서 닫지 않고 planner 턴으로
넘긴다"**로 처분됐고, 마지막 커밋(`9fcce3f47`)이 그 판정 근거를 `triggers.service.ts:1005-1022`에
주석으로 앵커링하고 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 durable
트래커 항목으로 등재했다. 아래 발견사항은 이 처분을 재확인한 것으로, 새 WARNING 으로 재상정하지
않는다(재상정하면 이미 끝난 판정을 다시 여는 stale 루프가 된다).

## 발견사항

- **[INFO]** `details[].code`/`details.code` 15자리 배선은 순수 additive 필드 추가이고 하위 호환성
  문제가 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`(13곳, 예: `type`/`botTokenRef`/
    `inboundSigningRef`/`inboundSigning`/`botToken`/`inboundSigningPlaintext`×5/`chatChannel`/
    `provider`/`authConfigId`) · `codebase/backend/src/common/utils/password.util.ts:75,96`
  - 상세: `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)는
    `details: unknown`을 그대로 wire 로 복사하며 스키마를 좁히지 않는다. 프론트엔드에서 이 경로의
    `error.details`를 정확 일치(deep-equal)로 소비하는 프로덕션 코드는 없음을 확인했다(유일하게
    정확 일치를 쓰는 곳은 이번 PR 이 함께 갱신한 unit/e2e 테스트 자신). `2-api-convention.md` §5.3
    이 2026-09-11 규약화한 「`field`를 실으면 `code`도 싣는다 — 형태 무관」을 그대로 구현한 것으로,
    스펙-구현 정합화 방향이다. `field`가 없는 진단 payload(`{ type: params.type }` 감사 로그,
    `{ reason: message.slice(...) }` 2곳)는 의도적으로 손대지 않아 §5.3 의 "field 있을 때만" 조건과
    일치한다.
  - 제안: 조치 불필요.

- **[INFO]** `ChatChannelConfigDto.botToken`에 추가된 `@MinLength(1)`은 이전에 (버그로) 성공하던
  `botToken: ''` 요청을 이제 400으로 거부하는 **클라이언트 관측 가능한 동작 변경**이나, 이미
  `@ApiProperty({ minLength: 1 })`로 선언돼 있던 계약을 실제로 강제하는 정합화다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`@MinLength(1)`
    데코레이터 추가 자리, `botToken: string;` 선언 직전)
  - 상세: `ChatChannelUpdateConfigDto`는 `OmitType(ChatChannelConfigDto, ['botToken', ...])`로
    `botToken`을 제거한 뒤 `@IsEmpty()`를 새로 선언하므로, 이 강화는 **생성(POST) 경로에만**
    적용되고 PATCH 경로로는 새지 않는다(직접 확인). CHANGELOG.md·`trigger-dto-validation.spec.ts`
    `[C]` 테스트가 이 변경과 스코프 경계(공백 전용 `'   '`는 여전히 통과, trim 정책은 별개 결정)를
    이미 명시하고 있어 "빈 문자열 문제가 전부 닫혔다"는 오독 위험은 낮다.
  - 제안: 조치 불필요 — 외부에 공개된 API라면 릴리스 노트에 한 줄 남기는 것을 권장하나 이미
    CHANGELOG.md Unreleased 항목에 기록돼 있다.

- **[INFO]** (재확인, 새 WARNING 아님) `authConfigId` 거부 응답은 top-level `AUTH_CONFIG_NOT_FOUND`
  (도메인 특화)와 `details.code: 'INVALID_FIELD'`(generic)를 함께 실어, 나머지 12곳(top-level이
  상태 기본값 `VALIDATION_ERROR`를 유지)과 형태가 다르다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`의
    `assertAuthConfigInWorkspace` — `throw new BadRequestException({ code: 'AUTH_CONFIG_NOT_FOUND',
    ..., details: { field: 'authConfigId', code: ErrorCode.INVALID_FIELD } })` 직전 블록
  - 상세: 이 지점은 `12_00_40` 라운드가 WARNING 으로 지목했고, `RESOLUTION.md`가 "§5.3의 '둘을
    겹쳐 쓰지 않는다' 금지가 이 자리에 걸리는지 자체가 판정 사안 — developer 가 단독으로 정하면
    안 된다"고 명시적으로 판단해 **코드는 현행 유지, 판정은 planner 턴으로** 넘겼다. 이번 라운드가
    검토한 diff 는 그 판정을 뒤집지 않고 이유를 소스 주석(`triggers.service.ts` 해당 위치)과
    `plan/in-progress/spec-draft-nullable-notation-followups.md`에 앵커링만 추가했다 — 동작 변경
    없음. 하위 호환성 관점에서는 additive 라 breaking 이 아니다(기존에 `code==='AUTH_CONFIG_NOT_FOUND'`
    로 분기하던 클라이언트는 그대로 동작).
  - 제안: developer PR 스코프에서는 조치 불필요 — 이미 트래커에 등재된 planner 결정 대기 항목.

- **[INFO]** `ErrorCode.INVALID_FIELD`(`nodes/core/error-codes.ts`, 원래 node-handler `output.error.code`
  용 카탈로그)를 `modules/triggers/triggers.service.ts`가 재사용하는 것은 계층을 넘나드는 참조처럼
  보이지만, 같은 상수가 이미 `workflow-errors.ts:300`에서 REST `details[].code` 용으로도 쓰이고
  있어 선례가 있다. `common/utils/password.util.ts`는 `common/` → `nodes/` import 선례가 0건이라는
  실측 근거로 리터럴 `'INVALID_FIELD'`를 의도적으로 유지했고, 그 근거를 주석에 남겼다 — 값은
  두 자리 모두 동일(`'INVALID_FIELD'`)해 계약상 불일치는 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (import 및 13곳 사용) ·
    `codebase/backend/src/common/utils/password.util.ts:60-65` (리터럴 유지 근거 주석)
  - 상세: 순수 유지보수성 논점이라 CRITICAL/WARNING 아님.
  - 제안: 조치 불필요.

- **[INFO]** URL/경로 설계·페이지네이션·인증/인가·API 버전 관리 네 관점은 이번 diff 와 무관하다.
  신규 엔드포인트·목록 API·인증/인가 가드·버전 스킴 변경이 없다(`2-api-convention.md:53` —
  이 프로젝트는 URL 경로에 버전을 넣지 않는 단일-버전 운영이며 이번 변경도 그 관례를 벗어나지
  않는다).

## 요약

이번 diff(누적 5커밋)는 신규 엔드포인트·URL 변경·버전 변경 없이, 기존 `chatChannel`/`password`
검증 에러 응답의 `details[].code`를 15개 발행 지점에 additive 하게 배선해 §5.3(2026-09-11
규약화)을 스펙-구현 정합화하고, `botToken`의 선언된 OpenAPI `minLength: 1`을 실제 검증 체인으로
강제(`@MinLength(1)`, POST 전용, PATCH 는 `OmitType`으로 격리 확인)했다. `GlobalExceptionFilter`가
`details`를 스키마 제약 없이 그대로 wire 로 넘기고 프론트엔드에 이 경로를 정확 일치로 소비하는
코드가 없어 하위 호환성 파괴는 없다. 유일한 형태적 불균일(`authConfigId` 자리의 top-level 특화
코드 + generic `details.code` 병기)은 이전 라운드가 이미 WARNING 으로 지목·조사했고, 판정 자체가
`spec/` 결정 사안이라는 근거로 developer 권한 밖 planner 턴에 명시적으로 이관·트래커 등재까지
완료된 상태라 이번 라운드에서 새 WARNING 으로 재상정하지 않는다. 응답 스키마·에러 상태 코드·요청
검증·URL 설계·인증/인가·페이지네이션 축 전반에서 계약을 깨는 변경은 없다.

## 위험도

LOW
