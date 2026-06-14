# Security Review

## 발견사항

### 파일 1: codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts

- **[INFO]** `@ApiProperty` 메타데이터 변경(type 명시 추가, description 한글화)은 런타임 직렬화/역직렬화에 영향을 주지 않는 순수 문서 변경이다.
  - 위치: `AuthConfigUsagePeriodCountsDto` (last24h/last7d/last30d), `AuthConfigUsageCallDto.sourceIp`, `AuthConfigUsageCallDto.responseCode`
  - 상세: Swagger 스키마 생성용 힌트만 추가됐고, 실제 타입 선언·직렬화 동작은 변경되지 않았다. 보안 면에서 영향 없음.
  - 제안: 해당 없음.

- **[INFO]** `sourceIp: string | null` 필드가 API 응답에 노출된다 (기존 코드 그대로, 이번 diff 신규 도입 아님).
  - 위치: `AuthConfigUsageCallDto.sourceIp`
  - 상세: IP 주소는 PII로 분류될 수 있다. 그러나 해당 필드는 `GET /api/auth-configs/:id/usage` 응답에 포함되며, 스펙 §2.17·§3.2 기준 Owner/Admin RBAC 가드 적용이 명시되어 있다. 가드가 올바르게 구현되어 있다면 불필요한 노출에 해당하지 않는다. 컨트롤러 레이어 RBAC 가드 적용 여부는 이번 diff 범위 외.
  - 제안: 컨트롤러에서 Owner/Admin 권한 가드(`@Roles('owner', 'admin')` 류)가 이 엔드포인트에 실제 적용되어 있는지 구현 레이어에서 별도 확인 권장.

---

### 파일 2~3: review/code/2026/06/14/16_34_50/RESOLUTION.md, SUMMARY.md

- **[INFO]** 이전 리뷰 산출물 파일이며 애플리케이션 코드·시크릿·인프라 설정을 포함하지 않는다.
  - 상세: 보안 관점의 검토 대상이 아닌 내부 리뷰 기록. 인젝션·하드코딩 시크릿·인증 취약점 해당 없음.
  - 제안: 해당 없음.

---

### 파일 4: review/code/2026/06/14/16_34_50/_retry_state.json

- **[INFO]** 워크플로 상태 추적용 JSON 파일로, 민감 정보(자격증명·시크릿)를 포함하지 않는다.
  - 상세: 파일 경로·에이전트 이름·상태값만 포함. 외부 노출이 되더라도 시스템 내부 디렉터리 구조가 알려질 수 있으나, 이 파일은 review/ 디렉터리 내 내부 기록이며 실제 공격 면을 확장하지 않는다.
  - 제안: 해당 없음.

---

### 파일 14: spec/1-data-model.md

- **[INFO]** `idx_execution_trigger_started` partial 인덱스 정의가 스펙 문서에 추가됐다.
  - 위치: §3 인덱스 테이블 신규 행, `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL`
  - 상세: 스펙 문서 변경이며 코드 변경 없음. SQL 인덱스 정의 자체는 보안 취약점을 생성하지 않는다. partial 인덱스가 `trigger_id IS NOT NULL` 조건으로 schedule/manual 실행을 제외하는 것은 성능 최적화이고, 정보 노출 범위를 확장하지 않는다. 기존 V095 행과 달리 V096 행에 `CONCURRENTLY` 명시가 없는 점은 무중단 배포 안전성 문제(보안 범위 외, database reviewer 담당).
  - 제안: 해당 없음 (보안 관점).

---

### 파일 15: spec/5-system/12-webhook.md

- **[INFO]** `ExecutionEngineService.execute()` 3번째 인자에 `sourceIp` / `responseCode: '202'` 추가 명세.
  - 위치: §7 step 7e, step 8b
  - 상세: `sourceIp`는 기존 auth 레이어(`extractClientIp`)에서 이미 추출·검증된 값을 재사용한다. 새로운 IP 추출 경로가 도입된 것이 아니므로 추가 공격 면이 없다. `responseCode: '202'` 하드코딩은 성공 경로에만 `execute()` 가 호출되고 실패 경로(401/410/400)는 이전에 throw되므로 잘못된 코드가 저장될 위험이 없다.

- **[INFO]** `sourceIp`가 `CF-Connecting-IP` 등 신뢰 헤더에서 추출될 수 있다.
  - 위치: `Execution.source_ip` 컬럼, `extractClientIp` 구현 경로
  - 상세: 스펙 §2.18.1에서 `TRUST_CF_CONNECTING_IP=true` 환경변수 플래그(default off)로 제어한다고 이미 명시되어 있다. IP spoofing 위험은 스펙 레벨에서 인지·제어 중이며 이번 diff에서 신규 도입된 사항이 아니다.
  - 제안: 운영 환경에서 `TRUST_CF_CONNECTING_IP` 플래그가 실제 Cloudflare 프록시 뒤에서만 활성화되도록 인프라 정책으로 강제할 것을 권장(이번 diff 범위 외).

---

## 요약

이번 변경은 DTO Swagger 메타데이터 보완(type 명시, description 한글화), 이전 리뷰 산출물 추가, 스펙 인덱스 기록 추가, webhook 처리 흐름 명세 업데이트로 구성된다. 직접적인 보안 취약점(인젝션·하드코딩 시크릿·인증 우회·평문 전송·안전하지 않은 암호화·민감 정보 에러 노출·취약 의존성)은 발견되지 않았다. `sourceIp` 필드의 PII 노출 우려는 스펙상 Owner/Admin RBAC 가드로 제어되며 이번 diff 신규 도입 사항이 아니다. `TRUST_CF_CONNECTING_IP` IP spoofing 위험도 스펙에서 이미 환경변수 플래그 방식으로 인지·제어 중이다.

## 위험도

NONE

STATUS: PASS
