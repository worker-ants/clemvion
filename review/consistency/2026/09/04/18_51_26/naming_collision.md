# 신규 식별자 충돌 검토 — spec/2-navigation (impl-done)

## 검토 범위 확인

- `git diff --stat origin/main...HEAD -- spec/2-navigation/` → **빈 결과 (0개 파일)**. 이 브랜치는 `spec/2-navigation/` 을 전혀 바꾸지 않았다.
- 전체 diff(`origin/main...HEAD`)는 다음 파일만 포함한다:
  - `CHANGELOG.md`
  - `codebase/backend/src/common/pipes/validation.pipe.spec.ts` (+38, 신규 테스트 `describe` 블록)
  - `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (필드 **제거**: `workflowId`)
  - `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (주석 갱신, 로직 불변)
  - `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - `review/code/2026/09/04/18_34_04/**` (리뷰 산출물)
- 이 세 코드 파일은 모두 `codebase/backend/src/modules/executions/**` · `common/pipes/**` · `repo-guards/**` 소속이며, `spec/2-navigation/*.md` 의 frontmatter `code:` 목록(schedules/triggers/workflows/folders 모듈)에 **어느 것도 걸리지 않는다** — navigation 영역과 코드 소유권이 겹치지 않는다.

## 발견사항

이번 diff 는 **새 요구사항 ID·엔티티/DTO 명·API endpoint·이벤트명·ENV var·spec 파일 경로를 하나도 신설하지 않는다.** 유일한 실질 변경은 다음 두 가지이며 둘 다 "새 식별자 추가"가 아니라 "기존 식별자 제거/로컬 스코프 테스트 헬퍼"다.

- **[INFO]** `QueryExecutionDto.workflowId` 필드 제거 — 신규 식별자 아님
  - target 신규 식별자: 없음 (제거만 발생)
  - 기존 사용처: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (제거 전 `workflowId?: string | null`), `spec/2-navigation/14-execution-history.md:345` (원래도 이 필터를 약속한 적 없음 — diff 주석이 인용)
  - 상세: `GET /api/executions/workflow/:workflowId` 의 쿼리 파라미터 `workflowId` 를 삭제했다. 이 파라미터는 경로가 이미 workflowId 로 스코프돼 있어 개념적으로 성립하지 않는 죽은 필드였고(`findByWorkflow` 가 읽은 적 없음), `spec/2-navigation/14-execution-history.md` 도 이 필터를 약속한 적이 없다. 새 식별자 도입이 아니라 미사용 식별자 제거이므로 충돌 검토 대상이 아니다. 다만 참고로 남긴다 — 소비 클라이언트가 있었다면 `200`(무시)→`400`(거부) 변화가 있으나, `spec/2-navigation` 코드 소유 파일 어디에도 이 파라미터를 송신하는 코드가 없다.
  - 제안: 없음 (조치 불필요, 참고용)

- **[INFO]** `NarrowDto` 테스트 헬퍼 클래스 — 로컬 스코프, 충돌 없음
  - target 신규 식별자: `NarrowDto` (`codebase/backend/src/common/pipes/validation.pipe.spec.ts:87`)
  - 기존 사용처: 저장소 전체에서 이 파일 1곳(`git grep -n "NarrowDto" -- codebase/` 결과 전부 같은 파일 내 4줄)에만 존재
  - 상세: `CustomValidationPipe` 의 `forbidNonWhitelisted` 축을 검증하기 위한 `describe` 블록 내부 로컬 클래스로, export 되지 않고 다른 모듈에서 import 되지 않는다. 엔티티·DTO·인터페이스 명명 공간과 충돌 여지 없음.
  - 제안: 없음

## 요약

`spec/2-navigation/` 에 대한 이번 impl-done 검토 대상 diff(3개 파일 / 121줄)는 그 영역의 spec 문서를 전혀 변경하지 않았고(diff-stat 0), 실제 코드 diff 도 `executions`/`common/pipes`/`repo-guards` 모듈에 국한되어 schedules·triggers·workflows·folders 등 navigation 도메인의 요구사항 ID, 엔티티/DTO명, API endpoint, 이벤트명, ENV var, spec 파일 경로 어느 것도 신규 도입하지 않는다. 유일한 두 변경은 (1) 죽은 쿼리 파라미터 `QueryExecutionDto.workflowId` 제거(신규 식별자 아님)와 (2) 테스트 로컬 스코프 클래스 `NarrowDto` 추가(export 안 됨, 저장소 전체 유일 사용처)로, 둘 다 신규 식별자 충돌 가능성이 없다.

## 위험도

NONE
