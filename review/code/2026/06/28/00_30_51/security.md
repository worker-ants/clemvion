# 보안(Security) 리뷰

## 발견사항

### [INFO] sessionStorage 전환 — XSS 잔존 노출 면 축소 (긍정 변경)
- 위치: `codebase/channel-web-chat/src/lib/session-store.ts` — `getStorage()` 함수
- 상세: `localStorage` → `sessionStorage` 전환은 보안 개선이다. sessionStorage 는 탭 종료 시 자동 소거되므로 단명 토큰이 브라우저에 장기 잔존하는 위험이 줄어든다. XSS 공격자가 localStorage 에서 토큰을 탈취한 뒤 다른 탭/시간에 재사용하는 시나리오를 제한한다. 같은 탭 내 reload 는 유지되므로 N1 세션 복원 요건도 보존된다.
- 제안: 현행 방향 유지. 추가 강화 여지로, 토큰이 탭 간 공유 불가해져 사용자 경험에 영향 없는지 제품 요건 재확인(공개 위젯 특성상 탭 독립 대화가 적합하다고 plan 에 명시됨 — 수용됨).

### [INFO] 에러 메시지 일반화 — 정보 노출 방지 (긍정 변경)
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `errMessage()` 함수 및 `GENERIC_ERROR_MESSAGE` 상수
- 상세: 기존 코드는 `EiaError.message` 및 `Error.message` 원문을 UI 에 직접 반환했다. 임베드 위젯은 제3자 사이트에서 동작하므로 서버 내부 메시지(HTTP 상태 코드, 예외 클래스명, 스택 정보 등)가 최종 사용자 UI 에 노출되면 OWASP A05(Security Misconfiguration) / A09(Security Logging and Monitoring Failures) 범주의 정보 노출 위험이 있다. 변경 후 UI 에는 일반화 문구만 노출되고, 원문은 `console.warn` 으로만 기록된다.
- 제안: 운영 환경에서 `console.warn` 출력이 사용자에게 가시적이지 않은지 확인(DevTools 접근이 가능한 사용자는 볼 수 있으나, 이는 일반적으로 허용 범위). 향후 구조화된 에러 로깅(원격 모니터링)으로 전환 시 민감 정보 필터링 정책을 동일하게 적용할 것.

### [INFO] 입력 검증 — sessionStorage 키 구성의 경로 탐색 위험 미해당
- 위치: `codebase/channel-web-chat/src/lib/session-store.ts` — `key()` 함수
- 상세: `KEY_PREFIX + triggerEndpointPath` 로 스토리지 키를 구성한다. `triggerEndpointPath` 는 외부(호스트 사이트)에서 `wc:boot` 메시지로 전달된다. localStorage/sessionStorage 키는 파일시스템 경로가 아니므로 경로 탐색(path traversal) 위험은 없다. 다만 다른 triggerEndpointPath 를 가진 키가 동일 origin 의 sessionStorage 에 공존할 수 있으므로, 탈취된 키 이름으로 다른 세션 데이터를 읽는 cross-trigger 정보 노출 가능성이 이론적으로 존재한다. 그러나 이는 동일 iframe origin 내 신뢰된 코드만 접근 가능한 범위이며, XSS 전제 시 세션 내용 자체가 노출되는 것이 더 큰 위협이다.
- 제안: 현재 구현으로 충분. 향후 triggerEndpointPath 에 대한 허용 목록 검증(화이트리스트)을 boot 단계에서 추가하면 방어 깊이가 높아진다.

### [INFO] postMessage origin 검증 — 테스트 코드에서 origin 미지정 케이스 존재
- 위치: `codebase/channel-web-chat/src/widget/use-widget-commands.test.ts` — `postCommand()` 함수
- 상세: `postCommand` 는 `MessageEvent` 생성 시 `origin` 을 지정하지 않는다(jsdom 기본값 `""`). 실제 프로덕션 bridge 코드의 origin 검증 로직이 올바르게 구현되어 있는지는 이 diff 의 범위 밖이나, 테스트가 origin 핀 없이 동작한다는 점은 bridge 의 `origin` 검증이 실질적으로 테스트되지 않음을 의미한다. `use-widget-eager-start.test.ts` 의 `boot()` 함수는 `origin: "http://host.test"` 를 명시적으로 설정하고 있어 대조적이다.
- 제안: `use-widget-commands.test.ts` 의 `postCommand` 에도 `origin` 필드를 명시하여 origin 검증 로직이 테스트 커버리지에 포함되도록 개선하는 것을 권장한다(blocking 은 아님).

### [INFO] 시스템 상태 API — 큐 이름 목록 노출 수준
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` — `EXPECTED_QUEUE_NAMES` 배열, 라인 86-88
- 상세: `workspace-invitations-pruner` 큐 이름 추가는 단순 drift 수정이다. 시스템 상태 API 는 이미 JWT 인증 가드로 보호(`미인증 → 401` 테스트 존재)되어 있으며, 큐 집계 통계만 노출하고 개별 job 식별자/payload 는 노출하지 않음(`expect(q).not.toHaveProperty('jobs')` 단언 존재)을 확인했다. 보안 관점에서 이 변경은 무위험이다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 보안 관점에서 전반적으로 긍정적인 방향이다. 핵심 변경 두 가지 — (1) 단명 세션 토큰 저장소를 `localStorage` 에서 `sessionStorage` 로 전환하여 탭 종료 시 자동 소거(defense-in-depth, XSS 잔존 노출 면 축소), (2) 에러 메시지 일반화로 서버 내부 정보가 UI 에 직접 노출되는 정보 유출 위험 제거 — 모두 OWASP 관점에서 공격 표면을 줄이는 의도적 보안 강화다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회 등 능동적 취약점은 발견되지 않았다. 테스트 코드에서 `postMessage` origin 핀 미지정 케이스가 있으나 이는 테스트 커버리지 갭이지 프로덕션 취약점은 아니다.

## 위험도

LOW
