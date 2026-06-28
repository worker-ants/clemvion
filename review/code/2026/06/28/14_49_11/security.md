# 보안(Security) 리뷰

리뷰 대상: Channel Web Chat — Polish Batch (webchat-polish-batch-99e2ed)
일시: 2026-06-28

---

## 발견사항

### [INFO] `safeApiBaseFromQuery` — http(s) 스킴 검증은 충분하나, raw 값이 그대로 fetch base로 사용됨
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `safeApiBaseFromQuery` 함수 및 `fetchEmbedConfig`
- 상세: `safeApiBaseFromQuery`는 `new URL(raw)` 파싱 후 `protocol`이 `http:` 또는 `https:`인 경우에만 원본 `raw` 문자열을 그대로 반환한다. 이 값은 `fetchEmbedConfig` 내에서 `apiBase.replace(/\/$/, "")` 후 템플릿 리터럴로 URL을 구성해 `fetch`에 전달된다. `javascript:` / `data:` / 상대경로 등 비-http(s) 스킴은 거르므로 SSRF·주입 위험은 없다. 다만 검증된 스킴을 통과한 후에는 경로 탐색(`../`)이나 쿼리 조작이 URL 구조 안에서 가능하다. `encodeURIComponent(triggerEndpointPath)` 처리가 별도로 이뤄지므로 엔드포인트 경로 인젝션은 방어됨.
- 제안: 현재 구현은 직접 로드 시나리오(개발자가 URL을 직접 제어)를 대상으로 하므로 위험도는 낮다. 추가적으로 `URL` 객체에서 `origin`만 추출해 사용하는 방식(`new URL(raw).origin`)으로 경로/쿼리 조작 여지를 제거할 수 있다(선택적 강화).

---

### [INFO] `isEmbedAllowed` — fail-open 설계는 명시적 설계 결정이나 보안 트레이드오프 존재
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `isEmbedAllowed` 함수 (라인 274~284)
- 상세: `cfg`가 null이거나, `enforce=false`이거나, `allowlist.length === 0`이거나, `detectHostOrigin`이 origin을 탐지하지 못할 경우 모두 `true`(허용)를 반환한다. 이는 "soft 차단"으로 spec(4-security §3-①)에 명시된 설계다. 그러나 네트워크 장애나 임베드 설정 서버 오류 시 allowlist가 있는 워크스페이스에서도 무단 origin이 위젯을 로드할 수 있다. 클라이언트 사이드 제어이므로 하드 보안 경계가 아님을 문서화가 명시하고 있어 의도된 트레이드오프임을 확인.
- 제안: 현재 코드 수준에서 추가 조치 불필요. 서버 사이드 CORS 정책(`WEB_CHAT_WIDGET_ORIGINS`)이 하드 보안 경계 역할을 담당하는 아키텍처라 이 soft 차단의 fail-open은 합리적이다. 다만 이 결정이 spec에 명시된 것처럼 향후 유지보수자에게도 명확히 전달되어야 한다.

---

### [INFO] `console.warn`에 사용자 제공 값 출력
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `safeApiBaseFromQuery` 라인 210
- 상세: `console.warn("[widget] configFromQuery: apiBase 가 http(s) URL 이 아니어서 무시합니다:", raw)` — 사용자가 제공한 쿼리 파라미터 값을 콘솔에 그대로 출력한다. `raw`가 민감한 토큰이나 내부 경로를 포함할 경우 브라우저 콘솔에 노출된다. 단, 이 파라미터는 개발자가 직접 URL에 입력하는 `apiBase`이므로 최종 사용자 민감정보가 여기에 담길 가능성은 낮다.
- 제안: 현재 수준에서 차단 필요 없음. 출력 시 값을 일부 마스킹(`raw.substring(0, 50)`)하거나 개발 환경에서만 출력하는 것은 선택적 강화.

---

### [INFO] `allowlist.includes(host)` — 정확한 origin 일치 검증 방식
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `isEmbedAllowed` 라인 283
- 상세: `cfg.allowlist.includes(host)`는 문자열 완전 일치(exact match)로 origin을 검증한다. `detectHostOrigin`이 반환하는 값과 allowlist 저장 형식이 일치해야 한다. 와일드카드(`*.example.com`) 지원 없음 — 이는 보안 관점에서 오히려 안전하다(서브도메인 남용 차단). allowlist 항목에 trailing slash나 대소문자 불일치가 있으면 정상 origin이 차단될 수 있으나, 이는 UX 이슈이지 보안 취약점은 아니다.
- 제안: allowlist 항목 정규화(소문자 변환, trailing slash 제거)를 저장 시점 또는 비교 시점에 수행하면 운영 오류를 줄일 수 있다.

---

### [INFO] `EmbedConfigDto` — JSDoc 추가 변경에 보안 위험 없음
- 위치: `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`
- 상세: 이번 변경은 `allowlist`와 `enforce` 필드에 JSDoc 주석을 추가하는 것으로, 기능 변경이 없다. API 응답 스키마 자체에는 변경이 없으며 민감 정보 노출·인젝션 위험 없음. `allowlist: string[]`가 공개 GET 엔드포인트로 반환된다는 점은 이미 기존 구현의 특성이며, 이번 변경과 무관하다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심 코드 변경은 `safeApiBaseFromQuery` 함수 추가로, `?apiBase=` 쿼리 파라미터에 `javascript:` / `data:` / 상대경로 등 비-http(s) 값이 주입되는 것을 방어하는 명확한 보안 강화다. `new URL()` 파싱 + 프로토콜 체크 방식은 안전하고, 테스트 커버리지(5케이스: https/http/javascript:/상대경로/null)도 충분하다. `isEmbedAllowed`의 fail-open 설계는 spec에 명시된 의도적 결정으로 서버 사이드 CORS가 하드 경계를 담당한다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘 등의 취약점은 발견되지 않았다. 전반적으로 보안 관점에서 이번 변경은 위험을 줄이는 방향이며, 잔여 INFO 항목은 모두 기존 설계 결정의 트레이드오프이거나 선택적 강화 사항이다.

## 위험도

NONE
