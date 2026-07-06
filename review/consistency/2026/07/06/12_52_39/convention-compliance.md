# 정식 규약 준수 검토 — schedule triggerId 필터 (commit 5b52b8b96)

대상: `spec/2-navigation/3-schedule.md` §2.1/§4/Rationale 변경 + 대응 코드
(`codebase/backend/src/modules/schedules/dto/query-schedule.dto.ts`,
`schedules.controller.ts`, `schedules.service.ts`, FE `page.tsx`/`schedules.ts`/i18n)

검토 기준: `spec/conventions/swagger.md`, `spec/conventions/spec-impl-evidence.md`,
`spec/5-system/2-api-convention.md` §4.1/§4.2

---

## 발견사항

### [INFO] QueryScheduleDto.triggerId 에 `example` 미기재
- target 위치: `codebase/backend/src/modules/schedules/dto/query-schedule.dto.ts` (신규, diff 전체)
- 위반 규약: `spec/conventions/swagger.md` §1-2("예시가 필요한 경우 `@ApiProperty` 추가 보강") / §5-4 체크리스트("DTO 필드에 JSDoc + 필요 시 `@ApiProperty` (enum/example/format/nullable)")
- 상세: 동일 저장소 내 비교 대상인 `QueryTriggerDto`(`codebase/backend/src/modules/triggers/dto/query-trigger.dto.ts`)의 `type`/`status`/`interactionEnabled` 필드는 모두 `example` 을 포함하는데, 신설 `triggerId` 는 `description` + `format: 'uuid'` 만 있고 `example` 이 없다. Swagger UI 에서 UUID 필터 파라미터에 example 값을 넣는 것은 리포 전역에 이미 확립된 관례(예: `@ApiParam({ format: 'uuid' })` 케이스들도 통상 example 동반)라 이 필드만 예외적으로 빠져 있다.
- 제안: `@ApiPropertyOptional({ description: '...', format: 'uuid', example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })` 형태로 example 한 줄 추가. CRITICAL/WARNING 아님 — 순수 형식 일관성이라 INFO.

---

## 항목별 확인 결과 (문제 없음)

1. **§4 API 표 쿼리 파라미터 서술 형식** — `api-convention.md` §4.1(공통 페이지네이션 파라미터)과 §4.2(리소스별 추가 필터, `GET /api/triggers?type=webhook&status=active` 예시)의 구분을 그대로 따름. schedule spec 의 `triggerId` 서술("쿼리: page, limit, search, sort, order, `triggerId`"... "`triggerId`(UUID, optional)는 ... 사용")은 `2-trigger-list.md` 의 `interactionEnabled` 서술, `1-workflow-list.md` 의 `ownership` 서술과 동형 패턴(backtick 강조 + 별도 문장으로 의미·용도 설명). 규약 위반 없음.

2. **DTO 패턴 자체** — `QueryScheduleDto` 는 JSDoc(클래스·필드 모두) + `@ApiPropertyOptional({ description, format: 'uuid' })` + `@IsOptional() @IsUUID()` 로 swagger.md §1-1/§1-3/§2-3 규칙을 만족. 컨트롤러가 `QueryScheduleDto` 를 `@Query()` 로 받으므로 `@ApiQuery` 데코레이터 생략은 §2-3 "쿼리 DTO를 사용하면 `@ApiQuery`를 생략해도 CLI 플러그인이 자동으로 문서화" 규정과 일치 — 신규 위반 아님.

3. **spec-impl-evidence 정합** — `spec/2-navigation/3-schedule.md` frontmatter 는 `status: implemented` 이고 `code:` 에 이미 `codebase/backend/src/modules/schedules/dto/**` 글로브가 포함되어 있어, 신설 `query-schedule.dto.ts` 가 이 글로브에 자동 매치된다(추가 frontmatter 갱신 불필요, 실제 파일 존재 확인 완료). `spec-code-paths.test.ts` 조건(≥1 매치) 및 `spec-status-lifecycle.test.ts` 조건 모두 충족.

4. **frontmatter `code:` 커버리지 재확인** — `ls codebase/backend/src/modules/schedules/dto/` 결과 `query-schedule.dto.ts` 실존 확인. 별도 frontmatter 수정 불필요, diff 에도 frontmatter 변경 없음(의도적으로 글로브가 이미 포괄).

5. **앵커 링크 무결성** — `[트리거 목록](./2-trigger-list.md#21-트리거-목록-항목)`, `[trigger-list §2.3](./2-trigger-list.md#23-트리거-상세-패널-항목-클릭-시)`, `[API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답)` 모두 대상 파일에 해당 heading 실존 확인(`grep -n "^#"` 대조). 신규/변경 링크 없음(§4 표 본문 텍스트만 갱신, 링크 타깃 불변).

6. **i18n schedules.deepLink.* ko/en parity** — `ko/schedules.ts` 에 `deepLink: { filteredNotice, showAll }`, `en/schedules.ts` 에 동일 키 구조 존재. `Dict` 타입이 `typeof ko` 기반이라 en 이 그 타입을 만족해야 하며 `tsc --noEmit` 결과 관련 타입 에러 없음. parity 문제 없음.

7. **vitest 재확인** (cwd=`codebase/frontend`):
   - `spec-link-integrity` + `spec-status-lifecycle`: 2 files / 161 tests 전부 pass
   - 추가로 `spec-code-paths` + `spec-frontmatter` + `spec-area-index`: 4 files / 805 tests 전부 pass

---

## 요약

신설 `triggerId` 쿼리 필터는 API 문서 규약(swagger.md DTO 패턴, api-convention.md §4.1/§4.2 서술 구분) 을 리포에 이미 확립된 유사 필터(`interactionEnabled`, `ownership`) 선례와 동형으로 잘 따르고 있으며, spec frontmatter 의 기존 `dto/**` 글로브가 신규 DTO 파일을 자동 포괄해 spec-impl-evidence 요건(코드+spec 동반, status:implemented 하 `code:` 매치 의무)을 그대로 만족한다. 앵커 링크·i18n parity 도 이상 없이 확인됐고 관련 build-time 가드(vitest)도 전부 통과했다. 유일한 지적 사항은 `triggerId` 필드에 `example` 값이 빠진 사소한 형식 일관성 이슈(INFO)뿐이다.

## 위험도

**LOW**

Critical 없음 — BLOCK 아님.
