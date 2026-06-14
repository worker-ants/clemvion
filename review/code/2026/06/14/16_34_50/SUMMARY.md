# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 변경 없는 spec 동기화·DTO Swagger 메타데이터 보강 작업. 즉각적 차단 이슈 없음. e2e 커버리지 갭과 부분적 일관성 미완이 낮은 수준의 후속 조치 항목으로 남음.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Side Effect | `ExecutionEngineService.execute()` 3번째 인자에 `sourceIp`/`responseCode` 추가 시 기존 호출자(schedule/manual/서브워크플로우) 하위 호환성 위험. 필드가 필수로 선언될 경우 컴파일·런타임 오류 가능. | `spec/5-system/12-webhook.md` §7 step 7e, 8b | `sourceIp?: string \| null`, `responseCode?: string \| null` 으로 optional 선언하여 기존 호출자 호환성 보장. schedule/manual 경로는 필드 생략 또는 명시적 undefined/null 전달로 통일. |
| W-2 | Testing | `GET /api/auth-configs/:id/usage` 엔드포인트에 대한 e2e 테스트 전무. V096 에서 신규 추가된 `source_ip`/`response_code` DB 컬럼-Entity 매핑과 실제 쿼리 결과를 통합 수준에서 미검증. | `codebase/backend/test/` (e2e 디렉터리) | `webhook-trigger.e2e-spec.ts` 또는 `auth-configs.e2e-spec.ts` 에 (1) webhook 호출로 Execution 생성 → (2) `/usage` 응답의 `recentCalls[0].sourceIp`·`responseCode` 검증 흐름 추가. 우선순위 MEDIUM. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Maintainability | TSDoc 주석과 `@ApiProperty.description` 내용 이중화. `last24h` 등 주석에 "(캘린더 일 경계 아님)" 보충 문구가 있으나 `description` 에는 누락. 향후 한쪽만 갱신 시 불일치 위험. | `auth-config-response.dto.ts` `AuthConfigUsagePeriodCountsDto` 3개 필드 | (a) TSDoc 을 SoT 로 두고 description 자동 생성 도입, 또는 (b) description 을 SoT 로 두고 TSDoc 제거. 단기적으로는 description 에 "(캘린더 일 경계 아님)" 추가로 일관성 유지. |
| I-2 | Maintainability | `type: Number`/`type: String` 명시가 변경된 필드에만 적용되어 파일 내 타입 명시 일관성 미완. `AuthConfigDto`, `AuthConfigUsageDto` 등 다른 필드는 여전히 추론에 의존. | `auth-config-response.dto.ts` 파일 전체 | 파일 전체 primitive 필드에 `type` 명시를 통일하거나, 추론 방식으로 파일 전체 컨벤션을 통일. 절충 방식은 장기 불일관 누적. |
| I-3 | Maintainability | `AuthConfigUsageCallDto.responseCode` 에 `type: String` 미명시. 인접 `sourceIp` 에는 추가됐으나 동일 DTO 내 일관성 미달. | `auth-config-response.dto.ts` lines 95–99 | `type: String` 추가 및 3줄 인라인 description 을 줄 분리하여 가독성 개선. |
| I-4 | Maintainability | `spec/5-system/12-webhook.md` step 7e 와 8b 의 함수 시그니처 서술 구조 비대칭. step 7e 는 bullet 설명 없이 인라인, step 8b 는 bullet 2개로 설명. | `spec/5-system/12-webhook.md` §7 step 7e, 8b | 두 분기 모두 동일 서술 구조(코드 블록 + bullet 설명)로 통일하거나, 공통 옵션 객체를 별도 테이블로 추출해 양쪽에서 참조. |
| I-5 | Maintainability | `R-6` 참조가 앵커 없이 텍스트로만 등장. Rationale 섹션에 실제 앵커가 없을 가능성. step 7e, 8b 두 위치에서 반복. | `spec/5-system/12-webhook.md` step 7e, 8b | `R-6` 를 Rationale 섹션의 실제 앵커 링크로 교체하거나, 앵커 없다면 추가하여 딥링크 참조 일관성 확보. |
| I-6 | Database | V096 마이그레이션 SQL 의 `CONCURRENTLY` 옵션 명시 여부 불명. 기존 V095 partial 인덱스 행에는 `CONCURRENTLY` 표기 있음. | `spec/1-data-model.md` V096 인덱스 행 | 마이그레이션 SQL 작성 시 `CREATE INDEX CONCURRENTLY` 사용하여 테이블 락 없이 생성. 고빈도 INSERT 대상인 Execution 테이블의 무중단 배포 안전성 요건 충족 필요. |
| I-7 | Scope | DTO `description` 의 영어 → 한국어 전환이 코드베이스 내 다른 DTO 언어 정책과 일치하는지 미확인. | `auth-config-response.dto.ts` `AuthConfigUsagePeriodCountsDto` 3개 필드 | 코드베이스 내 다른 DTO의 description 언어 정책 확인 후 일관성 유지. 차단 수준은 아님. |
| I-8 | Documentation | `spec/5-system/12-webhook.md` §1 아키텍처 개요 다이어그램에 `sourceIp`/`responseCode` 인자가 미반영. 추상 수준 개요라 필수는 아니나 추적성 개선 여지 있음. | `spec/5-system/12-webhook.md` §1 ASCII 다이어그램 | 다이어그램 또는 각주에 "§7·§8 에서 sourceIp/responseCode 추가 전달 — 상세는 해당 step 참조" 추가 고려. |
| I-9 | Requirement | `AuthConfigUsageCallDto.responseCode` 에 `type: String` 미명시. 기능 오류는 아니나 같은 DTO 내 일관성 여지. | `auth-config-response.dto.ts` lines 95–99 | `type: String` 추가 고려. |
| I-10 | Security | 사용 내역 조회 API의 `sourceIp` 노출 — Owner/Admin RBAC 가드 적용 여부는 이번 diff 범위 외. | `AuthConfigUsageCallDto.sourceIp` | 호출 측 컨트롤러 권한 가드 별도 확인 권장(이번 diff 범위 외). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 직접적 보안 취약점 없음. sourceIp 추출 신뢰 설정·RBAC 가드는 기존 스펙 범위 내 관리됨. |
| requirement | NONE | 전 필드가 spec §A.3 정의와 일치. responseCode non-null DTO는 서비스 폴백을 전제한 합리적 설계. |
| scope | NONE | 기능 변경 없는 spec 현행화 및 DTO Swagger 메타데이터 보완. 범위 이탈 없음. |
| side_effect | LOW | execute() 3번째 인자 optional 선언 미확인 시 기존 호출자 호환성 위험(W-1). |
| maintainability | LOW | TSDoc/description 이중화, type 명시 파일 내 불일관, spec 서술 비대칭, 앵커 없는 참조 등 다수 개선 여지(I-1~I-5). |
| testing | LOW | e2e 레벨에서 /usage 엔드포인트 커버리지 갭(W-2). 단위 커버리지는 충분. |
| documentation | NONE | 문서화 품질 전반적 향상. last24h 주석·description 경미한 문구 불일치(I-1 참조). |
| database | LOW | CONCURRENTLY 옵션 명시 권장(I-6). 인덱스 설계 자체는 기존 패턴과 일관되고 적절. |
| api_contract | N/A | 출력 파일 없음 (파일 미생성). |

## 발견 없는 에이전트

- **security**: 보안 취약점 없음 (INFO 수준 관찰만)
- **requirement**: 요구사항 불일치 없음
- **scope**: 범위 이탈 없음
- **documentation**: 문서 품질 문제 없음 (INFO 수준 개선 제안만)

## 권장 조치사항

1. **(W-1 우선)** `ExecutionEngineService.execute()` 3번째 인자 타입에서 `sourceIp?: string | null`, `responseCode?: string | null` 을 optional 로 선언하여 schedule/manual/서브워크플로우 기존 호출자 하위 호환성 확인.
2. **(W-2)** `webhook-trigger.e2e-spec.ts` 또는 `auth-configs.e2e-spec.ts` 에 webhook 호출 → Execution 생성 → `/usage` 응답 검증 e2e 테스트 추가. V096 컬럼 Entity 매핑 오류를 단위 테스트 mock 이 가릴 수 있으므로 MEDIUM 우선순위.
3. **(I-6)** V096 마이그레이션 SQL 에 `CREATE INDEX CONCURRENTLY` 적용 확인 — 운영 Execution 테이블 무중단 배포 안전성.
4. **(I-3)** `AuthConfigUsageCallDto.responseCode` 에 `type: String` 추가 및 description 가독성 개선 (인접 필드와 패턴 통일).
5. **(I-1)** `last24h`/`last7d`/`last30d` 의 TSDoc 주석과 `@ApiProperty.description` 불일치("캘린더 일 경계 아님" 문구) 동기화. 또는 이중화 제거 방향으로 팀 컨벤션 결정.
6. **(I-5)** `spec/5-system/12-webhook.md` 의 `R-6` 텍스트 참조를 실제 앵커 링크로 교체.
7. **(I-2)** 장기적으로 `auth-config-response.dto.ts` 파일 전체 `@ApiProperty type` 명시 일관성 통일.

## 라우터 결정

라우터 결정 (`routing_status=done`):

- **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `api_contract` (9명, 전원 router_safety 강제 포함)
- **제외**: `dependency`, `user_guide_sync` (2명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터 선별 제외 (상세 사유 미기재) |
| user_guide_sync | 라우터 선별 제외 (상세 사유 미기재) |