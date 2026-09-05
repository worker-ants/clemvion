# 변경 범위(Scope) Review

## 방법론 메모

프롬프트에 조립된 31개 파일은 `git log origin/main..HEAD` 기준 **7개 커밋**으로 구성된다:

```
9d0b876ad docs(review): RESOLUTION 의 e2e 근거를 커밋 후 직접 실측으로 교체
2fa650b5a docs(review): 13_49_54 라운드 산출물 + RESOLUTION
45c1cdf63 fix(backend): 감사 로그가 User 전 컬럼을 응답에 실었다 + 검증자를 중첩까지 내린다
abc87b2d4 docs(plan): §5.4 2단계 — 선행 조건이 스윕으로 바뀐 것을 반영
df8be1859 test(backend): 검증자를 3개 DTO 로 넓히고 프로퍼티 뷰를 좁힌다
ab6fa6863 feat(backend): 응답 1건 vs DTO 선언을 일반 대조하는 §5.4 검증자
0498d7362 docs(review): impl-prep 12_48_13 — BLOCK:NO. WARNING 2건은 둘 다 다른 문서
```

각 커밋의 `git show --stat`/전체 diff 를 직접 열어 커밋 경계와 파일 소속을 확인했다. 저장소에는
어떤 뮤테이션도 가하지 않았다(`git status --short` 로 확인 — 본 세션 산출물 디렉터리
`review/code/2026/09/05/14_39_31/` 외 변경 없음).

이번 라운드(`14_39_31`)의 diff 는 직전 라운드(`13_49_54`)가 이미 스코프 검토한 4개 커밋
(`0498d7362`/`ab6fa6863`/`df8be1859`/`abc87b2d4`) 위에, 그 라운드의 Critical/WARNING 을
조치한 `45c1cdf63`(fix)와 그 산출물 커밋 `2fa650b5a`/`9d0b876ad`(docs(review))가 얹힌 것이다.

## 발견사항

- **[INFO]** `docs(review)` 커밋(`0498d7362`)이 이번 §5.4 작업과 주제가 다른
  `spec-conventions-engine-error-code-surface.md`(EngineErrorCode JSDoc 병기 추적 plan)도
  함께 고친다 — **직전 라운드에서 이미 지적·양해된 것과 동일 항목**
  - 위치: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 잔여 체크리스트
    하위 불릿(취소선 처리된 두 항목)
  - 상세: 이 파일은 `response-contract.ts`/§5.4 검증자와 무관한 별개 트래킹 항목(엔진 에러
    코드 표기 이원화)이다. 다만 같은 커밋에 포함된 impl-prep consistency-check
    (`review/consistency/2026/09/05/12_48_13/plan_coherence.md` WARNING #2)이 바로 이 두
    불릿을 "이미 해소된 target 을 미해소로 지목" 이라고 지적했고, 이 커밋은 그 WARNING 을
    그 자리에서 반영한 것이다(CLAUDE.md — "consistency WARNING 은 BLOCK:NO 여도 반영").
    우연한 drive-by 편집이 아니라 같은 턴에 돌린 필수 게이트가 낸 지적에 대한 직접 대응이며,
    직전 라운드(`13_49_54/scope.md`)가 정확히 이 항목을 INFO 로 검토·양해했다. 이번 라운드가
    그 판단을 뒤집을 새 근거는 없다.
  - 제안: 조치 불요(기존 판단 유지). `feat`/`test`/`fix` 커밋과 섞이지 않고 독립
    `docs(review)` 커밋으로 분리되어 있어 영향 범위도 그대로다.

- **[INFO]** `docs(plan)` 커밋(`abc87b2d4`)이 §5.4 항목 서술 갱신과 함께 §5.4 와 무관한 신규
  백로그("`## Overview` 유무 불일치")를 같은 트래커 파일에 얹은 상태가 이번 라운드에도
  그대로 유지된다 — 직전 라운드에서 이미 다룬 항목
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 불릿
    "`spec/5-system/` 의 `## Overview` 유무 불일치"
  - 상세: 이 항목의 근거(`convention_compliance.md` WARNING #1)는 있으나, 이 plan 문서의
    주제(응답 DTO nullable 표기 §5.4)와 내용(spec 문서 구조 관례)이 다르다는 점은 직전
    라운드가 이미 지적했다. 이번 라운드는 같은 파일에 §5.4 서술을 실측으로 갈아끼우는
    추가 편집(`abc87b2d4`)이 있었지만, 무관 항목 자체를 제거·이동하지는 않았다 — 새로운
    스코프 이탈이 아니라 기존 지적이 미해결로 남아 있는 상태다.
  - 제안: 조치 불요(치명적이지 않음, 기존 제안 유지). 다음에 유사 항목을 등재할 때는 그
    항목만을 위한 별도 `plan/in-progress/*.md` 를 여는 편을 권한다.

- **[NONE]** 신규 보안 수정 커밋(`45c1cdf63`)은 같은 세션의 리뷰 지적(Critical #1, W2~W5,
  I7, I11, I13)에 대한 응답으로 정확히 스코프가 일치한다
  - 상세: `audit-logs.service.ts`(`leftJoinAndSelect` → `leftJoin`+`addSelect`)와
    `audit-logs.spec.ts`(대응 유닛 캐너리)는 지적된 민감정보 노출(Critical #1)의 직접 수정
    이고, `response-contract.ts`/`.spec.ts` 의 나머지 변경(`DtoContract`가 이름을 파생,
    `'invalid-payload'` kind 신설, JSDoc 표에 출처 열 추가, 배열 payload 가드, `.sort()` 무재정렬
    단언)은 전부 `RESOLUTION.md` 표에 등재된 항목과 1:1 대응한다. 4개 e2e 파일의 diff(각
    `assertMatchesContract(rows[0], auditLogContract)` 류 한 줄 + 관련 import)도 API 리네임을
    그대로 반영한 것 이상의 추가 변경이 없다. `grep -rn "schemaForDto\|assertMatchesDtoSchema"
    codebase/` 로 확인한 결과 이전 라운드가 지적한 구 식별자의 잔존이 0건이라 리네임이
    깨끗하게 완료됐다.
  - 무관한 리팩토링·포맷팅·주석 정리·불필요한 import 는 보이지 않는다.

- **[INFO]** 이번 프롬프트에 조립된 `review/code/2026/09/05/13_49_54/RESOLUTION.md`(파일 11)의
  diff 내용이 현재 `HEAD` 상태보다 한 커밋(`9d0b876ad`) 뒤처져 있다
  - 위치: `review/code/2026/09/05/13_49_54/RESOLUTION.md` "TEST 결과" 표 및 그 아래 단락
  - 상세: 프롬프트가 보여주는 diff 는 "e2e 를 인용한 `14:24:19` 실행은 본 커밋과 동일한
    codebase 내용에서 돌았다"(추론적 논증) 문구인데, 실제 `HEAD` 는 `9d0b876ad` 커밋이 이
    문구를 "인용한 e2e 는 fix 커밋(`45c1cdf63`) 이후에 시작된 실행이다 — 추론으로 말하지
    않고 직접 다시 돌린 값이다"(직접 실측)로 이미 교체했다. 두 버전 다 문서(테스트 근거
    서술) 정밀화일 뿐 §5.4 기능·audit-logs 보안 수정과는 무관하고 스코프 이탈은 아니다 —
    다만 이 fan-out 리뷰의 diff 스냅숏이 `HEAD` 최신 커밋 하나를 놓치고 있다는 사실은
    기록해 둔다(스코프 판단에는 영향 없음, freshness/게이트 쪽 관심사).
  - 제안: 조치 불요(스코프 관점에서는 문제 아님). 다음 라운드가 이 diff 를 다시 조립할 때
    `HEAD` 최신 커밋까지 포함되는지 확인하면 좋다.

## 요약

이번 라운드는 직전 스코프 검토(`13_49_54`)가 "NONE"으로 판정한 핵심 구현·배선 4개 커밋 위에,
그 라운드가 낸 Critical #1(감사 로그 민감정보 노출)과 WARNING 5건에 대한 수정 커밋
(`45c1cdf63`)과 그 리뷰 산출물 커밋(`2fa650b5a`, `9d0b876ad`)이 얹힌 형태다. 보안 수정은
지적된 결함에 정확히 대응하는 최소 diff이고(`leftJoinAndSelect` → `leftJoin`+`addSelect`,
유닛 캐너리 추가), 검증자 리팩토링(식별자 파생·kind 신설·배열 가드·정렬 단언)도 전부
`RESOLUTION.md` 에 등재된 지적과 1:1 대응해 무관한 리팩토링이 아니다. 구 식별자
(`schemaForDto`/`assertMatchesDtoSchema`) 잔존도 0건으로 리네임이 깨끗하다. 두 plan 문서에
섞인 §5.4 와 무관한 항목(EngineErrorCode 취소선 정리, `## Overview` 유무 백로그)은 둘 다 같은
턴에 강제 실행된 `--impl-prep` consistency-check WARNING 에 대한 직접 대응이라는 근거가
있으며, 직전 라운드가 이미 INFO 로 검토·양해한 것과 동일한 판단을 유지한다. `docs(review)`
산출물 커밋들은 `feat`/`test`/`fix` 커밋과 섞이지 않고 독립적으로 분리되어 있어 코드 변경
범위를 오염시키지 않는다. CRITICAL/WARNING 급 범위 이탈은 없다.

## 위험도

LOW
