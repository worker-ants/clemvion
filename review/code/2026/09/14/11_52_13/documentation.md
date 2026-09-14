# 문서화(Documentation) 리뷰 — trigger-canary-hardening (라운드 2)

## 검증 방법

이 세션은 `review/code/2026/09/14/11_27_40`(라운드 1, documentation INFO 3건 등재)의
후속이다. 라운드 1의 INFO 가 실제로 어떻게 처리됐는지, 그리고 그 처리(`fix(guards)` 커밋
`4c1a49b30`)가 새 문서화 결함을 만들지 않았는지를 중심으로, 저장소를 직접 열어(수정 없음)
대조했다.

- `git show 4c1a49b30` 로 라운드 1 이후 diff 만 분리해 확인.
- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-{guard.ts,spec.ts}`,
  `codebase/backend/test/schedule-trigger.e2e-spec.ts`,
  `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 를 `Read`/`grep` 으로 직접 열람.
- `grep -n "가드 [0-9]"` 재실행 → **총 13줄**, `## 가드` 헤딩 **3**, `── 가드` 구획주석 **7**,
  나머지 산문 **3** — plan(`trigger-canary-hardening.md`)이 라운드 1 지적 후 새로 적은 표와
  **정확히 일치**함을 확인 (`13 = 3 + 7 + 3`).
- `DELETE /api/triggers/:id` 라우트 실재 확인(`triggers.controller.ts:48,170` —
  `@Controller('triggers')` + `@Delete(':id')`) — `trigger-workflow-ref.e2e-spec.ts` 의
  `afterAll` JSDoc 이 인용하는 서비스 경로 서술이 정확함을 확인.
- 저장소 파일은 전혀 수정하지 않았다 — `git status --short` 로 확인.

## 발견사항

라운드 1 의 INFO 3건은 다음과 같이 처리됐고 전부 실제 코드와 일치한다 — 조치 불요, 확인만
기록한다.

- **[해소 확인]** `schedule-trigger.e2e-spec.ts` 헤더 "검증 대상" 목록에 `TriggerDto.workflow`
  축이 이제 반영됨 — 실제 파일 16~29행에 `**TriggerDto.workflow 양성** — 목록(C-2)·PATCH(G·H)
  세 자리 …` bullet 이 추가돼 있다(`git show 4c1a49b30 --stat` 확인 결과 이 파일 +2줄).
- **[해소 확인]** plan 의 `grep '가드 [0-9]'` "9자리" 수치가 "총 13 / 헤딩 3 / 구획주석 7 /
  산문 3" 으로 재정의·재검산됐고, 위에서 독립 재실행한 결과와 **바이트 단위로 일치**한다.
  "항목이 요구한 것은 케이스 헤딩이 전부 잡히는가이고 2 → 3 이 그 답" 이라는 결론도 실제
  구 diff(`③·⑤` 원문자 → `3·5`)와 정합.
- **[해소 확인 — CHANGELOG]** 이번 변경(신규 repo-guard + e2e 단언 추가 + 주석 정리)은 여전히
  순수 내부 테스트 하드닝이며 `spec_impact: none` — CHANGELOG 미갱신은 문제 없음(라운드 1과
  동일 결론 재확인).

라운드 1 의 maintainability WARNING#2(삼항식 vacuity) 수정 자체는 문서화 관점에서도 확인:
새로 추가된 주석이 `` (`/ai-review` `review/code/2026/09/14/11_27_40` maintainability
WARNING#2). `` 형식으로 정확한 세션 경로·카테고리·번호를 인용하고, 실제 그 파일의 해당 항목
문구("`null` 분기에서 문자열을 `.not.toBe(0)`… 항상 통과했다")와 일치한다 — 인용 정확성 문제
없음.

- **[INFO]** 수정된 에러 메시지 표현식에 불필요하게 중첩된 템플릿 리터럴이 있다 (문서화보다는
  가독성 성격의 사소한 관찰 — 블로킹 아님)
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` —
    `` throw new Error(`${rel}: ${'상수를 못 읽었다 — 선언 이름·형태가 바뀌었는지 볼 것'}`) ``
    (라운드 1 fix 로 신설, `git show 4c1a49b30` diff 기준)
  - 상세: 내부 `${'문자열 리터럴'}` 은 정적 문자열을 굳이 템플릿 치환식으로 한 번 더 감싼
    것으로, 동작에는 영향이 없지만(그냥 `` `${rel}: 상수를 못 읽었다 — …` `` 로 써도 동일)
    다음에 이 패턴을 복붙하는 사람이 "왜 리터럴을 `${}`로 감쌌는가"를 궁금해할 수 있다 —
    실질적인 문서/주석 오류는 아니고, 진단 메시지 자체(내용)는 바로 위 주석이 설명하는 의도와
    정확히 일치한다.
  - 제안: `` `${rel}: 상수를 못 읽었다 — 선언 이름·형태가 바뀌었는지 볼 것` `` 로 단순화(선택,
    급하지 않음).

## 검증한 사항 (문제 없음)

- `trigger-secret-columns-guard.ts` 헤더 JSDoc 의 "이 가드가 보는 것은 여기 적힌 자리뿐이다 —
  네 번째 사본은 `MIRROR_SOURCES` 에 넣어야 보인다" 문구, `readStringArrayConst` 의
  `fs.existsSync` 방어 + 에러 메시지("파일이 옮겨졌거나 이름이 바뀌었다")가 라운드 1
  testing/requirement INFO(파일 부재 미방어) 처방과 정확히 일치하는 형태로 반영됨.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커: 라운드 1~2 리뷰가 낸
  WARNING/INFO 전부(2-trigger-list.md `code:` 갭 · repo-guard `code:` 미등재 관례 부재 실측
  · 단건 조회 schedule workflow 0건 · consistency 번들 절단 · `_overview.md` frontmatter ·
  `__` 표기)가 권한 구분(developer/planner/harness)과 함께 정확히 등재됐고, 완료된 항목은
  `[x]` + 실측 각주로 갱신됨 — "체크와 이동은 한 동작" 관례를 지킴.
  단, 이 트래커 문서 자체를 `plan/complete/` 로 옮기는 것은 이 작업(트리거 캐너리 배치)의
  종료 조건이 아니라 트래커 자체의 잔여 항목이 남아 있어(더 넓은 문서라 계속 진행 중) 별도
  판단 대상이며, 이번 diff 범위의 문제는 아니다.
- `chat-channel-trigger-create.e2e-spec.ts` 의 새 주석("`secret_store` 고아 row 가 무해한
  이유는 `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 註가 정본")과 그 정본 파일의 실제
  JSDoc 내용이 정확히 대응함을 직접 대조 확인 — 중복 서술 없이 단일 출처를 가리키는 설계가
  유지됨.
- `trigger-workflow-ref.e2e-spec.ts` `afterAll` JSDoc 이 인용하는 "서비스 경로
  (`DELETE /api/triggers/:id`)" 가 실제 컨트롤러 라우트(`@Controller('triggers')` +
  `@Delete(':id')`)와 일치함을 확인.
- README/API 문서: 이번 변경은 API 표면·환경변수·설정을 추가하지 않았고, repo-guard 개요를
  미러링하는 README/인덱스가 원래 없어(다른 27개 기존 guard 도 동일) README 업데이트 대상
  아님 — 라운드 1과 동일 결론.

## 요약

라운드 1 documentation 리뷰가 낸 INFO 3건(헤더 축 누락·plan 수치 불명확·CHANGELOG) 은 모두
후속 fix 커밋(`4c1a49b30`)에서 실제로 해소됐고, 그 해소 내용(헤더 bullet 추가, 재검산 표,
CHANGELOG 판단 유지)을 이번 세션에서 독립적으로 재실측한 결과 정확히 일치했다 — 특히
`grep '가드 [0-9]'` 재실행 결과(13=3+7+3)와 컨트롤러 라우트 인용이 문서 서술과 바이트 단위로
일치함을 확인했다. fix 커밋이 새로 만든 유일한 관찰은 진단 메시지 안의 불필요한 중첩 템플릿
리터럴 하나로, 동작·문서 정확성에는 영향이 없는 사소한 가독성 항목(INFO)이다. 그 외 신규
코드의 JSDoc, 인용된 선례·리뷰 세션 경로, plan/tracker 의 체크박스-실제상태 동기화 모두
정확했고, Critical/Warning 급 문서화 결함은 발견되지 않았다.

## 위험도

NONE
