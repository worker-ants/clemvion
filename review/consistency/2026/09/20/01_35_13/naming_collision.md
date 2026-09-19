# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- **target spec 영역**: `spec/2-navigation/` — `origin/main` 대비 델타 **0개 파일**. 이번 PR 은 이 spec 영역에 새 요구사항 ID·엔티티명·endpoint·이벤트명·ENV 키·파일 경로를 전혀 추가하지 않았다.
- **실제 코드 diff**: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 1개 파일(179줄) — `git diff origin/main...HEAD --stat` 로 확인. `spec/2-navigation/*.md` 의 `code:` frontmatter(예: `1-workflow-list.md`, `2-trigger-list.md` 가 지목하는 `page.tsx`/`workflows.service.ts`/`triggers.controller.ts` 등)에는 이 파일이 포함되어 있지 않다 — 이 diff 는 `column-guard-gaps` 플랜(컬럼 층 가드 빈칸, `plan/in-progress/column-guard-gaps.md`)에 속하며 데이터 모델/엔티티 스키마 검증 테스트다.

즉 이번 검토 대상(spec/2-navigation)과 실제 변경분(entity-schema 테스트) 사이에 접점이 없어, "target 문서가 새로 도입하는 식별자" 자체가 이 스코프 안에는 존재하지 않는다.

## 코드 diff 내 신규 식별자 충돌 점검 (참고용)

스코프 밖이지만 diff 가 도입한 신규 식별자를 넓게 훑어 충돌 여부만 확인했다 (`grep -rn` 결과, `node_modules` 제외):

- `readOnlyDataSourceOptions()` (신규 헬퍼 함수, `entity-schema-declarations.e2e-spec.ts:212`) — 다른 파일에서 동일 이름 사용 없음. 충돌 없음.
- `entity_schema_read_only_probe` (신규 TEMP 테이블명, 동일 파일:601) — 다른 마이그레이션·엔티티·테스트에서 사용 없음(파일명 prefix 로 스코프됨). 충돌 없음.
- 새 `it(...)` 테스트 제목 2건(`비교기 연결은 읽기 전용이다 — DDL 을 거부한다`, `선언한 DB 기본값은 값을 생략한 insert 뒤 엔티티로 돌아온다 — …`) — 같은 `describe` 블록 내에서도, 다른 스펙 파일에서도 중복 없음.
- `ModelConfig` / `WorkflowAssistantSession` import — 이 diff 가 새로 만든 엔티티가 아니라 기존 엔티티(`codebase/backend/src/modules/model-config/entities/model-config.entity.ts`, `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts`)를 그대로 가져다 쓴 것이므로 "신규 식별자"에 해당하지 않는다.

이 중 어느 것도 요구사항 ID·API endpoint·이벤트명·ENV 키·spec 파일 경로가 아니며, `spec/2-navigation/` 의 명명 공간과도 무관하다.

## 발견사항

없음 — target(`spec/2-navigation/`)이 이번 diff-base 대비 도입한 새 식별자가 없고, 실제 코드 변경분도 이 스코프의 식별자 공간과 겹치지 않는다.

## 요약

`spec/2-navigation/` 은 이번 브랜치에서 변경되지 않았고(델타 0), 실제 코드 diff 는 그 spec 영역의 `code:` 프런트매터가 지목하는 어떤 파일과도 무관한 별개 플랜(`column-guard-gaps`, 엔티티 스키마 컬럼 층 가드 테스트)의 산출물이다. 따라서 "target 문서가 새로 도입한 식별자"가 이 검토 스코프 안에는 존재하지 않으며, diff 가 도입한 소수의 신규 로컬 식별자(헬퍼 함수명·임시 테이블명·테스트 제목)도 grep 전수 확인 결과 기존 사용처와 충돌하지 않는다. 신규 식별자 충돌 관점에서 이번 변경은 위험이 없다.

## 위험도

NONE
