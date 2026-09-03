# 변경 범위(Scope) 리뷰

## 검증 방법

`git diff origin/main...HEAD --stat` 전체(96개 파일, 10개 커밋)를 대조했다. 실질
코드/문서 변경(`codebase/`, `plan/` — 10개 파일, 786줄)과 리뷰 세션 산출물
(`review/code/2026/09/04/{01_48_39..03_58_32}/**`, 86개 파일 — 직전 7라운드분,
이번 라운드 이전에 이미 커밋됨)을 분리해서 각각 확인했다. 10개 실질 변경 파일은
`git diff origin/main...HEAD -- <file>` 로 개별 재확인했고(프롬프트 번들의 크기
제한으로 일부 diff 가 생략돼 있어 직접 대조 필요), 이번 라운드에서 직전 라운드
(`03_58_32`) 리뷰 이후 새로 추가된 유일한 커밋 `cfc69dd63`("리뷰 7R — JSDoc orphan
이 이 changeset 안에서 두 번째다")도 `git show` 로 단독 검토했다.

## 발견사항

- **[INFO]** `collectTsFiles` 통합이 `masked-reject-callers-guard.ts` 의
  `listSourceFiles` 에는 `.d.ts` 배제·정렬을 부수적으로 새로 얹는다 (재확인, 위반
  아님)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    — `export function listSourceFiles`, `return collectTsFiles(rootDir, { includeSpec: true });`
  - 상세: 원래 이 walker(삭제된 `readdirSync` 재귀)는 `.ts` 로 끝나기만 하면
    담았다(`.d.ts` 배제·`sort()` 없음). `collectTsFiles` 로 교체되며 두 필터가
    덤으로 붙는다. 이전 라운드들(`01_49_18/scope.md`, `03_58_32/scope.md`)에서
    이미 같은 지점을 지적했고, 하위 호출부가 결과를 다시 정렬하고(`.d.ts` 0개
    실측) 저자가 `source-scan.ts` 의 "다섯 사본의 차이" 표에서 이 축을 명시적으로
    근거 남긴 것도 확인했다. 새로 유입된 지점 아님 — 누적 재확인 목적으로만 기록.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 세션 산출물(`review/code/2026/09/04/01_48_39/` ~
  `03_58_32/`, 8개 라운드분)이 코드 변경과 같은 브랜치에 누적 커밋됨
  - 위치: `review/code/2026/09/04/{01_48_39,01_49_18,02_12_38,02_35_22,02_57_22,03_17_44,03_37_37,03_58_32}/**`
  - 상세: `review/` 는 이 저장소에서 gitignore 대상이 아니고, "구현 완료 후 리뷰 →
    fix → 재리뷰" 루프의 각 라운드 산출물을 커밋하는 것이 확립된 관례다(developer
    SKILL §REVIEW WORKFLOW). 8라운드가 누적되며 `origin/main` 대비 diff 크기가
    커졌지만(96개 파일 중 86개가 review 산출물), 이는 반복 fix-review 루프의 정상적
    부산물이지 의도 밖 수정이 아니다. 실질 코드/문서 변경(10개 파일, 786줄)은 전부
    `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 두 후속 항목(walker
    통합·낡은 spec 캐스트 가드)에 직접 결속돼 있고, 두 체크박스가 `[x]` 로
    반영돼 있음도 diff 로 확인했다.
  - 제안: 조치 불필요.

## 이번 라운드 신규 커밋(`cfc69dd63`) 개별 확인

직전 라운드(`03_58_32`) 리뷰 이후 새로 추가된 커밋은 `cfc69dd63` 하나뿐이고, 실질
diff 는 `masked-reject-callers.spec.ts` 한 파일(+17/-17줄)이다. 내용은 **블록
재배치뿐**이다 — 6R(`d44a8b637`)에서 새 `describe` + JSDoc 을 파일 상단에 끼워
넣으며 그 아래 있던 기존 JSDoc(`Manual 실행 경로가 마커 거부를 건너뛰지 못하게
한다…`)이 자기 `describe('resolveTriggerParameters 직접 호출부 허용목록', …)` 로부터
떨어져 orphan 이 됐던 것을, 새 블록을 앞으로 빼고 원본 JSDoc 을 원래 자리로
되돌려 정정했다. 새 로직·새 동작·새 파일 없음 — 직전 라운드가 지적한 문제(1R
W4 와 동형의 재발)에 대한 좁은 대응이다. 커밋 diff 나머지는 `review/code/2026/09/04/03_58_32/**`
(직전 라운드 산출물 커밋)로, 위 두 번째 발견사항과 동일한 범주다.

## 요약

이 브랜치는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 명시된
두 후속 항목 — ① `repo-guards/__tests__/` 5개 가드에 중복된 디렉터리 walker를
`common/__test-utils__/source-scan.ts` 의 `collectTsFiles` 로 추출·통합, ②
`.spec.ts` 에 남은 "넓혀진(nullable화된) 엔티티 필드를 겨눈 낡은 `null as unknown
as` 캐스트"를 잡는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`) 추가 —
를 그대로 수행하며, 이후 7라운드의 리뷰-수정 루프를 거쳤다(1R~7R, 각 라운드가 앞
라운드의 지적에 국한된 조치만 함 — `sort()` 커버리지 반증, `stripLiterals`
테스트 추가, fixture 헬퍼 통합, JSDoc orphan 정정, 이름-충돌 오탐 제거, 옵션
배선 미검증 보강, JSDoc orphan 재발 정정). 실질 코드 변경은 core 유틸
(`source-scan.ts`/`.spec.ts`), 그 유틸을 소비하는 4개 가드, 신규 가드가 붙은
파일(`nullable-type-lie-cast-guard.ts`/`.spec.ts`), `masked-reject-callers.spec.ts`
(배선 검증 테스트), plan 문서로 국한되고 전부 두 항목 또는 그에 대한 리뷰
피드백에 직접 결속된다. import 정리(불필요해진 `fs` 제거·필요해진
`collectTsFiles` 추가)도 실제 사용 여부와 정확히 일치하며, 요청 범위 밖의 기능
확장·무관한 리팩토링·의미 없는 포맷팅·불필요한 주석/설정 변경은 발견되지
않았다. 유일하게 반복 기록되는 경계 지점(`masked-reject-callers-guard` 의
`.d.ts`/정렬 부수 적용)은 저자가 실측 근거를 남기고 여러 라운드에 걸쳐 이미
검토된 의도적 결정이다. 리뷰 산출물이 코드와 같은 브랜치에 누적 커밋되는 것은
이 저장소의 확립된 관례이지 스코프 이탈이 아니다.

## 위험도

NONE
