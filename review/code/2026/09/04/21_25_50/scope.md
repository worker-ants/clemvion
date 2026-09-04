# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff --stat origin/main...HEAD`(HEAD=`0ac45dfad`)로 실제 diff 전체(65개 파일, +5,190/-15)를
직접 대조했다. 프롬프트가 제시한 52개 파일 목록·hunk 는 이 diff 의 **부분집합**임을 확인했다 —
이유와 영향은 아래 "프롬프트 페이로드 stale" 항목 참조. 저장소 쓰기는 하지 않았다
(`git show`/`git diff`/`git log`/`Read` 만 사용, `git status --short` 로 종료 시 clean 확인).

실제 diff 는 세 그룹으로 나뉜다:

1. **실질 코드/문서 변경 6파일**: `CHANGELOG.md`, `alert-rule-response.dto.ts`,
   `swagger-dto-contract-guard.ts`, `swagger-dto-contract.spec.ts`,
   `alerts-threshold-wire-type.e2e-spec.ts`, `spec-draft-nullable-notation-followups.md`
2. **리뷰 라운드 산출물 59파일**: `review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,21_10_30}/**`
   (각 12~13파일: RESOLUTION·SUMMARY·meta.json·`_retry_state.json`·리뷰어별 `.md`) +
   `review/consistency/2026/09/04/20_05_42/**`(9파일)
3. 위 1+2 = 65파일, `diff --stat` 총계와 정확히 일치. 그 외 파일 없음.

커밋 히스토리(`a65a4f85e` → `5a7de8ab1` → `dc83c0312` → `c15489e61` → `b5d5210cf` →
`9ba0991c8` → `40005a6e0` → `0ac45dfad`)는 단일 서사를 따른다 — "`AlertRuleDto.threshold`
가 `number` 라고 문서화됐지만 wire 는 `string`" 결함을 고치고(fix), 재발 방지 가드를 세우고
(test/fix 반복 — 정규식→AST, 포지셔널 `@Column`, POSIX 경로 등 리뷰가 지적한 것을 그때그때
조치), 매 라운드의 리뷰·consistency 산출물을 커밋으로 남기는 이 저장소의 표준 "구현→ai-review
→fix→재리뷰" 루프다. `plan/**` 트래커 갱신도 전부 이 하나의 조사(§5.4 drift 2단계 검증자
옵션 (a) 반증)에 결속된다.

## 발견사항

- **[WARNING]** 이 라운드(`21_25_50`)의 프롬프트 페이로드가 실제 HEAD 보다 1커밋 stale 하다
  — 다만 실측 결과 스코프 이탈은 아니다
  - 위치: `review/code/2026/09/04/21_25_50/meta.json`(`"timestamp": "2026-09-04T21:25:50..."`)
    vs `git log`(`0ac45dfad` 커밋 시각 `21:27:08`)
  - 상세: 이 라운드의 `meta.json`/프롬프트는 52개 파일만 나열하는데, 실제 `origin/main...HEAD`
    diff 는 65개 파일이다. 차이 13개는 전부 `review/code/2026/09/04/21_10_30/**`(`RESOLUTION.md`
    ·`SUMMARY.md`·`meta.json`·리뷰어 9종 등) — 이 라운드 프롬프트 생성(`21:25:50`) **직후**인
    `21:27:08`에 커밋된 `0ac45dfad`("docs(review): 21_10_30 라운드 산출물 + RESOLUTION")의
    변경분이다. 같은 커밋이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    새 bullet 1개(`swagger.md` 의 "내부 서사는 `//`, 소비자용 설명은 JSDoc" 분리 가이드,
    `21_10_30` INFO#3)도 추가했는데, 이 역시 프롬프트의 파일 6 diff hunk(`@@ -286,6 +324,14 @@`,
    14줄)에는 없다 — `git show 0ac45dfad -- plan/...` 로 직접 대조해 확정했다.
    **`git show 0ac45dfad`를 직접 읽어 대조한 결과**, 이 누락분 자체는 review/plan 문서 전용
    커밋(`codebase/**` 무변경)이고 내용도 기존 3라운드(`19_43_18`/`20_16_17`/`20_39_25`)와
    동일 패턴("그 라운드 산출물 커밋 + 등재된 후속 항목 1건 반영")이라 이 changeset 의 단일
    서사를 벗어나지 않는다. 프로젝트 관례(`review-guard push timestamp` — freshness 는
    `codebase/**` 기준, review/plan-only 후속 커밋은 stale 아님)에 비추어도 이 자체가 게이트
    결함은 아니다. 다만 **이 스코프 리뷰가 참조하는 페이로드가 HEAD 전체를 반영하지 못한다**는
    사실은 다른 13개 병렬 리뷰어(`security`/`performance`/`architecture` 등)의 판정에도 동일하게
    적용될 수 있어 투명성을 위해 명시한다 — 이번 등급 판단에는 `git diff` 직접 대조로 보정했다.
  - 제안: 조치 불요(코드 결함 아님). 다만 다음 라운드 오케스트레이터가 프롬프트 생성-커밋 사이
    경합 윈도우를 인지하도록 참고.

- **[INFO]** 스코프 경계 준수가 양호하다 — `spec/**` 는 developer 가 직접 건드리지 않았다
  - 위치: `review/consistency/2026/09/04/20_05_42/SUMMARY.md`(WARNING #1/#2가 `spec/conventions/
    swagger.md` 수정을 권고) vs 실제 diff(`spec/**` 파일 0건)
  - 상세: consistency 라운드가 "신규 numeric 불변식을 `swagger.md` 에 규약화하라" 고 지적했지만,
    developer 는 `spec/` 을 직접 고치는 대신 `plan/in-progress/spec-draft-nullable-notation-
    followups.md` 에 planner 트랙 항목(`- [ ] spec/conventions/swagger.md 에 numeric 불변식
    성문화 (planner, ...)`)으로만 등재했다. `spec/` 변경 권한은 `project-planner` 전용이라는
    CLAUDE.md 규약을 정확히 지켰고, "자기-반증형 소정정" 예외 다섯 조건에도 해당하지 않는
    사안이라 예외를 쓰지 않은 것도 맞다. 스코프 이탈 방지 사례로 참고할 만하다.

## 항목별 확인

1. **의도 이상의 변경**: 없음. 6개 실질 파일 전부 "`threshold` wire 타입 정정 + 재발 방지 가드"
   라는 CHANGELOG 가 스스로 선언한 단일 목표에 결속된다. `AlertRuleDto` 의 다른 필드(`id`·
   `workspaceId`·`type`·`window`·`channel`·`workflowId`·`enabled`·`createdAt`·`updatedAt`)는
   무변경.
2. **불필요한 리팩토링**: `readBooleanOption` → 제네릭 `readOption` + `readStringOption` 분리는
   리팩토링처럼 보이지만, 새 축(`readColumnType` 이 `type:` 문자열 옵션을 읽어야 함)이 직접
   요구하는 최소 공유화다 — 기존 `readBooleanOption` 호출부·동작은 변경 없음(순수 위임).
   `findSwaggerContractMismatches` 본문(기존 presence/null 두 축)은 한 줄도 건드리지 않았다
   (diff hunk 가 `@@ -55,24 +58,56 @@` 다음 바로 `@@ -183,3 +218,201 @@` 로 뛰어 파일 끝에만
   신규 export 를 추가함을 확인).
3. **기능 확장**: 가드에 세 번째 축(`findNumericAsNumber`/`scanNumericExposure`)을 추가한 것은
   신규 기능처럼 보이나, CHANGELOG 항목 자체가 "재발 방지" 섹션으로 명시 예고한 작업이고 —
   이후 3개 리뷰 라운드(WARNING 지적 → AST 재작성·POSIX 정규화·이름 관례 대조군)를 거쳐 이번
   changeset 안에서 수렴했다. 이 저장소 CLAUDE.md 가 "구현 완료 후 자동 review/fix 는 상시
   승인된 강제 의무" 로 명시한 바로 그 루프이지, 요청 밖의 임의 기능 추가(over-engineering)가
   아니다.
4. **무관한 수정**: 없음. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff
   는 §5.4 drift 2단계 검증자 항목((a)/(b) 및 그 하위 planner 트랙 3개 bullet)에 국한되고,
   문서의 다른 절(①②③, Rationale, 체크박스 완료 항목 등)은 무변경. `spec/**` 는 전혀 건드리지
   않음(위 INFO 참조).
5. **포맷팅 변경**: 없음. 모든 hunk 가 대상 블록만 좁게 치환한다. `CHANGELOG.md` 는 파일 최상단에
   순수 삽입(0 삭제, `diff --stat`: `38 +++`). `alert-rule-response.dto.ts` 는 `threshold` 필드
   블록(3삭제/16삽입, 순증 13)만.
6. **주석 변경**: `threshold` 필드의 JSDoc/`//` 주석이 커졌으나, 이는 consistency 체커가
   WARNING(내부 서사가 공개 OpenAPI `description` 으로 노출)으로 잡은 뒤 `dc83c0312` 커밋이
   직접 대응해 "내부 경위는 `//`, 소비자용 요약만 JSDoc" 으로 분리한 결과다 — 불필요한 주석
   추가가 아니라 리뷰가 강제한 정정. 인접 필드 주석은 무변경.
7. **임포트 변경**: `swagger-dto-contract-guard.ts` 가 기존 `common/__test-utils__/source-scan`
   에서 이미 존재하던 `toPosixPath`(신규 추가 아님 — `origin/main` 시점에 이미 정의돼 있음을
   `git show origin/main:.../source-scan.ts` 로 확인)를 추가로 import. `swagger-dto-contract.spec
   .ts` 는 기존 `withFixture` 옆에 이미 존재하던 `withFiles`(이 브랜치에서 `temp-fixture.ts` 자체는
   무변경 — `git diff origin/main...HEAD -- .../temp-fixture.ts` 결과 0줄)를 추가 import. 둘 다
   신규 축이 실제로 쓰는 기존 헬퍼 재사용이지, 미사용 임포트나 불필요한 정리가 아니다.
8. **설정 변경**: 없음. 65개 파일 중 설정 파일(`.json`/`.yml`/`tsconfig` 등 도구 설정) 없음 —
   `*.json` 은 전부 리뷰 라운드의 `meta.json`/`_retry_state.json` 산출물(위 그룹 2)이며 저장소
   동작에 영향을 주는 설정이 아니다.

## 요약

실질 코드/문서 변경은 6파일로, `AlertRuleDto.threshold` 의 OpenAPI 타입 오기(`number`→`string`)
정정과 그 재발 방지를 위한 가드 확장(3번째 축) 이라는 CHANGELOG 가 스스로 예고한 단일 서사에
정확히 대응하며, 리팩토링·무관한 파일·포맷팅 뒤섞임·불필요한 임포트/주석/설정 변경은 관측되지
않았다. `spec/**` 를 직접 건드리지 않고 planner 트랙 항목으로만 등재한 것도 이 저장소의 역할
경계 규약을 정확히 지킨 사례다. 나머지 59파일은 이 changeset 이 거친 4회의 코드 리뷰 + 1회의
consistency 체크 산출물(`review/code/**`, `review/consistency/**`)이며, 이 저장소 관례상 정식
보관 대상이라 스코프 이탈이 아니다. 유일하게 짚을 점은 이 21_25_50 라운드의 프롬프트 페이로드가
그 생성 직후(약 1분 18초 뒤) 커밋된 `0ac45dfad`(review/plan 전용, `codebase/**` 무변경)를
반영하지 못한 채 stale 하다는 것인데, 직접 `git diff`/`git show` 로 그 누락분을 대조한 결과
동일 서사 안의 산출물 커밋 + planner 트랙 항목 1건 추가일 뿐이라 스코프 판정을 바꾸지 않는다.

## 위험도

NONE
