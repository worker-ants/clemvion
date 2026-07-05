# Cross-Spec 일관성 검토 — V-10 트리거 목록 Cron·다음 실행 시각 배치 조회

## 검토 대상

- Target: `spec/2-navigation/2-trigger-list.md` (§1 목업, §2.1 트리거 목록 항목, §2.3.1 필드 권한 매트릭스)
- 구현 예정: `triggers.service.ts findAll()` 에 `scheduleRepository.find({ triggerId: In(...) })` 배치 조회로 schedule 타입 행에 `{cronExpression, timezone, nextRunAt}` 을 enrich (기존 `findOneDetail()` 단건 enrichment 패턴 이식)
- 근거: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-10 (목록 §2.1 목업이 이미 Cron·Next 표시를 약속하는데 `findAll()` 이 미충족 — "코드 구현" 옵션 권장 기록)

## 발견사항

- **[INFO]** `TriggerDto` 필드 주석 "단건 조회 시에만 채워짐" 이 구현 후 stale 예정
  - target 위치: (target spec 자체 아님) `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:45,49,53`
  - 충돌 대상: 없음 — 코드 주석 vs 코드 동작의 self-consistency 이슈. `@ApiOkPaginatedResponse(TriggerDto, ...)` 가 목록 응답에도 같은 `TriggerDto` 클래스를 재사용하므로, 세 필드(`cronExpression`/`timezone`/`nextRunAt`) 주석의 "schedule 타입 트리거 **단건 조회 시에만** 채워짐" 문구가 구현 이후 부정확해진다.
  - 상세: spec 문서 자체에는 이 문구가 없으나, Swagger 스키마 설명이 API 소비자(프론트/외부 통합)에게 잘못된 기대를 심을 수 있다. cross-spec 충돌은 아니고 코드-문서 정합 항목이라 CRITICAL/WARNING 이 아닌 INFO.
  - 제안: V-10 구현 PR 에 `trigger-response.dto.ts` 세 필드 주석을 "schedule 타입 트리거에만 채워짐 (목록·단건 조회 공통)" 등으로 함께 갱신. target spec 문서 자체는 수정 불필요(이미 §2.1/§1 이 목록 표시를 명시).

- **[INFO]** `spec/2-navigation/2-trigger-list.md` §3 (API 표)에 목록 enrichment 명시 부재
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 (`GET /api/triggers` 행)
  - 충돌 대상: 없음 (동일 문서 내 §2.1과 §3의 상세도 격차)
  - 상세: §2.1 은 "Schedule 태그 | Schedule 유형 트리거에 `[Schedule]` 태그 표시 + Cron 표현식 + 다음 실행 시각" 이라고 화면 요소로는 이미 명시하지만, §3 API 표는 `GET /api/triggers` 설명에 이 enrichment 를 언급하지 않는다(§2.3.1 은 반대로 "sweep 시점에 갱신"이라는 read-only 시스템 계산 설명만 있고 목록 vs 단건 응답 범위를 구분하지 않음). 모순은 아니나 구현 후 "목록 응답도 schedule 조인 결과를 포함한다"는 사실을 §3 표에 한 줄 보강하면 API 계약 문서로서 완전해진다.
  - 제안: target 구현 시 §3 `GET /api/triggers` 행에 "schedule 타입 행은 `cronExpression`/`timezone`/`nextRunAt` 을 배치 조회로 동봉" 문구 추가 권장 (선택 사항, 필수 아님).

## 검토하지 않아도 되는 이유가 확인된 항목 (참고용, 발견사항 아님)

- **api-convention §5.2 목록 응답 포맷**: target 변경은 목록 아이템의 필드 구성만 확장하고 `{data: [...], pagination: {...}}` wrapper 구조·top-level 형제 관계는 그대로 유지 — 충돌 없음.
- **data-model §2.9.1 Trigger↔Schedule 동기화 규칙**: 목록 조회는 read-path 이고 동기화 규칙은 write-path(생성/수정/삭제) 상태 전이를 다루므로 무관 — 충돌 없음.
- **§2.3.1 필드 권한 매트릭스의 `nextRunAt: read-only (시스템 계산)`**: 목록에 같은 필드가 나타나도 편집 가능 여부·계산 주체는 동일(둘 다 read-only, sweep 계산) — 상태·권한 모순 없음.
- **RBAC**: 목록 조회는 모든 역할(viewer 포함)에 열려 있고 추가되는 필드도 read-only 시스템 계산값이라 신규 권한 분기 불요 — 충돌 없음.
- **요구사항 ID 충돌**: "V-10" 은 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 내부의 감사 항목 로컬 식별자이며, `spec/**` 어디에서도 다른 의미의 요구사항 ID로 재사용되지 않음(grep 결과 0건) — ID 충돌 없음.
- **프론트엔드 소비 코드 선행 확인**: `codebase/frontend/src/app/(main)/triggers/page.tsx:215-216` 이 이미 목록 응답에서 `cronExpression`/`nextRunAt` 을 매핑하는 코드를 갖고 있음(현재는 백엔드 미채움으로 `undefined`) — 프론트-백엔드 계약이 이미 그 방향으로 정렬되어 있어 target 구현이 오히려 기존 계약 공백을 메우는 방향.

## 요약

target(V-10: 트리거 목록 `findAll()` 에 schedule 배치 조인으로 `cronExpression`/`timezone`/`nextRunAt` 채우기)은 data-model Trigger/Schedule 정의, `2-navigation/1-data-model.md §2.9.1` 동기화 규칙, api-convention §5.2 목록 응답 포맷, RBAC 모델 어느 것과도 직접 모순되지 않는다. `findOneDetail()` 의 기존 단건 enrichment 패턴을 그대로 목록에 확장하는 구조적으로 대칭적인 변경이며, 프론트엔드는 이미 이 필드를 소비하도록 작성돼 있어 오히려 오랜 계약 공백(스펙 §2.1 목업 vs 실제 `findAll()` 미구현)을 메운다. 유일하게 남는 항목은 cross-spec 충돌이 아니라 코드 주석(`TriggerDto` 필드 doc-comment)의 "단건 조회 전용" 문구가 구현 후 stale해진다는 INFO 수준 동반 갱신 필요성뿐이다.

## 위험도

NONE
