# 요구사항(Requirement) 리뷰 — frontend layering guard, src/types 확장 + 메시지 회귀 고정 (WARNING#1/#2 fix)

## 발견사항

- **[WARNING]** 신규 메시지 회귀 테스트가 "정적(static) 진입점"에 대해서는 `STATIC_IMPORT_MSG` ↔ `DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG` 뒤바뀜을 실제로 탐지하지 못한다 — 커밋 메시지·코드 주석이 명시한 "세 진입점 각각의 `.message` 를 직접 고정한다" 는 의도가 정적 케이스에서는 달성되지 않음
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:119-135` (`"위반 메시지가 실제 계층 라벨과 규약 링크를 담는다"`), 원인 소스: `codebase/frontend/eslint.config.mjs:29-31` (`STATIC_IMPORT_MSG`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`)
  - 상세: 정적 import 케이스의 `distinctPhrase` 로 `"@/components/** 를 import 할 수 없습니다"` 를 사용하는데, 이 문자열은 `STATIC_IMPORT_MSG` 뿐 아니라 `DYNAMIC_IMPORT_MSG`(`"...동적 import() 로도 @/components/** 를 import 할 수 없습니다..."`) 와 `REQUIRE_MSG`(`"...require() 로도 @/components/** 를 import 할 수 없습니다..."`) 에도 공통 부분 문자열로 포함돼 있어 세 메시지를 구분하지 못한다. 반면 동적 케이스의 `distinctPhrase`(`"동적 import() 로도"`)와 require 케이스의 `distinctPhrase`(`"require() 로도"`) 는 각 메시지에 고유해 실제로 구분력이 있다.
    실측 재현: `eslint.config.mjs` 의 `no-restricted-imports` 규칙 `message: STATIC_IMPORT_MSG` 를 `message: DYNAMIC_IMPORT_MSG` 로 바꿔(정적 위반이 "동적 import() 로도" 문구를 내보내는 오류 상황을 재현) `npx vitest run src/lib/__tests__/eslint-layering-guard.test.ts` 실행 → **51/51 전부 통과**(회귀 미탐지). 참고로 `RESOLUTION.md`/`SUMMARY.md`(review/code/2026/07/17/23_49_51)가 명시한 "재현 검증 3종"은 ① `LAYERS_LABEL` join 변조 ② **require↔dynamic** 메시지 뒤바꿈 ③ spec 링크 제거 뿐이며, static↔dynamic·static↔require 뒤바뀜은 검증 대상에 없었다 — 즉 이번 발견은 그 커버리지 밖의 새 gap 이지 이미 처분된 사안의 재발이 아니다.
  - 제안: 정적 케이스의 `distinctPhrase` 를 진짜 고유 문구로 교체한다(예: 세 메시지가 공유하는 접미부가 아니라 `STATIC_IMPORT_MSG` 에만 있는 텍스트를 사용하거나, "동적/require 문구가 **없어야** 한다"는 부정 단언(`not.toContain("동적 import() 로도")`, `not.toContain("require() 로도")`)을 추가). 또는 세 상수에 각기 고유한 태그를 명시적으로 심어(`"[static]"` 등) distinctPhrase 를 신뢰성 있게 만든다.

- **[INFO]** spec §4.1 "이 테스트가 고정하는 것" 목록이 이번에 새로 추가된 두 가지 보장 항목(메시지 콘텐츠 검증, `types-legacy`/`libs`/`lib/types` 근접 오탐 케이스)을 명시적으로 나열하지 않음
  - 위치: `spec/conventions/frontend-layering.md` §4.1 vs `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:119-135`, `:270-283`
  - 상세: §4.1 은 "규칙 발동/오탐 방지/flat config 병합/severity/파서 정합/스코프" 6개 카테고리로 테스트 보장 범위를 서술하는데, 새로 추가된 "메시지 문구(라벨·spec 링크) 고정" 테스트와 "근접 디렉터리 이름"·"`src/lib/types/` vs `src/types/`" 케이스는 기존 "스코프" 카테고리에 부분적으로만 포섭될 뿐 별도 항목으로 없다. 코드가 spec 보다 앞서 나간 것이며 spec 이 틀린 것은 아니다(카테고리 서술이 개괄적이라 모순은 아님) — SPEC-DRIFT 로 단정하기엔 spec 저자가 "포괄 서술" 의도였을 가능성도 있어 판단이 모호함.
  - 제안: 코드 유지. `project-planner` 가 여유 있을 때 §4.1 에 "**메시지 콘텐츠**: 계층 라벨·spec 링크·형태별 문구가 메시지에 포함된다" 항목을 추가하면 §4.1 목록이 실제 테스트 스위트와 완전히 대응된다.

## 요약

`GUARD_BLOCK_KEY`(config `LOWER_LAYERS[0]` 파생)·fail-open 에러 메시지의 `JSON.stringify(CONFIG_LOWER_LAYERS)` 파생 전환은 정확히 구현됐고, 근접 오탐(`types-legacy`/`libs`) 및 `src/lib/types/` vs `src/types/` 구분 회귀 케이스도 spec §1 이 명시한 규칙과 정확히 일치하며 실제 vitest 실행(51/51 통과)·`npx eslint` 통과로 확인했다. 다만 이번 diff 의 핵심 목적이었던 "메시지 변수 뒤바뀜 탐지"는 정적(static) 진입점에 대해서는 실제로 작동하지 않는다 — `distinctPhrase` 로 고른 문구가 세 메시지 상수 모두의 공통 부분 문자열이라 실측 mutation(`STATIC_IMPORT_MSG`→`DYNAMIC_IMPORT_MSG` 치환)을 51개 테스트 전부가 놓친다. 이는 RESOLUTION.md/SUMMARY.md 가 "FIXED"로 종결한 WARNING#1 의 의도(세 진입점 모두의 문구 뒤바뀜 탐지)를 부분적으로만 충족한 것이며, 문서가 명시한 재현 검증 3종에도 이 조합(static↔dynamic/require)은 포함돼 있지 않아 처분 당시에도 검증되지 않은 gap 이다. 기능적으로 실제 레이어 가드(빌드타임 lint 차단) 자체는 영향받지 않으며 —정적 import 는 여전히 error 로 정확히 차단된다— 회귀 테스트의 검증력 공백일 뿐이다. spec(`frontend-layering.md`) 본문과 코드 구현은 §1~§4.1 전반에서 line-level 로 일치하며, §4.1 목록이 이번에 추가된 두 신규 보장 항목을 아직 나열하지 않은 것은 모순이 아닌 개괄 서술 gap(INFO)이다.

## 위험도
MEDIUM
