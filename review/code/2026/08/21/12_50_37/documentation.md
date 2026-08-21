# 문서화(Documentation) 리뷰 — masked-marker-contract-7d2e14 (라운드 4, 12_50_37)

## 검토 방법

이번 diff(82개 변경 파일)의 대부분(파일 24~81)은 이전 3개 코드 리뷰 라운드(`11_27_29`,
`11_53_49`, `12_25_15`)와 2개 consistency-check 라운드(`10_45_52`, `10_58_25`)의 산출물
자체다. 세 라운드 모두 문서화 관점에서 이미 상세히 검토를 마쳤고(각각 NONE·LOW·NONE), 그
WARNING 들은 다음 라운드 커밋으로 실제 반영됐음을 이번에도 원본 파일을 직접 `Read`/`grep`
해서 재확인했다 — plan 체크리스트, spec R17, CI 워크플로 주석 카운트 전부 실측과 일치한다
(중복 지적 생략). 이번 라운드는 **직전 라운드(`12_25_15`)가 새로 만든 코드**를 중심으로
재검증했다:

- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문 `Read`
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` 전문 `Read`
- `git show 811a40f48` — 직전 라운드(`12_25_15` W1) 처분 커밋이 backend/frontend 양쪽에
  실제로 무엇을 바꿨는지 diff 직접 대조
- `plan/in-progress/masked-marker-shared-package.md` 전문 재확인
- `CHANGELOG.md` 현재 상태 재확인(`12_25_15` INFO "미기재" 판정 근거 재검증)

## 발견사항

- **[WARNING] `12_25_15` 라운드가 "경계를 명시했다"고 서술한 접두-겹침 수정이 backend 에만
  적용되고 frontend 자매 파일에는 반영되지 않았다 — 주석·RESOLUTION 서술이 실제 코드와
  어긋난다**
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:143`
    (`findMirrorRedeclarations` 내부 `if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;`)
    — 대조 대상은 `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:141`
    (`if (relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)) continue;`)
  - 상세: `review/code/2026/08/21/12_25_15/RESOLUTION.md` "WARNING 1"(및 커밋
    `811a40f48` 메시지)는 *"packages 를 실제로 훑게 되면서 `SOT_DIR` 접두 겹침이 **살아났다**
    — `startsWith(SOT_DIR)` 만으로는 `masked-markers-extra` 같은 형제를 오배제하므로
    **경계를 명시했다**"*라고 일반화된 문장으로 서술한다. 그런데 `git show 811a40f48 --
    codebase/backend/... codebase/frontend/...` 로 직접 대조한 결과, 그 커밋은 두 파일의
    `resolveScanDirs`(2단계 스캔 확장)는 대칭으로 고쳤지만 **경계 안전 검사
    (`=== SOT_DIR || startsWith(SOT_DIR + '/')`)는 backend 파일에만 넣었다** — frontend
    파일의 `findMirrorRedeclarations` 는 이 커밋에서 전혀 수정되지 않았고, 지금도 옛 형태
    (`startsWith(SOT_DIR)`, 경계 없음)를 그대로 쓴다. 즉 이 지점만 놓고 보면 "이 시리즈가
    접두 겹침으로 반복해 당한 자리"라는 자기 진단을 스스로 반복한 것인데, 이번엔 두 자매
    함수 중 하나에만 하드닝을 적용하고 다른 하나는 그대로 둔 형태다(memory 교훈 "방어의
    정의를 한 칸 좁게 잡는다 — 하드닝을 자매 함수 미적용"과 정확히 같은 패턴).
    실질 영향: frontend 파일의 `findMirrorRedeclarations` 바로 위 JSDoc(134행)은
    *"두 스택에서 SoT 심볼을 재선언하는 자리 전부 (**SoT 패키지 자신은 제외**)"*라고
    적혀 있는데, 실제 코드는 "SoT 패키지 자신"만 제외하는 게 아니라 **경로 문자열이
    `SOT_DIR` 로 시작하는 모든 디렉터리**를 제외한다 — 즉 향후 `codebase/packages/`
    아래 `masked-markers-v2`·`masked-markers-legacy` 같은 이름의 형제 패키지가 생기면
    그 안에서 마커 심볼을 재선언해도 frontend 가드는 **조용히 통과**시킨다(backend 가드는
    이미 이 경우를 정확히 잡도록 고쳐져 있음 — 두 가드의 판정이 대칭이어야 한다는 것이
    이 PR 전체의 핵심 전제인데 지금은 비대칭이다). 두 파일의 `masked-marker-mirror.spec.ts`
    /`.test.ts` 캐너리도 확인했으나(`it.each([...접두가 겹치는 다른 식별자...])`) 그 캐너리는
    **심볼 이름의 접두 겹침**(`MAX_MASK_DEPTH_OLD`)만 테스트하고 **디렉터리 경로의 접두
    겹침**(`masked-markers-extra/src/...`)은 양쪽 어디에도 캐너리가 없어 이 갭이 테스트로도
    가려져 있지 않다. 현재는 그런 이름의 형제 패키지가 실존하지 않아 당장 살아있는 오탐/미탐은
    아니지만, RESOLUTION.md·commit message 가 "경계를 명시했다"고 완료형으로 서술한 것과
    실제 코드 상태(backend 만 적용)가 어긋난다는 점 자체가 문서화 결함이다 — 다음 사람이
    RESOLUTION 문구만 보고 "이미 양쪽 다 고쳐졌다"고 오판할 위험이 있다.
  - 제안: (a) frontend `masked-marker-mirror-guard.ts:143` 을 backend 와 동일하게
    `relPath === sotPrefix || relPath.startsWith(\`${sotPrefix}/\`)` 형태로 맞춘다(겸사겸사
    `maintainability` 라운드1이 지적한 `SOT_DIR.split(path.sep).join("/")` 루프 내 재계산도
    한 번에 해소 가능). (b) 두 파일에 "SoT 패키지 자신은 제외"라는 JSDoc 이 실제로 정확해지도록
    캐너리에 `codebase/packages/masked-markers-extra/src/x.ts` 형태의 디렉터리 접두-겹침
    fixture 를 추가해 이 경계를 캐너리로 고정한다(현재 심볼 접두-겹침 캐너리와 대칭 구조로).

## 재확인 — 새로 악화되지 않음

- `plan/in-progress/masked-marker-shared-package.md` 는 `## 작업` 체크리스트 전 항목이 실제
  실행 경로(11_27_29 W3 처분, `--impl-done` 검증 등)와 정확히 일치하는 상태를 유지한다.
  `## 다른 plan 과의 관계` 도 `:373`·`:757` 두 트래커 항목을 모두 인지하고 있다.
- `spec/5-system/14-external-interaction-api.md` R17 은 "SoT 는 공유 패키지" 로 정확히
  갱신돼 있고 frontmatter `code:` 목록에도 `codebase/packages/masked-markers/src/index.ts`
  가 있다.
- `.github/workflows/frontend-checks.yml` 에 새로 추가된 주석(`codebase/channel-web-chat/**`
  트리거 확장 이유)은 실제 배선과 일치한다 — `backend-checks.yml` pathspec 에는
  `channel-web-chat` 이 없지만, 이는 frontend 가드가 `resolveScanDirs` 로
  `codebase/channel-web-chat/src` 를 자동 스캔하고 그 스캔은 `frontend-checks` 트리거로
  커버되므로 설계상 의도한 형태다.
- `CHANGELOG.md` 는 이번 diff 로 갱신되지 않았다 — `12_25_15` 라운드가 이미 `@workflow/
  ai-end-reason` 선례(`git log --diff-filter=A`)로 "동작 무변경 내부 패키지 추출은 이
  저장소 CHANGELOG 관행상 대상이 아니다"라고 실측 근거와 함께 조치 불요 판정했고, 이번
  재확인에서도 그 판정을 뒤집을 새 근거는 없다.

## 요약

4라운드째인 이 PR 은 문서화 완성도가 전반적으로 높다 — README·JSDoc·plan·spec 전부 이관
사실을 정확히 반영한다. 다만 직전 라운드(`12_25_15`)가 "SoT_DIR 접두 겹침을 경계 명시로
고쳤다"고 일반화해 서술한 수정이 실제로는 backend 파일에만 적용됐고, frontend 자매 파일의
`findMirrorRedeclarations` 는 옛 무경계 `startsWith` 형태 그대로 남아 있다 — 그 위의 JSDoc
("SoT 패키지 자신은 제외")도 지금은 코드 동작과 어긋난 서술이 됐다. 현재 저장소에 이름이
겹치는 형제 패키지가 없어 당장 관측되는 오탐/미탐은 아니지만, RESOLUTION.md·커밋 메시지가
완료형으로 서술한 보장과 실제 코드 상태의 불일치 자체가 문서화 신뢰도 문제이며, 이 PR 이
반복해 겪어 온 "자매 함수 중 하나만 하드닝" 패턴의 재발이라 WARNING 으로 기록한다. 그 외
새로 발견된 CRITICAL/WARNING 급 문서화 결함은 없다.

## 위험도

LOW
