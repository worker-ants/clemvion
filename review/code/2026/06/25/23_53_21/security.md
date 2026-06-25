# Security Review

## 발견사항

### INFO: loaderUrl 에 대한 escapeForScript 적용 확인
- 위치: `codebase/frontend/src/lib/web-chat/snippet.ts` buildWebChatSnippet 함수
- 상세: `loaderSrc = escapeForScript(loaderUrl)` 가 적용되어 있으며, 추가된 큐 스텁 문자열은 완전한 정적 리터럴로 사용자 입력을 포함하지 않는다. `escapeForScript` 는 `</script>` 조기 종료와 U+2028/U+2029 라인 구분자를 이스케이프한다. plan 문서에도 "스텁은 정적 문자열(사용자 입력 없음) → escapeForScript 불필요" 로 명시되어 있고 실제 구현도 일치한다.
- 제안: 현재 구현 적절. 추가 조치 불필요.

### INFO: triggerEndpointPath 공개 경로 노출
- 위치: 문서 파일 4종 (web-chat.mdx, web-chat.en.mdx, web-chat-sdk.mdx, web-chat-sdk.en.mdx)
- 상세: 문서와 callout 에서 "triggerEndpointPath 는 인증 토큰이 아니다 — 공개 webhook path 이며 사이트 소스에 노출해도 괜찮다"고 명시한다. spec 에도 동일하게 기술되어 있다. 이는 의도된 아키텍처 결정(공개 트리거)이며, 실제 실행 토큰은 서버 측에서 발급된다는 설명이 포함되어 있다.
- 제안: 아키텍처 결정으로서 적절하게 문서화되어 있다. 서버 측에서 rate limiting 및 abuse detection 이 구현되어 있는지 별도 확인 권장 (이번 변경 범위 외).

### INFO: 큐 스텁의 window 전역 오염 범위
- 위치: 생성 스니펫 내 `window.ClemvionChat=window.ClemvionChat||function(){...}`
- 상세: 스텁은 `||` 조건으로 기존 전역을 보존하므로 이미 존재하는 `window.ClemvionChat` 을 덮어쓰지 않는다. `data-global` 속성으로 전역명 재지정을 지원하며 spec(§1)에 충돌 감지 시 경고+중단 처리가 명시되어 있다.
- 제안: 현재 구현 적절. 충돌 감지·경고 로직이 loader.js 에 이미 있음을 확인할 것 (이번 변경 범위 외).

### INFO: CSP (Content Security Policy) 호환성 고려사항
- 위치: 문서 내 인라인 `<script>` 블록 패턴
- 상세: 제공되는 설치 스니펫은 인라인 `<script>` 태그 형태이다. 고객 사이트가 엄격한 CSP (`script-src 'self'` 또는 nonce 없음)를 설정한 경우 스니펫이 차단될 수 있다. 이는 이번 변경으로 새로 도입된 위험은 아니며 기존 설계에서 이미 존재하던 사항이다.
- 제안: 문서에 CSP 환경에서의 주의사항(nonce 추가, hash 화이트리스트 등)을 INFO 수준으로 추가하는 것을 검토할 수 있으나 필수 사항은 아니다.

## 요약

이번 변경은 command-queue 스텁 누락으로 발생하던 `ReferenceError` 를 수정하는 버그 픽스이다. 보안 관점에서 중요한 점은, 추가된 스텁 문자열이 완전한 정적 리터럴이며 사용자 입력을 포함하지 않아 XSS 위험이 없다는 것이다. 기존 `escapeForScript` 함수가 boot config JSON 의 `</script>` 조기 종료 및 U+2028/U+2029 라인 구분자를 이스케이프하는 XSS 방어는 이번 변경에서도 유지된다. 테스트 파일에서 XSS 케이스를 명시적으로 검증하고 있어 회귀 방어가 갖추어져 있다. 하드코딩된 시크릿, 인증 우회, 경로 탐색, 알려진 취약 라이브러리 사용 등의 보안 이슈는 발견되지 않았다.

## 위험도

NONE
