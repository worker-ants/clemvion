# 보안(Security) 리뷰

대상: Cafe24/MakeShop API client + handler 의 `context.abortSignal` cascade 배선
(`spec/conventions/node-cancellation.md` §4), 관련 스펙/plan 문서.

## 발견사항

- **[INFO]** 리스너 누수(사전 결함) 수정 — 잠재적 리소스 고갈 완화
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1260-1263`, `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` (`finally` 블록, cascade 도입부 — client 파일은 `#### 전체 파일 컨텍스트` 가 제공되지 않아 게이트 숫자는 diff 게이트인 `883-889` 기준)
  - 상세: 이번 diff 는 `upstream.addEventListener('abort', ...)` 를 `controller.signal`(자체 timeout 용) 이 아니라 `finally` 에서 명시적으로 `removeEventListener` 하도록 고쳤다. RESOLUTION.md 에 기록된 대로, 수정 전에는 성공한 모든 호출이 execution-wide `abortSignal` 에 리스너를 영구히 남기고 `executeWithRetry` 의 429/401 재귀가 이를 배가시켰다 — 장시간 실행되는 workflow 나 대량 반복 호출에서 리스너 누적으로 인한 메모리 증가(가용성 저하) 경로가 될 수 있었던 것을, 이번 변경이 `finally` 정리로 닫았다. 새 결함이 아니라 이번 diff 가 해결한 것이므로 **긍정적 변경**으로 기록한다.
  - 제안: 없음 (이미 수정됨). 다만 RESOLUTION.md 가 언급하듯 동일 패턴이 `http-request.handler.ts` 에도 선재하므로 그쪽 후속 조치 시에도 같은 `finally` 정리를 적용할 것.

- **[INFO]** 취소(cancellation)와 동시 발생한 진짜 네트워크 장애가 같은 abort 이벤트로 겹치면 후자가 가려질 수 있음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts:1250-1256` (`err.name === 'AbortError' && upstream?.aborted` 분기), MakeShop 측 동일 패턴 (diff 게이트 `875-881`)
  - 상세: `upstream?.aborted` 만으로 취소/타임아웃을 구분한다. 정상 동작이지만, 이론상 `upstream` 이 취소되어 abort 된 시점과 거의 동시에 다른 원인(예: TLS 오류)으로 fetch 가 reject 되는 경쟁 상황이면, `err.name === 'AbortError'` 가 아닌 경우엔 여전히 `recordNetworkFailure` 로 흘러가므로 실제로는 안전하다 — `err.name` 체크가 있어 AbortError 가 아닌 진짜 네트워크 오류는 이 분기를 타지 않는다. 재검토 결과 오분류 가능성은 없음, 보안 영향도 없음. 참고 차원의 기록.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 픽스처의 자격증명 문자열은 명백한 mock 값
  - 위치: `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts` (`makeIntegration()` 헬퍼, diff 범위 밖의 기존 코드)
  - 상세: `client_secret: 'csecret'`, `access_token: 'access-token-1'`, `refresh_token: 'refresh-token-1'` 등은 이번 diff 가 추가한 코드가 아니라 기존 테스트 헬퍼이며, 형태상 실제 시크릿이 아니라 테스트 fixture 임이 명확하다. 하드코딩된 시크릿 항목으로 분류하지 않음.
  - 제안: 없음.

이번 diff 의 핵심 변경(HTTP client 의 `AbortSignal` cascade, handler 의 `context.abortSignal` 전달, 취소를 `recordNetworkFailure`/`*_TRANSPORT_FAILED` 로 오분류하지 않도록 하는 재throw 로직)은 인젝션, 인증/인가, 암호화, 하드코딩 시크릿, 입력 검증, 에러 메시지의 민감정보 노출 등 전통적 보안 취약점 범주에 새 결함을 도입하지 않는다. 다룬 대상은 실행 취소 신호를 하위 HTTP 호출로 전파하는 배선과 그 분류 로직으로, 외부 입력을 새로 신뢰하거나 새로운 신뢰 경계를 만들지 않는다. `AbortSignal` 은 execution 엔진 내부에서만 생성·전달되며 사용자 입력에서 직접 파생되지 않는다. 오히려 이번 변경은 완료된 호출마다 실행 전역 신호에 리스너가 영구히 쌓이던 사전 결함(잠재적 리소스 고갈 벡터)을 `finally` 절 정리로 닫아, 가용성 측면에서 개선을 가져온다. `plan/`·`review/` 하위의 문서 변경은 코드가 아니며 보안 관련 내용이 없다.

## 위험도
NONE
