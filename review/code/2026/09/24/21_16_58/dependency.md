# 의존성(Dependency) 리뷰

## 검토 범위 참고

이번 변경 세트(파일 11개)는 다음으로 구성된다:

- `.github/workflows/spec-link-checks.yml` — CI 워크플로 pathspec·실행 범위 확장
- `PROJECT.md` — 위 워크플로 변경에 대응하는 문서 서술 갱신
- `plan/in-progress/docs-guard-trigger.md` — 작업 plan (신규)
- `review/consistency/2026/09/24/21_04_26/*` — `/consistency-check --impl-prep` 산출물 6종 (신규, 읽기전용 리포트)

**패키지 매니페스트(`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` 등) 변경은 이 diff 에 없다.** 새 외부 의존성 추가·버전 변경·라이선스 이슈는 원천적으로 발생하지 않는다. 점검 관점 1~7(신규 의존성/버전 고정/라이선스/취약점/불필요한 의존성/의존성 크기/기존 의존성 호환성)은 전부 **해당 없음**.

## 발견사항

- **[INFO] CI 잡의 암묵적 "디렉터리 의존" 으로 전환 — 관점 8(내부 의존성)**
  - 위치: `.github/workflows/spec-link-checks.yml:115` (신규 `run:` 줄), 대응 서술 `PROJECT.md:385`
  - 상세: 종전에는 `run: pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` 로 **파일 하나를 명시**했다. 변경 후에는 `run: pnpm --filter frontend test src/lib/docs/__tests__/` 로 **디렉터리 전체**를 돈다. 이는 CI 잡의 의존 대상이 "명시된 한 파일"에서 "그 디렉터리에 존재하는 모든 테스트 파일(암묵적 fan-in)"로 바뀌었다는 뜻이다 — `src/lib/docs/__tests__/` 에 새 `*.test.ts` 가 추가되면 워크플로 파일을 고치지 않아도 자동으로 이 CI 잡의 실행 대상에 포함된다.
  - 이 변경은 plan(`plan/in-progress/docs-guard-trigger.md` §B)에서 **의도적으로** 설계된 것이다 — "파일을 열거하면 새 docs 가드가 생길 때마다 여기를 고치는 것을 잊는다"는 반복 결함(같은 파일 헤더 주석이 2026-08-27·2026-09-24 두 차례 같은 형태의 갭을 기록)을 없애기 위한 결정이며, 디렉터리 스코프가 좁게 `src/lib/docs/__tests__/` 로 한정돼 있어 무분별한 확장은 아니다.
  - 다만 이 형태의 결속(잡이 "테스트 개수"가 아니라 "디렉터리 내용물"에 의존)은 향후 그 디렉터리에 **의도치 않은 무거운 테스트**(예: 네트워크 I/O·긴 타임아웃을 가진 실험적 vitest 파일)가 추가되면 이 lightweight CI 트리거의 실행 시간이 조용히 늘어날 수 있다는 트레이드오프를 갖는다. plan 은 로컬 실측(23 파일·3567 assertions, "수 초")으로 현재 시점의 비용을 검증했으나, 이는 스냅샷이지 상한이 아니다.
  - 제안: 조치 불요(설계 의도가 문서화돼 있고 근거가 합리적). 다만 이 디렉터리에 무거운(네트워크·긴 타임아웃) 테스트를 추가하는 후속 PR 이 있다면, "이 워크플로가 lightweight 대체 트리거여야 한다"는 헤더 주석의 불변식을 해칠 수 있음을 그 PR 리뷰에서 재확인할 필요가 있다.

- **[INFO] CI 트리거 표면 확대 — `plan/**` pathspec 추가**
  - 위치: `.github/workflows/spec-link-checks.yml:71` (`pathspecs:` 블록의 `plan/**` 추가)
  - 상세: 이 워크플로를 발화시키는 변경 경로 집합이 넓어져, 이제 `plan/**` 만 바꾼 PR 에서도 이 잡이 (스킵되지 않고) 실행된다. 이는 "이 CI 잡이 어떤 변경에 의존해 발화하는가"라는 내부 의존 관계의 확장이며, 결과적으로 plan-only PR 의 CI 실행 횟수/시간이 소폭 늘어난다. plan 문서 §D 에서 실제 과거 커밋(`89f67c040`)으로 `relevant=false → true` 전환을 실측 검증했고, 목적(같은 디렉터리의 plan/spec 스캔 가드들이 plan-only PR 에서 전혀 안 돌던 실결함 2건, `#1387`·`#1389`)과 부합한다.
  - 제안: 조치 불요. 스코프가 `plan/**` 로 좁고 잡 자체가 가벼운 vitest 하나(수 초)라 CI 비용 증가는 미미하다.

- **[INFO] 새 외부 패키지·버전 변경 없음 (확인)**
  - 위치: 해당 없음 — 매니페스트 파일이 diff 대상에 없음
  - 상세: `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` 어디에도 diff 가 없다. `pnpm --filter frontend test <path>` 호출 형태 변경은 이미 설치돼 있는 vitest 러너의 **호출 인자**(테스트 대상 glob)만 바꾼 것이지 새 devDependency 를 끌어오지 않는다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 CI 워크플로(YAML)·문서(PROJECT.md)·plan·consistency-check 산출물로만 구성되며 패키지 매니페스트 변경이 전혀 없어, 신규 의존성·버전 고정·라이선스·취약점·불필요한 의존성·크기·기존 의존성 호환성 관점(1~7)은 모두 해당 사항이 없다. 유일하게 의존성 관점에서 볼 만한 대목은 관점 8(내부 의존성) — CI 잡이 "파일 열거"에서 "디렉터리 전체"로 실행 대상을 바꿔 향후 추가되는 테스트 파일에 암묵적으로 의존하게 된 점과, `plan/**` pathspec 추가로 이 워크플로의 트리거 표면이 넓어진 점이다. 둘 다 plan 문서에 실측 근거와 함께 의도적으로 설계돼 있고 스코프가 좁아 리스크가 낮다.

## 위험도
NONE
