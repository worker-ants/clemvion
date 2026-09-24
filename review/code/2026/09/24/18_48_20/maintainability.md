# 유지보수성(Maintainability) 리뷰

## 검토 범위

이번 changeset 은 애플리케이션 소스 코드(`src/**/*.ts`)를 포함하지 않는다.

- `codebase/backend/package.json` — `@nestjs/typeorm` 캐럿 `^11.0.3` → `^12.0.1` (1줄)
- `pnpm-lock.yaml` — 위 범프에 따른 typeorm 한정 재계산(15줄, 리뷰 1라운드 W1 조치로 무관 변경 제거됨)
- `PROJECT.md` — "Node 지원 floor" 항목에 `require(esm)` 암묵적 결속 설명 추가
- `plan/in-progress/deps-typeorm12.md`(신규), `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(개정),
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(백로그 1건 추가)
- `review/code/2026/09/24/18_22_23/**`, `review/consistency/2026/09/24/17_31_27/**` — 이전 라운드
  리뷰/일관성 산출물(세션 로그성 파일, 코드 아님)

함수/클래스/중첩/순환복잡도 같은 코드 단위 지표를 적용할 대상이 없어, 문서(plan·PROJECT.md)의
가독성·네이밍·일관성·중복 관점으로 검토했다.

## 발견사항

- **[INFO]** `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 의 섹션 번호 체계가
  `## 0. 왜 멈췄나` → `## 3. 재개 조건` → `## A.` ~ `## E.` 순으로, 숫자(0, 3)와 알파벳(A~E)이
  섞이고 숫자도 1·2 를 건너뛴 채 비연속이다.
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` — 헤더 `## 0. 왜 멈췄나 — 세 벽 (전부 실측)`,
    `## 3. 재개 조건`, `## A. 왜 부분 범프가 안 되나 — 실측` (diff 게이트 30·52·66행)
  - 상세: 이 문서는 "상류가 움직일 때까지 열어 둔다" 고 명시된 장기 보류 문서라, 나중에 재개하는
    사람이 헤더만 훑어 구조를 파악해야 하는데 `0 → 3 → A` 전환이 그 탐색을 방해한다. 다만 이
    항목은 직전 라운드(`review/code/2026/09/24/18_22_23/maintainability.md` INFO #6 상당)에서 이미
    지적되었고, `RESOLUTION.md` 가 "§0·§3 을 기존 A~E 체계 앞에 덧댄 결과라 조치 없음" 으로
    명시적으로 수용한 트레이드오프다. 새로운 정보가 없어 재지적 수준을 올리지 않는다.
  - 제안: 조치 불요(이미 검토·수용됨). 다음에 이 문서를 실제로 재개할 때 헤더 체계를 한 번에
    정리하는 편이, 지금 부분 수정으로 번호를 또 바꾸는 것보다 낫다.

- **[INFO]** 업그레이드 전 기준값(부트 캐너리 142건 · reflection 3스위트 48통과 · 판별자 뮤턴트
  9건 RED)이 `nestjs-v12-coordinated-upgrade.md` §C 하위와 `deps-typeorm12.md` §C 두 문서에
  리터럴로 중복 기재된다.
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (diff 게이트 118~129행 부근,
    `### 업그레이드 전 기준값` 절), `plan/in-progress/deps-typeorm12.md` (diff 게이트 62~72행,
    `## C. 검증` 절)
  - 상세: 값이 어긋나면 어느 쪽이 최신인지 판단할 SoT 표시가 없다. 다만 두 문서는 서로 다른
    시점의 증거(전자=재개 시 비교 기준, 후자=이번 PR 의 전/후 실측)를 기록하는 것이라는 설명이
    이미 `RESOLUTION.md` INFO 처분에 있고, 실제로 값이 일치함이 이번 diff 안에서 확인된다("업그레이드
    후에도 동일" — `nestjs-v12-coordinated-upgrade.md` §E 체크리스트). 새 결함은 아니다.
  - 제안: 조치 불요. 세 번째 문서가 같은 숫자를 다시 인용하게 되면 그때는 단일 정본을 지정할
    가치가 생긴다.

- **[INFO]** `PROJECT.md` "Node 지원 floor" 항목에 추가된 문장이 기존 한 불릿에 이어 붙어 매우 긴
  단일 불릿(약 6문장)을 이룬다.
  - 위치: `PROJECT.md` — `- **Node 지원 floor**: ...` 불릿 (diff 게이트 61행)
  - 상세: 가독성만 보면 하위 불릿으로 쪼개는 편이 낫지만, 바로 위 `typescript`·`eslint-plugin-unicorn`
    근거 불릿들도 동일하게 압축된 멀티 센텐스 스타일이라 이 문서 전체의 기존 컨벤션과 일치한다.
    일관성 관점에서는 오히려 이 형식을 따른 것이 맞다.
  - 제안: 조치 불요 — 문서 전체 스타일을 바꾸는 것은 이 PR 스코프 밖이다.

## 요약

이번 diff 는 `@nestjs/typeorm` 의존성 메이저 범프 1줄과 그에 따른 lockfile 재계산(1라운드 리뷰로 이미
typeorm 한정 15줄로 좁혀짐), `PROJECT.md` 문서 보강, plan 문서 갱신/신규 작성, 그리고 직전 리뷰·
일관성 검토 라운드의 산출물 커밋으로 구성된다. 애플리케이션 코드가 없어 가독성/네이밍/함수 길이/
중첩/매직 넘버/중복/복잡도 같은 코드 단위 지표는 적용 대상이 없다. 문서 관점에서 발견한 두 가지
(plan 섹션 번호 비일관, 기준값 리터럴 중복)는 모두 새로운 결함이 아니라 직전 리뷰 라운드에서 이미
검토되어 "조치 불요" 로 수용된 사안이 그대로 남아 있는 것이며, 이번 diff 가 그 상태를 악화시키지
않았다. `PROJECT.md` 의 새 문단은 밀도가 높지만 인접 문단들과 동일한 기존 스타일을 따르고 있어
컨벤션 일관성 관점에서 문제없다. 전반적으로 유지보수성 리스크는 없다.

## 위험도
NONE
