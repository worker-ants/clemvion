# 변경 범위(Scope) Review — eia-misc-hygiene (round `20_00_08`)

## 검토 방법

`git log --oneline -5` 로 이 브랜치가 `origin/main` 위에 두 커밋(`044a2e19e` "미뤄 둔 위생 5건을
묶어 처리", `7531816ad` "직전 리뷰(`19_36_17`) W1·W2 수정")을 쌓고 있음을 확인했다.
`git diff origin/main...HEAD --stat` 로 31개 파일 변경 통계를 실측해 프롬프트에 실린 33개 리뷰
대상 항목과 대조했다(2개 차이는 `git mv` 로 rename-detect 된 `node-output-allowlist.{ts,spec.ts}`
가 stat 에서 `{shared/utils => nodes/core}/...` 한 줄로 합쳐져 표시된 것 — 실질적으로는 동일
파일 쌍). `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 5개 체크박스(등재일·
근거 포함)와 코드 diff 를 1:1 대조했다.

## 발견사항

- **[INFO]** 서로 독립적인 5개 위생 항목이 한 브랜치(두 커밋)에 번들됐다
  - 위치: 커밋 `044a2e19e`(전체) — ① `swagger-probe.ts` 신설 + 4개 스펙 전환(파일 1,3,4,9,12,13,18),
    ② `node-output-allowlist.ts` `shared/utils/`→`nodes/core/` 재배치(파일 6,8,10,11,14,15,31,33),
    ③ `redact-stored-error.ts` 명명·JSDoc 위생(파일 2,16,17,32), ④ `interaction.guard.ts` 의
    `EIA-AU-09` 오기 제거(파일 5), ⑤ `websocket.service.spec.ts` fanout 캐너리 describe 재배치
    (파일 7). 이어지는 `7531816ad` 는 직전 리뷰(`19_36_17`)가 지적한 JSDoc 오귀속 W1·W2 를 고치는
    후속 fix 커밋이다.
  - 판단: `git diff --stat` 실측(`node-output-allowlist.spec.ts | 0`, `.ts | 2 +-`)이
    ②를 **순수 이동**(import 경로 한 줄 외 무변경)으로 확인해 준다. 다섯 항목 각각은
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 2026-08-23 사전 등재되어
    "각각은 지금 별도 diff 를 만들 값이 없다. 이 파일을 다른 이유로 여는 순간 함께 처리한다"는
    명시적 처분(disposition)을 갖고 있었고, 이번 diff(파일 19)에서 각 체크박스가 실측 근거
    (테스트 수 63→63 불변, `shared/utils/`→`nodes/`·`modules/` import 0건, 리네임 잔존 참조 0건
    등)와 함께 완료 처리됐다. 우연한 확장이 아니라 이 저장소가 CLAUDE.md 에 명시한 "fix→리뷰
    stale 루프" 교훈(미룬 항목은 plan 에 적어 뒀다가 관련 파일을 다시 열 때 묶어 처리)을 그대로
    따른 것이다.
  - 제안: 조치 불요. 승인 시 31개 파일 전체가 아니라 plan 체크박스 5개 단위로 완결성을 확인하는
    편이 낫다(본 리뷰가 그렇게 확인함).

- **[정보/무해]** 이동(②)에 따른 부수 변경 — 전부 필연
  - 위치: `interaction.service.ts`(import 경로), `websocket.service.ts`(import 경로),
    `tsconfig.build.json`(`src/shared/testing/**` exclude 추가), `spec/5-system/
    14-external-interaction-api.md`(`code:` frontmatter), `spec/conventions/node-output.md`(본문
    경로 참조)
  - 상세: 재배치·신설 헬퍼(`swagger-probe.ts` 가 devDependency `@nestjs/testing` 을 import)의
    직접 결과다. `tsconfig.build.json` 변경은 기존 `src/repo-guards/**` 등재와 동일 패턴이며
    신설 파일 하나만을 대상으로 한다. 범위를 벗어난 드라이브바이가 아니다.
  - 제안: 없음.

- **[정보/무해]** `review/code/2026/08/27/19_36_17/**`(SUMMARY·RESOLUTION·meta.json·
  `_retry_state.json`·7개 reviewer `.md`) 가 새 파일로 diff 에 포함
  - 상세: 이 저장소의 표준 워크플로(`/ai-review` 산출물은 `review/code/**` 에 쓰이고, 그 뒤
    `RESOLUTION.md` 로 fix 를 기록한 뒤 함께 커밋)가 그대로 반영된 것이다. CLAUDE.md 가
    "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"로 명시하므로, 이 산출물이 코드
    수정과 같은 브랜치에 실리는 것은 스코프 위반이 아니라 관례 그대로다.
  - 제안: 없음.

- **[검증 완료]** 테스트 재배치(⑤)는 순수 relocation
  - 위치: `websocket.service.spec.ts` 에서 추가된 두 `it` 블록(`llmCalls 없는 이벤트는 그대로
    fanout`, `emitNodeEvent fanout 도 llmCalls 를 strip`)과 파일 하단에서 삭제된 동일 두 블록
  - 상세: 본문을 대조해 바이트 단위로 동일함을 확인했다(신규 단언 없음). `7531816ad` 가 직전
    라운드에서 지적된 JSDoc 오귀속(원래 위치에 남아 엉뚱한 두 테스트를 설명하던 문제)을 고쳐,
    현재 diff 에서는 `describe('nodeOutput allowlist · fanout 파이프라인 불변식', …)` 바로 위에
    그 블록을 설명하는 새 JSDoc(`llmCalls strip 에서 분리했다…`)이 정확히 붙어 있다.
  - 제안: 없음.

## 요약

이번 diff 는 31개 파일에 걸친 넓은 변경이지만, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
에 사전 등재돼 있던 독립적 위생 항목 5건(Swagger 헬퍼 추출·모듈 재배치·리네임·JSDoc 오기 정정·테스트
`describe` 재배치)을 "다음에 이 파일을 열 때 묶어 처리"하는 프로젝트 관례에 따라 두 커밋(작업 +
직전 리뷰 fix)으로 정리한 것이다. `git diff --stat` 실측으로 모듈 재배치가 순수 이동(내용 변경 없음)임을,
plan 체크박스 대조로 각 항목이 사전 승인된 범위임을 확인했다. 새 기능 추가·무관한 리팩터링·미사용
임포트·의미 없는 포맷팅 변경은 발견되지 않았다. 새로 추가된 `swagger-probe.spec.ts`(에러 경로 캐너리)도
추출 대상 헬퍼 자신의 테스트이므로 over-engineering 이 아니다. `review/code/19_36_17/**` 산출물 포함은
이 프로젝트의 표준 리뷰 워크플로 그대로다. 유일하게 지적할 만한 점은 "5건 번들링" 자체인데, 이는
우연한 확장이 아니라 문서화된 의도이므로 CRITICAL/WARNING 이 아니라 INFO 로 남긴다.

## 위험도

NONE
