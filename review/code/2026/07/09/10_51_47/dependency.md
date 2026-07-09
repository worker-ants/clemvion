# 의존성(Dependency) 리뷰 결과

대상 커밋: `f2fd9c61d` — refactor(frontend): 슬러그 라우팅 하드닝 B (실행경로 헬퍼·safe-path 정규화·타입 순환제거)
대상 파일: 18개 (frontend `codebase/frontend/src/**` tsx/ts 17개 + `plan/in-progress/slug-routing-hardening.md` 1개)

## 발견사항

- **[INFO]** 새 외부 패키지 없음 — 순수 내부 리팩터
  - 위치: 변경 파일 전체(18개)
  - 상세: diff 에 `package.json`/`pnpm-lock.yaml`/`package.json.workspace` 등 의존성 매니페스트 변경이 전혀 포함되어 있지 않다. 신규로 도입된 것은 `codebase/frontend/src/lib/workspace/{types.ts, safe-path.ts}` 두 내부 모듈과 `href.ts` 의 `buildExecutionHref` 함수뿐이며, 모두 프로젝트 내부 코드다. 신규 npm 패키지 도입이 없으므로 라이선스 호환성·버전 고정·알려진 CVE·번들 크기 증가 항목은 이번 변경 범위에서 해당 사항 없음(N/A).
  - 제안: 없음(현행 유지).

- **[INFO]** 내부 의존성 그래프 개선 — store ↔ util 순환 참조 구조적 제거 (B-4)
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts`, `codebase/frontend/src/lib/workspace/resolve-fallback.ts`, `codebase/frontend/src/lib/workspace/types.ts`(신규)
  - 상세: 기존에는 `resolve-fallback.ts` 가 `import type { WorkspaceSummary } from "@/lib/stores/workspace-store"` 형태로 store 를 되돌아 참조했다(런타임 순환은 아니었으나 — type-only import 로 컴파일 타임에 소거됨 — 모듈 그래프 상 store→util→store 엣지가 존재해 `import/no-cycle` 류 정적 분석 도구가 오탐할 여지가 있었음). 본 커밋은 `WorkspaceRole`/`WorkspaceSummary` 를 `lib/workspace/types.ts` 로 추출하고, `resolve-fallback.ts` 는 이제 `types.ts` 만 참조, `workspace-store.ts` 는 `types.ts` 로부터 타입을 가져와 하위호환을 위해 재-export(`export type { WorkspaceRole, WorkspaceSummary } from "@/lib/workspace/types"`) 한다. 결과적으로 의존 방향이 `workspace-store.ts → resolve-fallback.ts → types.ts`(단방향) 로 단순화됐고, 기존 16개 importer 는 `@/lib/stores/workspace-store` 에서 그대로 타입을 import 할 수 있어 breaking change 없음.
  - 제안: 없음 — 내부 의존성 위생(hygiene) 개선으로 긍정적 변경. 후속으로 `import/no-cycle` 같은 정적 순환 참조 lint 규칙이 아직 없다면 이번 리팩터의 의도(순환 재발 방지)를 CI 로 고정하기 위해 도입을 고려할 수 있음(선택 사항, 이번 PR 범위 밖).

- **[INFO]** `href.ts` → `safe-path.ts` 신규 단방향 의존 (B-3)
  - 위치: `codebase/frontend/src/lib/workspace/href.ts`, `codebase/frontend/src/lib/workspace/safe-path.ts`(신규), `codebase/frontend/src/components/ui/error-page.tsx`
  - 상세: 기존 `buildWorkspaceHref` 내부에 인라인돼 있던 open-redirect 방어 정규화 로직(`toSafeInternalPath` 동치)을 `safe-path.ts` 로 추출해 `href.ts` 와 `error-page.tsx` 양쪽이 공유하도록 했다. `safe-path.ts` 는 외부 의존이 전혀 없는 순수 함수 모듈이고, `href.ts`/`error-page.tsx` 는 이를 단방향으로 import 한다 — 순환 없음. 두 소비처 간 방어 로직이 갈라지던(비대칭) 기존 상태를 단일 진실로 통합한 것으로 의존성 관점에서도 중복 로직 제거(불필요한 의존성/중복 감소, 점검관점 5)에 해당하는 긍정적 변화.
  - 제안: 없음.

- **[INFO]** 신규 테스트가 Node 코어 모듈(`node:fs`, `node:path`)만 사용 — 외부 의존 없음, 단 런타임 비용 존재
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts`
  - 상세: `no-raw-execution-href.test.ts` 는 신규 npm 패키지 없이 Node 내장 `fs`/`path` 만으로 `src/` 전체를 재귀 스캔해 raw `` `/workflows/${...}/executions` `` 리터럴 존재 여부를 텍스트 매칭으로 검사한다. 의존성 자체는 문제 없으나, 매 테스트 실행마다 소스 트리 전체를 동기 순회(`fs.readdirSync`/`readFileSync`)하므로 소스 파일 수가 늘어날수록 테스트 실행 시간이 선형으로 증가한다(빌드 시간과는 무관, 테스트 스위트 시간에만 영향). 커밋 메시지에도 명시된 대로 ESLint AST 매칭의 취약성을 피하기 위한 의도적 트레이드오프로, 현재 규모에서는 무시할 수준.
  - 제안: 없음(현재 스케일에서 우려 없음). 소스 트리가 크게 성장하면 스캔 대상 디렉터리를 `lib/`, `components/`, `app/` 등으로 좁히거나 `.eslintrc` ignore 패턴과 동기화하는 것을 고려.

- **[INFO]** `dashboard/page.tsx` 신규 import 는 기존에 이미 사용 중인 내부 모듈 재사용
  - 위치: `codebase/frontend/src/app/(main)/w/[slug]/dashboard/page.tsx`
  - 상세: 추가된 `import { useWorkspaceSlug } from "@/lib/workspace/use-workspace-slug"; import { buildExecutionHref } from "@/lib/workspace/href";` 는 다른 페이지(executions/page.tsx, execution detail 등)에서 이미 사용 중이던 기존 내부 모듈이며 신규 외부 의존은 없다. 15곳의 실행경로 리터럴을 `buildExecutionHref` 하나로 통합해 내부 의존 표면(surface)을 늘리기보다 오히려 흩어진 문자열 조합 로직을 단일 지점으로 수렴시킨 개선.
  - 제안: 없음.

## 요약

이번 변경은 신규 외부 패키지·버전 변경·`package.json`/lockfile 수정이 전혀 없는 순수 프론트엔드 내부 리팩터다. 실질적인 "의존성" 관점 변화는 모두 프로젝트 내부 모듈 그래프에 국한된다 — `WorkspaceRole`/`WorkspaceSummary` 타입을 `lib/workspace/types.ts` 로 분리해 `workspace-store` ↔ `resolve-fallback` 간 잠재적 순환 참조 엣지를 구조적으로 제거했고, open-redirect 방어 정규화를 `safe-path.ts` 로 추출해 `href.ts`/`error-page.tsx` 가 중복 로직 없이 공유하도록 했으며, 실행경로 문자열 조합을 `buildExecutionHref` 로 단일화해 15곳의 산재 리터럴을 제거했다. 모든 변경이 단방향 의존(및 하위호환 re-export)으로 설계돼 breaking change 나 신규 순환을 유발하지 않는다. 라이선스·취약점·번들 크기·빌드 시간에 미치는 영향은 없다(N/A). 신규 소스-텍스트 기반 guard 테스트가 매 실행 시 소스 트리 전체를 스캔하는 점만 참고 사항으로 남기며, 현재 규모에서는 문제되지 않는다.

## 위험도

NONE
