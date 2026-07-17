# 유지보수성(Maintainability) 리뷰 — `@workflow/ai-end-reason` 패키지 신설 + drift 구조적 차단

## 발견사항

- **[WARNING]** `output-shape.ts` 에 이동한 상수를 설명하던 JSDoc 이 고아(orphaned)로 남음
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:112-121`
  - 상세: `MULTI_TURN_INTERACTION_TYPES` 상수 선언(`const MULTI_TURN_INTERACTION_TYPES = new Set([...])`)이 이번 diff 에서 삭제되고 `@/lib/conversation/interaction-type-registry` 로부터의 import(라인 13)로 교체됐다. 그런데 그 상수를 설명하던 직전 JSDoc 블록(`/** Multi-turn marker values recognised ... Keep in sync with spec/conventions/interaction-type-registry.md — adding a new value here without updating the registry is rejected by the AST guard in lib/__tests__/interaction-type-exhaustiveness.test.ts. */`)은 지워지지 않고 그대로 남아 이제 아무 심볼도 설명하지 않는 채로 떠 있다(라인 112-119). 이어서 라인 120-121 에 빈 줄이 두 번 겹쳐 남아(원래 상수 선언 뒤 blank line + 상수 자체가 빈 줄로 치환된 흔적) 시각적으로도 "여기 뭔가 있었다"는 신호를 준다. 이 코멘트는 "여기서 값이 빠지면 AST 가드가 잡는다"고 주장하지만, 실제로 그 상수는 이제 이 파일에 없고 실제 정의·가드는 `interaction-type-registry.ts` 로 옮겨갔다(그 파일엔 이미 정확한 설명이 별도로 있음, "multi-turn 대화 interactionType 만... 여기서 누락되면 미리보기 탭이 사라진다"). 다음 사람이 이 파일만 보고 편집하면 잘못된 멘탈 모델을 갖게 된다.
  - 제안: 라인 112-119 의 고아 JSDoc 블록과 중복 빈 줄(120-121)을 삭제한다. import 문(라인 13) 바로 위에 "정의·가드는 `interaction-type-registry.ts` 로 이동" 한 줄만 남기면 충분하다.

- **[WARNING]** `satisfies` + `Exclude` "양방향 잠금" 단언 보일러플레이트가 3곳에 거의 동일하게 복붙됨
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts:30-36`, `:50-54` / `codebase/packages/ai-end-reason/src/index.ts:90-95`
  - 상세: `type Missing<X> = Exclude<T, (typeof VALUES)[number]>; const _noMissing: [Missing<X>] extends [never] ? true : never = true; void _noMissing;` 형태의 6줄짜리 컴파일타임 exhaustiveness 단언이 이름만 바꿔 세 번 등장한다(`MissingInteractionType`/`MissingSource`/`MissingEndReason`). `grep -rn "extends \[never\]" codebase/` 로 확인한 결과 이 저장소에 이 idiom 을 감싸는 공용 헬퍼 타입이 없다 — 이번 PR 이전에는 아예 존재하지 않았던 패턴이라 재사용할 기존 유틸도 없다. 이 PR 의 핵심 동기가 "손으로 베낀 목록의 drift 를 구조적으로 제거"인데, 그 장치 자체를 만드는 코드가 손으로 3번 복붙되는 것은 방향과 살짝 어긋난다. (다만 이 복붙이 틀려도 최악의 결과는 "그 enum 의 exhaustiveness 검사가 약해짐"이지 잘못된 런타임 값이 새는 것은 아니라 심각도는 낮다.)
  - 제안: `[X] extends [never] ? true : never` 패턴을 감싸는 제네릭 헬퍼(예: `type AssertExhaustive<Missing> = [Missing] extends [never] ? true : never;`)를 두 파일이 공유할 수 있는 자리(예: frontend 는 `interaction-type-registry.ts` 내부에서 두 번만 재사용, 패키지는 별도 파일이라 굳이 공유할 필요는 낮음)에 두면 최소한 파일 내부 중복(2곳)은 줄어든다. 지금 수준(3곳, 짧은 정형 패턴)은 강한 리팩토링을 요구할 정도는 아니라 WARNING 으로 유지.

- **[INFO]** 리팩토링 잔재로 남은 중복 빈 줄
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:8-9`
  - 상세: `import type { WaitingInteractionType } ...` / `import type { ConversationTurnSource } ...` 두 줄이 삭제되면서 앞뒤 blank line 이 합쳐져 빈 줄이 2연속 남았다(라인 8, 9). 기능에는 영향 없는 순수 스타일 잔재.
  - 제안: 빈 줄 1개로 정리. (`no-multiple-empty-lines` 류 규칙이 이 저장소 frontend eslint 설정엔 명시돼 있지 않아 lint 로 자동 차단되지 않는다 — 리뷰로만 잡힘.)

- **[INFO]** 신규 `@workflow/ai-end-reason` import 의 배치가 파일마다 다름 (일관성)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:71` / `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:40` / `codebase/backend/src/nodes/core/node-handler.interface.ts:4`
  - 상세: `ai-agent.handler.ts` 에서는 새 import 가 다른 scoped-package import(`@nestjs/common`) 바로 다음, 즉 외부 패키지 import 그룹 안에 알파벳 순으로 자연스럽게 들어갔다. 반면 나머지 세 파일(`ai-turn-executor.ts`, `information-extractor.handler.ts`, `node-handler.interface.ts`)에서는 새 import 가 상대경로 import 그룹 **뒤**, 그것도 원래 있던 import-코드 사이 blank line 을 잠식하며 삽입돼 다음에 오는 JSDoc/타입 블록과 빈 줄 구분 없이 바로 붙어버렸다(예: `node-handler.interface.ts` 라인 4 의 import 바로 다음 줄이 공백 없이 `/** 웹훅 트리거의...`). 이 저장소 backend eslint 설정엔 `import/order` 류 규칙이 없어 자동으로 잡히지 않는다.
  - 제안: 4곳 모두 `ai-agent.handler.ts` 와 동일하게 외부 패키지 import 그룹 안에 정렬하고, import 블록과 그 아래 JSDoc/코드 사이 빈 줄 1개를 보존한다.

- **[INFO]** `isConversationOutput` 은 이번 diff 이후에도 여전히 다분기 OR-체인 — 리팩토링은 의도적으로 범위 밖
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:135-194`
  - 상세: 순환복잡도가 높은 이 함수(중첩 조건 4단 + 최종 4-way OR)는 이번 PR 이 손대는 값 소스(`CONVERSATION_END_REASONS`/`MULTI_TURN_INTERACTION_TYPES`)의 소비처다. `plan/in-progress/is-conversation-output-restructure.md` 자체가 이 함수를 "대화 UI 전체의 게이트라 건드리는 순간 회귀 위험이 크고, 이번 목표는 drift 차단이지 리팩토링이 아니다"라고 명시적으로 범위 제외했고, 이 판단은 합리적이다(같은 PR 에서 값 소스 교체 + 판정 로직 재작성을 동시에 하면 회귀 원인 특정이 어려워진다). 다만 "코드 복잡도" 관점에서 여전히 이 저장소의 복잡도 핫스팟이라는 사실은 변하지 않으므로 향후 별도 트래킹 대상으로 기록해 둘 가치가 있다(이미 이전 architecture 리뷰에서 지적된 이력이 plan 배경에 남아 있음).
  - 제안: 별도 후속 작업 항목으로만 인지 — 이번 PR 의 결함은 아님.

## 정합성 확인 (문제 없음 — 참고용)

- `codebase/packages/ai-end-reason` 의 `package.json`/`tsconfig.json`/`eslint.config.mjs`/테스트 위치(`src/__tests__/*.spec.ts`)는 템플릿으로 명시된 `graph-warning-rules` 와 실측 대조 결과 완전히 동형이다 — 새 패키지의 구조적 일관성은 우수하다.
- `node-handler.interface.ts` 에 추가된 `endReason: AiAgentEndReason` 관련 JSDoc(라인 417-438)은 길지만, "이 계약이 두 구현체의 교집합만 커버한다"는 bivariance 함정을 정확하고 밀도 있게 설명한다 — 장황함이 아니라 실제로 미묘한 타입-안전성 갭을 다음 사람에게 남기는 좋은 문서화 사례.
- `AiAgentEndReason`/`InformationExtractorEndReason`/파생 `ConversationEndReason` 세 타입과 `satisfies`+`Exclude` 이중 잠금 설계는 이름·역할이 명확히 분리되어 있고(§소유/비소유 경계를 README·JSDoc·spec backlink 3곳에서 일관되게 서술), 매직 넘버/문자열도 전부 도메인 리터럴로 컴파일타임 보증 아래 있다.
- `end-reason.spec.ts` 는 "타입이 이미 강제하는 것은 런타임에서 중복 검증하지 않는다"는 원칙을 명시하고 그 경계 밖(중복값·빈 배열·양쪽 도메인 기여 확인)만 정확히 테스트한다 — 테스트 범위 설계가 군더더기 없음.

## 요약

이번 diff 는 손으로 베낀 `endReason` 화이트리스트가 두 번 회귀를 일으킨 근본 원인(단일 SoT 부재)을 공유 패키지 + 컴파일타임 양방향 잠금으로 구조적으로 제거하는 잘 설계된 리팩토링이다. 신규 패키지는 기존 4개 shared 패키지의 템플릿·명명 관례를 정확히 따르고, 복잡한 타입 안전성 트레이드오프(bivariance, 부분집합 vs 전체집합)를 이례적으로 정밀하게 문서화했다. 발견된 결함은 모두 국소적 스타일 잔재 수준이다 — (1) `output-shape.ts` 에 옮겨간 상수를 설명하던 JSDoc 이 고아로 남아 다음 편집자를 오도할 수 있는 점이 그중 가장 신경 쓰이는 항목이고, (2) 같은 exhaustiveness-assertion 보일러플레이트가 헬퍼 없이 3곳에 복붙된 점은 이 PR 의 "drift 제거" 취지와 방향이 살짝 어긋나며, 나머지(중복 빈 줄, import 배치 비일관성, 기존 복잡도 핫스팟 잔존)는 사소하거나 의도적으로 범위 밖이다. 기능적 결함이나 회귀 위험으로 이어지는 항목은 없다.

## 위험도

LOW
