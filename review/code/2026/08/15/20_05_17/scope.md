# 변경 범위(Scope) 리뷰 — ws-event-types-extract (fresh review, resolution 반영 후)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 53개 변경 파일 전체를 실측(2195 insertions / 311
deletions) — 프롬프트에 실린 목록과 정확히 일치. 대조 대상 plan:
`plan/in-progress/ws-event-types-extract.md`(`websocket.service` 의 런타임 값을 의존성-프리
모듈로 분리, `spec_impact: none`). 이번 라운드는 직전 코드 리뷰(`19_27_37`, Critical 0 · Warning
5)의 RESOLUTION 반영 이후 fresh 재검토이므로, RESOLUTION.md 가 주장한 각 처분이 실제 코드에
반영됐는지 `git diff`/`Read` 로 직접 대조했다:

- `codebase/backend/src/modules/websocket/websocket.gateway.ts` (W1 — 순환 당사자 전환 누락)
- `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` (W2 —
  `TERMINAL_SHAPE` JSDoc 순서)
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` (W3 — `NotificationEventType`
  JSDoc 병합, W4 — WARN #10 orphan 이동)
- `codebase/backend/src/modules/websocket/websocket.service.ts` (W4 대상 목적지)

## 발견사항

- **[INFO]** RESOLUTION 이 주장한 4개 코드 수정(W1~W4)이 실제로 커밋에 반영됐음을 직접 대조로 확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:23`
    (`import { ExecutionEventType } from './websocket-events.types';` — 옛 경로에서 전환 완료),
    `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (`TERMINAL_SHAPE` JSDoc+선언이 클래스 JSDoc **앞**에 위치, 클래스 JSDoc 이 `@Injectable()` 바로
    위로 복원됨), `codebase/backend/src/modules/websocket/websocket-events.types.ts`
    (`NotificationEventType` 위 JSDoc 이 한 블록으로 병합, `WARN #10` 블록은 이 파일에서 사라지고
    `codebase/backend/src/modules/websocket/websocket.service.ts:52-59` 의 `CREDENTIAL_KEY_PATTERN`
    선언 바로 위로 이동).
  - 상세: "문서에 쓴 수정"과 "실제 diff" 가 갈릴 수 있다는 것이 이 저장소가 반복 기록한 실패
    형태(`feedback_measured_claim_proxy_and_timing`)라 직접 대조했다. 4건 모두 RESOLUTION.md 서술과
    일치하며, gateway.ts 전환은 정확히 이전 scope 리뷰(`19_27_37`)가 지적한 "순환의 두 핵심 노드
    중 하나가 전환에서 빠졌다"는 결함을 닫는다 — 새로운 스코프 확장이 아니라 같은 작업의 완결.
  - 제안: 없음 (확인용).

- **[INFO]** 신설 회귀 테스트(`websocket-events.types.spec.ts`, 169줄)는 원래 plan 의 "조치" 목록에
  없던 항목이지만 W5 fix 로 정당하게 편입됨
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (신규 전체)
  - 상세: plan 최초 조치 목록(파일 31, `ws-event-types-extract.md`)에는 이 테스트 파일이 없었다.
    직전 코드 리뷰의 testing checker 가 "불변식(의존성-프리 모듈이 순환에 재편입되지 않음)에 전용
    회귀 테스트가 없다"고 WARNING(W5)으로 지적했고, 그 fix 로 이번 diff 에 추가됐다. 이 테스트가
    지키는 불변식(모듈 specifier 0개)은 바로 이 리팩터가 신설한 계약 그 자체이고, 사용하는
    TypeScript Compiler API(`typescript` 패키지)도 이미 프로젝트 의존성 — 새 외부 의존성 추가나
    범위 밖 기능 확장이 아니라 이 작업이 도입한 위험을 이 작업 안에서 검증하는 정상적 확장이다.
    (별도 스코프 리뷰(`19_27_37`)에서도 동일 결론.)
  - 제안: 없음 — 조치 불필요, 기록용.

- **[INFO]** 이전 라운드의 리뷰/일관성 검토 산출물(`review/code/19_27_37/**` 11개,
  `review/consistency/18_53_27/**` 8개)이 이번 diff 에 포함됨
  - 위치: 파일 32~52
  - 상세: CLAUDE.md 는 developer 에게 구현 착수 직전 `consistency-check --impl-prep`, 구현 완료 후
    `/ai-review` + Critical/Warning fix 를 상시 승인된 강제 의무로 규정한다. `review/code/**`·
    `review/consistency/**` 는 각각 지정된 경로 규칙(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`,
    `review/consistency/...`)을 그대로 따르고 있어 무관한 파일 추가가 아니라 프로세스 의무 산출물이다.
  - 제안: 없음.

- **[INFO]** plan/spec 문서 변경(파일 27~31, 53)은 이 리팩터가 직접 유발한 부수효과 또는 체크리스트
  갱신뿐
  - 위치: `plan/in-progress/node-output-redesign/background.md`,
    `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
    `spec/5-system/6-websocket-protocol.md`(frontmatter `code:` 1줄)
  - 상세: 앞 3개는 `websocket.service.ts` 를 절대 라인 번호로 인용하던 문서가 이번 이동으로
    stale 화된 것을 심볼 기준으로 정정한 것 — 이 리팩터의 직접 파생 효과이며 plan 자체가 조치
    항목으로 명시했다. `spec-sync-...` 는 정본 트래커의 체크박스 갱신, `6-websocket-protocol.md`
    는 `code:` frontmatter 1줄 추가(spec 본문 무변경, `spec_impact: none` 과 무모순). frontend 파일,
    무관한 도메인 모듈, 포맷팅-only 변경은 diff stat 전체(53개 파일)에서 발견되지 않았다.
  - 제안: 없음.

## 스코프 밖 변경 여부 판정

53개 파일 전체를 `git diff origin/main...HEAD --stat` 로 실측한 결과 plan
(`ws-event-types-extract.md`)이 선언한 범위 — `websocket.service.ts` 의 값/타입 선언을
의존성-프리 모듈로 추출하고 호출부 22곳(+테스트 파일들)의 import 경로를 갱신 — 를 그대로 지킨다.
직전 리뷰(`19_27_37`) 이후 새로 반영된 것은 그 리뷰가 지적한 결함(W1~W5)의 fix 뿐이며, 전부
같은 작업의 완결 범위 안에 있다(새 기능·새 외부 의존성·무관한 모듈 수정 없음). 리팩터가 아닌
"실질 로직" 변경은 `execution-event-emitter.service.ts` 의 `TERMINAL_SHAPE` 모듈 스코프 복원
하나뿐이며, 이는 plan 이 사전에 "역재현 성공 기준"으로 명시한 항목이라 scope creep 이 아니다
(직전 라운드 scope 리뷰도 동일 결론).

## 요약

이번 fresh 재검토(53개 파일, +2195/-311)는 직전 코드 리뷰 RESOLUTION 이 주장한 4건의 코드 수정
(W1 gateway.ts 전환, W2 클래스 JSDoc 순서, W3 JSDoc 병합, W4 orphan 주석 이동)이 실제로 반영됐음을
`git diff`/`Read` 직접 대조로 확인했고, 신설 회귀 테스트(W5 fix)도 이 리팩터가 도입한 불변식을
겨냥한 정당한 범위 내 추가임을 확인했다. plan/spec 문서 변경은 이 리팩터의 직접 파생 효과 또는
표준 워크플로 의무 산출물뿐이고, frontend·무관 도메인·포맷팅-only 변경은 발견되지 않았다. 의도
이상의 변경, 불필요한 리팩터링, 기능 확장(over-engineering), 무관한 파일 수정은 발견되지 않았다.

## 위험도

NONE
