# 보안(Security) 코드 리뷰

## 대상
- `codebase/channel-web-chat/src/lib/widget-state.test.ts` (테스트 추가, `mergeMessages` snapshot/local 병합 분기 전수)
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (테스트 추가, 새로고침 복원 통합 e2e-lite)
- `plan/in-progress/webchat-multiturn-restore-test.md` (신규 plan 문서)

세 파일 모두 **테스트/plan 문서 추가**이며 제품(런타임) 코드 변경은 없다(plan 문서에도 "제품 코드 무변경" 명시, `git diff` 상으로도 `widget-state.ts`/`use-widget.ts`/`conversation.ts` 등 소스 파일 자체는 diff 에 없음). 따라서 신규 공격 표면은 발생하지 않는다.

### 발견사항

- **[INFO]** mock 인증 토큰 문자열이 테스트 코드에 다수 등장
  - 위치: `use-widget-eager-start.test.ts` 전역 — `token: "iext_prev"`, `"iext_x"`, `"iext_x2"`, `"iext_y"` 등
  - 상세: `iext_` 접두 문자열은 실제 시크릿이 아니라 테스트 fixture 용 mock 값(fetch mock 이 반환하는 가짜 JSON)이며, 기존 테스트 파일 전반에 이미 쓰이던 동일 패턴을 재사용한 것이다. 엔트로피·형식상 실제 발급 토큰과 무관하고 리포지토리 전역에서 하드코딩된 "진짜" 시크릿(API 키, DB 비밀번호 등)으로 보이지 않는다.
  - 제안: 조치 불필요. 다만 향후 실제 토큰 포맷과 혼동 가능성을 낮추기 위해 `iext_x`/`iext_test_...` 같은 명백한 fixture 네이밍 컨벤션을 유지하는 것을 권장(이미 준수 중).

- **[INFO]** `[user-input]...[/user-input]` 마커 strip 검증 — 긍정적 보안 회귀 테스트
  - 위치: `use-widget-eager-start.test.ts` "복원 통합: getStatus 다중 turn conversationThread…" 테스트, `expect(msgs[0].text).not.toContain("user-input")`
  - 상세: 서버(EIA)가 반환하는 conversationThread 텍스트에 내부 처리용 마커가 그대로 남아 사용자에게 렌더링되지 않는지(정보 노출/UI 오염 방지) 확인하는 테스트로, 새 취약점이 아니라 기존 sanitize 로직(`conversation.ts`)에 대한 유효한 회귀 가드다. 다만 이 테스트는 `mergeMessages`/`threadToMessages` 가 실제로 HTML/스크립트를 이스케이프하는지까지는 검증하지 않는다(마커 문자열 제거만 확인). 위젯이 메시지 텍스트를 렌더링하는 컴포넌트(리뷰 대상 밖)가 innerHTML 이 아닌 텍스트 노드로 렌더링하는 한 XSS 우려는 없다.
  - 제안: 조치 불필요(리뷰 대상 파일 밖의 렌더링 컴포넌트가 실제 XSS 방어 지점이므로 별도 확인은 이번 diff 스코프 밖).

- **[INFO]** 에러 메시지 일반화(정보 노출 방지) 테스트 — 기존 항목 재확인
  - 위치: `use-widget-eager-start.test.ts` "W1: webhook 실패 → state.error 는 일반화 문구(서버/예외 원문 미노출)" (diff 자체엔 미포함, 컨텍스트 내 기존 테스트)
  - 상세: `expect(err).not.toMatch(/500|EiaError|fetch|undefined/i)` 로 내부 예외/HTTP status 원문이 UI 에러 메시지에 노출되지 않음을 검증 — CWE-209(에러 메시지를 통한 정보 노출) 방지 테스트가 이미 존재하며 이번 diff 로 훼손되지 않았다.
  - 제안: 조치 불필요.

- **[INFO]** sessionStorage 에 execution 토큰 저장을 전제로 한 테스트
  - 위치: `use-widget-eager-start.test.ts`, `window.sessionStorage.setItem("clemvion-web-chat:session:t1", JSON.stringify({ executionId, token, expiresAt, endpoints }))`
  - 상세: 위젯이 세션 토큰을 `sessionStorage`(탭 종료 시 소멸, `localStorage` 대비 XSS 지속성 낮음)에 저장하는 기존 설계를 테스트가 전제로 삼고 있다. 이는 신규 도입이 아니라 PR #874 에서 이미 확립된 패턴이며, 이번 diff 는 이 저장소를 소비하는 테스트만 추가했다. 별도 조치 불필요.

### 요약
이번 변경은 `codebase/channel-web-chat` 위젯의 새로고침 히스토리 복원 로직(`mergeMessages`, `seedWaitingFromStatus`)에 대한 **테스트 전용 추가**로, 제품 런타임 코드는 일절 수정되지 않았다. 테스트에 등장하는 토큰 문자열은 모두 mock fixture 이며 실제 시크릿 유출로 볼 근거가 없다. 오히려 추가된 테스트들은 기존의 마커 strip(정보 노출 방지)·에러 메시지 일반화(민감정보 비노출) 등 보안 관련 방어 로직을 회귀 검증하는 긍정적인 성격을 가진다. SQL/커맨드/경로 인젝션, 인증/인가 우회, 안전하지 않은 암호화, 취약 의존성 등에 해당하는 신규 이슈는 발견되지 않았다.

### 위험도
NONE
