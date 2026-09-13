# 문서화(Documentation) 리뷰 — error-code-emission-axis (라운드 10, `23_04_01`)

## 검토 방법

이 배치는 이미 9회의 `/ai-review`(그중 4회는 documentation 축 전담 검토: `19_23_22` ·
`19_51_33` · `22_06_10` · `22_38_36`)와 9회의 `--impl-done`을 거쳤다. 각 라운드의
RESOLUTION.md를 읽어 documentation 관점 지적이 실제로 해소됐는지 확인했다(라운드 8의
CRITICAL "예고 미정정"·WARNING "orphan 조각"은 라운드 9 fix 커밋에서 해소, 라운드 9의
WARNING "자기 라운드 오기(9→8)"·"같은 커밋의 줄번호 자기 인용 붕괴"는 이번에 리뷰 대상인
커밋(`d39d91a84`)에서 실제로 해소됐음을 `git show`/`grep`으로 직접 재확인했다).

실질 변경 파일은 8개(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`·
`guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·`plan/in-progress/
error-code-emission-axis.md`·`spec-draft-nullable-notation-followups.md`)이고 나머지
198개 파일은 과거 9개 리뷰/컨시스턴시 라운드의 산출물(`review/code/**`,
`review/consistency/**`)이라 harness 관례에 따른 정적 기록이지 신규 문서화 대상이 아니다
(이미 여러 라운드가 확인).

diff가 프롬프트 크기 제한으로 생략된 파일(5·6·7·8)은 `git diff origin/main -- <path>`로
전문을 직접 읽었다. 이번 라운드는 선행 9라운드가 반복 검증한 항목(카탈로그 탈출구·
`where` 검증·JSDoc 설계 근거·수집기 3종의 경계 대조군 등)을 재조사하지 않고, **9라운드
동안 어떤 축의 checker도 지적하지 않은 새 각도**를 찾는 데 집중했다 — plan 문서 자체의
마크다운 렌더링 정합성.

저장소는 읽기 전용으로만 사용했다(`Read`/`git diff`/`git show`/`git log -S`). 뮤테이션
재현은 하지 않았다.

## 관측된 저장소 이상 상태 (내 편집 아님 — 그대로 보고)

리뷰 시작 시점에 `git status --short`를 찍어 보니 다음 파일이 **이미 미커밋 상태로
수정돼 있었다**:

```
 M codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts
```

diff:

```diff
-const SOURCE_ROOTS = ["codebase/backend/src", "codebase/packages"];
+const SOURCE_ROOTS = ["codebase/backend/src"];
```

이 편집은 내가 만들지 않았다 — 나는 이 파일에 `Read`/`git diff origin/main --`만
수행했다. 이 워크트리를 다른 리뷰어(다른 axis)가 동시에 읽고 있다는 프롬프트의 경고와
정확히 일치하는 형태로, 아마 `codebase/packages` 원소가 실제로 어떤 테스트에서 소비되는
지 확인하려는 다른 리뷰어의 진행 중인 뮤테이션 실험으로 보인다. 나는 이 파일을 되돌리지
않았다 — `git checkout`/`git restore`는 금지이고, 이 변경이 내 것이 아니므로 다른 세션의
작업을 임의로 종료시키고 싶지 않았다. 다음 사람이 이 잔여물을 이 PR 의 실제 diff 로
오인하지 않도록 여기 기록한다. (이 문서 리뷰 자체는 `origin/main` 대비 diff, 즉 이
잔여 뮤테이션을 제외한 committed 상태를 대상으로 했다.)

## 발견사항

- **[WARNING]** `plan/in-progress/error-code-emission-axis.md` §D-2 의 "등록 대상 3종"
  표가 두 차례의 블록인용 삽입으로 **쪼개져** 3행 중 2행이 표 밖으로 떨어져 나간다
  - 위치: `plan/in-progress/error-code-emission-axis.md:167-184`
    (표 헤더 167-168, 첫 데이터 행 169, 블록인용 171-182, 나머지 데이터 행 183-184)
  - 상세: 표는
    ```
    167| | 토큰 | 사유 | 문장 처분 |
    168| |---|---|---|
    169| | `MAKESHOP_UNRESOLVED_PATH_PARAM` | … | 무수정 |
    170| (빈 줄)
    171| > **backfill 이 won't-do 로 처분되면 …**
        … (블록인용, 182행까지)
    183| | `CONTAINER_MISSING_EMIT` | … | **문장 정정** |
    184| | `CONTAINER_MULTIPLE_EMIT` | … | **문장 정정** |
    ```
    형태다. CommonMark/GFM 은 표를 헤더+구분행 뒤에 **공백 없이 연속되는** 파이프 행으로만
    인식한다. 169행 뒤에 빈 줄(170)과 블록인용(171-182)이 끼어들면서 그 시점에 표가
    끝나고, 183-184행은 새 헤더+구분행이 없으므로 **독립된 표로 다시 시작하지 않는다** —
    렌더러에 따라 앞 블록인용의 lazy-continuation 텍스트로 흡수되거나, 그냥 파이프가 섞인
    평문 두 줄로 표시된다. 어느 쪽이든 저자가 의도한 "토큰|사유|문장처분" 3열 3행 표는
    렌더링되지 않고, `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 행은 열 정렬이
    깨진 채 나타난다.
  - 근본 원인을 `git log -S`로 추적했다: 원 커밋(`65256a109`, 최초 도입)에서는 이 표가
    3행 연속이라 멀쩡했다. **라운드 5**(`2931d921f`)가 `MAKESHOP_UNRESOLVED_PATH_PARAM`
    행 바로 뒤에 "3208 해소 시 재검토" 블록인용을 끼워 넣었고(이 삽입 자체는
    `review/consistency/2026/09/13/20_57_15/plan_coherence.md`의 정당한 제안이었다 —
    그 리포트도 "§D-2 표"를 계속 단일 표로 지칭한다), **라운드 6**(`eb53aba1c`)이 같은
    지점에 "backfill won't-do" 블록인용을 하나 더 끼워 넣어 간격을 벌렸다. 두 삽입 모두
    "표 뒤에 이어 붙일 각주"라는 의도였지만 **표의 중간**(1행과 2행 사이)에 들어가는
    바람에 표 자체를 갈랐다.
  - 이후 라운드 6~9의 documentation·requirement·scope·plan_coherence 리뷰 최소 6건이
    이 절을 "§D-2 표"로 인용하며 참조했지만(`review/code/2026/09/13/20_57_13/{scope,
    requirement,testing}.md`, `review/code/2026/09/13/21_41_23/scope.md`,
    `review/consistency/2026/09/13/{20_57_15,22_06_21,20_34_48}/*.md`) 어느 리포트도
    표가 렌더링 시 쪼개진다는 사실은 짚지 않았다 — 전부 내용(등록 사유·토큰) 검증에
    집중했고 마크다운 구조 자체는 프롬프트/소스를 원문으로 읽어 "표"로 해석했기 때문으로
    보인다. 이 저장소가 반복해서 이름 붙인 형태의 한 판본이다 — **"블록을 삽입할 때 «자리»
    를 보고 «무엇이 밀리는지» 를 안 본다"**(라운드 4 WARNING#1, orphan JSDoc)와 구조적으로
    동일한 실수가 이번엔 코드가 아니라 표에서 났고, 코드 리뷰어들의 JSDoc/주석 정합성
    점검 루틴이 마크다운 표 렌더링까지는 커버하지 못해 5라운드 동안 안 걸렸다.
  - 기능·동작에는 영향이 없다(이 문서는 `plan/in-progress/`의 내부 작업 추적 문서이고
    표 내용 자체는 프로즈로도 읽을 수 있다). 다만 이 표는 등록 3종의 판단 근거를
    한눈에 대조하는 용도로 설계됐고, 이 배치 자신의 다른 부분(§C 상단 주석)이 "등록
    대상은 §D-2 의 3종"이라고 이 표를 가리키는데 렌더링되면 3종이 아니라 1종+평문
    2줄로 보인다 — 그 자기 참조의 전제를 깬다.
  - 제안: 183-184행을 169행 바로 아래로 옮기고(표를 3행 연속으로 복원), 두 블록인용
    (171-182)은 표 **전체가 끝난 뒤**(185행 이후, 현재 "문장 처분은 …" 단락 앞)로
    옮긴다. 내용은 그대로 유지하면서 위치만 표 밖으로 빼면 된다.

## 확인 후 문제없음으로 판단한 항목

- **`guide-identifier-scan.ts:12`의 "(라운드 8 정정)" 표기** — 라운드 9의 WARNING(자기를
  "라운드 9"로 잘못 표기)이 이번 리뷰 대상 커밋(`d39d91a84`)에서 정확히 "라운드 8"로
  정정됐음을 `git show`로 확인했다. 같은 커밋이 §L의 `guide-identifier-scan.ts:77`
  줄번호 인용도 앵커 문구(`spec-draft-nullable-notation-followups.md` 의 *"가이드
  에러 코드 가드가 «존재» 만 보고 «방출» 을 안 본다" 항목`)로 바꿔, 같은 커밋 안에서
  자기 편집이 자기 인용을 미는 문제(라운드 9 WARNING#1)를 실제로 해소했다.
- **`CHANGELOG.md`/`PROJECT.md`/`logic.mdx`/`logic.en.mdx`** — 라운드 8 이후 이 네
  파일에는 변경이 없고(`git show d39d91a84 --name-only`에 없음), 선행 4회의
  documentation 전담 라운드가 이미 소스 줄 대조까지 마쳤다. 재확인 결과 여전히 정확하다.
  카탈로그 "78종 중 28종 미등재·25종 발행"이라는 CHANGELOG 서술이 현재
  `collectCatalogCodes` JSDoc과 단어 단위로 일치한다.
  `PROJECT.md:300`의 "발행 축" 서술도 현재 가드 구현(등록 시 사유 필수·카탈로그=탈출구·
  잔여 한계)과 정확히 일치하고, `user-guide-evidence.md §2` 미등재 사실을 스스로 명시해
  보장 범위를 과장하지 않는다.
- **`plan/in-progress/spec-draft-nullable-notation-followups.md`의 신규 표 2개**
  (§"spec 6파일이 CONTAINER_* 를 코드로" 6행, §"§1.4 앵커 없는 코드 7종" 2행) — 동일한
  헤더+구분행+연속 데이터행 구조로, 위 §D-2 와 달리 중간에 블록인용이 끼어들지 않아
  렌더링이 깨지지 않는다.
- **`spec_impact` frontmatter 5경로 추가** — 본문이 나열하는 정확히 6개 spec 파일
  (`4-execution-engine.md` 기존 + 신규 5개)과 1:1로 일치함을 재확인했다.

## 요약

핵심 코드(`guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`)와 가이드
문서(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`)는 9라운드에 걸친 극히 정밀한 검증을
거쳤고 이번 라운드의 재확인에서도 소스·plan 서술과 정확히 일치한다. 라운드 9가 남긴 두
WARNING(자기 라운드 오표기, 같은 커밋 내 줄번호 자기 붕괴)은 이번 리뷰 대상 커밋에서
실제로 해소됐다. 새로 발견한 것은 CRITICAL/기존 라운드 지적이 아니라, **9라운드 동안
어느 축도 짚지 않은 새 결함 하나**다 — `error-code-emission-axis.md` §D-2 의 3행 표가
라운드 5·6 이 각각 삽입한 두 블록인용에 의해 중간에서 쪼개져, 렌더링 시 3행 표가 아니라
1행 표 + 정렬 안 된 평문 2줄로 나타난다. 동작에는 영향이 없지만, 이 표를 "3종"으로
지칭하는 이 문서 자신의 다른 서술과 어긋나는 렌더링 결과를 낳으므로 정정을 권한다.
별도로, 리뷰 시작 시점에 이 워크트리에 다른 세션으로 추정되는 미커밋 뮤테이션
(`guide-identifier-existence.test.ts`의 `SOURCE_ROOTS`)이 이미 존재했음을 관측해
기록했다 — 이 PR 의 committed diff 에는 포함되지 않는다.

## 위험도

LOW
