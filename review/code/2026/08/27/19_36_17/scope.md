# 변경 범위(Scope) Review — eia-misc-hygiene

## 검토 방법

`git diff origin/main...HEAD --stat` 로 실제 커밋(`044a2e19e`, "다음에 이 파일을 열 때 로 미뤄 둔 위생 5건을
묶어 처리했다")과 프롬프트에 실린 20개 파일 diff 를 대조했다. 통계가 정확히 일치해 프롬프트에
누락된 hunk 는 없다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 각 체크박스
(등재일·근거 포함)와 코드 diff 를 1:1로 대조해, 각 변경이 사전에 트래킹된 항목인지 확인했다.
추가로 `shared/utils/node-output-allowlist` 잔존 참조를 grep 으로 확인했다.

## 발견사항

- **[INFO]** 서로 독립적인 5개 위생 항목이 한 커밋에 번들됐다
  - 위치: 커밋 `044a2e19e` 전체 (20개 파일)
  - 상세: 이 PR 은 ① Swagger `createDocument` 보일러플레이트 공유 헬퍼 추출(`swagger-probe.ts` 신설,
    4개 소비 스펙 전환), ② `node-output-allowlist.ts` 를 `shared/utils/` → `nodes/core/` 로 재배치,
    ③ `redact-stored-error.ts` 명명·JSDoc 위생(`redactNodeExecutionRow` →
    `redactNodeExecutionRowForResponse` 등 4건), ④ `interaction.guard.ts` JSDoc 의
    `EIA-AU-09` 오기 제거, ⑤ `websocket.service.spec.ts` 의 fanout 캐너리 2건을 잘못된 `describe`
    블록에서 올바른 블록으로 이동 — 다섯 가지 독립적 관심사를 함께 커밋했다. 순수 "한 PR = 한 관심사"
    기준으로는 범위가 넓다.
  - 판단: 다만 이는 우연한 확장이 아니라 **의도된 관례**다. 브랜치명(`eia-misc-hygiene`)과 커밋
    메시지 자체가 "미뤄 둔 위생 5건을 묶어 처리했다"고 명시하고, `plan/in-progress/
    spec-sync-external-interaction-api-gaps.md` 의 다섯 체크박스가 각각 2026-08-23 에 사전
    등재되어 "각각은 지금 별도 diff 를 만들 값이 없다. 이 파일을 다른 이유로 여는 순간 함께
    처리한다"는 명시적 처분(disposition)을 갖고 있었다. 이번 커밋에서 각 체크박스가 실측(예:
    "테스트 수 63→63 불변", "`shared/utils/` 에서 `nodes/`·`modules/` 를 import 하는 파일 0건",
    "잔존 `SwaggerModule.createDocument` 각 0건")과 함께 완료 처리됐다. 이 저장소의 기존 관례
    (CLAUDE.md 미러: "review/fix stale loop" 교훈 — 미룬 항목은 plan 에 적어 두었다가 관련 파일을
    다시 열 때 묶어 처리)와 정확히 일치한다.
  - 제안: 조치 불요. 리뷰어가 이 넓은 diff 를 승인할 때는 20개 파일 전부가 아니라 plan 체크박스
    5개 단위로 각각의 완결성을 확인하는 편이 낫다(본 리뷰가 그렇게 확인함).

- **[정보/무해] `node-output-allowlist` 이동에 따른 부수 변경 — 전부 필연적**
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:46`,
    `codebase/backend/src/modules/websocket/websocket.service.ts:9`,
    `codebase/backend/tsconfig.build.json` (`src/shared/testing/**` exclude 추가),
    `spec/5-system/14-external-interaction-api.md` (`code:` frontmatter),
    `spec/conventions/node-output.md` (본문 경로 참조)
  - 상세: 파일 재배치(②)의 직접 결과로 두 소비처의 import 경로, spec `code:` frontmatter,
    spec 본문의 경로 인용이 함께 바뀌었다. `tsconfig.build.json` 변경은 신설된
    `swagger-probe.ts`(devDependency `@nestjs/testing` import)가 `dist` 로 새는 것을 막는 데
    필요하며, 기존 `src/repo-guards/**` 등재와 동일한 패턴이다. 모두 대상 변경의 논리적 필연이지
    범위를 벗어난 드라이브바이가 아니다.
  - 제안: 없음.

- **[검증 완료] 테스트 이동은 순수 relocation — 내용 변경 없음**
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` (추가된 두 `it` 블록과
    삭제된 두 `it` 블록)
  - 상세: diff 상단에서 추가된 `llmCalls 없는 이벤트는 그대로 fanout` 과
    `emitNodeEvent fanout 도 llmCalls 를 strip` 두 테스트가, 파일 하단에서 그대로 삭제됐다. 두
    블록의 본문을 바이트 단위로 대조해 완전히 동일함을 확인했다(신규 기능·신규 단언 없음, 단순
    `describe` 재배치). plan 의 "테스트 수 63→63 불변" 주장과 일치한다.
  - 제안: 없음.

- **[검증 완료] `shared/utils/node-output-allowlist` 잔존 참조는 이력 보존 목적**
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `<details><summary>등재
    당시 본문 (반증된 전제 포함 — 이력 보존)</summary>` 블록 내부
  - 상세: grep 결과 저장소 전체에서 옛 경로(`shared/utils/node-output-allowlist`)를 참조하는
    곳이 이 한 줄만 남아 있는데, 이는 "등재 당시 본문(반증된 전제 포함 — 이력 보존)"이라는
    `<details>` 블록 안의 **동결된 과거 기록**이라 살아있는 참조가 아니다. 스코프 위반이 아니라
    오히려 프로젝트 관례(이력 원문 불변 보존)를 정확히 따른 것이다.
  - 제안: 없음(참고용으로만 기록).

## 요약

이 PR 은 표면적으로 20개 파일에 걸친 넓은 diff 이지만, 실제로는 사전에 plan 파일에 등재되어 있던
독립적 위생(hygiene) 항목 5건(Swagger 문서 헬퍼 추출, 파일 재배치, 함수 리네임, JSDoc 오기 수정,
테스트 `describe` 재배치)을 "다음에 이 파일을 열 때 묶어 처리한다"는 이 저장소의 명시적 관례에 따라
한 커밋으로 처리한 것이다. 각 항목은 plan 체크박스에서 등재일·근거·완료 시 실측치와 함께 1:1로
추적되며, 코드 diff 는 그 항목들의 범위를 벗어나지 않는다 — 새 기능 추가, 무관한 리팩터링, 사용하지
않는 임포트, 의미 없는 포맷팅 변경은 발견되지 않았다. import 경로·`tsconfig.build.json`·spec
frontmatter 변경은 모두 파일 재배치의 필연적 부수 효과다. 유일하게 지적할 만한 점은 "번들링 자체"인데,
이는 우연한 확장이 아니라 문서화된 의도이므로 CRITICAL/WARNING 급이 아니라 참고(INFO) 수준으로
남긴다.

## 위험도

LOW
