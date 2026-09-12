# 문서화(Documentation) 리뷰 — impl-setup-error-code

## 발견사항

- **[WARNING]** 인접 spec 파일의 `pending_plans` 주석이 이 PR로 즉시 반증된다 (오래된 주석이 될 예정)
  - 위치: `spec/conventions/chat-channel-adapter.md:7` (이 diff 에 포함되지 않은 파일 — `Read`+`git blame` 로 직접 확인, 커밋 `8964a7114`, 작성 시각 2026-09-12 12:52:06, 이 developer 세션이 아니라 planner `#1323` 턴이 작성)
  - 상세: 해당 줄은 `# §1.1.2 의 code 선언 계약은 **미구현**이다 (adapter 3종 전부 developer 후속)` 이라고 적혀 있다. 그런데 이 PR(파일 4/7/9 — discord/slack/telegram adapter)이 정확히 그 "adapter 3종 전부"에 `credentialRejectedError`/`code` 선언을 배선했다. 병합 즉시 이 frontmatter 주석은 사실과 어긋난다 — `status: partial` spec 의 미구현 surface 추적 의무(`spec-impl-evidence.md §2.1`)를 스스로 인용하는 자리라 오래 방치되면 "아직 안 됐다"는 잘못된 신호로 다음 세션을 오도한다. 다만 이 문장은 developer 자신이 쓴 것이 아니라 planner 커밋이 쓴 것이라(`git blame` 확인) CLAUDE.md 의 "자기-반증형 소정정" 예외 조건 1(대상 문장을 developer 자신이 썼을 것)이 성립하지 않는다 — developer 가 직접 고칠 권한 밖이다.
  - 제안: 이번 PR 완료 시 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "CCA §1.1.2 401/403 fallback 제거 판정" 항목(이미 이 PR 의 완료를 착수 신호로 지정해 둔 항목 — `review/consistency/2026/09/12/12_54_15/SUMMARY.md` WARNING #4 도 같은 갭을 cross-link 누락으로 지적)에 완료 링크를 남기고, 후속 planner 턴에서 `chat-channel-adapter.md:7` 의 주석을 "code 선언 계약은 구현 완료(v1 provider 3종) — 남은 것은 fallback 제거 판정" 정도로 정정한다.

- **[WARNING]** 응답 계약을 바꾸는 변경인데 `CHANGELOG.md` 에 항목이 없다
  - 위치: `CHANGELOG.md` (Unreleased 섹션 — 이 PR 관련 항목 부재), 대응 코드: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` `translateSetupChannelError` (파일 12), `codebase/backend/src/modules/triggers/triggers.controller.ts` `@ApiBadGatewayResponse` (파일 13)
  - 상세: 이 저장소의 `CHANGELOG.md` 는 "Unreleased" 섹션에 이번과 비슷한 규모(에러 봉투 필드 배선, 검증 갭)의 변경을 서사형으로 상세히 기록하는 확립된 관례를 갖고 있다(현재 최상단 항목: "거부 사유가 사람만 읽을 수 있었다"). 이번 PR 은 (1) 이 저장소 최초로 `BadGatewayException`(502)을 실사용 경로에 배선하고, (2) `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 응답 본문에서 `details.reason`(provider 원문 조각)을 완전히 제거하며, (3) `BOT_TOKEN_INVALID` 의 사용자 메시지 문구를 바꾼다 — 세 가지 모두 이미 그 코드를 소비하고 있을 클라이언트/모니터링 입장에서는 관측 가능한 응답 형태 변경이다. `grep` 결과 `CHANGELOG.md` 에 `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`/`rotateBotToken` 관련 신규 항목이 없다.
  - 제안: 기존 관례를 따라 "Unreleased" 에 짧은 절을 추가 — 무엇이 바뀌었는지(400/502 분류 기준 변경, 원문 echo 중단, 502 최초 도입)와 근거(spec `#1323`/`R-CC-23`)를 한두 문단으로.

## 참고 (교차 확인 — 이미 등재됨, 추가 조치 불요)

- `review/consistency/2026/09/12/12_54_15/convention_compliance.md` 가 이미 WARNING 으로 지적한 두 건(신규 에러 코드 6종의 `3-error-handling.md §1` 중앙 카탈로그 미등재, `CCH-NF-03` rate-limit 의 §7 표 미등재)은 이번 PR 의 코드 변경이 만든 갭이 아니라 spec 쪽 사전 갭이며, `spec_impact: none` 선언과 자기-반증형 소정정 조건 2(API 계약은 예외 배제) 때문에 이 developer 턴의 범위 밖이 맞다. 별도 재지적 없이 확인만 했다.
- `translateSetupChannelError` 는 원래 입력측 파일(`chat-channel-input-rules.ts`, 파일 12)에 있는 출력측(에러 변환) 함수라는 계층-책임 서술 불일치(`15-chat-channel.md §7` 파일 트리 서술)는 `cross_spec.md` 가 이미 INFO 로 잡아 `spec-draft-nullable-notation-followups.md` 에 유예해 뒀다. 파일 12 의 함수 자체 JSDoc(`translateSetupChannelError`, `credentialRejectedError`, `isCredentialRejectedError`)은 내용이 정확하고 §5.4/§1.1.2 근거를 구체적으로 인용하므로 별도 조치 불요.

## 검증한 항목 (문제 없음)

- `discord.types.ts`(파일 5) `DiscordApiError.code`/`status` 신규 JSDoc — 네임스페이스 혼동을 명시적으로 경고하고 SoT 를 정확히 인용, 코드 동작과 일치.
- `chat-channel/types.ts`(파일 10) `credentialRejectedError`/`isCredentialRejectedError` — "왜 서브클래스가 아닌가", "왜 `as const` 가 필요한가"(TS literal-widening 실제 동작과 일치), "왜 truthiness 판별이 위험한가"(Node/undici `code` 네임스페이스 충돌) 모두 정확.
- `triggers.service.ts`(파일 15) `rotateBotToken` 의 `@throws` JSDoc — `BadRequestException`/`BadGatewayException` 두 갈래를 실제 throw 지점과 대조해 확인, 일치. 인라인 주석(`// [Spec Chat Channel §5.4] ...`)도 최신 분류 기준(transport 대신 `code` 판별)으로 정확히 갱신됨.
- `triggers.controller.ts`(파일 13) `@ApiBadRequestResponse`/`@ApiBadGatewayResponse` — 실제 throw 되는 코드 목록과 서술이 일치.
- `slack.adapter.ts`(파일 7) `SLACK_CREDENTIAL_REJECTED_ERRORS` 상수 JSDoc — "이 저장소 안에서 실측 불가"라는 한계와 열거 근거를 명시, `slack.adapter.spec.ts`(파일 6) 테스트와 1:1 대응.
- `telegram.adapter.ts`(파일 9) `telegramApiError`/`TELEGRAM_CREDENTIAL_REJECTED_STATUSES` — message 포맷을 "바꾸지 않는다"는 주장이 실제 코드(`Telegram ${method} failed: ...`, 기존 형식 유지)와 일치.
- `codebase/frontend/src/lib/i18n/backend-labels.ts`(파일 16) — `BOT_TOKEN_INVALID` 한국어 메시지 갱신과 그 이유(transport 축 제거) 설명이 정확하고, `translateBackendError` 의 non-ko fallback 경로(파일 미포함, 직접 확인)와도 모순 없음.
- `plan/in-progress/impl-setup-error-code.md`(파일 17) — 설계 판단 (a)~(e) 서술이 실제 구현(로깅 위치, 헬퍼 프로퍼티 방식, Slack 화이트리스트, Discord `code` 네임스페이스 분리)과 정확히 일치.

## 요약

diff 내부 문서(JSDoc·인라인 주석·plan 설계 판단)의 품질은 전반적으로 높다 — 신규 헬퍼·상수·판별 로직마다 "왜"를 구체적 근거(스펙 절 번호, 실측, TS 타입 규칙)로 뒷받침하고 있고 검증한 범위에서 부정확한 서술을 찾지 못했다. 다만 diff 바깥이지만 diff 가 직접 반증하는 자리 하나(`spec/conventions/chat-channel-adapter.md` frontmatter 의 "adapter 3종 전부 미구현" 주석)가 병합 즉시 오래된 주석이 되며, 이는 developer 권한 밖이라 후속 planner 턴으로 넘겨야 한다. 또한 502 최초 도입 + 응답 본문에서 provider 원문 제거라는, 이 저장소 CHANGELOG 관례상 기록할 만한 규모의 계약 변경이 CHANGELOG 에 반영되지 않았다. 둘 다 병합을 막을 사유는 아니다.

## 위험도

LOW
