# 아키텍처 리뷰 — 레이어 가드 테스트 문구 회귀 고정 + 이전 리뷰 산출물 커밋

## 리뷰 범위 확인

이번 payload 는 실제 코드 변경으로는 `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`
단 1개 파일만 포함하며(직전 리뷰 `review/code/2026/07/17/23_49_51` 의 WARNING #1·#2 fix), 나머지
20개 항목은 `review/code/2026/07/17/23_49_51/*` (직전 코드 리뷰 산출물) 와
`review/consistency/2026/07/18/00_22_41/*` (일관성 검토 산출물) 을 저장소에 기록으로 남기는
신규 문서/JSON 파일이다. 이들은 프로젝트 규약(`review/` 산출물 경로 규칙)에 따른 정상적인
기록물이며 실행 코드가 아니므로 SOLID·결합도·레이어 책임 등 아키텍처 관점의 분석 대상이 아니다.
따라서 본 리뷰는 테스트 파일 diff 에 집중한다.

## 발견사항

- **[INFO]** `GUARD_BLOCK_KEY` 도출 방식이 "레이어 가드 블록은 항상 단일 블록"이라는 암묵 가정에 의존
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:26,36-38`
  - 상세: `const GUARD_BLOCK_KEY = CONFIG_LOWER_LAYERS[0];` 로 뽑은 뒤
    `blocks.filter((c) => c.files.includes(GUARD_BLOCK_KEY))` 로 "레이어 가드 블록을 전부 추출"한다.
    현재 `eslint.config.mjs` 는 `files: LOWER_LAYERS` (두 계층을 한 배열에 담은 단일 블록) 구조라
    `CONFIG_LOWER_LAYERS[0]` 이 있는 블록이 곧 유일한 가드 블록이라 정확히 동작한다. 다만 직전
    아키텍처 리뷰(INFO #1)가 이미 "계층별 라벨이 갈리기 시작하면 블록을 분리하라"는 옵션을 제시했는데,
    실제로 그 리팩터(계층별 별도 블록, 예: `files: ["src/lib/**"]` 블록과 `files: ["src/types/**"]`
    블록으로 분리)가 일어나면 이 필터는 `CONFIG_LOWER_LAYERS[0]`(= `"src/lib/**"`) 을 포함하는 블록
    하나만 매칭하고 `"src/types/**"` 전용 블록은 조용히 누락한다. `mergedRules` 가 여전히
    비어있지 않으므로(67행의 fail-open 에러도 던져지지 않음) 이 누락은 **에러 없이 조용히**
    "types 계층 전용 규칙 변경"에 대한 검증력만 잃는 형태로 발생한다 — 이는 이 diff 가 새로
    만든 문제가 아니라 기존에 하드코딩 리터럴(`"src/lib/**"`)을 쓸 때부터 있던 동일한 잠재
    가정이며, 이번 변경은 그 리터럴을 config 파생값으로 바꿔 "두 계층 모두를 한 배열로 관리하는
    한" 오히려 drift 위험을 낮췄다(리터럴이 config 와 별개로 존재하지 않게 됨).
  - 제안: 즉시 조치 불필요. 다만 향후 정말로 블록을 계층별로 분리한다면, 이 파일의 블록 탐색
    로직도 "`LOWER_LAYERS` 각 항목이 매핑되는 모든 블록을 순회"하도록 함께 바꿔야 한다는 점을
    리팩터 체크리스트에 남겨두면 좋다(현재 주석은 "전부 추출한다"고 단언하지만, 그 보장은 현재의
    단일 블록 구조에 의존하고 있다는 점이 주석에 명시돼 있지 않다).

- **[INFO]** 신규 문구 회귀 테스트가 세 진입점의 공통 계약(라벨·spec 링크)과 진입점별 차이(문구)를
  한 테스트로 함께 검증 — 응집도 양호
  - 위치: `eslint-layering-guard.test.ts:119-135`
  - 상세: `LAYERS_LABEL`/`RESOLUTION_HINT`(공통) 와 `STATIC_IMPORT_MSG`/`DYNAMIC_IMPORT_MSG`/
    `REQUIRE_MSG`(진입점별) 라는 프로덕션 쪽의 관심사 분리를, 테스트 쪽에서도 "공통 부분 2개
    assertion + 케이스별 고유 문구 1개 assertion" 구조로 그대로 반영해 대응한다. 프로덕션 코드의
    책임 분리를 테스트 구조가 미러링하는 형태로, 별도 우려 없음.

## 확인된 양호 사항

- 테스트 파일이 여전히 프로덕션 `eslint.config.mjs` 를 유일한 진실로 삼아 파생값(`CONFIG_LOWER_LAYERS`,
  이제는 `GUARD_BLOCK_KEY`·에러 메시지까지)을 가져오는 기존 SoT 결합 패턴을 일관되게 유지한다 —
  이번 diff 로 결합의 성격이 바뀌지 않았고(이미 직전 리뷰에서 의도된 트레이드오프로 평가됨),
  하드코딩 리터럴 1곳(`"src/lib/**"` 블록 탐색 키, fail-open 에러 문구)을 config 파생으로 추가
  전환해 오히려 리터럴-config 간 drift 지점을 하나 줄였다.
- 근접 오탐(`src/types-legacy`, `src/libs`) 및 `src/lib/types/` vs `src/types/` 구분 케이스는
  레이어 가드라는 아키텍처 강제 메커니즘 자체의 정확도(모듈 경계 판정)를 검증하는 테스트로,
  기존 콘텐츠 스위트의 근접 오탐 케이스(`components-legacy` 등)와 대칭적인 엄격성을 갖춰
  구조적으로 일관된다.
- 순환 의존, 레이어 책임 침범, 과도한 추상화 등은 발견되지 않았다. `review/**` 신규 파일은
  코드가 아닌 기록물로, 모듈 경계나 레이어 구조에 영향을 주지 않는다.

## 요약

이번 diff 의 실질 코드 변경은 직전 리뷰의 testing/documentation WARNING 2건(메시지 내용
미검증, fail-open 에러 문구의 config drift)을 정확히 겨냥한 보강일 뿐, 새로운 모듈·컴포넌트·
의존 관계를 도입하지 않는다. 하드코딩 리터럴을 config 파생 상수(`GUARD_BLOCK_KEY`)로 대체해
DRY·SoT 원칙을 한 단계 더 강화했고, 프로덕션 메시지 생성 로직의 관심사 분리(공통 라벨/힌트 vs
진입점별 문구)를 테스트 구조가 그대로 반영해 테스트-프로덕션 간 구조적 정합성도 유지된다. 유일한
잠재 관찰 사항은 블록 탐색 predicate 가 "레이어 가드는 단일 블록"이라는 암묵 가정에 의존한다는
점이나, 이는 이번 diff 이전부터 존재하던 특성이고 현재 구조에서는 정확히 동작하며 차단 사유가
아니다. 구조적 결함·순환 의존·레이어 위반은 발견되지 않았다.

## 위험도
NONE
