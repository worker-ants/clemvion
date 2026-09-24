# 아키텍처 리뷰: docs-guard-trigger (CI 워크플로 스코프 확장)

## 발견사항

- **[INFO]** `spec-link-integrity` 잡이 이름과 다른 다수 가드를 통합 수행 (SRP·인터페이스 정합성 불일치)
  - 위치: `.github/workflows/spec-link-checks.yml:90` (`spec-link-integrity:` 잡 정의), `:112-115` (`docs guards (src/lib/docs/__tests__ 전체)` 스텝, `run: pnpm --filter frontend test src/lib/docs/__tests__/`)
  - 상세: 잡 이름 `spec-link-integrity` 는 `spec-link-integrity.test.ts` 하나만 돌리던 시절의 이름인데, 이번 변경으로 같은 디렉터리의 `plan-frontmatter`·`spec-frontmatter`·`spec-code-paths`·`spec-pending-plan-existence`·`spec-status-lifecycle`·`spec-area-index`·`spec-plan-completion` 등 다수의 서로 다른 검증 책임을 한 잡이 떠안는다. GitHub PR UI·branch protection 에 노출되는 "공개 인터페이스"인 체크 이름은 여전히 좁은 책임(link integrity)만 암시하므로, 예컨대 `plan-frontmatter` 위반으로 이 체크가 실패해도 담당자는 이름만 보고 원인을 오추정하기 쉽다. `#1106` 의 required-check 앵커 안정성 제약 때문에 즉시 개명이 어렵다는 트레이드오프는 헤더 주석(85~89행)이 스스로 설명하며, 같은 사안을 consistency-check(`naming_collision #7`, INFO)도 이미 포착·기록했다 — 새 결함이 아니라 그 트레이드오프를 아키텍처 관점에서 재확인.
  - 제안: 잡 id(`spec-link-integrity`)는 유지하되, 스텝 표시명(이미 "docs guards (src/lib/docs/__tests__ 전체)"로 갱신됨)처럼 Checks 요약에 실제 스코프를 계속 노출하는 관례를 유지. 장기적으로 `test_workflow_yaml_structure.py` 의 앵커를 잡 id 가 아닌 별도 alias 메커니즘으로 분리하는 안은 이번 PR 범위를 넘는 후속 검토로 남긴다.

- **[INFO]** "가벼운 대체 트리거" 불변식이 구조적으로 강제되지 않음 (열거 제거로 얻은 확장성의 이면)
  - 위치: `.github/workflows/spec-link-checks.yml:115` (`run:` 커맨드), 근거 주석 `:27-29`
  - 상세: 파일 열거 → 디렉터리 전체 실행으로 바꾼 목적은 "새 가드가 생겨도 워크플로를 잊지 않고 함께 돈다"는 개방-폐쇄 원칙(OCP) 개선이며, 그 전제로 "디렉터리 전체도 vitest 로 수 초"라는 가벼움을 유지한다고 주석에 적었다. 그러나 이 불변식(그 디렉터리에는 가벼운 docs 가드만 존재해야 한다)을 강제하는 코드·테스트는 없고 순수 관례다. 향후 누군가 이 디렉터리에 무거운 테스트나 docs governance 와 무관한 테스트를 추가하면, 이 워크플로가 "가벼운 대체 트리거"라는 설계 목적을 조용히 잃거나 무관한 실패로 required-check 판정이 오염될 수 있다.
  - 제안: 디렉터리 스코프를 구조적으로 좁히는 안전장치(파일명 접미사 컨벤션, 실행 시간 상한을 검증하는 하네스 테스트 등)를 후속 검토. 이번 PR 스코프를 넘는 개선이라 즉시 조치는 불필요.

- **[INFO]** 워크플로 YAML 헤더에 사고 이력 서술이 반복 누적 (거버넌스 정보 저장 위치)
  - 위치: `.github/workflows/spec-link-checks.yml:1-29`
  - 상세: 전체 115줄 중 상단 약 29줄(≈25%)이 세 시점(도입 배경/PR #912, 2026-08-27, 2026-09-24)의 사고 서술로 채워져 있다. 이 저장소는 "결정의 배경·근거는 spec 문서 끝 `## Rationale`" 을 단일 진실 위치로 못박고 있는데, 이 CI 파일 자체가 반복해서 사고 일지 역할을 겸하는 패턴(이미 3회)이 굳어지는 중이다. 지금은 가독성에 큰 지장이 없으나, 같은 형태의 갭이 또 재발하면 헤더가 계속 길어지는 구조다.
  - 제안: 다음 유사 사고 시에는 이력을 `spec/conventions/spec-impl-evidence.md` §Rationale 또는 별도 CI 컨벤션 문서로 옮기고, 워크플로 파일에는 "왜 지금 이 pathspec/스코프인가"에 대한 짧은 포인터만 남기는 정리를 고려.

- **[INFO]** 문서 거버넌스 가드가 frontend 패키지 테스트 트리에 물리적으로 결합 (기존 구조, 이번 diff 로 실행 경계가 더 굳어짐)
  - 위치: `.github/workflows/spec-link-checks.yml:105-115`
  - 상세: `spec/**`·`plan/**`·거버넌스 문서 전체를 검증하는 저장소 전역 관심사가 `codebase/frontend/src/lib/docs/__tests__/` 안에 위치하고 `pnpm --filter frontend test` 로만 실행 가능하다. 이는 이번 PR 이 만든 구조가 아니라 기존 구조지만, "파일 열거 → 디렉터리 전체 실행"으로 바뀌며 그 디렉터리 자체가 CI 상 "문서 거버넌스 전체"의 유일한 실행 경계로 더 굳어졌다. backend 에는 유사한 목적의 `codebase/backend/src/repo-guards/` 가 별도로 존재해, 저장소 전역 거버넌스 가드를 특정 애플리케이션 패키지 내부에 두는 것이 이 저장소의 기존 관례이긴 하나, 향후 스택이 늘거나 가드가 더 늘어나면 이 결합이 마찰이 될 수 있음을 기록해 둔다.
  - 제안: 즉시 조치 불요 — 후속으로 별도 workspace(`packages/repo-guards` 유사) 추출 여부를 검토할 수 있음.

## 요약
이번 변경은 CI 워크플로(`spec-link-checks.yml`)의 트리거 pathspec 에 `plan/**` 을 추가하고, 단일 테스트 파일 실행을 디렉터리 전체 실행으로 바꿔 "새 docs 가드가 추가돼도 워크플로를 잊지 않고 함께 돈다"는 개방-폐쇄 원칙에 부합하는 방향으로 CI 결합도를 낮췄다. 잡 이름을 `spec-link-integrity` 로 유지한 것은 `#1106` required-check 앵커 안정성이라는 실제 제약에 근거한 의도적 트레이드오프이며, 헤더 주석과 `plan/in-progress/docs-guard-trigger.md` 가 그 배경·실측(§C 실측, §D 판별)을 충분히 남겨 놓았다. `PROJECT.md` 동반 갱신도 실제 명령·스코프와 일치한다. 구조적으로 남는 아쉬움은 (1) 체크 이름이 실제 책임 범위보다 좁아 보이는 인터페이스 부정합, (2) "가벼운 트리거" 불변식이 관례로만 유지되고 구조적으로 강제되지 않는 점, (3) 워크플로 파일 헤더에 사고 이력이 계속 누적되는 패턴, (4) 문서 거버넌스 가드가 frontend 패키지 내부에 물리적으로 결합된 기존 구조가 이번 diff 로 더 굳어진 점이다 — 모두 CRITICAL/WARNING 급이 아니며, 대부분 이미 `--impl-prep` consistency-check(BLOCK: NO, Critical 0, Warning 0)에서 INFO 로 포착·기록된 사안과 궤를 같이한다. 나머지 `review/consistency/**` 산출물 파일들(파일 4~11)은 코드가 아닌 리뷰 데이터이며, 리뷰 산출물을 저장소에 커밋하는 프로젝트 컨벤션(`CLAUDE.md` §정보 저장 위치)에 부합해 별도 아키텍처 결함은 없다.

## 위험도
LOW
