# RESOLUTION — `17_32_01` (Critical 0 · WARNING 2 · 수렴)

직전 라운드(`17_06_14`)가 WARNING **6**, 이번이 **2**. 남은 둘은 성격이 갈리고 **둘 다 코드
조치가 없다** — 발견의 성격이 동작 → 구조 → 문서로 내려왔으므로 수렴으로 판정한다.

## W1 (api_contract/side_effect/documentation) — 반영 안 함 · 이 변경의 정의 그 자체

**지적**: dual-emit 없는 breaking `error.code` rename.

리뷰어 스스로 *"이미 대부분 처리됨(재확인용) … 추가 조치 불요"* 로 적었다. 이 WARNING 은
**고쳐서 사라지는 종류가 아니다** — 사용자가 통일을 결정한 이상 breaking 은 이 변경의 정의다.
구조적으로도 `error.code` 는 단일 스칼라라 alias 를 실을 자리가 없다(리뷰어도 확인).

이미 한 것: `error-codes.md §5` 에 **본 표 최고 리스크 등급** 행으로 등재 · `CHANGELOG.md`
breaking 고지 · plan §Rationale 에 dual-emit 기각 근거.

> 리뷰어가 남긴 유일한 잔여 액션은 *"배포 시 외부 API consumer 채널 공지 여부"* 이고, 그건
> **배포 담당자의 일**이지 이 PR 의 코드/문서 조치가 아니다. PR 본문에 옮겨 적어 둔다.

## W2 (documentation) — 반영 (PR 생성 직후)

`error-codes.md §5` 신규 행의 `#TBD_PR` → 실제 PR 번호. **PR 번호는 생성 전에 존재하지
않으므로** 순서가 강제된다: `gh pr create` → 치환 커밋 → `grep -rn TBD_PR spec` = 0 확인.

## INFO 17건 — 조치 없음

대부분 **직전 라운드에서 이미 처분한 항목의 재확인**이거나 긍정 관찰이다. 새로 값진 것 둘:

- **INFO 10 (testing, 긍정)** — 리뷰어가 발행부 리터럴을 되돌려 **독립적으로 뮤테이션을
  재현**했고 2개 테스트가 실제 RED 임을 확인했다. 내 대조군 실측(`17_06_14` RESOLUTION W5)과
  일치한다.
- **INFO 4 (maintainability)** — 최상위 에러 코드 리터럴이 3파일에 중복. **이번 drift 를 낳은
  구조적 원인**이라 값지지만 저장소 전역 관례이고 이 PR 이 만든 것이 아니다. 후속 plan 후보로
  트래커에 남길지는 planner 판단.
