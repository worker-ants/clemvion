# 변경 범위(Scope) 리뷰 — SSE/fanout `nodeOutput` allowlist (`23_56_18`, 누적 56파일)

## 사전 확인 (git 실측)

`git diff origin/main...HEAD --stat` = 56 파일, `+3400/-38`. 커밋 7개
(`22f401942`~`fe4d58de7`)로 구성되며, 실질 프로덕션 로직 변경은 다음 4파일에 국한된다:

- `codebase/backend/src/shared/utils/node-output-allowlist.ts` (+35/-… , allowlist 4키 추가 + 주석 정정)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (+63, `allowlistFanoutNodeOutput` 신설 + `toFanoutEnvelope` 배선)
- 대응 `.spec.ts` 3건(`node-output-allowlist.spec.ts`, `websocket.service.spec.ts`, `interaction.service.spec.ts`)
- `CHANGELOG.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/6-websocket-protocol.md`(+68/+2, §R17·§4.4 정정)

나머지 44/56 파일은 `review/code/2026/08/23/{22_51_46,23_16_40}/**`,
`review/consistency/2026/08/23/{22_26_33,23_29_27}/**`, `plan/**` — 이 세션이 CLAUDE.md 가
상시 강제하는 `/ai-review`+`/consistency-check` 워크플로를 실행하며 만든 산출물이다.

## 발견사항

- **[INFO]** 대다수(44/56) 변경 파일이 리뷰·consistency-check 산출물·plan 트래커다.
  - 위치: `review/code/2026/08/23/22_51_46/*.md`·`review/code/2026/08/23/23_16_40/*.md`(RESOLUTION 포함)·
    `review/consistency/2026/08/23/22_26_33/*.md`·`review/consistency/2026/08/23/23_29_27/*.md`(RESOLUTION 포함)·
    `plan/complete/sse-nodeoutput-allowlist.md`·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`·
    `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
  - 상세: `RESOLUTION.md`는 `developer`가 쓸 수 있는 정식 경로(`review/**/RESOLUTION.md`)이고,
    나머지 리뷰어별 `.md`/`meta.json`/`_retry_state.json`은 code-review-agents·consistency-checker
    가 자기 소관 디렉터리(`review/code/**`, `review/consistency/**`)에 쓴 표준 산출물이다.
    `plan/**` 갱신(체크박스 반영, `<details>` 이력 보존, `complete/` 이동)도 developer 쓰기
    허용 영역이자 plan-lifecycle 규약이 요구하는 마무리 절차다. 무관한 임의 문서 작업이 아니다.
    (이 판단은 같은 세션의 `22_51_46`·`23_16_40` scope.md 두 라운드가 이미 동일 결론을 냈고,
    이번 최종 스냅샷에서도 신규로 뒤집힐 근거를 찾지 못했다.)
  - 제안: 조치 불요.

- **[INFO]** `spec/5-system/` 두 파일 변경이 코드 fix 커밋과 **같은 커밋**에 동봉됐다 — plan 자신이
  "(planner 턴)"으로 예고한 분리가 커밋 경계에서 드러나지 않는다.
  - 위치: 커밋 `22f401942`(`fix(security): SSE/fanout 의 nodeOutput 도 fail-closed allowlist`)가
    `codebase/backend/src/shared/utils/node-output-allowlist.ts`·`websocket.service.ts`·
    `websocket.service.spec.ts`·`node-output-allowlist.spec.ts` **와 함께**
    `spec/5-system/14-external-interaction-api.md`·`spec/5-system/6-websocket-protocol.md` 를
    한 커밋에 담았다(`git log --name-only` 실측). 두 번째 spec 커밋 `fe4d58de7`도 같은 패턴 —
    `websocket.service.spec.ts` 갱신, `plan/**` 3건, `review/consistency/23_29_27/**` 와 함께
    `spec/5-system/14-external-interaction-api.md` 를 동봉한다.
  - 상세: CLAUDE.md 는 `developer` 를 `spec/` read-only(좁은 자기반증형 예외 제외)로,
    `spec/` 쓰기는 `project-planner` 소관으로 규정한다. `plan/in-progress/sse-nodeoutput-allowlist.md`
    작업 목록도 §R17 표 갱신 항목에 "(planner 턴)" 을 명시적으로 붙여 이 경계를 스스로 예고했다.
    그런데 실제 git 이력에는 별도 planner 세션·별도 커밋 경계가 보이지 않고, 코드/테스트 fix 와
    spec 정정이 한 커밋으로 합쳐져 있다 — 커밋 메시지 자체도 `fix(security)`/`fix(spec)` 이지
    `docs(spec)` 류로 분리되지 않았다. **내용 자체는 plan 체크리스트와 1:1 대응**하고(§R17 표
    flip, WS §4.4 caveat, `envelope.output` 미해소 정정) 무관한 spec 확장은 아니므로 "범위
    이탈"로 단정하기는 어렵다 — 다만 "developer 가 planner 턴 없이 spec 을 직접 고쳤는가" 라는
    프로세스 경계 질문은 이 diff 만으로는 부재 증명이 되지 않는다(실제 세션 전환이 있었는데
    같은 브랜치에 이어 커밋했을 수도 있다). 같은 세션의 `22_51_46`·`23_16_40` scope.md 도
    각각 "역할 분리 준수 여부는 이 리뷰의 관점 밖(프로세스 감사 영역)" 이라 명시하며 동일
    지점을 미해결로 남겼고, 이번 최종 스냅샷에서 git 이력을 재확인해도 그 여백은 좁혀지지
    않았다.
  - 제안: 코드 결함은 아니므로 이번 리뷰의 차단 사유는 아니다. 다만 다음에 같은 패턴(코드
    수정 중 spec 반영이 필요한 작업)을 진행할 때는 spec 변경을 별도 커밋(가능하면
    `docs(spec):` 프리픽스)으로 분리해 두면, 사후에 "이 spec 편집이 실제로 planner 턴을
    거쳤는지"를 diff 만으로 확인할 수 있어 이런 여백이 남지 않는다.

- **[INFO]** 두 번째 spec 커밋(`fe4d58de7`)이 처리한 CRITICAL 은 **코드 확장이 아니라 spec
  서술 축소**로 닫혔다 — 스코프를 넓히지 않는 방향으로 처리된 모범 사례.
  - 위치: `review/consistency/2026/08/23/23_29_27/RESOLUTION.md`(전체), `spec/5-system/6-websocket-protocol.md`
    gate `425`(`execution.node.*` 의 `envelope.output` 은 이 좁히기 대상이 아니다" caveat 추가)
  - 상세: checker 처방은 "`envelope.output` 에도 allowlist 를 적용하라"였으나, 실측(정본
    구현에 직접 적용해 버튼 재개 record 가 `{}` 로 무너지는 것을 확인)으로 그 처방이 기능을
    깨뜨림을 보이고, 대신 **보장 문구를 실측에 맞춰 좁히는 쪽**을 택했다. 코드 diff(위
    4파일)에는 이 CRITICAL 대응으로 인한 신규 프로덕션 로직 추가가 없다 — `websocket.service.spec.ts`
    에 "[잔여] `envelope.output` 은 아직 allowlist 를 지나지 않는다" 캐너리(현 상태를 고정하는
    negative assertion)만 추가됐다. 요청받지 않은 기능을 추가로 얹어 범위를 넓히는 대신, 이미
    잡힌 범위 안에서 정직하게 물러난 처리다.
  - 제안: 조치 불요(참고용 긍정 기록).

- 포맷팅(공백·줄바꿈)만의 변경, 사용하지 않는 import 추가/정리, 관련 없는 리팩토링, 의도 밖
  설정 파일 변경, 무관한 파일·코드 영역 수정은 발견되지 않았다. 신규 함수
  `allowlistFanoutNodeOutput` 은 단일 chokepoint(`toFanoutEnvelope`) 안에서만 호출되고, 신규
  import(`allowlistNodeOutputKeys`)는 그 함수가 실제로 쓰는 것뿐이다. 56개 파일 전부가
  "SSE/fanout `nodeOutput` 을 REST 와 같은 강도로 닫는다"는 단일 목표(및 그 목표를 검증·
  기록하는 이 저장소의 상시 강제 워크플로) 안에 있다.

## 요약

핵심 프로덕션 변경(4개 TS 파일 + 대응 spec.ts 3건)은 `toFanoutEnvelope` 단일 chokepoint 에
최소 배선으로 국한돼 있고, 요청받지 않은 기능 확장·drive-by 리팩토링·무관한 포맷팅/임포트/주석
변경은 발견되지 않았다. 전체 56파일 diff 의 대부분(44개)은 이 프로젝트가 구현 완료 후 상시
강제하는 `/ai-review`+`/consistency-check` 워크플로 산출물이자 그 결과를 반영한 plan 트래커
갱신이라 범위 이탈이 아니며, 이는 이미 같은 세션의 두 이전 scope 라운드(`22_51_46`,
`23_16_40`)가 도달한 결론과 일치한다. 유일하게 새로 확인해 기록할 가치가 있는 지점은
`spec/5-system/` 두 파일의 편집이 코드 fix 커밋에 동봉돼 plan 이 스스로 예고한 "(planner
턴)" 분리가 git 이력상 보이지 않는다는 점이다 — 내용은 계획과 1:1 대응해 범위 이탈로 단정할
근거는 아니지만, 프로세스 경계(역할 분리) 확인은 이 diff 만으로 완결되지 않는 여백으로
남는다. 두 번째 spec 커밋이 CRITICAL 을 코드 확장이 아니라 보장 문구 축소로 처리한 것은
스코프 관점에서 긍정적이다.

## 위험도

LOW
