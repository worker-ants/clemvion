# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 확인

`.claude/config/doc-sync-matrix.json` (rows 20개, `new-node` ~ `spec-defect-found`) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SSOT 로 적재했다.

## 검증 방법 및 변경 set 식별

`git diff --stat origin/main...HEAD -- codebase/` 로 실제 코드 변경 파일을 직접 대조했다(prompt 상 diff 가 일부 생략된 파일이 있어 보강). 이번 diff 는:

- `chatChannel` PATCH 검증 에러 응답에 `details[].code`(`INVALID_FIELD`)를 15자리 배선 (`triggers.service.ts` 객체 13곳 + `password.util.ts` 배열 2곳)
- `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 추가
- 5개 차단 필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·`inboundSigningPlaintext`)의 거부 메시지를 `chat-channel-rejection-messages.const.ts` 신규 상수 파일로 통합
- `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `.en.mdx` 2줄 갱신 (`details.code='INVALID_FIELD'` 표기 추가)
- 테스트·CHANGELOG·plan/review 산출물

이 세션은 동일 PR 의 재검토 라운드다 (`plan/in-progress/impl-details-code-wiring.md` 기록상 code-review 3라운드 `11_05_27`→`11_33_35`→`12_00_40` 종결 이후, 인용 규약 정정 커밋 `9fcce3f47` 반영). `9fcce3f47` 은 `triggers.service.ts`(주석)·spec 파일·리뷰/트래커 산출물만 건드렸고 **docs MDX·i18n dict·backend-labels.ts 는 손대지 않았다** — 이번 라운드에서 doc-sync 관점의 신규 코드 변화는 없다.

## 발견사항

### [INFO] `triggers.mdx`/`triggers.en.mdx` 같은 단락의 인접 문장 + provider 문서 6개가 여전히 `details.code` 미표기 — 재확인, 신규 결함 아님, 이미 트래커 등재됨

- 변경 파일: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:431`, `triggers.en.mdx:420` / `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:119`, `telegram.en.mdx:106`, `discord.mdx:124,127`, `discord.en.mdx:113,116`, `slack.mdx:138,141`, `slack.en.mdx:138,141`
- 매트릭스 항목: `backend-api-change` (`trigger.globs: ["codebase/backend/src/**/*.controller.ts", "codebase/backend/src/**/dto/**"]`, match: semantic) target (b) *"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"*.
- 상세: 이번 PR 이 `triggers.mdx:429`(KO)/`triggers.en.mdx:418`(EN) 의 `chatChannel`/`provider` PATCH 거부 문장에는 `` `details.code='INVALID_FIELD'` `` 를 새로 추가했다(2라운드 리뷰 W2 반영, 직접 Read 로 확인). 그런데 **바로 다음 문장**(botToken/`botTokenRef` PATCH 거부, `431`/`420`행)과, 같은 성격의 서술을 가진 `telegram`/`discord`/`slack` 6개 provider 문서(ko/en)는 여전히 `details.field=...` 만 인용하고 `details.code` 를 언급하지 않는다. `git diff origin/main...HEAD -- codebase/backend/src/modules/triggers/triggers.service.ts` 로 실측하면 `botToken`/`inboundSigningPlaintext` 를 거부하는 서비스 가드 자리도 이번 PR 에서 `details: { field, code: ErrorCode.INVALID_FIELD }` 로 `code` 를 받으므로, 문서가 실제 응답 shape 보다 좁다.
- 왜 CRITICAL/WARNING 이 아닌가 (신규 결함이 아닌 이유): 이 정확한 gap 은 직전 라운드 리뷰(`review/code/2026/09/11/12_00_40/user_guide_sync.md`)가 이미 동일 라인들을 지목해 **동일한 판단 축**(INFO, 이번 PR 의 신규 결함 아님)으로 처분했고, `plan/in-progress/impl-details-code-wiring.md` 2라운드 처분표의 `I12`(*"provider 문서 6개의 `code` 표기 — 이번 diff 의 직접 trigger 아님"*)에 이미 등재돼 있다. `botToken`/`botTokenRef`/`inboundSigningPlaintext` 를 값 있는 문자열로 PATCH 하는 경로는 DTO `@IsEmpty()` 위반 → 전역 `CustomValidationPipe`(`flattenErrors`) 를 타는데, 이 계층은 **이번 PR 이전부터** `code: 'INVALID_FIELD'` 를 싣고 있었다(`trigger-dto-validation.spec.ts` `[A]` 테스트 주석: *"이 층은 원래부터 싣고 있었다 — 이 단언은 회귀 캐너리다"*). 즉 이번 PR 이 새로 만든 API shape 변화가 아니라 **pre-existing doc gap** 이며, 사용자 영향도 낮다(이미 `message` 필드로 완결된 한국어/영어 사유를 받고, `code` 는 기계 판별 보조 필드).
- 재확인 결과: `9fcce3f47`(이번 라운드에 추가된 유일한 커밋)이 이 문서들을 건드리지 않았으므로 상태 변화 없음 — 이전 라운드의 INFO 판정이 여전히 유효하다.
- 제안: 이번 PR 을 막을 사유는 아님(변경 없음 유지 가능). 여유가 있으면 같은 트래커 항목(`spec-draft-nullable-notation-followups.md` 의 I12 계열 백로그)을 후속 PR 에서 한 번에 처리해 8개 문서(교차 ko/en) 표기를 통일할 것을 권한다.

## 영역 무관 확인 (매칭 안 된 나머지 trigger)

- 새 노드 추가 / 노드 schema 변경 — 변경 파일이 `codebase/backend/src/nodes/**` 밖(`modules/triggers/`, `common/utils/`)이라 glob 미매칭
- 신규 UI 문자열(TSX) / 신규 위젯 chrome 문자열 — TSX·`channel-web-chat` 변경 없음
- i18n dict / backend-labels — `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 는 backend 가 완성된 한국어 문자열을 응답 `message` 에 직접 실어 보내는 방식(frontend dict/`backend-labels.ts` 미경유)이라 parity 가드 대상 아님. `details[].code='INVALID_FIELD'` 도 `backend-labels.ts` 를 직접 확인 결과 `ERROR_KO`(node 실행 에러 전용, `nodes/core/error-codes.ts` 계열 코드에 대한 매핑) 와 다른 네임스페이스다 — `ERROR_KO` 에 `INVALID_FIELD`/`VALIDATION_ERROR` 매핑 자체가 없고 필요하지도 않다(DTO 검증 응답은 이미 `message` 로 완결된 한국어 문구를 실음). `nodes/core/error-codes.ts` 파일 자체는 이번 diff 에서 미변경(`INVALID_FIELD` 는 기존 canonical 값 재사용) — `new-error-code`/`new-warning-code` 트리거 미해당
- 통합/제공자 신규·변경 — 신규 provider 없음, 기존 5필드 거부 로직의 내부 리팩터 + `code` additive
- 유저 가이드 신규 섹션 디렉토리 — 신규 `docs/<NN>-<name>/` 없음, `locale.ts` 무관
- `userguide-gui-flow-section`(`02-nodes/**.mdx` GUI 흐름 절 신규/변경) — 이번 mdx 변경은 기존 문단의 인라인 문구 수정이며 신규 GUI 흐름 절 추가가 아니라 미해당
- 인증·권한·세션 흐름 변경 — `codebase/backend/src/modules/auth/**` 밖(`common/utils/password.util.ts` 는 auth 모듈이 아니라 공용 검증 유틸), `07-workspace-and-team/` 과 무관
- 표현식 언어 변경 / 실행·디버깅 흐름 변경 — 해당 경로 변경 없음
- `backend-api-change` target (a) "controller·DTO 의 swagger jsdoc" — `chat-channel-config.dto.ts` 의 `@ApiProperty({ minLength: 1 })` 는 이미 기존에 선언돼 있었고 이번 PR 은 실제 검증 체인(`@MinLength(1)`)을 그 선언에 맞춘 것이라 swagger jsdoc 자체는 갱신 불요. 전역 `error-response.dto.ts` 의 `details` 필드도 `unknown` 타입이라 신규 서브키 추가가 swagger 갱신을 요구하지 않음(직접 확인)

## 요약

매트릭스 20행 중 유일하게 매칭된 `backend-api-change`(semantic, `dto/**` glob) target (b) "API 노출 변경 → user-guide 페이지" 동반 갱신은 이전 라운드(`11_33_35`)에서 지적된 `02-nodes/triggers.mdx:429`/`triggers.en.mdx:418` 의 `details.code` 누락이 이미 반영돼 있다. 같은 단락의 인접 문장(botToken)과 provider 문서 6개(telegram/discord/slack × ko/en)는 여전히 `details.code` 를 언급하지 않지만, 이는 이번 PR 이전부터 존재하던 pipe 계층 동작에 대한 pre-existing doc gap 이며 직전 라운드가 이미 INFO 로 처분·트래커(`I12`) 등재했고 이번 라운드의 유일한 신규 커밋(`9fcce3f47`)이 그 상태를 바꾸지 않았음을 재확인했다. i18n dict parity·backend-labels 매핑·신규 섹션 locale·신규 node·auth 흐름·표현식 언어 등 나머지 19개 trigger 는 전부 미매칭(해당 없음). CRITICAL 0, WARNING 0, INFO 1건(비신규·비차단).

## 위험도

LOW
