# 요구사항(Requirement) 리뷰 — `AlertRuleDto.threshold` wire 타입 정정 + numeric 계약 가드 (3라운드 누적)

## 범위 확정

`git diff --stat origin/main...HEAD` (4커밋: `a65a4f85e` fix → `5a7de8ab1` test →
`dc83c0312` docs → `c15489e61` fix(regex→AST))로 확인한 실질 변경은 5개 파일이다:

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
   `AlertRuleDto.threshold: number → string`
2. `CHANGELOG.md` — 위 정정을 서술하는 신규 Unreleased 항목
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` —
   `findNumericAsNumber` 신설(제3의 계약 검증 축), 최초 정규식 구현을 AST 로 교체
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의
   저장소 전수 테스트 + 대조군(4형태 위음성 캐너리 포함)
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신

나머지 33개 파일(`review/code/.../19_43_18/*`, `review/code/.../20_16_17/*`,
`review/consistency/.../20_05_42/*`)은 이전 두 라운드의 코드/일관성 리뷰 산출물이 신규
파일로 커밋된 것으로, 그 자체가 이번 요구사항 검토 대상 코드는 아니다. 다만 그 안의 실측
주장들이 **지금 시점의 저장소 상태와 여전히 일치하는지**는 아래에서 독립 재검증했다.

## 독립 재검증 (저장소를 직접 열어 확인, 뮤테이션 없음)

- `alert-rule.entity.ts:34-35` — `@Column({ type: 'numeric', precision: 12, scale: 4 }) threshold: string;` 확인.
- `alerts.controller.ts` — `list()`(`@Get()`)/`create()`(`@Post()`)/`update()`(`@Patch(':id')`) 세 핸들러 모두 반환 타입 애노테이션 없음, `AlertsService`가 엔티티(`Promise<AlertRule[]>`/`Promise<AlertRule>`)를 그대로 반환. `alerts.service.ts:30,53` 에서 `String(dto.threshold)` 저장 확인.
- `main.ts:217` `app.setGlobalPrefix('api')` — CHANGELOG 의 `GET /api/alerts` 엔드포인트 경로 표기가 실제 라우트(`@Controller('alerts')` + `@Get()`)와 정확히 일치함을 확인(`/api/alerts/rules` 아님).
- `codebase/frontend/src/lib/api/alerts.ts:6-16` — `AlertRule.threshold: string`(읽기) / `CreateAlertRulePayload.threshold: number`(쓰기) 손수 분리 확인.
- `plan/.../spec-draft-nullable-notation-followups.md` — 분류 표가 `46 + 6 + 4 + 3 = 59` 로 이미 정정되어 있고 본문 "불일치 59건" 과 합치함(직전 라운드 W4 재검증 통과).
- `spec/conventions/swagger.md` — `numeric`/`decimal` grep 0건. plan 체크리스트가 "아직 미완료"로 정확히 반영 중(허위로 done 처리되지 않음).
- `spec/1-data-model.md:873` — 여전히 `threshold | Float` 로 라벨링(`NUMERIC(12,4)` 각주 있음). 코드/wire 는 `string` 이므로 라벨 불일치가 남아 있으나, 이 diff 범위 밖이고 plan 에 planner 트랙 항목으로 이미 등재돼 있어 이번 PR 의 새 결함은 아니다.
- 저장소 전체에서 `numeric`/`decimal` `@Column` 은 정확히 2곳(`alert_rule.threshold`, `llm_usage_log.cost_usd`) — RESOLUTION.md 의 "저장소의 numeric 컬럼은 둘뿐" 주장과 일치. `llm_usage_log.cost_usd` 는 `statistics.service.ts` 가 `SUM(...)::float` + `Number(...)` 로 명시 변환해 `costUsd?: number | null` 노출이 정확함을 확인 — `findNumericAsNumber` 가 `<Entity>Dto` 이름 관례 밖(`LlmUsageLogDto` 없음)이라 검사하지 않는 것도 의도된 스코프대로 동작.
- `npx jest src/repo-guards/__tests__/swagger-dto-contract.spec.ts` 실행 — **29 passed, 29 total** (신규 axis 관련 테스트 포함 전부 GREEN).

세 라운드(`19_43_18` → `20_16_17` → 이번)에 걸쳐 지적된 WARNING(회귀 테스트 부재·영향범위
서술 축소·codegen 고지 누락·plan 산술 불일치·정규식 위음성 4형태·경로 대소문자 정규화·
`<Entity>Dto` 명명 한계)이 전부 코드/문서 양쪽에서 실제로 닫혔음을 위 재확인으로 뒷받침한다.

## 발견사항

- **[WARNING]** `collectNumericFields` 가 TypeORM `@Column` 의 **포지셔널 타입 인자 형태**(`@Column('numeric', { precision: 12, scale: 4 })`)를 인식하지 못한다 — 오브젝트 리터럴 안의 `type:` 프로퍼티만 본다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 함수 `readStringOption`(그 소비처 `collectNumericFields`)
  - 상세: TypeORM `@Column` 데코레이터는 `Column(type?: ColumnType, options?: ColumnOptions)` 시그니처도 지원한다(`@Column('numeric', { precision: 12, scale: 4 })`). `readStringOption` 은 `call.arguments` 를 순회하며 `ts.isObjectLiteralExpression(arg)` 인 인자 안의 `key: value` 프로퍼티만 읽으므로, 첫 인자가 문자열 리터럴(포지셔널 `type`)인 형태는 `type` 값을 아예 못 읽는다 — 그 필드는 조용히 "numeric 아님" 으로 분류돼 `findNumericAsNumber` 축이 못 본다. 이 축이 존재하는 이유 자체가 "정규식이 세 형태를 놓쳤다 → AST 로 갔더니 또 네 형태를 놓쳤다"는 반복된 위음성 이력이고(같은 파일 상단·`collectNumericFields` docstring이 이 반성을 명시), 새 술어의 소스 리더(`readStringOption`)가 딱 이 형태 하나를 다시 놓친다. 현재 저장소에는 포지셔널 `@Column(type, ...)` 형태 사용처가 0건(grep 확인: 모든 `@Column(` 호출이 `@Column({`)이라 실질 오탐/누락은 없다 — 하지만 이 가드의 존재 목적이 "미래에 조용히 재발하는 것"을 막는 것이므로, 이 형태를 미검증 상태로 남기면 다음 엔티티가 이 스타일을 쓸 때 같은 결함 클래스가 세 번째로 재발한다.
  - 제안: `readStringOption` 또는 `collectNumericFields` 에 첫 인자가 문자열 리터럴인 경우도 `type` 값으로 읽는 분기를 추가하고, `swagger-dto-contract.spec.ts` 의 "정규식이 놓쳤던 네 형태" `it.each` 목록에 포지셔널 타입 인자 형태를 다섯 번째 대조군으로 추가해 회귀를 고정한다. 최소한 `collectNumericFields` docstring 의 "알려진 한계" 목록에 명시라도 남긴다(현재는 `<Entity>Dto` 명명 관례 한계만 문서화돼 있음).

- **[INFO]** `spec/1-data-model.md:873` 의 `threshold | Float` 라벨이 이번 정정으로 명확해진 "wire·엔티티는 string" 사실과 여전히 어긋난다
  - 위치: `spec/1-data-model.md:873`
  - 상세: 이 diff 범위 밖(파일 미변경)이고 새로 만든 결함이 아니다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 항목으로 이미 정확히 등재돼 있음을 확인했다(중복 등재 아님, 상태도 미완료로 정확).
  - 제안: 조치 불요 — planner 트랙에서 처리.

## 그 외 확인된 사항 (결함 아님)

- TODO/FIXME/HACK/XXX 없음(대상 4개 코드/테스트 파일 전수 grep).
- `AlertRuleDto` 필드 타입 변경은 엔티티·DB 컬럼·서비스 저장 로직·프런트엔드 소비 코드·CHANGELOG 서술 전부와 line-level 로 정합. 런타임 wire 불변(`ClassSerializerInterceptor` 부재, 컨트롤러가 엔티티를 직접 반환).
- 쓰기 DTO(`CreateAlertRuleDto.threshold: number`)는 이번 diff 대상이 아니며 읽기/쓰기 비대칭이 의도적으로 유지됨 — spec §6.3 서술과 계속 일치.
- `findNumericAsNumber` 의 `<Entity>Dto` 이름 관례 의존은 이미 문서화·테스트(`[알려진 한계]` 케이스)된 의도적 스코프 축소이며, 현재 실질 갭 없음(`LlmUsageLogDto` 부재, `StatisticsResponseDto` 는 명시 변환으로 무해).
- 동명 클래스 충돌(`dtoFields`/`numericFields` 를 클래스명으로 덮어쓰는 잠재 위험)은 이전 라운드가 이미 I3 로 식별하고 현재 중복 0건으로 의도적 유예 처리했음을 확인 — 재지적 대상 아님.

## 요약

핵심 코드 변경(`AlertRuleDto.threshold: number → string` + `findNumericAsNumber` 회귀 가드)은 엔티티·DB 컬럼(`NUMERIC(12,4)`)·서비스 저장 로직·프런트엔드 기존 소비 패턴과 전수 재대조로 정합함을 직접 확인했고, 이전 두 라운드가 지적한 WARNING 전부(회귀 테스트 부재·영향범위 축소 서술·codegen 고지 누락·plan 산술 불일치·정규식 위음성 4형태·경로 정규화)가 실제로 닫혔다(테스트 29건 GREEN 재확인). 유일한 신규 발견은 새 가드의 `readStringOption` 이 TypeORM `@Column` 의 포지셔널 타입 인자 형태를 인식하지 못하는 구조적 위음성 축인데, 현재 저장소에 해당 형태 사용처가 0건이라 실질 오탐/누락은 없다 — 다만 이 가드의 존재 이유 자체가 "같은 반복된 위음성 패턴"을 막는 것이므로 회귀 대조군으로 고정해 둘 가치가 있다. `spec/1-data-model.md:873` 의 `Float` 라벨 불일치는 이미 planner 트랙에 정확히 등재된 기존 이슈로 새 결함이 아니다.

## 위험도

LOW
