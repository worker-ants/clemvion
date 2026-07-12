# 보안(Security) Code Review

## 리뷰 대상
- `codebase/channel-web-chat/src/app/demo/demo-config.ts`
- `codebase/packages/web-chat-sdk/examples/snippet.html`
- `spec/7-channel-web-chat/2-sdk.md`

## 변경 개요
세 파일 모두 위젯 `disclaimer` 문구를 "AI는 한정된 데이터로 동작하며 답변이 정확하지 않을 수 있습니다." /
"…중요한 정보는 추가 확인이 필요합니다." 등에서 "AI는 한정된 데이터로 동작하며 답변이 부정확할 수 있어요."
로 통일하는 순수 카피(copy) 변경이다. 코드 로직, 데이터 흐름, API 계약, 입력 처리 경로에는 변화가 없다.

### 발견사항

없음. 세 diff 모두 정적 문자열 리터럴(disclaimer 텍스트)만 교체하며 다음을 확인했다:

- 값이 `DemoFormState.disclaimer` → `buildBootConfig` → `BootMessage.disclaimer` 로 흘러가는 기존 경로에는
  변화가 없고, 해당 값은 위젯 UI에 텍스트로 렌더되는 정적 문자열이지 사용자 입력이 아니다(인젝션 벡터 아님).
- 새로 추가된 URL, 엔드포인트, 자격증명, 토큰, 정규식, 파서 로직이 없다.
- `snippet.html`/`2-sdk.md`의 `apiBase`, `triggerEndpointPath`는 기존 플레이스홀더(`<api-base>`,
  `REPLACE_WITH_PUBLIC_WEBHOOK_PATH`, `a1b2c3-...`)이며 이번 diff에서 손대지 않았다. spec 본문이 이미
  명시하듯 `triggerEndpointPath`는 공개 webhook path로 비밀 값이 아니다.
- 하드코딩된 시크릿, 안전하지 않은 암호화/해시, 인증/인가 로직, 에러 메시지 노출과 관련된 코드 변경 없음.

### 요약
이번 변경은 위젯 disclaimer 문구의 카피만 수정한 텍스트 전용 변경으로, 보안에 영향을 주는 코드 경로(인젝션, 인증/인가, 입력 검증, 암호화, 에러 처리, 의존성)를 전혀 건드리지 않는다. 보안 관점에서 검토할 사항이 없다.

### 위험도
NONE
