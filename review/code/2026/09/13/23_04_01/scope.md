# 변경 범위(Scope) 리뷰 — error-code-emission-axis (라운드 10 / 최종 누적본)

## 검토 방법

`origin/main..HEAD`(`d39d91a84`) 전체 diff — 206개 파일, `+20,610/-17` — 를
`git diff --name-only`/`--numstat`으로 분류했다. 저장소는 읽기만 했다(뮤테이션 없음,
`git status --short` 로 세션 시작·종료 상태가 이 세션 자신의 출력 디렉터리(`review/code/2026/09/13/23_04_01/`,
`review/consistency/2026/09/13/23_04_09/`) 외에는 깨끗함을 확인).

`review/**` 를 제외하면 실질 변경은 정확히 8개 파일이다:

| 파일 | +/- | 성격 |
|---|---|---|
| `CHANGELOG.md` | +32/-0 | 이번 가드 항목 서술 |
| `PROJECT.md` | +1/-1 | 가드 설명 1줄 갱신 |
| `codebase/frontend/src/content/docs/02-nodes/logic.mdx` | +1/-1 | 유저 가이드 문장 정정 |
| `codebase/frontend/src/content/docs/02-nodes/logic.en.mdx` | +1/-1 | 〃(EN) |
| `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` | +267/-4 | 발행 축 스캐너 코드 |
| `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` | +578/-5 | 발행 축 테스트 |
| `plan/in-progress/error-code-emission-axis.md` | +784/-0 (신규) | 이 작업 자신의 plan |
| `plan/in-progress/spec-draft-nullable-notation-followups.md` | +136/-5 | 공유 백로그 트래커 |

나머지 198개 파일은 전부 `review/code/2026/09/13/{19_23_22 … 22_38_36}/**` +
`review/consistency/2026/09/13/{18_40_54 … 22_38_43}/**` — 9라운드 `/ai-review` +
9라운드 `--impl-done`(consistency-check) 세션의 산출물이다. `git log --oneline`으로
확인한 커밋 이력(`a397ccc55`…`d39d91a84`, "라운드 1"~"라운드 9")이 이 산출물의 축적과
정확히 대응한다.

가장 최근 커밋 `d39d91a84`("라운드 9")의 diff도 별도로 확인했다 — 이전 라운드
(`review/code/.../22_38_36/scope.md`)가 아직 못 본 부분이다. 실질 코드 변경은
`guide-identifier-scan.ts` **주석 2줄**(스캐너 자신이 편집한 트래커 줄 번호가 같은
커밋 안에서 밀려 stale 인용이 된 것을 앵커 문구로 정정)뿐이고, 나머지는 plan 라운드
번호 정정 + 신규 리뷰 산출물이다. 신규 기능·리팩터는 없다.

## 발견사항

- **[INFO]** 리뷰/컨센시스 산출물(198개 파일)이 실질 코드 변경(2개 파일, 순증 약 836줄)에
  비해 압도적으로 크다
  - 위치: `review/code/2026/09/13/{19_23_22,19_51_33,20_13_13,20_34_32,20_57_13,21_19_46,21_41_23,22_06_10,22_38_36}/**`,
    `review/consistency/2026/09/13/{18_40_54,19_23_31,19_51_39,20_13_19,20_34_48,20_57_15,21_19_52,21_41_25,22_06_21,22_38_43}/**`
  - 상세: `CLAUDE.md`가 "구현 완료 후 자동 review/fix"를 상시 승인된 강제 의무로 규정하고,
    "코드 리뷰 산출물"·"일관성 검토 산출물"의 저장 위치를 `review/code/**`·
    `review/consistency/**`로 명시한다. 따라서 이 볼륨 자체는 스코프 위반이 아니라 이
    저장소가 강제하는 게이트의 정상 산출물이다. 다만 기능적으로는 "가이드 문장 2줄 정정 +
    가드에 발행 축 하나 추가"인 작업이 9번의 리뷰→수정 사이클을 거치며 완결됐다는 점,
    그리고 각 라운드의 후속 수정 상당수가 **직전 라운드 자신이 만든 결함**(orphan JSDoc,
    이름 충돌, 줄 인용 stale화, 라운드 번호 오기 등)을 겨눈다는 점은 diff·커밋 메시지에서
    직접 확인된다. 요청 범위를 벗어난 임의 기능 확장은 발견하지 못했다 — 매 확장의 동기가
    JSDoc/RESOLUTION.md에 특정 라운드의 특정 지적을 인용하는 형태로 추적 가능하다.
  - 제안: 조치 불요(스코프 관점). 다만 이 사이클 수 자체(9라운드)는 별도 축(예:
    testing/maintainability)에서 "같은 파일에 반복적으로 새 결함이 생기는 근본 원인"으로
    다룰 만하다 — scope 리뷰의 관점 밖이라 여기서는 기록만 한다.

- **[INFO]** 공유 백로그 트래커(`spec-draft-nullable-notation-followups.md`, 다수의
  무관한 미해결 항목을 담은 대형 파일)에 이 작업 도중 발견한 부수 결함 3건이 함께
  기록됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — `spec_impact:`
    블록에 spec 경로 5개 추가(파일 상단), "consistency `--spec` 예산" 항목에 문단 추가,
    두 곳의 `PROJECT.md:NN` bare 줄번호 인용을 앵커 문구로 정정
  - 상세: 각각 (1) 이 배치 자신이 신규 등재한 항목의 `spec_impact` 누락 보강,
    (2) `--impl-prep` 실행 중 우연히 재현된 기존 결함의 기록, (3) 편집 중이던 파일을
    줄 번호로 인용하지 말라는 저장소 규칙 위반의 사후 정정 — 셋 다 "이 작업 도중 발견한
    사실을 그 턴에 트래커에 적어라"는 명시 규약을 따른 것이라 스코프 위반으로 보지 않는다.
    다만 공유 트래커를 건드리는 편집이라 diff 리뷰 시 "이 PR이 무엇을 하나"를 흐릴 수
    있다는 점은 기록해 둔다.
  - 제안: 조치 불요 — 규약 준수. 병합 시 같은 파일을 건드리는 다른 브랜치와의 충돌만 확인.

- **[INFO]** 기존 `GUIDE_EXTERNAL_VOCABULARY` 검증 1줄이 신규 헬퍼(`staleGuideEntries`)로
  교체됨 — 신규 축과 직접 무관해 보일 수 있는 최소 리팩터
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    (`describe("유저 가이드 식별자 실재성 가드")` 내 "각 항목이 여전히 가이드에 인용된다"
    테스트, `GUIDE_EXTERNAL_VOCABULARY` 블록)
  - 상세: 새로 추가된 `GUIDE_NON_EMITTED_VOCABULARY`도 동일한 "여전히 인용되는가" 판정이
    필요해 그 판정을 공유 함수로 뽑아낸 결과다. RESOLUTION.md(라운드 2, WARNING#4)가
    "중복 제거 주석 바로 옆에서 다른 중복을 만들었다"는 라운드 1 자신의 지적을 고치는
    커밋으로 이를 명시하고 있어, 신규 기능이 유발한 필연적 변경이다. 기존 단언 결과(빈
    배열 통과)는 바뀌지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `sourceTexts` 소스 루트 정의가 인라인 배열에서 모듈 상수(`SOURCE_ROOTS`)로
  추출됨 — 신규 헬퍼(`resolveSourceLines`)가 같은 정의를 필요로 했기 때문
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    (`const SOURCE_ROOTS = [...]`, `const sourceTexts = walkTree(root, SOURCE_ROOTS, ...)`)
  - 상세: 라운드 8 리뷰(`review/code/.../22_06_10` architecture WARNING#1)가 "백엔드
    소스" 정의가 파일 안에 두 곳(기준집합용·`where` 검증용)이라 불일치 위험이 있다고
    지적했고, 이를 단일 상수로 합친 결과다. 테스트 파일 내부 상수 추출이며 외부(다른
    파일)에 영향 없음을 `grep`으로 확인했다(`SOURCE_ROOTS` 참조는 이 파일에 한정).
  - 제안: 조치 불요.

## 검토했으나 스코프 이탈로 보지 않은 항목

- 런타임 프로덕션 코드(`execution-engine.service.ts` 등)는 이번 diff에 전혀 포함되지
  않았다 — `nodeExec.error` 구조·엔진 동작은 손대지 않고 가이드 문장·가드만 정정한다는
  plan의 명시적 제약과 일치한다.
- `staleEntries` → `staleGuideEntries` 개명(라운드 4, 이름 충돌 회피)은 신규 파일
  안에서만 일어났다 — `grep -rn staleEntries codebase/`로 확인한 결과
  `internal-package-registration-guard.ts`(export된 동명 함수, 시그니처 상이)와
  그 호출부는 이번 diff에 전혀 등장하지 않아 다른 파일을 오염시키지 않았다.
- `CHANGELOG.md`(+32줄)·`PROJECT.md`(+1/-1줄) 변경은 정확히 이번 가드 항목(발행 축) 하나를
  서술하는 데 국한되고, 무관한 CHANGELOG 항목이나 다른 규약 서술을 함께 건드리지 않았다.
- import 추가(`collectQuotedLiterals`·`collectMessagePrefixes`·`collectCatalogCodes`·
  `isMessagePrefixOnly`·`computeNonEmittedOffenders`·`GUIDE_NON_EMITTED_VOCABULARY`)는
  전부 같은 diff에서 새로 export된 심볼이고 실제로 테스트에서 사용된다 — 미사용 임포트
  없음.
- 설정 파일(`package.json`, `tsconfig*`, CI 워크플로 등)은 이번 diff에 전혀 포함되지
  않았다.
- 포맷팅·공백만의 변경은 diff에서 발견되지 않았다 — 모든 hunk가 실질 텍스트 변경을
  동반한다.
- 라운드 9 커밋(`d39d91a84`)의 코드 변경은 주석 2줄뿐이며, 그 내용도 같은 커밋 안에서
  자신이 만든 stale 줄번호 인용을 앵커 문구로 되돌리는 자기 정정이라 신규 스코프가 아니다.

## 요약

핵심 변경은 "유저 가이드 2건의 부정확한 서술(`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`가
에러 코드로 발행된다는 오해) 정정 + 이를 지키는 가드에 발행 축 추가"라는 단일 목적에
9라운드 전체에 걸쳐 일관되게 국한돼 있다. 실질 코드 변경은 두 파일(`guide-identifier-scan.ts`,
`guide-identifier-existence.test.ts`)뿐이고, 동반된 소규모 리팩터(공용 헬퍼 추출, 소스 루트
상수 통합, 함수 개명)는 전부 신규 축이 직접 요구했거나 이전 라운드 리뷰가 지적한 결함을
그 라운드 안에서 고친 것으로, diff 내 주석·plan(`error-code-emission-axis.md`)·
RESOLUTION.md에 근거가 추적 가능하다. plan 트래커(`spec-draft-nullable-notation-followups.md`)
편집도 작업 도중 발견한 부수 사실을 기록하라는 이 저장소의 명시 규약을 따른 것이다.
206개 파일 중 198개(96%)가 `review/**` 산출물이지만 이는 프로젝트가 강제하는 표준
리뷰/컨센시스 게이트의 정상 산출물이며, 임의 기능 확장·무관한 파일 수정·설정 변경·
드라이브바이 포맷팅은 발견하지 못했다.

## 위험도

NONE
