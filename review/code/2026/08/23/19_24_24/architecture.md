# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** `shared/utils/` 관례를 깨는 유일한 파일 — 도메인 타입이 "공유" 계층에 결속
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:1`
  - 상세: `shared/utils/` 하위 8개 파일 중 `node-output-allowlist.ts` 만 `../../nodes/core/node-handler.interface` (도메인 타입 `NodeHandlerOutput`)를 import 한다 (`grep -rn "from '\.\./\.\./nodes" src/shared/utils/*.ts` 로 확인 — 이 파일 1건뿐). 자매 `strip-external-only-fields.ts` 는 JSDoc 에서 스스로 "순수·범용, 다중 소비처" 를 표방하는데, 이번 파일은 "`NodeHandlerOutput` 에 결속돼 있고 소비처도 `getStatus` 한 곳" 이라고 스스로 인정한다(파일 상단 주석, `codebase/backend/src/shared/utils/node-output-allowlist.ts:3-6`). 직전 리뷰(`19_00_23` WARNING #2)가 지적한 "순수 유틸에 도메인 타입을 섞은" 계층 역전을, 같은 파일을 분리하는 방식으로 대응했으나 **분리된 새 파일이 여전히 `shared/utils/` 안에 있다** — "shared = 도메인 비의존" 이라는 디렉토리 층위 불변식은 그대로 깨진 채 국소화만 됐다. `import type` 이라 런타임 순환은 없고(`nodes/core/node-handler.interface.ts` 는 `shared/conversation-thread`·`shared/execution-resume` 만 참조, `shared/utils` 를 되돌아 참조하지 않음 — 실제 순환 아님), 소비처도 1곳뿐이라 blast radius 는 작다. 다만 파일 자체가 스스로 "도메인에 결속됐다" 고 선언하는 이상 위치는 `modules/external-interaction/`(유일 소비처) 또는 `nodes/core/` 인접이 층위 표현에 더 맞는다.
  - 제안: 이번 PR 은 blocking 사유는 아니다(테스트·컴파일타임 결속으로 안전은 확보됨). 후속에서 유일 소비처 근처(`modules/external-interaction/`)로 재배치하거나, `shared/` 하위에 "domain-bound" 서브폴더를 신설해 순수 유틸과 명시적으로 갈라두면 `shared/utils/` 의 불변식(모든 파일이 도메인 비의존)을 되찾을 수 있다.

- **[INFO]** 컴파일타임 결속의 비대칭이 문서와 일치 — 설계 의도 확인
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:76-84` (`assertAllowlistCoversHandlerContract`)
  - 상세: `PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number] ? true : never` 형태의 assertion 은 "타입의 공개 키가 allowlist 를 벗어나면 컴파일 실패" 만 잡고, 반대(allowlist 가 타입보다 넓은 것, 예: `formConfig` 등 wire 전용 키)는 잡지 않는다. 이 비대칭은 JSDoc(`:30-31`)에 의도로 명시돼 있고, `node-output-allowlist.spec.ts` 의 리터럴 대조 테스트(`it('[리터럴] wire 전용 키가 목록에서 사라지면...')`)가 그 갭을 커버한다. 설계·문서·테스트가 삼각으로 맞아떨어지는 좋은 예 — 결함이 아니라 확인 사항으로 기록.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** 파이프라인 구성(deny-list → allowlist)이 단일 책임을 유지한 채 합성됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:392-394`
  - 상세: `allowlistNodeOutputKeys(stripAndRedact(nodeExec.outputData) ?? {})` 는 값 마스킹(`deepRedactSecrets`, `stripAndRedact` 내부) → 필드 제거(deny-list, `llmCalls`) → 최상위 키 allowlist 순으로 3개의 독립된 단일책임 필터를 체이닝한다. 각 필터가 자신의 축(값/깊은 필드/최상위 키)만 책임지고 서로 겹치지 않아 SRP 와 조합 가능성(composability) 이 잘 유지된다. `stripAndRedact` 는 여전히 3개 출구(waiting `nodeOutput`·terminal `result`·terminal `error`) 전부에 걸리고, allowlist 는 shape 결속(`NodeHandlerOutput`)상 1개 출구에만 추가되는 설계도 JSDoc(`interaction.service.ts:307-315`)·spec 표(`spec/5-system/14-external-interaction-api.md`)·plan(`plan/complete/nodeoutput-allowlist.md`) 세 곳이 정합적으로 기술한다.
  - 제안: 없음.

## 요약

핵심 변경은 `getStatus` 의 waiting `nodeOutput` 출구 1곳에 대해 fail-open deny-list(`EXTERNAL_STRIPPED_FIELDS = ['llmCalls']`) 위에 fail-closed allowlist(`allowlistNodeOutputKeys`)를 추가 계층으로 얹은 것이다. 새 모듈은 단일 함수·단일 상수로 응집도가 높고, `NodeHandlerOutput` 타입에서 파생한 컴파일타임 assertion 으로 "목록이 타입과 동기화된다"는 주장을 실제로 강제해 손-동기화 위험을 없앴다(2차 미러 문서 회피). 직전 리뷰가 지적한 계층 역전(순수 유틸에 도메인 타입 혼입)은 파일 분리로 대응됐으나, 분리된 파일이 여전히 `shared/utils/` 안에 남아 있어 그 디렉토리의 "도메인 비의존" 불변식은 국소화됐을 뿐 완전히 회복되지는 않았다(이 리뷰 세션에서 실측: `shared/utils/*.ts` 8개 중 도메인 타입을 import 하는 유일한 파일). 실질적인 런타임 순환 의존성은 없고(`import type` + 역방향 참조 부재 확인), 적용 범위(REST 1곳 vs terminal 2곳 vs SSE/fanout 잔여)는 spec §R17 표·트래커 항목·CHANGELOG·plan 네 곳에 일관되게 열거돼 과거 이 저장소가 반복했던 "부분 해소를 전체로 flip" 패턴을 피했다. 전체적으로 아키텍처 관점에서는 견고하며, 남은 것은 파일 배치 하나의 개선 여지뿐이다.

## 위험도

LOW
