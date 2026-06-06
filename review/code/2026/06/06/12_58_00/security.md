# 보안(Security) 리뷰

## 발견사항

### [WARNING] `pendingSendRef` 큐 — 단일 항목 보관으로 이전 입력 조용히 폐기
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `submitMessage` / C1 flush effect (`pendingSendRef.current = text`)
- 상세: `pendingSendRef` 는 최신 1건만 보관하는 설계다. booting/streaming 중 사용자가 연속으로 텍스트를 입력하면 이전 값을 덮어쓴다. 이는 의도된 UX 설계("최신 의도 우선")이지만 문서화가 명시적이지 않아, 향후 이 큐를 배열로 변경하는 수정이 유입될 경우 사용자 입력이 flush 누적되어 예상 밖 메시지를 서버에 전송하는 경로가 생길 수 있다. 직접적 보안 취약점은 아니나, 큐 크기 제한 없는 배열 확장 시 DoS(대량 메시지 제출) 가능성이 생긴다.
- 제안: 현재 "최신 1건" 제약을 코드 주석으로 명시하고, 향후 배열 전환 시 `pendingSendRef` 길이에 상한을 강제하도록 TODO 주석을 남긴다.

### [WARNING] `start()` 내 `errMessage(e)` — 예외 메시지 클라이언트 UI 노출 경로
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `start` catch 블록 (`dispatch({ type: "ERROR", message: errMessage(e) })`)
- 상세: `errMessage(e)` 가 Error 객체의 `.message` 를 그대로 사용한다고 추정할 때, 서버가 반환한 에러 바디(예: `500 Internal Server Error: DB connection failed at host=10.x.x.x`) 가 `message` 필드에 담겨 위젯 UI 에 직접 노출될 수 있다. 이는 OWASP A05(보안 설정 오류)·A09(보안 로깅 및 모니터링 실패) 관점에서 서버 내부 구현 세부사항이나 인프라 정보를 사용자에게 노출하는 정보 유출 위험이다. 이번 PR 에서 추가된 경로는 `start()` 의 신규 catch 블록이며, 기존 `sendCommand` catch 등도 동일 패턴이지만 이번 변경에서 새 노출 경로가 추가되었다.
- 제안: `errMessage` 함수가 서버 응답 body 를 그대로 사용하는지 확인하고, 사용자에게는 일반화된 에러 메시지("연결에 실패했습니다. 다시 시도해 주세요.")만 표시하고 상세 내용은 `console.error` 로만 남기는 것을 권장한다.

### [INFO] `profile` 데이터 — 입력 검증 없이 webhook payload 에 직접 포함
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `start()` 내 `client.startConversation(cfg.triggerEndpointPath, { profile: cfg.profile })`
- 상세: `cfg.profile` 은 `BootMessage` 를 통해 host 페이지로부터 postMessage 로 수신된 값이다. 이번 PR 에서 `firstMessage` 가 제거되고 `profile` 만 전달하는 구조로 단순화됐지만, `profile` 값 자체에 대한 클라이언트 측 sanitize/validation 은 보이지 않는다. `profile` 은 `Record<string, unknown>` 타입으로 임의 중첩 객체가 허용된다. 이 값이 서버 측에서 적절히 검증된다고 가정하면 직접적 취약점은 아니나, 악의적인 호스트 페이지가 `profile` 에 대용량 페이로드나 스크립트 인젝션 시도 가능성 있는 값을 넣어 서버로 전달할 수 있다.
- 제안: 서버 측에서 `profile` 필드를 화이트리스트 키 / 크기 제한으로 검증하고 있는지 확인한다. 클라이언트 측에서도 `profile` 의 최대 크기(예: JSON 직렬화 길이 제한) 또는 허용 필드 집합을 제한하는 것을 고려한다.

### [INFO] `[k: string]: unknown` 인덱스 시그니처 — 임의 필드 서버 전달 escape hatch 유지
- 위치: `codebase/channel-web-chat/src/lib/eia-client.ts` — `startConversation` payload 타입 (`{ profile?: Record<string, unknown>; [k: string]: unknown }`)
- 상세: `firstMessage` 를 제거하면서도 인덱스 시그니처 `[k: string]: unknown` 를 유지해 호출자가 임의 추가 필드를 payload 에 포함할 수 있다. 미래 확장성 목적으로 의도된 설계이지만, 이 escape hatch 를 통해 검증되지 않은 임의 키-값이 서버에 전달되는 경로가 열려 있다. 현재 호출부는 `{ profile: cfg.profile }` 만 사용하고 있어 실제 위험은 없으나, 추후 호출자가 이 경로를 통해 사용자 입력을 동적 키로 전달하면 보안 취약점이 될 수 있다.
- 제안: 인덱스 시그니처 사용이 의도적임을 주석으로 명시하고, 추후 동적 사용자 입력을 이 경로로 전달하지 않도록 가이드라인을 남긴다.

### [INFO] `localStorage` 세션 저장 — 토큰 평문 보관
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 테스트 L487-489 (`window.localStorage.setItem("clemvion-web-chat:session:t1", JSON.stringify({ executionId, token, ... }))`)
- 상세: per_execution 토큰(`iext_*`)이 `localStorage` 에 평문으로 저장된다. `localStorage` 는 동일 origin 의 모든 JS 가 접근 가능하므로 XSS 공격 시 토큰 탈취가 가능하다. 이번 PR 에서 새로 도입된 패턴은 아니나, eager 시작 전환으로 토큰이 더 일찍(open 시) 생성·저장되어 세션 스코프가 넓어졌다. 토큰이 탈취되면 SSE 스트림 도청이나 `interact` API 호출 위장이 가능하다.
- 제안: 단기적으로는 토큰 만료 시간(90분)이 적절히 설정되어 있고 per-execution 스코프이므로 위험이 제한적이다. 중장기적으로 `sessionStorage`(탭 닫으면 소멸) 전환 또는 토큰을 `httpOnly cookie` 로 서버가 관리하는 방식을 검토한다.

### [INFO] 하드코딩된 시크릿 — 없음 확인
- 상세: 변경된 파일 전체에서 API 키, 비밀번호, 토큰, 인증서 등이 코드에 직접 포함된 사례는 발견되지 않았다. 테스트 fixture 의 `"iext_x"`, `"iext_y"`, `"iext_prev"` 등은 가상 토큰 값으로 테스트 목적 only 이며 실제 환경 시크릿이 아니다.

### [INFO] `origin: "http://host.test"` 테스트 픽스처 — postMessage origin 검증 패턴 확인
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — `boot()` 함수 (`origin: "http://host.test"`)
- 상세: 테스트에서 `origin` 을 명시적으로 설정하는 것은 실제 코드에서 `postMessage` origin 검증이 이루어지고 있음을 반증한다. 이 패턴은 bridge.sendEvent 가 targetOrigin 을 pin 하는 구조임을 시사하며, 보안 관점에서 올바른 설계다. 코드 변경에서 origin 검증 로직 자체가 수정되지 않았으므로 이번 변경으로 인한 회귀 위험 없음.
- 제안: 이상 없음.

### [INFO] 인젝션 취약점 — 없음 확인
- 상세: 변경된 코드에서 SQL 인젝션, XSS, 커맨드 인젝션, LDAP 인젝션, 경로 탐색 취약점은 발견되지 않았다. `panel.tsx` 의 `config.disclaimer` 는 `{config.disclaimer}` 로 React 의 자동 이스케이핑을 통해 렌더되며(변경 없음), 새로 추가된 코드에는 `dangerouslySetInnerHTML` 사용이 없다.

### [INFO] 의존성 보안 — 변경 없음
- 상세: 이번 PR 에서 `package.json` 또는 `package-lock.json` 변경은 없다. 신규 외부 의존성이 도입되지 않았으므로 알려진 취약점이 있는 라이브러리 도입 위험 없음.

## 요약

이번 변경(lazy → eager 시작 전환)은 전반적으로 보안 관점에서 낮은 위험 수준이다. 새로 추가된 코드 경로 중 주목할 사항은 두 가지다. 첫째, `start()` 의 신규 catch 블록에서 `errMessage(e)` 가 서버 에러 메시지를 UI 에 직접 노출할 수 있는 정보 유출 경로(WARNING)가 추가되었다. 둘째, `pendingSendRef` 큐가 최신 1건 제한으로 설계되어 있으나 이 제약이 코드에 명시되지 않아 향후 변경 시 DoS 가능성이 있다(WARNING). 하드코딩된 시크릿, SQL/XSS/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘은 이번 변경에서 발견되지 않았다. `profile` 의 클라이언트 측 검증 부재와 `localStorage` 평문 토큰 저장은 기존부터 존재하는 설계 결정으로 이번 PR 신규 취약점은 아니지만 INFO 수준으로 기록한다.

## 위험도

LOW

STATUS: SUCCESS
