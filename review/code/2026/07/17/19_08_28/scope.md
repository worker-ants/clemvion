# 변경 범위(Scope) 리뷰

## 대상 및 방법

- 리뷰 대상: `git diff origin/main..HEAD` (커밋 4개: `a1e2ec8af`, `e6e0fdc0d`, `161699c7a`, `3159b921b`).
- `git diff --name-status origin/main..HEAD` 로 전체 변경 파일 목록(27개) 확보, 각 파일을 의도된 범위 3항목(①WARNING#1~#3 후속, ②ai-review 발견 결함 fix, ③review/code/** 산출물)에 1:1 매핑.
- 각 커밋을 `git diff <parent>..<commit>` 으로 개별 분해해 어느 항목에 속하는 변경인지 실측 대조.
- `git status --porcelain=v1 -uall` 로 커밋되지 않은 잔여 변경 확인 — 현재 리뷰 세션(`19_08_28/`) 자신의 untracked 부기 파일 4건뿐, 리뷰 대상 diff 와 무관.

## 파일 단위 대조

전체 변경 파일은 정확히 두 그룹으로 나뉜다.

1. **소스 코드 (2개)** — `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`
2. **리뷰 산출물 (25개)** — `review/code/2026/07/17/18_06_36/**` (13개), `review/code/2026/07/17/18_43_17/**` (12개)

다른 디렉터리(`spec/`, `plan/`, `codebase/backend`, `codebase/channel-web-chat`, `package.json` 등)에 대한 변경은 전무함을 `git diff --name-only origin/main..HEAD | grep -v '^review/'` 로 확인 — 소스 변경은 위 2개 파일로 완전히 한정된다.

### 그룹 1: 소스 코드 — 항목 ①·② 대응

커밋을 분해해 대조한 결과:

- **`a1e2ec8af`** (origin/main 대비): `COMPONENTS_PATH_RE` 상수화(정규식 중복 제거, WARNING#3), `layeringBlock.find` → `layeringBlocks.filter`+`Object.assign` 병합 재현(WARNING#1), bare 경로 `it.each` 4종 추가(WARNING#2), 그리고 severity(`"error"`) assertion 신설(18_06_36 리뷰 SUMMARY#1) 이 한 커밋에 함께 들어 있다. diff 내용은 전부 의도된 범위(①+②) 내이나, 커밋 메시지는 severity 건만 언급하고 WARNING#1~#3 번들 사실을 명시하지 않아 커밋 단위 감사(bisect) 정밀도가 약간 떨어진다 (§발견사항 참고).
- **`161699c7a`** (`a1e2ec8af` 대비): 백틱 리터럴 우회 차단(`literalSpecifier`/`backtickSpecifier`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`/`REQUIRE_CALL` 상수화 + selector 4종 분리), 테스트 harness 파서 배선(`tsParser` config 추출), fatal 파싱 에러 fail-loud 전환, `ruleSeverity` 숫자 정규화, 백틱/import type/re-export fixture 추가 — 전부 18_06_36·18_43_17 리뷰가 실측 발견한 결함(항목 ②)에 정확히 대응. RESOLUTION.md(`18_43_17`)가 "pre-existing 이슈지만 사용자 승인 하에 이번 PR 포함" 이라고 명시한 것과 실제 diff 내용이 일치.

두 커밋 모두 `codebase/frontend` 바깥으로 번지지 않으며, `package.json`/lockfile/다른 config 파일은 미변경 — testing 리뷰가 지적한 "`--max-warnings` 무제한" CLI 갭은 이번 diff 에서 CLI 스크립트 수정으로 처리하지 않고 유닛 테스트 assertion 으로만 방어하는 스코프 결정을 그대로 유지했다(RESOLUTION.md 에 명시된 채택 방식과 일치, 임의로 스코프를 넓혀 package.json 을 건드리지 않음).

### 그룹 2: 리뷰 산출물 — 항목 ③ 대응

`review/code/2026/07/17/18_06_36/**`, `review/code/2026/07/17/18_43_17/**` 는 각각 CLAUDE.md 가 규정한 코드 리뷰 산출물 저장 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`) 규약을 그대로 따른다. 두 세션 모두 SUMMARY/RESOLUTION/개별 reviewer 리포트/라우팅·재시도 상태 파일로 구성된 표준 산출물 세트이며, 그 내용(SUMMARY 의 WARNING·INFO, RESOLUTION 의 조치 매핑)이 그룹 1의 실제 소스 diff 와 1:1 대응함을 확인했다. 소스 코드나 spec 문서를 건드리지 않는 순수 문서/로그 파일이라 스코프 이탈 여지가 없다.

## 스코프 외 변경 여부 (점검 관점별)

- **의도 이상의 변경**: 없음. 소스 변경은 ①(WARNING#1~#3)·②(severity 미탐지, 백틱 구멍, 파서 미배선) 로 완전히 설명되며, 두 항목 모두 사전에 명시적으로 승인된 범위다.
- **불필요한 리팩토링**: `literalSpecifier`/`backtickSpecifier`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`/`REQUIRE_CALL` 헬퍼 추출은 selector 가 2개→4개로 늘어나며 발생하는 반복(메시지 문자열 2종 × 2배)을 제거하기 위한 것으로, 백틱 차단이라는 실질 변경에 직접 종속된 범위 내 리팩터다. 별도의 목적 없는 코드 정리는 발견되지 않았다.
- **기능 확장(over-engineering)**: 없음. 계산 경로(`import(\`...${x}\`)`)나 근접 오탐 방지 이상으로 매칭 범위를 넓히지 않았고, 새 ESLint 규칙·새 selector 카테고리 등 요청 밖 기능 추가 없음.
- **무관한 파일·영역 수정**: 없음. `codebase/backend`, `codebase/channel-web-chat`, `spec/`, `plan/`, `package.json`류 어떤 파일도 변경되지 않음.
- **포맷팅 변경 혼입**: 없음. selector 문자열이 한 줄 리터럴 → 템플릿 리터럴/헬퍼 호출로 바뀐 개행 차이는 로직 변경에 종속된 것이며 독립적인 reflow 는 없음.
- **주석 변경**: 신규·수정 주석 모두 해당 diff 라인의 동작 근거(TemplateLiteral 에 `.value` 가 없는 이유, `expressions.length=0` 조건 근거, 커버리지 한계 갱신, phantom dependency 회피 이유)를 설명하는 목적에 부합. 목적 없는 주석 첨삭 없음.
- **임포트 변경**: 없음. 두 파일 모두 신규 import 문 추가가 전혀 없다 — 오히려 `@typescript-eslint/parser` 를 직접 import 하지 않고 config 배열에서 파서 인스턴스를 추출하는 방식을 택해 `node-linker=isolated` 하의 phantom dependency 위험을 의도적으로 회피했다(RESOLUTION.md 에 근거 명시, 실측: frontend package.json 미선언·node_modules 부재 확인).
- **설정 변경**: `eslint.config.mjs` 의 규칙 활성화 여부·`files` glob·플러그인 구성 등 다른 설정 의미는 불변. 오직 `no-restricted-syntax` selector 2종 → 4종 확장(백틱 커버리지 추가)만 발생했으며 이는 항목 ②로 승인된 범위.

## 발견사항

- **[INFO]** 첫 커밋(`a1e2ec8af`)이 커밋 메시지에 언급되지 않은 변경(WARNING#1·#2·#3 후속, 항목 ①)을 severity 미탐지 fix(항목 ②)와 함께 번들링
  - 위치: 커밋 `a1e2ec8af08ed543b403214bcf5aba89b6494f80`
  - 상세: `git diff origin/main..a1e2ec8af` 실측 결과 이 커밋 하나에 `COMPONENTS_PATH_RE` 상수화·`layeringBlocks` 병합 재현·bare 4종 추가(모두 항목 ①, 선행 리뷰 WARNING#1~#3)와 severity assertion 신설(항목 ②, 18_06_36 리뷰 SUMMARY#1)이 함께 포함되어 있다. 커밋 메시지는 "SUMMARY#1 severity 강등... 보강"만 서술해 실제로는 4개의 논리적으로 구분되는 수정이 한 커밋에 섞여 있음을 드러내지 않는다. diff 내용 자체는 두 항목 모두 사용자가 승인한 정당한 범위 내이므로 **스코프 위반은 아니며**, 커밋 단위 추적성(bisect 시 "이 커밋이 무엇을 고쳤는가")이 약간 흐려지는 수준의 경미한 감사 편의성 이슈다.
  - 제안: 조치 불요(diff 내용 자체가 스코프 밖이 아니므로). 향후 유사 상황에서 커밋을 분리하면 감사 추적이 더 명확해짐 — 참고 수준.

## 요약

`git diff origin/main..HEAD` 는 소스 코드 변경 2개 파일(`codebase/frontend/eslint.config.mjs`, `eslint-layering-guard.test.ts`)과 그에 대응하는 리뷰 산출물 25개 파일로 완전히 구성되며, 각 커밋을 개별 분해해 대조한 결과 모든 diff 내용이 사전에 명시된 의도된 범위(①선행 리뷰 WARNING#1~#3 후속, ②그 과정 ai-review 가 발견한 severity 미탐지·백틱 우회·파서 미배선 fix, ③review/code/** 산출물 저장)로 완전히 설명된다. `codebase/backend`·`spec/`·`package.json` 등 무관한 영역에 대한 수정은 전혀 없고, selector 헬퍼 추출은 백틱 지원으로 인한 반복 제거에 직접 종속된 필요 최소 리팩터이며, 목적 없는 주석·포맷팅·임포트 변경도 발견되지 않았다. 유일한 지적 사항은 첫 커밋이 논리적으로 구분되는 두 승인 항목(①·②)을 커밋 메시지에 명시하지 않은 채 번들링한 경미한 감사 추적성 이슈(INFO)뿐이며, 이는 diff 내용 자체의 스코프 위반이 아니다.

## 위험도

NONE
