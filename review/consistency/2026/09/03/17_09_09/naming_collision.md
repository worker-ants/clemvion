# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- target scope: `spec/5-system/` — 이 브랜치의 scope 델타는 **0개 파일**(spec 미변경). 정상(코드 전용 PR).
- 실제 변경분(against `origin/main`, 절대경로 워킹트리 `/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b` 기준 `git diff origin/main --name-status` 로 직접 재확인):
  - `codebase/backend/src/modules/{executions,knowledge-base,node-executions,nodes,notifications,schedules,triggers,users,workflows}/entities/*.entity.ts` (9개) — 전부 **기존 컬럼**의 TS 타입을 `X` → `X | null` 로 넓힘(entity nullable column 배치 2). 컬럼명·클래스명·데코레이터 옵션 키 신규 추가 없음, 일부 파일은 `type: 'varchar'`/`type: 'int'` 명시를 추가했으나 이는 기존 DB 컬럼 타입(`information_schema` 실측)을 TypeORM 메타데이터에 반영한 것으로 신규 식별자가 아님.
  - `codebase/backend/src/shared/utils/redact-stored-error.ts` / `.spec.ts` — 기존 함수 `maskIfPresent`/`redactNodeExecutionRowForResponse` 의 파라미터·반환 타입 시그니처만 `| null` 로 확장. 함수명·모듈 경로·export 이름 신규 없음.
  - `plan/in-progress/entity-nullable-column-type-mismatch.md` — 기존 진행 중 plan 문서 갱신(배치 2 완료 기록). "배치 1/2/3" 은 이 문서 내부의 진행 단계 라벨일 뿐, 요구사항 ID 체계(spec 의 정식 ID)에 속하지 않으며 다른 곳에서 같은 이름으로 이미 쓰이는 정황 없음.
  - `review/code/2026/09/03/16_45_35/**` — 신규 디렉토리지만 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 명명 컨벤션(CLAUDE.md 표)을 그대로 따르는 산출물이라 컨벤션 위반·경로 충돌 없음.

## 점검 관점별 판정

1. **요구사항 ID 충돌** — 신규 부여된 요구사항 ID 없음(spec 델타 0, plan 문서는 기존 트래커의 진행 상태 갱신일 뿐).
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. 모든 변경은 기존 필드의 nullability 표시(`| null`) 추가로, 이름 공간에 새 식별자를 만들지 않음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 컨트롤러·라우트 변경 없음(diff 는 entity·util 계층에 국한).
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 변경·신규 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음.
6. **파일 경로 충돌** — 신규 spec 파일 없음(spec 델타 0). `review/code/...` 신규 경로는 기존 컨벤션 그대로.

## 발견사항

없음 — 이 변경분은 새 식별자를 도입하지 않는다(기존 엔티티 필드의 타입 정밀화 + 그에 종속된 유틸 시그니처 정정 + plan 트래커 갱신 + 컨벤션 준수 리뷰 산출물 추가뿐).

## 요약

target scope(`spec/5-system/`)에는 이 브랜치의 spec 변경이 없고(델타 0), 실제 코드 diff(9개 엔티티 파일의 nullable 컬럼 타입 확장 + `redact-stored-error` 유틸 시그니처 정정 + plan 트래커 갱신 + `review/code/2026/09/03/16_45_35/` 리뷰 산출물)도 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 어느 축으로도 **새 식별자를 도입하지 않는다** — 전부 기존 식별자의 타입 표기를 실제 DB nullable 제약과 정합시키는 손질이다. 신규 식별자 충돌 관점에서 검토 대상 자체가 존재하지 않는다.

## 위험도

NONE
