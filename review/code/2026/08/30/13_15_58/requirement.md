STATUS=success requirement review complete
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `ALLOWED` 허용목록은 **파일 단위 전면 면제**라, 발견형 가드가 스스로 내세운 "판정은 존재가 아니라 개수로 한다"는 핵심 설계 원칙이 이 경로에서는 적용되지 않는다 — 이미 ALLOWED 인 파일에 **새로운(미가드) raw UPDATE/DELETE … RETURNING 지점**이 추가돼도 가드가 조용히 통과시킨다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:153`-`171`(`ALLOWED` 배열 정의), `:215`-`227`(판정 로직, 특히 `:218` `if (allowed.has(rel)) return false;`)
  - 상세: `discover()`는 파일마다 `rawCount`(그 파일의 raw 지점 **개수**)를 함께 돌려주고, 신규 판정은 `guardCount < rawCount`로 개수를 직접 비교한다 — 이것이 이번 라운드에서 고쳐진 부분(직전 리뷰 WARNING #2, "파일 단위 존재-only 판정" 지적)이다. 그런데 `unguarded` 필터는 `allowed.has(rel)`이 참이면 **`rawCount`를 아예 보지 않고** 그 자리에서 `false`를 반환해 필터를 통과시킨다(:218). 즉 `ALLOWED` 항목 4개(`stuck-document-recovery.service.ts`·`agent-memory-admin.service.ts`·`integration-oauth.service.ts`·`kb-stats.helper.ts`)는 그 파일 안에 raw 지점이 몇 개가 되든(오늘 1개든, 내일 5개로 늘든) 카운트 검증 자체가 실행되지 않는다. 각 `ALLOWED` 항목의 사유(예: `kb-stats.helper.ts` — "반환값을 소비하지 않는다")는 **오늘 존재하는 그 1개 지점**에 대한 판단인데, 면제는 **그 파일 전체**에 걸린다 — 사유의 범위와 면제의 범위가 어긋난다. 예컨대 `kb-stats.helper.ts`에 새 메서드가 추가되며 두 번째 `UPDATE … RETURNING`을 (이번에 정정 대상이 됐던 것과 똑같이) 헬퍼 없이 직접 소비하는 지점이 생겨도, 파일이 이미 `ALLOWED`에 있다는 이유만으로 이 가드는 여전히 GREEN이다. RESOLUTION.md의 뮤테이션 검증(#3: "허용목록 **밖** 파일에 raw 2개+헬퍼 1개")은 정확히 이 비-ALLOWED 경로만 검증했고, "ALLOWED 파일 안에 새 raw 지점이 느는" 시나리오는 예측/실측 표에도, docstring의 "이 축이 안 보는 것" 절에도 없다 — 같은 세션의 postmortem(`review/code/2026/08/30/12_41_15/RESOLUTION.md`)이 스스로 제목 붙인 "가드가 자기 결함 클래스를 가졌다"의 잔여 인스턴스다.
  - 제안: `ALLOWED`도 (파일, 사유) 대신 (파일, 사유, 그 사유가 유효한 raw 지점 수)로 두고 `discovered`의 `rawCount`와 비교하거나, 최소한 docstring의 "왜 필요한가"/"판정은 존재가 아니라 개수로 한다" 절에 "ALLOWED 항목은 파일 전체가 면제되며 그 파일 안에 새 raw 지점이 늘어도 이 가드는 잡지 못한다"는 한계를 명시할 것.

- **[INFO]** 직전 리뷰 라운드(`review/code/2026/08/30/12_41_15/`)의 requirement/testing WARNING 은 실측상 정확히 고쳐졌다 — 코드를 직접 열람하고 재현해 확인함.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:111-112`(`CALL` 정규식), `:100-121`(`countRawUpdateReturning`), `codebase/backend/src/common/__test-utils__/source-scan.spec.ts:67-136`(신규 `describe`), `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts:19-27,42-43`
  - 상세: (1) 중첩 제네릭 `.query<Array<{...}>>(` 매치 실패 — `node -e`로 옛/새 정규식을 직접 실행해 재현: 새 정규식은 1단계 중첩까지 정확히 매치하고(`count=1`), 2단계 중첩은 여전히 못 받는 것도 docstring이 명시적으로 disclose한 그대로임을 확인. (2) `hasRawUpdateReturning`/`countRawUpdateReturning` 전용 단위 테스트 부재 — 양성 6·음성 5·다중지점 1건, 총 12건 신설 확인. (3) discover 가드의 존재-only 판정 — `guardCount < rawCount` 비교로 강화됨을 코드로 확인(단, 위 WARNING 처럼 ALLOWED 경로는 예외). (4) `kb-stats.helper.spec.ts` mock이 diff 밖에서 여전히 옛 shape을 썼던 문제 — `[[{...}], 1]` / `[[], 0]` 튜플로 정정됨을 확인. `npx jest`로 관련 3개 스펙 파일을 직접 실행해 36/36 GREEN을 재확인했다(3 suites, 0.541s).
  - 조치 불요 — 참고 기록(이번 라운드가 "고쳤다고 주장한 것"이 실제로 고쳐졌는지의 근거).

- **[INFO]** spec fidelity — `raw UPDATE/DELETE … RETURNING → updateReturningRows`(또는 개수 매칭) 불변식이 `spec/conventions/`에 문서화된 규약으로 존재하지 않는다(`spec/` 전수에서 `updateReturningRows` 언급 0건, `RETURNING` 언급은 execution-engine/embedding-pipeline 등 무관 문맥뿐).
  - 위치: `spec/conventions/` 전수 grep 0건(직접 확인)
  - 상세: `plan/in-progress/update-returning-tuple-shape.md:409`(`[planner 위임]`)가 이미 규약 승격을 다음 턴으로 명시 위임했고, 같은 세션 consistency-check(`review/consistency/2026/08/30/12_17_21/SUMMARY.md` INFO #1)도 독립적으로 같은 결론(부재이지 위반 아님)에 도달했다. spec 부재이지 모순이 아니므로 CRITICAL 아님.
  - 조치 불요(이미 추적 중).

- **[INFO]** `review/code/2026/08/30/12_41_15/**` 및 `review/consistency/2026/08/30/12_17_21/**` (파일 8~28) 는 이전 워크플로 라운드가 생성한 산출물이 이번 diff에 신규 커밋된 것으로, `CLAUDE.md`가 정한 경로 규약과 정확히 일치하는 정상 산출물이다 — 별도 "요구사항" 결함 대상이 아니다.

### 요약

핵심 신규 로직(`countRawUpdateReturning`/`hasRawUpdateReturning`, discover 기반 `describe`, `kb-stats.helper.ts` 타입 정정)은 의도한 기능("손으로 고른 3파일 밖의 새 raw UPDATE/DELETE...RETURNING 지점을 발견하고 개수로 정밀 판정")을 구현하며, 직전 리뷰 라운드가 지적한 4개 항목(중첩 제네릭 미탐지·전용 단위테스트 부재·파일단위 존재-only 판정·`kb-stats.helper.spec.ts` mock 불일치)은 실측(정규식 재현·jest 36/36 GREEN)으로 확인되는 만큼 정확히 고쳐졌다. 다만 그 수정 자체에 새로운 정밀도 gap이 하나 남는다 — `ALLOWED` 허용목록은 여전히 **파일 단위 전면 면제**라서, 이번에 고친 "개수로 가른다"는 원칙이 ALLOWED 파일 안에 새로 생기는 raw 지점에는 적용되지 않는다. 오늘은 활성 버그가 아니지만(4개 ALLOWED 파일 모두 사유가 현재 상태와 일치), 이 PR/트래커가 반복 강조해 온 "입력 집합 자체가 커버리지"라는 원칙이 ALLOWED 경로에서는 파일 식별자 하나로 다시 좁아진 것이라, 이 가드가 스스로 진단한 결함 클래스("가드가 자기 결함 클래스를 가졌다")의 잔여 사례로 판단한다. spec 쪽은 관련 규약이 `spec/conventions/`에 아직 없음을 확인했으나 이미 planner 위임으로 추적 중이라 문제 삼지 않는다.

### 위험도

MEDIUM
