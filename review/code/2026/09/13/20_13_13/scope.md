# 변경 범위(Scope) 리뷰 — error-code-emission-axis (라운드 3)

## 검토 방법

`git diff origin/main...HEAD` 로 확정한 59개 변경 파일 전체를 대조 기준으로 삼았다(프롬프트가
크기 제한으로 diff 를 생략한 파일들 — `guide-identifier-existence.test.ts`,
`guide-identifier-scan.ts`, `plan/in-progress/error-code-emission-axis.md`, 및 다수
`review/**` 산출물 — 은 `git diff`/`git show` 로 직접 재현해 확인했다). 이번 라운드는 라운드 1
(`19_23_22`)·라운드 2(`19_51_33`) 의 `/ai-review` + `--impl-done` 지적을 반영한 두 fix 커밋
(`65256a109`→`a397ccc55`→`a4b98eda8`)까지 포함한 누적 diff다.

## 발견사항

이번 라운드에서 새로 지적할 스코프 이탈은 발견하지 못했다.

- **[INFO]** 커밋 범위에 리뷰/일관성-검토 산출물 51개(`review/code/2026/09/13/{19_23_22,19_51_33}/**`,
  `review/consistency/2026/09/13/{18_40_54,19_23_31,19_51_39}/**`)가 포함돼 있다.
  - 위치: 위 다섯 세션 디렉터리 전체(전부 신규 파일, diff 게이트가 파일 전체를 덮음).
  - 상세: 라운드 1 scope.md(`review/code/2026/09/13/19_23_22/scope.md`)가 이미 같은 질문을
    던지고 "정상 워크플로 산출물"로 판정했다. 라운드 3 시점에 그 판단을 재검증했다 — `review/`
    는 gitignore 대상이 아니고(`.gitignore` 에 미등재), `--impl-prep`/`--impl-done`/`/ai-review`
    는 CLAUDE.md 가 developer 워크플로에 의무화한 게이트이며, 세션 산출물을 커밋하는 것이
    plan 소실 방지를 위한 이 저장소의 정착된 관례다(메모리: "review 는 gitignored 아니다").
    각 세션의 내용도 실제로 이 배치의 리뷰·정합성 검토 결과이지 무관한 다른 작업의 산출물이
    아님을 확인했다 — 전부 `guide-identifier-*`/`CONTAINER_*`/`error-code-emission-axis` 를
    다룬다.
  - 제안: 조치 불필요 — 참고용 기록.

- **[INFO]** 라운드 2 fix 커밋(`a4b98eda8`)의 diff 범위 재확인.
  - 위치: `git show --stat a4b98eda8`
  - 상세: 라운드 2 는 `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts` 두
    코드 파일과 그 라운드의 `RESOLUTION.md`(`19_51_33`)만 건드렸다 — 라운드 1·2 리뷰가 지목한
    지점(수집기 진리표 대조군, `where` 다중 위치 파싱, CHANGELOG 자기모순 정정) 밖으로 번진
    수정은 없다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` (4000줄 이상의
  더 큰 트래커)에 이번 작업 중 발견한 두 개의 새 항목(spec 6파일 `CONTAINER_*` 서술 불일치,
  §1.4 카탈로그 앵커 문제)과 `--impl-prep` 예산 초과 재현 노트가 추가됐다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff: `+64/-2` 줄,
    3401-3460행대·4059행대 두 지점).
  - 상세: `git diff` 로 확인한 결과 대상 파일의 나머지 수천 줄은 diff 에 전혀 나타나지 않고,
    체크박스 토글(`- [ ]` → `- [x]`) 한 건 + 새 항목 두 개 + 노트 한 단락만 삽입됐다. 이 세
    항목 모두 `--impl-done`/`--impl-prep` 세션(`19_23_31`, `18_40_54`)이 실제로 지적한
    내용을 그 지적을 기록해 둔 정본 트래커에 옮긴 것으로, 이 작업의 정상적인 부산물이 맞는
    자리에 기록된 것이다. 스코프 이탈이 아니다.
  - 제안: 조치 불필요.

- 나머지 8개 "실질" 파일(`CHANGELOG.md`, `PROJECT.md`, `logic.mdx`, `logic.en.mdx`,
  `guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`,
  `plan/in-progress/error-code-emission-axis.md`)은 계획서(`error-code-emission-axis.md`)의
  체크리스트 항목과 1:1로 대응한다:
  - `logic.mdx:114`, `logic.en.mdx:103` — `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`
    문장 정정 각 1줄, KO/EN 대칭. 인접 문장(순환·blocking 노드 서술)은 손대지 않았다.
  - `guide-identifier-scan.ts` — 발행 축 정규식 3종, 공용 수집기 `collectMatches`(라운드 1
    리뷰가 지적한 근접 중복 해소), `collectQuotedLiterals`/`collectMessagePrefixes`/
    `collectCatalogCodes`/`isMessagePrefixOnly`, `GUIDE_NON_EMITTED_VOCABULARY` — 전부 이
    축의 직접 구현이다. 기존 4곳의 수동 `lastIndex` 관용구·`GUIDE_EXTERNAL_VOCABULARY` 등
    무관한 기존 절은 재작성되지 않았다(주석이 명시적으로 "그 리팩터는 트래커 별건" 이라 적어
    두었다).
  - `guide-identifier-existence.test.ts` — import 8개(`collectQuotedLiterals` 등) 전부
    새 "발행 축" describe 블록에서 실제로 소비된다. 미사용 임포트 없음. 라운드 2 가 추가한
    `parseWhereRefs`·`isMessagePrefixOnly` 진리표 대조군·`staleEntries` 공유 헬퍼도 모두
    같은 축의 테스트 강화이지 별개 관심사가 아니다.
  - `PROJECT.md:300` — 대상 테스트 항목 설명에 "발행 축" 한 단락만 추가, 기존 서술(3축·
    베이스라인 0·외부 어휘 목록) 보존.
  - `CHANGELOG.md` — 신규 항목 추가, 기존 항목 재작성 없음(라운드 2 가 CHANGELOG 자기모순을
    고친 흔적도 최종 diff 에 하나의 일관된 항목으로 반영돼 있다).
  - `plan/in-progress/error-code-emission-axis.md` — 이 작업 자체의 신규 추적 문서.

- 포맷팅·주석·임포트·설정 관점에서 무관한 변경은 발견하지 못했다. 백엔드 런타임 코드
  (`execution-engine.service.ts` 등)는 이번 diff 범위 밖이며, plan 이 명시하듯 엔진 동작
  자체는 변경하지 않았다.

## 요약

59개 변경 파일 전체가 두 범주로 정확히 나뉜다 — (1) `error-code-emission-axis` 계획서의
체크리스트와 1:1 대응하는 8개 실질 파일(가이드 문장 2종 정정, 발행 축 술어 구현 + 신규 면제
목록, 대응 테스트·대조군, plan/CHANGELOG/PROJECT.md 갱신), (2) 이 배치가 통과해야 하는
CLAUDE.md 의무 게이트(`/ai-review` 2라운드, `--impl-prep`/`--impl-done` 3라운드)가 낸 51개
리뷰·정합성-검토 산출물. 후자는 라운드 1 자신의 scope.md 가 이미 같은 결론을 냈고, 이번
라운드에서 `git diff`/`git show` 로 독립 재검증해도 같은 결론(정상 워크플로 부산물)이
유지된다. 라운드 2 fix 커밋도 라운드 1·2 리뷰가 지목한 정확히 그 두 코드 파일만 건드려
번짐이 없다. 의도 이상의 변경, 불필요한 리팩토링, 요청하지 않은 기능 확장, 무관한 파일 수정,
의미 없는 포맷팅/주석/임포트/설정 변경은 관측되지 않았다.

## 위험도
NONE
