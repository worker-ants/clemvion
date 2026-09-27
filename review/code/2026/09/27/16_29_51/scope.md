# 변경 범위(Scope) 리뷰 — patch-body-followups (3R)

## 검증 방법

- `git log --oneline -8` · `git diff --stat origin/main...HEAD`(49개 파일, +2479/-10) · `git diff --name-only origin/main...HEAD | wc -l`(49) 로 프롬프트의 "리뷰 대상 파일" 1~49 목록과 전수 대조 — 일치.
- `git status --short` — 이 세션 산출 디렉터리(`review/code/2026/09/27/16_29_51/`) 외 워크트리 변경 0. 저장소에 쓰기/뮤테이션 없이 읽기 전용(`git show`/`git diff`)으로 진행.
- 판정 기준 HEAD `44053cb9f`. 1R(`review/code/2026/09/27/15_46_38`)·2R(`review/code/2026/09/27/16_07_49`) 자신의 scope 리포트를 먼저 읽고, 이번 3R 시점에 새로 추가된 커밋(`6add3194e`, `44053cb9f`)만 독립적으로 `git show` 로 재검증했다(1R·2R이 이미 확인한 43개 파일을 재추적하지 않고, 그 결론이 이번 HEAD 에서도 여전히 유효한지만 확인).

## 발견사항

없음 — CRITICAL/WARNING 없음. 아래는 확인 근거다.

- **[INFO] (1R·2R 에서 이미 지적·처분된 항목 — 재-flag 아님)** `nodes.service.spec.ts` 의 "명시적 null 은 로드한 값을 지운다" 캐너리가 plan §방향 항목 3이 선언한 범위(`description`)보다 넓게 `containerId` 까지 같은 테스트에서 함께 단언한다.
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.spec.ts:230-246`(diff 게이트 기준, `Object.assign(existing, { description: 'memo', containerId: 'box-1' })` → `toMatchObject({ description: null, containerId: null })`)
  - 상세: 1R SUMMARY(INFO 5)·2R scope.md 가 이미 "같은 tri-state 칸의 기존 nullable 컬럼을 함께 고정한 것 — 의도, 조치 불요"로 처분했고, 이번 3R 시점에도 해당 라인은 변경되지 않았다. `containerId` 는 이번 PR 이 건드리지 않은 필드라 회귀 위험이 없다.
  - 제안: 없음 — 이미 처분됨. 세 번째로 같은 항목을 CRITICAL/WARNING 으로 올릴 근거가 새로 생기지 않았다.

## 3R 신규 커밋 검증 (문제 없음)

- **`6add3194e`**(2R WARNING #1 조치): `git show` 로 diff 전체를 직접 열람 — 세 DTO spec 파일(`auth-config-ip-whitelist.dto.spec.ts` · `node-dto-validation.spec.ts` · `workflow-dto-validation.spec.ts`)에서 JSDoc 주석 한 줄의 "``` `test/patch-partial-body.e2e-spec.ts` E 가 본다 ```"를 "``` `test/patch-partial-body.e2e-spec.ts` 가 본다 ```"로 바꾼 것뿐이다(3파일, 각 1줄, 총 +3/-3). 2R WARNING(1R 의 E→E1/E2/E3 분리로 낡은 참조)에 정확히 대응하는 최소 수정이며, 다른 코드·로직·테스트 본문은 건드리지 않았다.
- **`44053cb9f`**: `plan/in-progress/patch-body-followups.md` 에 2R 처분 요약 6줄 추가 + `review/code/2026/09/27/16_07_49/**` 13개 리포트 파일 신설(2R `/ai-review` 세션의 정상 산출물). 코드 변경 없음 — 프로젝트 규약이 요구하는 리뷰 절차 증거물이다.

## 범위 정합성 확인 (문제 없음, 근거로 기록)

- **실제 코드 변경은 3개 요청 DTO 필드**(`UpdateWorkflowDto.description` · `UpdateNodeDto.description` · `UpdateAuthConfigDto.ipWhitelist`)의 `nullable: true` + `T | null` 선언과 JSDoc/description 문구뿐이다 — `codebase/backend/src/**/*.ts`(spec 제외) 전체 diff 를 직접 열람해 확인, 세 파일 세 hunk 외 다른 소스 변경 없음(`omit-undefined.ts` 는 JSDoc 4줄 추가뿐, 함수 시그니처·본문 무변경).
- **테스트 추가는 전부 순수 append**이며 이번 3필드의 null 처리·OpenAPI 선언·1R/2R 지적 사항 조치에 대응한다. 신규 import(`contractForDto`)는 실제로 새 테스트에서 쓰인다 — 미사용 import 없음.
- **plan/CHANGELOG 문서 변경**은 이번 작업이 종결·개시하는 백로그 항목과 정확히 대응하고, `spec-draft-nullable-notation-followups.md` 는 원문을 취소선으로 보존한 채 좁혔다(규약 준수). 새로 등재한 "NOT NULL → 500" 항목·`executions.findById` 항목은 코드 수정 없이 트래킹만 한다 — 스코프 확장을 스스로 차단.
- **`review/code/**`·`review/consistency/**` 신규 파일 다수**는 프로젝트 규약(`--impl-prep` 의무, 구현 완료 후 `/ai-review` 상시 의무)이 요구하는 절차 증거물이며 무관한 파일이 아니다.
- 포맷팅만 바뀐 hunk, 무관한 주석 편집, 사용하지 않는 import, 설정 파일 변경은 발견하지 못했다.

## 요약

`git diff --stat origin/main...HEAD` 로 확인한 49개 변경 파일 전부가 plan 문서가 선언한 세 축 — (1) 워크플로·노드 `description`, 인증 설정 `ipWhitelist` 의 nullable 요청 필드 선언을 런타임 동작에 맞춤, (2) 그 선언·1R/2R 지적사항을 고정하는 단위/e2e/선언 캐너리, (3) CHANGELOG·plan·필수 `--impl-prep`/`/ai-review` 산출물 — 안에 들어간다. 3R 에서 새로 추가된 두 커밋은 각각 (a) 2R WARNING 에 대한 3줄짜리 주석 정정, (b) 2R 처분 기록(plan 6줄 + 리뷰 리포트 신설)으로, 둘 다 범위를 넓히지 않는다. 1R·2R scope 리뷰가 이미 지적·처분한 `containerId` 확장 단언(INFO)만 변경 없이 남아 있어 참고용으로 재확인했을 뿐, 새로운 스코프 이탈은 발견하지 못했다.

## 위험도

NONE
