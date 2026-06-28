# 보안(Security) 리뷰

## 발견사항

### [INFO] `safeApiBaseFromQuery` — http(s) 스킴 검증이 javascript:/data: 인젝션 경로를 올바르게 차단
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` L216–226
- 상세: `configFromQuery()` 가 쿼리 파라미터 `?apiBase=` 를 직접 `fetch` base 로 사용하던 구조에서, `safeApiBaseFromQuery` 를 통해 `http:` / `https:` 스킴만 허용하도록 하드닝되었다. `new URL(raw)` 로 파싱 후 `url.protocol` 을 검사하므로 `javascript:alert(1)`, `data:text/html,...` 등 비-http(s) 스킴과 상대경로가 모두 `undefined` 로 거름 처리된다. 이는 외부 URL 을 fetch base 로 사용할 때의 SSRF/open-redirect 경로를 효과적으로 차단한다.
- 제안: 현 구현이 적절하다. 추가 강화를 원한다면 `url.host` 의 내부 IP(127.0.0.1, 10.x, 192.168.x 등) 차단을 고려할 수 있으나, 이 위젯의 사용 시나리오(localhost 개발 허용이 명시된 주석)를 감안할 때 현재 스킴 레벨 검증이 적정 수준이다.

---

### [INFO] `EmbedConfigDto.enforce` — fail-open 설계가 spec 의도이나 보안 관점 명시 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` L69–75
- 상세: `enforce=false`(allowlist 비어있음) 시 위젯이 모든 origin 에서 렌더를 허용하는 fail-open 구조다. 이는 `spec/7-channel-web-chat/4-security.md §3-①` 의 의도(사용자가 allowlist 를 설정하지 않으면 제한 없음)이나, 이 설계에서 allowlist 를 설정하지 않은 워크스페이스는 임의 사이트에 위젯이 임베드되어 세션 토큰이 타 origin 에 노출될 위험이 있다. DTO 자체는 읽기 전용 전달 객체이므로 취약점이 아니며, 서비스 레이어(`EmbedConfigService`)의 `allowlist.length > 0` 계산이 SoT다.
- 제안: 코드 변경 없음. spec(4-security §3-①) 또는 관리자 UI 에 "allowlist 미설정 시 전체 허용임을 명시"하는 UX 가이드 추가를 향후 검토 항목으로 기록하는 것을 권장하나, 이는 본 PR 범위 외다.

---

### [INFO] `safeApiBaseFromQuery` — `console.warn` 을 통한 민감 입력 로깅
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` L224
- 상세: 거부된 `raw` 값을 `console.warn("[widget] configFromQuery: apiBase 가 http(s) URL 이 아니어서 무시합니다:", raw)` 로 출력한다. 이 값은 URL 쿼리 파라미터이므로 그 자체가 민감 정보는 아니다. 그러나 `javascript:` 페이로드가 포함된 URL 을 브라우저 콘솔에 출력하는 것은 XSS 시도 내용을 로그로 남기는 수준이며, 실제 실행 위험은 없다. 위젯은 클라이언트 측 SPA 이므로 서버 로그로 유출되지 않는다.
- 제안: 현 수준 유지. 필요하다면 `raw` 를 축약(예: 처음 50자 + 스킴만)해 로그 크기를 줄일 수 있으나 필수 아님.

---

### [INFO] 하드코딩된 시크릿 없음 확인
- 위치: 전체 변경 파일 (`embed-config.dto.ts`, `use-widget.ts`, `use-widget.test.ts`)
- 상세: API 키, 토큰, 비밀번호, 인증서 등 하드코딩된 시크릿이 발견되지 않는다. 테스트 파일의 예시 URL(`https://api.example.com/api`, `http://localhost:3000/api`)은 무해한 더미 값이다.
- 제안: 없음.

---

### [INFO] 인증/인가 — DTO 변경이 인증 경계에 영향 없음
- 위치: `embed-config.dto.ts`
- 상세: `EmbedConfigDto` 는 GET 엔드포인트의 응답 객체로, 위젯 부팅 시 캐시 가능한 공개 설정값을 전달한다. JSDoc 주석 추가 변경은 인증·인가 로직과 무관하다. allowlist 검증 및 enforce 플래그 계산은 서비스 레이어에서 이루어지며 이번 변경 대상이 아니다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심 보안 관련 코드는 `safeApiBaseFromQuery` 함수 신설로, 쿼리 파라미터를 통한 비-http(s) 스킴 인젝션(javascript:, data: 등) 경로를 `new URL()` 파싱 + protocol 검사로 올바르게 차단한다. 구현이 의도된 방어 목적에 부합하고, 테스트가 주요 공격 벡터(javascript: 스킴, 상대경로, null/빈 문자열)를 커버한다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘 등 OWASP Top 10 해당 취약점은 발견되지 않는다. `EmbedConfigDto` 의 JSDoc 추가는 보안 영향 없는 문서화 변경이다. fail-open allowlist 설계는 spec 의도이나 관리자 UX 가이드 보강을 장기 과제로 고려할 만하다.

## 위험도

NONE
