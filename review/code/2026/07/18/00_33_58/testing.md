# 테스트(Testing) 리뷰 — frontend layering guard 문구 회귀 테스트 + 근접/lib-types 스코프 케이스

## 검증 방법

정적 리뷰에 더해 실측·mutation 재현으로 교차검증했다.

- `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts --reporter=verbose` → **51/51 통과** (payload/RESOLUTION.md 의 주장과 일치).
- `eslint.config.mjs` 의 `message: STATIC_IMPORT_MSG` (line 71, `no-restricted-imports` 블록)를 `message: DYNAMIC_IMPORT_MSG` 로 mutation 한 뒤 신규 문구 회귀 테스트("위반 메시지가 실제 계층 라벨과 규약 링크를 담는다")만 재실행 → **여전히 통과**. 즉 static 진입점의 message 상수가 다른 두 상수 중 하나로 뒤바뀌어도 이 테스트는 잡지 못한다 (아래 WARNING 참고). mutation 은 재현 확인 직후 원본으로 복구·`git status` 로 clean 확인함.
- `codebase/frontend/src/lib/types/` (`trigger.ts`), `codebase/frontend/src/types/` (`transform.ts`) 실존 확인 — 신규 `src/lib/types/probe.ts` 케이스가 가상의 경로가 아니라 실제 존재하는 디렉터리 구조를 반영한 시나리오임을 확인.

## 발견사항

- **[WARNING]** 신규 "문구 회귀 고정" 테스트에서 static 진입점의 `distinctPhrase` 가 실제로는 세 메시지 상수 모두에 공통인 접미사라, static↔dynamic/require 메시지 상수 뒤바뀜을 잡지 못한다
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:119-135` (`위반 메시지가 실제 계층 라벨과 규약 링크를 담는다` 케이스), 근거 상수: `codebase/frontend/eslint.config.mjs:29-31` (`STATIC_IMPORT_MSG`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`)
  - 상세: 세 메시지 상수는 모두 `"...${LAYERS_LABEL} 은 [[중간구]] @/components/** 를 import 할 수 없습니다. ${RESOLUTION_HINT}"` 형태를 공유하고, static 케이스에 지정된 distinctPhrase 는 `"@/components/** 를 import 할 수 없습니다"` 이다. 이 문자열은 `DYNAMIC_IMPORT_MSG`("...동적 import() 로도 @/components/** 를 import 할 수 없습니다...")와 `REQUIRE_MSG`("...require() 로도 @/components/** 를 import 할 수 없습니다...")에도 **똑같이 포함**돼 있어, static 케이스만 놓고 보면 "구별되는 문구"가 아니다. 반면 dynamic 케이스의 `"동적 import() 로도"`, require 케이스의 `"require() 로도"` 는 각각 자기 상수에만 있어 실제로 구별력이 있다.
    실측: `eslint.config.mjs` line 71 의 `message: STATIC_IMPORT_MSG` 를 `message: DYNAMIC_IMPORT_MSG` 로 바꿔(즉 `no-restricted-imports` 규칙이 실수로 dynamic 문구를 쓰도록 뒤바뀐 상황을 재현) 이 테스트 케이스만 재실행한 결과 **그대로 통과**했다. RESOLUTION.md 가 "재현 검증(mutation 3종 전부 1건 실패): ①LAYERS_LABEL join 변조, ②require↔dynamic 메시지 뒤바꿈, ③spec 링크 제거" 라고 커버리지를 주장하지만, static 이 관여하는 뒤바뀜(static↔dynamic, static↔require)은 애초에 검증 대상에 없었고 실제로 통과하지 못한다 — 즉 이번에 새로 추가된 "문구 회귀 고정" 테스트가 실제로 고정하는 것은 dynamic/require 두 진입점뿐이고, 정작 예시로 든 `no-restricted-imports` 규칙(가장 흔히 트리거되는 정적 import 경로)의 메시지 상수 오배선은 여전히 무방비다.
  - 제안: static 케이스의 distinctPhrase 를 세 상수 중 static 에만 존재하는 부분 문자열로 교체한다. 가장 간단한 방법은 각 케이스에서 "포함되면 안 되는" 부정 단언을 추가하는 것 — 예: static 케이스에서 `expect(first?.message).not.toContain("동적 import() 로도")` 와 `expect(first?.message).not.toContain("require() 로도")` 를 함께 검증하면 세 상수 모두 서로 배타적으로 식별된다. 혹은 각 메시지 상수 자체에 `"정적 import 로도"`처럼 static 전용 마커 문구를 추가해 세 상수가 대칭적으로 구별 가능하게 만드는 방법도 있다(다만 이는 `eslint.config.mjs` 프로덕션 텍스트 변경이 필요).

- **[INFO]** 리뷰 payload 중 `review/code/2026/07/17/23_49_51/*`, `review/consistency/2026/07/18/00_22_41/*` 는 이전 리뷰 라운드의 산출물(md/json 리포트)이 저장소에 커밋된 것으로, 실행 가능한 코드가 아니라 테스트 관점 검토 대상이 아니다. 이번 테스트 리뷰는 실질적인 유일한 코드 변경인 `eslint-layering-guard.test.ts` 에 집중했다.
  - 위치: 해당 없음 (문서/프로세스 아티팩트)
  - 제안: 없음 — 참고용 기재.

- **[INFO]** `src/types-legacy/`·`src/libs/` 근접 오탐 케이스와 `src/lib/types/` vs `src/types/` 혼동 케이스 추가는 실제 코드 회귀(anchor 없는 glob 완화) 관점에서 유효하고 실제 디렉터리 구조(`src/lib/types/trigger.ts`, `src/types/transform.ts`)를 정확히 반영한다. `not.toHaveLength(0)` 만 검증해 "어느 glob 근거로 차단되는가"까지는 프로그램적으로 구분하지 않지만(테스트 코멘트는 "근거 glob 이 다르다"고 서술), ESLint 공개 API 가 매칭된 glob 을 직접 노출하지 않는 한 이 수준의 검증으로 충분하며 과잉설계로 보이지 않는다.
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:267-283`
  - 제안: 없음 — 현 상태로 충분.

- **[INFO]** `GUARD_BLOCK_KEY = CONFIG_LOWER_LAYERS[0]` 로 블록 탐색 키를 config 파생으로 바꾼 것은 config 의 `LOWER_LAYERS` 배열 순서가 바뀌어도(`"src/types/**"` 가 먼저 오도록 재배열) 동일 블록의 `files` 배열에 두 리터럴이 모두 들어있는 한 정상 동작하므로 테스트 견고성이 실제로 개선됐다. 회귀 위험 없음.
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:26,37`
  - 제안: 없음.

## 회귀 테스트 유효성

기존 47개 케이스(bare/alias/상대경로/백틱/타입-온리/re-export × 위반·비위반, severity, 규칙 존재 확인)는 이번 diff 로 로직이 바뀌지 않았고 실측으로도 전부 통과해 유효성이 유지된다. `layeringErrors()`/`errorsAt()` 의 rule-id 필터 predicate 도 그대로다. 신규 4개 케이스(문구 회귀 1 + 근접 오탐 2 + lib/types 혼동 1) 는 각각 독립적으로 실행 가능하며 `beforeAll` 로 생성하는 `ESLint` 인스턴스 외 공유 가변 상태는 없어 테스트 격리도 양호하다.

## 요약

이전 리뷰(WARNING #1: 메시지 텍스트 미검증)에 대한 이번 fix 는 방향은 정확하고 dynamic/require 두 진입점에 대해서는 실측 mutation 으로 검증된 진짜 회귀 고정을 제공하지만, static(`no-restricted-imports`) 진입점에 지정된 distinctPhrase 가 세 메시지 상수의 공통 접미사라서 정작 가장 흔한 정적 import 경로의 메시지 상수 오배선(예: `STATIC_IMPORT_MSG` ↔ `DYNAMIC_IMPORT_MSG` 뒤바뀜)은 여전히 무방비임을 mutation 으로 직접 확인했다. RESOLUTION.md 가 명시한 "재현 검증 3종 전부 실패" 주장은 이 시나리오를 포함하지 않아 커버리지 표현이 실제보다 넓게 서술돼 있다. 근접 오탐(`types-legacy`/`libs`)·`src/lib/types` 혼동 케이스 추가(이전 INFO #11·#12)는 실제 디렉터리 구조를 반영한 유효한 회귀 테스트이며, config 파생 `GUARD_BLOCK_KEY` 로의 전환도 테스트 견고성을 개선했다. 기존 47개 케이스의 회귀 유효성·테스트 격리에는 문제가 없다.

## 위험도

LOW
