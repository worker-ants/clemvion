# API 계약(API Contract) 리뷰

## 발견사항

### [WARNING] spec 명세와 구현 간 `health` 어휘 불일치
- 위치: `plan/in-progress/system-status-page.md` §A 내 spec draft vs `system-status-response.dto.ts`
- 상세: spec draft (`plan/in-progress/system-status-page.md` §A §2 및 §3)에는 `overall` / `health` 값을 `"ok" | "degraded" | "down"` 으로 정의했으나, 실제 구현 DTO (`system-status-response.dto.ts`)에서는 `"healthy" | "degraded" | "down"` 을 사용한다. 프론트엔드 타입 정의(`page.tsx`)와 e2e 테스트(`system-status.e2e-spec.ts`)도 구현 쪽 `"healthy"` 를 따른다. 현재는 구현과 프론트가 동기화되어 있으나, spec draft 표현 `"ok"` 가 별도 문서나 외부 소비자에게 노출될 경우 계약 불일치가 발생한다. 일관성 검토(SUMMARY.md I-6)에서도 동일 문제가 지적되었고 plan의 consistency-check 반영 메모에서 `healthy/degraded/down` 으로 통일했다고 기술했지만, plan 내 spec draft 본문이 실제로 수정되지 않은 채 `"ok"` 가 잔존한다.
- 제안: `plan/in-progress/system-status-page.md` §A 내 spec draft 의 `overall: "ok" | "degraded" | "down"` 과 `health: "ok" | "degraded" | "down"` 을 `"healthy" | "degraded" | "down"` 으로 정정하여 구현 DTO·프론트 타입·e2e 테스트와 완전히 일치시킬 것. (실제 배포 spec 파일이 별도로 존재한다면 해당 파일도 동일 교정 필요.)

### [WARNING] 인가(authorization) 수준 — admin role 미적용이 명시적으로 설계되었으나 Swagger 문서에 누락
- 위치: `codebase/backend/src/modules/system-status/system-status.controller.ts` (전체)
- 상세: 엔드포인트 `GET /system-status/overview` 는 JWT 인증만 적용하고 admin role 가드는 의도적으로 제외했다. 이는 spec §4 보안 설계와 일치한다. 그러나 `@ApiOperation` description 과 `@ApiBearerAuth` 데코레이터만 존재하고, "admin 권한 불요, 모든 인증 사용자 접근 가능" 임을 Swagger 에 명시하는 내용이 없다. API 소비자·리뷰어가 의도인지 누락인지 판단하기 어렵다.
- 제안: `@ApiOperation` description 에 "인증된 모든 사용자 접근 가능 — 집계 카운트만 반환하므로 role 제한 불필요" 를 간략히 추가할 것.

### [INFO] URL 경로 설계 — 향후 확장 계층 고려
- 위치: `codebase/backend/src/modules/system-status/system-status.controller.ts` L27
- 상세: `/system-status/overview` 는 단수형 컨트롤러 경로다. 단일 집계 문서를 반환하므로 현재 설계는 RESTful 관례에 적절하다. 향후 큐별 상세(`/system-status/queues/{name}`) 등이 추가될 경우 경로 계층이 자연스럽게 확장된다.
- 제안: v1 범위에서는 현재 구조 유지. 향후 확장 시 `/system-status/queues/{name}` 등 RESTful 계층을 따를 것.

### [INFO] API 버전 관리 미적용
- 위치: `codebase/backend/src/modules/system-status/system-status.controller.ts`
- 상세: 프로젝트 전반이 비버전 방식이며 이 API 도 일관되게 URL 버전을 적용하지 않았다. 향후 응답 스키마 변경(health 어휘 재정의, 필드 추가 등)이 필요할 경우 하위 호환성 관리 전략이 없다.
- 제안: 현재 코드베이스 전반이 비버전 방식이므로 이 API 만 따로 버전 적용할 필요는 없다. 향후 breaking change 시 버전 정책을 일괄 도입하도록 계획에 기록.

### [INFO] 에러 응답 형식 — Redis 조회 실패 시 200 + down 반환 패턴
- 위치: `codebase/backend/src/modules/system-status/system-status.service.ts` catch 블록
- 상세: 개별 큐 Redis 조회 실패 시 503/500 반환 없이 200 OK 로 해당 큐만 `health: "down"` + 0 카운트로 degrade 하여 전체 응답을 유지한다. spec §2 의 부분 가용성 설계와 일치한다. 다만 "항상 200" 계약이므로 인프라 전체 장애 시에도 200을 받는다는 점을 클라이언트가 `overall: "down"` 으로 해석해야 함을 API 문서에 명시할 필요가 있다.
- 제안: `@ApiOkWrappedResponse` 또는 `@ApiOperation` description 에 "Redis 장애 시에도 200 반환, 해당 큐 health=down" 동작을 명시할 것. 치명적 전체 장애에 대한 503 처리는 v2 에서 고려.

### [INFO] 페이지네이션 — 해당 없음
- 위치: N/A
- 상세: 고정 12개 큐의 집계를 반환하는 단일 문서 API 이므로 페이지네이션이 불필요하다.

### [INFO] 요청 검증 — 파라미터 없음, 별도 검증 불필요
- 위치: `codebase/backend/src/modules/system-status/system-status.controller.ts`
- 상세: `getOverview()` 는 요청 파라미터·바디가 전혀 없는 단순 GET 이므로 별도 유효성 검증이 필요 없다.

## 요약

신규 `GET /system-status/overview` API 는 NestJS 컨트롤러·DTO·서비스의 구조가 정돈되어 있고, JWT 인증 적용, 에러 시 부분 가용성 유지(`health: "down"` + 0 카운트), `{ data: ... }` 전역 래핑 컨벤션 준수, Swagger 문서화, e2e 인증 검증까지 포함되어 API 계약 관점에서 전반적으로 양호하다. 다만 plan 내 spec draft 에 `"ok"` 어휘가 구현의 `"healthy"` 와 불일치한 채 잔존하여(WARNING), 이를 그대로 배포 spec 에 반영하면 클라이언트 계약 오해를 유발할 수 있다. 또한 admin role 미적용이 의도된 보안 설계임을 Swagger 문서에서 명확히 표시할 것을 권고한다(WARNING).

## 위험도

MEDIUM
