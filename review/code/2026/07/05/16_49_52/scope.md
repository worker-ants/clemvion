# 변경 범위(Scope) 리뷰 — execution-detail-node-subtabs (V-05)

## 발견사항

- **[INFO]** `NodeResultsTab` 내부에 로컬로 구현돼 있던 상당량의 코드(JsonViewer, 4개 로컬 탭 상태, waiting 핸들러 6종, isPresentation/isCompletedConversation 판별 로직, 서브탭 렌더 분기 전체)가 삭제되고 `ResultDetail` 컴포넌트 호출 한 줄로 대체됨
  - 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` (diff 전체)
  - 상세: 순수 리팩토링(컴포넌트 추출/재사용)처럼 보이지만, 실은 plan에 명시된 목표(V-05: preview/input/output/error 4탭 → 에디터 ResultDetail 의 Preview/Input/Output/Config/LLM Usage/Response/Request/References/Error 전체 서브탭 통일) 그 자체다. `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 및 impl-prep consistency-check(`review/consistency/2026/07/05/16_27_37/`)가 사전에 이 방향을 승인했고, 삭제된 코드(JsonViewer·개별 waiting 핸들러 등)는 모두 ResultDetail 내부로 흡수되는 기능이라 "의도하지 않은 대규모 삭제"가 아니라 "재사용을 통한 대체"로 판단된다. 범위 이탈은 아니나 diff 크기가 크므로 리뷰어가 오인하기 쉬워 기록.
  - 제안: 조치 불필요. 다만 PR 설명/커밋 메시지에 "리팩토링이 아니라 컴포넌트 재사용을 통한 기능 확장(V-05)"임을 명시해 향후 blame 조회 시 오인 방지를 권장.

- **[INFO]** `executionDryRun` prop 과 `DetailTab` 타입, `JsonViewer` 헬퍼 등 로컬 전용 코드 제거
  - 위치: `page.tsx` L83-88(`executionDryRun` prop 제거), L95(`DetailTab` 타입 제거), L69-78(`JsonViewer` 제거)
  - 상세: 모두 `ResultDetail`이 자체적으로 처리하는 책임(dry-run 배지는 `isDryRunOutput`/executionDryRun 결합 로직이 내부화, JSON 뷰어도 내부 렌더러가 대체)이라 의도된 범위 내 정리다. 새 기능이 아닌 중복 제거.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 파일에 `makeCompletedExecution` 헬퍼 및 2개 신규 테스트 케이스 추가
  - 위치: `codebase/frontend/.../__tests__/execution-detail-waiting.test.tsx` L86-1132(헬퍼), L1451-1473(테스트 2건)
  - 상세: V-05 구현(Config/LLM Usage 탭 노출) 검증을 위한 테스트로 변경 의도와 직접 대응. 범위 이탈 없음. 기존 테스트(waiting form/buttons/conversation)는 무변경으로 회귀 보호 유지.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 에서 V-05 체크박스를 `[ ]`→`[x]`로 갱신하고 완료 서술 추가
  - 위치: L33-1534 부근(중복 diff, 동일 plan 파일 내 두 섹션)
  - 상세: 프로젝트 규약상 "plan 체크박스 = 실제 상태" 갱신 의무를 준수한 것으로, 코드 변경과 결합된 정상적인 부수 변경(scope creep 아님). `spec 변경 불요` 명시도 정확 — 실제로 spec 파일 자체는 diff 대상에 없음.
  - 제안: 조치 불필요.

- **[INFO]** `review/consistency/2026/07/05/16_27_37/**` (SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md) 신규 파일 8건 포함
  - 위치: 파일 4~11
  - 상세: `developer` SKILL 이 규정한 "구현 착수 직전 `consistency-check --impl-prep` 의무"의 표준 산출물이다. 코드 변경이 아니라 프로세스 게이트 기록이며, 저장 위치(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)도 CLAUDE.md 규약과 일치한다. 이 자체가 "무관한 파일 수정"으로 보일 수 있으나 실제로는 이번 PR의 필수 선행 단계 산출물이므로 범위 내로 판단.
  - 제안: 조치 불필요.

- **[INFO]** cross_spec 체커가 WARNING으로 지적한 "기본 탭 선택 우선순위의 AI multi-turn retryable-error 예외·자동 폴백 규칙" 로직은 이번 diff에서 별도로 재구현되지 않고 `ResultDetail` 전체 위임으로 자동 상속됨
  - 위치: `page.tsx` 최종 `<ResultDetail .../>` 호출부
  - 상세: consistency-check 산출물(cross_spec.md, SUMMARY.md)이 "재구현 금지, ResultDetail 재사용으로 자동 상속"을 구현 방침으로 명시했고, 실제 diff도 그 방침을 정확히 따라 로컬 default-tab 로직(`detailTabs`, `nodeDetailTab` 우선순위 계산)을 완전히 제거했다. 방침과 구현이 일치하며 별도의 임의 로직 추가는 없음.
  - 제안: 조치 불필요.

## 요약

핵심 코드 변경(`page.tsx`, 테스트 파일)은 사전에 plan(`spec-code-cross-audit-2026-06-10.md` V-05)과 impl-prep consistency-check로 승인된 단일 목표 — "실행 상세 페이지의 로컬 노드 상세 패널을 에디터 `ResultDetail` 컴포넌트 재사용으로 교체" — 에 정확히 대응한다. diff 규모(다수 삭제 + 소수 삽입)는 로컬 구현을 통째로 컴포넌트 재사용으로 치환한 데서 오는 자연스러운 결과이지 무관한 리팩토링·기능 확장·포맷팅 혼입이 아니다. 함께 포함된 plan 체크박스 갱신과 consistency-check 산출물 8종은 프로젝트가 상시 의무화한 프로세스 부산물로, 이번 변경 의도와 직접 연결되며 무관한 수정으로 보기 어렵다. import 정리(`isDryRunOutput` 등 제거, `ResultDetail` 단일 import 추가)도 삭제된 로컬 코드에 대응하는 정당한 정리다. 범위 이탈, 불필요한 리팩토링, over-engineering, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트 변경은 발견되지 않았다.

## 위험도

NONE
