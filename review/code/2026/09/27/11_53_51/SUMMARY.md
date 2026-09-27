# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(DRY 관용구 복제 확산 예정, 트래커 문서 댕글링 링크) 모두 병합을 막을 사유는 아니며 forced 화이트리스트(7명) 전원 결과가 확보되어 있어 누락으로 인한 거짓 저위험 판정은 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | "보내지 않은 필드 제외 후 `Object.assign`" 관용구(코드+장문 rationale 주석)가 `triggers.service.ts`에 이어 두 번째로 통째 복제됐고, plan 상 `workflows.service.ts`·`nodes.service.ts`·`auth-configs.service.ts` 3곳에 같은 관용구 적용이 예정돼 있어 5곳 동기화 부채가 쌓이는 중 | `codebase/backend/src/modules/folders/folders.service.ts:72-80` (기존 사본: `codebase/backend/src/modules/triggers/triggers.service.ts:618-626`) | `omitUndefinedFields<T>()` 같은 공용 헬퍼를 `src/shared/`(또는 `src/common/`)에 추출해 rationale 을 한 곳에만 적고, 각 `update()`는 그 헬퍼 호출 한 줄로 축소. 세 번째 사본이 생기기 전(다음 PR)에 추출 권장 |
| 2 | 문서화 | 트래커 문서가 아직 `plan/in-progress/`에 있는 자기 자신의 plan(`folders-contract-e2e.md`, 체크리스트 `/ai-review`·`--impl-done` 미체크)을 `plan/complete/folders-contract-e2e.md`로 이미 이관된 것처럼 앞당겨 인용 — 해당 경로는 저장소에 존재하지 않음(확인함) | `plan/in-progress/spec-draft-nullable-notation-followups.md:1396` | push 전에 마무리 커밋(plan 이관+체크박스 완료)이 실제로 일어났는지 확인. 아직이면 이 줄을 현재 경로(`plan/in-progress/…`)로 고치거나 "닫히면 `plan/complete/`로 이동 예정" 식 잠정 표현으로 수정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / API 계약 | `update()`의 `Object.assign(folder, defined)`은 키 화이트리스트 없이 `data`의 모든 own-property 를 병합 — 현재는 컨트롤러가 타입 있는 `UpdateFolderDto`로만 호출하고 전역 `CustomValidationPipe`(whitelist+forbidNonWhitelisted)가 방어해 새 공격면은 아니지만, 이 관용구를 재사용하는 후속 PR에서 인라인 객체 타입 파라미터로 호출되면 방어가 없다 | `codebase/backend/src/modules/folders/folders.service.ts:63, 77-80` | 후속 PR(`workflows`/`nodes`/`auth-configs` service)에서 같은 관용구 적용 시 그 컨트롤러의 `@Body()` 파라미터가 타입 있는 DTO 클래스인지 확인하는 항목을 뮤턴트 표에 추가 |
| 2 | 보안 / API 계약 | `FoldersService`가 `FolderDto` 매핑 없이 TypeORM `Folder` 엔티티를 그대로 반환(entity passthrough) — 이번 PR 이전부터 있던 구조이며 `relations`/`eager` 미사용으로 현재 유출은 없음. 이미 별도 tracker(`review/consistency/2026/09/27/10_39_26/convention_compliance.md`)가 추적 중 | `codebase/backend/src/modules/folders/folders.service.ts` 전체 | 조치 불요. `relations` 옵션이 추가되면 즉시 재검토 |
| 3 | API 계약 | `GET /folders`가 페이지네이션 없이 배열을 그대로 반환 — 기존 설계이며 이미 별도 스윕 대상으로 추적 중 | `codebase/backend/src/modules/folders/folders.service.ts:19` | 조치 불요(이미 추적 중) |
| 4 | 부작용 / API 계약 | `FolderDto.parentId`의 OpenAPI 선언이 optional→required(+nullable)로 좁아짐 — 실측(e2e 뮤턴트 M1)상 런타임 응답은 원래도 항상 키를 실었으므로 동작 변경은 아니나, 이 DTO로 codegen 하는 외부 클라이언트가 있다면 재생성 시 타입이 바뀔 수 있음 | `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts:18-21` | 조치 불요(실제 위험 낮음, 문서를 실측에 맞춘 정정) |
| 5 | 범위 | `review/consistency/2026/09/27/10_39_26/**` 산출물과 트래커 문서(`spec-draft-nullable-notation-followups.md`) 갱신이 기능 커밋과 함께 실림 — 저장소 관례(`--impl-prep` 의무 산출물 보관 위치, 선행 커밋 `e20756844`)에 부합하는 기존 관행이라 스코프 위반 아님 | 커밋 `223f2ad5b` 전체 | 조치 불요 |
| 6 | 유지보수성 | 신규 유닛 테스트명이 같은 `describe` 블록 내 다른 10개 테스트(영문 서술)와 달리 한국어 문장으로 작성돼 지역 명명 관례에서 이탈 | `codebase/backend/src/modules/folders/folders.service.spec.ts:117` | 영문 요약으로 통일하거나, 한국어 전환이 팀 결정이면 규약 문서에 명시 |
| 7 | 유지보수성 | 서비스 주석이 `folder-crud.e2e-spec.ts`의 테스트 케이스 라벨("e2e C·E")을 직접 인용 — 두 파일이 독립적으로 드리프트하면(e2e 케이스 재배치) 주석의 인용이 stale 해질 수 있음 | `codebase/backend/src/modules/folders/folders.service.ts:72-76` | 케이스 문자 대신 파일명만 인용하거나, 케이스 문자 변경 시 주석도 함께 갱신하도록 plan 체크리스트에 명시 |
| 8 | 테스트 | 기존 "allows moving to root(parentId null)" 단위 테스트가 `toBeDefined()`만 확인해 `parentId: null` 반영을 값으로 단언하지 않음 — 이 분기의 값 검증은 e2e C 하나에만 있음 | `codebase/backend/src/modules/folders/folders.service.spec.ts:207-219` | `expect(result.parentId).toBeNull()`로 강화해 단위 계층만으로도 회귀를 잡도록 권장(차단 사유 아님) |
| 9 | 테스트 | PATCH 본문이 완전히 빈 객체(`{}`)인 경계 케이스가 단위·e2e 어디에도 없음 | `codebase/backend/src/modules/folders/folders.service.ts:72-80` | 도달 가능하면 `update(id, ws, {})`가 기존 값을 그대로 반환하는 테스트 1개 추가, 컨트롤러 DTO 검증이 빈 본문을 막는다면 주석으로 명시 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | mass-assignment 유사 패턴·entity passthrough 모두 기존 whitelist/무유출로 방어됨. CRITICAL/WARNING 없음 |
| requirement | NONE | 핵심 로직(`update()` undefined 필터링, DTO §5.4 정합)이 spec·plan 서술과 line-level 일치. 댕글링 plan 링크(WARNING #2 와 동일 건, INFO 로 중복 지적)만 발견 |
| scope | NONE | diff 17개 파일 전부가 plan 방향과 1:1 대응, 스코프 이탈·의도 밖 리팩토링 없음 |
| side_effect | LOW | DTO 계약 좁힘·`update()` 병합 semantics 변경 모두 의도된 수정이며 뮤턴트 표로 뒷받침됨 |
| maintainability | LOW | `Object.assign` 관용구 복제 확산(WARNING #1), 테스트 명명·주석 인용 드리프트(INFO 2건) |
| testing | LOW | 결함 재현 회귀 테스트 견고(단위+e2e+DTO 캐너리 3계층 분리), 기존 테스트 값 검증 미흡·빈 본문 경계값 갭(INFO 2건) |
| documentation | LOW | 인라인 rationale 주석·CHANGELOG 전반 우수, 트래커 문서 댕글링 plan/complete 링크(WARNING #2) |
| api_contract | LOW | PATCH 부분 갱신 시맨틱 수정이 REST 계약과 정확히 일치, breaking change 없음. 기존 이슈(entity passthrough, 비페이징) 참고 INFO만 |

## 발견 없는 에이전트

해당 없음 — 8개 reviewer 전원이 최소 INFO 이상을 보고했다(순수 "문제 없음" 판정만 낸 에이전트는 없음).

## 권장 조치사항

1. (권장, 비차단) `plan/in-progress/spec-draft-nullable-notation-followups.md:1396`의 `plan/complete/folders-contract-e2e.md` 인용을 push 전에 실제 이관 상태와 대조 — 마무리 커밋(plan 이관+체크박스 완료) 순서를 맞춘다.
2. (권장, 비차단) `Object.assign(folder, undefined-필터링)` 관용구가 다음 PR(`workflows`/`nodes`/`auth-configs` service)로 세 번째 사본이 생기기 전에 공용 헬퍼(`omitUndefinedFields`)로 추출.
3. (선택) `folders.service.spec.ts`의 "allows moving to root" 테스트를 `expect(result.parentId).toBeNull()`로 강화, 빈 PATCH 본문(`{}`) 경계 테스트 1개 추가.
4. (선택) 신규 유닛 테스트명을 같은 블록의 영문 명명 관례에 맞추고, 서비스 주석의 e2e 케이스 라벨 인용을 파일명 인용으로 완화.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨(누락 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단: 이번 diff(폴더 CRUD 서비스/DTO/테스트)와 성능 특성 변경 관련성 낮음 |
  | architecture | router 판단: 모듈 구조·계층 설계 변경 없음(기존 서비스 메서드 내부 로직 수정) |
  | dependency | router 판단: 신규/변경 의존성 없음 |
  | database | router 판단: 스키마·마이그레이션·쿼리 구조 변경 없음 |
  | concurrency | router 판단: 동시성 제어 경로(락·트랜잭션) 변경 없음 |
  | user_guide_sync | router 판단: 최종 사용자 가이드 문서 대상 변경 없음(백엔드 API 응답 정확성 수정) |