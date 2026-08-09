# 테스트(Testing) 리뷰

## 사전 확인 사항 (범위 재구성)

`_prompts/testing.md` 에 실린 34개 파일이 전부 `변경 유형: Review` + "전체 파일 컨텍스트"만
있고 unified diff 가 하나도 없었다. `git diff origin/main...HEAD -- codebase/backend` 로
직접 대조한 결과, 이 PR 은 실제로 **74개 파일**을 건드리는데 프롬프트에는 그중 34개만
실렸다 — 나머지 40개(`retry-turn.service.ts`, `execution-context.service.ts`,
`hooks.service.ts`, `telegram-client.ts`, `execution-engine.service.spec.ts`,
`integration-oauth.service.spec.ts`, `mcp-client.service.spec.ts`,
`websocket.gateway.spec.ts` 등)가 통째로 빠졌다. 이는 이미 이 브랜치의 최신 커밋
(`51a7c9a8b`, `plan/in-progress/harness-review-gate-followups.md`)이 실측해 문서화한
`--prepare` 배치 분할(2 batch)이 같은 세션 디렉터리를 공유해 뒤 배치가 앞 배치를 덮어쓰는
기존 harness 결함이다. 새 결함이 아니라 이미 추적 중인 항목이므로 여기서는 **직접 `git
diff` 로 40개 파일을 모두 대조해 실제 diff 로 리뷰**했다 (아래 근거).

## 변경 성격 요약

`plan/in-progress/backend-lint-gate-broken-on-main.md` 대로, 이 PR 은 순수 기계적
변경이다: (1) prettier 122건 포맷팅, (2) `no-unnecessary-type-assertion` 오토픽스로
불필요 `as X` 캐스트 54건 제거(멀티라인 union 타입 한 줄화 포함), (3) 그 과정에서 발생한
고아 import 6건 + 로드베어링 assertion 회귀 7건(빌드 파괴형 2건 + `no-base-to-string`
lint-only 1건 등)을 정정 커밋(`ba8ce35a4`)에서 복구. 74개 파일 전체에서 로직·분기·리턴값을
바꾸는 diff hunk 는 발견되지 않았다 — 전부 (a) prettier 재개행 (b) `as X` 삭제 (c) 미사용
import 삭제 (d) 로드베어링 assertion 복원 + 주석 + `eslint-disable` 중 하나다.

## 발견사항

- **[INFO]** 리뷰 프롬프트 배치 누락 — 위 "사전 확인 사항" 참고
  - 위치: 오케스트레이터/harness (`--prepare` 배치 분할), 코드 변경 아님
  - 상세: `testing.md` 에 실린 34개 파일 밖에서 코드 로직이 바뀐 hunk 가 있는지 별도 확인이
    필요했다. `git diff` 로 직접 대조해 40개 누락 파일도 전부 prettier/type-assertion
    reformatting 뿐임을 확인했으므로 이번 리뷰 결과 자체에는 영향 없음.
  - 제안: 이미 `plan/in-progress/harness-review-gate-followups.md` 에 원인(세션 디렉터리
    공유)까지 좁혀진 상태이므로 별도 조치 불요 — 후속 harness 수정 작업에서 처리.

- **[INFO]** 신규 테스트 없음 — 적절함
  - 위치: 전체 diff (74 파일)
  - 상세: 순수 리팩터(포맷팅 + 불필요 타입 단언 제거)라 새 동작이 없고, 회귀 검증은
    새 단위 테스트가 아니라 **기존 테스트 스위트 전량 재실행**(`lint` PASS 56s · `unit`
    PASS 88s · `build` PASS 155s · `e2e` PASS 297s/261 tests, `plan/in-progress/
    backend-lint-gate-broken-on-main.md` 체크리스트 근거)으로 이루어졌다. `no-unnecessary-
    type-assertion` 오토픽스가 실제로 로드베어링 assertion 을 건드린 7건 중 2건은 `nest
    build` 의 TS2542/TS2339 컴파일 에러로, 1건(`telegram-client.ts` 의
    `no-base-to-string`)은 lint 만 잡는 종류였는데 — 이건 `describeFetchError` 기존
    단위 테스트(`telegram-client.spec.ts:31-35`, non-Error cause 케이스)가 정확히 그
    라인을 실행 경로로 통과시키고 있어 **런타임 동작 회귀 여부까지 이미 커버**된다.
  - 제안: 없음 (검증 경로가 이 클래스의 변경에 적절 — build/lint 로 타입 레벨 안전성을,
    기존 테스트로 런타임 동작 안전성을 모두 잡음).

- **[INFO]** `resolve-dynamic-ports.ts` 의 `type: p.type` 캐스트 제거 지점 — 기존 회귀
  테스트로 커버됨
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/resolve-dynamic-ports.ts:295`
    (`presentationButtonPorts` fallback), `:332` (`resolveEffectiveOutputPorts` 의
    static-output 분기)
  - 상세: 두 지점 모두 `as ResolvedPortType` 제거. `resolve-dynamic-ports.spec.ts` 의
    `'no buttons at all: returns static fallback outputs as weak ports'`(213번대)와
    `'no dynamicPorts (static): returns static outputs as weak ports'`(416번대) 테스트가
    각각 `type: 'data'` / `type: 'error'` 필드를 명시적으로 단언하고 있어, 캐스트 제거로
    인한 타입 조용한 확장(silent widening)이 있었다면 이 두 테스트가 잡았을 것 — 실질
    회귀 위험 없음.
  - 제안: 없음 (정보성 확인).

- **[INFO]** 변경된 spec 파일 4개(`ai-agent.memory.spec.ts`,
  `workflows.service.spec.ts`, `information-extractor.memory.spec.ts`, 및 프롬프트에
  없던 `execution-engine.service.spec.ts` / `integration-oauth.service.spec.ts` /
  `mcp-client.service.spec.ts` / `websocket.gateway.spec.ts`)는 전부 멀티라인 union 타입
  한 줄 정리뿐 — `expect(...)` 단언·mock 구성·describe/it 구조에는 손대지 않았다.
  - 위치: 각 파일의 `as ... | undefined` 캐스트 라인(예:
    `ai-agent.memory.spec.ts:39-41`, `workflows.service.spec.ts:2172-2175`)
  - 상세: 테스트 격리·가독성·assertion 강도에 영향 없음.
  - 제안: 없음.

## 요약

74개 변경 파일(프롬프트에 실린 34개 + `git diff` 로 직접 대조한 나머지 40개) 전량이
prettier 포맷팅과 `no-unnecessary-type-assertion` 오토픽스 산출물이며, 로직·분기·리턴값을
바꾸는 hunk 는 없다. 오토픽스가 만든 로드베어링 assertion 회귀 7건은 별도 커밋
(`ba8ce35a4`)에서 근거 주석 + `eslint-disable` 로 정정됐고, 이 중 컴파일 에러 2건은
`nest build` 로, lint-only 1건(`no-base-to-string`)은 기존 `telegram-client.spec.ts` 단위
테스트가 이미 그 실행 경로를 커버하고 있어 런타임 회귀 여부까지 실질적으로 검증된다.
새 테스트가 추가되지 않은 것은 이 변경의 성격(동작 불변 리팩터, TEST WORKFLOW 전량 통과
검증됨)에 부합한다. 리뷰 프롬프트 자체가 harness 의 기존에 추적 중인 배치 분할 버그로 74개
중 40개 파일을 누락했지만, 직접 `git diff` 대조로 전량 확인해 이 결론에 영향은 없다.

## 위험도
NONE
