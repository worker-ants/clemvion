# 의존성(Dependency) Review

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: 전체 diff (`resume-state.schema.ts`, `ai-turn-executor.ts`, `ai-turn-executor.spec.ts`, `plan/in-progress/refactor/03-maintainability.md`, `review/**` 산출물)
  - 상세: `package.json`/`pnpm-lock.yaml` 변경이 diff 에 없다. 이번 변경은 기존에 이미 사용 중인 `zod`(backend `package.json`: `"zod": "^4.3.6"`)의 API 중 하나인 `z.custom<T>()` 를 `z.unknown()`/`z.array(z.unknown())` 대신 사용하도록 바꾼 것뿐이며, `import { z } from 'zod'` 구문 자체는 변경되지 않았다(기존 import 유지).
  - 제안: 없음.

- **[INFO]** 신규 import 2건은 모두 프로젝트 내부 모듈의 `type`-only import
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts:2-3`
  - 상세: `import type { ChatMessage } from '../../llm/interfaces/llm-client.interface'`, `import type { PresentationPayload } from '../../../shared/conversation-thread/conversation-thread.types'`. 둘 다 외부 패키지가 아닌 프로젝트 내부 모듈 참조이며 `type`-only 이므로 런타임 의존성·번들 크기에 영향이 없다(컴파일 시 완전히 제거됨). `ai-turn-executor.ts` 가 이미 동일 타입을 import 하고 있었으므로 신규 결합이 아니라 기존 결합을 스키마 레이어로 옮긴 것에 가깝다. 순환 의존 여부도 확인 — `llm-client.interface`/`conversation-thread.types` 양쪽 모두 `execution-engine/utils` 를 역참조하지 않아 순환 없음.
  - 제안: 없음.

- **[INFO]** 버전 고정·라이선스·취약점 항목은 해당 없음
  - 위치: 해당 없음 (신규 의존성 없음)
  - 상세: 새로 추가되거나 버전이 변경된 외부 패키지가 없으므로 버전 고정(pinning) 정책 준수 여부, 라이선스 호환성, 알려진 CVE 노출 여부를 재검토할 대상이 없다. 기존 `zod ^4.3.6` 자체의 라이선스(MIT)·취약점 상태는 이번 diff 로 인해 달라지지 않는다.
  - 제안: 없음.

- **[INFO]** 표준 라이브러리/기존 의존성으로 대체 가능성 — 해당 없음
  - 위치: 해당 없음
  - 상세: 이번 변경 자체가 "불필요한 의존성 도입"이 아니라 오히려 이미 쓰이던 `zod` 의 표현력을 활용해 소비처의 `as ChatMessage[]`/`as PresentationPayload[]` 같은 수동 타입 단언(사실상 임시방편)을 스키마 기반 타입 파생으로 대체한 것이다. 새 라이브러리를 도입하지 않고 기존 의존성의 미사용 기능(`z.custom`)으로 목적을 달성했다는 점에서 오히려 바람직한 방향.
  - 제안: 없음.

- **[INFO]** 번들 크기·빌드 시간 영향 없음
  - 위치: `resume-state.schema.ts`, `ai-turn-executor.ts`
  - 상세: `z.custom<T>()` 는 predicate 미제공 시 identity validator(`() => true`)로 컴파일되는 zod 내장 API 이며, 신규 런타임 코드 경로나 외부 모듈을 추가하지 않는다. `type`-only import 는 tsc/swc 단계에서 완전히 erasure 되므로 backend 번들·빌드 시간에 실질적 영향이 없다. 변경분은 순수 타입 시스템 레벨.
  - 제안: 없음.

- **[INFO]** 기존 의존성과의 버전 충돌/호환성 — 해당 없음
  - 위치: 해당 없음
  - 상세: zod 버전 범위(`^4.3.6`)가 변경되지 않았고, `z.custom` 은 zod v4 에 이미 존재하는 안정 API 이므로 다른 의존성과의 호환성 문제가 발생할 여지가 없다.
  - 제안: 없음.

- **[INFO]** 내부 모듈 의존 관계 — 스키마 레이어가 도메인 인터페이스 타입을 참조하는 방향 자체는 합리적이나 향후 확장 시 주의
  - 위치: `resume-state.schema.ts` (execution-engine/utils → llm, shared/conversation-thread)
  - 상세: `execution-engine/utils` 라는 저수준 유틸리티 레이어가 `llm`·`shared/conversation-thread` 두 모듈의 인터페이스 타입을 import 하는 구조가 됐다. type-only 이고 순환도 없어 현재는 문제가 없으나, 이 스키마 파일이 여러 모듈의 도메인 타입을 계속 흡수하게 되면 "형태 문서화 전용 유틸"이라는 원래 책임 범위를 넘어 다중 모듈의 타입 집합소가 될 잠재 리스크가 있다(architecture reviewer 도 동일 지점 INFO 처리).
  - 제안: 신규 필드에 도메인 타입을 추가할 때마다 "이 스키마 파일이 형태 문서화 목적을 벗어나 특정 모듈에 대한 과도한 지식을 갖게 되는지"를 개별 판단할 것을 권장(강제 아님).

## 요약

이번 diff 는 `package.json`/lockfile 변경이 전혀 없는 순수 타입 레벨 리팩터로, 새 외부 패키지 도입이 없다. 기존 의존성인 `zod(^4.3.6)`의 `z.custom<T>()` API 를 활용해 `z.unknown()`/`z.array(z.unknown())` 로 선언되어 있던 3개 필드(`messages`/`turnDebugHistory`/`allPresentations`)의 `z.infer` 타입만 sharpen 했고, 신규 import 2건은 모두 프로젝트 내부 모듈에 대한 `type`-only import 라 런타임 의존성·번들 크기·빌드 시간에 영향이 없다. 버전 고정, 라이선스, 취약점, 기존 의존성과의 충돌 등 통상적인 의존성 리스크 항목은 모두 해당 사항이 없으며, 유일하게 눈에 띄는 점은 스키마 유틸리티 레이어가 점진적으로 여러 도메인 모듈의 타입을 흡수하는 구조적 방향성 정도인데 이는 정보성 수준이다.

## 위험도

NONE
