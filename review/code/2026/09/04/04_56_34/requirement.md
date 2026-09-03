# 요구사항(Requirement) 리뷰

이 diff 는 리뷰 라운드 10 (`04_56_34`)이며, 대상은 `origin/main` 대비 누적 diff — 이미
9라운드(01_49_18 ~ 04_37_28)의 requirement/testing/documentation/maintainability/security 등
리뷰를 거쳐 Warning 전건이 조치됐고 남은 것은 근거를 남긴 INFO 뿐이다(`04_37_28/RESOLUTION.md`
"실질 결함은 8R 에서 끝났다"). 아래는 이번 라운드에서 새로 수행한 독립 검증 결과다.

## 검증 방법

- `collectTsFiles`(`codebase/backend/src/common/__test-utils__/source-scan.ts`)와 이를 소비하는
  5개 가드(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
  `masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`·
  `nullable-type-lie-cast-guard.ts`)의 전체 파일을 Read.
- `codebase/backend/src` 하위에 `.d.ts`·`node_modules`·`dist` 가 실제로 0개인지 `find` 로
  독립 실측 — 원 walker 5종이 이 축들에서 갈렸던 부분이 지금 무해하다는 plan/코드 docstring
  의 주장을 재확인(0/0, 문서 주장과 일치).
- `jest`로 `source-scan.spec.ts`(23) · `masked-reject-callers.spec.ts`(15 추정, 위 3파일 합산
  80) · `nullable-type-lie-cast.spec.ts` 및 이 walker 를 소비하는 나머지 3개 가드 spec
  (`audit-action-binding.spec.ts`·`engine-error-code-anchor.spec.ts`·
  `redis-fail-open-catalog.spec.ts`)을 직접 실행 — **6개 spec 파일, 122 테스트 전부 PASS**.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 가 인용하는 spec 본문 2곳을
  직접 대조: `spec/1-data-model.md:260-261`(`next_run_at | Timestamp` vs
  `last_run_at | Timestamp?`)과 `spec/5-system/2-api-convention.md:53-54`(§2.2 명시 예외
  두 가지: RPC-style sub-channel action, `/api/external/*`)를 열어 plan 의 인용이 실제 spec
  본문과 line-level 로 일치함을 확인.
- TODO/FIXME/HACK/XXX grep — 9개 변경 파일 전수, 매치 0(`XxxError` 패턴명 1건은 오탐 제외).
- plan 의 "일곱 번 반복" 표 실측 — 행 수 `grep -c` = 7, 서술("일곱 다 같은 형태다")과 일치.

## 발견사항

이번 독립 검증에서 새로운 CRITICAL/WARNING 은 발견되지 않았다. 아래는 이미 문서화·유예된
자리들에 대한 확인 결과다(신규 발견 아님, 참고용 INFO).

- **[INFO]** `collectTsFiles` 는 `root` 가 존재하지 않으면 `fs.readdirSync` 가 예외를 던진다 —
  명시적 에러 핸들링이 없다.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` — `export function collectTsFiles` (라인 249~271)
  - 상세: 다만 이는 이번 diff 가 도입한 회귀가 아니다 — 대체된 5개 walker(`walkTsFiles`·`collectSourceFiles`
    구현부 등) 전부 동일하게 무방비였고, 호출부는 전부 저장소 루트 기준 상수 경로(`MODULES_DIR`·
    `ENGINE_DIR` 등)이거나 테스트 fixture 의 `mkdtempSync` 산출물이라 실제로 존재하지 않는 경로가
    들어올 여지가 없다. 동작 불변(behavior-preserving) 리팩터의 범위를 넘지 않는다.
  - 제안: 조치 불필요. 향후 `collectTsFiles` 가 사용자 입력 등 신뢰할 수 없는 경로를 받게 되면 그때
    가드를 추가.

- **[INFO]** plan 의 두 "후속(planner 턴)" 항목(`spec/1-data-model.md` §2.9 `next_run_at`
  표기 정정, `2-api-convention.md §2.2` `/api/auth/*` 네임스페이스 예외)이 여전히 `[ ]` 로 열려
  있다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` — `## 할 일` 목록
  - 상세: 직접 대조한 결과 둘 다 실재하는 spec 갭이다(위 "검증 방법" 참조) — 지어낸 인용이
    아니다. 그리고 둘 다 CLAUDE.md §자기-반증형 소정정의 다섯 조건(특히 "developer 자신이 그
    문장을 썼다") 을 충족하지 못한다 — `next_run_at`/`last_run_at` 표기는 선재(pre-existing)
    문서 오류이고, `/api/auth/*` 예외 조항 누락도 developer 가 쓴 예고 문장이 아니라 제품
    계약(§2.2 명명 규칙)의 공백이다. planner 턴으로 미루는 것이 정확한 처분이며, 이 PR 자체의
    결함이 아니다.
  - 제안: 조치 불필요 — 다음 planner 턴에서 흡수.

## 요약

`collectTsFiles` 로의 walker 5종 통합과 `widenedEntityFields`/`findStaleSpecCasts`(넓혀진
nullable 필드를 겨눈 낡은 `.spec.ts` 캐스트 검출) 신설은 plan 이 서술한 의도·동작과
line-level 로 일치한다. 다섯 walker 의 차이축(`.spec.ts` 제외·`.d.ts` 제외·`node_modules`/
`dist` skip·`sort()`) 중 실제로 결과를 바꾸는 것이 `.spec.ts` 포함 여부뿐이라는 주장을
`backend/src` 하위 `.d.ts`/`node_modules`/`dist` 부재를 직접 `find` 로 재확인해 검증했고,
6개 관련 spec 파일 122건 테스트가 전부 GREEN 이다. 이름 충돌(동명 필드) 오탐 방지, `type:`
누락에 대한 JoinColumn 예외, `| null` 표기 변형(공백·순서) 방어, 리터럴 내부 코드 오탐 배제
(`stripLiterals`) 등 앞선 9라운드 리뷰가 지적한 엣지 케이스가 전부 대조군 테스트로 고정돼
있다. TODO/FIXME/HACK/XXX 류 미완성 표식은 없다. spec fidelity 관점에서 plan 이 인용한
`spec/1-data-model.md`·`spec/5-system/2-api-convention.md` 의 두 불일치는 실재하며, 개발자
권한 밖(§자기-반증형 소정정 미해당)으로 정확히 planner 턴에 위임돼 있어 코드 결함이 아니다.
이번 독립 재검증에서 새로운 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW
