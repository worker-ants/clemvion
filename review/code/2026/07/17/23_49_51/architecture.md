# 아키텍처 리뷰 — frontend layering guard 스코프 확장 (src/types 포함)

## 발견사항

- **[INFO]** 에러 메시지가 위반 계층을 특정하지 않고 두 계층을 항상 함께 나열
  - 위치: `codebase/frontend/eslint.config.mjs:45-51` (`LAYERS_LABEL`, `STATIC_IMPORT_MSG`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`)
  - 상세: `LAYERS_LABEL = LOWER_LAYERS.join(" · ")` 로 메시지를 생성해, `src/types/**` 에서 위반이 나도 메시지는 항상 "`src/lib/** · src/types/**` 은 ... import 할 수 없습니다" 로 두 계층을 함께 나열한다. 사실관계는 틀리지 않지만(둘 다 실제로 금지 대상이므로), 개발자가 에러를 볼 때 자신이 어느 계층에 있는지와 무관하게 동일한 문구를 보게 되어 진단 신호가 다소 뭉개진다. `files: LOWER_LAYERS` 블록을 계층별로 나눠 각자의 라벨을 갖게 할 수도 있었으나, 현재는 두 계층의 제약이 완전히 동일(대상: `@/components/**`)하므로 단일 블록으로 묶은 것은 합리적 트레이드오프다.
  - 제안: 현 상태 유지 가능. 계층별 세부 사유가 갈리기 시작하면(예: `types` 전용 예외) 그때 블록을 분리.

- **[INFO]** 프로덕션 ESLint config 모듈이 테스트 전용 named export(`LOWER_LAYERS`)를 가짐
  - 위치: `codebase/frontend/eslint.config.mjs:43` / `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:5`
  - 상세: `eslint.config.mjs` 는 원래 ESLint CLI 가 로드하는 default export 만 필요한데, 테스트가 config 와 동일한 소스를 참조하도록 하기 위해 `LOWER_LAYERS` 를 named export 로 노출시켰다. 이는 빌드 설정 파일과 테스트 스위트 사이에 명시적 결합을 만든다 — config 파일 형식(mjs)이 바뀌거나 default-export-only 로 강제되는 도구 체인으로 전환되면 테스트가 깨진다. 다만 이 결합은 "회귀 시 config 와 테스트 기대값이 조용히 벌어지는 것"을 막기 위한 의도된 단일 진실(SoT) 패턴이며, 이미 PR #969 에서 확립된 기존 관례(`import eslintConfig from ...`)의 자연스러운 확장이다.
  - 제안: 현재 규모(계층 2개)에서는 적정한 트레이드오프. 계층이 늘어나 관리 비용이 커지면 `LOWER_LAYERS` 를 별도 `layering.constants.mjs` 같은 공유 모듈로 뽑아 config·test 양쪽이 그 모듈을 import 하는 편이 결합을 한 단계 낮출 수 있다.

- **[INFO]** 경계 강제 방식이 규칙 2종(`no-restricted-imports` + `no-restricted-syntax`) 수동 조합이라 경계 쌍이 늘면 선형 증식
  - 위치: `codebase/frontend/eslint.config.mjs:146-187`, `spec/conventions/frontend-layering.md` Rationale "왜 규칙 2종 조합인가"
  - 상세: 현재 경계 쌍은 `{lib, types} → components` 하나뿐이라 이 조합이 적절하지만, 아키텍처 관점에서 이 방식은 경계 쌍이 늘어날 때 `no-restricted-imports`/`no-restricted-syntax` 두 규칙 모두에 대상이 선형으로 늘어나는 확장성 한계를 갖는다.
  - 제안: 이미 spec Rationale 에 "경계 쌍이 2개 이상으로 늘면 `eslint-plugin-import` 의 `no-restricted-paths` 같은 zone 기반 도구로 재평가" 라고 명시돼 있어, 저자가 이 확장성 트레이드오프를 인지하고 YAGNI 원칙에 따라 의도적으로 유예한 것으로 판단된다. 별도 조치 불필요, 결정 유효.

## 요약

이번 변경은 기존 레이어 가드(`src/lib/** → @/components/**` 금지)를 `src/types/**` 까지 확장하면서, 스코프·메시지 문자열을 `LOWER_LAYERS` 배열 하나로 단일화(DRY)해 Open-Closed 원칙을 잘 적용했다(계층 추가 시 배열 항목만 늘리면 됨). 이전 리뷰(WARNING #4·#5)에서 지적된 "규약의 근거가 spec 이 아니라 코드 주석에만 있다"는 문제와 "가드가 실제로 어느 경로에 걸리는지 증명하지 못한다"는 문제를 spec 신설(`frontend-layering.md`)과 실제 `ESLint` API 기반 신규 스코프 검증 스위트로 정면 해결했으며, 합성 config 스위트(규칙 *내용* 검증)와 실제 ESLint resolve 스위트(규칙 *스코프* 검증)를 관심사별로 분리해 병존시킨 점은 테스트 설계 관점에서도 견고하다. 레이어 순서(`types < lib < components < app`)는 새 제약의 발명이 아니라 실측된 의존 그래프(248:0 비대칭)를 CI fitness function 으로 고정한 것이며, `app` 경계 미가드·`types → lib` 미가드 등 커버리지 공백도 "관측된 역전 압력에 비례한 가드"라는 일관된 원칙 아래 명시적으로 문서화돼 있어 규약과 집행 범위의 괴리가 숨겨져 있지 않다. 순환 의존·레이어 위반·과도한 추상화 등 구조적 결함은 발견되지 않았다.

## 위험도
LOW
