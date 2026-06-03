# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] `normalizeApiBase` — `/api/api` 이중 suffix 케이스 미처리
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/app/demo/demo-config.ts` L354–358
- 상세: 현재 구현은 후행 `/api` 를 **1회만** 제거한다. 입력이 `http://localhost:3011/api/api` 이면 결과는 `http://localhost:3011/api` 가 되어 여전히 EIA 클라이언트가 `/api/api/hooks/...` 를 조합한다. 실제 사용자 혼동 시나리오로서 현실적이지는 않지만, 주석("중복 `/api/api/hooks` 회피")의 의도와 부분적으로 어긋난다.
- 제안: INFO 수준이므로 필수는 아니나, 필요하다면 `replace(/\/api$/i, "")` 를 루프/반복 적용하거나 문서에 "단 1회만 제거"를 명시하여 의도를 명확화.

### [INFO] 테스트 — `normalizeApiBase` 이중 `/api` 케이스 커버리지 없음
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/app/demo/demo-config.test.ts` L151–163
- 상세: `https://h/api/v1`(비후행 `/api`) 케이스는 커버되지만, `http://localhost:3011/api/api` 케이스는 테스트되지 않는다. 위의 INFO 와 연동된 커버리지 공백.
- 제안: 필요시 케이스 추가.

### [INFO] `normalizeApiBase` — `query string` / `fragment` 포함 입력 미정의
- 위치: `demo-config.ts` L354–358
- 상세: 사용자가 `http://localhost:3011/api?foo=bar` 또는 `http://localhost:3011/api#x` 형태로 입력하면 `/api$` 정규식이 매칭되지 않아 정규화 실패. 데모 하니스라 실제 발생 가능성은 낮지만 함수 문서에 이 케이스가 미정의 상태.
- 제안: 데모 목적이므로 INFO. 주석에 "query string/fragment 포함 URL은 미지원" 명시로 충분.

### [INFO] `use-widget.ts` SSE `onError` — EventSource 재연결 루프 가시성 없음
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget.ts` L949–958
- 상세: `onError` 핸들러가 `console.warn` 을 남기는 것은 적절하나, EventSource 가 자동 재연결하는 특성상 CORS 차단 시 `console.warn` 이 반복 누적된다. 사용자에게 시각적 오류 피드백이 없으므로 "메시지는 전송되나 응답이 오지 않는" 상태가 조용히 지속될 수 있다. README·UI 힌트에서 이미 이를 경고하고 있으므로 기능 결함은 아니나, 위젯 상태기계(`ERROR` dispatch 등)와의 연동은 없음.
- 제안: v1 범위에서는 허용 수준. 향후 SSE 재연결 실패 누적 시 위젯 상태에 반영하는 followup 고려.

### [INFO] spec fidelity — `demo` 하니스 자체는 spec 미정의 영역
- 위치: `spec/7-channel-web-chat/` 전체
- 상세: `spec/7-channel-web-chat/1-widget-app.md`, `2-sdk.md`, `4-security.md` 어디에도 `/demo` 데모 하니스의 구현 행동(폼 필드 정규화, `normalizeApiBase`, UI 힌트 텍스트 등)은 명세되어 있지 않다. 이 변경들은 개발자 보조 도구(dev-only harness)에 국한되므로 spec 부재가 CRITICAL 위반은 아니지만, 데모 하니스 동작 기대치가 spec 에 기록되어 있지 않다.
- 제안: spec 결함 여부는 project-planner 판단 위임. 현재 코드 범위에서는 INFO.

### [INFO] `demo-host.tsx` SSE 힌트 — `interactionAllowedOrigins` 언급
- 위치: `demo-host.tsx` L511–515
- 상세: 힌트 메시지에 `WEB_CHAT_WIDGET_ORIGINS` env와 `interactionAllowedOrigins` 두 가지 경로를 병렬로 안내한다. `spec/7-channel-web-chat/4-security.md §2.1` 에 따르면 `WEB_CHAT_WIDGET_ORIGINS` 은 위젯 CDN 고정 always-allow 목록(backend env)이고, `interactionAllowedOrigins` 는 워크스페이스 단위 추가 origin 병합이다. 데모 origin `http://localhost:3013` 은 CDN 도메인이 아닌 개발 origin 이므로 `WEB_CHAT_WIDGET_ORIGINS` 에 등록하는 것이 spec 의도와 일치한다. 힌트 텍스트 자체는 기술적으로 맞지만 두 경로의 의미 차이 설명이 없어 사용자가 혼동할 수 있음.
- 제안: 데모 하니스 dev 전용이므로 현재 텍스트 수준으로 허용. 개선 원하면 "로컬 개발은 `WEB_CHAT_WIDGET_ORIGINS`가 권장, `interactionAllowedOrigins`는 워크스페이스 allowlist" 구분 명시.

### [INFO] `buildBootConfig` 테스트 — `"http://x/api"` 형태 apiBase 정규화 결과 미검증
- 위치: `demo-config.test.ts` L272–300
- 상세: `omits empty optional fields`·`omits whitespace-only primaryColor` 케이스에서 `apiBase: "http://x/api"` 를 입력하지만 `cfg.apiBase` 값(`http://x`)을 직접 assert 하지 않는다. 정규화 함수의 별도 describe 로 분리되어 있으므로 중복 검증 의도일 수 있으나, `buildBootConfig` 가 실제로 `normalizeApiBase` 를 호출하는지 통합 확인 경로가 부분적으로 부재.
- 제안: `expect(cfg.apiBase).toBe("http://x")` 한 줄 추가로 통합 경로 명시 가능. 현재 상태도 별도 describe 가 있어 기능 결함은 아님.

---

## 요약

이번 변경은 세 가지 핵심을 달성한다: (1) 데모 하니스의 `apiBase` 기본값 및 플레이스홀더를 origin 형태(`/api` 제외)로 교정하여 EIA 클라이언트가 `/api/api/hooks/...` 를 조합하던 버그를 해소, (2) `normalizeApiBase` 함수로 사용자가 기존 습관대로 `…/api` suffix 를 입력해도 자동 정규화되도록 방어적 UX 제공, (3) SSE CORS 차단 원인을 README·UI·`console.warn` 세 곳에서 일관되게 가시화. 비즈니스 로직 구현은 의도와 일치하며, spec `4-security §2` 의 `/api/hooks/*` 무제한 CORS vs `/api/external/*` allowlist 이중 표면 정책을 README에서 정확히 재현하고 있다. 발견된 사항은 모두 INFO 수준(이중 `/api` 극단 케이스, 테스트 커버리지 소폭 공백, dev harness spec 미기록)이며 기능 완전성·데이터 유효성·에러 시나리오 처리에 CRITICAL 또는 WARNING 결함은 없다.

## 위험도

NONE
