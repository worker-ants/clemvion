# 신규 식별자 충돌 검토 — spec/2-navigation/ (--impl-done)

## 검토 범위 확인

payload 는 `spec/2-navigation/` 전체(대시보드·워크플로우 목록·인증·에러/빈 상태·실행 내역·시스템 상태 등)와 인접 문서를 배경 컨텍스트로 포함하지만, `git diff origin/main HEAD` 로 실측한 이번 단계(직전 검토 `16_49_52` 이후 신규 커밋)의 실제 변경분은 `bef267c17`(ai-review Critical/Warning 조치) 한 건이며, `spec/` 은 전혀 변경되지 않았다(변경된 것은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 체크박스뿐).

이번 커밋의 코드 diff:

- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` — `toNodeResult()` 에 `startedAt`, `inputData` 매핑 추가. `NodeResultsTab`/`ResultDetail` 호출에 `executionDryRun={execution.dryRun === true}` prop 전달 추가.
- `codebase/frontend/src/components/editor/run-results/result-detail.tsx` — `ResultDetailProps` 에 `executionDryRun?: boolean`(기본 `false`) 신규 prop 추가. 배지 조건을 `isDryRunOutput(result.outputData)` 단독에서 `(executionDryRun || isDryRunOutput(...))` 로 확장.
- 테스트 2건 추가, CHANGELOG·run-results.mdx(ko/en) 문서 갱신.

직전 단계(`16_49_52`)에서 이미 "신규 식별자 없음(순수 재사용 리팩터)"으로 NONE 판정했고, 그 이전 spec 단계(`16_27_37`)도 NONE 이었다. 이번 추가 커밋에서 새로 등장한 이름은 `executionDryRun` prop 하나뿐이다.

## 신규 식별자 점검

| 항목 | 유형 | 충돌 검토 |
|------|------|-----------|
| `executionDryRun` (prop, `ResultDetailProps` / `NodeResultsTab` 파라미터) | 신규 식별자 | `git grep -n "executionDryRun"` 전체 결과 — 이번 diff 의 두 파일(7곳) 외 사용처 없음. 기존 `dryRun`(Execution 엔티티 필드, backend `execution.dryRun`), `isDryRunOutput`(output 마커 기반 판정 함수), `__dryRun`(internal user-variable 마커, execution-engine)과 이름이 겹치지 않고 의미도 명확히 구분(execution-level vs output-level 플래그) — CRITICAL/WARNING 대상 아님 |
| `NodeResult.inputData`, `NodeResult.startedAt` | 매핑 로직 변경(필드 자체는 기존) | `execution-store.ts` 의 `NodeResult` 인터페이스에 이미 선언돼 있던 optional 필드. 이번 커밋은 `toNodeResult()` 매핑 누락을 고치는 것으로 신규 식별자 도입이 아님 |
| `startedAtEpoch` 등 인접 필드 | 미변경 | 참고용 확인, diff 대상 아님 |

요구사항 ID(`EH-DETAIL-*`, `V-05` 등), API endpoint, 이벤트/메시지명, ENV var·config key, spec 파일 경로 — 이번 diff 범위 내에서 신규로 도입된 것은 없다.

## 발견사항

발견 없음 — 이번 커밋(`bef267c17`)은 이전 커밋(`a32327074`)의 ai-review Critical/Warning 조치이며, spec 을 변경하지 않고 코드 매핑 버그 수정 + prop 1개(`executionDryRun`) 추가에 그친다. 해당 prop 은 기존 `dryRun`/`isDryRunOutput`/`__dryRun` 과 명확히 구분되는 이름과 의미를 가지며 충돌 사례가 없다.

## 요약

이번 impl-done 단계에서 실측된 변경분은 `spec/2-navigation/` 문서가 아니라, 직전 ai-review 에서 지적된 Input/startedAt 매핑 누락과 dry-run 배지 execution-level fallback 소실을 고치는 순수 코드 수정 커밋 한 건이다. 유일한 신규 식별자인 `executionDryRun` prop 은 기존 `dryRun`(Execution 엔티티)·`isDryRunOutput`(output 마커 판정 함수)·`__dryRun`(internal variable 마커)과 이름·스코프·의미가 모두 명확히 구분되어 혼선 여지가 없으며, `NodeResult.inputData`/`startedAt` 은 이미 존재하던 필드의 매핑 버그 수정일 뿐 신규 도입이 아니다. spec 문서 자체는 변경되지 않았으므로 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로 어느 관점에서도 신규 충돌 대상이 없다.

## 위험도

NONE
