# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff origin/main...HEAD --stat` (46 files, +2579/-14)로 실제 변경분을 먼저 특정한 뒤, 코드 영역(`codebase/**`)만 별도로 뽑아 추가된 모든 `+` 라인이 주석(`/** */`, `//`)·문자열 리터럴(`'...'`)인지 기계적으로 필터링해 재확인했다. 실행 가능한 코드 라인은 0건이었다. 또한 `git log --oneline`으로 이 브랜치의 4개 커밋(`b2c604469`→`5ad21690`→`d1d8a95bc`→`4a1c8bc48`) 각각의 diff stat 을 직접 열어, 커밋 단위로도 스코프가 새어나가지 않았는지 대조했다.

## 발견사항

- **[INFO]** 착수 전 선언한 "코스메틱 4건"에 spec frontmatter `code:` 목록 1줄이 더해짐
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:10` (frontmatter `code:` 리스트에 `codebase/backend/src/modules/executions/executions.service.ts` 추가)
  - 상세: `plan/complete/masked-marker-cosmetic-followups.md` "대상 (착수 전 재판정)" 표는 Swagger description·base JSDoc·`REASON_TO_DETAIL` JSDoc 3종·주석 언어 통일 4건만 선언했다. 실제 diff엔 이 1줄이 더 있으나, 임의 확장이 아니라 plan "작업" 절이 `/consistency-check --impl-prep`(`19_03_59`) WARNING 1건("§6이 인용하는 `executions.service.ts`가 어느 `code:`에도 없음") 반영으로 명시 귀속한 항목이다. 커밋 `b2c604469`에 이 1줄과 해당 근거 문서(`review/consistency/2026/08/22/19_03_59/**`)가 함께 실려 있어 추적 가능하다.
  - 제안: 조치 불요 — 워크플로 의무(consistency-check)의 문서화된 부산물.

- **[INFO]** `re-run.dto.ts` Swagger description 이 최초 1줄 계획보다 커졌다가 커밋 `4a1c8bc48`로 자체 축소됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-26`
  - 상세: 트래커 원 항목(`spec-sync-external-interaction-api-gaps.md`)은 "다음 DTO 편집 기회에 한 줄"로 스코프를 잡았으나, 실제 커밋 `b2c604469`는 마커 예약어·거부 코드·부분 일치 경계까지 담아 304자(~6문장)로 확장했다(plan 자신의 원칙 "정보를 늘린다"에 따른 의도적 확장). 이후 `/consistency-check --impl-done`(`19_48_18`)이 이를 `spec/conventions/swagger.md §3`("보안·정책 캐비엇" 예외는 요약 1~2문장 + SoT 링크) 위반 WARNING으로 잡았고, 같은 브랜치의 커밋 `4a1c8bc48`가 236자로 줄이고 `SoT: EIA §R17` 링크를 붙여 그 즉시 자체 교정했다(`git show 4a1c8bc48` 확인). 결과적으로 스코프가 잠시 넓어졌다가 같은 PR 안에서 규약에 맞게 재수렴했으며, 그 과정 전체가 커밋 메시지·리뷰 아티팩트로 추적된다.
  - 제안: 조치 불요 — 이미 자체 교정 완료.

- **[INFO]** `review/code/2026/08/22/{19_25_39,19_36_12}/**`(24파일) · `review/consistency/2026/08/22/{19_03_59,19_48_18}/**`(16파일) 신규 산출물이 코드 diff(파일 1~4)·plan·spec 변경과 함께 커밋됨
  - 위치: 위 4개 세션 디렉터리 전체(각 커밋에 분산 — `b2c604469`엔 `19_03_59`, `5ad21690`엔 `19_25_39`, `d1d8a95bc`엔 `19_36_12`, `4a1c8bc48`엔 `19_48_18`)
  - 상세: 전부 `new file mode`이며 애플리케이션 코드·spec 본문을 직접 건드리지 않는다. `CLAUDE.md`가 요구하는 "developer는 구현 착수 직전 `consistency-check --impl-prep` 의무" + "구현 완료 후 `/ai-review` 상시 강제 + Critical/Warning fix 같은 턴 의무"의 표준 산출물이며, `review/**`는 gitignore 대상이 아니므로 커밋에 포함되는 것이 이 저장소의 정상 워크플로다. 코드 diff(파일 1~4) 자체와는 각기 다른 커밋으로 분리돼 있어 diff 노이즈로 섞이지도 않는다.
  - 제안: 조치 불요 — 정상 프로세스 산출물.

## 4개 코드 파일의 범위 정합성 (문제 없음, 기계적 검증)

`git diff origin/main...HEAD -- codebase/` 의 모든 `+` 라인을 필터링한 결과, 주석(`/**`, `*`, `//`)·문자열 리터럴이 아닌 추가 라인은 **0건**이었다.

- `trigger-parameter.types.ts`: `REASON_TO_DETAIL`의 `missing_required`/`coerce_failed`/`invalid_schema` 3개 항목에 JSDoc만 추가. `Record` 키/값 무변경.
- `resolve-trigger-parameters.ts`: `resolveTriggerParameters` 함수 docblock을 전체 한국어로 확장(wrapper 역참조·CI 가드·SoT 문단 신설). 함수 본문·시그니처 무변경.
- `re-run.dto.ts`: `inputOverride`의 `@ApiPropertyOptional({ description })` 문자열만 변경(위 INFO 참고). `@IsOptional()`/`@IsObject()` 데코레이터·타입 무변경.
- `workflows.controller.ts`: `execute()` catch 블록 내 영문 인라인 주석 3줄만 한국어로 교체(근거 정보 보존). 로직·분기·throw 대상 무변경.

4개 파일 모두 포맷팅 잡음(공백/줄바꿈 재정렬)·무관한 import 정리·설정 파일 변경은 없다.

## 요약

diff는 plan(`masked-marker-cosmetic-followups.md`)이 착수 전 선언한 "코스메틱 4건"(Swagger description·base JSDoc·`REASON_TO_DETAIL` JSDoc 3종·주석 언어 통일)에 정확히 대응하며, `codebase/**`에 추가된 모든 라인은 기계적 필터링으로도 주석·문자열 리터럴뿐임을 재확인했다(실행 코드 0줄). Swagger description이 "한 줄" 계획보다 일시적으로 커진 지점이 있었으나 같은 브랜치 안에서 consistency-check WARNING을 받아 규약 형식(요약+SoT 링크)으로 자체 재수렴했고, 그 경위가 커밋 메시지에 투명하게 남아 있다. spec frontmatter 1줄 추가와 대량의 `review/**` 산출물은 이 저장소가 CLAUDE.md로 강제하는 consistency-check/ai-review 워크플로의 정상 부산물이며, 코드 diff와 커밋 단위로 분리돼 있어 은폐된 확장이 아니다. 의도 이상의 리팩터링·기능 확장(over-engineering)·무관한 파일 수정·불필요한 import/설정 변경은 발견되지 않았다.

## 위험도

NONE
