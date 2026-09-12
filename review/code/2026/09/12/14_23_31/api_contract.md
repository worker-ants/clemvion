# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 하위 호환성 — `rotateBotToken` 의 "자격 증명 거부가 아닌" 실패 status 가 `400`→`502` 로 바뀌는 breaking change, 공지 완료 확인
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` `translateSetupChannelError` / `CHANGELOG.md` Unreleased 최상단 섹션(`## Unreleased — **Behavior change (breaking)**: ...`)
  - 상세: 직전 리뷰 라운드(`review/code/2026/09/12/13_41_55/api_contract.md` WARNING #5)에서 지적한 "PR 설명/릴리스 노트에 400→502 전환을 명시하라"는 항목이 이번 라운드에서 `CHANGELOG.md` 에 breaking-change 표제 + 영향 표 + "⚠️ 배포 시 확인" 콜아웃으로 반영됐다(`RESOLUTION.md` #4/#5, 커밋 `0adc3d577`). 내용도 실측과 일치한다 — `grep -rl 'BadGatewayException\|HttpStatus.BAD_GATEWAY\|ApiBadGatewayResponse' codebase/backend/src`(스펙 파일 제외) 결과 `triggers.service.ts`/`triggers.controller.ts`/`chat-channel-input-rules.ts` 3곳뿐이라 "이 저장소의 첫 502 사용" 주장이 맞고, 유일한 내부 소비자 `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 의 `rotateMutation.onError` 는 status/`code` 를 전혀 분기하지 않고 고정 toast 만 띄우므로(직접 확인) "저장소 안 소비자는 영향 없음" 주장도 맞다. `apiClient` 의 axios interceptor 도 401 전용 재시도만 있고 5xx 자동 재시도가 없어(`codebase/frontend/src/lib/api/client.ts:117-128`) 502 전환이 의도치 않은 클라이언트측 재시도 폭주를 유발하지 않음도 확인했다.
  - 판단: 외부/제3자 소비자에게는 여전히 실질적인 breaking change 이지만(4xx→5xx 는 재시도/알림 정책 분기축), 이 저장소가 갖는 유일한 커뮤니케이션 채널(CHANGELOG)로 명시적으로 공지됐고 spec(`15-chat-channel.md §5.4`, `R-CC-23`)·3라운드 consistency-check 를 거친 의도된 설계라 CRITICAL/WARNING 유지 불필요 — 이번엔 INFO 로 하향해 해소를 기록한다.

- **[INFO]** 중앙 에러 카탈로그 미등재 — 이미 추적 중, 이번 턴 조치 대상 아님 (carried-over)
  - 위치: `spec/5-system/3-error-handling.md §1` (`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 미등재 — `grep` 0건 재확인)
  - 상세: `spec/5-system/2-api-convention.md §5.3` 은 신규 에러 코드를 중앙 카탈로그에 등재하도록 요구하는데, 이 두 코드는 여전히 미등재다. 다만 이는 신규 발견이 아니라 직전 라운드 WARNING #9(정확히는 INFO #9 최종 분류)로 이미 등재됐고, `RESOLUTION.md` 가 "consistency-check 가 추적 중, `spec_impact: none` 확정"이라고 명시해 이번 developer 턴의 조치 범위 밖으로 확정했다. 재조치를 요구하지 않는다 — 참고로만 carry.

- **[INFO]** 응답 형식 — `GlobalExceptionFilter` 가 신규 502 경로를 마스킹 없이 통과시킴을 회귀 테스트로 고정 (positive 확인)
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`exception instanceof HttpException` 분기) / `codebase/backend/src/common/filters/http-exception.filter.spec.ts` 신규 테스트(게이트 221~236)
  - 상세: `BadGatewayException` 은 `HttpException` 이므로 `mapHttpErrorLike`(내부 5xx 를 의심해 500 으로 마스킹하는 로직)에 도달하지 않고 `resp.code`/`resp.message` 를 그대로 표준 봉투(`{error:{code,message,requestId}}`)에 싣는다 — 직접 코드를 읽어 확인했고, 이번 라운드에 추가된 캐너리 테스트가 그 경로를 고정한다(직전 라운드 WARNING #2 의 조치). 응답 스키마 축에는 회귀가 없다.

- **[INFO]** 요청 검증·인증/인가 — 이번 diff 는 두 축 모두 변경 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` (`@Roles('editor')`, `body.newBotToken` 인라인 검증 — 게이트 256~286)
  - 상세: 인가 데코레이터·요청 바디 유효성 검증 로직은 이번 변경의 대상이 아니며 그대로 유지된다. 변경은 오로지 `setupChannel` 실패 이후의 에러 분류·응답 계약에 한정된다.

## 요약

이번 라운드는 직전 API 계약 리뷰(`review/code/2026/09/12/13_41_55/api_contract.md`)가 남긴 WARNING 2건 중 조치 가능한 항목(400→502 breaking change 공지)이 `CHANGELOG.md` 갱신으로 실제 해소됐음을 재확인했고, 나머지 1건(중앙 에러 카탈로그 미등재)은 별도 트랙에서 `spec_impact: none` 으로 명시적으로 유예된 상태임을 확인했다. 신규로 도입된 502(`BadGatewayException`)는 `GlobalExceptionFilter` 표준 봉투를 그대로 통과하고, 유일한 내부 소비자(프런트엔드)는 status/코드를 분기하지 않아 영향이 없으며, 이번 라운드의 후속 커밋들(Discord 상수 추출·테스트 보강)은 API 계약 표면에 새로운 변경을 만들지 않았다. 새로 발견된 CRITICAL/WARNING 은 없다.

## 위험도

LOW
