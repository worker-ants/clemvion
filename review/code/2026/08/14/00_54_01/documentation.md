# 문서화(Documentation) 리뷰 결과

## 검토 방법

이 diff(`origin/main...HEAD`, 13커밋)는 `update-returning-tuple-shape` 결함 수정(TypeORM
`UPDATE`/`DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플인데 8곳이 행 배열로 오인)과, 그
과정에서 이미 8차례(`20_36_35`/`22_45_24`/`23_07_11`/`23_27_48`/`23_46_00`/`00_00_44`/
`00_20_21` ai-review + 7라운드 consistency-check) 진행된 리뷰 세션 산출물의 누적 커밋으로
구성된다. 직전 라운드들이 찾은 CRITICAL·WARNING(모순 주석·`unknown` 통일 누락·`detail` 인자
생략·"넷/다섯" 불일치·`spec_impact` 자기모순·CHANGELOG 소급 정정 누락 등)은 현재 소스를
`Read`/`Grep`으로 직접 재확인한 결과 전부 반영돼 있음을 확인했다. 이번 라운드는 (a) 핵심 소스
5개 파일(`update-returning-rows.ts`/`.spec.ts`, `execution-engine.service.ts`,
`knowledge-base.service.ts`, `auth-oauth.service.ts`)의 문서 상태 재확인과, (b) 가장 마지막
커밋(`e34a85b44`, rememberMe 컬럼명 결함 수정)이 남긴 `CHANGELOG.md` 갱신 자체의 내부 정합성
점검에 집중했다. 그 과정에서 이전 라운드가 놓친 새 불일치 1건을 찾았다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 "소급 정정" 이 같은 주장을 하는 두 섹션 중 **한쪽에만** 붙었다
  — 다른 섹션(이 PR 이전부터 존재)은 여전히 무효화된 방어를 검증된 사실처럼 서술한다.
  - 위치: `CHANGELOG.md:312-316` (섹션 `## Unreleased — retry_last_turn 재진입: 종결 경로
    terminal 가드 + 원자 claim + 짝 전이 persist 수정`, 항목 1) — 정정이 붙은 곳은
    `CHANGELOG.md:354-368` (섹션 `## Unreleased — AI multi-turn resume turn 경계 cancel
    가드 + park 짝 전이 lost-update 차단`, 항목 7 뒤의 `> 소급 정정 (2026-08-14)` 블록).
  - 상세: 두 섹션의 항목은 **완전히 같은 코드 변경**을 서술한다 — `retry-turn.service.ts` 의
    `failRetryExecution` + `completeRetryExecution` 을 공용 `finalizeGuarded` 로 통일한 것
    (실측: `retry-turn.service.ts:578` `finalizeGuarded`, `:706` `completeRetryExecution`,
    `:917` `failRetryExecution` — 두 호출자 모두 `finalizeGuarded` 를 거친다). `:312-316`
    (`git blame` 확인: `dc81d21c9b`, 2026-07-31, 이 PR 이전부터 `origin/main` 에 존재)은
    "전이 불가 또는 조건부 UPDATE 0행이면 저장·이벤트 발행을 모두 skip 한다" 고 쓰고,
    `:354`(같은 PR 내 이전 커밋에서 이미 존재)는 "이 guarded UPDATE 자체도 `affected` 가
    0이면 … 종결 이벤트 emit 을 skip 한다" 고 **거의 동일한 문장**으로 같은 사실을
    서술한다. 그런데 `e34a85b44`(이 PR 의 최종 커밋)가 붙인 소급 정정 블록은 "위 1·5·6·7번"
    이라고 **자기 섹션 안의 번호만** 가리킨다 — `:312-316` 섹션의 항목 1은 그 "1·5·6·7"
    카운트에 포함되지 않는다(다른 섹션이라 번호 체계가 독립적이다). 즉 `:312-316` 을 먼저
    읽는(또는 그 섹션만 읽는) 독자는 "`updateExecutionStatus` 의 0행 skip 방어가 이미
    검증된 동작" 이라고 믿게 되는데, 실제로는 `8332d9a20`(2026-08-13) 이전엔 TypeORM
    튜플 오인으로 `updated.length > 0` 이 항상 참이라 그 방어가 **한 번도 발동하지
    않았다**(같은 정정 블록이 스스로 명시한 사실). `plan/in-progress/
    update-returning-tuple-shape.md:233` 의 `[x] CHANGELOG — 이번 결함 Unreleased 항목 +
    기존 1·5·6·7 소급 정정` 체크박스도 정확히 이 두 섹션 중 하나만 반영된 상태로 완료
    처리돼 있다. 이 PR 자신이 반복해 진단해 온 "처방이 그 자리에만 갇힌다" 패턴이 정확히
    같은 PR 의 최종 커밋에서 CHANGELOG 안에 재현된 사례다.
  - 제안: `:312-316` 바로 뒤(또는 섹션 끝)에 짧은 소급 정정 한 줄을 추가한다 — 예:
    "이 항목의 `finalizeGuarded` 0행-skip 방어도 `8332d9a20` 이전엔 발동하지 않았다.
    상세는 아래 `AI multi-turn resume turn 경계` 섹션의 소급 정정 참조." 또는 두 섹션이
    같은 코드를 중복 서술하고 있다는 사실 자체를 인지해 한쪽으로 통합하는 것도 고려할 만하다.

## 참고 (이전 라운드 대비 재확인 — 신규 아님)

- 핵심 신규 코드(`update-returning-rows.ts` JSDoc, `auth-oauth.service.ts` 의
  `AuthOAuthStateRow` docstring 및 인라인 주석, 신규 e2e
  `auth-oauth-callback.e2e-spec.ts`)의 문서화 품질은 이전 라운드 평가대로 여전히 높다 —
  실측 근거·실패 모드·타 관용구 대비표·"왜 지금까지 아무도 못 봤나"가 각 지점에 유지돼
  있음을 직접 확인했다.
- `knowledge-base.service.ts:533`(embedding 재큐)과 `:569`(graph 재큐)는 이전 라운드가
  지적한 `query<{id:string}[]>` vs `unknown` 불일치가 해소돼 둘 다 `unknown` 으로 통일돼
  있다(재확인).
- `update-returning-rows.spec.ts` 의 `EXPECTED` 주석은 2-tuple 표현으로 정정돼 있고,
  `it.each` placeholder 이름도 `assert-row-array.spec.ts` 와 동일하게 `_label`/`value` 로
  맞춰져 있다(재확인, 이전 INFO 해소).
- `plan/in-progress/update-returning-tuple-shape.md` 의 `[planner 위임]` 블록은 "넷이다" →
  "다섯이다" 로 정정돼 있고, frontmatter `spec_impact` 자기모순 문단(`:228-230` 구버전)도
  더 이상 존재하지 않는다(재확인, 이전 WARNING 2건 해소).
- `updateReturningRows(...)` 호출 8곳(execution-engine 2 · knowledge-base 5 · auth-oauth 1)
  전부 `detail` 컨텍스트 문자열을 채우고 있음을 grep 으로 재확인했다 — 헬퍼가 명시한
  "필수" 계약이 실제로 지켜지고 있다.
- README·API 문서·설정 문서 갱신 대상 없음(재확인) — 신규 API 엔드포인트·DTO·환경변수·
  설정 옵션이 없는 순수 내부 버그 수정이다.

## 요약

핵심 신규 코드의 문서화 품질은 8차례 리뷰를 거치며 이미 높은 수준으로 수렴해 있고, 이전
라운드가 지적한 항목은 모두 현재 소스에서 해소가 유지됨을 직접 재확인했다. 이번 라운드에서
새로 찾은 것은 이 PR의 최종 커밋(`e34a85b44`)이 `CHANGELOG.md`에 붙인 "소급 정정" 자체의
불완전함이다 — `retry-turn.service.ts`의 `finalizeGuarded`(0행이면 저장·이벤트 발행 skip)를
서술하는 CHANGELOG 섹션이 두 곳 있는데, 정정 블록은 그중 나중에 쓰인 섹션의 번호만
가리키고 더 앞선(이 PR 이전부터 존재하던) 섹션의 동일 주장은 그대로 남겨, 그 섹션만 읽으면
무효화된 방어를 여전히 검증된 사실로 믿게 된다. 기능적 결함은 아니고 이 PR을 막을 근거는
아니지만, 이 PR이 스스로 반복해 진단해 온 "처방이 그 자리에만 갇힌다" 패턴이 문서 영역에서
다시 나타난 사례라 정정 가치가 있다.

## 위험도

LOW
