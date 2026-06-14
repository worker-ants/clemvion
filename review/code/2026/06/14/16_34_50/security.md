# Security Review

## 발견사항

### 파일 1: auth-config-response.dto.ts

- **[INFO]** 변경 내용은 Swagger `@ApiProperty` 메타데이터에 `type: Number / type: String` 명시와 설명 한글화뿐이다.
  - 위치: `AuthConfigUsagePeriodCountsDto`, `AuthConfigUsageCallDto.sourceIp`
  - 상세: 런타임 직렬화/역직렬화 동작을 변경하지 않는 순수 문서 변경. 보안 면에서 영향 없음.
  - 제안: 해당 없음.

- **[INFO]** `sourceIp` 필드 (기존 코드 포함): `string | null` 타입으로 API 응답에 노출된다.
  - 위치: `AuthConfigUsageCallDto.sourceIp`
  - 상세: IP 주소는 PII로 분류될 수 있으나, 이 필드는 워크스페이스 Owner/Admin 전용 인증 설정 사용 내역 조회 API(`GET /api/auth-configs/:id/usage`)의 응답이다. 스펙 §2.17, §3.2 기준 RBAC가 API 레이어에서 강제되면 불필요한 노출은 아니다. 이번 diff 에서 신규 도입된 것도 아니다.
  - 제안: 호출 측 컨트롤러에서 Owner/Admin 권한 가드가 적용되어 있는지 별도 확인 권장(이번 diff 범위 외).

---

### 파일 2: spec/1-data-model.md

- **[INFO]** `idx_execution_trigger_started` partial 인덱스 정의 추가 — 스펙 문서 변경이며 코드 변경 없음.
  - 위치: 인덱스 테이블 신규 행, `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL`
  - 상세: SQL 인덱스 정의 자체는 보안 취약점을 생성하지 않는다. partial 인덱스가 `trigger_id IS NOT NULL` 조건으로 schedule/manual 실행을 필터링하는 것은 성능 최적화이며, 인증 설정 사용 내역 집계의 정보 노출 범위를 확장하지 않는다.
  - 제안: 해당 없음.

---

### 파일 3: spec/5-system/12-webhook.md

- **[INFO]** `ExecutionEngineService.execute()` 3번째 인자에 `sourceIp` / `responseCode: '202'` 추가 명세.
  - 위치: 처리 흐름 §7 step 7e, step 8b
  - 상세: `sourceIp` 는 기존 인증 IP whitelist 검증(`extractClientIp`)과 동일한 값을 재사용한다. 이미 auth 레이어에서 추출·검증된 IP를 Execution 행에 영속하는 것은 새로운 공격 면을 만들지 않는다.

- **[INFO]** `responseCode: '202'` 하드코딩 — 실제 HTTP 응답 코드와 항상 일치하는가.
  - 위치: step 8b 설명 코드
  - 상세: 스펙이 "성공 경로의 실제 HTTP 코드 `202`"라고 명시한다. 인증/검증 실패 경로(401, 410, 400)는 `execute()` 호출 이전에 throw/return 되어 Execution 행이 생성되지 않으므로 `responseCode='202'`가 틀린 값으로 저장될 여지가 없다. 논리적으로 일관된다.
  - 제안: 해당 없음.

- **[INFO]** `sourceIp` 가 `CF-Connecting-IP` 등 신뢰 헤더에서 추출될 수 있음 (스펙 §2.13 `source_ip` 컬럼 설명 참조).
  - 위치: `Execution.source_ip` 컬럼 정의, `extractClientIp` 구현 경로
  - 상세: 스펙이 `CF-Connecting-IP`를 신뢰할 시 환경변수 플래그(`TRUST_CF_CONNECTING_IP=true`, default off)로 제어한다고 명시(`RefreshToken.ip_address` 설명 §2.18.1). IP spoofing 위험은 스펙 레벨에서 인지·제어되고 있다. 이번 diff 에서 신규 도입된 사항 아님.
  - 제안: 운영 환경에서 `TRUST_CF_CONNECTING_IP` 플래그가 실제 Cloudflare 프록시 뒤에서만 활성화되도록 인프라 정책으로 강제할 것을 권장(이번 diff 범위 외).

---

## 요약

이번 변경은 DTO Swagger 메타데이터 보완(파일 1), 스펙 인덱스 항목 추가(파일 2), webhook 처리 흐름에서 `sourceIp`·`responseCode` 인자를 `ExecutionEngineService.execute()` 로 전달하는 흐름 명세 추가(파일 3)로 구성된다. 인젝션·하드코딩 시크릿·인증 우회·평문 전송 등 직접적인 보안 취약점은 발견되지 않았다. `sourceIp` IP 추출 신뢰 설정 및 사용 내역 조회 API의 RBAC 가드 적용은 이번 diff 범위 외 구현 레이어 확인이 필요하나, 스펙 상에서 이미 각각 환경변수 플래그와 RBAC 정책으로 다루고 있다.

## 위험도

NONE

STATUS: PASS
