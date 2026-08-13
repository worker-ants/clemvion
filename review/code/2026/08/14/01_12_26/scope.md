# 변경 범위(Scope) 리뷰

## 발견사항

없음(CRITICAL/WARNING 없음) — `git diff --stat origin/main...HEAD` 실측 결과 136개 파일(코드베이스
13 + `CHANGELOG.md` 1 + `plan/` 5 + `review/**` 117)이 전부 "`UPDATE`/`DELETE … RETURNING` 이
`[rows, rowCount]` 튜플인데 8곳이 행 배열로 오인했다"는 단일 결함(및 그 수정 과정에서 드러난
직결 종속 결함 1건)의 수정으로 수렴한다. 관점별 확인:

- **의도 이상의 변경**: 없음. 헬퍼 `updateReturningRows`(`codebase/backend/src/common/utils/update-returning-rows.ts`)
  신설 + 8개 소비 지점 이관(`execution-engine.service.ts` 2곳, `knowledge-base.service.ts` 5곳,
  `auth-oauth.service.ts` 1곳) + 각 지점의 실측-shape 회귀 테스트로 diff 가 정확히 닫힌다. `plan/`
  변경 5건은 이 결함 수정이 과거 완료 선언(CHANGELOG·plan 체크박스)을 소급 무효화하므로 붙는 정정
  배너·위임 티켓이며, "코드 수정과 무관한 별개 작업"이 아니라 이 수정 자체가 만들어낸 문서적 결과다.
- **불필요한 리팩토링**: `execution-engine.service.ts`(파일 10)에서 `assertRowArray` 호출 2곳을
  `updateReturningRows` 로 교체하면서 `assert-row-array.spec.ts`(파일 4)의 구조적 가드 기대값도
  `guards: 3`→`guards: 1`로 갱신했다. 얼핏 이번 PR 범위(`update-returning-rows`) 밖으로 보이지만,
  두 헬퍼는 "소비 지점이 헬퍼를 거치는지"를 세는 자매 구조적 가드이고 한쪽의 소비 지점이 다른
  헬퍼로 옮겨지면 반대쪽 가드도 갱신해야 카운트가 맞는다 — 드라이브바이가 아니라 필수 동반 수정.
  같은 이유로 `__testing__/source-scan.ts`(파일 3)를 신설해 두 자매 가드의 "주석 제외 카운팅" 로직을
  공유하게 만든 것도, 직전 라운드(`00_54_01` testing WARNING 1)가 "한쪽만 하드닝돼 비대칭"이라고
  지적한 것에 대한 직접 대응이며 범위 밖 정리가 아니다.
- **기능 확장**: 없음. `updateReturningRows` 는 튜플/행-배열 두 shape 만 흡수하는 최소 함수이고
  신규 옵션·플래그·API 표면 확장이 없다.
- **무관한 수정**: `auth-oauth.service.ts`(파일 8)에서 튜플 버그와 별개로 `record.rememberMe` →
  `record.remember_me` snake_case 컬럼명 버그도 같은 커밋에서 고쳤다. 별개 버그이긴 하지만, PR
  자신의 문서(update-returning-rows.ts JSDoc)가 명시하듯 이 버그는 튜플 버그가 콜백을 통째로
  죽이고 있던 동안 **도달 불가능했던 dead code**였고, 이번 수정이 그 코드를 처음 실행 가능하게
  만들면서 즉시 드러났다 — 정확히 지금 손대고 있는 그 문장·그 테스트 안에서 발견된 결함이라
  "무관한 파일·영역 수정"으로 보기 어렵다. `tsconfig.build.json`(파일 14)의 `exclude` 에
  `**/__testing__/**` 를 추가한 것도 신설된 테스트 전용 헬퍼(`source-scan.ts`)가 dist 에 실리지
  않게 하려는 직접 종속 변경이다.
- **포맷팅 변경**: 확인한 hunk(assert-row-array.spec.ts, update-returning-rows.ts/.spec.ts,
  execution-engine.service.ts, knowledge-base.service.ts, auth-oauth.service.ts/.spec.ts,
  e2e-spec, tsconfig.build.json) 전부 실질 변경 줄에 국한돼 있고 무관한 개행·정렬 변경이 섞여
  있지 않다.
- **주석 변경**: 추가된 주석은 전부 이번 결함의 실측 근거·회귀 이유·판별 근거(왜 이 값이어야
  분기가 갈리는지)를 설명하는 신규 주석이며, `execution-engine.service.ts` admission 블록에서는
  근본 원인이 밝혀지며 **틀린 것으로 판명된 옛 주석**("`RETURNING id` 이므로 실제 shape 은 행
  배열이다")을 제거하고 정정했다 — 결함 수정에 직접 종속된 주석 정리이지 무관한 주석 손질이 아니다.
- **임포트 변경**: `execution-engine.service.ts`·`knowledge-base.service.ts`·`auth-oauth.service.ts`
  각각에 추가된 `import { updateReturningRows } from '.../update-returning-rows'` 는 모두 실제
  호출부가 있다. `assert-row-array.spec.ts`(파일 4)에 추가된 `import { countCalls } from
  './__testing__/source-scan'` 도 같은 파일에서 바로 소비된다. 불필요한 정리/추가 없음.
- **설정 변경**: `tsconfig.build.json` 1건만 있고 위에서 설명한 대로 이번 PR 의 신규 파일과 직결된다.
  그 외 설정 파일(package.json, eslint, CI 등) 변경 없음(`git diff --stat` 로 확인).
- **`review/**` 117개 파일**: 전부 이 브랜치가 이미 거친 이전 리뷰 라운드(`20_36_35`, `22_45_24`,
  `23_07_11`, `23_27_48`, `23_46_00`, `00_20_21`, `00_54_01` 등)와 consistency 라운드의 산출물이다.
  이 저장소의 명시 규약(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 커밋 관행)상 리뷰 산출물은
  실제로 커밋되는 대상이며, "코드 리뷰어가 스코프 밖 파일을 건드렸다"는 신호가 아니라 이 PR 이
  거쳐온 반복 라운드의 정상적 부산물이다.

## 요약

`git diff --stat origin/main...HEAD` 로 136개 변경 파일 전체를 실측 대조한 결과, `codebase/`
13개 파일은 "`UPDATE`/`DELETE … RETURNING` 튜플 shape 오인" 단일 결함(+그 수정이 드러낸 종속
컬럼명 버그 1건)의 수정·테스트·주석 정정에 정확히 국한되며, `assertRowArray` 자매 가드 갱신과
`__testing__/source-scan.ts` 공유 유틸 추출도 두 구조적 가드의 카운트 정합을 유지하기 위한 필수
동반 수정이지 드라이브바이 리팩토링이 아니다. `CHANGELOG.md`·`plan/*.md` 5건은 이 수정이 과거
문서의 완료 선언을 소급 무효화한 데 따른 정정 배너이며, `review/**` 117건은 이 저장소 관행상
커밋되는 리뷰 라운드 산출물이다. 의도 밖 확장, 무관한 파일 수정, 포맷팅 노이즈, 불필요한
임포트·설정 변경은 발견되지 않았다.

## 위험도

NONE
