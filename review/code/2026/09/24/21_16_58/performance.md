# 성능(Performance) Review

## 검토 대상 요약

이번 변경 셋(11개 파일)은 애플리케이션 런타임 코드(backend/frontend `codebase/**`)를 전혀
포함하지 않는다 — CI 워크플로 YAML 1개(`.github/workflows/spec-link-checks.yml`), 문서 1개
(`PROJECT.md`), plan 문서 1개(`plan/in-progress/docs-guard-trigger.md`), 그리고 나머지 8개는
`/consistency-check` 산출물(`review/consistency/2026/09/24/21_04_26/**` 의 SUMMARY/JSON/각
checker 리포트)이다. 따라서 알고리즘 복잡도·N+1·메모리·캐싱·블로킹 I/O·자료구조·지연 로딩 같은
런타임 성능 관점은 실질적으로 **적용 대상이 없다**. 유일하게 성능과 조금이라도 접점이 있는 것은
CI 실행 비용(잡 실행 시간·트리거 빈도) 변화이며, 이는 "블로킹 I/O"나 "불필요한 연산"이 아니라
CI 리소스 사용량 관점의 참고 사항으로만 다룬다.

## 발견사항

- **[INFO] CI 잡 트리거 범위 확대로 실행 빈도 증가**
  - 위치: `.github/workflows/spec-link-checks.yml:69-71` (`changes` 잡의 `pathspecs`에 `plan/**` 추가)
  - 상세: `pathspecs`에 `plan/**`가 추가되면서, 이전에는 이 워크플로를 트리거하지 않던 "plan 문서만
    변경하는 PR"에서도 `spec-link-integrity` 잡이 매번 실행된다. 이는 CI 큐/러너 리소스 소비를
    늘리는 방향의 변경이지만, 커밋 헤더 주석(15~29행)이 스스로 밝히듯 정확히 그 갭(plan-only PR에서
    가드가 전혀 안 도는 결함)을 메우기 위한 **의도된** 트레이드오프다. 잡 자체도 `needs.changes`가
    `relevant=false`면 checkout·pnpm install 없이 echo 한 줄로 조기 종료(`spec-link-checks.yml:98-100`)
    하므로, 무관한 PR에서의 오버헤드는 크지 않다.
  - 제안: 조치 불요 — 의도된 트레이드오프이며 이미 plan 체크리스트에서 실측(§D, 옛/새 pathspec 대조)
    으로 근거를 남겼다.

- **[INFO] 단일 테스트 파일 실행 → 디렉터리 전체 실행으로 CI 잡 실행 시간 증가**
  - 위치: `.github/workflows/spec-link-checks.yml:106-115` — `run: pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` → `run: pnpm --filter frontend test src/lib/docs/__tests__/`
  - 상세: 종전에는 vitest가 파일 1개(`spec-link-integrity.test.ts`)만 실행했으나, 변경 후에는
    `src/lib/docs/__tests__/` 디렉터리의 가드 전체(plan-frontmatter, spec-frontmatter,
    spec-code-paths, spec-pending-plan-existence, spec-status-lifecycle, registry,
    guide-identifier-existence 등 다수)가 매 PR/push 마다 실행된다. 이는 "가벼운 대체 트리거"라는
    이 워크플로의 목적과 상충할 여지가 있는 방향이지만, 헤더 주석(27~29행)과 plan 체크리스트
    (`plan/in-progress/docs-guard-trigger.md` 84~85행: "로컬에서 CI 와 같은 명령으로 23파일 3567개
    확인")가 실측 규모(23개 파일, 3567개 검증)를 함께 남겨 두었고 "수 초" 수준이라고 주장한다.
    다만 이 리뷰 세션에서는 그 실행 시간 자체(초 단위 실측치)는 프롬프트 번들에 포함되지 않아
    직접 재검증하지 못했다 — 향후 이 디렉터리에 무거운 가드(예: 대규모 파일 시스템 스캔·외부
    API 호출성 가드)가 추가되면 "디렉터리째 실행" 전략이 이 CI 잡의 실행 시간을 선형적으로
    늘릴 수 있다는 점은 구조적으로 남는 리스크다.
  - 제안: 조치 불요(의도된 설계, 이미 대안 없음이 plan에 근거로 기록됨). 다만 향후 `__tests__/`
    디렉터리에 느린 가드가 추가될 경우 이 워크플로의 실행 시간이 함께 늘어난다는 점을 인지하고,
    필요 시 vitest 자체의 워커 병렬화 설정(`vitest.config.ts`)으로 흡수할 것을 권고.

- **[INFO] 나머지 파일(`PROJECT.md`, plan 문서, consistency-check 산출물)은 정적 문서/리포트이며
  런타임 성능에 영향 없음**
  - 위치: 해당 없음
  - 상세: `PROJECT.md`는 사람이 읽는 안내 문서 갱신, plan 문서는 작업 추적 메타데이터, 나머지
    8개 파일은 `/consistency-check` sub-agent들이 생성한 정적 마크다운/JSON 리포트다. 실행되는
    코드가 아니므로 알고리즘 복잡도·메모리·I/O 등 어떤 성능 항목도 해당하지 않는다.
  - 제안: 없음.

## 요약

이번 diff는 CI 워크플로 설정과 문서/plan/리뷰 산출물만 다루며 애플리케이션 코드 변경이 없어, 통상적인
성능 리뷰 관점(알고리즘 복잡도, N+1, 메모리, 캐싱, 블로킹 I/O, 자료구조, 지연 로딩)이 적용될 대상
자체가 없다. 유일한 성능 인접 변화는 CI 리소스 소비 증가(트리거 범위 확대 + 단일 테스트 → 디렉터리
전체 실행)이며, 둘 다 의도된 트레이드오프로 plan 문서에 실측 근거(23파일·3567검증, 옛/새 pathspec
대조)와 함께 명시돼 있어 문제로 보기 어렵다. 다만 "가드 디렉터리 전체 실행"이라는 설계는 향후 이
디렉터리에 무거운 가드가 추가될 때 CI 실행 시간이 함께 늘어나는 구조적 특성을 갖는다는 점만 참고
사항으로 남긴다.

## 위험도
NONE
