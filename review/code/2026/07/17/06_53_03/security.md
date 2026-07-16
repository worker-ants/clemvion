# 보안(Security) Review

## 대상 파일 요약

실제 실행 코드 변경은 2개뿐이다.

- `codebase/channel-web-chat/src/widget/use-widget.ts` (프로덕션) — `seedWaitingFromStatus` 반환 타입을
  `Promise<boolean>` → `Promise<SeedOutcome>`(`"ended"`/`"stale"`/`"continue"`) 3-state 로 승격, `sendCommand`
  의 410 catch·`endConversation` 을 `finalizeEnded` 경유로 통합해 `endedRef` 1회 가드를 공유하도록 리팩토링.
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (테스트) — fake timer 도입 + stale/dedup
  회귀 테스트 3건 추가.

나머지 파일(`review/code/2026/07/17/02_31_18/**` — `RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`,
`concurrency.md`, `documentation.md`, `maintainability.md`, `meta.json`, `requirement.md`, `scope.md`,
`security.md`, `side_effect.md`, `testing.md`)는 직전 라운드(02_31_18) 리뷰 산출물이 신규 커밋되는 정적
문서/메타데이터일 뿐 실행 코드가 아니다. grep 으로 API 키/토큰/비밀번호 패턴을 전수 스캔했고 하드코딩된
시크릿은 없다(테스트 픽스처 `iext_prev`/`iext_x` 등은 실제 자격증명이 아닌 목업 문자열).

## 점검 관점별 분석

1. **인젝션**: 해당 없음. 클라이언트측 React hook 으로 SQL/셸/LDAP 호출이 없고, DOM 삽입(innerHTML 등)도
   발생하지 않는다. `finalizeEnded(reason)`/`bridgeRef.current?.sendEvent("conversationEnded", { reason })` 에
   전달되는 `reason` 값은 모두 코드 리터럴(`"gone"`, `"user_ended"`, TERMINAL_EVENTS 멤버인
   `execution.completed` 등)이며 사용자 입력이 아니라 injection/postMessage payload 오염 경로가 없다.
2. **하드코딩된 시크릿**: 없음. diff·신규 review 문서 전체 grep 결과 API 키/비밀번호/토큰 리터럴 없음.
3. **인증/인가**: 이번 diff 는 오히려 인증 관련 하드닝이다. `seedWaitingFromStatus` 가 3-state 로 바뀌면서
   `applyConfig`(세션 복원) 경로도 `start()` 와 동일하게 `"continue"` 가 아니면 중단하도록 게이팅해, 이미
   무효화된(만료/종료된) 세션 토큰으로 SSE 를 재오픈하거나 `scheduleRefresh` 를 예약하는 경로를 차단한다.
   `sendCommand` 의 410(Gone) 응답 처리와 `endConversation` 을 `finalizeEnded` 로 통합해 종료 시퀀스·
   `endedRef` 1회 가드 불변식을 일치시킨 것도 세션 상태 관리 견고성을 높이는 변경으로, 인가 우회를 만드는
   변경이 아니다. 임베드 origin 검증(`isEmbedAllowed`/`safeApiBaseFromQuery`)은 이번 diff 로 변경되지 않았다.
4. **입력 검증**: 변경 범위에 신규 사용자 입력 처리 경로가 없다. `safeApiBaseFromQuery` 등 기존 검증 로직은
   diff 밖(불변).
5. **OWASP Top 10**: 해당 사항 없음. 세션 참조 정합성(stale 응답 폐기, 중복 종료 통지 방지)을 강화하는
   방어적 로직이며 신규 공격면을 만들지 않는다.
6. **암호화**: 해당 없음. 토큰 저장/전송 방식(`sessionStorage`, HTTPS fetch/EventSource) 자체는 이번 diff 로
   변경되지 않았다.
7. **에러 처리**: `errMessage()`(파일 하단, 변경 없음)가 실제 서버/예외 원문을 UI 에 노출하지 않고
   `console.warn` 진단 로그로만 남기는 기존 패턴을 그대로 유지한다. 이번 diff 로 추가된 `console.warn` 호출
   (`newChat` cancel 실패, `endConversation` 명령 실패)도 동일하게 `e instanceof Error ? e.message : String(e)`
   패턴을 재사용해 별도 신규 노출 경로가 아니다. 다만 서버 응답이 토큰/세션 식별자를 포함한 에러 메시지를
   반환할 경우 `console.warn` 을 통해 **브라우저 devtools 콘솔**에는 남는다 — 기존에도 동일했던 패턴이라
   회귀는 아니지만(INFO), 운영 환경에서 console 로그 수집기(예: 원격 로깅 SDK)를 붙일 계획이 있다면 마스킹
   여부를 재확인할 가치는 있다.
8. **의존성 보안**: 신규/변경 의존성 없음(`vi.useFakeTimers` 등은 기존 vitest API 사용).

## 발견사항

- **[INFO]** 진단 로그(`console.warn`)에 서버 에러 원문이 그대로 흘러가는 기존 패턴이 이번 diff 로 3곳
  확장(`sendCommand`/`newChat`/`endConversation` 관련 catch 는 기존에도 있었고 이번엔 `finalizeEnded` 로
  일원화됐을 뿐 신규 노출은 아님)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:536-541`(`newChat` cancel 실패),
    `:583-586`(`endConversation` 명령 실패), `:720-723`(`errMessage`, 변경 없음)
  - 상세: UI 렌더(`GENERIC_ERROR_MESSAGE`)에는 노출되지 않아 최종 사용자 대면 노출은 없다. 다만 임베드
    위젯이 타 사이트(host)에 삽입되므로, host 페이지가 iframe 콘솔을 수집하는 원격 로깅 도구를 붙인
    구성이라면 서버 예외 메시지 일부가 그쪽으로 전달될 가능성은 이론상 존재한다.
  - 제안: 현 상태로도 CRITICAL/WARNING 수준은 아니다. 다음에 서버측 에러 메시지 포맷을 다룰 때
    `shared/utils/sanitize-error-message.ts` 의 SECRET_LEAK_PATTERNS 재사용 여부를 함께 검토하면 좋다(신규
    구현은 불필요 — 프로젝트 SoT 정책).
- **[INFO]** 방어적 강화 확인 — `seedWaitingFromStatus` 3-state 승격은 보안적으로 순수 긍정적 변경
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:82-88`(`SeedOutcome` 타입), `:643-647`
    (`applyConfig` 게이팅)
  - 상세: 이전에는 `applyConfig`(세션 복원 경로)가 `false`(정상 진행)와 `false`(stale 폐기)를 구분하지 못해
    stale 세션 토큰으로 `openStream`을 실행할 여지가 있었다(concurrency reviewer 가 별도 WARNING 으로 지적한
    race). 이번 diff 로 `"continue"` 가 아니면 무조건 중단하는 명시적 계약이 세 호출부(`start`,
    `applyConfig`, `replay_unavailable` 폴백)에 통일 적용돼, 무효 토큰 재사용/종료 세션 storage 부활 가능성이
    구조적으로 줄었다. (남은 `applyConfig` staleness race 자체는 concurrency 관점 이슈이며 보안 취약점은
    아니다 — 토큰 탈취/노출이 아니라 SSE 스트림이 옛 토큰으로 재오픈될 수 있는 신뢰성 이슈.)

CRITICAL/WARNING 은 없음.

## 요약

이번 라운드에서 실제로 검토 가능한 프로덕션 코드 변경은 `use-widget.ts` 한 파일이며, 성격은 세션
라이프사이클(종료 확정·stale 응답 폐기·중복 종료 통지 방지)의 견고성을 높이는 순수 방어적 리팩토링이다.
사용자 입력을 새로 파싱/렌더링하는 경로, 신규 네트워크 엔드포인트, 인증 우회 가능성, 하드코딩된 시크릿,
안전하지 않은 암호화/해시, SQL·XSS·커맨드 인젝션 벡터 모두 발견되지 않았다. 나머지 diff 는 이전 라운드
리뷰 산출물(md/json 문서)이 신규 커밋되는 것으로 실행 코드가 아니며, 시크릿 노출도 없다. 진단 로그에
서버 원문이 console 로만 흐르는 기존 패턴이 3곳 확장됐지만 UI 노출은 없고 회귀도 아니라 INFO 수준으로만
기록한다.

## 위험도
NONE
