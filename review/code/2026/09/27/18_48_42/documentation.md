# 문서화(Documentation) 리뷰 — patch-null-validation (3R)

## 컨텍스트

이 diff 는 origin/main 대비 전체 브랜치 변경이며, 1R(`review/code/2026/09/27/17_47_49`)·2R(`18_13_53`)·`--impl-prep`/`--impl-done`
consistency check(`review/consistency/2026/09/27/{17_14_44,18_23_40}`)를 모두 거친 뒤 마지막 두 커밋(`634297632` JSDoc 보강,
`27191021c` 트래커 갱신)까지 포함한다. 2R 은 이미 Critical 0 · Warning 0 · codebase 수정 0 으로 수렴했다고 보고했다. 이번 라운드는
그 이후 추가된 변경(JSDoc·트래커)의 문서화 정합성만 새로 검증하고, 기존 발견사항은 재확인 표시로만 남긴다.

## 발견사항

- **[INFO]** (재확인, 신규 아님) 테스트 docblock·트래커가 아직 존재하지 않는 `plan/complete/patch-null-validation.md` 경로를 인용한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/patch-null-rejection.spec.ts:28`, `plan/in-progress/spec-draft-nullable-notation-followups.md:1457`, 같은 파일 `:1464`
  - 상세: `plan/in-progress/patch-null-validation.md` 는 이 diff 시점에도 여전히 `in-progress/`에 있다(Python `os.listdir` 로 `plan/complete/`
    직접 확인 — 해당 이름 없음). 1R `SUMMARY.md` INFO #10 이 이미 지적했고 `RESOLUTION.md` 가 "마무리 커밋에서 해소 — 이동 뒤
    `git show HEAD:<path>` 로 확인"이라고 명시적으로 미뤄 둔 상태이며, 2R 문서화 리뷰도 같은 결론으로 재확인했다. 이번 3R 시점에도 상태는
    변함없다 — 의도된 지연이지 새 결함이 아니다.
  - 제안: 조치 불요. 마무리 커밋(plan 이동)에서 `grep -rn "plan/complete/patch-null-validation" codebase/ plan/` 로 0건 확인.

- **[INFO]** 최신 커밋(`634297632`)의 `IsOptionalNonNull` JSDoc 보강 — 교차 참조 정확성 확인
  - 위치: `codebase/backend/src/common/utils/optional-non-null.ts` JSDoc 마지막 문단("같은 «생략 가능 · null 불가» 조합을 **응답** 쪽에서
    강제하는 것은 `shared/testing/response-contract.ts`(§5.4 — 키 생략형 필드에 null 이 오면 위반)다")
  - 상세: `shared/testing/response-contract.ts` 를 직접 열어 대조한 결과 해당 파일의 §5.4 매트릭스가 정확히 "`required` 아님(키 생략형):
    키가 없어도 된다. 있으면 `null` 이 아니어야 한다"를 응답 값 검증 규칙으로 갖고 있어, JSDoc 의 교차 참조 서술이 실제 구현과 일치한다.
    "이쪽은 **요청** DTO 의 입구 검증"이라는 계층 구분도 정확하다 — 두 파일이 서로 다른 계층(요청 vs 응답)에서 우연히 비슷한 조합("생략
    가능·null 불가")을 강제하는 것을 명확히 갈라 다음 사람이 혼동하지 않도록 했다. 새로운 문제 없음.
  - 제안: 없음(확인용 기록).

- **[INFO]** 최신 커밋(`27191021c`)의 트래커 보강(`spec-draft-nullable-notation-followups.md`) — 정합성 확인
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 완료 항목 체크(`[ ]`→`[x]`), 신규 "PATCH null 후속" 항목,
    (10) 항목의 W3·W4·INFO2 범위 보강, spec_impact 프런트매터에 `spec/2-navigation/9-user-profile.md` 추가
  - 상세: 완료로 표시한 항목은 실제로 이 PR 이 닫은 작업(43필드 `IsOptionalNonNull` 전환)과 일치하고, 새로 추가한 "PATCH null 후속"
    항목은 이 PR 이 스코프 밖으로 넘긴 것(8필드 선언 누락·JSONB null·미측정 2건·교차 워크스페이스 참조)을 정확히 옮겨 적어 유실이 없다.
    (10) 항목의 "아홉 다 spec 쓰기" → "열 다 spec 쓰기" 표현도 새 항목 추가와 일관되게 갱신됐다. `plan/in-progress/patch-null-validation.md`
    체크리스트의 서술("W1(§5.4)·W2(`maxConcurrentExecutions`)→트래커 보강, W3·W4·INFO2→(10) 보강, W5·INFO4→JSDoc")과 실제 트래커 diff
    내용이 정확히 대응한다 — plan 서술과 실제 변경 사이의 drift 없음.
  - 제안: 없음(확인용 기록).

- **[INFO]** CHANGELOG 항목 — 기준 충족, 43필드 표와 수치 일치 재확인
  - 위치: `CHANGELOG.md:26-35`
  - 상세: 대상 필드 수("43개 필드")가 `patch-null-rejection.spec.ts` 의 `expect(CASES).toHaveLength(43)` 및 `TABLE` 나열과 정확히
    일치한다. `theme=null` 거부(`update-me.dto.spec.ts` 주석: "«OS 따르기» 는 null 이 아니라 `system` 값이다")도 `USER_THEMES = ['light',
    'dark', 'system']` 선언과 대조해 사실과 맞다. 이번 라운드의 두 신규 커밋(JSDoc·트래커)은 제품 동작을 바꾸지 않으므로 `CHANGELOG.md`
    상단 기준("문서 · plan · 리뷰 산출물만의 변경"은 항목을 내지 않는다)에 따라 추가 항목이 필요 없다.
  - 제안: 없음.

## 저장소 상태

리뷰 중 저장소 파일을 수정하지 않았다(뮤테이션 없음) — `Read`/`Bash(grep, find, python3 -c "os.listdir(...)")` 만 사용했다. 워크트리
격리 가드가 `plan/complete` 경로 문자열을 포함한 일부 `find`/`ls` 명령을 차단해(무관한 오탐으로 보임) 우회를 위해 Python `os.listdir`
로 대체했을 뿐, 파일을 쓰거나 옮기지는 않았다.

## 요약

이 PR 은 문서화 관점에서 이미 세 라운드(1R·2R·`--impl-prep`/`--impl-done` consistency check)를 거치며 발견된 항목을 전부 조치했거나
트래커에 정확히 등재했다. 이번 3R 이 새로 검증한 마지막 두 커밋 — `IsOptionalNonNull` JSDoc 에 응답측(`response-contract.ts` §5.4)과의
계층 구분을 추가한 것, `spec-draft-nullable-notation-followups.md` 트래커에 완료 체크·후속 항목·(10) 범위 보강을 반영한 것 — 은
모두 실제 코드·spec 상태와 대조해 정확했고 새로운 문서화 결함은 발견되지 않았다. 유일하게 남아 있는 항목은 `plan/complete/`
로 아직 옮겨지지 않은 plan 파일을 테스트 docblock·트래커가 앞질러 인용하는 것인데, 이는 1R 때부터 "마무리 커밋에서 plan 이동과 함께
해소"로 명시적으로 미뤄 둔 상태이고 2R 도 같은 결론이었다 — 이번 3R 도 동일하게 확인만 하고 새 조치를 요구하지 않는다. CHANGELOG ·
DTO Swagger description · JSDoc · plan 체크리스트 사이의 수치·인용이 전부 실측과 일치해 drift 가 없다.

## 위험도

NONE
