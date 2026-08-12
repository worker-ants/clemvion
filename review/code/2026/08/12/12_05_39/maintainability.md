# 유지보수성(Maintainability) 리뷰 결과

델타 요약: backend lint warning 잔여 21건 전량 처분(7파일) + `package.json` 에 `--max-warnings 0` 게이트 추가 + `plan/in-progress/backend-lint-gate-broken-on-main.md` 정정/기록 + 직전 리뷰 라운드(`11_06_12`, 25건 처분분) 산출물 커밋. `execution-engine.service.ts` / `triggers.service.ts` / `migrate-node-output-refs.ts` / `migrate-node-output-refs.spec.ts` 는 이전 라운드에서 이미 검토·승인된 내용과 동일 diff(누적 diff 기준 재노출)이며 이번에도 재확인함. 신규 검토 대상은 `workspace-reflection-canary.ts` · `chat-channel.dispatcher.ts` · `executions.service.ts` · `idempotency.interceptor.ts` · `chat-channel-config.dto.ts` · `ai-agent.schema.ts` · `render-tool-provider.ts` (총 21건) 이다. 전 파일 공통적으로 로직 변경 없이 라이브러리 경계(`getResponse<T=any>`, `Array.isArray` 의 `any[]` 좁힘, `.bind` 오버로드, `TransformFnParams.value`, `Map.Iterator.next().value`)에서 새던 암묵적 `any` 에 타입만 붙인 기계적 수정이다. `eslint`(대상 12개 파일)·`prettier --check` 를 직접 재실행해 warning 0 / 포맷 위반 0 을 확인했다.

## 발견사항

- **[INFO]** `HttpResponseLike` 네이밍·설계가 기존 컨벤션과 일치 — 발견 아님, 확인 목적
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34-37`
  - 상세: `*Like` 접미사로 구조적 서브셋 인터페이스를 선언하는 패턴은 이 저장소에 이미 6개 파일(`button-slug.util.ts`, `thread-renderer.ts`, `web-chat-cors.ts`, `migrate-button-ids.ts`, `detect-pending-user-config.ts`, `agent-memory.service.ts`)에서 쓰이는 기존 컨벤션이다. 또한 `getResponse<T>()` 에 전체 `Response` 대신 최소 shape 타입을 주는 방식도 `logging.interceptor.ts:54` 의 `getResponse<{ statusCode: number }>()` 로 이미 선례가 있다. 이번 `HttpResponseLike` 도입은 새 패턴이 아니라 기존 두 컨벤션을 그대로 따른 것이라 §8 일관성 관점에서 긍정적이다. `status?`/`statusCode?` 를 옵셔널로 두어 `typeof` 방어를 정적으로 죽이지 않는다는 설계 근거도 코드 주석에 명시돼 있어 왜 이런 형태인지 추적 가능하다.
  - 판정: 문제 없음(발견 아님).

- **[INFO]** `Array.isArray` → `any[]` 좁힘 문제의 동일 설명 주석이 2개 파일에 반복
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts:645`, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts:376-377`
  - 상세: 같은 TS 특성("`Array.isArray` 는 `unknown` 을 `any[]` 로 좁힌다")을 설명하는 거의 동일한 주석이 두 파일에 걸쳐 반복된다(`render-tool-provider.ts` 내부에서는 두 번째·세 번째 등장부터 `:458` 처럼 축약해 이미 어느 정도 DRY 되어 있음). 반복은 로직이 아니라 "왜 이 타입 주석이 필요한가"라는 설명이며, 각 사이트는 서로 다른 함수·다른 배열이라 하나의 공용 헬퍼로 병합하면 오히려 지역성(주석과 코드가 바로 옆에 있는 것)을 잃는다. 저장소 전체를 검색한 결과 이 패턴은 딱 2개 파일에만 존재해 셋 이상으로 늘어난 시점의 "규칙화" 압력은 아직 없다.
  - 제안: 강제 수정 대상 아님. 앞으로 이 패턴이 세 번째 파일에 등장하면 `type NarrowedArray<T> = T[]` 류의 공용 유틸이나 린트 규칙 자체의 설정 변경(예: `lib` 업그레이드로 `Array.isArray` predicate 를 `unknown[]` 로 개선)을 고려할 시점.

- **[INFO]** `migrate-node-output-refs.ts` 콜백 타입 시그니처 반복 6곳 — 직전 라운드에서 이미 검토·수용된 사항, 이번 델타에서 재수정 없음(carry-forward 확인)
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.ts:247-252`(Pass 1), `:292-297`(Pass 2), `:312-317`(Pass 3), `:332-337`(Pass 4), `:437-442`(meta 유지 pass), `:487-492`(error 필드 pass)
  - 상세: `grep` 으로 재확인한 결과 `(match: string, dbl: string | undefined, sgl: string | undefined, field: string)` 형태가 여전히 6곳에 그대로 남아 있다(이번 델타가 이 파일을 다시 건드리지 않았으므로 변화 없음). 이 파일은 직전 리뷰 라운드(`11_06_12`)에서 동일 관측으로 NONE 판정을 받았고 근거(로직 중복이 아니라 타입 중복, 1회성 저빈도 스크립트, 지역성 트레이드오프)가 여전히 유효하다.
  - 판정: 재확인만, 조치 불요.

- **[INFO]** `package.json` `--max-warnings 0` 게이트 추가 — 위험 없음, 확인 목적
  - 위치: `codebase/backend/package.json:20`
  - 상세: CI(`backend-checks.yml`)가 동일한 `pnpm --filter backend lint` 를 호출하므로 로컬·CI 가 같은 게이트를 공유한다(plan 문서에 근거 명시). `lint:fix` 스크립트는 `--max-warnings` 없이 그대로 둬 자동수정 워크플로를 방해하지 않는다 — 게이트 스크립트(`lint`)와 수정 스크립트(`lint:fix`)의 책임을 분리한 기존 패턴과 일치.
  - 판정: 문제 없음.

## 요약

이번 델타(21건 전량 처분 + `--max-warnings 0` 게이트)는 7개 파일 모두 로직을 바꾸지 않고 라이브러리 경계에서 새던 암묵적 `any` 에 구조적 타입·좁히기 캐스트·타입 주석만 추가한 기계적 수정이며, 함수 길이·중첩 깊이·순환 복잡도에 변화가 없고 매직 넘버도 도입하지 않았다. 신규 도입 인터페이스(`HttpResponseLike`)는 저장소의 기존 `*Like` 구조적 타입 컨벤션 및 `getResponse<T>()` 최소 shape 관행을 그대로 따라 §8 일관성에 부합한다. 발견된 것은 전부 INFO 수준으로, "동일 TS 특성 설명 주석이 2개 파일에 반복"이라는 경미한 문서 중복과, 이전 라운드에서 이미 검토된 `migrate-node-output-refs.ts` 콜백 타입 반복의 재확인뿐이며 둘 다 강제 수정 사유가 아니다. `eslint`/`prettier --check` 를 직접 재실행해 대상 12개 파일 모두 warning 0·포맷 위반 0 임을 확인했다. CRITICAL/WARNING 대상 없음.

## 위험도

NONE
