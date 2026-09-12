# 정식 규약 준수 검토 — chat-channel-rules-cleanup (impl-done, scope=spec/5-system/)

## 전제

`spec/5-system/` 자체는 이번 diff 에서 변경되지 않았다(스코프 델타 0, 정상). 검토 대상은
`origin/main...HEAD` 의 실제 구현 diff(14개 파일)이며, 판정 SoT 는 `spec/conventions/**`
(주로 `swagger.md`)와 diff 가 직접 인용하는 `spec/5-system/2-api-convention.md` §5.3·
`spec/5-system/15-chat-channel.md` §5.4 다. 코드 존재 확인은 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/chat-channel-rules-cleanup` 를 절대경로로 직접 읽었다.

## 발견사항

- **[WARNING] 새 강제 불변식(DTO 클래스명 전역 유일성)이 `swagger.md` 본문에 없다**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` +
    `dto-class-name-collision.spec.ts` (신규, diff 전체)
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "응답 DTO 위치" / 같은 절 "이름 충돌을
    피합니다" 문단
  - 상세: 이번 diff 는 `@nestjs/swagger` 가 스키마를 클래스 `.name` 문자열로 등록하므로
    저장소 전체에서 `*.dto.ts` 의 `export class` 이름이 유일해야 한다는 **새 build-blocking
    불변식**을 도입했다(베이스라인 0, 위반 시 즉시 실패). 그런데 `swagger.md` §5-1 이 지금
    문서화한 "이름 충돌을 피합니다" 문단은 **`*.literal.ts` 의 값/타입 상수**(도메인 접두·
    `Literal` 접미)에 한정된 서술이고, DTO **클래스** 레벨의 전역 유일성은 어디에도 프로즈로
    적혀 있지 않다. 그 규칙의 유일한 서술처는 새 spec 파일의 테스트 JSDoc
    (`dto-class-name-collision.spec.ts` 헤더)뿐이다 — "정식 규약은 `spec/conventions/<name>.md`"
    라는 저장소 원칙과 어긋난다. 또한 이 신규 가드 파일들은 `swagger.md` frontmatter 의
    `code:` 목록(예: `swagger-dto-contract*.ts`·`user-entity-exposure*.ts`·`dto-jsdoc-citation*.ts`
    처럼 시행 코드를 등재하는 기존 패턴)에도 등재되지 않았다 — `status: implemented` 이므로
    빌드는 안 깨지지만(기존 glob 이 이미 ≥1 매치), 이 새 규칙을 spec-coverage 류 감사가
    `swagger.md` 소유로 추적할 방법이 없다.
  - 제안: `developer` 는 `spec/` 쓰기 권한이 없으므로(자기-반증형 소정정 5조건에도 해당 안
    함 — 이 문장은 developer 가 예전에 쓴 예고가 아니라 **신규 규칙**이다), 이 항목을
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(또는 신규 트래커)에
    "swagger.md §5-1 에 DTO 클래스명 전역 유일성 규칙 + `dto-class-name-collision-guard.ts`
    `code:` 등재" planner 후속 항목으로 남긴다. 규약 갱신이 적절한 사례.

- **[INFO] `rotateBotToken` 신규 `@ApiUnauthorizedResponse` 문구가 §2-4 기본값과 다르다**
  - target 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` —
    `rotateBotToken` 에 새로 추가된 `@ApiUnauthorizedResponse({ description: '인증 실패' })`
    (diff `+` 라인, `origin/main...HEAD` 확인)
  - 위반 규약: `spec/conventions/swagger.md` §2-4 "보호된 엔드포인트는 기본적으로
    `@ApiUnauthorizedResponse({ description: '인증 실패 또는 토큰 만료' })`를 포함합니다."
  - 상세: 저장소 전체 실측(`grep -rho "ApiUnauthorizedResponse({[^}]*})"`) 기준 `'인증 실패
    또는 토큰 만료'` 가 165곳으로 압도적 다수이고 `'인증 실패'`(짧은 형태)는 6곳뿐이다. 이번
    PR 이 새로 추가한 1곳은 같은 파일 안에 이미 있던 소수 패턴(`revokePerTriggerToken` 등,
    이번 diff 미변경분)을 그대로 복사한 것이라 신규 위반이 아니라 **기존 소수 패턴의
    재생산**이다. 기능적 영향은 없다(문서 텍스트 차이일 뿐).
  - 제안: 급하지 않음 — 다음에 이 엔드포인트 데코레이터를 다시 만질 때 `'인증 실패 또는
    토큰 만료'` 로 맞추거나, 짧은 형태가 이미 6곳에 굳어진 관행이라면 `swagger.md` §2-4 예시
    쪽에 "요약형 허용" 여지를 명시하는 편이 낫다(현재는 문서가 규정한 유일한 정답처럼 읽힌다).

## 준수 확인 (반례 아님 — 근거로 남김)

diff 를 conventions 관점에서 조사하며 명시적으로 **준수를 확인**한 항목:

- 신규 응답 DTO `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 는
  `swagger.md` §5-1 파일 위치 규칙(`dto/<module>/responses/*-response.dto.ts`)을 그대로
  따른다. 첫 판본은 평평한 `dto/` 에 있었고(`review/code/2026/09/12/16_39_18` requirement
  WARNING) 이번 diff 는 이미 그 자리로 옮겨져 있다.
- 같은 파일의 `ChatChannelRotateBotIdentityDto` 는 기존 `ChatChannelBotIdentityDto` 와의
  클래스명 충돌(`review/code/2026/09/12/16_17_57` documentation CRITICAL)을 해소한 상태다 —
  `@nestjs/swagger` 의 `components.schemas` 키가 클래스명이라는 근거까지 파일 헤더에
  정확히 남아 있다.
- `throwInvalidField()` 가 만드는 에러 봉투(`{ code: 'VALIDATION_ERROR', message, details: {
  field, code: ErrorCode.INVALID_FIELD } }`)는 `spec/5-system/2-api-convention.md` §5.3 의
  "객체 `details: { field, code, … }` — 단일 도메인 예외가 사유 하나를 붙일 때" 형태 및
  "`field` 를 실으면 `code` 도 싣는다(2026-09-11 규약화)" 규칙을 정확히 만족한다. 11개
  호출부를 헬퍼 하나로 모으면서 형태가 흔들린 곳은 없다.
  `ErrorCode.INVALID_FIELD` 도 raw 문자열이 아니라 `error-codes.ts` 의 상수 참조다.
  `rotateBotToken` 컨트롤러에 새로 붙은 `@ApiNotFoundResponse`(`RESOURCE_NOT_FOUND`)도
  §5.3 의 404 기본 코드 표와 일치한다 — 별도 카탈로그 등재 불필요.
- `@ApiForbiddenResponse`/`@ApiNotFoundResponse` 신규 추가는 `swagger.md` §5-4 체크리스트
  ("`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는 엔드포인트는 `@ApiForbiddenResponse`
  도 추가")와 같은 컨트롤러의 형제 엔드포인트(`revokePerTriggerToken`) 패턴 모두와 일치한다.
- `dto-class-name-collision-guard.ts` 는 "정규식이 아니라 AST(정본 파서)로 읽는다" 는 이
  저장소의 기존 결정(정적 가드: blind 정규식 vs 정밀 파서 경계)을 따른다 — 주석/문자열
  안의 `export class` 를 대조군(`decoy.dto.ts`)으로 직접 검증한다.
- 새 DTO 파일의 서사 주석은 `spec/conventions/review-citations.md` §3 규칙(JSDoc `/** */`
  은 공개 OpenAPI `description` 으로 나가므로 리뷰 인용을 넣지 않고, 바로 위 `//` 에 전체
  경로(`review/code/2026/09/12/16_39_18` 등)로 인용)을 정확히 지킨다 — 인용은 전부 날짜
  포함 전체 경로 형태(§2 권장)다.

## 요약

이번 diff 는 이미 두 차례 이상 리뷰를 거치며 CRITICAL(스키마 이름 충돌)·WARNING(응답 DTO
자리, `publicKey` 누락)을 소스 레벨에서 해소했고, 남은 코드는 `spec/5-system/2-api-convention.md`
§5.3 에러 봉투 형태·`swagger.md` §5 응답 DTO 배치·§2-4 데코레이터 체크리스트를 정확히
따른다. 유일하게 남는 정식 규약 관점의 갭은, 이번 PR 이 코드로 새로 도입한 강한 불변식
(DTO 클래스명 전역 유일성)이 그 불변식을 실제로 소유해야 할 `spec/conventions/swagger.md`
본문·frontmatter 어디에도 아직 반영되지 않았다는 점이다 — 이는 developer 권한 밖(예고 정정
예외에도 해당하지 않음)이라 planner 턴으로 넘겨야 한다. 그 외 하나는 사소한 문구 일관성
(INFO)뿐이다.

## 위험도
LOW
