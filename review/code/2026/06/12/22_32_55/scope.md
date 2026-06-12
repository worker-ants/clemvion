# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 1: audit-action.const.ts
- **[INFO]** 주석 내 명칭 업데이트
  - 위치: 36-39행 JSDoc 주석
  - 상세: `llm_config.*` → `model_config.*`, `password_change·2fa_*` → `user.password_changed·user.2fa_enabled·user.2fa_disabled` 로 변경. spec §4.1 + §Rationale 4.1.A 확정 표기에 맞게 주석을 정렬한 것으로, security-hardening 후속 작업의 일환인 명칭 정합화다.
  - 제안: 이상 없음. 주석이 실제 spec SoT 와 일치하도록 하는 수정이며 의도된 범위 내.

### 파일 2: auth.controller.spec.ts
- **[INFO]** 'null' Origin(sandbox iframe CSRF) 거부 테스트 추가
  - 위치: 103-123행 (새 it 블록)
  - 상세: `'null'` Origin 을 wildcard 모드에서도 거부하는지 검증. "04 후속" 레이블로 명시되어 있으며 이전 `'04 M-5'` CSRF 방어의 직접적 follow-up 이다.
  - 제안: 이상 없음. 보안 강화 후속 범위 내.

### 파일 3: client-ip.spec.ts
- **[INFO]** `extractClientIpFromHeaders` 공유 코어 테스트 추가
  - 위치: 1-45행 (새 describe 블록)
  - 상세: 새로 추출된 `extractClientIpFromHeaders` 함수에 대한 단위 테스트가 추가되었다. 파일 4(`client-ip.ts`)에서 해당 함수가 새로 공개 export 되었으므로 대응 테스트 추가는 필수.
  - 제안: 이상 없음.

### 파일 4: client-ip.ts
- **[INFO]** `extractClientIpFromHeaders` 공유 코어 함수 추출
  - 위치: 786-808행 (새 export 함수 추가 + `extractClientIp` 내부 위임)
  - 상세: 이전에 `extractClientIp` 내부에 인라인으로 존재하던 헤더 기반 IP 추출 로직을 `extractClientIpFromHeaders` 로 분리하고 `hooks.service.ts` / `public-webhook-throttle.guard.ts` 에서 사본 중복을 제거하기 위한 리팩토링이다. "04 후속" 레이블로 명시. 공개 API 면에서 `extractClientIp` 는 동일하게 유지된다.
  - 제안: 이상 없음. 사본 drift 방지를 위한 정당한 범위 내 리팩토링이며, 보안 정책 변경 없음.

### 파일 5: refresh-cookie.spec.ts
- **[INFO]** `clearRefreshTokenCookie` 도메인 패리티 테스트 추가
  - 위치: 928-937행 (새 it 블록)
  - 상세: `clearRefreshTokenCookie` 가 `cookieDomain` 을 제대로 전달하는지 검증. `setRefreshTokenCookie` 의 기존 도메인 테스트와 set/clear 패리티를 확인하는 후속 보완이다.
  - 제안: 이상 없음.

### 파일 6: refresh-cookie.ts
- **[INFO]** `setRefreshTokenCookie` 에 JSDoc 추가
  - 위치: 1087-1095행 (새 JSDoc 블록)
  - 상세: 기존 함수에 문서화 목적의 JSDoc 만 추가. 함수 로직은 변경 없다.
  - 제안: 이상 없음.

### 파일 7: hooks.service.ts
- **[INFO]** 로컬 `extractClientIp` 함수가 공유 코어로 위임
  - 위치: 1199행 import 변경, 1208-1228행 함수 본체 교체
  - 상세: 이전에 `hooks.service.ts` 내부에 중복 구현되어 있던 IP 추출 로직을 `extractClientIpFromHeaders` 로 위임. 기능 동작은 동일하게 유지(동일한 CF 게이트·XFF 파싱 정책). 주석이 새 위임 구조를 설명하도록 업데이트되었다.
  - 제안: 이상 없음.

### 파일 8: public-webhook-throttle.guard.ts
- **[INFO]** 로컬 `extractClientIp` 함수가 공유 코어로 위임
  - 위치: 1921행 import 변경, 1945-1959행 함수 본체 교체
  - 상세: 파일 7과 동일한 패턴. 이전 중복 구현을 공유 코어로 교체. 기능 동작 동일.
  - 제안: 이상 없음.

### 파일 9: websocket.gateway.spec.ts
- **[INFO]** `notifications` 채널 `userId` 미설정 시 거부 테스트 추가
  - 위치: 2158-2176행 (새 it 블록)
  - 상세: 인증 미들웨어 회귀로 `userId` 가 소켓에 설정되지 않았을 때도 notifications 구독을 거부하는지 검증. "04 후속" 레이블로 명시. 기존 M-6 notifications IDOR 방어의 직접 후속이다.
  - 제안: 이상 없음.

### 파일 10: websocket.module.ts
- **[INFO]** JWT fallback secret 변경 (`'fallback'` → `'dev-jwt-secret'`)
  - 위치: 3112행
  - 상세: `'fallback'` 이라는 임의 문자열 대신 `assertProductionConfig` 의 `INSECURE_JWT_SECRETS` 목록에 포함된 sentinel 값 `'dev-jwt-secret'` 으로 통일. 이로써 DI 경합 등으로 fallback 이 쓰이더라도 production 부팅 가드가 차단한다. 보안 강화 후속의 일환으로 의도된 범위 내.
  - 제안: 이상 없음.

### 파일 11: condition-evaluator.util.ts
- **[INFO]** `MAX_REGEX_LENGTH` JSDoc 보강
  - 위치: 3180행 `@link` 참조 추가, 3182-3184행 설명 추가
  - 상세: 기존 주석에 `compileUserRegex` 참조와 200자 기준의 설계 근거(safe-regex 1차 방어 + 길이 상한 2차 방어)를 추가했다. 구현 변경 없음.
  - 제안: 이상 없음.

### 파일 12: safe-html.test.ts
- **[INFO]** relative href/anchor 허용 및 `blob:` scheme 제거 테스트 추가
  - 위치: 3490-3506행 (새 두 it 블록)
  - 상세: "04 m-1 후속" 레이블로 명시. 이전에 `http/https/mailto` 는 허용하고 `data:` 는 제거하는 테스트가 있었으나, relative URL·anchor 허용 여부와 `blob:` scheme 제거 경계가 미검증 상태였다. 경계 고정(regression prevention) 목적의 후속 테스트다.
  - 제안: 이상 없음.

---

## 요약

12개 파일 전체에 걸쳐 변경은 모두 "security-hardening followups" 의 명시적 후속(label: "04 후속", "04 M-5", "04 M-6", "04 m-1 후속") 으로 레이블되어 있으며, 범위를 벗어난 수정은 발견되지 않는다. 핵심 변경 패턴은 세 가지다: (1) `extractClientIpFromHeaders` 공유 코어 추출로 두 모듈의 사본 중복 제거, (2) 이전 보안 강화 티켓(M-3/M-5/M-6/m-1)의 edge case 를 커버하는 후속 테스트 추가, (3) JSDoc/주석이 spec SoT 와 일치하도록 하는 명칭·근거 정렬. 불필요한 리팩토링, 무관한 파일 수정, 의미 없는 포맷팅 변경은 없다. `websocket.module.ts` 의 fallback secret 교체는 기능 변경처럼 보이지만 `assertProductionConfig` 의 sentinel 체계와 정합을 맞추는 보안 강화 후속으로 의도된 범위 내다.

## 위험도

NONE
