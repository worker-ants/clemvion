# Plan 정합성 검토 — spec/5-system (impl-done)

## 범위와 방법

`spec/5-system` scope 델타는 0(코드 전용 PR). 실제 diff 는 `execution-response.dto.ts`
(`ExecutionDto` 10필드) · `execution-status-response.dto.ts`(`ExecutionStatusDto` 5필드) ·
그 스펙 테스트 3개 파일, `@ApiPropertyOptional` → `@ApiProperty({nullable:true})` 전환(§5.4
"상시 존재" 필드의 required 축 정정)이다. 이 diff 가 `plan/in-progress/**` 의 미해결 결정·
선행 조건·후속 항목과 정합한지 아래 세 관점으로 확인했다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 모두 해당 사항 없음.

### 확인한 근거

1. **미해결 결정과의 충돌 없음.** `plan/in-progress/spec-draft-nullable-notation-followups.md`
   가 이 diff 의 1차 SoT다. 이 plan 은 §5.4 DTO 선언 규칙(상시 존재 필드 →
   `@ApiProperty({nullable:true})` + non-optional)을 이미 확정했고(`--spec` 09_34_59 반영,
   BLOCK:NO), "§5.4 drift 배치 — 1단계: tsc 가 검증하는 15곳"을 `ExecutionDto 10 ·
   ExecutionStatusDto 5` 로 명시했다. 현재 diff 의 필드 수(10+5=15)가 그 서술과 정확히
   일치한다. 같은 브랜치 커밋 이력(`499675277` → `441761478`)을 보면 최초 83곳을 뒤집었다가
   리뷰 WARNING(tsc 도달성 15/83)으로 68곳을 되돌려 15곳만 남겼고, plan 문서의 "1단계 완료"
   체크박스도 그 정정된 수치(15)로 기록돼 있어 plan 과 코드가 어긋나지 않는다.
2. **선행 plan 미해소 없음.** 이 diff 가 전제하는 §5.4 스코프 문구("응답 바디 한정")·§2.2
   `/api/auth/*` 예외 성문화는 `spec-draft-scope-and-anchor-drift.md`/
   `spec-draft-nullable-notation-followups.md` 가 이미 spec 본문에 반영했음을
   `spec/5-system/2-api-convention.md` §2.2·§5.4 본문에서 직접 확인했다(자원 액션 예외 행,
   응답 바디 한정 스코프 문단 모두 존재). `spec-draft-scope-and-anchor-drift.md` 의 "자매 plan
   동기화" 표가 요구한 대로 `spec-draft-nullable-notation-followups.md` 의 해당 체크박스
   (①②③)도 닫혀 있다.
3. **후속 항목 누락 없음.** 이 diff 가 의도적으로 남긴 범위(패스스루 응답 DTO 68곳·
   `QueryExecutionDto.workflowId` 죽은 필드·`idx_schedule_next_run` DROP 후보)는 모두
   `spec-draft-nullable-notation-followups.md` `## 후속` 섹션에 미해결(`[ ]`) 항목으로 이미
   등재돼 있어 다음 PR 이 그대로 집을 수 있다. `ExecutionDto`/`ExecutionStatusDto` 를
   참조하는 다른 in-progress plan(`eia-context-schema-followups.md`,
   `spec-sync-external-interaction-api-gaps.md`)의 관련 항목은 모두 이미 `[x]` 종결 상태이며,
   이번 diff 의 required 축 변경과 충돌하는 서술이 없다. `pending_plans: spec-sync-auth-gaps.md`
   (target `1-auth.md` 프론트매터)도 `ipWhitelist`/`invitedBy`/nullable/`ApiPropertyOptional`
   키워드가 전혀 없어 이번 diff 와 교차하지 않는다.

## 요약

이번 diff 는 `spec-draft-nullable-notation-followups.md` 가 확정한 §5.4 DTO 선언 규칙을
그 plan 이 스스로 좁힌 범위(tsc 가 실제로 검사하는 15곳)에 정확히 맞춰 적용했고, 남은 더 넓은
작업(2단계 68곳 등)은 같은 plan 문서에 미해결 항목으로 명시돼 있어 유실되지 않는다. 관련
in-progress plan 들을 전수 대조한 결과 이 diff 가 우회하는 미해결 결정, 무시된 선행조건,
누락된 후속 항목을 찾지 못했다.

## 위험도

NONE
