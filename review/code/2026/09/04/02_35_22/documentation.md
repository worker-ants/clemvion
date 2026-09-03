# 문서화(Documentation) 리뷰

## 검증 방법

`git diff origin/main` 대상 코드(파일 1~9)를 프롬프트 diff 와 저장소의 현재 실제 파일
양쪽으로 대조했다(`Read`). 저장소 트리에는 아무것도 쓰지 않았다 — `git status --short` 로
확인, 세션 시작 상태(`review/code/2026/09/04/02_35_22/` untracked 1건 외 clean)와 동일.
파일 10~33(`review/code/2026/09/04/01_48_39/`·`01_49_18/`·`02_12_38/` 하위)은 이전 리뷰
라운드의 산출물이며 이 저장소 관례상 `review/` 는 커밋 대상이라 신규/이상 상태가 아니다 —
생성된 리포트이므로 이번 리뷰의 "코드/문서" 점검 대상에서 제외했다(이전 라운드 리뷰어들과
동일 판단).

## 발견사항

- **[WARNING]** `widenedEntityFields` docstring 의 "저장소 실측 20건" 이 검증되지 않는
  하드코딩 개수다 — **바로 같은 파일이 이걸 하지 말라고 명시적으로 적어 둔 바로 그 실수**다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
    함수 `widenedEntityFields` 바로 위 docstring, "저장소 실측 **20건**이 그런 충돌이다"
    문장 (같은 파일 `collectScanTargets` 함수 docstring 과 대조)
  - 상세: 이 파일의 `collectScanTargets` docstring 은 정확히 이 실수를 이미 한 번 겪고
    적어 둔 경고문을 갖고 있다 — "종전 이 자리에 '실측 12건' 이라고 개수를 박아 뒀다가
    **곧바로 낡았다** — 이 가드의 spec 자신이 fixture 문자열로 그 패턴을 쓰기 때문이다
    (같은 PR 안에서 12→24). **검증되지 않는 숫자는 적지 않는다.** 지금 세고 싶으면
    `grep -rn 'null as unknown as' --include='*.spec.ts'`." 그런데 바로 이 diff 가 추가한
    `widenedEntityFields` docstring 은 "저장소 실측 **20건**이 그런 충돌이다
    (`userId` 는 `login_history` 에서 nullable, `audit_log` 에서 non-null ·
    `workflowId` 는 … 등)" 라고 **날짜 표기도, 재현 명령도, pinning 테스트도 없이** 개수를
    그대로 박아 넣었다. `collectTsFiles` docstring 의 축 비교표(`1261` vs `818` 등)는
    "## … (2026-09-04 실측)" 처럼 헤딩에 날짜를 명시해 "이 시점의 증거" 임을 표시하는데,
    `widenedEntityFields` 의 "20건" 은 그 표기가 없어 상시 불변식처럼 읽힌다. 실제로 이
    개수를 고정하는 테스트도 없다 — `nullable-type-lie-cast.spec.ts` 의 저장소 전수 스위트는
    `widenedEntityFields(entities).size` 를 `toBeGreaterThan(100)` 으로만 검증하고, "충돌
    20건" 자체를 단언하는 테스트는 없다. 엔티티에 nullable 필드가 하나 늘거나 줄면(이
    저장소는 지금도 "잔여 축" 을 계속 정리 중이다) 이 숫자는 조용히 틀려지고, 다음 사람이
    이 docstring 을 근거로 판단을 내릴 수 있다.
  - 제안: 날짜 헤딩을 붙여 "이 시점의 실측" 임을 명시하거나(`collectTsFiles` 의 관례를
    따름), 그보다 확실하게는 `collectScanTargets` 가 이미 택한 방식대로 **개수를 아예
    적지 않고** 재현 방법만 남긴다(예: "지금 충돌 수를 세고 싶으면 저장소 전수 스위트의
    `widenedEntityFields` 결과 크기를 로그로 찍어라" 류). 예시 필드명(`userId`·`workflowId`
    등)만으로도 "이런 형태의 충돌이 존재한다" 는 근거는 충분히 전달된다.

- **[INFO]** `masked-reject-callers-guard.ts` 의 `listSourceFiles` 한 줄 doc comment 가
  이번 diff 로 생긴 새 동작(`.d.ts` 항상 제외)을 반영하지 못한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    (`export function listSourceFiles` 바로 위, `"`src/` 하위 `.ts` 전수 (node_modules·dist
    제외)."` 주석 — diff 안에서 컨텍스트 줄로 유지되어 이번 변경 대상이 아니었음)
  - 상세: 리팩터 전 구현(diff 의 `-` 블록)은 `entry.name.endsWith('.ts')` 만 검사해
    `.spec.ts`·`.d.ts` 를 **가리지 않고 전부** 모았다 — 그래서 바로 위 "전수(node_modules·
    dist 제외)" 라는 문구가 정확했다. 지금은 `collectTsFiles(rootDir, { includeSpec: true
    })` 로 위임하는데, `collectTsFiles` 는 `includeSpec` 값과 무관하게 `.d.ts` 를 **항상**
    제외한다(`source-scan.ts` 자체 docstring 의 "다섯 사본의 차이" 표에 근거와 함께 명시돼
    있다). 즉 `.spec.ts` 포함 범위는 그대로 유지됐지만 `.d.ts` 배제라는 새 동작이 하나
    조용히 얹혔는데, 이 로컬 한 줄 주석은 여전히 "전수" 라고만 말한다. 기능적 영향은 이미
    3라운드 전에 security/scope/side_effect 리뷰어들이 검토해 "저장소에 `.d.ts` 0개라
    오늘은 무해" 로 판정했고 그 판정 자체는 여전히 유효하다 — 이 항목은 그 판정을 뒤집는
    게 아니라, **판정의 근거가 된 동작 변화가 이 특정 지역 주석에는 아직 반영되지 않았다**
    는 좁은 지적이다.
  - 제안: 급하지 않음. 이 파일을 다음에 만질 때 주석을 "`.ts` 전수(`.d.ts`·node_modules·
    dist 제외, `.spec.ts` 포함)" 처럼 갱신하거나, `audit-action-binding-guard.ts:46`
    (`"대상 디렉터리의 `.ts` 소스를 모은다 (`.spec.ts`·`.d.ts` 제외)."`)처럼 정확한 제외
    목록을 명시하는 관례로 맞춘다.

## 확인 결과 정상 (재검증)

- 이전 라운드(`01_49_18`) W1(sort() 반증)·W2(stripLiterals 무테스트)·W3(withFixture/
  withFiles 중복)·W4(countCalls JSDoc orphan)와 `02_12_38` W1("이름 충돌" 오탐 가능성 미문서화)
  전부 코드를 직접 열어 실제로 반영됐음을 재확인했다: `source-scan.spec.ts` 의
  `nested-sibling.ts` 픽스처와 `stripLiterals` 전용 7-테스트 `describe`, `nullable-type-
  lie-cast.spec.ts` 의 `withFiles`/`withFixture`(얇은 래퍼) 통합과 "이름 충돌" 대조군
  테스트 2건, `source-scan.ts` 의 `countCalls`/`stripLiterals` JSDoc 이 각자 제 자리에
  있음, `nullable-type-lie-cast-guard.ts` docstring 의 "## 이름 충돌을 빼는 이유" 절.
- README·API 문서·CHANGELOG: 이번 diff 는 내부 테스트 인프라(`repo-guards` walker 통합 +
  신규 정적 가드) + plan 문서 갱신뿐이다. 저장소 루트 `CHANGELOG.md` 를 직접 열어 확인한
  결과 이 파일은 **API/DTO/스키마 계약이 실제로 바뀐 변경**만 기록하는 관례를 따르고
  있고(예: "Unreleased" 항목들은 전부 Swagger/DTO nullable 정합화), 이번 diff 는 그런
  외부 계약 변경이 없어 CHANGELOG 갱신 대상이 아니라는 이전 판단이 실측으로도 맞다.
  README·API 문서도 마찬가지로 갱신 불필요.
- 설정 문서: 신규 환경변수·설정 옵션 없음(`CollectTsFilesOptions.includeSpec` 은 소스
  옵션이지 배포 설정이 아니다).
- plan 문서(`entity-nullable-column-type-mismatch.md`)의 체크박스 서술(파일 집합 5-way
  동일성 507/818/1261/818/818, "가드가 자기 spec 을 잡았다" 뮤테이션 검증, "20건" 충돌 근거)
  은 실제 코드·구조와 일치한다 — 다만 위 WARNING 이 지적하듯 "20건" 자체의 **원천**인 코드
  docstring 은 재현 불가능한 하드코딩이라 plan 문서도 같은 리스크를 상속한다.

## 요약

이번 diff 는 문서화 규율이 전반적으로 높다 — walker 통합 함수(`collectTsFiles`)와 신규
가드 함수(`stripLiterals`·`widenedEntityFields`·`findStaleSpecCasts`) 모두 "왜 필요한가/
왜 오탐이 없는가/한계" 절을 갖춘 JSDoc 을 두고, 이전 세 라운드에서 지적된 WARNING(정렬
반증·테스트 비대칭·픽스처 중복·JSDoc orphan·이름 충돌 오탐 미문서화)이 전부 실제로 코드에
반영된 것을 직접 확인했다. 다만 이번 라운드에서 새로 찾은 흠 하나는 근거가 강하다 —
`widenedEntityFields` docstring 이 하드코딩한 "20건" 은, **같은 파일의 `collectScanTargets`
docstring 이 명시적으로 "이렇게 하지 말라" 고 적어 둔(과거 12→24 로 곧바로 낡았던 사고를
근거로 든) 바로 그 패턴**을 재도입한 것이다 — 날짜 표기도 재현 명령도 없고, 이 숫자를
고정하는 테스트도 없다. 두 번째는 저위험 INFO: `masked-reject-callers-guard.ts` 의 로컬
한 줄 주석이 이번 diff 로 생긴 `.d.ts` 배제라는 새 동작을 아직 반영하지 않았다(기능적
판정은 이미 다른 리뷰어들이 끝냈고 여기서 뒤집지 않는다). README·CHANGELOG·API 문서는
이 diff 범위에서 갱신 대상이 아님을 저장소의 실제 CHANGELOG 관례로 재확인했다.

## 위험도

LOW
