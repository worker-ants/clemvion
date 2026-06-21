# 보안(Security) 리뷰 — M-7 채널 authorizer 도메인 역전

## 발견사항

### 발견사항 1
- **[INFO]** UUID 검증 정규식(uuid.ts) — 올바른 구현, 주의 사항 없음
  - 위치: `codebase/backend/src/common/utils/uuid.ts` L1
  - 상세: `UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` 는 앵커(`^`/`$`)가 양쪽에 존재하고, 버전 nibble을 1-5로 제한하며, variant nibble을 8/9/a/b로 제한한다. case-insensitive(`/i`) 플래그와 길이 앵커가 올바르게 결합되어 경로 탐색이나 인젝션 우회 가능성 없다. ReDoS(정규식 서비스 거부) 위험도 없음 — 역참조·중첩 반복·백트래킹 유발 패턴 미사용.
  - 제안: 없음.

### 발견사항 2
- **[INFO]** W-6 입력 검증 — DB 조회 전 UUID 가드가 모든 authorizer에 일관 적용됨
  - 위치: `execution-channel-authorizer.ts`, `background-run-channel-authorizer.ts`, `workflow-channel-authorizer.ts`, `kb-channel-authorizer.ts`
  - 상세: 각 authorizer가 `isValidUuid(id)` 검증 통과 실패 시 즉시 거부(`{ error: '...' }`)를 반환해 DB 쿼리 진입을 막는다. `kb-channel-authorizer`에도 이번 변경으로 동일 가드가 추가되어 W-6 정책이 전 채널에 일관 적용된다. ORM/raw SQL 파라미터화와 별개로 선차단 레이어를 명시적으로 추가한 것은 깊이 있는 방어(defense-in-depth) 측면에서 긍정적이다.
  - 제안: 없음.

### 발견사항 3
- **[INFO]** IDOR 방어 — 채널 구독 시 소유권 검증이 모든 도메인 authorizer에서 수행됨
  - 위치: 각 `*-channel-authorizer.ts` `authorize` 메서드
  - 상세: execution/background-run/workflow/kb 채널 모두 workspace 소유권을 서비스 레이어에서 검증한 뒤 join을 허가한다. 소유권 검증 실패(throw 포함) 시 `false`로 평탄화하여 항상 거부를 반환하므로, DB 예외가 인가를 우회시키지 않는다. IDOR 방어가 적절히 구현되어 있다.
  - 제안: 없음.

### 발견사항 4
- **[INFO]** notifications 채널 — 사용자 단위 IDOR 방어 올바름
  - 위치: `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` L14
  - 상세: `!!userId && targetUserId === userId` 조건은 빈 userId를 명시적으로 거부하고, JWT sub와 채널의 userId가 정확히 일치해야만 허가한다. 이진 문자열 비교이므로 우회 가능성 없음.
  - 제안: 없음.

### 발견사항 5
- **[INFO]** fail-closed(W-5) — 매칭 authorizer 부재 시 기본 거부
  - 위치: `websocket.gateway.ts` `handleSubscribe` (이번 변경으로 추가)
  - 상세: `isValidChannel` 통과 후 매칭 authorizer가 없으면 `{ success: false, error: 'Not authorized for this channel' }`을 반환한다. 신규 채널이 authorizer 없이 추가되는 실수가 발생해도 구독이 차단된다. fail-open 위험이 제거됨.
  - 제안: 없음.

### 발견사항 6
- **[INFO]** 에러 메시지 — 민감 정보 미노출
  - 위치: 모든 authorizer `authorize` 반환값
  - 상세: 거부 시 반환되는 에러 메시지는 `'Not authorized for this execution'`, `'Not authorized for this background run'` 등 일반적인 문구로 한정된다. DB 오류 내용, 스택 트레이스, 내부 식별자 등이 노출되지 않는다. DB 예외는 `catch(() => false)` 또는 `.catch(() => false)`로 완전히 삼켜져 클라이언트에 전달되지 않는다.
  - 제안: 없음.

### 발견사항 7
- **[INFO]** 하드코딩된 시크릿 — 없음
  - 상세: 검토된 모든 파일에 API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 없다. `CHANNEL_AUTHORIZER`는 DI 토큰용 Symbol로 시크릿이 아니다.
  - 제안: 없음.

### 발견사항 8
- **[INFO]** 인젝션 취약점 — 없음
  - 상세: 채널 문자열은 `String.prototype.startsWith`/`slice`로만 처리되며, SQL 쿼리·명령어·HTML에 직접 삽입되지 않는다. DB 조회는 서비스 레이어(ORM/파라미터화된 raw SQL)에서 수행되고, 진입 전에 UUID 형식 검증으로 추가 차단된다. XSS·커맨드 인젝션·경로 탐색 해당 코드 없음.
  - 제안: 없음.

### 발견사항 9
- **[INFO]** 암호화 — 해당 코드 없음
  - 상세: 이번 변경은 채널 구독 인가 로직이며 암호화/해시/토큰 생성 코드가 포함되지 않는다.
  - 제안: 없음.

### 발견사항 10
- **[INFO]** 의존성 보안 — 신규 외부 의존성 없음
  - 상세: 이번 변경에서 추가된 패키지 의존성이 없다. NestJS `@Injectable` 등 기존 프레임워크 데코레이터만 사용한다.
  - 제안: 없음.

### 발견사항 11
- **[INFO]** CHANNEL_AUTHORIZER Symbol 토큰 — 충돌 위험 없음
  - 위치: `codebase/backend/src/modules/websocket/channel-authorizer.ts` L29
  - 상세: `Symbol('CHANNEL_AUTHORIZER')`는 고유 값을 생성하므로 동명 문자열 토큰과 달리 다른 모듈에서 같은 이름의 토큰과 충돌할 위험이 없다. DI 토큰 하이재킹(token collision) 가능성이 없음.
  - 제안: 없음.

### 발견사항 12
- **[INFO]** useFactory 집계 방식 — 보안 관점 위험 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` L39-L62
  - 상세: `useFactory: (...authorizers) => authorizers` 패턴은 5개 authorizer를 명시적으로 열거한다. 외부에서 임의 authorizer를 주입해 배열을 확장할 수 있는 공격 표면이 없다(NestJS DI 컨테이너는 런타임 외부 주입을 허용하지 않음). 배열 순서는 보안에 영향 없음 — prefix 매칭이 상호 배타적이므로.
  - 제안: 없음.

---

## 요약

M-7 채널 authorizer 도메인 역전 리팩터링은 보안 관점에서 전반적으로 우수하다. UUID 검증 가드(W-6)가 모든 채널 authorizer에 일관 적용되어 DB 쿼리 진입 전 비-UUID 입력이 차단되고, IDOR 방어를 위한 workspace 소유권 검증이 구독 join 이전에 동기적으로 수행된다. fail-closed(W-5) 기본 거부, notifications 채널의 JWT sub 일치 강제, DB 예외 삼킴을 통한 에러 정보 비노출 등 보안 관련 모든 주요 경계가 올바르게 구현되었다. 하드코딩된 시크릿, 인젝션 취약점, 안전하지 않은 암호화, 알려진 취약 의존성이 발견되지 않았으며, Critical 및 Warning 수준의 보안 결함은 없다.

## 위험도

NONE
