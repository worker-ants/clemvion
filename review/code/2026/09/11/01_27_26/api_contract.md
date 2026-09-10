# API 계약(API Contract) 리뷰 — `impl-chat-channel-patch-token` (6라운드, `c817a44c4` 기준)

## 컨텍스트

`git diff origin/main...HEAD --stat -- 'codebase/**'` 로 대조한 결과, 직전 4라운드
(`review/code/2026/09/11/00_45_18`, JSDoc 유출 수정 `464f2ba1a`) 이후 **`codebase/**` 변경은
0건**이다. 이번 라운드가 새로 포함하는 것은 최신 커밋(`c817a44c4`)의 `CHANGELOG.md` 신설 항목과
`plan/**` 트래커 동기화뿐이며, API 계약에 영향을 주는 프로덕션 코드(DTO·서비스·컨트롤러)는
1~3라운드(`23_21_57`·`23_55_23`·`00_21_55`) 의 `api_contract` 리뷰가 이미 상세 검증한 상태
그대로다. `triggers.controller.ts`(100~130행대)·`trigger-dto-validation.spec.ts`(846~865행대)를
`Read`/`grep` 으로 직접 재대조해 코드-문서 정합을 재확인했으며, 저장소 트리는 뮤테이션하지
않았다(읽기만 수행, `git status --short` 로 잔여물 없음 확인).

## 발견사항

- **[INFO]** 신규 `CHANGELOG.md` 항목(`## Unreleased — 카드 저장이...`)의 breaking-change 서술이
  실제 코드와 정확히 일치함을 재확인 — 새 결함 아님, 확인 기록
  - 위치: `CHANGELOG.md` (진단표 `| 사유 | details.field |` 3행), 대조 대상
    `codebase/backend/src/modules/triggers/triggers.controller.ts`
    `@ApiBadRequestResponse` 설명(`update()` 데코레이터 블록), `trigger-dto-validation.spec.ts`
    `it('[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일 때** 중첩 경로다', ...)`.
  - 상세: CHANGELOG 표가 서술하는 "비어있지 않은 값 → `chatChannel.botToken`(배열) / `null`·`''`
    → flat `botToken`(단일 object)" 두 갈래를, 방금 직접 실행 확인한 테스트 단언
    (`observed.botToken === ['chatChannel.botToken']`, 그 위 `[실측] 값이 null/빈 문자열이면
    DTO 를 통과한다` 케이스가 `toBeNull()`)과 컨트롤러 Swagger 문구 양쪽이 토씨까지 일치한다.
    이전 3라운드가 이미 이 두 갈래를 각각 검증했고, 이번 라운드는 그 실측이 CHANGELOG 로
    옮겨지는 과정에서 왜곡이 없었는지만 재확인했다.
  - 제안: 없음 — 정합 확인.

- **[INFO]** (기존 추적, 비차단, 변경 없음) `ChatChannelUpdateConfigDto` 의 금지 필드 두 개가
  여전히 OpenAPI `writeOnly: true` 로 선언돼 "채울 수 있는 값"이라는 신호를 준다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` `botToken`·
    `inboundSigningPlaintext` 의 `@ApiPropertyOptional({ ..., writeOnly: true })` (파일 2 diff
    게이트 `202`·`216` 부근).
  - 상세: 1~3라운드 `api_contract` 가 이미 지적하고 "즉시 조치 불요, SDK 코드젠 계획 생기면
    재검토"로 확정한 항목이다. 이번 라운드까지 이 필드의 스키마는 변경되지 않았다(diff 없음) —
    재-flag 가 아니라 상태 유지 확인.
  - 제안(유지): 별도 조치 불요.

## 확인된 것 — 위반 없음 / 이전 WARNING 해소

- **1라운드부터 이어지던 INFO("breaking change 인데 CHANGELOG 미기재")가 이번 라운드에서
  실제로 해소됐다.** `CHANGELOG.md` 에 `## Unreleased —` 절이 신설돼 PATCH 가 `botToken`/
  `inboundSigningPlaintext`/`provider`-전환/최초-`chatChannel`-부착 4가지를 400 으로 거부하는
  wire 계약 변경을 명시하고, 유일하게 알려진 소비자(`ChatChannelCard`)가 영향받지 않음을
  기록했다 — 5라운드(`01_10_43`) `documentation` 이 낸 WARNING(CHANGELOG 미기재)과 동일 항목.
- 에러 봉투 형식(`code: 'VALIDATION_ERROR'`, 두 형태의 `details`)·HTTP 상태(400)·
  인증/인가(`@Roles('editor')`)·URL 설계(`PATCH /api/triggers/:id`, 버전 접두사 없는 기존
  패턴)·페이지네이션은 이번 라운드 델타(`CHANGELOG.md`+`plan/**`)로 전혀 접촉되지 않았다.
- `spec/**` 파일 변경 0건 — 이번 델타도 developer 권한 경계(spec 정정은 planner 턴) 를
  유지한다.

## 요약

이번 6라운드의 실질 델타는 `CHANGELOG.md` 신설 항목과 `plan/**` 트래커 동기화뿐이고,
API 계약에 영향을 주는 `codebase/**` 코드는 4라운드 이후 변경이 없다(`git diff --stat` 로
확인). CHANGELOG 가 서술하는 breaking change 내용(3가지 400 사유, `details.field` 값의
비어있음-분기)을 실제 컨트롤러 Swagger 문서·검증 테스트와 대조한 결과 정확히 일치하며,
1라운드부터 이어지던 "breaking change 인데 CHANGELOG 미기재" INFO/WARNING 이 이번 커밋으로
해소됐다. 남은 것은 이전 라운드부터 조치 불요로 확정된 `writeOnly` 마커 INFO 하나뿐이며 이
라운드로 새로 도입되거나 재발한 API 계약 결함은 없다.

## 위험도

NONE
