# 변경 범위(Scope) 리뷰 — Batch 1 3라운드 누적 diff (`entity-nullable-column-type-mismatch`)

## 사전 확인

- `origin/main...HEAD` 기준 46개 파일, `2834 insertions(+) / 27 deletions(-)`, 브랜치
  `claude/entity-nullable-batch1`. 프롬프트가 준 46개 파일 목록과 정확히 일치한다(추가 숨은
  변경 없음).
- 3개 커밋으로 구성된다: `7ce4fa92a`(배치 1 본체: 캐스트 8건 제거 + 타입 확장) →
  `40fa58b8f`(1R 리뷰의 CRITICAL 수정 — `type: 'varchar'` 4건 + 회귀 가드 신설) →
  `52ca3128a`(2R 리뷰의 WARNING 1건 + INFO 1건 수정 — plan 후속 항목 이름 등재, docstring 낡은
  숫자 제거, 죽은 mock 제거). `af41a3c6e`(`#1269` change-password 코드 정렬)가 이미 머지된
  지점을 base 로 삼아 물리적으로 분리된 브랜치다 — plan 문서 자신이 "change-password 범위 밖"
  이라 명시한 경계가 실제로 지켜졌다.
- 마지막 커밋 `52ca3128a` 를 단독으로 diff 확인(`git show 52ca3128a`) — 커밋 메시지가 예고한
  세 가지(plan "배치 2 후보"에 (d)·(e) 이름 등재, 가드 docstring 의 "12건" 낡은 숫자 제거,
  `auth.service.spec.ts` 죽은 `findByEmail` mock 1줄 제거) **정확히 그 세 자리만** 건드렸다.
  범위를 벗어난 부수 수정 없음.
- 파일 16~46(31개)은 코드가 아니라 이전 두 라운드의 리뷰 산출물(`review/code/.../14_44_15`,
  `review/code/.../15_17_01`)과 consistency-check 산출물(`review/consistency/.../15_17_03`)
  이다. `review/`는 gitignored 가 아니고 "리뷰 반영 후 마무리 커밋에 review 산출물을 함께
  담는다"는 이 저장소의 확립된 관례(CLAUDE.md 저장 위치표)라 스코프 위반이 아니다 — 1R·2R
  scope 리뷰 둘 다 동일하게 판단했고, 이번 라운드에도 그 판단을 유지한다.
- `git status --short` 로 저장소 이상 상태를 확인 — 이번 리뷰 세션 자신의 산출 디렉터리
  (`review/code/2026/09/03/15_36_03/`, untracked) 외에는 dirty 한 파일이 없다. 리뷰 대상
  diff 밖의 잔여 변경은 관측되지 않았다.

## 발견사항

- **[INFO]** 코드 대 리뷰-산출물 비율이 라운드를 거듭할수록 커진다(1R 11개 → 2R 26개 → 3R
  46개 파일 중 실제 코드/plan 변경은 여전히 15개)
  - 위치: 파일 목록 전체(코드 15개: 파일 1~15 / 리뷰 산출물 31개: 파일 16~46)
  - 상세: 실질 변경(엔티티 타입 확장·캐스트 제거·회귀 가드·테스트 보강)은 배치 1 착수 시점
    (1R)부터 지금까지 15개 파일로 고정돼 있고, 매 라운드 리뷰가 자기 라운드의 산출물을 다음
    커밋에 실어 누적되는 구조다. 1R·2R scope 리뷰가 이미 "정보로만 남긴다"고 판단한 것과 같은
    성격이며 이번 라운드에서 새로 발생한 문제는 아니다. 다만 라운드가 늘수록 diff 규모 대비
    "무엇이 실제로 바뀌었는가"를 읽는 사람의 탐색 비용이 커지는 추세 자체는 관측해 둘 만하다.
  - 제안: 조치 불요. 이 프로젝트의 review-artifact 커밋 관례상 정상 동작이며, 배치가 `complete/`
    로 이동할 때 최종 diff 를 판단하는 사람은 파일 1~15 만 보면 충분하다.

- **[INFO]** `52ca3128a`(3라운드 반영 커밋)는 2R RESOLUTION 이 예고한 세 항목에 정확히
  국한됐다 — 새로 발견할 스코프 이탈 없음
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md`(할 일 절, (d)·(e) 추가),
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`(docstring
    "12건" 삭제 + grep 안내로 대체), `codebase/backend/src/modules/auth/auth.service.spec.ts`
    (1줄 삭제 — 미사용 `findByEmail` mock)
  - 상세: `git show 52ca3128a --stat` 로 확인한 코드/plan diff 는 3개 파일(1줄~20줄 규모)뿐이고,
    실측(현재 워킹트리 `Read`/`grep`)도 diff 내용과 일치했다. 1R·2R 이 이미 검증한 8필드 타입
    확장·캐스트 8건 제거·`type: 'varchar'` 4건·회귀 가드 2파일·신규 테스트 5건의 범위를 이번
    라운드가 추가로 넓히지 않았다.
  - 제안: 조치 불요.

## 스코프 정합성 확인 (plan 자기 서술 대비 실제 diff, 3라운드 누적 기준)

- User 필드 7건 + Schedule 필드 1건(`nextRunAt`) 타입 확장, 캐스트 8건 제거, `type: 'varchar'`
  4건 보강, 회귀 가드 2파일(guard+spec), null 대입 분기 테스트 5건 — 전부 1R·2R scope 리뷰가
  이미 필드 단위로 대조 완료했고, 이번 라운드에 파일 1~15 를 다시 대조해도 동일하게 일치한다.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 수정분은 이번 배치 자체의
  결정·완료 기록·후속 항목(§2.9 문서 정정은 **developer 권한 밖**이라 planner 턴으로 명시
  이관, 공용 walker 추출 이연, 배치 2 후보 (a)~(e))에 국한되며 다른 트래커·spec 파일을
  건드리지 않는다.
- 무관한 모듈(다른 컨트롤러·DTO·프론트엔드)·설정 파일 변경, drive-by import 정리, 불필요한
  주석 변경은 파일 1~15 전체에서 발견되지 않았다.

## 요약

3라운드 누적 diff(46개 파일, 2834+/27- 라인)의 실질 코드·plan 변경은 여전히 15개 파일로,
plan 문서가 스스로 선언한 "배치 1 — 캐스트를 강제하던 8필드 타입 확장 + 캐스트 8건 제거"
범위와 필드 수·캐스트 수가 정확히 일치하며, 그 위에 얹힌 두 차례 리뷰 라운드의 수정(CRITICAL
부팅 실패 수정, WARNING/plan-tracking 수정)도 각 RESOLUTION 문서가 예고한 범위에 정확히
국한됐다 — 특히 마지막 커밋(`52ca3128a`)을 단독 대조한 결과 예고된 3자리(plan 후속 항목
이름 등재·낡은 숫자 제거·죽은 mock 제거) 밖의 변경은 없었다. 나머지 31개 파일은 이전 두
리뷰 라운드 및 consistency-check 의 산출물이며, 이를 마무리 커밋에 함께 싣는 것은 이
저장소의 확립된 관례(`review/**` 는 SoT 산출 위치)로 1R·2R scope 리뷰가 이미 위반이 아니라고
판단했고 이번 라운드도 같은 결론을 유지한다. change-password 작업(`#1269`)과는 별도 브랜치로
물리적으로 분리돼 있어 스코프 혼입도 없다. 무관한 파일·포맷팅 드라이브바이·불필요한 주석/
임포트 변경은 발견되지 않았다.

## 위험도

LOW
