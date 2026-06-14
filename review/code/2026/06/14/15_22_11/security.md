# 보안(Security) 리뷰

## 발견사항

### [WARNING] source_ip 입력 검증 부재 — IP 형식 미검증

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `const clientIp = extractClientIp(input.headers);` 및 `sourceIp: clientIp ?? undefined` 전달 경로
- 상세: `extractClientIp` 가 반환한 값을 별도 형식 검증 없이 `Execution.source_ip`(VARCHAR 45) 에 직접 영속한다. `X-Forwarded-For` 헤더는 역방향 프록시 체인이 추가하는 클라이언트 제어 입력이므로, 악의적 클라이언트가 헤더를 조작해 임의 문자열(예: SQL 페이로드, 긴 문자열)을 주입할 수 있다. 현재 `VARCHAR(45)` 제한이 DB 레벨 길이 초과 오류를 막지만, TypeORM 파라미터 바인딩 덕분에 SQL 인젝션 위험은 낮다. 그러나 정규표현식 등으로 IPv4/IPv6 형식(RFC 5952 기준, 최대 45자)을 애플리케이션 레벨에서도 검증하는 것이 심층 방어 원칙에 부합한다.
- 제안: `extractClientIp` 반환값에 IPv4/IPv6 형식 정규표현식 검증을 추가하고, 유효하지 않으면 `null` 로 처리한다. 또는 `hooks.service.ts` 에서 DB 영속 전에 검증 단계를 삽입한다.

---

### [WARNING] X-Forwarded-For IP 스푸핑 — 신뢰 경계 미명시

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `extractClientIp(input.headers)` 사용 경로 (인증 IP whitelist 검증 + `§A.3` 호출 이력 영속 공용)
- 상세: `extractClientIp` 가 `X-Forwarded-For` 의 **첫 번째** IP 를 신뢰한다. 이 값은 역방향 프록시를 통과한 경우 원격 클라이언트가 헤더를 삽입해 조작할 수 있다(`203.0.113.7, actual-ip` 형태). 테스트(`hooks.service.spec.ts`) 에서도 `198.51.100.9, 10.0.0.1` 중 첫 번째를 소스 IP 로 채택하는 동작을 그대로 명세로 굳혔다. **인증 IP whitelist 검증**에 이 값이 쓰인다면, 화이트리스트 우회 공격이 가능하다.
- 제안: (1) 배포 환경에서 신뢰할 프록시 수를 구성하고, `X-Forwarded-For` 의 "신뢰 가능한 마지막 IP"(오른쪽에서 프록시 홉 수만큼 역산)를 사용하도록 `extractClientIp` 를 개선한다. (2) 호출 이력 표시(`§A.3`)와 인증 IP whitelist 검증이 같은 `clientIp` 를 공유하는 점을 문서화하고, 프록시 설정이 변경될 경우 두 경로 모두에 영향을 준다는 점을 명시한다.

---

### [INFO] response_code 컬럼 — 클라이언트 제어 값 아님, 인젝션 위험 없음

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `responseCode: WEBHOOK_ACCEPTED_RESPONSE_CODE` (상수 `String(HttpStatus.ACCEPTED)` = `"202"`)
- 상세: `response_code` 는 서버 사이드에서 고정 상수(`"202"`)로 할당되며, 사용자 입력에서 파생되지 않는다. 인젝션 위험 없음.

---

### [INFO] TypeORM 파라미터 바인딩 사용 — SQL 인젝션 방어 적절

- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage()` 내 세 QueryBuilder (`triggerIds`, `since24h`/`since7d`/`since30d` 등)
- 상세: 모든 쿼리가 TypeORM 의 파라미터 바인딩(`:...triggerIds`, `:since24h` 등)을 사용하며, 동적 SQL 문자열 연결이 없다. SQL 인젝션 위험 없음.

---

### [INFO] source_ip 가 API 응답에 노출 — 개인정보 분류 필요

- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — `AuthConfigUsageCallDto.sourceIp` + `codebase/frontend/src/app/(main)/authentication/page.tsx` 드로어 테이블
- 상세: 소스 IP 는 개인정보(GDPR, 개인정보보호법 대상 가능)이다. 현재 API 응답 및 프론트엔드 UI 에 원문 그대로 노출된다. 접근 제어(인증된 워크스페이스 관리자 전용)가 서비스 레이어에서 보장되는지 확인이 필요하다. `getUsage` 는 `findById(id, workspaceId)` 로 워크스페이스 범위를 검증하므로 타 워크스페이스 접근은 차단되나, 역할 기반 접근 제어(예: Admin 이상만) 적용 여부는 컨트롤러 레이어에서 별도 확인이 필요하다.
- 제안: `GET /api/auth-configs/:id/usage` 엔드포인트에 `Admin+` 역할 가드가 적용되어 있는지 컨트롤러를 점검한다. 로그 보존 정책(IP 데이터 보존 기간 제한)도 spec 에 명시할 것을 권장한다.

---

### [INFO] periodCounts 안전 변환 — 음수/NaN 방어 구현됨

- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `safeCount()` 함수
- 상세: DB 드라이버가 문자열 또는 비정상 값을 반환할 경우 `NaN`이나 음수를 0으로 폴백 처리하는 `safeCount` 가 구현되어 있다. 수치 처리 측면에서 적절함.

---

## 요약

이번 변경은 webhook 호출 메타데이터(소스 IP, HTTP 응답 코드)를 `execution` 테이블에 영속하고 인증 설정 사용 내역 API·UI 에 노출하는 기능이다. TypeORM 파라미터 바인딩으로 SQL 인젝션이 방어되고, 하드코딩된 시크릿·인증 우회·암호화 문제는 발견되지 않는다. 주요 보안 우려는 두 가지다. 첫째, `X-Forwarded-For` 기반 소스 IP 가 클라이언트에 의해 스푸핑될 수 있으며, 이 값이 인증 IP whitelist 검증과 호출 이력 영속에 공용으로 사용되는 점이 보안상 민감하다(프록시 홉 설정 미명시 시 whitelist 우회 가능). 둘째, IP 주소는 개인정보에 해당하므로 API 응답 노출 경로의 역할 기반 접근 제어와 보존 정책을 명문화해야 한다. 두 항목 모두 현재 구현의 즉각적 악용 가능성은 낮으나, 배포 환경 설정에 따라 위험도가 높아질 수 있으므로 WARNING 수준으로 분류한다.

## 위험도

MEDIUM
