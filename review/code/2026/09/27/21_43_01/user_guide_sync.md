# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 항목) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(155행 이하) 본문을 Read 하여 SSOT 로 사용.

## 변경 파일 컨텍스트
`git diff --stat origin/main...HEAD` 로 실제 변경 set 을 확인:

- 백엔드 서비스 레이어 (23 파일): `common/utils/reference-in-scope.{ts,spec.ts}`(신규), `modules/{alerts,edges,folders,knowledge-base,nodes,schedules,triggers,workflow-assistant,workflows}/*.service.ts` + 대응 `.spec.ts`, `edges.module.ts`, `triggers.module.ts`, `workflows.module.ts`, 신규 e2e `test/cross-workspace-references.e2e-spec.ts`
- `CHANGELOG.md` — Unreleased 항목 신설
- `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `spec/3-workflow-editor/0-canvas.md`, `spec/data-flow/11-workflow.md`, `spec/data-flow/12-workspace.md`
- `plan/complete/spec-draft-cross-workspace-refs{,-2}.md`, `plan/in-progress/cross-workspace-refs.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
- `review/consistency/2026/09/27/**` (다회 consistency-check 산출물)

`codebase/frontend/**`, `codebase/channel-web-chat/**` 는 `git diff --stat` 결과 **0줄** — 이번 changeset 에 프론트엔드 파일이 단 하나도 포함되지 않았다.

## trigger 매칭 점검

| trigger (매트릭스) | glob/semantic | 이번 changeset 매칭 여부 |
| --- | --- | --- |
| 새 노드 추가 / 노드 schema 변경 (`codebase/backend/src/nodes/**`) | glob | 불일치 — 변경은 `src/modules/**` (서비스 레이어)뿐, `src/nodes/**` 파일 없음 |
| 신규 UI 문자열 (frontend `*.tsx`) | semantic | 불일치 — frontend 파일 0건 |
| 신규 위젯 chrome 문자열 (channel-web-chat) | semantic | 불일치 — channel-web-chat 파일 0건 |
| 통합/제공자 변경 | semantic | 불일치 — provider 코드 변경 없음 |
| 유저 가이드 신규 섹션 디렉토리 | glob | 불일치 — `content/docs/` 변경 없음 |
| 백엔드 API 추가·변경 (`*.controller.ts`, `dto/**`) | glob 명시 + semantic 판단 | **glob 불일치**(controller/dto 파일 미변경, 검증 로직은 전부 `*.service.ts` 내부). 의미상으로도 이 PR 은 기존 엔드포인트의 표면(요청/응답 필드)을 바꾸지 않고, 이미 존재하던 IDOR/무결성 결함을 막는 **서버측 방어 강화**다 — GUI 는 애초에 타 워크스페이스 id 를 입력할 경로가 없어 새 GUI 흐름이 생기지 않는다. `CHANGELOG.md` 에 이미 상세 기술됨(이 프로젝트의 기존 관례상 이런 방어성 API 변경은 CHANGELOG 로 충분 — 인접한 "PATCH null → 400" 항목도 동일 패턴) |
| 신규 warningCode/errorCode | glob(`error-codes.ts`) / semantic | 불일치 — `reference-in-scope.ts` 는 기존 `ErrorCode.INVALID_FIELD` 를 재사용할 뿐, `error-codes.ts` 자체는 변경되지 않음(확인: 해당 파일의 마지막 커밋은 `a36395f5c`, 이번 changeset 과 무관) |
| 인증·권한·세션 흐름 변경 (`modules/auth/**`) | semantic | 불일치 — `modules/auth/**` 파일 없음 |
| 표현식 언어 변경 (`packages/expression-engine/**`) | semantic | 불일치 |
| 실행·디버깅 흐름 변경 | semantic | 불일치 — 실행 엔진·디버그 로깅 변경 없음(트리거/워크플로 생성 시점의 참조 유효성 검증만) |
| spec 신규/대규모 변경 (`spec/{2,3,4,5}-*/**`) | glob | **매칭**: `spec/2-navigation/1-workflow-list.md`, `spec/3-workflow-editor/0-canvas.md` (11·4줄 소폭 수정) — 다만 이 행의 타겟은 frontmatter `code:`/`status:`/`pending_plans:` 정합이며, 본 리뷰어(user-guide-sync) 소관인 frontend docs/i18n 이 아니라 `spec-frontmatter.test.ts` 등 별도 가드·`consistency-checker` 소관. 실제로 이 changeset 안에 `review/consistency/2026/09/27/{19_43_46 …21_03_31}/` 산출물이 7라운드 포함돼 있어 해당 검증이 이미 반복 수행됨을 시사 |

## 판정
이번 changeset 은 **프론트엔드(`codebase/frontend/**`, `codebase/channel-web-chat/**`)를 전혀 건드리지 않는 순수 백엔드 서비스 레이어 변경**이다 — 다른 워크스페이스/워크플로를 가리키는 참조 id 를 쓰기 시점에 거부하는 IDOR/무결성 방어 로직 추가(`reference-in-scope.ts` 신규 유틸 + 8개 서비스에서 사용) + 대응 unit/e2e 테스트 + spec/CHANGELOG/plan 갱신이다.

매트릭스의 20개 trigger 행 중 glob 매칭 대상(새 노드, 신규 섹션 디렉토리, error-codes.ts, 신규 BullMQ 큐)과 semantic 매칭 후보(auth 흐름, 표현식 언어, 실행·디버깅 흐름, 통합/제공자, UI 문자열)를 모두 점검했으나 실제로 매칭되는 행이 없다. 유일하게 glob 이 히트한 것은 `spec-major-change` 행(`spec/2-*/`, `spec/3-*/`)이며, 이는 본 리뷰어의 본연 관점(frontend docs/i18n/backend-labels 동반 갱신)이 아니라 spec frontmatter 정합성 문제로, 별도 가드(`spec-frontmatter.test.ts` 등)와 `consistency-checker` 의 소관이고 이미 이 changeset 안에 다회 consistency-check 산출물이 포함돼 검토된 흔적이 있다. 이를 근거로 해당 항목은 CRITICAL/WARNING 이 아닌 **참고 사항**으로만 남긴다.

## 발견사항
없음 — 매칭된 필수 동반 갱신 누락 없음.

## 요약
매트릭스 20개 trigger 행을 전수 점검했으나 이번 changeset(백엔드 서비스 레이어의 cross-workspace 참조 검증 강화 + spec/CHANGELOG/plan 갱신, frontend/channel-web-chat 파일 0건)에 매칭되는 행이 없다(단 하나, `spec-major-change` 행만 glob 매칭되지만 본 리뷰어 소관 밖인 spec frontmatter 정합성 문제). 새 노드·UI 문자열·통합/제공자·신규 섹션·인증 흐름·표현식 언어·실행/디버깅 흐름·신규 warning/error code 어느 trigger 도 해당 없어 프론트엔드 docs/i18n/backend-labels 동반 갱신 누락은 발견되지 않았다.

## 위험도
NONE
