# Code Review 통합 보고서

## 전체 위험도
**LOW** — 8개 엔티티 nullable 컬럼 TS 타입을 `| null` 로 넓히는 순수 타입 정합화 배치(§배치 3, "잔여 전량")이며 런타임 동작·스키마·API 라우트 변경 없음. CRITICAL 0건. WARNING 1건은 이 PR 이 새로 만든 결함이 아니라 타입 정합화 과정에서 **드러난 선재(pre-existing) API 계약 불일치**(`AuthConfigDto.ipWhitelist`)이며, 작성자가 이미 plan 문서에 실측·기록하고 명시적으로 스코프 아웃했다. forced reviewer 7명 전원 결과 확보됨(누락 없음) — "forced 인데 결과 없음" 상황 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | `AuthConfigDto.ipWhitelist` 가 non-nullable(`string[]`)로 Swagger 문서화돼 있으나, 이번 diff 로 엔티티(`AuthConfig.ipWhitelist: string[] \| null`)가 공식적으로 nullable 임이 드러났고 서비스도 이미 `?.length` 로 null 을 방어적으로 다룬다. `AuthConfigsController` 는 엔티티를 별도 DTO 매핑 없이 그대로 반환하므로 `GET /auth-configs` 응답의 `ipWhitelist` 가 실제로 `null` 일 수 있다 — Swagger 를 신뢰해 무가드로 배열 메서드를 호출하는 클라이언트는 런타임 예외 위험. 이 PR 이 새로 만든 결함은 아니며(DB/런타임은 이전부터 nullable), plan 문서 §"새로 드러난 축"에 developer 가 이미 실측·기록하고 "이름 중복 문제 선결 필요"를 이유로 의도적으로 스코프 아웃함. | `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:28` ↔ `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts:43` | 이 PR 범위에서 고칠 필요는 없음(스코프 판단 합리적). 다만 plan 의 후속 트랙이 실제 작업 항목으로 승격되는지 추적 확인. 최소 조치로 `ipWhitelist?: string[] \| null` + `@ApiPropertyOptional({ nullable: true })`(같은 DTO 의 `lastUsedAt` 과 동일 패턴)로 정정하면 클라이언트 위험 즉시 해소. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | plan 체크리스트의 "각 배치마다 tsc 비-spec 소스 오류 0 을 직접 확인" 항목이 미체크(`[ ]`) 상태로 남아 있으나, 바로 위 §배치 3 절과 커밋 로그에 이미 "tsc 오류 0 · 가드 12/12 · ratchet 198/37→197/36"이 명시돼 있어 세 배치 모두 실제로 이 규칙을 지켰음이 확인됨 | `plan/in-progress/entity-nullable-column-type-mismatch.md:337` | 사실 충족됐다면 `[x]`로 갱신. "매 배치 반복 준수 규칙" 의도라면 그 취지를 한 줄 명시해 오독 방지 |
| 2 | 문서화 | CHANGELOG.md 가 배치 1·2·3(이번 diff 포함) 세 커밋 전부 갱신되지 않았는데, plan 문서 자신이 인용한 선례(`Execution.error` nullable 정정)는 CHANGELOG 에 기록된 사례라 방향이 다름 | `plan/in-progress/entity-nullable-column-type-mismatch.md:52`, CHANGELOG.md(diff 밖) | 의도된 생략(내부 타입 리팩터·wire 계약 불변)이면 plan 에 판단 근거 한 줄 기록. 이 PR 을 막을 사유는 아님 |
| 3 | 유지보수성 | plan 문서 §배치 2 절의 "배치 3 기준" 체크박스 줄에서 "확정" 결론 문장과 폐기된 원문 후보 검토 문단이 접속사 없이 이어붙어 경계가 불명확 | `plan/in-progress/entity-nullable-column-type-mismatch.md` (§배치 3 기준 체크박스 항목) | 원문 후보 검토 문단을 인용 블록(`>`)으로 분리하거나 "확정. 상세는 §배치 3 참조"로 간결화 |
| 4 | 요구사항/스코프 | `folders.controller.ts` 의 `dto as Partial<Folder>` → `dto` 캐스트 제거(+`Folder` import 제거)는 `Folder.parentId` nullable 확장의 정당한 직접 파생이나, plan 본문의 배치 3 "캐스트 제거" 서술은 `folders.service.spec.ts:14` 의 fixture 캐스트만 언급하고 이 컨트롤러 캐스트는 빠뜨림 (requirement·scope 리뷰어 중복 지적) | `codebase/backend/src/modules/folders/folders.controller.ts:35,114` | 코드는 유지. plan 문서에 이 캐스트 제거 1건을 한 줄 추가하면 서술이 완전해짐(선택 사항) |
| 5 | 테스트 | 회귀 가드(`nullable-type-lie-cast.spec.ts`)는 "증상"(이중 캐스트 재등장, `type:` 누락) 기반이라, 향후 누군가 nullable 타입을 다시 좁혀도 소비 코드가 이미 `??` 등으로 방어하고 있으면 캐스트가 필요 없어 가드가 못 잡는 구조적 한계가 있음 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`findCastOffenders`, `findUntypedNullableColumns`) | 이번 PR 범위 밖. 후속으로 DB 스키마·엔티티 nullable·TS 타입 3자 대조 가드를 별도 축으로 고려 가치 있음 |
| 6 | 테스트 | `folders.controller.spec.ts` 는 `@Roles` 메타데이터만 검증하고 `update()` 핸들러가 `foldersService.update(id, workspaceId, dto)` 를 인자 변형 없이 그대로 호출하는지는 직접 단언하지 않음(선재 갭, 캐스트 제거로 리스크 근소 증가) | `codebase/backend/src/modules/folders/folders.controller.spec.ts` | 낮은 우선순위. 필요 시 `foldersService.update` mock 으로 인자 위임 확인 테스트 추가 가능(이번 PR 스코프 밖) |
| 7 | API 계약 | `/api/auth/*` 액션 네임스페이스가 `spec/5-system/2-api-convention.md §2.2` 명명 규칙(RPC-style `{id}` 필수 / `/api/external/*` 예외)에 포섭되지 않는 선재 gap 이 plan 문서에서 재확인됨(이 PR 코드와 무관, developer 가 "권한 밖"으로 표시하고 planner 턴 후속으로 이관) | `plan/in-progress/entity-nullable-column-type-mismatch.md` §"할 일" | 별도 조치 불요 — 이미 추적 중, planner 턴에서 `2-api-convention.md §2.2` 반영 여부만 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 취약점 없음. `FoldersController.update()` 캐스트 제거도 전역 `whitelist:true` 파이프로 mass-assignment 위험 없음 확인 |
| requirement | LOW | spec(`1-data-model.md`)·마이그레이션(V001)·tsc(197/197)·가드(12/12)·folders 유닛테스트(20/20) 전부 일치 확인. `AuthConfigDto` gap 은 이미 plan 추적 |
| scope | NONE | 10개 파일 전부 plan 배치 3 범위와 정확히 대응, 무관한 리팩토링·기능 확장 없음 |
| side_effect | LOW | `AuthConfigDto.ipWhitelist` 비대칭 재확인(선재) 외 전역상태·소비처 null 처리·baseline 갱신 전부 정상 |
| maintainability | NONE | 코드 품질 문제 없음. plan 문서 문장 접합부 가독성만 INFO |
| testing | LOW | 가드 설계 우수(격리·대조군). 구조적 한계·선재 테스트 갭은 INFO 수준 |
| documentation | LOW | spec/마이그레이션/형제 엔티티 인용 전부 직접 대조해 정확함 확인. plan 체크박스·CHANGELOG 누락은 저강도 |
| database | NONE | 넓힌 8필드 전부 마이그레이션과 nullable 일치, `synchronize:false`로 스키마 리스크 없음 |
| api_contract | LOW (WARNING 1건 포함) | `AuthConfigDto.ipWhitelist` nullable Swagger 불일치 — 실재하는 선재 API 계약 결함, plan 에 스코프아웃 기록됨. 그 외 breaking change 없음 |

## 발견 없는 에이전트

없음 — 9개 에이전트 전원 최소 INFO 수준 이상의 관찰(대부분 "문제 없음 확인" 성격)을 보고함.

## 권장 조치사항

1. (선택, WARNING) `AuthConfigDto.ipWhitelist` 를 `ipWhitelist?: string[] | null` + `@ApiPropertyOptional({ nullable: true })` 로 정정 — 이 PR 범위는 아니나 plan 의 후속 트랙이 실제로 승격되는지 확인.
2. (선택) plan 문서의 "tsc 비-spec 오류 0 확인" 체크박스를 실제 충족 상태(`[x]`)로 갱신하거나 반복 규칙임을 명시.
3. (선택) `folders.controller.ts` 캐스트 제거 1건을 plan 배치 3 서술에 추가해 코드-문서 완전 정합.
4. (선택) CHANGELOG.md 미갱신이 의도적 판단(내부 타입 리팩터는 비대상)인지 plan 에 근거 한 줄 기록.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 프롬프트에 개별 사유 미제공 — diff 가 순수 TS 타입 어노테이션 변경으로 쿼리/알고리즘 변화 없어 판단된 것으로 추정 |
  | architecture | 상동 — 모듈 경계·의존 구조 변경 없음 |
  | dependency | 상동 — 신규 패키지/버전 변경 없음 |
  | concurrency | 상동 — 트랜잭션·동시성 로직 변경 없음 |
  | user_guide_sync | 상동 — 사용자 대면 문서·UI 텍스트 변경 없음 |