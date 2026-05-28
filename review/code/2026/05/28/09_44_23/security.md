# 보안(Security) 리뷰 — integration-activity-api-label

검토 일시: 2026-05-28
대상: `integration_usage_log` API 식별 3컬럼 추가 + `GET /api/integrations/services/:type/catalog` 신규 endpoint (총 파일 27개)

---

## 발견사항

### [INFO] catalog endpoint — `type` 파라미터 입력 검증 없음, 단 영향 제한적

- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `getServiceCatalog(@Param('type') type: string)`
- 상세: `type` 파라미터에 길이·형식 제한이 없다. 서비스 로직(`integrations.service.ts`)은 `if (serviceType === 'cafe24')` 정확 일치만 분기하고, 그 외는 빈 배열을 즉시 반환한다. 내부적으로 파라미터를 DB 쿼리·파일 시스템·외부 호출에 사용하지 않으므로 인젝션·경로 탐색 위험은 없다. 그러나 악의적 클라이언트가 임의 길이 문자열(예: 10 MB 문자열)을 보낼 경우 NestJS/Express 의 기본 URL 파싱 스택에서 처리되며, 별도 `MaxLength` 가드가 없다.
- 제안: `@Param('type', new MaxLengthPipe(64))` 또는 커스텀 파이프로 허용 service type 을 allowlist(`['cafe24', 'http', 'database', 'email', 'mcp', ...]`) 로 제한하는 것이 방어 심층화에 유리하다. 기능 차단 우선순위는 낮으나 API 표면 정의 명확화 차원에서 권장.

---

### [INFO] `extractApiPath` — 상대 URL fallback 에서 path traversal 원시 값 저장 가능

- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — `extractApiPath(url: string)`
- 상세: `new URL(url)` 파싱이 실패하면(상대 URL 케이스) query string 만 제거한 원시 문자열을 `api_path` 로 저장한다. `../../../etc/passwd` 또는 `javascript:alert(1)` 등 악의적 문자열이 그대로 DB에 기록될 수 있다. 이 값은 활동 로그 조회 API → 프론트엔드 테이블에 텍스트로 렌더되는 경로이므로, 저장 자체는 varchar 컬럼에 문자열을 쓰는 것이므로 DB 손상은 없고, 프론트엔드에서 React 가 텍스트 노드로 렌더하는 한 XSS 는 없다. 그러나 데이터 품질(path traversal 패턴 노이즈) 문제는 존재한다.
- 제안: `extractApiPath` 에서 반환 전 `encodeURIComponent` 또는 최소한 ASCII printable 범위 필터를 적용하거나, 저장 계층 `clampApiField` 에서 제어 문자를 strip 하는 정제 단계를 추가한다.

---

### [INFO] send-email handler — SMTP host 가 로그에 기록됨 (민감도 낮으나 주의)

- 위치: `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts` — `apiInfo.path = credentials.host ?? null`
- 상세: SMTP host 명(예: `smtp.gmail.com`)은 통합 자격 증명 내부 필드다. 이 값이 `integration_usage_log.api_path` 에 평문으로 기록되면, 활동 로그 조회 권한이 있는 모든 워크스페이스 멤버가 SMTP host 를 볼 수 있다. host 자체는 낮은 민감도이나, 내부 SMTP relay 를 사용하는 조직에서는 인프라 정보 노출이 될 수 있다.
- 제안: SMTP host 가 외부에 표시될 가치(API 식별 기여도)와 노출 위험을 비교해 의도적으로 수용 가능한 수준인지 팀 결정을 명문화한다. 현재 구조는 spec INT-US-05 의 설계 결정대로 구현된 것으로, 보안보다 UX 디버깅 편의를 우선한 것임을 명시하면 충분하다.

---

### [INFO] `extractSqlVerb` — SQL 쿼리 첫 토큰만 추출하므로 SQL 인젝션 위험 없음 (확인)

- 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` — `extractSqlVerb(query)`
- 상세: 함수가 `/^([A-Za-z]+)/` 정규식으로 첫 알파벳 토큰만 추출하고 나머지를 버린다. 이 반환값은 DB가 아닌 `integration_usage_log.api_method` varchar 컬럼에만 저장되므로 SQL 인젝션 경로가 없다. 실제 SQL 실행은 별도 파라미터 바인딩 경로를 거친다. 확인 완료.

---

### [INFO] catalog endpoint — 인증 데코레이터 명시적 확인 권장

- 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `@Get('services/:type/catalog')`
- 상세: 컨트롤러 클래스에 `@ApiBearerAuth('access-token')` 가 선언되어 있고, NestJS 의 글로벌 가드(JWT AuthGuard)가 모듈 수준에서 적용된다면 새 엔드포인트도 자동으로 보호된다. diff 에서 엔드포인트에 `@Roles` 또는 `@Public` 같은 예외 데코레이터가 없는 것을 확인했으며, swagger 에 `@ApiUnauthorizedResponse` 가 명시되어 있다. 단, catalog 데이터는 서비스 메타데이터(workspace 무관)이므로 향후 `@Public` 으로 전환을 고려하는 경우 명시적 보안 결정이 필요하다.
- 제안: 현재 상태는 안전. 단, 코드 주석 또는 swagger description 에 "인증 필요, workspace 격리 없음(메타데이터는 동일)" 정책을 명시해 향후 변경 시 실수를 예방한다.

---

### [INFO] 프론트엔드 `renderApiCell` — XSS 위험 없음 (확인)

- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — `renderApiCell`
- 상세: `apiLabel`, `apiMethod`, `apiPath`, 번역 결과 모두 JSX 텍스트 노드(`{humanLabel}`, `{endpoint}`)로 렌더한다. React 는 텍스트 노드를 자동 escape 하므로 DB 에 `<script>` 가 저장되어 있어도 실행되지 않는다. `dangerouslySetInnerHTML` 사용 없음. 확인 완료.

---

### [INFO] 하드코딩된 시크릿 없음 (확인)

- 대상: 변경된 모든 파일
- 상세: API 키, 비밀번호, 토큰, 인증서가 코드에 직접 포함된 사례 없음. SMTP host 는 런타임 credentials 에서 읽어온다. 확인 완료.

---

### [INFO] SQL 마이그레이션 — 안전한 `ALTER TABLE`

- 위치: `codebase/backend/migrations/V064__integration_usage_log_api_columns.sql`
- 상세: `ADD COLUMN` 3개 모두 `NULL` 기본값이며 사용자 입력을 직접 포함하지 않는다. DDL 파일에 동적 값이 없어 DDL-level 인젝션 위험 없음. 확인 완료.

---

## 요약

이번 변경(활동 로그 API 식별 3컬럼 + catalog endpoint)은 전반적으로 보안 관점에서 양호하게 설계되었다. 하드코딩 시크릿 없음, SQL 인젝션 위험 없음, XSS 위험 없음(React 텍스트 노드 + query string 제거 설계 명시), 인증 보호 유지, 입력 길이 clamp 처리가 확인된다. 주목할 사항은 두 가지다: (1) `extractApiPath` 의 상대 URL fallback 경로가 임의 문자열을 정제 없이 DB에 저장하는 점(기능적 위험은 낮으나 데이터 품질 문제), (2) SMTP host 가 활동 로그에 기록되는 점(설계 결정이지만 인프라 정보 노출 가능성으로 문서화 권장). catalog endpoint 의 `type` 파라미터 allowlist 부재는 현 로직상 실질 위험이 없지만 방어 심층화 차원에서 개선 여지가 있다. 전체적으로 긴급 수정이 필요한 취약점은 발견되지 않았다.

---

## 위험도

LOW

---

## 이슈 카운트

| 등급 | 건수 |
|------|------|
| CRITICAL | 0 |
| WARNING | 0 |
| INFO | 6 |
| **합계** | **6** |
