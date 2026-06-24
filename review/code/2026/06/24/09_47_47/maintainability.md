# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `codebase/frontend/next.config.ts`

- **[INFO]** `rewrites()` 에서 슬래시 유무 두 규칙이 중복 패턴을 가짐
  - 위치: `rewrites()` 반환 배열 (라인 43–68)
  - 상세: `/_widget/:segment*/app` 와 `/_widget/:segment*/app/` 는 거의 동일한 목적(trailing slash 정규화)이며, 이 처리는 Next.js `trailingSlash` 설정이나 단일 정규식 패턴으로 통합 가능하다. 현재 형태는 향후 경로 변경 시 두 곳을 동시에 수정해야 하는 미미한 중복이다.
  - 제안: `next.config.ts` 에 `trailingSlash: true` 를 추가하거나, 두 규칙이 왜 분리돼야 하는지 주석으로 명기해 의도를 명확히 한다. 현재 주석은 "디렉토리 index 폴백" 목적은 설명하지만 왜 두 패턴이 각각 필요한지는 언급하지 않는다.

- **[INFO]** `headers()` 의 Cache-Control 소스 패턴과 `rewrites()` 의 `_widget` 제외가 조화롭지 않음
  - 위치: `headers()` 라인 25–36
  - 상세: `headers()` 는 `_next/static`, `_next/image`, `favicon.ico` 만 예외로 두어 `/_widget/**` 정적 자산에도 `no-store` 캐시가 적용된다. 위젯 번들은 버전 고정 불변 자산(`/web-chat/v1/`)이므로 공격적 캐시가 적합하나, 현재는 동일 `no-store` 가 덮인다. 기능적 버그는 아니지만 유지보수성 관점에서 헤더 예외 목록이 `rewrites` 의 `_widget` 의식과 불일치한다.
  - 제안: `headers()` 소스 패턴에서도 `_widget` 를 제외하거나, 별도 `/_widget/**` 헤더 규칙으로 장기 캐시 정책을 명시적으로 추가한다(별도 PR 이라도 backlog 주석으로 남김).

### 파일 2: `codebase/frontend/src/__tests__/proxy.test.ts`

- **[INFO]** 테스트 헬퍼 `req()` 와 `redirectLocation()` 이 파일 상단에 JSDoc 없이 배치돼 있으나, 파일 레벨 JSDoc 이 이를 어느 정도 커버함
  - 위치: 라인 194–203
  - 상세: `req()` 함수의 `opts.session` 필드가 `has_session=1` 쿠키를 설정하는데, 이 쿠키 이름(`has_session`)은 `proxy.ts` 의 `request.cookies.get("has_session")` 와 암묵적으로 결합돼 있다. 쿠키 이름이 변경되면 테스트가 조용히 깨지거나 통과할 수 있다.
  - 제안: `has_session` 을 `proxy.ts` 에서 상수로 export(`export const SESSION_COOKIE_NAME = "has_session"`)하고 테스트에서 import 해 동기화 취약점을 제거한다.

- **[WARNING]** `loader.js·정적 에셋도 통과` 테스트에서 단일 `it` 블록 내 복수 단언
  - 위치: 라인 215–220
  - 상세: `loader.js` 와 `_next/static/x.js` 두 케이스가 하나의 `it` 블록에 묶여 있다. `loader.js` 가 실패해도 두 번째 단언은 실행되지 않아 실패 원인이 불명확하다. 테스트 이름도 두 경로를 아울러 모호하다.
  - 제안: 각 경로를 별도 `it` 로 분리하거나 `it.each` 를 사용해 실패 메시지 가독성을 높인다.

- **[INFO]** `session: true` 를 전달해도 실제로는 세션 유효성 검증이 없음 — 테스트 커버리지 의도가 불명확
  - 위치: 라인 291
  - 상세: `has_session=1` 쿠키는 단순 hint 이며 proxy 는 존재 여부만 확인한다. 테스트는 이 동작을 올바르게 검증하고 있으나, 주석이나 설명 없이 `session: true` 를 사용하면 "세션 진짜 인증" 처럼 오해할 수 있다.
  - 제안: `req()` 의 JSDoc 에 "has_session 쿠키는 hint-only(JWT 검증 없음)" 를 한 줄 추가한다.

### 파일 3: `codebase/frontend/src/proxy.ts`

- **[WARNING]** matcher 정규식과 함수 내 `startsWith("/_widget")` 체크가 이중 방어 — 불일치 시 silent 버그 가능
  - 위치: 라인 26–30 (함수), 라인 46 (matcher)
  - 상세: `config.matcher` 에서 `_widget` 를 이미 제외하므로 미들웨어 자체가 `/_widget` 경로에 도달하지 않는다. 따라서 `pathname.startsWith("/_widget")` 체크는 현재 도달 불가(dead branch)다. 이중 방어가 의도적이라면 주석이 필요하고, 그렇지 않다면 하나를 제거해야 한다. 이 상태에서 matcher 를 수정하면 함수 내 체크가 남아 기대와 다른 방식으로 작동하거나, 반대로 함수 내 체크를 지우면 matcher 누락 시 보호가 없어진다.
  - 제안: 이중 방어 의도를 주석으로 명기하거나(`// matcher 와 함수 양쪽에 넣어 어느 한쪽 실수를 방어`), 한 곳(matcher 우선)으로 단일화하고 나머지를 제거한다.

- **[INFO]** `publicPaths` 배열이 파일 상단 상수로 잘 분리돼 있으나 export 되지 않아 테스트에서 직접 검증 불가
  - 위치: 라인 4–11
  - 제안: `export` 추가해 테스트에서 `publicPaths` 에 포함되지 않은 경로의 동작을 직접 검증할 수 있게 한다(현재 테스트는 `/login` 만 검증).

- **[INFO]** 함수 명 `proxy` 가 실제 동작(인증 미들웨어/게이트키퍼)과 다소 거리가 있음
  - 위치: 라인 13
  - 상세: `proxy` 는 요청을 다른 서버로 프록시하는 것을 연상시키나, 이 함수는 인증 게이트 역할을 한다. 파일명(`proxy.ts`)과 함수명이 일치하지만, 실제 책임과 이름의 의미론적 거리가 있다. Next.js 미들웨어 관례상 `middleware.ts` + `export default` 가 표준이나, 이 파일은 테스트를 위해 분리된 구조로 보여 tradeoff 가 이미 결정된 것으로 보임.
  - 제안: 이름 변경 없이 JSDoc 에 "authentication gate (not a network proxy)" 한 줄 추가로 의도를 명확히 한다.

### 파일 4: `spec/7-channel-web-chat/0-architecture.md`

- **[INFO]** §4.1 추가 블록이 산문 밀도가 높고 줄바꿈이 적어 가독성이 낮음
  - 위치: 추가된 §4.1 불릿 (라인 444–449)
  - 상세: "(1) ... (2) ..." 인라인 번호 열거가 줄바꿈 없이 긴 단일 단락으로 이어진다. 두 조건(인증 예외, rewrite)은 독립적이며 각각 코드 위치가 다르므로, 중첩 불릿으로 분리하면 각 요건의 구현 위치를 스캔하기 쉬워진다.
  - 제안: (1)/(2) 를 별도 중첩 불릿으로 분리한다(기능 변경 없음, 가독성 개선).

---

## 요약

변경 범위는 좁고(미들웨어 인증 예외 추가, rewrite 규칙 2개, 테스트 파일 신규)전체적인 유지보수성 수준은 양호하다. 가장 눈에 띄는 문제는 `proxy.ts` 의 matcher 정규식과 함수 내 `startsWith("/_widget")` 이중 방어로, 두 곳 중 어느 한쪽이 변경될 경우 silent 불일치가 생길 수 있다(WARNING). 테스트에서 세션 쿠키 이름이 하드코딩 상수 없이 암묵적으로 결합된 점도 향후 쿠키 명 변경 시 깨질 수 있다. `next.config.ts` 의 trailing slash 두 rewrite 규칙 중복과 헤더 예외 목록의 `_widget` 누락은 INFO 수준이며 즉각 수정보다는 backlog 처리가 적합하다.

## 위험도

LOW
