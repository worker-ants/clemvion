# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** `review/consistency/` 산출물이 기능 커밋에 포함됨
  - 위치: `review/consistency/2026/05/16/13_37_23/_prompts/convention_compliance.md` (파일 8)
  - 상세: 이 파일은 사전 일관성 검토(`/consistency-check --impl-prep`)의 orchestrator 생성 prompt 파일이다. `review/**` 하위 산출물은 리뷰 세션 시점의 스냅샷 기록이므로 기능 구현 커밋과 동일 커밋에 포함되어서는 안 된다. 이 커밋의 의도(`feat(cafe24): connection test now pings ...`)와 무관한 파일 영역이다.
  - 제안: 해당 파일은 consistency-check 세션 시작 시점 혹은 별도 커밋으로 분리해 커밋하는 것이 바람직하다. 기능 PR 에 섞이면 기능 diff 가 오염되어 리뷰 가독성이 저하된다.

- **[INFO]** `plan/in-progress/cafe24-test-connection.md` 체크리스트 미완 항목 포함
  - 위치: `plan/in-progress/cafe24-test-connection.md` 라인 993-997
  - 상세: `- [ ] 테스트 선작성`, `- [ ] 구현 ...`, `- [ ] TEST WORKFLOW`, `- [ ] REVIEW WORKFLOW`, `- [ ] spec 갱신 위임 노트 분리` 항목들이 미체크(`[ ]`) 상태인 채로 커밋에 포함되어 있다. 이는 plan 문서의 진행 상태가 코드와 정합하지 않는 신호다. 코드는 구현·테스트까지 완료된 것처럼 보이는데 체크리스트는 아직 미완으로 표시되어 있다.
  - 제안: 커밋 시점에 완료된 항목은 `[x]` 로 갱신하여 plan 문서가 실제 진행 상태를 반영하도록 한다.

- **[INFO]** `EntityAwareTester` 타입을 `export` 로 공개
  - 위치: `backend/src/modules/integrations/integrations.service.ts` 라인 165-167
  - 상세: `EntityAwareTester` 타입을 `export` 로 선언하여 모듈 외부에서 사용 가능하게 했다. `Cafe24Module.onModuleInit` 에서 인라인 람다로 등록하므로 현재 외부 소비자가 없다. 기능 요건(registerEntityTester 등록)만 놓고 보면 내부 타입으로 유지해도 충분하다. 단, 향후 다른 모듈이 동일 패턴으로 entity-aware tester 를 등록할 경우를 대비한 의도적 설계로 볼 수 있으므로 심각도는 낮다.
  - 제안: 현재 PR 에 외부 소비자가 없다면 `export` 를 제거하거나, 주석에 확장 의도를 명시하여 과잉 설계인지 아닌지를 명확히 한다.

- **[INFO]** `rawPing` · `formatAuthFailure` 가 `private` 메서드로 추가됨 — 범위 내 헬퍼
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 라인 728-771
  - 상세: `pingConnection` 의 구현을 지원하는 헬퍼 메서드들이다. 이 기능의 구현에 필요한 추가이며 불필요한 리팩토링으로 볼 수 없다. 범위 내 변경으로 판단한다.
  - 제안: 변경 불필요.

## 요약

이번 변경은 `feat(cafe24): connection test now pings GET /api/v2/admin/apps with 401-refresh-retry` 라는 단일 기능을 구현하기 위해 필요한 코드(pingConnection, registerEntityTester, onModuleInit 등록, 단위 테스트)와 plan 문서 2건으로 구성되어 있으며, 전반적으로 요청 범위에 충실하다. 다만 review/consistency 세션의 orchestrator prompt 파일(`_prompts/convention_compliance.md`)이 기능 커밋에 묶여 들어간 것이 가장 눈에 띄는 범위 일탈로, review artifact 와 기능 구현의 경계를 흐린다. plan 체크리스트의 미체크 항목이 구현 완료 코드와 함께 커밋된 것도 plan 문서의 정합성을 떨어뜨린다. 코드 구조 변경(새 타입 export 포함)은 모두 기능에 직결된 최소한의 변경 범위 안에 있다.

## 위험도

LOW
