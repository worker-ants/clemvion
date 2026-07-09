# 아키텍처(Architecture) Review

대상: PR #865 후속 "슬러그 라우팅 하드닝 B" (`buildExecutionHref` 헬퍼·safe-path 공용 정규화·guard 테스트·타입 순환 제거), 18개 파일.

## 발견사항

- **[INFO]** B-4 는 "순환 제거"라기보다 "잠재적 순환의 방어적 사전 차단"에 가깝다
  - 위치: `codebase/frontend/src/lib/workspace/resolve-fallback.ts`, `codebase/frontend/src/lib/stores/workspace-store.ts`, `codebase/frontend/src/lib/workspace/types.ts`
  - 상세: 변경 전에도 `resolve-fallback.ts` → `workspace-store.ts` 참조는 `import type`(type-only) 이라 TS/번들러 단계에서 런타임 순환은 이미 없었다(커밋 메시지 자체도 이를 인지). 다만 모듈 의존 그래프 상으로는 "state 계층(store) ← utility 계층(resolve-fallback)"이 서로를 가리키는 구조라, 향후 누군가 store 에 runtime export 를 추가하고 resolve-fallback 이 그걸 참조하게 되면 실제 순환으로 발전할 위험이 있었다. `types.ts` 를 의존성 없는 leaf 모듈로 분리하고 `resolve-fallback → types`, `workspace-store → resolve-fallback + types` 로 방향을 단일화한 것은 DIP(하위 정책이 안정된 추상화에 의존) 관점에서 실질적으로 올바른 개선이다.
  - 제안: 없음(이미 잘 처리됨). 다만 리뷰/커밋 메시지에서 "런타임 순환 제거"보다 "구조적 순환 가능성 사전 차단"으로 표현하면 향후 독자가 이전 상태를 실제 버그로 오인하지 않는다.

- **[INFO]** 타입 SoT 가 두 곳으로 분리된 과도기 상태 (technical debt 추적 필요)
  - 위치: `codebase/frontend/src/lib/stores/workspace-store.ts:9` (`export type { WorkspaceRole, WorkspaceSummary } from "@/lib/workspace/types";`)
  - 상세: `WorkspaceSummary`/`WorkspaceRole` 의 정식 정의는 `lib/workspace/types.ts` 로 이동했지만, 기존 16개 importer 는 여전히 `lib/stores/workspace-store` 에서 이 타입들을 import 한다(re-export 로 무변경 유지). 결과적으로 "타입의 단일 진실"이 명목상 `types.ts` 이지만 실질적 소비 경로는 대부분 `workspace-store` 를 경유하는 이중 구조가 생겼다. 의도된 점진적 마이그레이션(호환성 유지)이라는 점은 커밋 메시지에도 명시돼 있어 설계 결함은 아니지만, 이 상태가 영구화되면 store 모듈이 계속 "타입 재수출 허브" 책임을 떠안게 되어 원래 목표(모듈 경계 명확화)가 절반만 달성된다.
  - 제안: plan 에 후속 항목으로 "16 importer 를 `lib/workspace/types` 직접 import 로 전환 후 store 의 re-export 제거"를 등록해 마이그레이션을 완결할 것(지금 당장 필요한 조치는 아님).

- **[INFO]** `href.ts` 가 범용(`buildWorkspaceHref`)과 도메인 특화(`buildExecutionHref`) 헬퍼를 한 파일에 혼재
  - 위치: `codebase/frontend/src/lib/workspace/href.ts`
  - 상세: 현재는 함수 2개뿐이라 문제가 되지 않지만, 이번 PR 의 동기 자체가 "리터럴이 여러 소비처에 흩어져 slug 누락 회귀가 반복"이었던 점을 고려하면, 앞으로 트리거·인테그레이션 등 다른 도메인의 경로 조립 헬퍼가 같은 패턴으로 이 파일에 추가될 가능성이 높다. 모듈 단위 SRP 관점에서 `href.ts` 가 "workspace 경로 조립 전체"를 담당하는 catch-all 이 되지 않도록 미리 방향을 잡아두는 편이 좋다.
  - 제안: 도메인별 buildXHref 가 2~3개 더 늘어나면 `lib/workspace/href/` 디렉터리로 분리(예: `href/executions.ts`)하거나, `buildWorkspaceHref` 를 코어로 하고 도메인 헬퍼들을 각 도메인 폴더(`lib/executions/href.ts` 등)에 두는 구조를 고려. 지금 당장 조치는 불필요.

- **[INFO]** `no-raw-execution-href.test.ts` 는 테스트 계층에 정적 거버넌스(lint) 책임을 부여한 관습적이지 않은 패턴
  - 위치: `codebase/frontend/src/lib/workspace/__tests__/no-raw-execution-href.test.ts`
  - 상세: "raw `/workflows/${id}/executions` 리터럴 금지"라는 코딩 컨벤션 강제를 ESLint 룰이 아니라 소스 텍스트 정규식 스캔 기반 unit 테스트로 구현했다. 커밋 메시지는 "템플릿 리터럴이 quasi 로 쪼개져 ESLint AST 매칭이 취약하다"는 근거를 명시하고 있어 트레이드오프를 인지한 의도적 선택이다. 다만 이 접근은 "동작 검증(test)"과 "코딩 표준 강제(static governance)"라는 서로 다른 책임을 하나의 테스트 파일에 결합시키며, 정규식 기반이라 변형 패턴(템플릿 리터럴이 아닌 문자열 연결 `"/workflows/" + id + "/executions"`, 혹은 다중 `${}` 삽입이 섞인 리터럴 등)에 대한 커버리지가 AST 기반 검사보다 약할 수 있다.
  - 제안: 현재 문서화된 트레이드오프를 수용하되, 이 클래스의 회귀가 이번이 처음이 아니므로(PR #865 round-3/4 에서 반복 발견) 추후 커스텀 ESLint 룰(예: 최종 조립된 문자열이 아니라 "workflowId 변수 뒤에 오는 `/executions` 접미사" 같은 완화된 패턴 매칭)로 대체/보강하는 것을 로드맵에 남겨두면 좋다. 차단 사유는 아님.

- **[INFO, 긍정적 관찰]** `safe-path.ts` 로의 정규화 단일화는 보안 관련 로직 drift 를 구조적으로 제거한 좋은 설계
  - 위치: `codebase/frontend/src/lib/workspace/safe-path.ts`, `codebase/frontend/src/lib/workspace/href.ts`, `codebase/frontend/src/components/ui/error-page.tsx`
  - 상세: 변경 전 `buildWorkspaceHref`(경로 생성)와 `isSafeRedirectPath`(리다이렉트 대상 검증)는 각자 독립적으로 open-redirect 방어 로직을 구현하고 있었고, 실제로 두 구현이 벌어져 `isSafeRedirectPath` 쪽에는 백슬래시/제어문자 우회 갭이 있었다(예: `/\evil.com` 이 과거 로직에서는 안전한 것으로 오판정됨). `toSafeInternalPath`/`isSafeInternalPath`(정규화 후 원본과의 동등성 비교) 로 단일화한 것은 "생성"과 "검증"이 같은 불변식을 공유해야 하는 보안 크로스커팅 관심사를 한 곳으로 모은 정석적인 리팩터다. 이런 유형의 로직(보안 판정)은 향후에도 두 곳에서 각자 구현되지 않도록 이 패턴을 유지할 필요가 있다.
  - 제안: 없음(모범 사례로 유지 권장).

## 요약

이번 변경은 PR #865 라운드 3/4 에서 defer 된 4가지 구조 하드닝(B-1~B-4)을 순수 FE 리팩터로 마무리한 것으로, 전반적으로 아키텍처 품질을 개선하는 방향이다. `buildExecutionHref` 는 15곳에 흩어져 있던 실행경로 리터럴 조립을 단일 헬퍼로 통합해 DRY 원칙과 향후 확장성(경로 규칙 변경 시 단일 지점 수정)을 확보했고, `safe-path.ts` 는 생성/검증 양쪽이 공유해야 하는 보안 불변식을 한 곳으로 모아 실제 존재했던 방어 비대칭(백슬래시 우회) 갭을 구조적으로 제거했다. `types.ts` 분리로 `resolve-fallback`(유틸리티) → `workspace-store`(상태 계층) 방향의 역전된 의존을 바로잡아 의존성 역전 원칙에 부합하는 단방향 DAG 를 만든 것도 타당하다. 남은 지적사항은 모두 INFO 수준으로, 16개 importer 를 위한 타입 re-export 로 인한 과도기적 이중 SoT, `href.ts` 모듈의 향후 비대화 가능성, 그리고 정적 거버넌스를 테스트로 구현한 것의 성격적 절충 정도이며 즉시 조치가 필요한 구조적 결함은 없다.

## 위험도
LOW
