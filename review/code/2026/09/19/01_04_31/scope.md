# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** consistency-check 라운드 산출물 4세트가 통째로 커밋됨
  - 위치: `review/consistency/2026/09/18/23_39_46/**`, `review/consistency/2026/09/18/23_54_40/**`, `review/consistency/2026/09/19/00_07_54/**`, `review/consistency/2026/09/19/00_16_40/**` (각 세션 `SUMMARY.md`·`_retry_state.json`·`meta.json`·`_target/*.md`·5개 checker `.md`)
  - 상세: `--spec` 모드 3라운드(BLOCK:YES → 수정 → 수렴)와 `--impl-prep` 1라운드 산출물이 전부 diff 에 들어 있어 diffstat 상 54개 파일 중 20개, 삽입 3,029줄 중 상당 비중을 이 디렉터리가 차지한다. 다만 CLAUDE.md 는 "정합성 검토 산출물" 위치를 `review/consistency/**` 로 명시하고, `project-planner` 는 `spec/` 쓰기 직전 `consistency-check --spec` 를 의무로 두며 이전 커밋(`eb5332b57`)도 같은 방식으로 3세션을 함께 커밋한 선례가 있어, 이는 이 저장소의 정식 워크플로 산출물이지 스코프 이탈이 아니다. 리뷰어 참고용으로만 남긴다.
  - 제안: 조치 불필요 — 프로젝트 컨벤션에 부합.

- **[INFO]** `triggers.controller.ts` 의 409 설명 문자열을 상수(`TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION`)로 추출
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — 새 상수 선언부, `create`/`update` 두 `@ApiConflictResponse` 데코레이터
  - 상세: 이번 PR 이 두 엔드포인트의 409 설명 문구를 모두 "동일 워크스페이스에" → 전역 유일 문구로 바꿔야 했고, 두 곳이 항상 같은 문구를 유지해야 한다는 점(주석이 `integrations.controller.ts` 의 기존 선례를 직접 인용)이 이번 변경의 직접적 필요에서 나온 최소 리팩토링이다. 무관한 코드 정리가 아니라 이번 변경이 만드는 중복을 없애는 조치.
  - 제안: 조치 불필요.

## 요약

`codebase/backend/migrations/{V131,V132}*`, `triggers.controller.ts`/`triggers.service.ts`/`triggers.service.spec.ts`, 신규 e2e(`trigger-endpoint-path-dedupe.e2e-spec.ts`, `webhook-trigger.e2e-spec.ts` B5·B6), 문서(`triggers.mdx`/`triggers.en.mdx`), `spec/**` 7개 파일, `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`(신규 draft) 와 `spec-draft-nullable-notation-followups.md`(원 트래커 항목 체크·후속 항목 등재) 전부가 "웹훅 `endpoint_path` 전역 유일화" 단일 의도에 직접 종속돼 있다. 각 diff hunk 를 개별 확인한 결과 무관한 파일·포맷팅 전용 변경·사용하지 않는 임포트·설정 파일 변경·요청 밖 기능 확장은 발견되지 않았고, 유일한 리팩토링(409 설명 상수화)도 이번 변경이 만든 중복 제거로 범위 안에 있다. `review/consistency/**` 산출물 다량 포함은 프로젝트가 강제하는 `--spec` 컨센서스 워크플로의 정상 산출물이다.

## 위험도

NONE
