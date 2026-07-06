# Requirement Review — 트리거→스케줄 딥링크 cross-page (서버 triggerId 필터 + FE)

- 대상 커밋: `5b52b8b96` (worktree `schedules-triggerid-filter-29c135`, diff `origin/main...HEAD`)
- 관련 spec: `spec/2-navigation/3-schedule.md` §2.1 inbound `?triggerId=` 딥링크 서술, §4 API 표, 말미 Rationale(schedule→trigger vs trigger→schedule 비대칭)

## 발견사항

- **[INFO]** calendar 뷰는 `?triggerId=` 서버 필터를 적용하지 않음(list 전용)
  - 위치: `codebase/frontend/src/app/(main)/schedules/page.tsx:534-541` (`calendarSchedulesQuery` 는 `focusTriggerId` 를 쓰지 않고 `limit: 200` 무필터 조회), `:972` (필터 안내 배너도 `viewMode === "list"` 조건)
  - 상세: 딥링크로 진입해 사용자가 뷰 토글을 "캘린더"로 바꾸면 필터 안내 배너가 사라지고 전체 워크스페이스 스케줄이 무필터로 보인다. spec §2.1 본문은 list/calendar 구분 없이 "목록"이라고만 서술하며 calendar 뷰 자체를 언급하지 않는다 — 회색지대.
  - 제안: 현재 구현이 spec 을 위반하는 것은 아니므로 조치 불필요. 다만 후속으로 calendar 진입 시에도 배너를 유지하거나 뷰 전환을 막는 정책을 원한다면 planner 결정 필요(코드 버그 아님).

- **[INFO]** 딥링크 대상 UUID 가 0건으로 매칭되는(서버가 실제로 빈 배열 반환하는) 케이스에 대한 전용 프론트 테스트 부재
  - 위치: `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx:618-625` ("highlights no row when ?triggerId= matches no schedule on the page")
  - 상세: 이 테스트는 서버가 여전히 1건(`focusRow()`)을 반환하되 그 triggerId 가 다른 케이스만 커버한다. 요청된 엣지케이스(1) "서버가 실제로 빈 배열을 반환할 때 EmptyState + 해제 배너가 함께 보이는지"는 코드 상으로는 만족한다 — `page.tsx:972`(배너, `focusTriggerId && viewMode==="list"` 조건, `schedules.length` 무관)와 `:999`(`EmptyState`, `schedules.length === 0` 조건)가 독립적으로 병렬 렌더되므로 dead-end 는 발생하지 않는다. 다만 이를 직접 검증하는 테스트(빈 `data:[]` mock + 배너와 EmptyState 동시 assert)가 없어 향후 회귀(예: 두 블록이 상호배타 조건으로 잘못 리팩터링)를 잡아줄 안전망이 비어 있다.
  - 제안: `EMPTY_RESPONSE` + `currentSearchParams = new URLSearchParams("triggerId=t1")` 조합으로 "배너 노출 && EmptyState 노출" 을 동시에 단언하는 케이스 1개 추가 권장(비차단, 커버리지 보강).

- **[INFO]** `?triggerId=` 에 비-UUID 값이 들어오면 서버가 `400 VALIDATION_ERROR` 를 반환(실사용 경로 아님, URL 직접 조작 시)
  - 위치: `codebase/backend/src/modules/schedules/dto/query-schedule.dto.ts:20-22` (`@IsUUID()`), FE `page.tsx:993-997` (`isError` 시 `schedules.loadFailed` 텍스트)
  - 상세: trigger-list 의 "스케줄 관리에서 편집" 링크는 항상 실제 트리거 UUID 를 심으므로 정상 경로에서는 발생하지 않는다. 사용자가 URL 을 직접 편집해 비-UUID 문자열을 넣으면 400 이 나고, FE 는 `isError` 분기로 에러 텍스트를 보여준다. 이때도 필터 해제 배너(`:972`)는 `focusTriggerId` 존재만으로 독립 렌더되어 계속 보이므로 "전체 스케줄 보기" 로 탈출 가능 — dead-end 아님.
  - 제안: 조치 불필요. spec 이 이 엣지케이스를 명시하지 않으므로 회색지대로 판단.

- **[INFO]** 신규 `triggerId` 쿼리 필터에 대한 e2e 커버리지 부재(unit 만 존재)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:150-186` (mock QueryBuilder 기반 unit), `codebase/backend/test/schedule-trigger.e2e-spec.ts` (기존 e2e 는 `?triggerId=` GET 목록 필터를 검증하지 않음)
  - 상세: unit 테스트는 `andWhere('t.id = :triggerId', …)` 호출 여부만 mock 으로 검증하며, 실제 DB 상에서 `leftJoinAndSelect('s.trigger', 't')` 별칭과 `WHERE t.id = :triggerId` 가 실행 가능한 SQL 인지, `ValidationPipe`(`whitelist+forbidNonWhitelisted`) 파이프라인 통과 여부는 실증되지 않는다. 다만 동일한 `t.` 별칭 패턴이 기존 `search` 필터에서 이미 실사용 중이라 리스크는 낮다.
  - 제안: 비차단. 여유 있으면 `schedule-trigger.e2e-spec.ts` 에 `?triggerId=` 케이스 1개 추가 권장.

## 확인된 정합 사항 (결함 아님, 참고용)

- **서버 필터 로직**: `schedules.service.ts:83-85` `if (triggerId) qb.andWhere('t.id = :triggerId', …)` — 연결 트리거 없는 스케줄은 `leftJoinAndSelect` 로 `t.id` 가 NULL 이 되어 자연히 제외됨(주석과 실제 SQL 동작 일치). `count`/`getMany` 양쪽 모두 동일 `qb` 체인이라 페이지네이션 total 도 필터링된 값 기준으로 계산됨 — cross-page 요구사항(spec: "서버 필터라 대상 스케줄이 몇 번째 페이지에 있든 항상 찾으며") 정합.
- **강조(highlight)와 서버 필터 결합 모순 없음**: `page.tsx:1033-1034` `isFocused = !!focusTriggerId && schedule.triggerId === focusTriggerId`. 서버가 이미 `triggerId` 로 필터링해 반환하므로 반환되는 모든 행은 이론상 `schedule.triggerId === focusTriggerId` 를 만족 — 즉 필터 적용 시 반환된 모든 행이 강조 대상이 되는 게 맞고, 코드가 이를 정확히 재현한다(다른 트리거 행이 섞여 나오는 모순 없음). `scrolledFocusRef` 로 최초 1회만 스크롤(§2.1 "한 번 스크롤" 요구사항과 일치).
- **FE 빈 값 미전송 ↔ BE optional 계약 일치**: FE `page.tsx:523` `...(focusTriggerId ? { triggerId: focusTriggerId } : {})` 로 `triggerId` 가 없으면 쿼리 파라미터 자체를 만들지 않음(`undefined` 전달이 아니라 키 자체 부재) → axios 가 아예 전송하지 않음. BE DTO `@IsOptional() @IsUUID() triggerId?: string` 와 계약 일치. 빈 문자열(`?triggerId=`) 케이스는 `!!focusTriggerId` 가드로 FE 하이라이트 로직에서 오매칭을 막고(`schedules-page.test.tsx:635-656`), 이 경우 실제로는 `triggerId=""` 가 axios params 로 전달돼 BE `@IsUUID()` 가 400 을 반환할 잠재적 케이스지만, 실사용 경로(trigger-list 딥링크)에서는 항상 유효 UUID 만 심겨 발생하지 않는다.
- **spec ↔ 구현 일치**: §2.1 신설 서술의 4대 요소(서버측 triggerId 필터로 cross-page / 행 강조·스크롤 / "전체 스케줄 보기" 해제 링크 / 편집 자동오픈 안 함) 모두 코드에 1:1 대응. §4 API 표의 `triggerId`(UUID, optional) 서술과 `QueryScheduleDto` 시그니처 일치. Rationale 말미 갱신문(cross-page 성립 근거)도 실제 구현(서버 WHERE 필터)과 부합. SPEC-DRIFT 없음 — 이번 변경은 spec 이 먼저 갱신되고(§2.1/§4/Rationale) 코드가 그에 맞춰 구현된 정상 SDD 흐름.
- **함수/DTO 네이밍**: `QueryScheduleDto`, `resolveOrderBy` 등 기존 컨벤션과 일관. 컨트롤러 시그니처 `@Query() query: QueryScheduleDto` 변경이 `PaginationQueryDto` 상속 구조를 그대로 확장(breaking change 없음).

## 요약

서버측 `triggerId` 필터(`QueryScheduleDto` + `SchedulesService.findAll`)와 프론트(`page.tsx` 필터 배너·강조·스크롤·해제 링크)가 spec §2.1/§4/Rationale 갱신 내용과 line-level 로 정확히 일치한다. 요청된 4개 엣지케이스 중 (1) 빈 결과 시 EmptyState+해제 배너 동시 노출은 두 렌더 블록이 독립 조건이라 dead-end 없이 충족되며(전용 테스트만 없음), (2) calendar 뷰 미적용은 spec 이 침묵하는 회색지대, (3) highlight-서버필터 결합은 서버가 이미 필터링해 반환하므로 모순 없이 항상 정합, (4) FE 빈 값 미전송↔BE optional 계약은 키 자체를 안 보내는 방식으로 정확히 맞물린다. 발견된 항목은 전부 INFO(커버리지 보강 제안)이며 CRITICAL/WARNING 도출 없음, SPEC-DRIFT 도 없음(spec 선갱신 후 구현이 뒤따른 정상 흐름).

## 위험도

NONE
