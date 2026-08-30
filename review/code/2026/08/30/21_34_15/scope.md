# 변경 범위(Scope) 리뷰

## 배경

이 diff(`origin/main`..`HEAD`)는 다섯 커밋의 누적이다:

- `7d6854cb9` — report-return 계약의 file/return sink 분리(+3 워크플로 미러 +신규 테스트 2건) **+**
  `updateExecutionStatus` self-deadlock 호출 스택 감사(JSDoc, 순수 주석) — **원 커밋, 두 무관한
  주제가 한 커밋에 섞임**
- `5a33656f9` — 리뷰 라운드 `20_21_06`(WARNING 4건) 반영 + 그 라운드 산출물 커밋
- `ca260d87e` — 리뷰 라운드 `20_46_48`(WARNING 5건) 반영 + 그 라운드 산출물 커밋
- `2ca5244ae` — 리뷰 라운드 `21_12_21`(WARNING 1건, INFO 11건) 반영 + 그 라운드 산출물 커밋
- `8602c93e5` — `plan_guard` 가 요구한 연결 plan(`update-returning-tuple-shape.md`) 각주 1건

앞 세 커밋에 대한 scope 판단은 이미 `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21}/scope.md`
세 곳에 기록돼 있고, 매번 같은 결론(원 커밋의 주제 혼합만 기결 INFO, 그 외 신규 위반 없음)에
수렴했다. 아래는 그 판단을 승계하고, 이번 라운드가 처음 보는 신규분(`2ca5244ae`, `8602c93e5`)에
국한해 `git show`로 직접 검증한 결과다.

## 발견사항

- **[INFO]** 원 커밋(`7d6854cb9`)이 서로 무관한 두 결함 수정(계약 sink 분리 · self-deadlock 호출
  스택 감사)을 한 커밋에 담은 상태가 이번 diff 에도 여전히 남아 있다 — **이미 세 라운드에 걸쳐
  지적되고 처분이 끝난 기결 사안**이며, 이번이 4번째 관측이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`updateExecutionStatus` 상단 JSDoc, 함수 정의 직전 블록) · `plan/in-progress/backend-lint-gate-broken-on-main.md`
    의 "커밋 분리에 대한 판단 기록" 단락(`20_21_06 scope W4` 인용 부분, 함수 아님 — 프롬프트
    게이트 기준 311~315행 부근)
  - 상세: `20_21_06` scope 리뷰어가 WARNING 으로 지적했고, 개발자는 되돌리지 않고 plan 에 판단을
    명시 기록("사용자가 두 건을 함께 요청해 한 PR 로 묶었다", "같은 지적을 세 번째 받았다")하는
    방식으로 처분했다. `20_46_48`·`21_12_21` 두 라운드 scope 리뷰어도 같은 결론(조치 불요)을
    재확인했다. 이번 라운드가 새로 발견한 사실이 아니라 같은 커밋이 diff 표면에 계속 보이는 것뿐.
  - 제안: 조치 불요(5번째 재-revert 요구 안 함). plan 이 이미 "다음엔 커밋을 주제별로 가른다"는
    습관 교정 의도를 기록해 뒀다.

- **[INFO]** 이번 라운드의 실질 신규분(`2ca5244ae`, `8602c93e5`)은 `git show` 로 직접 대조한 결과
  전부 **직전 리뷰 라운드(`21_12_21`)와 `plan_guard` 요구를 반영하는 단일하고 일관된 활동**이다 —
  독립적으로 착상된 신규 작업이 아니다.
  - `2ca5244ae`: `execution-engine.service.ts` JSDoc 3줄(`21_12_21` WARNING — "9" 가 두 집합을
    가리키는 중의성 재도입에 대한 재정정, 괄호 문구 복원) + `plan/in-progress/backend-lint-gate-broken-on-main.md`
    8줄(같은 라운드 W1 — "새 세션에서" 문구를 "새로운 top-level 세션(같은 세션 리뷰 라운드 아님)"
    으로 못박음) + `21_12_21/**` 산출물 신규 커밋. 로직 변경 0.
  - `8602c93e5`: `plan/in-progress/update-returning-tuple-shape.md` 6줄 각주 추가뿐. 커밋 메시지가
    스스로 밝히듯 `plan_guard` 가 `execution-engine.service.ts` 변경에 대해 연결 plan 동반 갱신을
    요구했기 때문이며, 새 항목 없이 자매 plan 을 가리키는 각주만 단다.
  - 위치: 위 두 커밋 전체(`git show 2ca5244ae`, `git show 8602c93e5` 로 확인)
  - 제안: 조치 불요 — scope 위반 아님.

- **[INFO]** `.claude/tests/test_workflow_scripts.py` 의 신규 서브테스트
  (`test_guard_filename_references_point_at_this_file`)는 `20_46_48` 라운드 W1(드리프트 가드의
  구조적 사각지대 — `SHARED-BLOCK` 마커 밖 로컬 헤더 주석이 가드 검사 범위 밖이라 옛 파일명이
  방치됨)을 직접 닫는 회귀 가드다. 이번 diff 의 주제(계약 sink 분리 + 그 가드 자체의 무결성)와
  일치하며 무관한 기능 확장(over-engineering)이 아니다.
  - 위치: `.claude/tests/test_workflow_scripts.py`(신규 테스트 메서드, 프롬프트 게이트 기준
    114~140행)
  - 제안: 조치 불요.

- **[INFO]** `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21}/**` 전체(RESOLUTION·SUMMARY·
    개별 reviewer 산출물·`_retry_state.json`·`meta.json`)를 신규 파일로 커밋한 것은 CLAUDE.md
    저장 위치 규약("코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")과 이
    저장소의 기존 관행에 정확히 부합한다. drive-by 정리나 무관한 파일 추가가 아니다.
  - 위치: `review/code/2026/08/30/{20_21_06,20_46_48,21_12_21}/*`
  - 제안: 조치 불요.

- **[INFO]** `plan/complete/spec-draft-raw-query-results.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md`
  의 "2026-08-31" → "2026-08-30" 날짜 정정(오늘 날짜는 2026-08-30 — `20_46_48` 커밋 메시지의
  "오지 않은 날짜 11곳" 이 그 근거)은 이번 PR 이 직전 라운드에 새로 추가한 자기 산출물의 오탈자
  수정이며, 그 정정 범위를 벗어나는 다른 서술은 건드리지 않았다.
  - 위치: `plan/complete/spec-draft-raw-query-results.md`(프롬프트 게이트 16행), `plan/in-progress/backend-lint-gate-broken-on-main.md`(프롬프트 게이트 282행 및 다수)
  - 제안: 조치 불요.

## 검증 메모

- 저장소 트리에 아무것도 쓰지 않았다. `git log --oneline -10`, `git status --short`, `git diff origin/main..HEAD --stat`,
  `git show --stat 2ca5244ae`, `git show 8602c93e5`, `git show 2ca5244ae -- codebase/backend/.../execution-engine.service.ts plan/in-progress/backend-lint-gate-broken-on-main.md`
  로만 대조했다. 뮤테이션 없음.
- `git status --short` 결과 `review/code/2026/08/30/21_34_15/`(이 리뷰 세션 자신의 산출물 디렉터리)만
  untracked 로 잡혔다 — 다른 reviewer 가 만든 것으로 보이는 이물질은 없었다.
- 전체 43개 파일(비-review 10개 + review 산출물 33개) 중 비-review 10개 모두 위 두 주제(계약
  sink 분리 · self-deadlock 감사) 및 그 리뷰 라운드 처분으로 설명된다. 무관한 파일·포맷팅 전용
  변경·미사용 임포트·설정 파일 변경은 발견되지 않았다.

## 요약

이 changeset 은 다섯 커밋의 누적이며, 이번 라운드가 처음 보는 실질 신규분(`2ca5244ae`,
`8602c93e5`)은 직전 리뷰 라운드(`21_12_21`) 자신의 처분과 `plan_guard` 가 강제한 연결 plan
각주뿐이다 — 둘 다 `git show` 로 직접 대조해 로직 변경 0, 무관한 파일 변경 0을 확인했다. 유일하게
남은 scope 사안은 최초 커밋(`7d6854cb9`)이 서로 무관한 두 결함 수정(report-return sink 분리와
self-deadlock 호출 스택 감사)을 한 커밋에 담은 패턴인데, 이는 이미 세 라운드 전에 WARNING 으로
지적되고 개발자가 plan 에 판단(사용자 요청으로 한 PR 로 묶었고, 두 번째는 순수 주석이라 기능
위험이 없다)을 명시적으로 기록하며 처분을 끝낸 기결 사안이다. 이번 라운드에서도 추가 조치를
요구하지 않는다. 신규 테스트(`test_workflow_scripts.py` 의 가드 사각지대 폐쇄 테스트)와 반복되는
verbatim 미러 편집은 워크플로 샌드박스 제약에 따른 필수 동반 수정이지 리팩토링이나 기능 확장이
아니며, `review/**` 산출물 커밋은 CLAUDE.md 저장 위치 규약에 정확히 부합한다.

## 위험도

LOW
