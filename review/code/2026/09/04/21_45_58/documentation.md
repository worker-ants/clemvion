# 문서화(Documentation) 코드 리뷰

## 검토 범위와 방법

이번 changeset 의 실질 변경은 `origin/main` 대비 6개 파일이다:

1. `CHANGELOG.md` (+38)
2. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (+13/-2)
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (+245)
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (+227)
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` (신규 119줄)
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` (+64/-4)

프롬프트에 담긴 나머지 파일(7~78번)은 전부 이전 리뷰 라운드(`19_43_18`, `20_16_17`,
`20_39_25`, `21_10_30`, `21_25_50`)와 consistency 라운드(`20_05_42`)의 산출물이
`review/**` 관례에 따라 신규 커밋된 것으로, 이번 diff 가 만든 신규 서술이 아니라
과거 리뷰 상태의 아카이브다. 이 changeset 은 이미 5라운드의 코드 리뷰를 거쳤고 각
라운드가 지적한 문서화 WARNING(라우트 표기 오기, "list() 만" 축소 서술, 코드젠
영향 문단 누락, 59/57 산술 불일치 등)이 이후 라운드에서 실제로 정정됐는지를 저장소
현재 상태(`HEAD=1a18446f9`)에서 직접 재확인했다(저장소 쓰기 없음, `Read`/`grep`
전용).

## 이전 라운드 WARNING 들의 현재 상태 재확인

- `CHANGELOG.md` "왜 아무도 몰랐나" 절: **`list`·`create`·`update` 세 응답 모두**로
  정정되어 있다(19_43_18 WARNING #1 조치 확인, `CHANGELOG.md:31`).
- `CHANGELOG.md` "**영향**:" 문단이 추가되어 다른 항목들과 형식이 일치한다(19_43_18
  WARNING #2 조치 확인, `CHANGELOG.md:25-27`).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "불일치 59건" 서술과
  분류표 합계가 이제 46+6+4+**3**=59 로 일치한다(19_43_18 WARNING #3 조치 확인,
  `plan/in-progress/spec-draft-nullable-notation-followups.md:285-303`).
- `GET /api/alerts/rules` 라는 오기는 저장소 전체(`CHANGELOG.md`, plan 파일)에서
  더 이상 발견되지 않는다 — 실제 컨트롤러 라우트(`alerts.controller.ts` `@Controller('alerts')`
  + `@Get()`/`@Post()`/`@Patch(':id')`)와 CHANGELOG/e2e 의 `/api/alerts` 표기가 일치한다.
- DTO JSDoc 은 "내부 서사(`//`) vs 소비자용 설명(JSDoc)" 분리가 실제로 적용돼 있다
  (`alert-rule-response.dto.ts:20-23` 이 `//`, `:24-27` 이 `/** */`) — 이전 라운드
  maintainability 지적("JSDoc 이 5배 길다")이 해소된 상태다.

## 발견사항

- **[INFO]** `swagger.md` numeric 불변식 성문화 / `spec/1-data-model.md:873` `Float` 라벨
  정정 — 두 항목 모두 아직 미착수이나 정당하게 유보됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:327-341`
  - 상세: 가드(`findNumericAsNumber`)로는 "`numeric`/`decimal` 컬럼을 엔티티 그대로
    내보내는 응답은 문자열" 이라는 불변식이 전역 강제되지만, `spec/conventions/swagger.md`
    본문에는 아직 성문화돼 있지 않다. 또한 `spec/1-data-model.md:873` 은 `threshold` 를
    여전히 `Float` 로 라벨링한다(각주로 `NUMERIC(12,4)` 임은 밝히고 있으나 라벨 자체는
    미정정). 둘 다 `spec/` 파일이라 `developer` 쓰기 권한 밖이고, plan 에 planner 항목으로
    정확히 등재돼 있다 — CLAUDE.md 의 역할 경계(`developer` 는 `spec/` read-only)를
    올바르게 지킨 처분이다.
  - 제안: 조치 불요. 다음 planner 턴에서 이 두 항목(및 "내부 서사/JSDoc 분리 가이드")을
    한 편집 세션으로 묶는다는 plan 의 지시(`:340-341`)를 그대로 따르면 된다.

- **[INFO]** `review/**` 아카이브 21개 파일 중 초기 라운드(`19_43_18`) 산출물이 이후
  정정된 사실과 다른 서술(예: "list() 만" 언급)을 여전히 담고 있다
  - 위치: `review/code/2026/09/04/19_43_18/documentation.md`,
    `review/code/2026/09/04/19_43_18/requirement.md` 등
  - 상세: 이는 결함이 아니라 그 라운드 시점의 스냅숏을 보존하는 것이 이 저장소의 의도된
    관례다(각 라운드 `RESOLUTION.md` 가 후속 라운드에서 조치 이력을 명시적으로 기록하므로
    독자가 시점을 추적할 수 있다). 다만 향후 이 디렉터리를 근거로 "아직 list() 만 문제"라고
    오인하는 사람이 없도록, 이번 라운드의 `RESOLUTION.md`(작성 예정)에 "여기 실린 과거
    산출물은 시점 스냅숏이며 현재 상태는 CHANGELOG/plan 최신본을 봐야 한다" 는 한 줄을
    남겨 두면 다음 사람의 탐색 비용을 줄일 수 있다.
  - 제안: 선택 사항 — 이번 라운드 RESOLUTION.md 에 참고 각주 한 줄 추가 고려.

## 항목별 점검 결과 (요약)

1. **독스트링/JSDoc**: `swagger-dto-contract-guard.ts`/`swagger-dto-contract.spec.ts`/
   `alerts-threshold-wire-type.e2e-spec.ts` 모두 "왜 이 축이 필요한가 · 왜 정규식이 아니라
   AST 인가 · 어떤 위음성을 재현했는가"를 각 함수/describe 블록 단위로 상세히 기록한다.
   실제 구현(`readOption` 의 계속-훑기 동작, `readColumnType` 의 포지셔널/옵션 이중 지원,
   `toPosixPath` 정규화 등)과 대조해도 서술이 정확했다. 공개 API 문서(`AlertRuleDto`)의
   JSDoc 도 이제 소비자 관점으로 좁혀져 있다.
2. **README 업데이트**: 새로 추가된 것은 내부 repo-guard·e2e 스펙·DTO 필드 타입 정정으로,
   사용자 대면 기능·설정 추가가 아니다. README 갱신 불요로 판단.
3. **API 문서**: `AlertRuleDto.threshold` 의 OpenAPI 타입 변경은 `CHANGELOG.md` 에 영향
   문단까지 포함해 상세히 기록됐다. 실제 컨트롤러 라우트·wire 동작과 대조 확인 완료.
4. **주석 정확성**: 가드 파일의 "저장소에 numeric 컬럼은 둘뿐" 서술
   (`AlertRule.threshold`, `LlmUsageLog.costUsd`)과 spec 픽스처의 대조군(`StatisticsResponseDto`
   음성 대조군)이 실제 코드와 일치함을 확인했다. §5.4 SoT 참조(`spec/5-system/2-api-convention.md`
   §5.4 "부재 표현 — null vs 키 생략")도 실재하는 섹션이다.
5. **인라인 주석**: e2e 스펙의 "왜 정수가 아니라 소수부 4자리 값을 쓰는가", 가드의
   "matchAll 의 g-플래그 재사용은 안전한가" 등 비직관적 결정에 전부 근거 주석이 붙어 있다.
6. **변경 이력**: `CHANGELOG.md` Unreleased 섹션에 breaking 여부·영향·재발 방지 조치까지
   포함해 기록됨. 이 changeset 자체의 CHANGELOG 갱신은 충분하다.
7. **설정 문서**: 신규 환경 변수·설정 옵션 추가 없음(해당 없음).
8. **예제 코드**: `swagger-dto-contract.spec.ts` 의 대조군(`[대조군]`)들이 술어의 사용
   방식을 사실상의 실행 가능 예제로 제공한다 — 별도 사용 예제 문서 불요.

## 요약

이번 changeset 은 이미 5차례의 코드 리뷰 라운드를 거치며 문서화 관점의 지적(라우트
표기 오기, 결함 영향 범위 축소 서술, CHANGELOG 영향 문단 누락, plan 문서 산술
불일치, JSDoc 이 API 문서로 새는 문제)이 전부 후속 라운드에서 실측·정정됐다. 현재
`HEAD` 상태를 직접 열어 대조한 결과 이 정정들이 실제로 반영돼 있고, 남은 서술
(`spec/1-data-model.md` `Float` 라벨, `swagger.md` 성문화)은 `developer` 권한 밖이라
정당하게 planner 트랙으로 유보돼 있다. 새로 발견된 CRITICAL/WARNING 은 없다.

## 위험도

NONE
