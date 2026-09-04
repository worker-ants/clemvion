# 요구사항(Requirement) 코드 리뷰

## 범위 확정

`git diff --stat origin/main...HEAD` 로 확인한 실질 코드/문서 변경은 6개 파일이다:

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `AlertRuleDto.threshold: number → string`
2. `CHANGELOG.md` — 위 정정을 서술하는 신규 Unreleased 항목
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `findNumericAsNumber`/`scanNumericExposure` 제3의 계약 검증 축 신설
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의 저장소 전수 테스트 + 대조군
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 런타임 계약 e2e
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신

나머지 다수 파일(`review/code/.../19_43_18/*`, `20_16_17/*`, `20_39_25/*`, `review/consistency/.../20_05_42/*`)은 이전 세 라운드의 코드/일관성 리뷰 산출물이 신규 파일로 커밋된 것으로, 이 changeset 자체가 진행해 온 review-fix 루프의 감사 기록이다. 이번 요구사항 검토 대상 코드는 아니지만, 그 안의 실측 주장이 지금 저장소 상태와 일치하는지는 아래에서 독립 재검증했다.

## 독립 재검증 (저장소를 직접 열어 확인, 뮤테이션 없음)

- `alert-rule.entity.ts:34-35` — `@Column({ type: 'numeric', precision: 12, scale: 4 }) threshold: string;` 확인. DTO 예시(`'10.0000'`)가 scale 4와 정합.
- `alerts.controller.ts` — `list()`(`@Get()`)/`create()`(`@Post()`)/`update()`(`@Patch(':id')`) 세 핸들러 모두 반환 타입 애노테이션 없음, `alerts.service.ts` 가 엔티티(`Promise<AlertRule[]>`/`Promise<AlertRule>`)를 그대로 반환. `String(dto.threshold)` 로 저장(`alerts.service.ts:30,53`) — CHANGELOG "세 응답 모두" 서술과 정확히 일치(이전 라운드가 "list() 만" 이라고 축소 서술했던 WARNING 은 이미 정정돼 있음).
- `main.ts:217` `app.setGlobalPrefix('api')` + `@Controller('alerts')` — CHANGELOG·e2e 의 `GET/POST /api/alerts`, `PATCH /api/alerts/:id` 경로 표기가 실제 라우트와 일치(`/api/alerts/rules` 아님).
- `codebase/frontend/src/lib/api/alerts.ts` — `AlertRule.threshold: string`(읽기) / `CreateAlertRulePayload.threshold: number`(쓰기)로 이미 분리돼 있음을 확인. OpenAPI 정정이 프런트엔드 코드 변경을 요구하지 않는다는 주장이 성립.
- `spec/2-navigation/9-user-profile.md:406` — `POST /api/alerts` body 의 `threshold(number, ≥0, ...)` 서술은 **요청** DTO(`CreateAlertRuleDto`, 이 diff 로 불변) 에 대한 것이라 응답 DTO 타입 정정과 충돌하지 않는다. 응답 바디 타입은 이 spec 문서에 별도로 명시돼 있지 않다.
- `spec/5-system/2-api-convention.md` §5.4 — presence/null 축 규칙(`ApiPropertyOptional` = `ApiProperty({required:false})` 별칭 등)이 가드의 `readBooleanOption`/`effectiveRequired` 로직과 line-level 로 일치.
- 저장소 전체 `numeric`/`decimal` `@Column` 은 정확히 2곳(`alert_rule.threshold`, `llm_usage_log.cost_usd`) — 가드 docstring 의 "저장소의 numeric 컬럼은 둘뿐" 주장과 일치. `llm_usage_log.cost_usd` 는 `statistics.service.ts` 가 `SUM(...)::float` + `Number(...)` 로 명시 변환(`:346,376,430,457`)해 `StatisticsResponseDto.costUsd?: number|null` 노출이 실제로 무해함을 확인 — `<Entity>Dto` 이름 관례 밖(`LlmUsageLogDto` 없음)이라 `findNumericAsNumber` 가 검사하지 않는 것도 문서화된 의도된 스코프대로 동작.
- `swagger-dto-contract-guard.ts` 의 `readColumnType`(포지셔널 `@Column('numeric', {...})` vs `type:` 옵션 두 형태 모두 인식)·`scanNumericExposure`(위반 목록 + 스캔 전제 `numericColumns`/`responseDtoClasses` 동시 반환)·`toPosixPath` 정규화가 각각 이전 라운드(`20_16_17` W1/W2/W3, `20_39_25` W1)가 잡은 결함을 실제로 닫은 최종 형태임을 소스 레벨로 확인.
- `swagger-dto-contract.spec.ts` — `[전제]` 테스트 2건(스캔 대상 비어있지 않음/Api* 데코레이터 실재), numeric 축 `[전제]`(`scan.numericColumns`에 두 실컬럼 포함 단언), 정규식이 놓쳤던 4형태 + 포지셔널 2형태 + `<Entity>Dto` 명명 한계 음성 대조군까지 전부 존재. `readColumnType`/`readOption` 제네릭화도 반영됨.
- `test/alerts-threshold-wire-type.e2e-spec.ts` — `registerAndLogin`/`createTeamWorkspace` 헬퍼 시그니처, `X-Workspace-Id` 헤더 관례, `jest-e2e.json` 의 `testRegex: ".e2e-spec.ts$"` 매칭을 모두 확인 — 테스트가 실제로 수집·실행되는 경로에 있다. POST(number 입력)→GET(DB 재조회, `\d+\.\d{4}` 스케일까지 단언)→PATCH 세 응답의 비대칭 의도까지 정확히 반영.
- TODO/FIXME/HACK/XXX — 6개 대상 파일 전수 grep 0건.

세 선행 라운드(`19_43_18` → `20_16_17` → `20_39_25`)에 걸쳐 누적 지적된 WARNING들(회귀 테스트 부재·CHANGELOG 영향범위 축소 서술·codegen 영향 고지 누락·plan 산술 불일치 59 vs 57·정규식 위음성 4형태·포지셔널 `@Column` 인식 누락·경로 정규화·스캔 전제 테스트 부재)이 전부 코드·문서 양쪽에서 실제로 닫혀 있음을 이번 라운드에서 재확인했다. 새로 발견된 결함은 없다.

## 발견사항

- **[INFO]** `spec/1-data-model.md:873` 의 `threshold | Float` 라벨이 이번 정정으로 명확해진 "wire·엔티티는 string" 사실과 여전히 어긋난다
  - 위치: `spec/1-data-model.md:873` (이 diff 의 변경 대상 아님)
  - 상세: 코드/CHANGELOG 는 이제 `threshold` 가 문자열임을 정확히 반영하지만, 데이터 모델 문서는 여전히 `Float` 로 라벨링한다(각주로 `NUMERIC(12,4)` 임은 밝힘). `spec/` 쓰기는 developer 권한 밖이라 이 PR 의 조치 대상이 아니며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 항목으로 정확히 등재돼 있음을 확인했다(허위로 done 처리되지 않음, 중복 등재도 아님).
  - 제안: 조치 불요 — planner 트랙에서 처리. 새 결함이 아니라 선행 라운드가 이미 식별·등재한 항목의 재확인.

- **[INFO]** `numeric`/`decimal` 원시 타입 불변식이 `spec/conventions/swagger.md` 에는 아직 성문화되지 않았다
  - 위치: `spec/conventions/swagger.md` (grep 결과 `numeric`/`decimal` 0건)
  - 상세: `findNumericAsNumber` 가드가 이 불변식을 코드로는 전역 강제하지만, 규약 문서에는 아직 없다. `plan/.../spec-draft-nullable-notation-followups.md` §5.4 체크리스트에 planner 항목(`20_05_42` W2)으로 이미 등재돼 있어 미완료 상태가 정확히 반영되고 있다.
  - 제안: 조치 불요 — planner 트랙에서 처리.

## 그 외 확인된 사항 (결함 아님)

- `AlertRuleDto.threshold` 타입 정정은 엔티티·DB 컬럼(`NUMERIC(12,4)`)·서비스 저장 로직·프런트엔드 기존 소비 패턴·spec 요청 바디 서술 전부와 line-level 로 정합한다.
- 런타임 wire 불변(`ClassSerializerInterceptor` 저장소 전체 0건 확인, 컨트롤러가 엔티티를 직접 반환) — CHANGELOG 의 "wire 는 바뀌지 않는다" 주장이 코드로 뒷받침된다.
- 읽기(`string`)/쓰기(`number`) 비대칭은 의도된 설계이고 spec §6.3 요청 바디 서술과 계속 일치한다.
- 신규 가드 축(`findNumericAsNumber`)은 "미래 재발 차단"이 목적이며 현재 저장소에 위반 0건 — 스캔이 실재 대상을 집었다는 전제(`[전제]` 테스트)까지 별도로 고정돼 있어 `expect([]).toEqual([])` 류의 공허한 통과 위험이 닫혀 있다.
- `<Entity>Dto` 이름 관례 의존이라는 알려진 한계(`StatisticsResponseDto`)는 문서화·음성 대조군 테스트로 고정돼 있고 현재 실질 갭이 없음을 직접 확인했다.

## 요약

핵심 변경(`AlertRuleDto.threshold: number → string` + `findNumericAsNumber` 정적 가드 + `alerts-threshold-wire-type.e2e-spec.ts` 런타임 가드)은 엔티티·DB 컬럼·서비스 계층·프런트엔드 기존 소비자·관련 spec 서술과 전수 재대조로 정합함을 직접 확인했다. 세 선행 리뷰 라운드가 누적 지적한 WARNING(회귀 테스트 부재, CHANGELOG 서술 축소, codegen 영향 고지 누락, plan 산술 불일치, 정규식/AST 위음성 여러 형태, 스캔 전제 테스트 부재)은 전부 소스 레벨로 재확인 결과 닫혀 있으며, 이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다. 남은 항목은 `spec/1-data-model.md`·`spec/conventions/swagger.md` 갱신 두 건뿐이며 둘 다 developer 권한 밖의 planner 트랙 항목으로 정확히 등재돼 있어 이 PR 의 결함이 아니다. TODO/FIXME/HACK/XXX 없음. 저장소 뮤테이션 없이 읽기 전용으로 검증했다(`git status --short` 확인 결과 이번 세션에서 추가된 파일은 이 리뷰의 output 뿐).

## 위험도

NONE
