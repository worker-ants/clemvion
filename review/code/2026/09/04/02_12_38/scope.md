# 변경 범위(Scope) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드

## 대상 요약

리뷰 대상 22개 파일 중 실제 코드/plan 변경은 9개(파일 1~9), 나머지 13개(파일 10~22)는
`review/code/2026/09/04/01_48_39/`·`01_49_18/` 아래의 이전 리뷰 라운드 산출물(SUMMARY·
RESOLUTION·개별 reviewer 리포트·meta.json 등)이다. 이 산출물은 `CLAUDE.md` 의
"코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약대로 생성된
정상 워크플로 부산물이며, developer SKILL 의 마무리 커밋에 plan 체크박스·리뷰 산출물을
함께 담는 것도 기존 관례(`feedback_review_guard_push_timestamp.md`: "체크박스·plan 이동은
마무리 커밋에서")다. 따라서 파일 10~22 는 스코프 이탈이 아니다.

실질 코드 변경(파일 1~9)은 `plan/in-progress/entity-nullable-column-type-mismatch.md`
(파일 9, 게이트 244~277)에 명시된 **정확히 두 개의 후속 항목**에 1:1로 대응한다.

1. `repo-guards/__tests__/` 의 공용 walker 추출(리뷰 W5) → `source-scan.ts` 의
   `collectTsFiles` 신설(파일 2, 게이트 249~271) + 5개 가드의 walker 삭제·위임 전환
   (파일 3·4·5·6·8)
2. 넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트 가드 신설 → `nullable-type-lie-cast-guard.ts`
   의 `widenedEntityFields`/`findStaleSpecCasts`(파일 6, 게이트 141~197) + 해당 spec
   (파일 7)

## 파일별 점검

- **파일 3(`audit-action-binding-guard.ts`)·4(`engine-error-code-anchor-guard.ts`)·
  5(`masked-reject-callers-guard.ts`)·8(`redis-fail-open-catalog-guard.ts`)**: 각각
  자체 walker 함수 삭제 후 `collectTsFiles` 위임 한 줄로 교체, 필요한 import 만 추가/삭제.
  로직 외 변경 없음 — 스코프 이탈 없음. `audit-action-binding-guard.ts` 는 더 이상
  `fs` 를 직접 쓰지 않게 되어 `import * as fs` 를 제거했는데(게이트 8 위치, 삭제라
  게이트 없음), 이는 리팩터에 종속된 정당한 정리이지 별도의 임포트 청소가 아니다.
- **파일 2(`source-scan.ts`)**: `collectTsFiles`/`CollectTsFilesOptions` 신설과
  `stripLiterals` 신설(파일 6 의 `findStaleSpecCasts` 가 소비) 모두 위 두 후속 항목에
  직접 종속. `stripComments` 를 `export` 로 가시성 확대(게이트 53)한 것도 같은 이유로
  `findStaleSpecCasts` 가 재사용하기 위함 — 근거가 docstring(게이트 48~51)에 명시돼
  있고 순수 additive(기존 호출자 영향 없음)라 임의 확장이 아니다.
- **파일 6**: `WIDENED_DECL`·`SPEC_CAST` 정규식과 두 함수는 항목 2 구현 그 자체다.
  데코레이터 1개까지만 지원하는 한계(게이트 134~140)를 넓히지 않고 docstring 에만
  기록한 것도 "검증 없이 표면만 키우지 않는다"는 스코프 절제 판단으로, over-engineering
  방지 관점에서 오히려 바람직하다.
- **파일 7**: `withFiles`/`withFixture` 통합(게이트 55~78)은 이전 라운드 W3 지적("사본
  5개를 없애는 diff 안에서 새 사본을 만들었다")에 대한 직접 수정이며, 기존 단일 파일
  호출부(`withFixture`)는 얇은 래퍼로 유지돼 하위 호환. 스코프 이탈 아님.
- **파일 1**: `collectTsFiles`/`stripLiterals` 전용 테스트 추가만 있고, 기존 테스트
  블록에 대한 무관한 수정은 없음(diff 는 새 `describe` 블록 두 개를 파일 끝에 추가하는
  형태).
- **파일 9**: diff 범위가 정확히 두 체크박스 섹션(게이트 244~277)에 국한. 인접 서술
  변경 없음.

## 포맷팅·주석·임포트 축

- 포맷팅 변경과 실질 변경이 섞인 흔적 없음 — 각 hunk 는 함수 교체/추가 단위로 깔끔하게
  분리돼 있다.
- 신규 JSDoc 분량이 크지만(예: 파일 2 게이트 222~248 의 "다섯 사본의 차이" 표), 전부
  이번 변경(walker 통합)의 설계 근거·실측치를 담고 있어 "불필요한 주석"이 아니라 이
  저장소의 기존 관례(Rationale 섹션 강제, 설계 근거 실측 요구)를 따른 것이다.
- 임포트는 각 파일에서 실제로 새로 쓰는 심볼(`collectTsFiles`, `fs`/`os`/`path` 등)만
  추가됐고, 더 이상 쓰이지 않는 것만 제거됐다(파일 3 의 `fs`). 나머지 4개 가드는 `fs` 를
  여전히 다른 곳에서 쓰므로 남겨둔 것이 맞다.

## 발견사항

없음 — 검토한 9개 실질 변경 파일 모두 plan 의 명시된 두 후속 항목 범위 안에 있고,
의도 이상의 리팩토링·기능 확장·무관한 파일 수정·포맷팅 드리프트를 찾지 못했다.

## 요약

이번 diff 는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 미리 적어 둔
두 후속 항목(공용 walker 추출, 넓혀진 필드용 낡은 spec 캐스트 가드)에 정확히 결속되며,
5개 가드 파일의 변경은 모두 동일한 위임 패턴으로 최소화돼 있다. 이전 라운드 리뷰(W1~W4)
지적사항에 대한 수정도 지적 범위에 국한돼 적용됐다. `review/code/**` 산출물 13개가 같은
changeset 에 포함돼 있으나 이는 프로젝트 워크플로 관례상 정상이다. 스코프 이탈 발견사항
없음.

## 위험도

NONE
