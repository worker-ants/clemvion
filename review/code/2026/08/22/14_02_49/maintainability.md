# 유지보수성(Maintainability) Review

## 개요

이 변경의 핵심은 **중복 제거**다 — `masked-marker-mirror-guard.ts`/`masked-marker-mirror.spec.ts`
backend 사본(합계 ~354줄)을 삭제하고, 저장소 전체를 훑는 CI 잡(`repo-guards.yml`)을 신설해 경로
게이팅 때문에 존재하던 중복의 **원인 자체**를 없앴다. frontend 쪽 남은 사본의 헤더 주석도 "backend
쌍둥이와 대칭을 맞춰라" 지시에서 "이 파일이 유일한 사본이다" 로 정확히 갱신됐다. 신규 코드(함수·
로직)는 추가되지 않았고 실질 변경은 CI 워크플로 YAML·테스트 레지스트리·주석·plan 문서에 국한된다.

## 발견사항

- **[INFO]** 신규 워크플로 파일명이 기존 명명 패턴에서 벗어남
  - 위치: `.github/workflows/repo-guards.yml:24` (`name: repo-guards`)
  - 상세: 기존 스택별 워크플로는 `<영역>-checks.yml` 패턴(`frontend-checks.yml`,
    `backend-checks.yml`, `web-chat-checks.yml` 등)을 따르는데 `repo-guards.yml` 은 `-checks`
    접미사가 없다. `migration-check.yml`/`review-gate.yml` 선례가 있어 강제 컨벤션 위반은
    아니고(consistency naming-collision checker 도 이미 동일하게 INFO 로 지적), 오히려
    `codebase/{backend,frontend}/.../repo-guards/` 소스 디렉터리와 의미상 대응해 발견성은
    좋은 편이다.
  - 제안: 강제 조치 불필요. 통일성을 원하면 `repo-guards-checks.yml` 로 개명 검토.

- **[INFO]** `mirror-guard` 잡 이름이 현재는 단일 가드 전용이라, 향후 확장 시 이름이 좁아질 수 있음
  - 위치: `.github/workflows/repo-guards.yml:62` (`mirror-guard:`)
  - 상세: 워크플로 헤더 주석(`repo-guards.yml:1-23`)은 "저장소 전체를 훑는 가드 전부가 여기서
    돈다"는 넓은 스코프를 선언하는데, 실제 잡은 `mirror-guard` 하나뿐이고 이름도 마커 미러 가드에
    특정돼 있다. 다음에 또 다른 저장소-전체 가드가 추가될 때 이 잡에 스텝을 얹을지, 새 잡을
    만들지가 이름만으로는 안 드러난다.
  - 제안: 현재는 문제없음(가드가 하나뿐이므로). 두 번째 저장소-전체 가드가 생기는 시점에 잡을
    분리할지 `mirror-guard` 를 더 일반적인 이름으로 바꿀지 결정하면 됨 — 지금 선제 조치는
    불필요.

- **[INFO]** CI 스텝이 스펙 파일 경로를 문자열로 하드코딩
  - 위치: `.github/workflows/repo-guards.yml:85-86`
    (`pnpm --filter frontend exec vitest run src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts`)
  - 상세: 대상 spec 파일 경로가 워크플로 YAML 에 리터럴 문자열로 박혀 있어, 그 파일이 이동·개명되면
    이 스텝은 (파일이 존재하지 않아) 실패하는 방식으로 fail-closed 하긴 하지만 워크플로 자신을
    함께 갱신해야 하는 결합점이 생긴다. `repo-guards.yml` 자신은 `changes` 잡의 pathspec 에 자기
    자신(`repo-guards.yml`)만 등재돼 있고 대상 spec 파일 경로는 등재돼 있지 않다 — spec 파일이
    바뀌어도(예: 새 캐너리 `it` 추가) 이 워크플로는 relevant 판정 없이 계속 도는 게 아니라, "다른
    codebase 변경이 있어야" 도는 구조이므로 큰 문제는 아니지만, 하드코딩된 절대 경로 리터럴이라는
    점 자체는 매직스트링에 해당한다.
  - 제안: 현재로선 실질 위험 낮음(경로가 바뀌면 vitest 가 파일-not-found 로 즉시 fail 하므로
    조용한 실패가 아님). 정보 제공 목적의 INFO.

- **[INFO]** frontend guard/test 두 파일이 같은 배경 서사를 각자 헤더에 서술 — 의도된 분리
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:1-14`,
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:16-43`
  - 상세: guard.ts 헤더(간결한 "유일한 사본이다" 요지)와 test.ts 헤더(라운드별 사고 이력까지 포함한
    상세 서술)가 같은 배경을 다른 상세도로 중복 서술한다. 다만 이 저장소는 "파서 순수 로직과 소비
    spec 을 분리"하는 규약을 명시적으로 채택하고 있어(형제 가드 `internal-package-registration-guard.ts`
    등과 동일 패턴) 의도된 구조이며, 정보 손실 없이 각자 필요한 맥락(logic 파일 = 왜 이 파일만
    남았는지, spec 파일 = 왜 이 테스트들이 캐너리로 남아야 하는지)을 갖는다.
  - 제안: 조치 불필요 — 결함이 아니라 기존 컨벤션 준수임을 확인차 기록.

## 요약

이 PR 은 유지보수성 관점에서 **순net 개선**이다. 삭제된 backend 사본 2파일(162줄+192줄)은 이 PR
계열에서 두 차례(라운드3·6) 비대칭 결함의 실제 근원이었던 코드이고, 이번 변경은 "대칭 캐너리로
증상을 막는" 대신 "CI 경로 게이팅이라는 근본 원인을 없애 사본 자체를 제거"하는 더 근본적인 해법을
택했다. 신규로 추가된 코드(`repo-guards.yml`)는 함수·로직이 없는 선언적 CI 설정이라 함수 길이·중첩
깊이·순환 복잡도 관점의 위험이 없고, 기존 스택별 워크플로(`frontend-checks.yml` 등)와 구조·주석
스타일이 일관된다. 파이썬 테스트 레지스트리(`test_required_check_skip_jobs.py`,
`test_workflow_yaml_structure.py`) 갱신도 기존 리스트 순서·패턴을 그대로 따른다. 발견된 사항은 전부
INFO 수준(워크플로 명명 패턴 이탈, 단일-가드 잡 이름의 확장성, spec 경로 하드코딩)이며 어느 것도
가독성·복잡도·중복 측면에서 실질적 유지보수 부담을 만들지 않는다.

## 위험도

NONE
