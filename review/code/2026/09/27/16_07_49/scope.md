# 변경 범위(Scope) 리뷰 — patch-body-followups (2R)

## 검증 방법

- `git diff --stat origin/main...HEAD` 로 실제 변경 파일 **36개** 전수를 프롬프트의 "리뷰 대상 파일" 목록(파일 1~36)과 대조 — 정확히 일치. 프롬프트에 없는 파일, 프롬프트에는 있는데 실제 diff에 없는 파일 모두 0건.
- 저장소 트리에 쓰기/뮤테이션 없음 — `git status --short`(리뷰 시작 시 이 세션 산출 디렉터리 외 항목 0), `git diff --stat` 만 실행해 읽기 전용으로 진행.
- `plan/in-progress/patch-body-followups.md`(§방향·§뮤턴트·§`/ai-review` 1R·§`--impl-prep` 처분)와 1R `RESOLUTION.md`/`SUMMARY.md`를 판정 근거로 삼되, 1R 자체 scope 리뷰(`review/code/2026/09/27/15_46_38/scope.md`)가 이미 짚은 관찰(INFO, `containerId` 확장)이 이번 diff에도 그대로 남아 있는지 재확인.

## 발견사항

- **[INFO]** (1R에서 이미 지적·처분된 항목의 재확인 — 신규 아님) `nodes.service.spec.ts`의 "명시적 null 은 로드한 값을 지운다" 캐너리가 plan §방향 항목 3이 선언한 범위(`description`)보다 넓게 `containerId`까지 같은 테스트에서 함께 단언한다.
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.spec.ts:230-246`(diff 게이트 기준)
  - 상세: `Object.assign(existing, { description: 'memo', containerId: 'box-1' })`로 두 필드를 세팅하고 `description: null, containerId: null`을 함께 PATCH해 `toMatchObject({ description: null, containerId: null })`로 검증한다. `containerId`는 이번 PR이 건드리지 않은 기존 nullable 필드이고 코드 변경도 수반하지 않아 회귀 위험은 없다. 1R SUMMARY(INFO 5)에서 같은 관찰이 나왔고 RESOLUTION은 "노드 캐너리가 containerId 까지 단언하는 것은 의도(같은 tri-state 칸, nullable 컬럼 둘) — plan §방향 3을 그렇게 읽으면 된다"로 조치 불요 처분했다. 이번 2R 시점에도 해당 라인은 변경되지 않았다.
  - 제안: 조치 불요 — 이미 1R에서 의도로 처분됨. 재지적하지 않는다.

## 범위 정합성 확인 (문제 없음, 근거로 기록)

- **DTO 변경 3건**은 `nullable: true` + `T | null` 선언과 필드 JSDoc 인라인 코멘트만 바뀌었고, 함수 시그니처·다른 필드·엔드포인트는 무변경 — plan §방향 항목 1과 일치. 1R testing/documentation 리뷰가 지적한 "노드 DTO만 JSDoc 갱신, 워크플로·인증설정은 미갱신"(INFO 6)도 이번 diff에서 `update-workflow.dto.ts:27`(`변경할 설명 (null 이면 지운다)`)·`update-auth-config.dto.ts:49`(`변경할 IP 화이트리스트 (null · 빈 배열이면 전체 삭제)`)로 세 파일 모두 통일돼 있다 — RESOLUTION 표의 커밋(`3cc0d092f`)과 대응.
- **1R 조치 3건**(`omit-undefined.spec.ts`의 null-인자 TypeError 캐너리, `patch-partial-body.e2e-spec.ts`의 E→E1/E2/E3 분리, `auth-configs.service.spec.ts`의 `ipWhitelist` null/`[]` 동치 `it.each`)은 SUMMARY W1·W2·INFO 4가 요구한 범위에 정확히 대응하며, 그 외 로직·엔드포인트·다른 테스트 본문을 건드리지 않았다(순수 추가).
- **plan 문서 2건**: `patch-body-followups.md` 신설(프로젝트 관례상 작업 plan 필수) + `spec-draft-nullable-notation-followups.md`의 원 항목 취소선 보존·좁히기·새 항목 추가는 이번 작업이 종결·개시하는 백로그와 정확히 대응한다. 새로 등재한 "NOT NULL → 500" 항목은 수정 코드를 이번 PR에 끼워 넣지 않고 트래킹만 한다 — 스코프 확장을 스스로 차단.
- **`review/code/2026/09/27/15_46_38/**`(13개 파일) + `review/consistency/2026/09/27/15_19_25/**`(8개 파일)**: 프로젝트 규약(`--impl-prep` consistency-check 의무, `/ai-review` 강제 의무)이 요구하는 산출물이며 `review/`는 gitignore 대상이 아니다 — 무관한 파일이 아니라 필수 절차의 증거물. 1R 자신의 scope 리뷰도 같은 결론을 냈다.
- **`review/code/2026/09/27/15_46_38/RESOLUTION.md`·`SUMMARY.md`**: 1R 처분 내역만 기록 — 이번 2R diff에 새 코드 변경으로 이어지지 않은 서술은 없다(표의 커밋 해시가 실제 diff와 대응).
- import 변경(`contractForDto`, 3개 spec 파일)은 모두 신설 캐너리에서 실제로 쓰인다 — 미사용 import 없음.
- 포맷팅만 바뀐 hunk, 무관한 주석 편집, 설정 파일 변경은 발견하지 못했다.

## 요약

`git diff --stat origin/main...HEAD` 로 확인한 36개 변경 파일 전부가 plan 문서·1R RESOLUTION이 선언한 축 — (1) 세 요청 DTO의 nullable 선언 정합화, (2) 그 선언을 고정하는 단위/e2e/선언 캐너리(1R 조치분 포함), (3) CHANGELOG·plan·필수 impl-prep/`ai-review` 산출물 — 안에 정확히 들어간다. 새로 발견된 스코프 이탈은 없으며, 1R이 이미 지적·처분한 INFO(`nodes.service.spec.ts`의 `containerId` 확장 단언)만 변경 없이 그대로 남아 있어 참고용으로 재확인했다. "NOT NULL→500" 결함 클래스와 `executions.findById` 관계 유출은 코드로 고치지 않고 트래커에만 등재해 스코프를 스스로 절제했다.

## 위험도

NONE
