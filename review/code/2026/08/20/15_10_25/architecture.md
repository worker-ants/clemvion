STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 코드 리뷰 — eia-inputdata-marker-guard (15_10_25)

## 검토 방법

프롬프트가 크기 제한으로 일부 파일(`executions.service.ts`, `rerun-modal.tsx`, `editor-toolbar.tsx` 등)의 diff 를 생략했으므로, 해당 파일을 워크트리에서 직접 `Read`/`grep` 으로 열어 현재 상태를 확인했다. 이번 changeset 은 직전 두 라운드(`14_08_45`, `14_44_08`)의 RESOLUTION 이 반영된 누적 상태이므로, (1) 그 두 라운드의 CRITICAL/WARNING 이 실제로 해소됐는지 재검증하고 (2) 그 위에서 새로 관찰되는 구조적 이슈를 찾는 순서로 진행했다.

## 이전 라운드 CRITICAL/WARNING 재검증 (참고, 발견사항 아님)

- `ExecutionDto.inputData` Swagger JSDoc (`14_08_45` CRITICAL 1): `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` 주제문이 현재형("값-패턴 마스킹 대상이다")으로 재작성되고 옛 서술은 `> 2026-08-20 이전에는 ...` blockquote 로 이동 — 해소 확인.
- `background-runs.service.ts`/`executions.service.ts` 의 비문(주어-서술어 불일치) (`14_08_45` WARNING): 두 파일 모두 완전한 문장으로 재작성됨 — 해소 확인.
- `rerun-modal.tsx` boolean 필드 타입 재조정이 마스킹 차단을 조용히 푸는 결합 (`14_08_45` WARNING, `14_44_08` WARNING 2 로 재발): 현재 `blockedByMaskedInput` 은 `!touchedMaskedKeys.has(k) || hasMaskedMarkerLeaf(paramValues[k])` 두 조건의 OR — "터치 안 됨" 조건이 재조정 이펙트(터치 집합을 건드리지 않음)로는 절대 풀리지 않고, "값에 마커가 남아 있음" 조건이 재터치 후 재오염을 잡는다. 두 우회 경로 모두 코드 경로를 직접 추적해 막혀 있음을 확인 — 해소 확인.
- `MASKED_INPUT_DATA_REASON` 앵커 잔존 여부: `grep -rn "MASKED_INPUT_DATA_REASON" codebase/` 0건 — 전수 삭제 확인.

## 발견사항

- **[INFO]** egress 마스킹 관문이 backend 4개 호출부에 여전히 분산돼 있다 (기존 추적 항목, 재확인)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1009-1011`(`toExecutionDto`), `:1074-1076`(`toResponseExecution`), `:695-703`(노드 레벨 `maskIfPresent` 루프) / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:305-306`
  - 상세: `toResponseExecution` 바로 위 JSDoc(`executions.service.ts:1028-1063` 부근)이 스스로 "마스킹을 호출부마다 손으로 걸면 한 곳씩 빠진다 — 이 저장소의 반복 실패 형태다" 라고 명시하며 6개 표면 표를 "정본"으로 못박고 있다. 이번 diff 는 그 패턴을 정확히 따라 4곳을 전부 고쳤고(자체로는 옳음), `Execution.inputData` 를 넣는 이번 전환도 무사히 완료됐다. 다만 근본 구조(컴파일러가 강제하는 단일 게이트가 아니라 사람이 읽는 주석 표가 유일한 동기화 장치)는 그대로 남아 있다 — 실제로 바로 이 fragmentation 이 `14_08_45` 라운드에서 자매 DTO JSDoc 누락 CRITICAL 을 낸 원인이었다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "마스킹 게이트 4곳을 단일 헬퍼로 통합" 항목(2026-08-20 등재, `14_44_08` W4)으로 이미 트래커에 등재돼 있어 이번 PR 을 막을 사안은 아니다.
  - 제안: (이미 등재됨) `redactExecutionFields(row)` 공유 헬퍼 또는 응답 직전 interceptor 로 통합하는 후속 리팩터를 진행할 것.

- **[INFO]** frontend `MASKED_MARKERS` 는 backend 상수의 손-복제 미러이며, 컴파일 타임/CI 타임 계약이 없다 (기존 추적 항목, 재확인)
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:18-22` vs `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`
  - 상세: 이번 승격(컴포넌트 내부 → `lib/utils/`)으로 소비처는 셋으로 늘었지만, "SoT 는 backend" 라는 관계 자체는 여전히 사람이 읽는 주석과 이름 일치(`MASKED_MARKERS`/`isMaskedMarker`)에만 의존한다. `codebase/frontend`(Next.js CSR)와 `codebase/backend`(NestJS)가 빌드/번들이 분리돼 직접 import 가 불가하다는 제약은 타당하지만, 두 상수가 어긋나면 프런트 가드가 새 마커 종류를 못 알아채고 조용히 fail-open 한다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:335` 의 "마커 미러 계약 테스트" 항목으로 이미 추적 중.
  - 제안: (이미 등재됨) 두 상수 배열을 e2e/빌드 스크립트에서 문자열로 추출해 대조하는 계약 테스트 신설.

- **[INFO]** `rerun-modal.tsx` 에 마스킹-차단 도메인 로직(판별+상태 추적+파생 게이트)이 프레젠테이션 컴포넌트 안에 직접 조립돼 있다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:116-138`(`splitMaskedParameters`), `:228-231`(`touchedMaskedKeys` state), `:299-304`(`setParam` 의 touched 갱신), `:329-349`(`blockedByMaskedInput` 파생값)
  - 상세: 이번 라운드에서 두 조건(터치 여부 + 현재 마커 leaf 여부)의 AND 로직이 확정되면서, "마스킹 차단" 은 이제 단일 판별 함수 호출이 아니라 컴포넌트 로컬 상태(`touchedMaskedKeys`)와 파생 계산이 얽힌 작은 상태 기계가 됐다. `masked-markers.ts` 로 승격된 것은 순수 판별 프리미티브(`isMaskedMarker`/`hasMaskedMarkerLeaf`)뿐이고, 이 "차단 정책"(터치-추적을 포함한 상태 기계)은 `rerun-modal.tsx` 컴포넌트 함수 본문에 그대로 남아 재사용 불가능한 형태다. `14_44_08` 라운드가 이미 "정책은 소비처마다 독립 구현"을 INFO 로 지적했는데, 이번 라운드의 이중-조건 강화로 그 정책의 상태 복잡도(순수 판별 → 상태+파생값)가 한 단계 더 올라갔다. 세 UX 가 실제로 다르므로 지금 강제 통합할 필요는 없지만, 이 컴포넌트가 이미 워크플로 노드 쿼리·dry-run 계산·필드 도출·타입 coercion 까지 함께 떠안고 있어 책임이 계속 누적되는 방향이다.
  - 제안: 필수는 아님. 다음 소비처가 생기거나 이 컴포넌트가 더 커질 때, `splitMaskedParameters` + `touchedMaskedKeys` + `blockedByMaskedInput` 삼각을 `useMaskedParamGuard(original, useOriginalInput)` 같은 커스텀 훅으로 추출해 컴포넌트에서 상태 기계를 분리하는 것을 검토.

## 요약

이 PR 의 핵심 아키텍처 결정 — `Execution.inputData` egress 마스킹 카브아웃 폐지, 마커 판별 프리미티브를 `dynamic-form-ui.tsx` 에서 `lib/utils/masked-markers.ts` 로 승격 — 은 방향이 옳고, 이번 최종 상태에서 순환 의존·레이어 위반은 발견되지 않았다(승격된 유틸은 순수 함수이며 컴포넌트 3곳이 단방향으로 import). 직전 두 라운드가 지적한 CRITICAL(Swagger JSDoc 방치)·WARNING(비문 잔존, boolean coercion 을 통한 마스킹 차단 우회)은 코드를 직접 추적해 모두 실제로 해소됐음을 확인했다 — 특히 `blockedByMaskedInput` 이 "터치 여부"와 "현재 값의 마커 leaf 여부"를 AND 로 요구하도록 확정되면서 이전 두 라운드가 각각 발견한 두 개의 독립적 우회 경로가 동시에 막혔다. `ResponseExecution`/`ResponseNodeExecution` 타입이 마스킹 후 `null` 가능성을 명시적으로 좁혀 "자매 표면 누락" 결함 클래스를 컴파일 타임에 잡도록 설계한 것도(과거 `nest build` 가 실제로 잡은 전례가 JSDoc 에 남아 있음) 이 저장소의 반복 실패 패턴에 대한 견고한 구조적 대응이다. 남은 관찰은 전부 이미 트래커에 등재됐거나(마스킹 게이트 4곳 fragmentation, 프런트-백엔드 마커 상수 손-복제) 강제 조치가 필요 없는 확장성 관찰(rerun-modal 의 차단 정책 상태 기계를 훅으로 분리할 여지)뿐이며, 이번 changeset 을 막을 사안은 없다.

## 위험도

LOW
