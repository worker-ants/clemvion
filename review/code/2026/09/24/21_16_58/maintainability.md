# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** job 이름과 실제 실행 범위의 불일치 — 이미 주석으로 완화됨
  - 위치: `.github/workflows/spec-link-checks.yml:90` (`spec-link-integrity:` job 정의), `:113` (`- name: docs guards (src/lib/docs/__tests__ 전체)` 스텝)
  - 상세: job 키는 `spec-link-integrity` 그대로인데 실제로는 `src/lib/docs/__tests__/` 디렉터리 전체(플랜·spec 가드 5종 이상)를 실행한다. GitHub Actions UI 의 job pill(=`spec-link-integrity`)과 그 안의 step 이름(=`docs guards (src/lib/docs/__tests__ 전체)`)이 서로 다른 이름을 대므로, 이력을 모르는 사람이 checks 탭만 보면 "spec-link-integrity 라는 가드 하나만 도는구나" 로 오독하기 쉽다. 다만 이 diff 는 그 위험을 인지하고 job 정의 바로 위(85~89행)와 step 바로 위(112행) 양쪽에 "왜 이름을 유지하는지" 설명 주석을 이미 붙여 두었고, `test_workflow_yaml_structure.py` 가 이름을 앵커로 고정하는 설계도 plan(`plan/in-progress/docs-guard-trigger.md` §B)에 근거가 있다.
  - 제안: 코드 변경은 불필요. 다만 job 표시 이름을 바꿀 수 있다면(`name:` 필드는 없고 job id 만 있음) 다음 기회에 `spec-link-integrity` → 예: `docs-guards` 같은 범위를 더 정확히 반영하는 id 로 옮기는 것을 후속 검토 대상으로만 남겨도 된다 — 지금 당장 바꾸면 required check 앵커가 깨지므로 이번 PR 스코프는 아니다.

- **[INFO]** 같은 사실("2026-09-24 셋째 판 갭 발견 → 디렉터리째 실행")을 파일 안 세 지점에서 반복 서술
  - 위치: `.github/workflows/spec-link-checks.yml:19-29`(파일 헤더), `:85-89`(job 상단), `:112`(step 상단)
  - 상세: 헤더 블록이 이미 "왜 디렉터리째 도는가"와 "job 이름을 왜 유지하는가"를 모두 설명하는데, job 상단 주석(85~89행)이 job 이름 유지 이유를 다시 설명하고, step 상단 주석(112행)이 "디렉터리째" 이유를 한 번 더 축약 반복한다. 각 주석이 그 자리의 국지적 근거를 대는 합리적 배치이긴 하나, 세 곳이 거의 같은 문장("이름 유지 = `#1106`/required check", "디렉터리째 = 열거하면 잊는다")을 부분적으로 되풀이해 파일을 처음부터 끝까지 읽을 때 체감 밀도가 높다.
  - 제안: 기능상 문제는 아니므로 필수 수정 아님. 장기적으로 헤더가 "왜"를 전담하고 job/step 주석은 "여기서 무엇이 유효한지"만 한 줄로 가리키는 형태로 압축하면 각 지점의 정보 중복이 줄어든다.

- **[INFO]** CI 워크플로 헤더 주석이 날짜별 addendum 을 계속 누적하는 패턴
  - 위치: `.github/workflows/spec-link-checks.yml:1-29` (전체 파일 컨텍스트 기준)
  - 상세: 이 파일은 이미 2026-08-27 addendum(15~17행)을 갖고 있었고, 이번 diff 가 2026-09-24 addendum(18~29행, 12줄)을 추가했다. 헤더 주석이 사실상 인라인 CHANGELOG 역할을 하며 계속 길어지는 구조다. 이 프로젝트가 harness/워크플로 파일에서 "근거를 코드 옆에 남긴다"는 컨벤션을 의도적으로 쓰고 있고(PROJECT.md·CLAUDE.md 본문에도 동일 패턴이 반복됨) 이 자체는 팀 컨벤션과 일치하므로 위반은 아니다. 다만 이 파일의 실질 YAML(`on`/`permissions`/`jobs`)은 약 60줄인데 헤더 주석만 29줄이라, 앞으로 네 번째 addendum 이 붙으면 실질 설정을 찾기 위한 스크롤 비용이 계속 커진다.
  - 제안: 지금 당장 조치 불필요 — 컨벤션 일관성 관점에서는 오히려 준수. 다만 다음 addendum 부터는 근거를 링크된 plan(`plan/complete/**`)으로 옮기고 헤더에는 한 줄 포인터만 남기는 것을 고려할 만하다.

- **[INFO]** `PROJECT.md` 문서 링크 검증 절의 구조가 다소 산만해짐
  - 위치: `PROJECT.md:378-388` (`#### 변경된 코드 (unified diff)` 게이트 기준)
  - 상세: 개정 후 문단이 "CI가 강제한다 → 이제는 가드 전체가 돈다 → 명령 예시 → '이 절의 나머지(스코프 3가지)는 그중 spec-link-integrity 가드의 검사 범위다'" 순으로 이어지는데, 마지막 문장이 뒤에 나오는 "검사 스코프 3가지" 절과의 관계를 사후적으로 설명하는 형태라 처음 읽을 때 "이 절"이 무엇을 가리키는지 한 번 더 생각해야 한다. 오류는 아니고 정보량 관점의 사소한 가독성 이슈.
  - 제안: 선택적으로 "검사 스코프 3가지" 절 바로 위에 소제목("### spec-link-integrity 가드의 세부 스코프")을 하나 추가하면 "이 절의 나머지는…" 이라는 메타 서술 없이도 관계가 명확해진다. 필수는 아님.

## 요약

이번 변경은 대부분 CI 워크플로 설정(`spec-link-checks.yml`)과 문서(`PROJECT.md`), 신규 plan 문서, 그리고 `/consistency-check` 산출 리포트(`review/consistency/...`, 읽기 전용 생성물)로 구성되어 전통적 의미의 함수·클래스 코드는 포함하지 않는다. 실질 로직 변경은 pathspec 목록에 `plan/**` 한 줄을 추가하고, 개별 테스트 파일 지정을 디렉터리 지정으로 바꾼 것이 전부이며 둘 다 사소하고 명확하다. 발견된 사항은 모두 INFO 수준으로, job id(`spec-link-integrity`)가 이제 실제 실행 범위보다 좁게 들리는 네이밍 잔존 이슈와 같은 사실을 파일 내 세 지점에서 부분 반복 서술하는 점 정도이며, 둘 다 이미 저자가 근거 주석으로 완화해 두었고 기능적 결함은 아니다. 유지보수성 관점에서 차단할 사유는 없다.

## 위험도
NONE
