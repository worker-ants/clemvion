# 변경 범위(Scope) 리뷰 — SSE/fanout `nodeOutput` allowlist (4라운드, 최종)

## 리뷰 방법

`git diff origin/main...HEAD --stat` 으로 72개 변경 파일을 전수 분류했다.

- **핵심 프로덕션 코드 6개**: `websocket.service.ts`(+70/-일부), `node-output-allowlist.ts`(+35),
  `interaction.service.ts`(+4/-2, 주석만), `websocket.service.spec.ts`(+208, 신규 canary 5건),
  `node-output-allowlist.spec.ts`(+11), `interaction.service.spec.ts`(+46, 신규 canary 1건)
- **문서/트래커 4개**: `CHANGELOG.md`, `plan/complete/sse-nodeoutput-allowlist.md`,
  `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- **spec 2개**: `spec/5-system/14-external-interaction-api.md`(§R17),
  `spec/5-system/6-websocket-protocol.md`(§4.4, 1줄)
- **review 산출물 60개**: `review/code/2026/08/23/{22_51_46,23_16_40,23_56_18}/**`,
  `review/consistency/2026/08/23/{22_26_33,23_29_27}/**`

`websocket.service.spec.ts` 의 diff 는 프롬프트에서 생략돼 `git diff` 로 직접 전문을 읽어
확인했다(신규 canary 5건 — top-level `nodeOutput`, `buttonConfig.nodeOutput`, copy-on-change 동일성,
chat-channel 4키 `it.each`, `envelope.output` 잔여 상태 기술). 전부 이번 allowlist 작업 대상만
exercise 하며 무관한 케이스·drive-by 수정은 없다.

이 diff 는 이미 3라운드(`22_51_46`→`23_16_40`→`23_56_18`)에 걸쳐 scope 리뷰를 받았고 매 라운드
위험도 NONE 으로 수렴했다. 아래는 그 결론에 대한 독립 재검증이다.

## 발견사항

- **[INFO]** allowlist 가 계획 초안(위젯 4키) 대비 chat-channel 용 4키(`payload`·`title`·`rendered`·
  `nodeType`)로 두 배 확장됐다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` (`NODE_OUTPUT_ALLOWED_KEYS`
    배열, 신규 4키 추가분)
  - 상세: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 와
    `plan/complete/sse-nodeoutput-allowlist.md` 가 스스로 밝히듯 착수 후 실측(Discord/Telegram/Slack
    렌더러가 이 4키를 top-level flat legacy shape 으로 읽음)으로 드러난 보정이며, 넣지 않으면 본래
    목표("REST 와 SSE 방어 강도를 맞춘다")를 지키는 과정에서 chat-channel 메시지가 조용히 빈다.
    `it.each` canary + 리터럴 테스트 + JSDoc 3그룹 표로 뒷받침돼 요청받지 않은 기능 확장이 아니라
    본래 변경의 정합성을 지키기 위한 필수 보정이다.
  - 제안: 조치 불요.

- **[INFO]** `node-output-allowlist.ts` 소비처 목록이 REST `getStatus` 단수 → REST+WS 복수로,
  헤더 주석·JSDoc 표가 함께 다시 쓰였다.
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts` 파일 상단 주석 블록
  - 상세: 이번 PR 이 `websocket.service.ts` 를 두 번째 소비처로 추가하는 바로 그 PR 이므로, 같은
    파일·같은 변경이 만든 직접 부작용을 그 자리에서 정정한 것이다. 무관한 리팩토링이 아니라 변경과
    결합된 필수 수정.
  - 제안: 조치 불요.

- **[INFO]** `interaction.service.ts` 의 `getStatus` JSDoc, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
  `CHANGELOG.md` 에서 "SSE·fanout 은 잔여" 서술을 취소선으로 남기고 정정 블록을 다는 자기반증형
  소정정이 세 문서·두 라운드(`22_51_46`→`23_56_18`)에 걸쳐 이뤄졌다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (JSDoc,
    `getStatus` 상단), `CHANGELOG.md`(Unreleased 항목), `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
  - 상세: CLAUDE.md §자기반증형 소정정의 다섯 조건(developer 자신이 쓴 예고 문장 · 실측 반증 ·
    취소선 보존 · 문장 국한 · plan/커밋에 실측 기록)이 세 자리 모두에서 지켜졌다. `23_56_18`
    RESOLUTION(W3·W4)이 "코드 JSDoc 두 곳을 처음엔 놓쳤다가 리뷰에서 지적받아 추가로 고쳤다"고
    스스로 기록해 뒀고, 이번 diff 시점엔 문서 3곳+코드 주석 2곳 전수가 일관됨을 grep 으로 재확인했다
    (`REST 와 SSE` · `강도가 다르` · `SSE·fanout 은 잔여` 패턴이 취소선 처리되지 않은 채 남은 곳 없음).
    범위 이탈이 아니라 이 PR 이 직접 반증한 자신의 예고를 정정하는 절차.
  - 제안: 조치 불요.

- **[INFO]** `spec/5-system/14-external-interaction-api.md`(§R17 표), `spec/5-system/6-websocket-protocol.md`(§4.4
  1줄 caveat)가 diff 에 포함됐다.
  - 위치: 두 spec 파일
  - 상세: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 체크리스트의 "(planner 턴)
    §R17 표의 SSE 행 flip + WS §4.4 단서" 항목과 1:1 대응하며, `22_26_33`/`23_29_27` consistency-check
    가 지적한 naming_collision(동명 필드 disambiguation) WARNING 들도 같은 diff 안에서 반영됐다.
    이 spec 편집이 실제로 별도 planner 턴을 통해 이뤄졌는지(vs developer 가 자기반증형 소정정 예외를
    빌려 직접 편집했는지)는 커밋 이력에서 판별 불가능하고, 이는 스코프(범위) 관점이 아니라 역할
    분리 프로세스 감사 영역이라 이 리뷰의 판단 대상 밖으로 남긴다. 내용 자체는 이번 작업의 핵심
    산출물이라 무관한 spec 확장은 아니다.
  - 제안: 조치 불요(내용 관점). 역할 분리 준수 여부 확인이 필요하면 별도 프로세스 점검으로.

- **[INFO]** 72개 변경 파일 중 60개(`review/code/2026/08/23/{22_51_46,23_16_40,23_56_18}/**`,
  `review/consistency/2026/08/23/{22_26_33,23_29_27}/**`)가 이전 코드 리뷰·consistency-check
  라운드의 산출물이다.
  - 위치: 위 5개 세션 디렉터리 전체(각 RESOLUTION.md·SUMMARY.md·개별 리뷰어 `.md`·`meta.json`·
    `_retry_state.json`)
  - 상세: CLAUDE.md 정보 저장 위치 표가 `review/code/**`·`review/consistency/**` 를 정식 SoT 로
    지정하고, "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"로 `/ai-review`+`/consistency-check`
    실행과 그 산출물 커밋을 명시적으로 요구한다. `developer` 는 `review/**/RESOLUTION.md` 쓰기 권한을
    갖고, 나머지 리뷰어 산출물(`*.md`/`meta.json`/`_retry_state.json`)은 그 워크플로 자체가 생성하는
    표준 부산물이다. 코드 변경과 무관한 임의 문서 추가가 아니라 이 프로젝트가 강제하는 절차의 증적.
  - 제안: 조치 불요.

포맷팅(공백·줄바꿈)만의 변경, 사용하지 않는 import 추가, 관련 없는 리팩토링, 의도 밖 설정 파일
변경, 무관한 주석 첨삭은 발견되지 않았다. 핵심 함수 `allowlistFanoutNodeOutput` 은 단일
chokepoint(`toFanoutEnvelope`) 안에서만 배선되고, 기존 strip 파이프라인 순서(strip → allowlist →
routing 첨부)를 유지한 채 삽입돼 최소 변경으로 구현됐다. 신규 import(`allowlistNodeOutputKeys`)
1건은 그 배선에 직접 필요한 것이고 미사용 import 는 없다.

## 요약

72개 변경 파일 전부가 "SSE/fanout `nodeOutput` 을 REST `getStatus` 와 동일한 fail-closed
allowlist 로 닫는다"는 단일 목표에 직접 연결된다. 핵심 로직 변경(`websocket.service.ts` 의
`allowlistFanoutNodeOutput` 신설·배선, `node-output-allowlist.ts` 의 4키 확장)과 대응 테스트
(`websocket.service.spec.ts` canary 5건 — 프롬프트에서 생략돼 `git diff` 로 직접 전문을 재확인함 —
및 `interaction.service.spec.ts`/`node-output-allowlist.spec.ts` 추가분)는 plan 문서의 작업 목록·
검증 기준과 1:1 대응한다. chat-channel 용 4키 확장은 계획 초안보다 넓어 보이지만 착수 후 실측으로
드러난 필수 보정이지 요청 밖 기능 확장이 아니며, 이 판단은 3개 라운드에 걸친 캐너리·리터럴 테스트로
뒷받침된다. CHANGELOG·JSDoc·plan 세 곳의 자기반증형 소정정(취소선+정정)은 CLAUDE.md 절차를 정확히
따르고, 이번 라운드까지 문서-코드 전수 일치가 grep 으로 재확인됐다. 다수(60개)를 차지하는
`review/code`·`review/consistency` 산출물은 이 프로젝트가 구현 완료 후 상시 강제하는 리뷰 워크플로의
정식 산출물이며 무관한 파일 수정이 아니다. 포맷팅 전용 변경, drive-by 리팩토링, 미사용 import,
무관한 주석·설정 변경은 관찰되지 않았다.

## 위험도

NONE
