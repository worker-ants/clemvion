# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-done)

## 검토 범위 확인

- scope(`spec/2-navigation/`) 델타: **0개 파일** — 이번 작업은 spec 문서를 바꾸지 않았다.
- 구현 diff: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 1개 파일 / 153줄 — `SchedulesService.update()` 의 cron/timezone 재계산 게이트에 대한 **단위 테스트 추가**(happy-path 2건 + no-op 대조군 1건 + 공유 fixture 헬퍼 `scheduleRow()`).
- 신규/변경된 API endpoint, DTO, 이벤트 페이로드, 에러 코드, 식별자 명명은 **없음**. 신규 함수는 테스트 파일 내부 헬퍼 `scheduleRow()` 하나뿐이며 외부에 노출되지 않는다.
- `spec/2-navigation/3-schedule.md`(대상 spec 영역 중 이 diff 와 관련된 유일한 문서) 본문에는 `재계산`/`nextRunAt`/`recalc` 관련 서술이 없음을 확인(`grep` 결과 0건) — 즉 이번 테스트는 spec 문서가 명시한 어떤 문장을 "고정"하는 관계가 아니다.

## 발견사항

없음.

검토한 규약 중 이 diff 와 접점이 있는 것은 [`spec/conventions/spec-impl-evidence.md`](../../../../../spec/conventions/spec-impl-evidence.md) 뿐이었다. 이 규약은 `status: implemented`/`partial` spec 의 `code:` 글로브가 실제 파일에 매치할 것을 요구하고(§4 `spec-code-paths.test.ts`), 추가로 "**spec 본문의 註가 특정 테스트 파일을 '이 파일이 이 주장을 고정한다' 고 명시로 지목**하면 그 테스트 파일도 `code:` 에 등재한다"는 패턴을 실례로 보여준다(`3-schedule.md` frontmatter의 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 항목 — §4 응답 형태 註가 "e2e 가 고정한다"고 명시했기 때문에 등재됨).

이번에 추가된 `schedules.service.spec.ts` 단위 테스트들은 `SchedulesService.update()` 내부의 cron/timezone 재계산 로직(구현 세부사항이자 회귀 방지용 화이트박스 테스트)을 다루지만, `3-schedule.md` 본문에는 이를 지목하는 註가 없고(위 grep 확인) 이 로직 자체도 스펙 문서가 명시적으로 서술한 문장이 아니다. 따라서 이 규약의 "註가 지목한 테스트는 `code:` 에 등재" 요구가 **이번 diff 에는 적용되지 않는다** — `code:` 미변경은 규약 위반이 아니다. (참고로 `code:` 는 이미 `codebase/backend/src/modules/schedules/schedules.service.ts` 를 글로브 없이 명시 등재하고 있어 §4 `spec-code-paths.test.ts` 매치 요건도 그대로 충족된다.)

그 외 검토한 항목:
- **명명 규약**: 새 식별자(`scheduleRow`, describe/it 문자열)는 테스트 파일 내부 스코프이며 API/DTO/이벤트 등 conventions 가 규율하는 외부 표면이 아니다. 위반 없음.
- **출력 포맷 규약** (API 응답/에러 코드 등, `error-codes.md`/`swagger.md`/`spec/5-system/2-api-convention.md` 영역): 이 diff 는 응답 DTO·에러 코드·엔드포인트를 하나도 건드리지 않는다. 해당 없음.
- **문서 구조 규약** (Overview/본문/Rationale 3섹션, `0-`/`_` prefix): `spec/2-navigation/` 아래 어떤 문서도 이번 diff 로 바뀌지 않았다. 해당 없음.
- **API 문서 규약** (`swagger.md` 의 데코레이터·DTO 명명): 신규/변경 DTO 없음. 해당 없음.
- **금지 항목**: 확인한 conventions(`audit-actions.md`, `spec-impl-evidence.md`) 중 이 diff 가 답습하는 금지 패턴은 없음. (`audit-actions.md` 의 `schedule.updated` 액션은 diff 범위 밖의 기존 코드에 대한 테스트일 뿐 diff 가 새로 만든 액션이 아니다.)

## 요약

이번 변경은 `spec/2-navigation/` 문서 자체를 건드리지 않는 순수 테스트 추가(백엔드 서비스 단위 테스트 3건 + 공유 fixture 헬퍼)이며, 신규 API·DTO·이벤트·에러 코드·식별자 등 conventions 가 규율하는 외부 표면을 하나도 생성하지 않는다. 유일하게 접점이 있는 `spec-impl-evidence.md`(`code:` frontmatter 규약)도 "spec 본문이 특정 테스트 파일을 명시로 지목했을 때만 등재 의무"라는 조건을 이번 diff 가 충족하지 않아(대상 spec 문서에 해당 註 없음) 위반이 성립하지 않는다. 정식 규약 준수 관점에서 이번 diff 는 문제 없이 규약 범위 밖(out-of-scope) 이거나 기존 규약을 그대로 충족한다.

## 위험도

NONE
