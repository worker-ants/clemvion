# Cross-Spec 일관성 검토 — schedule triggerId 서버 필터 cross-page 승격

- 대상: `spec/2-navigation/3-schedule.md` §2.1 · §4 · Rationale
- 커밋: 5b52b8b96 (`git diff origin/main...HEAD`)
- 검토자 관점: 데이터 모델 / API 계약 / 요구사항 ID / 상태 전이 / RBAC / 계층 책임

## 발견사항

검토한 4개 관점 모두에서 CRITICAL/WARNING 급 충돌을 발견하지 못했습니다. 아래는 확인 결과와 낮은 수준의 관찰(INFO)입니다.

- **[INFO]** `2-trigger-list.md` §2.1 "스케줄 관리에서 편집" 항목 서술이 필터 동작을 재서술하지 않음
  - target 위치: `spec/2-navigation/3-schedule.md` §2.1(신규 서술), §4(`triggerId` 파라미터)
  - 대조 대상: `spec/2-navigation/2-trigger-list.md` §2.1 (line 61) — "Schedule 타입은 추가로 '스케줄 관리에서 편집' 항목 표시 (→ `/schedules?triggerId=…` 딥링크)"
  - 상세: trigger-list 쪽은 딥링크 URL만 언급하고, 그 딥링크가 이제 서버측 cross-page 필터로 동작한다는 사실은 서술하지 않습니다. 모순은 아니며(딥링크 목적지 동작은 3-schedule.md 가 SoT), 이번 diff 이전부터 있던 단방향 참조 패턴과 일관됩니다. 다만 향후 trigger-list 를 읽는 사람이 딥링크의 실제 동작(필터+해제 링크)까지 알려면 3-schedule.md 를 따라가야 합니다.
  - 제안: 필수 수정은 아님. 원한다면 trigger-list §2.1 항목 설명에 "(cross-page 서버 필터, 상세는 schedule §2.1)" 정도의 1구 참조를 덧붙이면 탐색성이 향상됨.

- **[INFO]** 반대 방향(`schedule → trigger`) 딥링크는 여전히 "현재 페이지 무관 — 단건 조회" 방식으로 비대칭 유지, 문서 내 정합
  - target 위치: `spec/2-navigation/3-schedule.md` Rationale "딥링크 소비의 방향별 비대칭"
  - 대조 대상: 동일 문서 내 자체 일관성, `2-trigger-list.md` §2.3
  - 상세: 이번 변경으로 두 방향의 딥링크가 모두 "cross-page 무관하게 항상 도달"이라는 결과는 같아졌지만, 구현 메커니즘(단건 조회 vs 서버 목록 필터)의 차이와 그 이유가 Rationale 에 명확히 재서술되어 있어 혼동의 소지가 없습니다. 문제 없음, 기록 목적의 확인 사항입니다.

## 점검 상세 (근거)

1. **API 계약 일치**: `codebase/backend/src/modules/schedules/dto/query-schedule.dto.ts` 의 `triggerId?: string` (`@IsUUID()`, `@IsOptional()`) 와 `schedules.service.ts findAll()` 의 `if (triggerId) qb.andWhere('t.id = :triggerId', ...)` 구현이 spec §4 서술("UUID, optional, 해당 트리거에 연결된 스케줄만 반환")과 정확히 일치. 프런트 `codebase/frontend/src/app/(main)/schedules/page.tsx`(`focusTriggerId` → 쿼리 전달, 빈 값 미전송) 도 §2.1 서술과 일치.
2. **API 규약 문서(`spec/5-system/2-api-convention.md`) 와 무충돌**: §4.2 "리소스별 추가 필터 파라미터"가 `?type=`, `?status=` 같은 리소스별 필터를 일반 패턴으로 이미 허용하고 있어 `triggerId` 신설과 모순 없음. §5.2 목록 응답 형식(페이징 `data` 배열 + `pagination` 형제)도 변경 없이 그대로 준수.
3. **data-flow/10-triggers.md 와 무충돌**: 해당 문서는 Schedule↔Trigger 동기화·발사 메커니즘(BullMQ)만 다루고 목록 API 필터 관련 서술이 없어 겹치는 영역 자체가 없음.
4. **Rationale 갱신의 자기정합성**: 舊 문구("현재 페이지에 있을 때만", "cross-page 포커스는… 후속") 는 diff 로 완전히 대체되었고, grep 결과 문서 내 잔존 문구 없음. §2.1·§4·Rationale 세 곳 모두 "서버 필터 + cross-page" 로 통일.
5. **요구사항 ID·RBAC**: 이번 변경은 신규 요구사항 ID(R-xx, WH-xx 등)를 도입하지 않으며, 권한 모델(editor/viewer 등)에도 영향 없음 — 충돌 대상 없음.

## 요약

target 변경(`3-schedule.md` §2.1/§4/Rationale)은 실제 백엔드(`QueryScheduleDto`, `SchedulesService.findAll`)·프런트엔드 구현과 정확히 일치하며, API 규약(`5-system/2-api-convention.md`)의 기존 "리소스별 필터" 패턴과 정합합니다. `data-flow/10-triggers.md` 와는 다루는 영역이 겹치지 않아 충돌이 없고, 이전에 존재하던 "현재 페이지 한정" 서술은 세 곳 모두 일관되게 교체되어 잔존 모순이 없습니다. `2-trigger-list.md` 쪽은 필터 동작을 재서술하지 않지만 이는 단방향 참조 구조상 자연스러우며 모순이 아닌 INFO 수준의 탐색성 개선 여지입니다.

## 위험도

NONE — Critical 없음. 결과: **통과** (BLOCK 아님).
