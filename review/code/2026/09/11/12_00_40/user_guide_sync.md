# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재 확인

`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (동일 20행)을 SSOT 로 적재했다.

## 변경 set 요약

이번 diff 는 `chatChannel` PATCH 검증 에러 응답에 `details[].code`(`INVALID_FIELD`)를 15자리 배선하고(`triggers.service.ts` 객체 13곳 + `password.util.ts` 배열 2곳), `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 을 추가하고, 5개 차단 필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`·`botToken`·`inboundSigningPlaintext`)의 거부 메시지를 `chat-channel-rejection-messages.const.ts` 단일 상수로 통합한 backend PR 이다(+ 테스트·CHANGELOG·plan 산출물). `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `.en.mdx` 2개 문서 변경이 diff 안에 **포함**돼 있다.

이 세션은 동일 PR 의 3번째 검토 라운드다. `plan/in-progress/impl-details-code-wiring.md` 를 보면 1라운드(`review/code/.../11_05_27`)에서 `user_guide_sync` 는 router 판단으로 스킵됐고, 2라운드(`--route=all`, `11_33_35`)에서 강제 포함되자 정확히 이 리뷰가 지금 검증하려는 항목(W2: `02-nodes/triggers.mdx`·`.en.mdx` 가 `details.code` 반영을 빠뜨림)을 잡아냈다. 그 WARNING 이 **이번 diff 에서 실제로 반영됐는지**를 직접 소스로 확인했다.

## 발견사항

### 이전 라운드 WARNING(W2) — 해소 확인됨, 신규 이슈 없음

- 매트릭스 항목: `backend-api-change` (`codebase/backend/src/**/dto/**` glob — `chat-channel-config.dto.ts` 매치, `match:"semantic"`) target (b) *"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"*.
- 확인: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:429`(KO)·`triggers.en.mdx:418`(EN) 을 직접 Read 했다. 두 파일 모두 `chatChannel`/`provider` PATCH 거부 문장에 `` `details.code='INVALID_FIELD'` `` 가 새로 들어가 있다 (diff 상 `-`/`+` 로 확인, 실 파일 grep 으로 재확인 완료). 2라운드가 지적한 gap 은 이번 diff 안에서 **같은 turn 에 해소**됐다.

### [INFO] 같은 단락의 세 번째 문장(botToken/botTokenRef)은 여전히 `code` 미표기 — 이번 PR 의 신규 결함 아님

- 변경 파일: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (429행 다음 431행, 컨텍스트/미변경), `.en.mdx` 420행
- 매트릭스 항목: `backend-api-change` target (b), 동일
- 관측: 429/418행(위 문단)은 `code` 를 명기하도록 고쳐졌는데, 바로 다음 문장인 431행(KO)·420행(EN) — *"PATCH 본문에 `config.chatChannel.botToken` 을 실으면 400 `VALIDATION_ERROR` 가 돌아와요 (`details.field='chatChannel.botToken'`). 내부 식별자인 `botTokenRef` 도 마찬가지로 받지 않아요"* — 는 `code` 를 언급하지 않는다. 같은 단락 안에서 앞 문장만 갱신되고 뒷 문장이 그대로 남아 표기가 불균일하다.
- 신규 결함이 아닌 이유(코드 추적 결과): `botToken`/`botTokenRef` 를 PATCH 로 값 있는 문자열로 보내는 경로는 `ChatChannelUpdateConfigDto` 의 `@IsEmpty()` 위반 → 전역 `CustomValidationPipe`(`flattenErrors`) 를 타는데, 이 계층은 **이번 PR 이전부터** `code: 'INVALID_FIELD'` 를 싣고 있었다 (`trigger-dto-validation.spec.ts` 새 테스트 `[A]` 의 주석이 "이 층은 원래부터 싣고 있었다(flattenErrors) — 이 단언은 회귀 캐너리다" 라고 명시). 즉 이번 PR 이 **새로 만든 응답 shape 변경이 아니라** 원래도 있던 doc gap 이다. `plan/in-progress/impl-details-code-wiring.md` 2라운드 처분표의 `I12`("provider 문서 6개의 `code` 표기 — 이번 diff 의 직접 trigger 아님")와 정확히 같은 판단 축이다 — 다만 I12 는 `06-integrations-and-config/{slack,discord,telegram}.{mdx,en.mdx}` 6개 파일을 가리켰고, 여기서는 그 판단이 `02-nodes/triggers.mdx` 자기 자신의 인접 문장에도 그대로 적용된다는 점을 추가로 확인한 것이다.
- 상세(사용자 영향): 낮음. 사용자는 이미 `message` 필드로 사람이 읽을 수 있는 한국어/영어 사유를 받고, `code='INVALID_FIELD'` 는 기계 판별용 보조 필드다. 다만 이 문서가 API 응답 스키마를 리터럴로 인용하는 성격의 문서(같은 파일 다른 절이 `{ field, message, code }` 3필드 인용 관례를 이미 갖고 있음)라, 한 단락 안에서 두 문장은 `code` 를 적고 한 문장은 안 적는 것은 API 연동 개발자에게 혼동을 줄 수 있다.
- 제안(비차단, 후속 정리): 여유가 있으면 같은 turn 에 431행(KO)/420행(EN) 에도 `` `details.code='INVALID_FIELD'` `` 를 추가해 단락 내 표기를 통일하고, `I12` 트래커 항목에 이 두 줄도 함께 등재해 `slack`/`discord`/`telegram` 6개 파일과 한 번에 처리하는 것을 권한다. 이번 PR 을 막을 사유는 아니다.

## 영역 무관 확인 (매칭 안 된 나머지 trigger)

- 새 노드 추가 / 노드 schema 변경 — 변경 파일이 `codebase/backend/src/nodes/**` 밖(`modules/triggers/`, `common/utils/`)이라 glob 미매칭
- 신규 UI 문자열(TSX) / 신규 위젯 chrome 문자열 — TSX·`channel-web-chat` 변경 없음
- i18n dict / backend-labels — `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 는 backend 가 완성된 한국어 문자열을 응답 `message` 에 직접 실어 보내는 방식(frontend `dict`/`backend-labels.ts` 미경유)이라 parity 가드 대상 아님. `details[].code='INVALID_FIELD'` 도 `ERROR_KO`(node 실행 에러 전용, `nodes/core/error-codes.ts` 계열)와 다른 네임스페이스임을 `backend-labels.ts` 직접 확인 — `ERROR_KO` 에 `INVALID_FIELD` 매핑 자체가 없고 필요하지도 않다(DTO 검증 응답은 이미 `message` 로 완결된 한국어 문구를 실음)
- 통합/제공자 신규·변경 — 신규 provider 없음, 기존 5필드 거부 로직의 내부 리팩터 + `code` additive
- 유저 가이드 신규 섹션 디렉토리 — 신규 `docs/<NN>-<name>/` 없음
- `userguide-gui-flow-section`(`02-nodes/**.mdx` GUI 흐름 절 신규/변경, `<ImplAnchor>` 의무) — 이번 mdx 변경은 기존 문단의 인라인 문구 수정이며 신규 GUI 흐름 절/스크린샷 추가가 아니라 미해당
- 인증·권한·세션 흐름 변경 — `codebase/backend/src/modules/auth/**` 밖(`common/utils/password.util.ts` 는 auth 모듈이 아니라 공용 검증 유틸), `07-workspace-and-team/` 과 무관
- 표현식 언어 변경 / 실행·디버깅 흐름 변경 — 해당 경로 변경 없음
- 신규 warningCode/errorCode 발행 — `nodes/core/error-codes.ts` 자체는 이번 diff 에서 미변경. `INVALID_FIELD` 는 기존 canonical 값을 응답 발행 지점 15곳에 재사용한 것으로 "신규" 코드 발행이 아니다 — `ERROR_KO`/`WARNING_KO` 매핑 신설 트리거 미해당

## 요약

매트릭스 20행 중 유일하게 매칭된 `backend-api-change`(semantic, `dto/**` glob) 의 target (b) "API 노출 변경 → user-guide 페이지" 동반 갱신은 **이번 diff 안에서 이미 해소**돼 있다 — 2라운드 리뷰가 지적한 `02-nodes/triggers.mdx:429`/`triggers.en.mdx:418` 의 `details.code` 누락이 KO/EN 양쪽에 반영됨을 직접 파일 Read 로 확인했다. 같은 단락의 세 번째 문장(`botToken`/`botTokenRef`)은 여전히 `code` 미표기이나, 코드 추적 결과 그 경로는 이번 PR 이전부터 `code` 를 싣고 있던 pipe 계층이라 이번 PR 이 만든 신규 결함이 아니며, 이미 plan 문서의 `I12` 항목과 같은 판단 축으로 후속 정리 대상임을 확인했다(INFO). i18n dict parity·backend-labels·신규 섹션 locale·신규 node·auth 흐름·표현식 언어 등 나머지 19개 trigger 는 전부 미매칭(해당 없음). CRITICAL/WARNING 신규 0건.

## 위험도

LOW
