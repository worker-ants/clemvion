# 변경 범위(Scope) 리뷰

대상: `eia-error-code-unify-a87cea` (`origin/main..HEAD`, 5 커밋: `3f7f72c3b`·`b54657007`·
`c9a78d04f`·`480a6eea3`·`dbd4aa18c`) — 이번 라운드(`17_32_01`)는 직전 리뷰(`17_06_14`)의 후속
커밋(테스트 보강 `480a6eea3` + 리뷰 처분 `dbd4aa18c`)까지 포함한 전체 diff.

## 방법론

`git diff origin/main..HEAD --stat`(35파일, 2000+/24-)로 전수 확인. `plan/in-progress/eia-error-code-unify.md`
전문과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` diff 전문을 직접 `Read`/
`git diff`로 열어 대조했다(프롬프트 절단분 포함). 직전 라운드(`17_06_14`) 자신의 `scope.md`가
이미 낸 WARNING 2건이 이번 라운드에도 diff 안에 그대로 남아 있는지, 그리고 그 처분
(`RESOLUTION.md`)이 실제로 반영됐는지를 중점 확인했다.

## 발견사항

- **[INFO]** (직전 라운드 WARNING → 처분 확인) 같은 tracker 절의 "이월 spec 편집 3건"이 이 rename
  PR 에 여전히 함께 집행돼 있다
  - 위치: `plan/in-progress/eia-error-code-unify.md`(`## 같은 절의 spec 편집 3건 (트래커 이월분)` 절),
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:816`,`826`,`831` (wrapper 함수명 노출 ·
    §R17 볼드 통일 · `error-codes.md §4` 표 분리 — 3항목 모두 `[x]`로 닫힘)
  - 상세: `17_06_14` scope 리뷰가 이미 이 번들링을 WARNING(MEDIUM)으로 지적했다. 이번 라운드에서
    확인한 결과, 코드가 바뀌지는 않았고(3건 모두 spec 문서 갭이라 여전히 함께 실행됨) 대신
    `RESOLUTION.md`(W1)에 **"반영 안 함 · 사유"**로 명시 처분됐다 — 사용자가 같은 턴에 처리하기로
    결정했고, 세 항목이 정확히 이 PR 이 건드리는 같은 문서·같은 절이라 분리하면 두 PR 이 같은
    문단을 연달아 고치는 충돌이 생긴다는 근거다. `plan/eia-error-code-unify.md` 자체도 처음부터
    제목 아래 "정본 트래커 항목 집행 + 같은 절의 spec 편집 3건"이라고 스코프를 명시했었다(은폐가
    아니라 처음부터 선언된 확장). 리뷰어가 요구한 대안 조치("PR 설명에 번들링 사실 명시")도
    RESOLUTION 에 이행됨이 적혀 있다.
  - 판단: 번들링 자체는 여전히 "하나의 PR = 하나의 의도" 원칙에서 벗어나 있지만, 투명하게
    선언·검토·사용자 승인을 거쳤고 diff 는 문서(spec) 뿐이라 기능적 위험은 낮다. 새로운 정보는
    없으므로 등급을 WARNING→INFO 로 낮춘다(재확인 목적).
  - 제안: 조치 불요(이미 처분됨). 다음에 유사 상황이 오면 여전히 tracker 이월 항목은 별도 PR
    분리를 권장.

- **[INFO]** (직전 라운드 WARNING → 처분 확인) 브랜치 선두의 "정본 트래커 미체크 37건 재판정"
  chore 커밋이 이번 diff 에도 포함돼 있고, 그 섹션이 실제 세션/브랜치명과 다른 이름
  (`backend-redact-depth-boundary`)을 자칭한다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:864`
    (`### 미체크 항목 재판정 (2026-08-22, `backend-redact-depth-boundary`)`) — 커밋 `3f7f72c3b`
  - 상세: `17_06_14` scope 리뷰가 "오탈자인지 확인 요망"으로 WARNING 을 냈다. `RESOLUTION.md`(W2)가
    사실관계를 확인해 **"오탈자가 아니다"**로 결론짓고, 그 재판정은 실제로
    `backend-redact-depth-boundary` 세션이 착수 전 점검으로 수행했으며 그 PR(#1192)의 리뷰가
    "본래 목표와 무관한 grooming"으로 지적해 커밋째(`git format-patch`→`git am`) 이 PR 로 옮겨
    왔다는 경위를 밝혔다. 이번 라운드에서 직접 파일을 열어 확인한 결과, 그 처분 내용
    (세션명이 다른 이유)이 **`plan/in-progress/spec-sync-external-interaction-api-gaps.md:864-868`
    블록quote 로 실제로 추가돼 있음**을 확인했다 — 문서만 고치고 실제 반영은 안 하는 형태가
    아니다.
  - 판단: 내용 자체는 순수 조사(체크박스·주석)이고 코드/spec 본문 변경이 없어 기능적 위험은
    없다. 세션명 불일치는 실측 근거를 남긴 처분으로 해소됐다. 새 정보 없으므로 재확인 목적의
    INFO 로 유지.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드에서 새로 나타난 추가 스코프 — consistency `--impl-prep`(`15_35_56`)가 낸
  1건이 tracker 에 **미체크(`[ ]`)로만 등재**되고 이 PR 에서 집행되지 않았다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:841`
    (`consistency \`--impl-prep\`(\`15_35_56\`, 2026-08-22)가 하나 더 냈다` — egress 마스킹 규약
    문서화 갭)
  - 상세: 이 항목은 실행되지 않고 **등재만** 됐다(`[ ]`, spec 편집이라 planner 턴 필요라고 명시).
    실제 diff 는 이 트래커 절에 "다음에 처리할 항목"으로 한 문단 추가한 것뿐이라 코드/spec 본문
    변경이 없다. 이것은 스코프 확장이 아니라 정상적인 tracker 위생(발견 즉시 기록)이다.
  - 제안: 조치 불요.

## 범위 내로 확인된 항목 (문제 없음)

- 핵심 코드 diff(`executions.service.ts` 값 치환 + 근거 주석, `executions.controller.ts` Swagger
  description, `executions-rerun.service.spec.ts` 단언·제목)는 정확히 rename 표면만 건드리며
  무관한 리팩토링·포맷팅·import 변경이 없다. 이번 라운드에 추가된 `480a6eea3`(테스트 값 단언
  보강 + CHANGELOG)도 직전 리뷰가 지적한 W5(테스트가 이름만 주장) 를 정확히 그 범위 안에서만
  고쳤다 — `.catch((err_: unknown) => err_)` 관용구는 같은 파일 자매 테스트에서 그대로 가져온
  것이라 새 스타일을 만들지 않았다.
- `CHANGELOG.md` 신설 절은 breaking change 고지라는 선언된 목적에 정확히 부합하고, 다른
  `## Unreleased` 항목을 건드리지 않았다.
- `review/code/2026/08/22/17_06_14/**`(13파일)·`review/consistency/2026/08/22/16_34_50/**`
  (8파일)의 신규 커밋은 이 프로젝트 자신의 강제 워크플로 산출물이다 — `CLAUDE.md`가 구현 완료
  후 `/ai-review` + Critical/Warning fix 를 "상시 사전 승인된 강제 단계"로 명시하고, planner 는
  spec 편집 직전 `/consistency-check --plan` 이 의무다. 두 세트 모두 이 의무를 이행한 흔적이며
  임의로 추가된 무관한 파일이 아니다.
- spec 6파일(`1-manual-trigger.md`·`12-webhook.md`·`13-replay-rerun.md`·
  `14-external-interaction-api.md`·`3-error-handling.md`·`conventions/error-codes.md`)의 diff 는
  rename 값 치환 + 그 값을 설명하는 근거 각주/blockquote 뿐이며, `error-codes.md`의 §4→§4.1/§4.2
  분리도 "이월 3건" 중 하나로 처음부터 선언된 범위다(위 INFO 항목과 동일 사안, 중복 계상 안 함).
- 포맷팅·주석·import 만 단독으로 바뀐 hunk 는 없음(모든 hunk 가 실질 값 변경 또는 그 값을
  설명하는 신규 서술을 동반).

## 요약

이번 라운드(`17_32_01`)는 직전 스코프 리뷰(`17_06_14`)가 낸 WARNING 2건(tracker 이월 3건
번들링, 세션명이 다른 선행 chore 커밋)이 **코드 변경 없이 문서 처분(RESOLUTION.md)으로만
해소**된 상태에서 재검토한 것이다. 두 건 모두 실측을 통해 "은폐가 아니라 처음부터 선언되고
사용자가 결정했다"·"오탈자가 아니라 다른 세션에서 의도적으로 옮겨 온 커밋이다"로 확인됐고, 그
설명 자체가 tracker 문서에 인라인으로 추가돼 다음 사람이 같은 의문을 다시 갖지 않도록 처리됐다.
새로 추가된 커밋(`480a6eea3` 테스트 보강 + CHANGELOG, `dbd4aa18c` 리뷰 처분)은 모두 직전 리뷰가
요구한 정확한 표면만 건드리며 추가 스코프 확장을 만들지 않았다. 핵심 rename diff(코드 3파일 +
spec 6파일의 값 치환) 자체는 두 라운드 내내 매우 타이트했다. 남는 것은 절차적 사실(하나의 PR 이
공식적으로는 여러 관심사를 담고 있다는 것)이며, 이는 반복 지적보다 "처분이 실제로 기록됐는가"를
확인하는 것이 이번 라운드의 몫이었고 확인됐다.

## 위험도

LOW
