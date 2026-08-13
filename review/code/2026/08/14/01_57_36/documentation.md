# 문서화(Documentation) 리뷰 결과

## 사전 확인

이 세션의 diff(`origin/main...HEAD`, 19개 코드/plan/CHANGELOG 파일)는 이미 9라운드
(`20_36_35`~`01_44_03` 및 대응 consistency 라운드)의 ai-review/consistency 를 거친 누적
결과다. 직전 문서화 리뷰(`01_44_03`)가 "CRITICAL/WARNING 없음"으로 종결한 뒤에도 마지막
커밋(`ace185b91`·`f5ab3040c`·`103dee234`·`6416d5bb9`, 01:11~01:57)이 추가됐으므로, 그
델타(주로 `common/__test-utils__/source-scan.ts` 신설·`assert-row-array.ts`/
`update-returning-rows.ts` 상호 링크 docstring·plan harness 메모)를 중심으로 재검토했고,
핵심 신규 파일(`update-returning-rows.ts`, `assert-row-array.ts`, `source-scan.ts`,
`auth-oauth.service.ts`, `execution-engine.service.ts`, `knowledge-base.service.ts`,
`auth-oauth-callback.e2e-spec.ts`)은 현재 저장소 상태를 직접 `Read`/`grep` 으로 재대조했다.

새 파일들의 JSDoc 품질은 이 프로젝트 기준으로도 이례적으로 높다 — 실측 근거, 실패 모드 표,
"왜 4개월간 안 보였는지", 기존 3개 관용구와의 관계, 자매 헬퍼와의 분담(`{@link}` 교차 링크)까지
갖춰져 있고, 이전 라운드들이 지적한 모순 주석(`"위 제네릭은…"` 죽은 참조)·`EXPECTED`
3-tuple/2-tuple 불일치·plan 자기모순("넷"/"다섯")은 모두 grep 0건으로 해소를 직접 확인했다.

## 발견사항

- **[WARNING]** `update-returning-tuple-shape.md` 가 자신의 결함 범위를 "7곳"과 "8곳" 두
  숫자로 동시에 서술한다 — `auth-oauth.service.ts` 를 8번째 지점으로 추가한 뒤 섹션 제목만
  갱신하고 본문 3곳·checklist 1곳은 그대로 남았다.
  - 위치: `plan/in-progress/update-returning-tuple-shape.md:2`(frontmatter 제목
    `"UPDATE/DELETE 의 RETURNING 이 [rows, count] 튜플인데 7곳이 행 배열로 다뤘다"`),
    `:73`(`"처방이 지점에 갇혀 있어 나머지 7곳에 전파되지 않았다."`),
    `:188`(`## 처방` 섹션, `"7곳 전부 이 헬퍼를 거친다."`),
    `:216`(체크리스트, `"[x] 헬퍼 + 7곳 적용"`)
    — vs `:57`(`"## 무엇이 깨져 있었나 (8곳)"`, `auth-oauth` 행 포함 8행 표)과
    `CHANGELOG.md` 의 Unreleased 제목(`"...8곳이 행 배열로 오인했다..."`).
  - 상세: `git blame` 으로 확인했다. `:2`·`:73`·`:188`·`:216` 은 최초 커밋
    `8332d9a20`(20:36:26, "7곳이 행 배열로 다뤘다")에서 쓰였고, 이때는 `execution-engine`
    2곳 + `knowledge-base` 5곳만 알려져 있었다. 이후 커밋 `08d3c7fa3`(21:06:00, "1차 감사가
    놓친 8번째 지점")가 `auth-oauth.service.ts` 를 추가하면서 `:57` 의 섹션 제목만
    `"(7곳)"→"(8곳)"` 로 고쳤고, 같은 파일 안의 다른 세 인용과 checklist 항목은 손대지
    않았다. 현재 실제 호출부 수는 `execution-engine.service.ts` 2 + `knowledge-base.service.ts`
    5 + `auth-oauth.service.ts` 1 = **8** 이며(구조적 가드
    `update-returning-rows.spec.ts` 의 `EXPECTED` 배열과 `grep -c
    'updateReturningRows[<(]'` 실측으로 확인), `## 처방` 섹션의 "7곳 전부" 는 이제
    사실과 다르다. 이 plan 문서는 4개 다른 plan 파일(`retry-turn-terminal-guard.md`,
    `ie-resume-turn-boundary-cancel.md`, `exec-intake-followups.md`,
    `spec-update-node-cancellation-shutdown-classification.md`)에서 "근본 원인·실측"
    으로 링크되는 정본 참조 문서라, 여기의 숫자 불일치가 다른 문서를 읽는 사람에게도
    전파될 수 있다. 같은 세션이 CHANGELOG 의 유사한 이중 서술 불일치(`00_54_01`
    WARNING 2)와 plan 의 "넷"/"다섯" 불일치(`23_46_00` WARNING 1)를 이미 두 차례 잡아
    정정한 바로 그 패턴이 이번엔 놓쳤다.
  - 제안: `:2`·`:73`·`:188`·`:216` 의 "7곳" 을 "8곳" 으로 정정하거나(가장 간단), 또는
    `:188`처럼 "현재 상태"를 서술하는 자리는 8로 고치고 `:2`·`:73`처럼 "당시 감사가
    찾은 범위"를 가리키는 서술형 문장은 "(1차 감사가 찾은) 7곳" 처럼 시점을 명시해
    8곳 표와 모순으로 읽히지 않게 한다. checklist(`:216`)는 이 PR 의 다른 체크박스들이
    "OAuth 콜백 e2e 신설"처럼 이후 항목에서 auth-oauth 관련 작업을 별도로 체크하고
    있어, 이 항목만 "7곳"으로 남으면 두 항목의 합이 8인지 개별 항목이 8을 이미
    포함하는지 다음 독자가 다시 세어야 한다.

CRITICAL 급 신규 발견 없음. 그 외 참고로 남기는 INFO 는 이전 라운드(`22_45_24`/`23_07_11`/
`23_46_00`/`01_44_03`)에서 이미 저비용·조치 불요로 유예된 것과 동일하며 이번 라운드의 신규
발견은 아니다(`update-returning-rows.spec.ts` 의 `it.each` placeholder 변수명이 자매 스펙과
여전히 다름 등).

## 요약

핵심 코드(`update-returning-rows.ts`·`assert-row-array.ts`·`source-scan.ts` 3종 세트,
`auth-oauth.service.ts`·`execution-engine.service.ts`·`knowledge-base.service.ts` 8개
소비 지점, `auth-oauth-callback.e2e-spec.ts`, `CHANGELOG.md`)의 문서화 품질은 이번 라운드
기준으로도 CRITICAL/WARNING 급 결함이 없다 — README·API 문서·설정 문서 갱신 대상도 없다(순수
내부 버그 수정 + 신규 내부 유틸리티이며, 기존 저장소도 유사 헬퍼를 README 에 별도 등재하지
않는 관례와 일치). 다만 이번 재검토에서 정본 참조 문서인
`plan/in-progress/update-returning-tuple-shape.md` 자체에 "7곳"/"8곳" 이 같은 문서 안에서
공존하는 숫자 불일치를 새로 발견했다 — `auth-oauth` 를 8번째 지점으로 추가한 커밋이 섹션
제목 한 곳만 고치고 본문 3곳·checklist 1곳을 놓친 결과다. 기능에는 영향이 없으나, 이 문서가
여러 자매 plan 에서 "근거"로 링크되는 자리라는 점에서 WARNING 으로 남긴다.

## 위험도

LOW
