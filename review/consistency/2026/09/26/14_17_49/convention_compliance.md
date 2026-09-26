# 정식 규약 준수 검토 — success-advert `--impl-done`

## 검토 범위

- 모드: `--impl-done` (scope=`spec/`, diff-base=`origin/main`). scope 델타 자체는 0개 파일이지만, 구현 diff
  15개 파일 / 1185줄(`origin/main...HEAD`)을 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/success-advert`)에서
  직접 확인했다.
- 실제로 바뀐 정식 규약 문서: `spec/conventions/swagger.md` (§2-4 상태 코드 표 3xx 행·본문, §5-2 `ApiOkWrappedNullableResponse` 행,
  §5-4 체크리스트 문장, `## Rationale` §2-4 불릿 교체) — 커밋 `24084fd0e`.
- 대조한 구현 코드: `common/swagger/api-wrapped.ts`(+`.spec.ts`), `webauthn-response.dto.ts`/`webauthn.controller.ts`,
  `trigger-secret-issue-response.dto.ts`/`triggers.controller.ts`, `assistant-session-response.dto.ts`/`workflow-assistant.controller.ts`,
  `interaction-stream.controller.ts`, `http-status-advertised-guard.ts`(+`.spec.ts`+fixture), `CHANGELOG.md`,
  `plan/in-progress/success-advert.md`·`spec-draft-swagger-success-advert.md`·`spec-draft-nullable-notation-followups.md` 증분.
- 선행 라운드: `review/consistency/2026/09/26/13_07_11`(`--spec`) · `13_17_19`(`--impl-prep`) 의 convention_compliance 보고서를
  먼저 읽고, 그때 제기된 지적이 이번 구현 완료 시점에 어떻게 처분됐는지를 1차 대조축으로 삼았다.

## 발견사항

- **[INFO]** §5-2 `ApiOkWrappedNullableResponse` 행에 `allOf`+`nullable` 구현 함정 한 줄이 여전히 영구 문서에 없음 — 직전 INFO 가
  "구현 커밋에서" 추가하라고 지정한 그 커밋이 이미 지나갔다
  - target 위치: `spec/conventions/swagger.md` §5-2 공용 래퍼 표, `ApiOkWrappedNullableResponse(Dto)` 행 (커밋 `24084fd0e`)
  - 위반 규약: 직접 위반은 아님 — `swagger.md` §1-4 Rationale(*"OpenAPI 3.0 은 `\$ref` 옆의 형제 키를 무시한다"*)와의 **일관성**
    권고, 그리고 직전 `--impl-prep` 라운드(`review/consistency/2026/09/26/13_17_19` INFO #2)가 명시한 "`ApiOkWrappedNullableResponse`
    를 실제로 구현하는 커밋에서 §5-2 표 행에 반영" 조건.
  - 상세: 이번 세션이 실제로 `ApiOkWrappedNullableResponse` 를 구현했다(`codebase/backend/src/common/swagger/api-wrapped.ts` —
    JSDoc 에 "OpenAPI 3.0 은 `\$ref` 옆의 형제 키(`nullable`)를 무시하므로 `allOf: [<ref>]` 로 감싸 `nullable` 을 붙인다" 고 정확히
    적었다). 그런데 이 설명은 **코드 JSDoc 에만** 남았고, 영구 문서인 `spec/conventions/swagger.md` §5-2 표 행/각주에는 옮겨지지
    않았다. `plan/in-progress/spec-draft-swagger-success-advert.md` 의 "Rationale (이 draft 의)" 절에도 같은 설명이 있지만 이
    draft 는 plan 산출물이라 영구 참조처가 아니다(직전 라운드가 이미 지적한 것과 같은 성격의 gap). §1-4 Rationale 은 이미 저장소
    본문에 같은 함정을 한 번 적어 두었으므로, §5-2 가 같은 함정의 두 번째 발현 자리라는 사실을 후속 독자가 §1-4 를 다시 찾아야만
    알 수 있다.
  - 제안: `swagger.md` §5-2 표의 `ApiOkWrappedNullableResponse` 행 아래에 "구현은 `allOf: [<ref>]` 에 `nullable` 을 붙인다(§1-4 와
    같은 `\$ref` 형제 키 무시 사정)" 한 줄을 각주로 추가. 차단 사유는 아니며(가드도 없고 소비자에게 위험한 정보 누락도 아님),
    비용이 한 줄이라 다음 손질 때 함께 반영해도 무방.

## 검증한 항목 (문제 없음)

- **§2-4 신설 규칙과 실제 가드 배선 정합** — `http-status-advertised-guard.ts` 가 `HttpStatusUnadvertised`/`unadvertised` 를
  신설했고, `http-status-advertised.spec.ts` 가 `expect(unadvertised).toEqual([])` 로 베이스라인 0 을 실제로 강제한다. 직전
  `--impl-prep` 라운드(`13_17_19` WARNING)가 지적한 "Rationale 이 아직 안 된 일을 완료형으로 서술" 문제는 이 구현 커밋으로
  실측이 문장을 따라잡아 **해소됐다** — `grep`: `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 존재, 11개 라우트 전부
  응답 DTO+광고 완료, 가드 RED→GREEN 전환 기록(`plan/in-progress/success-advert.md` 체크리스트).
- **응답 DTO 위치·명명** — 신규 DTO 전부 `dto/responses/*-response.dto.ts` 규약(§5-1)을 지킨다
  (`trigger-secret-issue-response.dto.ts`, `webauthn-response.dto.ts`, `assistant-session-response.dto.ts`). 클래스명
  (`NotificationRotateSecretDto`·`InteractionRevokeTokenDto`·`WebAuthnAvailabilityDto`·`AssistantSessionDto`·
  `AssistantSessionDetailDto`·`AssistantMessageDto`·`AssistantToolCallDto`·`AssistantPlanDto`·`AssistantPlanStepDto`·
  `AssistantUsageDto`) 는 `codebase/backend/src` 전수 검색으로 **저장소 전체 유일**(§5-1 강제 규약) 확인. 도메인 접두 패턴도
  선례(`ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto`)와 동일 축.
- **nullable vs 키 생략 선언 형태** — `AssistantSessionDto.title`/`llmConfigId`, `AssistantMessageDto`의 여러 필드가
  "상시 존재 + null" 은 `@ApiProperty({ nullable: true })` + `T | null`, "부재 시 키 생략" 은 `@ApiPropertyOptional()` + `T?`
  로 정확히 갈려 있어 api-convention §5.4·swagger §1-4 의 선언 형태 규칙과 일치.
- **열린 map 예외 근거 명시** — `AssistantToolCallDto.arguments`/`result` 를 `additionalProperties: true` 로 연 것은 §1-4
  "형태는 고정이나 SoT 이중화 회피" 예외에 정확히 해당하고, 코드 주석이 그 예외 조항과 SoT(`tools/tool-definitions.ts`)를
  명시적으로 인용한다 — "번거로움" 사유가 아님을 확인.
  - `enumName` 부여(`AssistantSessionStatus`·`AssistantMessageRole`·`AssistantToolCallKind`·`AssistantStepAction`·
    `AutoResumeReason`)도 §1-4 enum 규약과 일치.
- **JSDoc vs `//` 내부 서사 분리** (§3, 2026-09-05 규약) — `assistant-session-response.dto.ts`·`trigger-secret-issue-response.dto.ts`
  모두 파일 상단에 "내부 서사를 `//` 에 두는 이유: JSDoc 은 공개 OpenAPI `description` 으로 나간다" 라는 동일 문구로 규약을
  명시적으로 인용하고, 실제로 내부 근거는 `//`, 소비자용 설명은 `/** */` 로 분리했다.
- **secret/token 응답 필드에 `readOnly` 미부여** — §1-5 의 `readOnly` 의무는 "서버가 자동 발급하는 파생 필드"(`hasBotToken`
  류) 대상이지, "평문 1회 노출" 응답 자체(`RevealAuthConfigResponseDto` 선례와 동일 패턴)는 대상이 아니므로 미부여가 정당.
- **가드·데코레이터 순서** (§2-2) — 신규 `@ApiOkWrappedResponse`/`ApiOkWrappedNullableResponse`/`ApiOkWrappedArrayResponse`/
  `ApiCreatedWrappedResponse`/`ApiNoContentResponse` 전부 `@ApiOperation`(+`@ApiParam`/`@ApiQuery`) 다음, 에러 응답
  데코레이터(`@ApiUnauthorizedResponse` 등) 이전에 배치돼 예시 순서(§2-2)와 일치.
  `@ApiFoundResponse` 는 `@nestjs/swagger` 실제 export(직전 라운드에서 확인됨) — API 문서 도구 데코레이터 명명 규약 위반 없음.
- **§6 레거시 패턴(빈 껍데기 스키마) 재도입 없음** — 신규 엔드포인트 전부 DTO 기반 래퍼(`ApiOkWrappedResponse(Dto)` 등)를 쓰고,
  인라인 `{ type: 'object', properties: { data: { type: 'object' } } }` 형태를 새로 추가하지 않았다.
- **가드 자기 인벤토리 형식** — 신설 `HttpStatusUnadvertised` 인터페이스는 형제 `HttpStatusViolation`/`HttpStatusUnresolved` 와
  같은 `HttpStatus<Noun>` 명명 축을 따르고, `HttpStatusScan.unadvertised` 필드에 JSDoc 으로 "무엇을 세는지" 를 명시해
  api-convention §5.4 검증 층 표가 요구하는 "개수를 세지 않고 표가 인벤토리를 갖는다" 원칙과 같은 취지(가드 자신의 JSDoc 이 SoT).
- **plan/CHANGELOG 명명·frontmatter** — `plan/in-progress/spec-draft-swagger-success-advert.md`·`success-advert.md` 모두
  `plan-lifecycle.md §4` 필수 3필드(`worktree`/`started`/`owner`) 충족, `spec_impact` 는 실재 경로 리스트(Gate C 형식 위반
  없음). `spec-draft-*` prefix 는 확립된 명명 패턴. CHANGELOG 신규 두 항목은 기존 `## Unreleased — <제목>` 형식과 동일.
- **선행 WARNING/이슈 트래킹 상태** — 13:07:11 라운드의 §5-4/§5.4 절 번호 혼용 WARNING 은 draft 본문에서 실제로 정정됨
  ("`--spec` 경고 처리" 절 W3 확인). 13:17:19 라운드의 두 spec 갭(`4-ai-assistant.md` §6 API 표 누락, `revoke-token`
  rotation/폐기 서술 불일치)은 임의로 덮지 않고 `spec-draft-nullable-notation-followups.md` 에 정확히 등재돼 planner 소관으로
  넘어갔다 — 은폐가 아니라 트래커 위임.

## 요약

이번 구현은 스스로 신설한 `spec/conventions/swagger.md` §2-4/§5-2 규약(성공 응답 하나 이상 광고, nullable 래퍼)을 코드
(가드·DTO·컨트롤러·e2e)로 정확히 채웠고, 직전 두 라운드(`--spec`/`--impl-prep`)가 제기한 WARNING(미완료 서술의 완료형 표현)은
실제 구현이 뒤따르며 해소됐다. 신규 DTO 10개는 위치·명명·유일성·nullable/optional 선언 형태·열린 map 예외 근거·JSDoc-`//` 분리
전부 `spec/conventions/swagger.md` 축과 일치했고, 저장소 전역에서 동명 클래스·빈 껍데기 스키마 같은 금지 패턴 재도입도 없었다.
유일한 잔여 사항은 INFO 1건 — §5-2 신규 래퍼 행에 `allOf`+`nullable` 구현 함정을 옮겨 적는 문서 일관성 개선이 그 구현 커밋에서도
아직 반영되지 않은 것으로, 차단 사유는 아니다.

## 위험도

LOW
