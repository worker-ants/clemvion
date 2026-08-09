# 변경 범위(Scope) 리뷰

## 방법론 노트

프롬프트 페이로드(`_prompts/scope.md`, 4042줄)는 예산 제한으로 40개 파일만 "전체 파일
컨텍스트"로 실었고 unified diff 섹션은 제공되지 않았다(전 파일이 "변경 유형: Review"). 실제
변경분(`origin/main...HEAD`, 75개 파일: codebase 73 + plan 문서 2)은 `git diff` 로 직접 대조해
전량 확인했다 — 프롬프트에 없는 나머지 ~35개 파일(예: `execution-engine.service.ts`,
`ai-turn-executor.ts`, `transform.handler.ts`, `makeshop/metadata/types.ts` 등)도 diff 기준
누락 없이 검토했다.

이 브랜치는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 가 추적하는 "lint 게이트
복구" 작업의 3개 커밋으로 구성된다:

1. `style(backend): prettier 122건` — prettier 3.9 포맷 규칙 일괄 적용(union 타입 줄바꿈 collapse,
   `registerAs(...)` 인자 재포맷 등)
2. `refactor(backend): no-unnecessary-type-assertion 54건` — ESLint `--fix` 로 불필요한 `as X`
   제거 + auto-fix 가 만든 타입 회귀 6건 원복(근거 주석 + `eslint-disable` 부착)
3. `fix(backend): 2단계가 만든 신규 error 8건 정리` — 2단계가 고아로 만든 import 6건 제거 +
   `telegram-client.ts` 의 로드베어링 assertion 1건 복원

세 커밋 모두 diff 내용이 커밋 메시지가 명시한 성격(포맷/타입 단언 제거/회귀 정리)과 1:1로
일치한다. `plan/in-progress/*.md` 2건 갱신은 같은 작업의 진행 기록으로 프로젝트 관례(작업 중
plan 동기화)에 부합한다.

## 발견사항

- **[WARNING]** 제거된 타입 단언을 설명하던 주석이 코드 변경 후에도 그대로 남아 현재 코드와
  불일치한다.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:60-61`
    (`assertRefFormat` 메서드)
  - 상세: 2단계 커밋(`6501efb4f`)이 `const refStr: string = ref as unknown as string;` 의
    `as unknown as string` 을 제거해 `const refStr: string = ref;` 로 바꿨다(`ref` 가 이
    분기에서 `never` 로 좁혀지므로 bottom-type 특성상 캐스트 없이도 안전하게 대입되며,
    `nest build` 로도 검증됨 — 코드 자체는 문제 없음). 그런데 바로 위 줄의 주석
    `// (refStr: isSecretRef 가 value is string 타입가드이므로 false branch 에서 never 로
    좁혀지는 것을 방지.)` 는 "그 좁혀짐을 막기 위한" 캐스트의 존재를 전제로 쓰여 있다. 캐스트가
    사라진 지금 이 주석은 실제로 존재하지 않는 메커니즘을 설명하고 있어 다음 읽는 사람이
    "왜 캐스트가 없지?"·"이 주석이 말하는 캐스트는 어디 갔지?" 로 혼동할 수 있다. 이 PR의
    두 단계(2단계 기계적 제거, 3단계 회귀 정리) 어느 쪽에서도 이 사이트는 "로드베어링"
    목록(execution-context.service.ts / retry-turn.service.ts / telegram-client.ts 등)에
    포함되지 않아 주석 정리가 누락된 것으로 보인다.
  - 제안: 주석을 `never→string 대입은 bottom-type 특성상 캐스트 불필요` 로 갱신하거나,
    이제 자명한 내용이면 주석 자체를 제거한다.

- **[INFO]** `no-unnecessary-type-assertion` 제거가 일부 지점에서 반환값의 TS 타입을
  구체 shape → `unknown` 으로 넓힌다 (런타임 값은 동일, 컴파일-타임 계약만 느슨해짐).
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — 함수
    `toChatChannelEvent` 내 `execution.completed`/`execution.cancelled` 분기의 `result` 필드
    (`(event.payload as { result?: unknown }).result ?? {}` 에서 후행
    `as { outputs?: unknown; finalNodeId?: string; finalPort?: string }` / `as { cancelledBy?: … }`
    가 제거됨)
  - 상세: 이 PR 의 명시된 목적(no-unnecessary-type-assertion 규칙 정리) 범위 내의 변경이며
    `nest build`·전체 테스트가 통과했으므로 컴파일 오류나 런타임 회귀는 아니다. 다만 WS로
    나가는 `result` 필드의 소비 측(frontend 타입 등)이 이 구체 shape 애노테이션에 기대고
    있었다면, 이번 완화로 향후 실수(오타 필드 접근 등)를 컴파일 타임에 못 잡을 여지가 소폭
    커진다 — 스코프 위반은 아니고 부수 효과로 기록.
  - 제안: 별도 조치 불요(범위 내). 후속 타입-안전성 리뷰에서 참고.

## 요약

세 커밋(prettier 122건 → no-unnecessary-type-assertion 54건 → 파생 회귀 8건 정리)이 커밋
메시지가 밝힌 범위와 정확히 일치하며, 75개 파일에 걸친 큰 diff 는 "lint 게이트 복구"라는
과제 자체가 저장소 전역 규칙 적용을 요구하는 성격이라 폭 자체는 스코프 위반이 아니다. 임의
기능 추가·무관 리팩토링·불필요한 import 추가는 발견되지 않았고, 로드베어링 assertion 6~7건은
전부 원복 + 근거 주석으로 명시적으로 처리되어 있다(`nest build`/unit/e2e 전량 통과 근거도
커밋 메시지에 기록). 유일한 실질적 흠은 `secret-resolver.service.ts` 에서 제거된 캐스트를
설명하던 주석이 갱신되지 않고 남은 것(WARNING) — 코드 정확성에는 영향 없으나 문서-코드
불일치다. `chat-channel.dispatcher.ts` 의 반환 타입 완화는 범위 내 부수 효과로 INFO 처리했다.
plan 문서 갱신 2건은 작업 추적 관례에 맞다.

## 위험도

LOW
