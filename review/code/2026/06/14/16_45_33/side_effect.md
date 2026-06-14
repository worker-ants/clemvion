# 부작용(Side Effect) Review

## 발견사항

### [INFO] `@ApiProperty` 데코레이터 메타데이터 변경 — 런타임 Swagger 스키마 출력 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-602-followup/codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — `AuthConfigUsagePeriodCountsDto` 세 필드, `AuthConfigUsageCallDto.sourceIp`, `AuthConfigUsageCallDto.responseCode`
- 상세: `@ApiProperty({ type: Number })` / `@ApiProperty({ type: String })` 추가와 `description` 한국어 전환은 NestJS Swagger 플러그인이 런타임에 생성하는 OpenAPI JSON 스펙의 내용을 변경한다. `description` 문자열이 영어에서 한국어로 바뀌므로, Swagger UI 출력과 `/api-json` 엔드포인트 응답이 달라진다. 이를 파싱·스냅샷 비교·E2E 검증하는 테스트가 있다면 해당 테스트가 실패할 수 있다. `type` 명시 추가 자체는 기존에 추론에 의존하던 스키마를 명시적으로 고정하므로 추론 결과와 일치하면 무해하지만, 추론 결과가 달랐던 경우(예: `nullable: true` 와 결합된 `type` 미지정 시 Swagger가 `anyOf`를 사용하던 케이스)에는 OpenAPI 문서 구조가 바뀔 수 있다.
- 제안: Swagger JSON 스냅샷 테스트 또는 API 계약 테스트가 있다면 해당 스냅샷을 갱신한다. `type: String` + `nullable: true` 조합의 `sourceIp` 는 기존에 `nullable: true` 만 있던 것에서 변경되므로, 생성된 OpenAPI 스키마가 `{ type: 'string', nullable: true }` 로 정확히 출력되는지 확인이 필요하다.

### [INFO] `description` 언어 전환 — OpenAPI 문서 소비자 영향
- 위치: `AuthConfigUsagePeriodCountsDto.last24h`, `last7d`, `last30d`의 `@ApiProperty.description`
- 상세: 기존 영어 description(`'Rolling 24-hour window count (not calendar day).'` 등)이 한국어(`'최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님).'`)로 교체된다. SDK 자동 생성 도구(openapi-generator 등)가 description 값을 변수명·주석으로 활용한다면, 재생성 시 한국어 문자열이 삽입된다. 코드베이스 내 다른 DTO들이 이미 한국어 description을 사용하고 있다면 일관성 개선이지만, 외부 팀이 영어 description에 의존하는 SDK를 사용하고 있다면 breaking change에 해당한다.
- 제안: 외부 공개 API가 아니고 내부 전용이라면 영향 없음. 외부 소비자가 있다면 description 변경을 changelog에 기록한다.

### [INFO] 리뷰 산출물 파일 생성 — 파일시스템 부작용 (의도된 것)
- 위치: `review/code/2026/06/14/16_34_50/` 하위 여러 파일 (`SUMMARY.md`, `RESOLUTION.md`, `_retry_state.json`, `database.md`, `documentation.md`, `maintainability.md`, `meta.json`, `requirement.md` 등)
- 상세: 이번 diff에 포함된 대다수 파일은 `/ai-review` 워크플로가 의도적으로 생성한 리뷰 산출물이다. 이 파일들은 프로젝트 규약(`CLAUDE.md` §정보 저장 위치)에서 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`에 저장하도록 명시된 의도된 파일시스템 부작용이다. 비의도적 파일시스템 부작용 없음.
- 제안: 해당 없음.

### [INFO] `ExecutionEngineService.execute()` 3번째 인자 — 기존 호출자 하위 호환성 (spec 변경, 코드 미확인)
- 위치: `spec/5-system/12-webhook.md` §7 step 7e, §8 step 8b (이번 diff의 코드 파일에는 직접 포함되지 않음)
- 상세: spec에 `ExecutionEngineService.execute(workflowId, input, { triggerId, sourceIp, responseCode })` 형태로 3번째 인자가 명문화되었다. 이번 diff의 실제 코드 변경은 DTO 메타데이터에 한정되어 있어, `execute()` 시그니처 자체의 변경 코드는 포함되지 않는다. 그러나 RESOLUTION.md의 W-1 조치 내용에 따르면 해당 선언이 `#602`에서 이미 optional로 머지되었다고 기록되어 있다. 이번 리뷰 대상 diff 범위에서는 `ExecutionEngineService` 소스 코드가 포함되지 않으므로 실제 시그니처를 직접 확인할 수 없다. 이전 리뷰(16_34_50)에서 W-1로 경고된 사항이며, RESOLUTION에서 `#602`에서 이미 optional 선언이 완료되었다고 명시하므로 이번 fresh review에서는 회귀 위험이 해소된 것으로 판단한다.
- 제안: 필요 시 `ExecutionEngineService.execute()` 의 실제 TypeScript 시그니처에서 3번째 인자가 optional로 선언되어 있는지 별도 확인.

## 요약

이번 변경의 실질적 코드 변경은 `auth-config-response.dto.ts`의 `@ApiProperty` 데코레이터 메타데이터 보강(type 명시, description 한국어 전환, TSDoc 주석 추가)에 한정된다. 이 변경은 런타임 동작(비즈니스 로직, DB, 네트워크 호출, 이벤트)에는 전혀 영향을 미치지 않으며, Swagger/OpenAPI 문서 생성 출력만 변경한다. 전역 변수 도입, 예상치 못한 파일시스템 변경, 환경 변수 접근, 외부 서비스 호출, 이벤트/콜백 변경은 없다. 유일한 부작용은 OpenAPI JSON 스펙의 `description` 문자열 변경 및 `type` 명시로 인한 스키마 출력 변동이며, Swagger 스냅샷 테스트가 존재한다면 갱신이 필요하다. 나머지 diff 파일들은 모두 의도된 리뷰 산출물(review/ 디렉터리)이다.

## 위험도

NONE

STATUS=success ISSUES=0
