# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 감사 액션 3종 추가가 CHANGELOG 에 반영되지 않았다
  - 위치: `CHANGELOG.md` (이번 diff 에 파일 자체가 없음 — `git status`/`git diff` 로 미변경 확인)
  - 상세: 이 저장소는 감사 로깅 확장을 CHANGELOG 항목으로 남기는 확립된 관례가 있다 — `CHANGELOG.md:50-76` 의 `## Unreleased — 감사 로깅 커버리지 확장: workflow / trigger / schedule / model_config` 항목이 정확히 같은 성격(2026-08-01, `workflow`/`trigger`/`schedule`/`model_config` CRUD 13개 신규 audit 액션)의 선례다. 이번 변경은 그 항목의 직접 후속(같은 `trigger` 리소스, 같은 `plan/in-progress/spec-sync-auth-gaps.md` 항목)이며, 오히려 특권 작업(Editor+, 평문 자격증명 응답)의 감사 공백을 닫는 보안 관련 변경이라 가시성이 더 필요하다. `audit-action.const.ts` 코드 주석 자신도 "계정 탈취 후의 조용한 교체를 `audit_log` 만으로 재구성할 수 있어야 한다"고 명시해 운영자가 알아야 할 변경임을 스스로 인정한다. 그런데도 이번 PR 은 CHANGELOG 를 건드리지 않았다.
  - 제안: `CHANGELOG.md` 상단에 새 `## Unreleased — <제목>` 섹션을 추가한다(이 파일은 새 항목마다 별도 `## Unreleased —` 헤더를 쓰는 방식). 신규 액션 3종(`trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked`)과 "이전에는 `recordAudit` 0건이었다"는 실측을 요약하면 기존 항목들과 형식이 맞는다.

- **[WARNING]** "응답에 새 자격증명을 1회 평문 반환" 이라는 반복된 서술이 회전 3종 중 1종(`chat_channel_bot_token_rotated`)에는 사실이 아니다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:83-84` (코드 주석), `spec/5-system/1-auth.md:431` (§4.1 신규 행), `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2320` (테스트 JSDoc)
  - 상세: `rotateNotificationSecret`(`triggers.service.ts:902-936`)와 `revokePerTriggerToken`(`triggers.service.ts:946-981`)은 서버가 `randomBytes` 로 새 자격증명을 생성해 응답(`{ secret, rotatedAt }` / `{ token }`)으로 평문 반환한다. 그러나 `rotateBotToken`(`triggers.service.ts:999-1128`)은 반대다 — 새 bot token 은 **호출자가 `body.newBotToken` 으로 이미 입력**한 값이고(외부 provider 콘솔에서 발급받아 직접 전달), 서버는 이를 저장·전파만 할 뿐 반환 타입(`{ rotatedAt, triggerId, chatChannelHealth, botIdentity }`, `triggers.service.ts:1004-1008`, 실제 구현 `1122-1127`)에 토큰 필드가 아예 없다. 즉 세 액션을 하나로 묶어 "응답에 새 자격증명을 1회 평문 반환한다"고 서술한 3곳(코드 주석·spec 카탈로그 행·테스트 JSDoc) 모두 `chat_channel_bot_token_rotated` 에 대해서는 부정확하다. 감사 필요성 자체(특권 작업이라는 점)는 셋 다 참이라 결론에는 영향 없지만, 근거로 든 사실 하나가 1/3 에서 틀렸다.
  - 제안: 세 서술을 "응답에 새 자격증명을 1회 평문 반환한다(단, `rotateBotToken` 은 호출자가 이미 보유한 토큰을 입력받아 저장만 하며 응답에 되돌려주지 않는다)"처럼 정정하거나, 감사 필요성의 근거를 "평문 자격증명을 다루는 특권 작업"으로 일반화해 세 액션에 공통으로 성립하는 표현으로 바꾼다.

- **[INFO]** `conventions/audit-actions.md` 신규 Rationale 이 언급하는 "알림 규칙" 소비자가 현재 존재하지 않는다
  - 위치: `spec/conventions/audit-actions.md:74`
  - 상세: "감사 독자가 '무엇이 회전됐나' 를 `details` 를 열어야 알 수 있으면 그 질문이 **조회 필터·알림 규칙**에서 사라진다"는 문장에서, "조회 필터" 는 실제로 뒷받침된다(`audit-logs.service.ts:39-40` 의 `action` 컬럼 WHERE 절 필터 확인). 그러나 "알림 규칙"(audit action 기반 alert)은 현재 구현에 없다 — `codebase/backend/src/modules/alerts/` 전체를 grep 해도 `AuditLogsService`/`audit_log` 참조가 0건이고, `spec/data-flow/1-audit.md` 자신도 "alerts 모듈에는 여전히 `AuditLogsService` import 가 없다"고 명시한다. 결론(3분리 채택)에 영향을 주는 정도는 아니지만, 문면이 "이미 존재하는 소비자"처럼 읽힐 수 있어 구현보다 약간 넓게 서술한다.
  - 제안: "향후 알림 규칙을 붙이더라도"처럼 가정법으로 바꾸거나, 현재는 조회 필터만 실재한다는 점을 명시한다. 결정 자체를 바꿀 필요는 없다(§1 "조회 필터" 원칙만으로도 3분리 근거는 충분하다).

- **[INFO]** `TriggersService` 의 "동작:" 번호 목록 JSDoc 이 신규 감사 기록 단계를 반영하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:888-901`(`rotateNotificationSecret` 앞 JSDoc, "동작: 1.~4." 목록) · `codebase/backend/src/modules/triggers/triggers.service.ts:983-997`(`rotateBotToken` 앞 JSDoc, "1.~6." 오케스트레이션 목록)
  - 상세: 두 JSDoc 은 회전 메커니즘(secret 생성·grace·cron 승격 등)을 번호 목록으로 정밀하게 나열하는데, 이번 diff 로 추가된 `recordAudit` 호출(각각 `triggers.service.ts:925-931`, `:1113-1119`)은 그 목록에 없다. `rotateBotToken` 은 호출부에 순서 근거 인라인 주석("컬럼 갱신이 끝난 뒤에 기록한다", `:1111-1112`)이 있어 실질적 설명은 있지만, 상단 "동작:" 목록 자체는 6단계로 여전히 닫혀 있다. `revokePerTriggerToken` 앞 JSDoc(`:938-945`)은 번호 목록이 아니라 산문이라 상대적으로 덜 어색하다.
  - 제안: 두 JSDoc 목록에 마지막 단계로 "N. `recordAudit` 로 감사 기록(성공 후에만)"을 추가해 목록이 실제 동작과 다시 일치하게 한다.

- **[INFO]** `15-chat-channel.md` 의 규약 위반 액션명 정정은 저장소 전수 기준으로 유일한 발생처였다 — 문서화 관점에서 통과
  - 위치: `spec/5-system/15-chat-channel.md:378`
  - 상세: `spec/`·`codebase/backend/src` 전체를 `chat-channel.rotate-bot-token`(및 관련 하이픈 패턴)으로 재검색한 결과 이번에 정정된 한 곳(`15-chat-channel.md:378`) 외에는 0건이었다(`R-CC-10`, `2-navigation/2-trigger-list.md:106,156`, `data-flow/14-chat-channel.md`/`15-external-interaction.md` 모두 확인). SUMMARY.md 가 "C3 — 기존 결함, 이번에 함께 정정"이라 판정한 범위와 실제 수정 범위가 정확히 일치한다. 후속 조치 불필요.

- **[INFO]** 인접 data-flow 문서 2건은 이번 6곳 갱신 범위 밖으로 남았다 — 사전 게이트가 이미 인지·유예한 사안
  - 위치: `spec/data-flow/14-chat-channel.md`, `spec/data-flow/15-external-interaction.md` (둘 다 신규 액션·`audit_log` 언급 0건, `git log`/`grep` 로 미변경 확인)
  - 상세: 착수 전 `cross_spec.md` 검토(INFO #7)가 이미 이 두 문서를 "오케스트레이터가 지정한 3파일 밖이지만 companion 후보"로 지목했고, `SUMMARY.md` 의 "동반 갱신 6곳" 목록에는 포함되지 않았다 — 즉 의도적으로 이번 스코프에서 제외된 것으로 보인다. 신규 문서 작성을 요구하는 결함은 아니나, 두 문서가 회전/revoke 파이프라인을 상세 서술하면서 audit 단계가 빠져 있다는 점 자체는 여전히 유효하다.
  - 제안: 이번 PR 의 후속 처리 항목으로만 남겨도 무방(블로킹 아님) — `plan/in-progress/spec-sync-auth-gaps.md` 에 한 줄 정도 잔여 항목으로 적어두면 재drift 를 막을 수 있다.

- **[INFO]** OpenAPI(`@ApiOperation`) 설명에 감사 기록 사실을 넣을 필요는 없다 — 기존 관례와 일치
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:176-265` (세 엔드포인트의 `@ApiOperation.description`, 이번 diff 에서 미변경)
  - 상세: 세 엔드포인트 모두 이미 상세한 `@ApiOperation.description`(grace 메커니즘·1회 평문 반환 등)을 갖고 있지만 "감사 로그에 기록됨" 언급은 없다. 다만 이는 이번 PR 이 새로 만든 공백이 아니라 저장소 전체 관례다 — `triggers.controller.ts` 의 기존 CRUD(`create`/`update`/`remove`)도, `auth-configs.controller.ts` 의 `regenerate`/`reveal` 도 Swagger description 에 audit 기록을 언급하지 않는다(`auth-configs.controller.ts:103-104` 는 코드 인라인 주석에만 "CRUD 감사 로그" 언급, ApiOperation 밖). 저장소 전체에서 ApiOperation.description 에 감사 사실을 적은 컨트롤러는 `audit-logs.controller.ts` 자신(목록 조회 엔드포인트) 뿐이다.
  - 제안: 없음 — 이 PR 범위에서 추가하면 오히려 다른 CRUD 엔드포인트와 비대칭이 생긴다. 프로젝트 전체 관례를 바꾸고 싶다면 별도 스코프의 결정이 필요하다.

- **[INFO]** README 갱신 불필요 — 확인됨
  - 위치: `codebase/backend/README.md`
  - 상세: 신규 환경변수·설정·셋업 단계가 없고, backend README 는 애초에 audit 기능을 언급하지 않는다(grep 0건). 이번 변경은 기존 감사 인프라에 액션 3종을 추가하는 내부 확장이라 README 갱신 대상이 아니다.

## 요약

문서 갱신의 폭 자체(spec 6곳 · `conventions/audit-actions.md` Rationale · plan 체크박스 · 코드 주석)는 이 저장소의 재drift 방지 관례(SoT 3~4곳 동시 갱신)를 충실히 따랐고, 사전 consistency 게이트가 지목한 항목(액션명 규약 위반 정정·명명 대칭·Rationale 신설)도 실측 대비 정확하게 반영됐다 — 특히 `15-chat-channel.md` 의 규약 위반 액션명 정정은 저장소 전수 기준으로 유일한 발생처를 정확히 잡았다. 다만 두 가지는 병합 전 보완이 필요하다: (1) 동일 성격의 선행 변경(2026-08-01 CRUD 감사 확장)이 CHANGELOG 항목을 남긴 반면 이번 변경은 그렇지 않아 일관성이 깨진다 — 특권 작업의 감사 공백을 닫는다는 자체 서술을 감안하면 누락이 더 두드러진다. (2) "응답에 새 자격증명을 1회 평문 반환한다"는 서술이 코드 주석·spec 카탈로그 행·테스트 JSDoc 세 곳에 반복되는데, 회전 3종 중 `chat_channel_bot_token_rotated` 하나는 새 토큰이 호출자 입력값이라 응답에 반환되지 않아 사실과 다르다 — 감사 도입의 정당성 자체는 훼손되지 않지만 반복된 사실 오류라 정정이 필요하다. 그 외 `conventions/audit-actions.md` 의 "알림 규칙" 언급과 JSDoc "동작:" 목록 누락은 경미한 정확도 이슈로 INFO 수준이다.

## 위험도

MEDIUM
