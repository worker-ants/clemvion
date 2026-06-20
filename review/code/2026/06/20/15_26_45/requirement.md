# 요구사항(Requirement) 리뷰 — M-5 레이어1 노드 DI 전환

## 발견사항

### [INFO] `NodeComponentsModule` 이 단일 `useValue`로 `ALL_NODE_COMPONENTS` 배열 전체를 바인딩함
- 위치: `/codebase/backend/src/nodes/node-components.module.ts` L10
- 상세: `providers: [{ provide: NODE_COMPONENT, useValue: ALL_NODE_COMPONENTS }]` — 단일 provider, `useValue` 배열. 주석과 구현 일치. 빈 배열 경우(`ALL_NODE_COMPONENTS` 가 빈 경우)에도 `NodeBootstrapService.onModuleInit` 은 `sortComponents([])` → `bootstrap([], deps)` 를 호출하므로 런타임 오류 없음. 실제 배열은 7개 카테고리를 spread하므로 빈 상태는 불가.
- 제안: 이상 없음.

### [INFO] `sortComponents` — 카테고리가 `NODE_CATEGORIES`에 없는 경우 `Number.MAX_SAFE_INTEGER` fallback
- 위치: `/codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts` L16
- 상세: `categoryOrder.get(c.metadata.category) ?? Number.MAX_SAFE_INTEGER` — 미등록 카테고리(레이어3 커스텀 노드)는 알파벳 type 순 정렬된 채 마지막으로 배치된다. 이는 문서에 명시된 "미래 동적 컴포넌트도 같은 규칙" 의도와 일치하는 합리적 설계.
- 제안: 이상 없음. 레이어3 도입 시 카테고리 등록을 동기화하면 된다.

### [INFO] 정렬 키 `(order, type)` — intra-category 내 type 알파벳 정렬로 기존 선언순에서 변경
- 위치: `node-bootstrap.service.ts` `sortComponents`, plan `D-3`
- 상세: plan 문서에 "intra-category 표시 순서가 선언순→type순으로 바뀜 = 명시화; 핸들러 출력 계약·등록 집합 불변 = behavior-preserving" 이 명시됨. 실제 테스트(`node-bootstrap.service.spec.ts` 정렬 결정성 케이스)가 이 동작을 가드. 외부 계약(노드 type 식별자, 핸들러 동작)에는 영향 없음.
- 제안: 이상 없음.

### [INFO] `ALL_NODE_COMPONENTS` 이중 소비처 — 정적 소비와 DI 소비가 같은 소스에서 파생
- 위치: `/codebase/backend/src/nodes/index.ts`, `/codebase/backend/src/nodes/node-components.module.ts`
- 상세: `NodeComponentsModule`이 `ALL_NODE_COMPONENTS`를 `useValue`로 주입하고, `ALL_NODE_COMPONENTS`는 `nodes/index.ts` 에서 카테고리 배열 spread로 파생. 동일 소스 참조로 DI 카탈로그 ↔ 정적 `ALL_NODE_TYPES`/테스트 기준집합 간 drift 가 구조적으로 불가. `node-components.module.spec.ts`가 DI 주입 집합 == 정적 spread 집합을 런타임 테스트로 가드.
- 제안: 이상 없음.

### [INFO] `ALL_NODE_TYPES` 정적 소비 — DI 없이 모듈 로드 시점 평가
- 위치: `/codebase/backend/src/nodes/index.ts` L2
- 상세: `export const ALL_NODE_TYPES: readonly string[] = ALL_NODE_COMPONENTS.map(c => c.metadata.type)` — import-workflow DTO `@IsIn`, Swagger enum 등 모듈 로드 시점 소비처는 DI를 사용할 수 없으므로 정적 유지가 정확하다. plan D-2에 명시된 의도적 설계.
- 제안: 이상 없음.

### [INFO] `spec/4-nodes/0-overview.md §4` "정적 배열" 표현 — 이미 동기 반영됨
- 위치: `spec/4-nodes/0-overview.md` L57 (worktree 내 버전)
- 상세: 이전 ai-review SUMMARY W1(SPEC-DRIFT)에서 식별된 spec §1.0/§4의 "정적 배열" 표현이 커밋 `7283a216`에서 DI 표현으로 갱신 완료. 현재 worktree의 spec line 57은 `NodeComponentsModule`/`NODE_COMPONENT` DI 주입 흐름을 정확히 서술. §4(line 244)도 "빌트인은 `nodes/index.ts`의 `ALL_NODE_COMPONENTS` 정적 배열로 부팅 시 부트스트랩된다" 설명에 "런타임 플러그인/마켓플레이스 로딩 경로는 존재하지 않는다" invariant 유지됨.
- 제안: 이상 없음.

---

## 요약

M-5 레이어1 변경(정적 `ALL_NODE_COMPONENTS` import → `NODE_COMPONENT` DI 토큰 주입)은 의도한 기능을 완전히 구현하고 있다. 핵심 요구사항인 (1) `NodeComponentsModule`이 빌트인 카탈로그를 `useValue` 단일 provider로 바인딩하고, (2) `NodeBootstrapService`가 `@Inject(NODE_COMPONENT)`로 주입받아 결정적 정렬 후 `bootstrap()` 호출하며, (3) 7개 카테고리 배열(`<category>/index.ts`)이 각자의 단일 출처로 분리되고, (4) `ALL_NODE_COMPONENTS`/`ALL_NODE_TYPES` 정적 소비처는 동일 소스에서 파생되어 drift가 없는 구조 — 모두 구현되어 있다. 엣지 케이스(빈 컴포넌트 배열, 미등록 카테고리)는 합리적으로 처리된다. TODO/FIXME 없음. 함수명·주석·구현이 일치하며 (이전 ai-review W2 "multi-provider" 표현 정정도 반영). 반환값 경로 전수 정상. spec §1.0/§4 등록 메커니즘 기술도 커밋 7283a216에서 DI 서술로 동기 반영 완료. 요구사항 충족 상 별도 조치가 필요한 Critical/WARNING 발견사항 없음.

## 위험도

NONE
