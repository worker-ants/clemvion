# 보안(Security) 리뷰

## 발견사항

### [INFO] SSE 토큰 전달 — URL 쿼리 파라미터 노출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` — `openStream` (라인 129-131)
- 상세: `EventSource`는 HTTP 헤더를 지원하지 않는 브라우저 표준 제약으로 인해 `?token=<per_execution_token>` 형태의 쿼리 파라미터로 Bearer 토큰을 전달한다. 쿼리 파라미터는 서버 액세스 로그·브라우저 히스토리·Referer 헤더에 평문으로 기록될 수 있다. 이번 변경이 이 패턴을 수정하지 않았고, 기존 아키텍처 결정(EIA §8.3)에 의해 인정된 트레이드오프다. 토큰 자체는 per_execution scope의 단기 토큰(TTL 90분)으로 범위가 제한되어 있다.
- 제안: 이번 변경 범위 밖이나, 장기적으로 [EventSource over Fetch API(WHATWG 초안)](https://github.com/whatwg/html/issues/2177) 또는 WebSocket 전환 시 헤더 전달이 가능해진다. 현재로서는 토큰 TTL·rotate 정책이 핵심 완화 수단이며 이미 구현되어 있다.

### [INFO] `pendingSendRef` 큐 — 최신 1건만 보관, 이전 텍스트 조용히 폐기
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `submitMessage` (라인 253-257), `pendingSendRef` (라인 104)
- 상세: booting/streaming 중 사용자가 여러 번 텍스트를 입력하면 `pendingSendRef.current = text`로 덮어쓰여 이전 텍스트가 에러 없이 조용히 폐기된다. 이는 의도된 UX 결정(최신 1건 보관)이나, 보안 관점에서 데이터 손실이 오류 없이 발생한다는 점에서 사용자가 인지하지 못할 수 있다. 악용 가능성은 낮으나 의도치 않은 메시지 삭제가 법적 증거·감사 요구 환경에서 문제가 될 수 있다.
- 제안: 기능 목적상 현재 설계는 허용 범위이나, UX 피드백("이전 메시지가 대기 중입니다") 또는 큐 깊이를 명시적으로 문서화하는 것을 권장.

### [INFO] `configFromQuery()` — URL 쿼리에서 `apiBase` 직접 수용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `configFromQuery` (라인 81-88)
- 상세: 위젯이 iframe으로 직접 로드될 때 `?apiBase=<URL>` 쿼리 파라미터를 통해 API 엔드포인트를 동적으로 설정할 수 있다. 공격자가 `apiBase`를 임의 서버로 변경한 URL을 사용자에게 전달하면, 위젯이 해당 서버로 사용자 `profile` 데이터를 전송하거나 SSE를 연결하는 SSRF-유사 데이터 유출 경로가 생긴다. 이 경로는 `bridge.onBoot`보다 낮은 우선순위(`configFromQuery()` → `onBoot` 덮어쓰기 순서)로 보이나, 코드 라인 407 `{ ...configFromQuery(), ...c }`는 host가 보내는 `c`(BootMessage)가 queryParam을 덮어쓰므로 정상 iframe 내장 환경에서는 완화된다. 그러나 위젯을 직접 URL로 접근하는 경우(개발·테스트·BYO-UI)에서 이 경로가 활성화된다.
- 제안: `configFromQuery()`의 `apiBase` 수용을 허용 목록(allowlist) 또는 same-origin 제한으로 보강하거나, 프로덕션 배포에서 직접 URL 접근을 차단하는 정책을 문서화할 것.

### [INFO] `isEmbedAllowed` — fail-open 정책의 보안 트레이드오프
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `isEmbedAllowed` (라인 46-56)
- 상세: embed-config 조회 실패(네트워크 오류, 404, 500 등) 시 `return true`(허용)하는 fail-open 정책이다. 이는 4-security §3-① 명시적 설계 결정이며 정당한 임베드 중단 방지 목적이나, 네트워크 분할·서버 다운 상황에서 allowlist 강제가 무력화될 수 있다. 이번 변경에서 이 로직은 수정되지 않았다.
- 제안: 이번 변경 범위 밖. `enforce=true` 설정 시 fail-closed 옵션을 별도 정책으로 제공하는 방안을 장기 backlog에 등록 권장.

### [INFO] `errMessage(e)` — 에러 메시지 전파 경로
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` — `start` catch (라인 216-218), `sendCommand` catch (라인 229-235)
- 상세: `errMessage(e)` 결과가 `dispatch({ type: "ERROR", message: ... })`로 상태에 저장되며, 이 메시지가 UI에 렌더링될 가능성이 있다. `EiaError.detail`(라인 158 — 서버 응답 body 전체)이 `errMessage`에 포함되면 서버 내부 스택트레이스나 민감 정보가 사용자에게 노출될 수 있다. `errMessage` 구현을 확인하지 못했으나, 이 경로는 모니터링이 필요하다. 이번 변경에서 에러 처리 경로 자체는 변경되지 않았다.
- 제안: `errMessage`가 `EiaError.detail`을 포함하는 경우, 사용자 대면 메시지는 일반화("서버 오류가 발생했습니다")하고 상세 내용은 `console.error`로 분리할 것을 검토.

### [INFO] `startConversation` payload에 open index signature 잔존 — 의도치 않은 필드 포함 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/lib/eia-client.ts` — `startConversation` payload 타입 (라인 58)
- 상세: payload 타입이 `{ profile?: Record<string, unknown>; [k: string]: unknown }`으로 정의되어 호출자가 임의 필드를 서버로 전송할 수 있는 escape hatch를 제공한다. 현재 호출부(use-widget.ts 라인 206-208)는 `{ profile: cfg.profile }`만 전달하므로 실제 위험은 낮다. 그러나 미래 호출 코드가 사용자 입력을 포함한 필드를 이 경로로 주입하면 의도치 않은 데이터가 webhook에 포함될 수 있다.
- 제안: index signature를 제거하고 허용 필드를 명시적으로 열거하는 것이 더 안전하다. 필요 시 점진적으로 필드를 추가하는 방식 권장.

---

## 요약

이번 변경(eager start-on-open §R6)은 보안 관점에서 중대한 취약점을 도입하지 않는다. 하드코딩된 시크릿, SQL/XSS/커맨드 인젝션, 인증 우회 등의 OWASP Top 10 핵심 취약점은 발견되지 않았다. 주요 관찰 사항은 모두 INFO 수준으로, 기존 아키텍처 결정에서 비롯된 알려진 트레이드오프(SSE 쿼리 토큰, fail-open embed 검증)와 소범위 개선 권장사항(configFromQuery의 apiBase 수용 범위, index signature 노출)으로 구성된다. `firstMessage` 제거 변경은 오히려 사용자 입력이 webhook payload에 동봉되지 않도록 하여 보안 표면을 축소한 긍정적 변화다. `pendingSendRef` 큐는 최신 1건 폐기 정책이 에러 없이 이루어지나 데이터 손실 관점에서 주의가 필요하다.

## 위험도

NONE

STATUS: SUCCESS
