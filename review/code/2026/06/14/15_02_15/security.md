# 보안(Security) 코드 리뷰

대상 브랜치: claude/config-call-history-929994
검토 시각: 2026-06-14
검토 범위: §A.3 호출 이력 구현 (소스 IP / 응답 코드 / 기간별 호출 수)

---

## 발견사항

### **[WARNING]** 소스 IP 신뢰 헤더 스푸핑 — `X-Forwarded-For` 첫 번째 값 무조건 신뢰
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` — `extractClientIp(input.headers)` 호출 경로; `hooks.service.spec.ts` 테스트 케이스 `'198.51.100.9, 10.0.0.1'` 첫 번째 값 발췌 확인
- **상세**: `extractClientIp` 가 `X-Forwarded-For` 헤더의 첫 번째 쉼표 분리 값을 클라이언트 IP 로 사용하는 것이 테스트(spec.ts 라인 965)에서 확인된다. `X-Forwarded-For` 는 클라이언트가 임의로 조작할 수 있는 헤더다. 역방향 프록시가 이 헤더를 덮어쓰지 않는 배포 구성(예: 클라이언트가 직접 앱 서버에 접근 가능한 경우)에서는 공격자가 `X-Forwarded-For: <victim-ip>` 를 주입해 임의의 IP 를 `execution.source_ip` 에 기록할 수 있다. 이는 감사 증거의 위·변조이며, IP Whitelist 인증(`ip_whitelist` 검증)도 동일 `extractClientIp` 결과를 재사용하므로 인증 우회로 이어질 수 있다(hooks.service.ts 주석 "인증 IP whitelist 검증과 호출 이력 영속에 공용").
- **제안**: (1) `extractClientIp` 구현을 검토해 신뢰할 수 있는 프록시 목록(`TRUSTED_PROXIES` 환경변수 등)을 기반으로 우측에서 역방향으로 IP 체인을 검증하도록 강화한다. (2) IP Whitelist 검증과 로깅 목적의 IP 추출을 분리해, 인증에는 엄격히 검증된 IP 만 사용하도록 코드 경계를 명확히 한다. (3) 배포 가이드에 "앱 서버는 신뢰된 로드밸런서 뒤에만 노출" 요건을 명시한다.

---

### **[WARNING]** `source_ip` 컬럼에 입력 길이 외 형식 검증 없음 — 임의 문자열 저장 가능
- **위치**: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` (VARCHAR(45) 제약만 있음), `codebase/backend/src/modules/executions/entities/execution.entity.ts` (`@Column length: 45`)
- **상세**: DB 컬럼은 VARCHAR(45) 길이 제약만 있으며 IP 주소 형식 검증(IPv4/IPv6 패턴)이 없다. `hooks.service.ts` 에서 `extractClientIp` 결과를 그대로 전달할 경우, 파싱 버그나 비정상 헤더로 인해 유효하지 않은 문자열이 저장될 수 있다. 이 값은 인증 설정 사용 이력 UI 에 노출되므로 관리자 화면에 신뢰되지 않은 문자열이 표시된다. 현재 프론트엔드는 React JSX 렌더링으로 HTML 인젝션을 기본 차단하지만, 향후 CSV 내보내기·이메일 알림 등 출력 경로가 추가될 경우 XSS/주입 리스크가 증가한다.
- **제안**: `extractClientIp` 반환값 또는 `execute()` 옵션 수신 측에서 IPv4/IPv6 형식을 검증(예: `ip-address` 라이브러리가 이미 임포트되어 있음 — `Address4`/`Address6` 파싱 시도)하고, 파싱 실패 시 `null` 로 처리한다.

---

### **[WARNING]** `response_code` 컬럼에 비-HTTP 트리거의 `status` enum 값이 그대로 노출됨 — 내부 상태 정보 누출
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `responseCode: e.responseCode ?? e.status`
- **상세**: `response_code` 가 NULL 인 비-HTTP 트리거(schedule 등)의 경우 워크플로 실행 상태 enum(`'completed'`, `'failed'`, `'cancelled'`, `'waiting_for_input'` 등)이 그대로 API 응답의 `responseCode` 필드로 노출되고 UI 에 표시된다. `GET /api/auth-configs/:id/usage` 는 현재 Admin+ 권한이 필요하므로 외부 공격자 직접 노출은 제한적이지만, 이 API 응답이 로그·외부 연동·향후 공개 API 에 포함될 경우 내부 워크플로 실행 상태 정보가 의도치 않게 유출될 수 있다. 또한 프론트엔드는 `responseCode` 를 HTTP 코드 문자열로 문서화(`@ApiProperty({ example: '202' })`)하고 있으나 실제로는 `'failed'` 같은 enum 값이 들어올 수 있어 계약 위반이다.
- **제안**: API 응답에서 `responseCode` 와 `status` 를 별도 필드로 분리하거나, `responseCode` 가 NULL 일 때 null 또는 명시적 enum(`'N/A'`, `'non-http'`)을 반환해 내부 enum 값이 `responseCode` 필드로 혼용되지 않도록 한다. DTO `@ApiProperty` 와 실제 반환값이 일치해야 한다.

---

### **[INFO]** 기간별 호출 수 쿼리 — triggerIds 배열 크기 무제한으로 잠재적 대형 IN 절 생성
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `.where('e.trigger_id IN (:...triggerIds)', { triggerIds })` (totalCalls 쿼리 및 periodRaw 쿼리 두 곳)
- **상세**: `triggerIds` 는 해당 `auth_config_id` 에 연결된 모든 트리거의 ID 배열이다. 트리거 수가 많을 경우(예: 수백~수천 개) 매우 큰 `IN (...)` 절이 생성되어 DB 쿼리 플래너 부하 및 잠재적 DoS 가능성이 있다. TypeORM 의 `IN` 파라미터 바인딩은 SQL 인젝션을 막지만, 배열 크기 제한은 없다.
- **제안**: `triggerRepository.find` 결과에 합리적인 상한(예: 1000개)을 두거나, `JOIN` 방식으로 쿼리를 재작성해 서브쿼리로 처리한다.

---

### **[INFO]** `periodRaw` 수치 파싱 — `Number()` 변환 시 NaN 방어 없음
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `last24h: Number(periodRaw?.last24h ?? 0)`
- **상세**: `getRawOne` 이 예상치 못한 타입(예: DB 드라이버 버전 차이로 인한 비-문자열)을 반환할 경우 `Number()` 가 `NaN` 을 반환한다. `NaN` 은 JSON 직렬화 시 `null` 로 변환되어 API 응답 계약 위반이 된다. 현재 테스트에서는 `null` 반환 케이스만 커버한다.
- **제안**: `Number(x)` 결과가 `NaN` 이거나 음수인 경우 `0` 으로 대체하는 방어 코드를 추가한다(`isNaN(n) || n < 0 ? 0 : n`).

---

### **[INFO]** 프론트엔드 테스트 파일에 예시 IP 주소 하드코딩 — 실제 라우터블 IP 사용
- **위치**: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` 라인 1161, `codebase/backend/src/modules/hooks/hooks.service.spec.ts` 라인 965
- **상세**: 테스트 데이터에 `203.0.113.7`(TEST-NET-3, RFC 5737 문서용 예약 주소), `198.51.100.9`(TEST-NET-2, RFC 5737) 가 사용되어 있다. 이는 실제 라우터블 공개 IP 가 아닌 RFC 5737 문서용 범위이므로 보안상 문제없음. 올바른 테스트 픽스처 관행을 따르고 있다.
- **제안**: 현행 유지. (단순 확인 사항으로, 위험 없음)

---

## 요약

이번 변경은 webhook 호출 메타데이터(소스 IP, 응답 코드)를 `Execution` 테이블에 영속하고 UI 에 노출하는 기능이다. 핵심 보안 리스크는 두 가지다. 첫째, `X-Forwarded-For` 헤더를 무조건 신뢰해 소스 IP 를 추출하는 구조가 IP Whitelist 인증 우회 및 감사 로그 위조로 이어질 수 있으며, 이는 인증에도 동일 경로를 재사용하기 때문에 심각도가 높다. 둘째, `response_code` 컬럼에 비-HTTP 트리거의 내부 status enum 값이 노출되어 API 계약 불일치와 정보 누출이 발생한다. 하드코딩된 시크릿, SQL 인젝션, XSS, 암호화 문제는 발견되지 않았으며, TypeORM 파라미터 바인딩이 인젝션을 방어하고 있고 프론트엔드 React JSX 렌더링이 XSS 를 기본 차단한다. 의존성(`ip-address`, `bcrypt`, `crypto`) 도 알려진 취약점 없이 적절히 사용되고 있다.

---

## 위험도

MEDIUM
