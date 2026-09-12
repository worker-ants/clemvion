# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없다. 핵심 로직(`code` 기반 자격 증명 거부 판별, 3-provider 화이트리스트, 502 최초 도입, `details.reason` 제거)은 뮤테이션 검증까지 통과했으나, 테스트 위생(전역 spy 누출 위험 + 신규 502 경로의 필터 통과 회귀 테스트 부재)과 유저가이드 동반 갱신 누락(Slack/Discord 06-integrations-and-config, Telegram 형제 절과 비대칭) 등 실질 WARNING 7건이 남아 있다. forced 화이트리스트 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/부작용 | `jest.spyOn(Logger.prototype, 'warn')` 를 스파이하면서 원복을 테스트 본문 마지막 줄의 수동 `mockRestore()` 하나에만 의존(`try/finally`·`afterEach` 없음). 앞선 `expect` 실패 시 spy 가 파일 전체(3000줄+, 14개 describe)로 누출. 같은 저장소 `http-exception.filter.spec.ts` 가 이미 "afterEach 로 통일(B-5)" 관례를 명문화했는데 이번 신규 테스트가 이를 따르지 않음 | `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2028-2046` | `afterEach(() => jest.restoreAllMocks())` 로 옮기거나 `try/finally` 로 감싼다 (`discord-client.spec.ts` 의 `global.fetch` 복원이 이 저장소 안의 좋은 선례) |
| 2 | 테스트 | 이 저장소 최초의 `BadGatewayException`(502) 실사용 경로가 실제 `GlobalExceptionFilter` 를 통과할 때도 마스킹되지 않는지 잠그는 테스트가 없다. 같은 필터의 다른 분기(`mapHttpErrorLike`)는 "5xx-ish 는 의심하고 500 으로 마스킹"하는 기존 철학을 갖고 있어, `HttpException` 분기까지 그 마스킹이 확장되는 회귀가 생겨도 지금은 잡아낼 캐너리가 없다 | `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (5xx `HttpException` 케이스 0건) | `new BadGatewayException({code:'CHAT_CHANNEL_SETUP_FAILED', ...})` → `status===502` 를 단언하는 테스트 1건 추가 (기존 409 케이스와 동일 패턴) |
| 3 | 유지보수성 | 동일한 "401/403 = 자격 증명 거부" 규칙이 provider 마다 다른 형태로 구현됨 — Telegram/Slack 은 이름 있는 모듈 상수(`TELEGRAM_CREDENTIAL_REJECTED_STATUSES`, `SLACK_CREDENTIAL_REJECTED_ERRORS`)로 추출했지만 Discord 는 `401`/`403` 리터럴을 인라인 삼항식에 하드코딩. 판정 기준이 바뀌거나 세 번째 provider 가 패턴을 복사할 때 스타일 혼선 우려 | `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:75` vs `telegram.adapter.ts:48` | Discord 도 이름 있는 상수(`DISCORD_CREDENTIAL_REJECTED_STATUSES`)로 추출하거나 `chat-channel/types.ts` 에 3-provider 공용 상수 신설 |
| 4 | 문서화 | 이 저장소 CHANGELOG 관례(Unreleased 섹션에 계약 변경을 서사형 기록)를 따르면 기록 대상인 변경 3건 — (1) 502 최초 도입, (2) 응답 본문에서 `details.reason`(provider 원문) 완전 제거, (3) `BOT_TOKEN_INVALID` 사용자 메시지 문구 변경 — 이 `CHANGELOG.md` 에 반영되지 않음 | `CHANGELOG.md` (Unreleased 섹션에 해당 항목 부재) | Unreleased 에 짧은 절 추가 — 400/502 분류 기준 변경 + 원문 echo 중단 + 근거(spec `#1323`/`R-CC-23`) |
| 5 | API 계약 | `rotateBotToken` 실패 중 "자격 증명 거부가 아닌" 사유의 HTTP status 가 `400→502` 로 바뀐다. `code` 문자열은 유지되지만 4xx→5xx 전환은 클라이언트/프록시/모니터링의 재시도·알림 정책이 달라질 수 있는 축이다. spec·consistency-check 를 통과한 의도된 breaking change 이고 현재 유일한 내부 소비자(프런트엔드 토스트)는 status 를 분기하지 않아 영향받지 않음을 실측 확인했으나, 외부/제3자 소비자가 있다면 영향권 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` `translateSetupChannelError` / `triggers.controller.ts` `@ApiBadGatewayResponse` | PR 설명·릴리스 노트에 status 코드 변경(400→502 분기)을 명시적으로 공지 |
| 6 | 유저가이드 동반 갱신 | Slack/Discord provider 유저가이드 페이지(06-integrations-and-config)가 이번 PR 이 처음 실현한 400/502 에러 분류를 반영하지 않는다. Telegram 형제 절(§6)은 이미 "400 `BOT_TOKEN_INVALID`/502 `CHAT_CHANNEL_SETUP_FAILED`" 를 서술하고 있어(사전 spec 이 aspirational 하게 적어둔 것을 이 PR 이 처음 사실로 만듦) 정합하지만, Slack §5.5/Discord §6.5 는 rotate-bot-token 이 반환할 수 있는 에러 코드를 아예 나열하지 않아 비대칭 | `codebase/frontend/src/content/docs/06-integrations-and-config/{slack,slack.en,discord,discord.en}.mdx` (§5.5/§6.5, 미갱신) | Telegram §6 패턴을 ko/en 4파일에 미러링 — "에러: 400 `BOT_TOKEN_INVALID`(자격 증명 거부 조건), 502 `CHAT_CHANNEL_SETUP_FAILED`(그 밖)" 한 줄 추가 |
| 7 | SPEC-DRIFT 후보 (조사 결과 낮은 확신) | `[SPEC-DRIFT 후보 — 조사 결과 낮은 확신]` `spec/conventions/chat-channel-adapter.md` frontmatter `pending_plans` 주석이 "§1.1.2 의 `code` 선언 계약은 미구현이다 (adapter 3종 전부 developer 후속)" 라고 적고 있는데, 본 PR 이 정확히 그 3종(discord/slack/telegram) 전부에 `code` 를 부착해 이 문장을 반증했다. `git blame` 확인 결과 이 문장은 developer 자신이 아니라 planner 커밋(`8964a7114`)이 작성해, CLAUDE.md 의 "자기-반증형 소정정" 예외 조건 1(작성자=developer)이 성립하지 않으므로 developer 가 직접 고칠 권한 밖이다 | `spec/conventions/chat-channel-adapter.md:7` (frontmatter), 대응 본문 `:188-190` | 후속 planner 턴에서 frontmatter "미구현" 서술을 "구현 완료(v1 provider 3종) — 남은 것은 fallback 제거 판정" 으로 정정 + `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "CCA §1.1.2 401/403 fallback 제거 판정" 항목에 이 PR 완료 링크 cross-link (이미 `review/consistency/2026/09/12/12_54_15/SUMMARY.md` WARNING #4 가 인접 사실 지적) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `translateSetupChannelError` 의 401/403 message-fallback 정규식이 `code` 미부착 경로를 위한 한시적 예외로 남아 있음. 권한 있는 사용자만 도달 가능 + 응답에 원문이 실리지 않아 실질 위험 낮음. plan 문서가 설계 의도로 명시 | `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`/\b(401|403)\b/.test(message)`) | 3-provider 전부 `code` 부착 완료 후(이번 PR 로 충족) fallback 제거 검토 — 상단 WARNING #7 과 연동 |
| 2 | 아키텍처 | `chat-channel-input-rules.ts` 는 스스로를 "0-dependency 입력 검증 계층"이라 서술하지만 `translateSetupChannelError` 는 출력측(에러→응답) 변환 함수 — 이 diff 가 그 로직을 확장해 기존 미스매치가 다소 심화 | `chat-channel-input-rules.ts` 상단 헤더 주석 vs `translateSetupChannelError` | 헤더 주석에 "출력측(에러 변환) 포함" 한 줄 추가 또는 별도 파일 분리(급하지 않음, 기존 consistency-check 유예 항목) |
| 3 | 아키텍처 | `Error.code` 프로퍼티가 계약값/Discord 원본 숫자/EIA 분류/Node 시스템 에러 4가지 의미로 오버로드되어 있고, 이 다의성은 JSDoc 주석에만 의존(타입으로 강제되지 않음). 현재는 정확 일치 판별이 안전망 역할 | `chat-channel/types.ts` `isCredentialRejectedError` JSDoc | 별도 코드 변경 불필요 — spec 다의성 표에 Node 시스템 에러 `.code` 행 추가하는 문서 후속만으로 충분 |
| 4 | 요구사항 | Slack 자격 증명 거부 5값 열거가 `spec/4-nodes/7-trigger/providers/slack.md §3.1` 의 개방형 서술을 코드가 처음 확정 — 근거(Slack 공식 문서)는 코드 주석에 명시돼 있으나 spec 반영은 아직 없음(기존 consistency-check INFO 와 중복 확인) | `slack.adapter.ts:54-60` `SLACK_CREDENTIAL_REJECTED_ERRORS` | 후속 spec PR (planner 턴)으로 5값 반영 |
| 5 | 스코프 | `backend-labels.ts` 문구 변경이 plan "작업 5건" 표에 명시적으로 열거되지 않았으나, transport 기준 폐기와 직접 연동된 필연적 후속 수정이라 범위 이탈 아님 | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 재발 시 plan 표 갱신 습관화 (실질 조치 불요) |
| 6 | 테스트 | `caught as BadRequestException` 캐스팅이 실제로는 `BadGatewayException` 인스턴스를 가리켜 문구가 모순됨(현재는 공통 메서드 공유로 동작에 문제 없음) | `triggers.service.spec.ts:2039-2040` | `as BadGatewayException` 또는 `HttpException` 으로 정정 |
| 7 | 테스트 | 502 케이스의 fixture provider 는 `telegram` 인데 주입 에러 메시지는 `'Slack ...'` 문구 — adapter 를 mock 하므로 정확성엔 영향 없으나 오독 여지 | `triggers.service.spec.ts:2005-2019` | 메시지를 `'Telegram ...'` 로 정정하거나 provider 무관성 주석 추가 |
| 8 | 테스트 | `error_code 400 / 부재` 두 fixture 를 한 `it` 안에서 `for` 순회 — 실패 시 어느 케이스인지 테스트명만으로 구분 불가 | `telegram.adapter.spec.ts:182-191` | `it.each` 로 분리 승격 |
| 9 | API 계약 | 신규(첫 노출) 에러 코드 2종(`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`)이 중앙 에러 카탈로그(`3-error-handling.md §1`)에 미등재 — 이미 같은 세션의 consistency-check(`convention_compliance.md`)가 WARNING 으로 등재했고 `spec_impact: none` 선언으로 이번 developer 턴 범위 밖으로 확정됨. 재조치 불요, 참고만 | `spec/5-system/3-error-handling.md §1` | 없음 (이미 추적 중) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 401/403 fallback 잔존은 한시적 설계 의도(INFO). CWE-209 정보노출 축소 확인 |
| architecture | LOW | `code` 프로퍼티 4중 의미 오버로드(INFO), 파일 책임 서술 불일치(INFO). 순환 의존 없음 |
| requirement | LOW | §1.1.2/§5.4 계약 line-level 충족, 뮤테이션 검증(RED 3건) 통과. spec frontmatter 낙후(WARNING #7 연동) |
| scope | NONE | 25개 변경 파일 전부 plan 사전 선언과 1:1 대응, 스코프 이탈 없음 |
| side_effect | LOW | Logger.prototype.warn spy 미해제 위험(WARNING #1) |
| maintainability | LOW | provider 간 판별 로직 스타일 불일치(WARNING #3) |
| testing | LOW | Logger spy 누출(WARNING #1 중복) + 502 필터 통과 회귀 테스트 부재(WARNING #2) |
| documentation | LOW | spec frontmatter 낙후(WARNING #7) + CHANGELOG 미기록(WARNING #4) |
| api_contract | LOW | 400→502 breaking change 공지 필요(WARNING #5) + 에러 카탈로그 미등재(이미 추적 중, INFO) |
| user_guide_sync | MEDIUM | Slack/Discord 유저가이드 미갱신, Telegram 과 비대칭(WARNING #6) |

## 발견 없는 에이전트

없음 — 전 reviewer 가 최소 INFO 이상 1건 이상 보고.

## 권장 조치사항

1. `triggers.service.spec.ts` 의 `Logger.prototype.warn` spy 복원을 `afterEach`/`try-finally` 로 바꿔 실패 시 전역 상태 누출을 막는다 (WARNING #1).
2. `http-exception.filter.spec.ts` 에 `BadGatewayException`(502) 이 필터를 그대로 통과하는지 잠그는 회귀 테스트 1건을 추가한다 (WARNING #2).
3. Slack/Discord 유저가이드 페이지(ko/en 4파일)에 이번 PR 이 실현한 400/502 에러 분류를 Telegram 형제 절과 동일한 형식으로 추가한다 (WARNING #6).
4. `CHANGELOG.md` Unreleased 섹션에 이번 계약 변경(502 최초 도입, `details.reason` 제거, 메시지 문구 변경)을 기록한다 (WARNING #4).
5. PR 설명/릴리스 노트에 400→502 breaking change 를 명시적으로 공지한다 (WARNING #5).
6. (선택) Discord 의 401/403 판별을 이름 있는 상수로 추출해 Slack/Telegram 과 스타일을 통일한다 (WARNING #3).
7. 후속 planner 턴에서 `spec/conventions/chat-channel-adapter.md` frontmatter 의 "미구현" 서술을 이번 PR 완료 상태로 정정하고 관련 트래커 항목에 cross-link 한다 (WARNING #7, developer 권한 밖).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 는 성능 특성 변경 없음(순수 에러 분류/응답 계약 변경) |
  | dependency | 신규 의존성 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음(기존 6단계 오케스트레이션의 catch 블록 로깅 추가만) |