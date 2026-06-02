# 보안(Security) 리뷰 결과

## 발견사항

### [WARNING] IP 스푸핑 위험 — X-Forwarded-For 신뢰 체계 미검증
- **위치**: `public-webhook-throttle.guard.ts` `extractClientIp()` 함수
- **상세**: `x-forwarded-for` 헤더의 첫 번째 항목을 클라이언트 IP로 신뢰한다. 클라이언트가 임의의 `X-Forwarded-For: <fake-ip>` 헤더를 삽입하면 rate-limit 키를 의도적으로 바꿀 수 있다. 리버스 프록시(Nginx, Cloudflare 등)가 헤더를 prepend/replace 하는 방식에 따라 신뢰 가능 IP 위치가 다르다. `cf-connecting-ip`를 우선하도록 되어 있어 Cloudflare 환경에서는 어느 정도 완화되나, `cf-connecting-ip`도 없는 일반 프록시 환경에서는 XFF 첫 항목이 클라이언트가 제어하는 값이 될 수 있다.
- **제안**: 인프라 레이어(프록시 계층 수)를 고려하여 XFF의 신뢰 가능한 위치를 설정으로 지정하거나, NestJS의 `trust proxy` 설정을 통해 Express가 정규화한 `req.ip`를 사용한다. 이미 IP가 없을 때 fail-open(통과) 처리를 하므로 현재도 극단적 우회(헤더 완전 제거)는 가능한 상태이다.

### [WARNING] 고정 윈도우(Fixed-Window) 카운터 — 경계 버스팅 허용
- **위치**: `public-webhook-quota.service.ts` `incrWithWindow()` / `consumeStart()`
- **상세**: Fixed-window 카운터는 윈도우 경계(예: 분당 59초~다음 분 1초)에서 최대 2배 트래픽 버스팅을 허용하는 잘 알려진 특성이 있다. spec이 fixed-window를 명시 채택(주석에 명시)했으므로 spec 위반은 아니나, 보안 검토 관점에서 경계 버스팅이 위젯 대화 시작 남용 방어의 실효성을 절반으로 낮출 수 있다.
- **제안**: 현재 spec 결정을 유지하되, spec에 fixed-window의 버스팅 허용을 명시적으로 기록한다. 더 강한 방어가 필요하다면 sliding-window(Redis ZRANGEBYSCORE 패턴)로 교체를 검토한다.

### [WARNING] Fail-Open 정책 — IP 미식별 시 rate-limit 우회 허용
- **위치**: `public-webhook-throttle.guard.ts` `canActivate()` IP 미식별 분기
- **상세**: IP 식별 불가 시 `return true`(통과)가 의도적 설계(fail-open)이나, `X-Forwarded-For`와 `cf-connecting-ip` 헤더를 모두 누락한 직접 TCP 연결(또는 헤더 제거 프록시)에서 rate-limit이 완전히 무력화된다. 공격자가 헤더를 제거한 채 반복 요청하면 quota가 적용되지 않는다.
- **제안**: IP 미식별 요청에도 별도 버킷(예: `wh:rl:no-ip` 공유 버킷)으로 카운터를 적용하거나, IP 없는 공개 webhook을 fail-closed(거부)로 전환하는 것을 spec 수준에서 재검토한다.

### [INFO] Redis 연결에 TLS 미강제 — 평문 전송 가능
- **위치**: `public-webhook-quota.service.ts` Redis 초기화 블록
- **상세**: `redis.tls` 설정값이 없거나 false이면 Redis 연결이 평문으로 이루어진다. rate-limit 카운터만 저장하므로 기밀 데이터 노출 위험은 낮으나, 네트워크 공격자가 Redis 명령을 위조하여 카운터를 리셋할 수 있다.
- **제안**: 프로덕션 환경에서 `redis.tls`를 기본값 true로 강제하거나, 배포 문서에 TLS 필수 여부를 명시한다.

### [INFO] body 크기 측정 — rawBody 미전달 시 JSON.stringify 추정값 사용
- **위치**: `public-webhook-throttle.guard.ts` `measureBodyBytes()`
- **상세**: `rawBody`가 없으면 `JSON.stringify(body)` 바이트 수로 추정한다. NestJS의 body-parser가 이미 역직렬화한 객체를 재직렬화하면 실제 전송 바이트보다 작거나(공백 생략) 클 수 있어 32KB 한도가 정확하지 않을 수 있다. 또한 `rawBody`를 사용하려면 NestJS global 설정에서 `rawBody: true`를 활성화해야 하는데, 이 설정 누락 시 항상 추정값 경로로 빠진다.
- **제안**: `rawBody`를 항상 확보하도록 NestJS 앱 설정에 `rawBody: true`를 필수로 포함시키고, 이를 배포 체크리스트에 명시한다. 추정값 경로는 fallback으로만 유지한다.

### [INFO] wc:resize payload — CSS 값 검증 없음 (XSS 잠재적 가능성)
- **위치**: `bridge.ts` `applyResize()`
- **상세**: `payload.width`/`payload.height`가 문자열인 경우 `iframe.style.width/height`에 그대로 대입한다. 악의적인 iframe 측이 구식 CSS 표현식(`expression(...)`) 또는 비정상적인 CSS 값을 주입할 수 있다. 그러나 이 코드는 origin 검증(`bridge.ts`의 기존 origin 필터링)을 통과한 신뢰된 출처의 메시지만 처리하므로 실제 위험도는 낮다.
- **제안**: 문자열 값에 대해 CSS 단위 허용 목록(`%`, `px`, `vh`, `vw`, `em`, `rem` 등)을 검사하는 정규식 검증 추가를 검토한다.

### [INFO] data-global 속성값 — 전역 이름 검증 없음 (프로토타입 오염 가능성)
- **위치**: `loader-entry.ts` `resolveGlobalName()` 및 `loader.ts` `installGlobal()`
- **상세**: `document.currentScript.dataset.global`에서 읽은 문자열을 그대로 `window[globalName]`의 키로 사용한다. `__proto__`, `constructor`, `prototype` 같은 값이 전달되면 프로토타입 오염(prototype pollution)이 발생할 수 있다. 단, 이 값은 HTML에 직접 삽입하는 사이트 운영자가 제어하는 속성이므로 공격자가 임의로 삽입하기 어렵다.
- **제안**: `globalName`이 안전한 식별자인지 검증한다. 예: `/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(globalName)` 으로 알파벳/숫자 식별자만 허용하고, 검증 실패 시 기본 이름(`ClemvionChat`)으로 fallback한다.

### [INFO] 하드코딩된 시크릿 없음
- **위치**: 전체 변경 파일
- **상세**: API 키, 비밀번호, 토큰 등 하드코딩된 시크릿 없음. Redis 비밀번호는 `ConfigService`를 통해 환경변수에서 주입된다.

### [INFO] 에러 메시지 — 내부 오류 상세 미노출
- **위치**: `public-webhook-throttle.guard.ts`, `public-webhook-quota.service.ts`
- **상세**: 오류는 `logger.warn`으로만 기록하고 HTTP 응답에는 일반 메시지(`Too many conversation starts from this client`)만 반환한다. 스택 트레이스·내부 세부사항이 클라이언트에 노출되지 않는다.

---

## 요약

이번 변경의 핵심 보안 코드(공개 webhook rate-limiting — `PublicWebhookQuotaService` + `PublicWebhookThrottleGuard`)는 전반적으로 설계 원칙이 양호하다. Redis 미가용 시 fail-open, 에러 메시지 최소화, 인증 webhook 면제, body 크기 제한 등 기본 방어 구조를 갖추었다. 다만 세 가지 WARNING 수준 이슈가 실효적 방어를 약화시킬 수 있다: (1) `X-Forwarded-For` 헤더를 클라이언트가 조작하면 rate-limit 키를 우회할 수 있고, (2) fixed-window 특성상 경계에서 최대 2배 버스팅을 허용하며, (3) IP 식별 불가 요청이 rate-limit 없이 통과된다. 프론트엔드 SDK(`bridge.ts`, `loader-entry.ts`)에서는 iframe 메시지의 CSS 값 검증 부재와 `data-global` 속성을 통한 프로토타입 오염 가능성이 INFO 수준으로 발견되었으나, 현재의 origin 검증과 점유 가드가 1차 방어선으로 기능하고 있어 즉각적 위험도는 낮다. SQL 인젝션, 커맨드 인젝션, 하드코딩 시크릿, LDAP 인젝션, 경로 탐색 등 여타 OWASP Top 10 항목에 해당하는 취약점은 발견되지 않았다.

## 위험도

MEDIUM
