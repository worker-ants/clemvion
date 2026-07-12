# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** plan 완료 노트가 실제 최종 코드와 어긋난다 (상수명 · 테스트 건수 모두 stale)
  - 위치: `plan/in-progress/eia-context-schema-followups.md` L33, "**완료(2026-07-12, PR eia-context-dev)**:" 이하 문장
  - 상세: 완료 노트는 "신규 로컬 SoT 파일 `execution-status.literal.ts`(`EXECUTION_STATUS_VALUES` as const + `ExecutionStatusLiteral` 파생)" · "`[...EXECUTION_STATUS_VALUES]` 로 swagger 배열 공유" · "DTO 스키마 회귀 15건" 이라고 적혀 있다. 그러나 실제 최종 코드(`execution-status.literal.ts`)가 export 하는 상수명은 `EIA_EXECUTION_STATUS_VALUES`(`EIA_` 접두 포함)이고, 두 DTO 도 `enum: EIA_EXECUTION_STATUS_VALUES` 로 참조한다 — `EXECUTION_STATUS_VALUES` 라는 이름의 export 는 이 파일에 존재하지 않는다. 이 접두는 같은 리포지토리의 `workflow-assistant/tools/explore-tools.service.ts` 에 이미 존재하던 순서가 다른 동명 상수와의 grep 혼동을 피하려고 사후(review 19_49_01 의 RESOLUTION.md I1)에 추가된 것인데, plan 완료 노트는 그 이전 이름을 그대로 남겨 **정확히 그 혼동을 스스로 재생산**한다. 테스트 건수도 마찬가지로 stale — 완료 노트는 "DTO 스키마 회귀 15건" 이라 적었지만, 동일 세션의 `review/code/2026/07/12/19_49_01/RESOLUTION.md` 는 "unit: PASS (DTO 스키마 회귀 21 — 기존 15 + 신규 drift 가드 6)" 이라고 기록해 WARNING 반영(신규 assertion 2건 + `interact-ack-response.dto.spec.ts` 신설 4건) 이후 수치가 21로 늘었음을 명시한다. 즉 plan 완료 노트는 ai-review 의 WARNING 수정이 반영되기 **이전** 스냅샷을 그대로 두어, 최종 커밋 상태(코드 + RESOLUTION.md)와 어긋난 서술을 담고 있다.
  - 제안: plan 완료 노트의 상수명을 `EIA_EXECUTION_STATUS_VALUES` 로, 회귀 테스트 건수를 "21(기존 15 + drift 가드/`InteractAckDto` 신규 6)" 로 갱신할 것. 이 항목은 이미 `[x]` 로 체크돼 있어 커밋될 리스크가 낮아 보이지만, 향후 이 노트를 근거로 grep/추적하는 사람이 잘못된 식별자를 찾게 된다.

- **[INFO]** 신규 SoT 파일 `execution-status.literal.ts` 의 JSDoc 품질은 모범적이며, 주장 사실을 코드 대조로 검증함
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status.literal.ts` 상단 모듈 JSDoc
  - 상세: JSDoc 은 (a) `EIA_` 접두 근거(동명 `EXECUTION_STATUS_VALUES`, `workflow-assistant/tools/explore-tools.service.ts` 와 값 순서가 다름), (b) `Literal` 접미 근거(엔티티 enum `ExecutionStatus` 이름 충돌 회피), (c) 엔티티 enum 에서 파생하지 않는 이유(레이어 결합 회피 + 순서 불일치) 세 가지를 근거와 함께 명시한다. 실제 코드로 대조한 결과 모두 정확했다 — `execution.entity.ts:14-21` 의 `ExecutionStatus` 순서는 `pending,running,completed,failed,cancelled,waiting_for_input` 로 wire 순서(`pending,running,waiting_for_input,completed,failed,cancelled`)와 실제로 다르고, `explore-tools.service.ts:42-49` 의 동명 상수도 순서가 다름(`pending,running,completed,failed,cancelled,waiting_for_input`)을 확인했다. 근거를 지어내지 않고 실측 가능한 사실만 서술한 좋은 사례.
  - 제안: 없음 (현행 유지). 위 WARNING 의 plan 노트만 이 파일의 최종 이름과 동기화하면 된다.

- **[INFO]** swagger.md §5-1 의 `*.literal.ts` 공유-SoT 패턴 문서화 후속이 plan 백로그에 등재되지 않음
  - 위치: `review/code/2026/07/12/19_49_01/RESOLUTION.md` "I5" 항목 vs `plan/in-progress/eia-context-schema-followups.md` "> **잔여 (별 slice)**" 안내문
  - 상세: RESOLUTION.md 는 "I5 (Documentation) — swagger.md §5-1 `*.literal.ts` 패턴 미문서화: 범위 밖(spec/conventions 편집=planner 트랙) — 별도 후속으로 남김(비차단)" 이라고 명시적으로 후속을 약속한다. 실제로 `spec/conventions/swagger.md` §5-1 을 확인해도 이 패턴(형제 DTO 간 enum 공유 시 `<name>.literal.ts` + `as const` + 엔티티 비파생)은 아직 문서화돼 있지 않다. 그러나 같은 plan 문서의 "잔여 (별 slice)" 목록(#3 packages harness 배선 · #4 EventSource stub dedup · #5 sdk eslint · §spec-impl-evidence 절차)에는 이 항목이 없어, "planner 트랙으로 넘긴다" 는 약속이 실제로는 어디에도 추적되지 않는 상태다.
  - 제안: `eia-context-schema-followups.md` 의 "잔여" 목록 또는 별도 plan 항목에 "swagger.md §5-1 에 `*.literal.ts` 공유 enum 패턴 명문화 (planner 트랙)" 한 줄을 추가해 후속 유실을 방지할 것. 비차단이므로 CRITICAL/WARNING 은 아니나, 이 프로젝트 관례상 "약속한 후속은 추적 가능해야 한다" 는 원칙과 어긋난다.

## 검증한 사항 (문제 없음)

- `execution-status-response.dto.spec.ts` / `interact-ack-response.dto.spec.ts` 의 신규 테스트명(예: "status.enum 은 공유 SoT 배열과 값·순서가 동일하다 (drift 가드)", "wire SoT 는 엔티티 ExecutionStatus 상태 집합과 동일하다 (순서 무관 — 엔티티↔wire drift 가드)")은 자기설명적이라 별도 주석 없이도 의도가 명확하다. `interact-ack-response.dto.spec.ts` 신규 파일 헤더 JSDoc 도 `EIA §5.1 / §5.4` 링크를 포함해 계약 SoT 를 명시한다 — 실제 spec 문서에 §5.1(인터랙션 명령 제출), §5.4(명시적 취소) 섹션이 존재함을 확인했다.
- `execution-status-response.dto.ts` / `interact-ack-response.dto.ts` 의 기존 필드 JSDoc(예: `status` 필드 위 클래스 레벨 설명, `currentStatus` 의 `description` 문구)은 이번 diff 로 인해 stale 해지지 않았다 — 변경은 타입/enum 소스만 로컬 SoT 로 치환했을 뿐 wire 의미는 그대로다.
- CHANGELOG.md 미기재는 프로젝트 관례와 부합한다. 저장소 관례상 CHANGELOG 는 wire/사용자-가시 변경만 기록하며, 이번 변경은 plan 문서·RESOLUTION.md 모두에 "런타임·OpenAPI wire 무변경(값·순서 동일)" 으로 명시된 behavior-preserving 내부 리팩터다.
- `review/code/2026/07/12/19_49_01/` 하위 파일들(SUMMARY.md·RESOLUTION.md·subagent 리포트·`_retry_state.json`·`meta.json`)은 이전 `/ai-review` 세션의 산출물이 그대로 커밋된 것으로, 저장소 관례(`review/` 는 gitignore 대상 아님, 리뷰 산출물도 커밋)와 일치한다. 이 파일들 자체의 서술(예: `documentation.md`, `maintainability.md` 의 INFO 근거)도 코드와 대조했을 때 정확했다.

## 요약

이번 변경은 두 응답 DTO(`ExecutionStatusDto.status`, `InteractAckDto.currentStatus`)가 중복 선언하던 6값 상태 리터럴을 신규 `execution-status.literal.ts` 로 통합하며, 그 JSDoc·신규 테스트명 모두 문서화 수준이 높고 실측으로 검증한 사실관계도 정확했다. 다만 `plan/in-progress/eia-context-schema-followups.md` 의 완료 노트가 ai-review WARNING 반영(상수명에 `EIA_` 접두 추가, 회귀 테스트 15→21건) 이전 스냅샷을 그대로 남겨 최종 코드·RESOLUTION.md 기록과 어긋나며, 특히 상수명 불일치는 이 변경이 애초에 막으려던 "동명 상수 grep 혼동" 을 문서 차원에서 재현한다는 점에서 반영을 권장한다. 그 외에는 RESOLUTION.md 가 명시적으로 후속으로 남긴 swagger.md §5-1 문서화 항목이 plan 백로그에 등재되지 않아 유실 위험이 있다는 점 정도만 INFO 수준으로 남는다. CHANGELOG 미기재·필드 주석 정확성 등 나머지 축은 모두 프로젝트 관례에 부합해 문제가 없다.

## 위험도

LOW
