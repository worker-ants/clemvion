# 변경 범위(Scope) 리뷰 결과

**리뷰 대상**: Cafe24 조건부 필수(`constraints`) backend 구현 (Phase B)
**리뷰 기준**: `plan/complete/cafe24-conditional-required-impl.md` §1–§4 의 선언된 작업 범위

---

## 발견사항

### [INFO] `buildToolDescription` / `constraintToSuffixLine` 함수의 public export
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (라인 278, 296)
- 상세: 두 헬퍼 함수가 `export function` 으로 선언됐다. plan §4 에서는 "description suffix builder" 를 `buildTools()` 안에서 사용한다고만 명시했고 public export 여부는 언급이 없다. 현재 이 export 가 테스트 파일(`cafe24-mcp-tool-provider.spec.ts`) 에서 직접 import 되지는 않고 integration test(buildTools 결과 검증) 를 통해 간접 검증되므로, 불필요한 API surface 확장으로 볼 수 있다. 다만 export 를 유지하면 단위 테스트 작성이 쉬워지는 장점이 있어 실용적 trade-off 범주다.
- 제안: 현재 spec 이 구현 세부 사항까지 지정하지 않으므로 BLOCK 사유는 아님. 필요 없다면 internal 함수로 변경을 검토할 수 있다.

### [INFO] `cafe24.handler.spec.ts` 테스트 케이스 수가 plan 과 일부 차이
- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.spec.ts`
- 상세: plan §3 은 "3종 kind × (위반/만족) 6개 케이스 추가"를 기술하지만, diff 에서는 `oneOf` 위반/만족 2건만 확인된다. `allOrNone` 과 `implies` 의 handler 단위 케이스는 diff 에 보이지 않는다. 그러나 `constraint-validator.spec.ts` (파일 5)에서 3종 모두를 exhaustive 하게 단위 테스트하므로, handler level 에서는 통합 smoke 만 두고 세밀한 variant 는 validator 레이어에 위임하는 전략적 결정으로 해석된다. 기능 커버리지 관점에서 공백은 없다.
- 제안: plan §3 의 "6개 케이스" 기술과 실제 구현(2케이스 + validator 전담) 간 의도가 명확하면 무시 가능. 향후 plan 문서 서술을 실제 구조에 맞게 정정하면 혼선이 줄어든다.

### [INFO] `spec/conventions/cafe24-api-metadata.md` 는 git diff 에 포함되지 않음
- 위치: `spec/conventions/cafe24-api-metadata.md`
- 상세: git status 기준으로 이 파일이 변경(`M`) 상태이지만 이번 코드 리뷰 payload 에는 포함되지 않았다. spec 변경은 project-planner 권한 영역이며, 본 PR 은 developer 가 구현한 Phase B이므로 spec 파일 변경이 이 PR 에 함께 포함됐다면 역할 분리 원칙(spec/ write = project-planner)을 확인할 필요가 있다. 다만 consistency-check 세션 기록(`review/consistency/2026/05/22/12_43_01/`, `14_22_18/`) 을 보면 spec 갱신이 Phase A 로 먼저 이루어졌고 Phase B 가 그 위에서 구현된 순서이므로, 이 파일이 Phase A spec 커밋의 흔적일 가능성이 있다.
- 제안: `git status` 의 staged/unstaged 상태를 확인해 Phase A spec 갱신의 미커밋 잔여분인지, 아니면 Phase B 에서 추가된 수정인지 구분한다. Phase B 범위에서 spec 을 직접 수정했다면 developer 역할 쓰기 권한 범위(codebase/** 전용) 위반 여부를 검토해야 한다.

---

## 요약

이번 변경은 `plan/complete/cafe24-conditional-required-impl.md` §1–§4 에 정의된 4개 구현 항목(Type 정의, invariant 테스트, handler runtime 검증, MCP provider 검증+schema변환)에 정확히 대응한다. 새 파일 생성(`constraint-validator.ts`, `.spec.ts`), 기존 파일 수정(`types.ts`, `index.ts`, `customer.ts`, `cafe24.handler.ts`, `cafe24-mcp-tool-provider.ts`), plan/review 산출물 추가 모두 선언된 작업 범위 안에 있다. 의도와 무관한 리팩토링, 포맷팅 전용 수정, 불필요한 임포트 변경, 무관한 설정 파일 변경은 발견되지 않았다. `buildToolDescription`/`constraintToSuffixLine` 의 public export 와 handler 테스트 케이스 수의 plan 기술 차이는 INFO 등급 관찰 사항이며 기능 정합성에 영향을 주지 않는다. `spec/conventions/cafe24-api-metadata.md` 변경 포함 여부와 역할 분리 원칙 적합성만 별도 확인이 권장된다.

---

## 위험도

LOW
