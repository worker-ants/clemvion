# Code Review 통합 보고서

## 전체 위험도
**LOW** — DTO 메타데이터·spec 문서 동기화 슬라이스. 런타임 로직 변경 없음. 유지보수성 패턴 불일관(INFO 3건)과 e2e 커버리지 갭(WARNING 1건 — 이전 리뷰 W-2 승계) 외 차단 이슈 없음.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Testing | **e2e 레벨 `/usage` 엔드포인트 커버리지 갭 (이전 리뷰 W-2 승계)** — 단위 테스트(`auth-configs.service.spec.ts`)는 `getUsage` 로직을 충분히 커버하지만, 실제 DB(V096) 환경에서 webhook 호출 → Execution 행 생성 → `/usage` 응답의 `recentCalls[0].sourceIp`·`responseCode` 를 통합 수준에서 검증하지 못한다. TypeORM Entity 컬럼 매핑 오류를 mock 이 가릴 수 있어 e2e 검증이 특히 중요하다. | `codebase/backend/test/` | `webhook-trigger.e2e-spec.ts` 또는 `auth-configs.e2e-spec.ts` 에 (1) webhook 호출로 Execution 생성 → (2) `GET /api/auth-configs/:id/usage` 응답의 `recentCalls[0].sourceIp`·`responseCode` 검증 흐름 추가. 본 슬라이스 범위 밖 — #602 기능 PR 후속 과제이며 RESOLUTION.md 에 비조치 사유 기록됨. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Maintainability | **`last24h` TSDoc 주석 ↔ `@ApiProperty.description` 불일치** — TSDoc 에는 "(캘린더 일 경계 아님)" 문구가 있으나 `description` 에는 없음. `last7d`/`last30d` 는 일치. 이중 소스 구조가 향후 동기화 실수를 유발할 수 있음. | `AuthConfigUsagePeriodCountsDto.last24h` (`auth-config-response.dto.ts`) | 단기: `last24h` 의 `description` 에 "(캘린더 일 경계 아님)" 추가. 장기: TSDoc 또는 `@ApiProperty.description` 중 단일 SoT 로 통일. |
| I-2 | Maintainability | **`@ApiProperty type` 명시 파일 내 불완전 적용** — 이번 변경이 일부 필드에만 `type` 명시를 추가해 `AuthConfigDto.id`/`name`/`isActive`, `AuthConfigUsageDto.totalCalls` 등은 여전히 추론 방식. 혼재 상태 지속. 이전 리뷰 I-2 비조치 항목 승계. | `auth-config-response.dto.ts` 파일 전체 | 파일 전체 primitive 필드에 `type` 명시를 통일하거나 추론 방식으로 파일 전체 컨벤션 통일. 우선순위 낮음. |
| I-3 | Documentation | **`R-6` 앵커 링크 유효성 미확인** — step 7e·8b 에서 `[R-6](../2-navigation/6-config.md#rationale)` 로 교체됐으나 `6-config.md` 의 Rationale 섹션에 `#rationale` 앵커가 실제 존재하는지 미검증. | `spec/5-system/12-webhook.md` step 7e·8b | `spec/2-navigation/6-config.md` 의 `## Rationale` 헤딩이 `#rationale` 앵커를 생성하는지 확인. 미존재 시 앵커 명시(`{#rationale}`) 추가. |
| I-4 | Security | **`sourceIp` PII 노출 — RBAC 가드 의존** — `AuthConfigUsageCallDto.sourceIp` 가 API 응답에 포함되나, Owner/Admin RBAC 가드(spec §2.17·§3.2) 적용 전제. 이번 diff 신규 도입 아님. | 컨트롤러 레이어 (`GET /api/auth-configs/:id/usage`) | 컨트롤러에서 Owner/Admin 권한 가드가 해당 엔드포인트에 실제 적용되어 있는지 별도 확인 권장 (이번 diff 범위 외). |
| I-5 | Side Effect | **Swagger JSON 스냅샷 테스트 갱신 필요 가능성** — `description` 한국어 전환 및 `type` 명시 추가로 런타임 OpenAPI JSON 출력이 변경. 스냅샷 비교 테스트 존재 시 실패할 수 있음. | `auth-config-response.dto.ts` (`AuthConfigUsagePeriodCountsDto`, `AuthConfigUsageCallDto`) | Swagger 스냅샷 테스트 존재 시 갱신. `type: String` + `nullable: true` 조합의 `sourceIp` OpenAPI 스키마 출력(`{ type: 'string', nullable: true }`) 확인. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | PII(`sourceIp`) 노출은 RBAC 가드로 제어 중. `TRUST_CF_CONNECTING_IP` spoofing 위험은 기존 env 플래그로 인지·제어. 신규 취약점 없음. |
| requirement | NONE | DTO 필드 전부 spec §A.3·§2.13 과 line-level 일치. `responseCode` non-null ↔ DB nullable 불일치는 서비스 폴백 설계의 올바른 반영. |
| scope | NONE | 전체 변경(DTO 메타데이터, spec 인덱스 행, webhook spec 명확화, review 산출물)이 이전 리뷰 RESOLUTION 조치 이행 범위 내. 의도 외 변경 없음. |
| side_effect | NONE | 런타임 비즈니스 로직·DB·네트워크 무영향. 유일한 부작용은 OpenAPI JSON 출력 변경(Swagger 스냅샷 테스트 갱신 필요 가능성). |
| maintainability | LOW | `last24h` TSDoc ↔ description 불일치, `type` 명시 혼재, `responseCode` `type: String` 미추가 — 모두 INFO 수준. 즉각 차단 없음. |
| testing | LOW | 기존 단위 테스트 유효. e2e `/usage` 커버리지 갭(W-2 승계)은 본 슬라이스 범위 밖 MEDIUM 우선순위 후속 과제. |
| documentation | NONE | 전반적 문서화 품질 향상. `last24h` description 불일치·`R-6` 앵커 유효성 미확인 INFO 2건 존재. |

---

## 발견 없는 에이전트

security (INFO 참고사항만), requirement (INFO 참고사항만), scope (범위 이탈 없음), side_effect (비의도 부작용 없음), documentation (차단 이슈 없음)

---

## 권장 조치사항

1. **(W-1 후속 과제 추적)** e2e 레벨 `/usage` 엔드포인트 커버리지 갭 — `webhook-trigger.e2e-spec.ts` 또는 `auth-configs.e2e-spec.ts` 에 webhook 호출 → Execution 생성 → `recentCalls[0].sourceIp`·`responseCode` 검증 추가. 본 슬라이스 범위 밖이며 별도 후속 이슈로 추적 권장.
2. **(I-1 단기 수정)** `last24h` 의 `@ApiProperty.description` 에 "(캘린더 일 경계 아님)" 추가 — TSDoc 과 일치시킴. 간단한 1행 수정.
3. **(I-3 확인)** `spec/2-navigation/6-config.md` 의 `## Rationale` 헤딩에 `#rationale` 앵커 존재 여부 확인. 미존재 시 앵커 추가.
4. **(I-5 확인)** Swagger JSON 스냅샷 테스트가 존재한다면 description·type 변경 반영하여 갱신.
5. **(I-2 장기)** 파일 전체 `@ApiProperty type` 명시 컨벤션 통일 — 우선순위 낮음, 별도 리팩터링 슬라이스에서 처리 가능.

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`).

- **실행 (router_safety 강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 강제 포함)
- **제외**: `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (5명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터 선별에 의한 제외 |
| database | 라우터 선별에 의한 제외 |
| concurrency | 라우터 선별에 의한 제외 |
| api_contract | 라우터 선별에 의한 제외 |
| user_guide_sync | 라우터 선별에 의한 제외 |

- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (실행된 전체 reviewer 와 동일)