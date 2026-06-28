# 보안(Security) 리뷰

## 발견사항

- **[INFO]** CORS `exposedHeaders` 노출 범위 명시화 — 설계 의도 부합
  - 위치: `web-chat-cors.ts` — `buildDefaultCorsOptions` (라인 374–382), `main.ts` (라인 183–596)
  - 상세: `exposedHeaders: ['X-Deleted-Count']` 는 커스텀 응답 헤더 한 개만 브라우저에 노출한다. 표준 safelisted 헤더 외에 추가로 노출되는 헤더가 `X-Deleted-Count` 뿐이고, 이 헤더 자체에 인증 토큰·세션·개인정보 등 민감 값은 포함되지 않는다(삭제 건수 정수). OWASP의 불필요한 정보 노출 기준에서 허용 범위다.
  - 제안: 현재 구현 유지. 향후 `exposedHeaders` 목록이 확장될 경우 각 헤더가 민감 데이터를 담지 않는지 개별 검토할 것.

- **[INFO]** `isExternalOriginAllowed` — origin 없는 요청 무조건 허용
  - 위치: `web-chat-cors.ts` 라인 455 (`if (!origin) return true;`)
  - 상세: non-browser(서버 간 요청, curl 등) 환경에서 Origin 헤더가 없을 경우 허용한다. 이는 표준 CORS 처리 패턴이며(브라우저만 Origin 헤더를 강제 첨부), 외부 상호작용 API가 curl/SDK로도 호출되는 설계 의도와 일치한다. 해당 경로의 실제 인가는 interaction token으로 별도 보호된다고 가정하며, 코드 컨텍스트 내에서 해당 보호 레이어가 존재하는지 이번 diff에서는 직접 확인할 수 없다.
  - 제안: interaction token 인가 레이어가 `/api/external/*` 경로에 반드시 적용되어 있는지 확인. 해당 레이어가 누락되면 CORS origin 무제한이 실질적 접근 통제 부재로 이어질 수 있다. (이 diff 범위 밖이나 후속 리뷰에서 확인 권장.)

- **[INFO]** `/api/hooks/*` 무제한 CORS (`origin: true, credentials: false`) — 설계 의도 부합
  - 위치: `web-chat-cors.ts` 라인 477 (`cb(null, { origin: true, credentials: false })`)
  - 상세: 웹훅 수신 경로는 임의의 발신자로부터 POST를 받는 구조로 `credentials: false` 이므로 쿠키/세션 자격증명은 전송되지 않는다. 이는 CSRF 위험을 차단하며, 웹훅 진위성은 HMAC 서명(`AuthConfigsService.verifyWebhookRequest`)으로 별도 검증하는 것으로 코드 주석에서 확인된다. 설계 의도와 부합한다.
  - 제안: 해당 없음.

- **[INFO]** `decodeURIComponent` 처리 — path traversal 위험 미미
  - 위치: `web-chat-cors.ts` 라인 446 (`return m ? decodeURIComponent(m[1]) : null;`)
  - 상세: execution id를 `decodeURIComponent`로 디코딩한 뒤 DB 조회 키로 사용한다. 정규식 `([^/?]+)` 이 `?`와 `/`를 배제하므로 경로 탐색 문자(`../`)가 캡처될 가능성은 없다. 다만 디코딩 결과물이 DB 쿼리로 전달될 때 ORM/Prepared Statement를 사용하는지는 이번 diff 범위에서 확인 불가.
  - 제안: `resolveAllowlist` 구현에서 execution id를 SQL로 처리할 때 반드시 parameterized query/ORM 바인딩을 사용할 것. (이번 diff에서 해당 구현체는 포함되지 않아 별도 검토 필요.)

- **[INFO]** 테스트 코드 전용 변경 — 프로덕션 공격 면 변화 없음
  - 위치: `web-chat-cors.spec.ts` 전체
  - 상세: 변경 내용은 테스트 파일의 검증 구조 개선(동어반복 제거, 실제 팩토리 import 검증)이다. 프로덕션 코드를 직접 수정하지 않으며, 오히려 `exposedHeaders` 회귀를 실제로 감지하는 테스트 커버리지를 강화했다. 보안 회귀 방지 측면에서 긍정적인 변경이다.
  - 제안: 해당 없음.

## 요약

이번 변경은 CORS `defaultOptions`의 인라인 정의를 `buildDefaultCorsOptions` 순수 팩토리로 추출하고, 테스트가 해당 팩토리를 직접 임포트해 검증하도록 개선한 리팩토링이다. 인젝션, 하드코딩 시크릿, 인증 우회, 안전하지 않은 암호화, 민감 정보 에러 노출 등의 보안 취약점은 발견되지 않았다. `exposedHeaders`에 추가된 헤더(`X-Deleted-Count`)는 민감 정보를 담지 않으며, CORS 정책의 핵심 동작(hooks 무제한, external 워크스페이스 allowlist, 기본 경로 frontend allowlist+credentials)은 변경 전과 동일하다. 보안 관점에서의 주의 사항은 이번 diff 범위 밖의 구현체(`resolveAllowlist`의 쿼리 처리, `/api/external/*` interaction token 인가)에 해당하며, 이 변경 자체는 안전하다.

## 위험도

NONE
