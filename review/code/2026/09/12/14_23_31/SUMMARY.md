# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 3건 모두 코드 동작에 영향 없는 문서 정확성/공지 이슈이며(1건은 이미 CHANGELOG 로 완화된 의도된 breaking change, 2건은 문서·plan 서술 정확성), 병합을 막을 사유는 없다. forced 화이트리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 완료 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용/API계약 | `rotateBotToken` 실패 응답의 HTTP status 축이 400 단일 → 400/502 로 확장되는 breaking change(자격 증명 거부가 아닌 실패는 이제 502). 저장소 안 유일 소비자(frontend)는 status/code 를 분기하지 않아 영향 없음을 확인했고 CHANGELOG·spec·frontend 확인을 거쳐 공지 완료됐으나, 저장소 밖 제3자 통합에는 여전히 관측 가능한 인터페이스 변경 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` `translateSetupChannelError`(게이트 317~336), `triggers.service.ts`, `CHANGELOG.md` | 코드 조치 불요(의도된 설계, 공지 완료) — 배포 공지 채널(릴리스 노트)에도 동일 내용이 반영됐는지만 확인 권고 |
| 2 | 문서화 | `CHANGELOG.md` 의 "이 저장소 첫 사용" 실측 근거 3개 식별자 중 `HttpStatus.BAD_GATEWAY` 는 실제로 코드베이스 0건인데 "0건→1건"으로 과장 서술됨(`BadGatewayException`·`@ApiBadGatewayResponse` 는 맞음). plan 트래커의 다른 서술과도 모순 | `CHANGELOG.md` 게이트 8~9줄 | `HttpStatus.BAD_GATEWAY` 문구를 빼거나, enum 리터럴은 직접 참조되지 않는다고 구분해서 명시 |
| 3 | 문서화 | spec frontmatter "미구현"→"구현됐다" 정정을 수행한 바로 그 커밋(`3c47885a3`)이 같은 turn 에 그 사실을 "아직 해결 안 됨"으로 서술하는 새 트래커 항목을 등재 — 등재 시점에 이미 반증된 상태로 태어나 다음 세션이 끝난 작업을 다시 쫓을 위험 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2926-2931` | 항목에 "frontmatter 문구는 같은 커밋에서 이미 정정됨" 각주 추가 또는 체크박스 부분완료로 표시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 401/403 message-fallback 정규식이 여전히 provider 원문 문자열에 의존(한시적 예외) — 인가된 사용자만 도달, 최악의 결과도 상태코드 오분류 수준으로 실질 위험 낮음 | `chat-channel-input-rules.ts` `translateSetupChannelError`(게이트 321~325) | 조치 불요 — 기존 추적 항목(§1.1.2 fallback 제거 판정)을 따름 |
| 2 | 보안 | provider 원문이 HTTP 응답 대신 서버 로그(`Logger.warn`)로 이동 — 이론적 로그 인젝션(CWE-117) 표면 존재하나 노출 범위를 클라이언트→서버 로그로 좁힌 순수 개선이라 신규 위험 아님 | `triggers.service.ts` `rotateBotToken` catch(게이트 1070~1077) | 조치 불요, 필요 시 공통 로거 레벨에서 sanitize |
| 3 | 부작용 | `rotateBotToken` catch 블록의 신규 `logger.warn` 이 분류와 무관하게 모든 실패(일상적 사용자 오타 포함)에서 WARN 로그 발생 — 모니터링 알림 정책에 노이즈 유발 가능 | `triggers.service.ts`(게이트 1069~1078) | 로그 레벨 분리는 운영 판단 사항, 코드 조치 불요 |
| 4 | 아키텍처 | `chat-channel-input-rules.ts` 의 "0-dependency 입력 전용" 자기 서술과 출력측(HTTP 응답 계약) 변환인 `translateSetupChannelError` 의 공존이 이번 라운드에 더 커지며 심화(이월 항목) | `chat-channel-input-rules.ts` 헤더 주석 vs 게이트 294~336 | 별도 파일 분리 또는 헤더 주석에 "출력측 에러 변환 포함" 한 줄 추가 |
| 5 | 아키텍처/유지보수성 | `CREDENTIAL_REJECTED_CODE`(BOT_TOKEN_INVALID)는 명명 상수+타입+팩토리로 승격됐는데 형제 코드 `CHAT_CHANNEL_SETUP_FAILED` 는 여전히 리터럴 문자열 — 같은 계약의 두 갈래가 다른 추상화 수준 | `chat-channel/types.ts:486` vs `chat-channel-input-rules.ts:333`(+테스트 4곳) | `CHAT_CHANNEL_SETUP_FAILED_CODE` 상수 추가 또는 비대칭 사유를 주석으로 명시 |
| 6 | 아키텍처 | `Error.code` 판별자가 4가지 다른 네임스페이스(계약값/Discord 원본 숫자/EIA/Node 시스템 에러)로 오버로드되는데 그 경계가 타입이 아니라 JSDoc 주석에만 의존 | `chat-channel/types.ts` `isCredentialRejectedError`(게이트 512~532) | 코드 변경 불필요 — spec 문서(§1.1.2 다의성 표)에 이미 반영 확인됨 |
| 7 | 요구사항/API계약 | `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 가 중앙 에러 카탈로그에 여전히 미등재 — 기존 consistency-check 트래커가 추적 중, `spec_impact: none` 확정 | `spec/5-system/3-error-handling.md §1` | 코드 수정 불요 — 별도 트래커가 처리 |
| 8 | 요구사항 | Slack 자격 증명 거부 5값(`invalid_auth` 등) 열거가 spec 의 개방형 서술을 코드가 처음 확정 — spec 미반영 상태(회색지대) | `chat-channel/providers/slack/slack.adapter.ts:54-60` | 후속 spec PR 대상, 병합 차단 아님 |
| 9 | 스코프 | SUMMARY#1 fix 커밋에 무관한 타입 캐스팅 오타 정정("드라이브바이")이 커밋 메시지에 명시적으로 표시된 채 동반 | `triggers.service.spec.ts`, 커밋 `8847b6736` | 조치 불요 — 재발 시 "드라이브바이" 표시 관례 유지 |
| 10 | 스코프 | `spec/conventions/chat-channel-adapter.md` 정정이 이 developer worktree 안에서 이뤄졌으나 다른 attribution(Opus, planner 턴)으로 수행되어 CLAUDE.md 역할 경계(spec은 planner 전속)를 준수 | 커밋 `3c47885a3` | 조치 불요 — 위임 근거를 기록하는 관례 유지 |
| 11 | 유지보수성 | `discord.adapter.spec.ts` 만 "client 생성→spy→adapter 생성" 3줄 셋업을 헬퍼로 추출하지 않고 두 자리에 인라인 반복(slack/telegram 은 헬퍼화됨) | `discord.adapter.spec.ts:117-124, 132-139` | `rejectedWith`류 헬퍼 도입해 slack/telegram 과 스타일 통일 |
| 12 | 유지보수성 | `TriggersService.rotateBotToken` 이 이미 140줄대 6단계 오케스트레이션이며 이번 diff 로 로깅이 추가되며 계속 길어지는 중(기존 스코프, 이번 PR 신규 문제 아님) | `triggers.service.ts:985~` | 이번 PR 스코프 밖 — 향후 단계별 private 메서드 분리 고려 |
| 13 | 테스트 | Slack 자격 증명 거부 fixture 문구가 실제 `describe` 블록의 provider(telegram)와 불일치해 오독 여지(adapter mock 이라 정확성엔 영향 없음) | `triggers.service.spec.ts` | 문구를 telegram 형식으로 정정하거나 provider 무관성을 주석으로 명시 |
| 14 | 테스트 | telegram `error_code 400/부재` 테스트가 `for` 루프로 두 fixture 를 한 `it` 에 묶어 실패 시 원인 구분 어려움 | `telegram.adapter.spec.ts` | `it.each` 로 승격해 독립 테스트로 분리 |
| 15 | 테스트 | 컨트롤러→필터 전 구간 e2e 부재(단위+필터 테스트 조합이 두 경계를 각각 실측해 실질 공백은 낮음) / Discord 5xx 재시도-소진 경로 전용 테스트 부재(provider-무관 generic 502 테스트가 최종 분기 커버) | `triggers.controller.ts` `rotateBotToken`, `discord-client.ts` | 여유 있으면 e2e 502 케이스 1건 추가 — 급하지 않음 |
| 16 | 문서화/유저가이드 | Telegram 문서 대비 신규 Discord/Slack 문구의 서술 상세도 비대칭(Telegram 은 코드만 나열, Discord/Slack 은 자격 증명 거부 판별 조건까지 설명) — 누락은 아니고 깊이 차이 | `content/docs/06-integrations-and-config/{discord,slack,telegram}{,.en}.mdx` | 다음에 Telegram 페이지를 손댈 때 같은 수준으로 통일 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정보노출(CWE-209) 제거 등 순net 보안 개선 확인. 잔여 401/403 fallback·로그 이관은 인지된 한시적 예외 |
| architecture | LOW | 이전 라운드 WARNING(Discord 상수 비대칭) 해소 확인. 남은 3건은 파일 응집도·코드 상수 비대칭·`code` 오버로드 관련 INFO |
| requirement | NONE | spec 2개 문서(§5.4, §1.1.2)와 line-level 정합 확인, 이전 라운드 WARNING 5건 전부 반영 재확인. 중앙 카탈로그 미등재 등 INFO 2건은 별도 트랙 |
| scope | NONE | 조치 커밋 전량 RESOLUTION.md 와 1:1 대응, 숨은 스코프 이탈 없음. drive-by 정정 1건은 투명하게 기록됨 |
| side_effect | LOW | Logger spy 전역 누출 WARNING(이전 라운드) try/finally 로 해소 확인. 400→502 breaking change(의도됨)와 무조건 WARN 로깅은 기록 대상 |
| maintainability | LOW | 이전 라운드 WARNING(Discord 상수화 누락) 해소 확인. 코드 상수 비대칭·discord 테스트 헬퍼 미추출·rotateBotToken 비대화는 INFO |
| testing | LOW | 이전 라운드 WARNING 2건(spy 누출, 502 필터 통과 회귀 테스트 부재) 정확히 해소 확인. 잔여는 fixture 문구·테스트 세분화 등 INFO |
| documentation | LOW | 핵심 변경 문서화는 정밀하나 CHANGELOG 실측 오류 1건 + 트래커 항목 self-contradiction 1건 신규 발견 |
| api_contract | LOW | breaking change 공지(CHANGELOG) 완료 확인, 필터 502 패스스루 회귀 확인. 중앙 카탈로그 미등재는 carry-over INFO |
| user_guide_sync | NONE | 이전 라운드 WARNING(Slack/Discord 유저가이드 400/502 미반영) ko/en 4파일 전부 해소 확인. Telegram 대비 서술 깊이 비대칭만 INFO |

## 발견 없는 에이전트

없음 — 10개 에이전트 모두 최소 1건 이상의 INFO 를 보고했다(전부 병합 차단 사유 아님, 다수는 이전 라운드 지적사항의 해소 확인).

## 권장 조치사항

1. `CHANGELOG.md` 게이트 8~9줄의 `HttpStatus.BAD_GATEWAY` "0건→1건" 서술을 실측(0건→0건)에 맞게 정정하거나 해당 식별자를 문장에서 제거한다.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md:2926-2931` 항목에 "frontmatter 문구는 커밋 `3c47885a3` 에서 이미 정정됨" 각주를 추가해 다음 세션의 중복 작업을 방지한다.
3. (선택, 배포 전 확인) `rotateBotToken` 400→502 breaking change 가 릴리스 노트/배포 공지 채널에도 CHANGELOG 와 동일하게 반영됐는지 확인한다.
4. (급하지 않음) `CHAT_CHANNEL_SETUP_FAILED` 명명 상수 추가, `discord.adapter.spec.ts` 헬퍼 추출, telegram 테스트 `it.each` 분리 등 INFO 항목은 다음에 해당 파일을 손댈 때 함께 정리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 표 참조 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 changeset 범위(에러 분류 재구성)에 성능 영향 표면 없음 |
  | dependency | router 판단 — 신규 의존성 없음 |
  | database | router 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 제어 로직 변경 없음 |