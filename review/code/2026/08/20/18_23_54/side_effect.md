STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트가 diff 를 생략한 파일들(`executions.service.ts`, `background-runs.service.spec.ts`,
`executions.service.spec.ts`, `rerun-modal.tsx`, `editor-toolbar-run-input.test.tsx`,
`rerun-modal.test.tsx`, `masked-markers.ts`, `masked-markers.test.ts`)은
`git diff origin/main...HEAD -- <path>` 로 직접 재조회했다. 시그니처/인터페이스 변경의
blast radius 를 확인하기 위해 `grep`/`Read` 로 다음을 실측했다:

- `MASKED_MARKERS`/`isMaskedMarker` 를 `dynamic-form-ui.tsx` 밖에서 참조하는 모든 지점
  (export 이동 후 dangling import 여부)
- `ExecutionsService.toResponseExecution`/`toExecutionDto`(마스킹 관문)의 전체 호출부 —
  REST 컨트롤러 외에 `websocket.gateway.ts`·`interaction.service.ts`·`hooks.service.ts` 도
  포함해 반환값(`inputData` 포함)을 프로그램적으로 재사용하는 곳이 있는지
- `reRun()` 이 Re-run 실행 시 읽는 `original.inputData` 가 이 마스킹 관문을 우회해 raw 엔티티를
  직접 쿼리하는지(서버측 실행 로직이 마스킹된 값으로 오염되지 않는지)
- `process.env`/`console.*`/`fs.*`/`localStorage`/`fetch` 패턴의 신규 도입 여부 (전체 codebase diff grep)

## 발견사항

- **[WARNING]** 공개 REST 응답의 `inputData` **내용**이 스키마 변경 없이 원문 → 마스킹으로 반전된다 (인터페이스 변경, 기존 사용자 영향)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1010`
    (`toExecutionDto` 의 `inputData: redactStoredDataForResponse(execution.inputData)`),
    `:1075` (`toResponseExecution` 의 동일 패턴), 타입 확장은 `:116-123`
    (`ResponseExecution` 이 `'inputData'` 를 `Omit` 에 추가하고 `inputData: Record<string, unknown> | null` 필드를 명시)
  - 상세: `GET /api/executions/:id` · `GET /executions/workflow/:id`(목록) · `getChain` ·
    `stop` 네 표면이 이제 `Execution.inputData` 를 자격증명 값-패턴 마스킹해서 반환한다.
    OpenAPI 타입은 `Record<string, unknown> | null` 로 **변경 전과 동일**하므로 스키마
    기반 계약 테스트로는 이 변화가 잡히지 않는다 — 저장소 밖에서 이 필드를 raw 값으로
    소비하던 기존 통합/스크립트가 있다면 조용히 마스킹된 값(`'***'`, `[REDACTED]`)을 받게
    된다. 저장소 내부는 안전을 확인했다 — `reRun()`(`executions.service.ts:429-434,483-484`)
    은 이 마스킹 관문을 거치지 않고 `executionRepository.createQueryBuilder` 로 raw 엔티티를
    직접 재조회해 `original.inputData` 를 그대로 쓰므로, 서버측 재실행 로직 자체는 이
    변화로 오염되지 않는다. `websocket.gateway.ts:399` 의 `EXECUTION_SNAPSHOT` emit 도
    `findById` 결과를 그대로 내보내 REST 와 동일하게 마스킹되는데, 이는 spec 변경분
    (`spec/5-system/6-websocket-protocol.md` §4.1, 프롬프트 게이트 205-209)이 명시적으로
    요구하는 "REST·WS 동일 규칙"이라 의도된 정합화이지 새 결함이 아니다.
  - 참고: 이 정확한 우려는 이미 `review/code/2026/08/20/16_51_19/RESOLUTION.md` WARNING 2
    (프롬프트 게이트 1814-1821)에서 3라운드 연속 `spec-sync-external-interaction-api-gaps.md`
    트래커로 이월된 항목이다 — "저장소 밖 소비자 존재 여부는 이 PR 안에서 확인할 수 있는
    성질이 아니다"라는 판단에 동의하며, 새로운 지적이 아니라 side-effect 관점에서 이미
    합의된 잔여 리스크를 재확인하는 것이다.
  - 제안: 추가 조치 불요(이미 트래커 등재·release note 예정). 다만 이 PR 을 병합하기 전에
    운영 채널(Slack/release note)로 API 소비자 공지가 실제로 나가는지 확인.

- **[INFO]** `MASKED_MARKERS`/`isMaskedMarker` 의 export 위치가 이동했다 (공개 심볼 제거) — 전 소비처 갱신 확인, 위험 낮음
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`
    (구 `export const MASKED_MARKERS`/`export function isMaskedMarker` 블록이 통째로 삭제됨,
    삭제된 줄이라 게이트 없음 — 프롬프트 파일10 diff 상 `-327`~`-360` 라인 부근),
    신규 위치는 `codebase/frontend/src/lib/utils/masked-markers.ts`
  - 상세: 이 컴포넌트 파일에서 두 심볼의 `export` 가 제거됐다 — 이 파일을 직접 import 하던
    외부 코드가 있었다면 전형적인 breaking change다. `grep -rn "MASKED_MARKERS\|isMaskedMarker"
    codebase/frontend/src` 로 전수 확인한 결과, 남은 모든 참조(`rerun-modal.tsx`,
    `editor-toolbar.tsx`, `dynamic-form-ui.tsx` 자신, 테스트 파일)가 이미
    `@/lib/utils/masked-markers` 새 경로로 갱신돼 있어 dangling import 는 없다.
  - 제안: 조치 불요 — 이미 완결된 마이그레이션. 참고로만 기록.

## 요약

이 PR 은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 backend 마스킹 관문 2곳
(`toExecutionDto`/`toResponseExecution`)을 확장하고, frontend 마커 판별 유틸을 컴포넌트
밖(`lib/utils/masked-markers.ts`)으로 승격해 Re-run 모달·에디터 히스토리 로드·폼 프리필
세 소비처에 왕복 오염 차단 가드를 새로 걸었다. 전역 상태·환경 변수·파일시스템·네트워크
호출 관점에서는 깨끗하다(전체 diff grep 결과 `process.env`/`console.*`/`fs.*`/`localStorage`/
신규 `fetch` 패턴 도입 0건). export 이동(`MASKED_MARKERS`/`isMaskedMarker`)은 소비처
전수가 이미 새 경로로 갱신돼 안전하다. 유일한 실질적 부작용 표면은 REST 응답
`inputData` 내용이 스키마 변경 없이 반전되는 인터페이스 변화인데, 이는 이 PR 이 의도적으로
만드는 변화이고 서버측 재실행 로직(raw 엔티티 직접 재조회)과 WS snapshot 경로 모두
실측으로 안전을 확인했으며, 저장소 밖 소비자 리스크는 이미 3라운드째 트래커로 관리되고
있다.

## 위험도

LOW
