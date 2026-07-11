# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 중 응답 가능했던 3개(cross_spec / convention_compliance / naming_collision) 모두 Critical 없음. 나머지 2개(rationale_continuity / plan_coherence)는 `status=success` 로 보고됐으나 output 파일이 디스크에 존재하지 않아(workflow disk-write gap) 실제 발견 내용을 읽을 수 없었다 — 이 2건은 "clean" 이 아니라 **미확인**이며 재실행이 필요하다.

## 전체 위험도
**LOW** — target diff(`responses.dto.ts` → `dto/responses/{execution-status-response,interact-ack-response,refresh-token-response}.dto.ts` 3파일 분리)는 필드·enum·오너십 변경 없는 순수 파일 재구성이며, 오히려 `swagger.md §5-1` 규약에 뒤늦게 정합화됐다. 유일한 반복 발견은 target spec §10 파일 구조 다이어그램과 `interaction-type-registry.md` SoT 각주가 삭제된 옛 파일명(`responses.dto.ts`)을 계속 인용하는 문서 drift. 단, rationale_continuity/plan_coherence 미확인으로 인해 이 LOW 평가는 3/5 checker 커버리지 기준이다.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance, naming_collision | §10 "구현 파일 구조" 다이어그램이 삭제된 `responses.dto.ts` 단일 파일을 여전히 나열, 3파일 분리를 반영하지 않음 — 이미 정정된 §5-1 규약 위반 상태를 현재 구조인 것처럼 서술 | `spec/5-system/14-external-interaction-api.md` §10 (코드블록 ~861행, `dto:` 항목) | HEAD 코드: `codebase/backend/src/modules/external-interaction/dto/responses/{execution-status-response,interact-ack-response,refresh-token-response}.dto.ts` | §10 코드블록 `dto:` 하위를 3파일 구조로 갱신 |
| 2 | cross_spec, convention_compliance, naming_collision | `interaction-type-registry.md` 의 SoT 각주가 옛 경로 `external-interaction/dto/responses.dto.ts` 를 인용 — 책임 서술(4→3 통합)은 여전히 정확하나 파일명이 stale | `spec/conventions/interaction-type-registry.md:40` | HEAD 코드: `dto/responses/execution-status-response.dto.ts` (`CurrentNodeDto`/`ExecutionStatusDto`, `interactionType` enum 실제 위치) | 인용 경로를 `external-interaction/dto/responses/execution-status-response.dto.ts` 로 갱신 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 신규 3파일 간 class 명명 접미사 불일치 — `InteractAckDto`/`ExecutionStatusDto` 는 "Response" 생략, `RefreshTokenResponseDto` 는 유지 (규약 위반 아님, 분리 이전부터 존재) | `dto/responses/*.dto.ts` | 선택사항. 소급 정정 불요, 후속 리네이밍 시 참고 |
| 2 | naming_collision | `plan/in-progress/eia-context-schema-followups.md:16` 미체크 TODO("응답 DTO 위치 정규화")가 본 diff 로 이미 완료된 것으로 보임 | `plan/in-progress/eia-context-schema-followups.md:16` | 개발자/기획자가 완료 여부 확인 후 체크박스 갱신 |
| 3 | naming_collision | `ExecutionStatusDto`(EIA) ↔ `ExecutionDto`(`executions` 모듈) 이름 근접 — 실질 충돌 없음(클래스명·모듈 모두 분리) | `dto/responses/execution-status-response.dto.ts` vs `executions` 모듈 `execution-response.dto.ts` | 조치 불요 (참고용) |
| 4 | (프로세스) rationale_continuity, plan_coherence | `status=success` 로 보고됐으나 output 파일이 디스크에 부재(workflow disk-write gap — 기존 알려진 프로젝트 패턴과 동일 증상) | `review/consistency/2026/07/11/14_53_21/{rationale_continuity,plan_coherence}.md` (파일 없음) | 두 checker 재실행 필요. 결과 확정 전까지 이 2개 관점은 "clean" 이 아닌 "미확인" 으로 취급할 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 순수 파일 재구성, 필드/enum/오너십 불변. stale 경로 인용 1건(INFO) |
| rationale_continuity | **미확인 (재시도 필요)** | status=success 이나 output 파일이 디스크에 없어 내용 확인 불가 |
| convention_compliance | LOW | swagger.md §5-1 규약에 오히려 정합화(코드는 준수). target §10 다이어그램만 stale(WARNING) |
| plan_coherence | **미확인 (재시도 필요)** | status=success 이나 output 파일이 디스크에 없어 내용 확인 불가 |
| naming_collision | LOW | 신규 식별자 충돌 없음(클래스명 전역 유일 확인). 동일 stale 경로 2건(WARNING) + plan TODO 완료 미체크(INFO) |

## 권장 조치사항

1. **(우선, 재확인 필요)** `rationale_continuity`, `plan_coherence` 두 checker 를 재실행해 output 파일이 실제로 디스크에 기록되는지 확인 후 본 요약을 갱신한다. 현재의 `status=success` 표시는 파일 부재로 신뢰할 수 없으며, 특히 rationale_continuity 는 spec `## Rationale` 섹션의 근거 연속성을 검증하는 유일한 checker라 누락 시 실제 결함(예: 이번 리팩터가 과거 Rationale 서술과 모순되는지)을 놓칠 위험이 있다.
2. `spec/5-system/14-external-interaction-api.md` §10 "구현 파일 구조" 코드블록의 `dto:` 하위를 3파일 구조로 갱신한다:
   ```
   dto/
     interact.dto.ts
     cancel.dto.ts
     responses/
       execution-status-response.dto.ts
       interact-ack-response.dto.ts
       refresh-token-response.dto.ts
     ...
   ```
3. `spec/conventions/interaction-type-registry.md:40` 의 SoT 각주 경로를 `external-interaction/dto/responses/execution-status-response.dto.ts` 로 갱신한다.
4. (선택) `plan/in-progress/eia-context-schema-followups.md:16` 의 "응답 DTO 위치 정규화" TODO 완료 여부를 확인 후 체크박스를 갱신한다.