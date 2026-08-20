# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(둘 다 이전 라운드부터 반복 확인된 defer 대상, 이번 PR 을 막을 사안 아님). 11명 reviewer(강제 7명 전원 포함) 전원 결과 확보, 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | ingestion `[REDACTED]` 마커 보존 캐너리가 `executions.service.spec.ts` 쪽만 `inputData` 로 확장됐고, `background-runs.service.spec.ts`(노드 레벨, 같은 계약)는 여전히 `outputData` 표면만 검증한다 — 배선 실수를 잡을 테스트가 이 표면에서 없음 | `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:274` | `makeBodyNodeExec` 의 `inputData` 에도 마커가 있는 헤더를 채우고 `nodeExecutions.data[0].inputData.headers` 가 `[REDACTED]` 를 보존하는지 단언 추가 (`executions.service.spec.ts` `:1296`~`:1301` 패턴 이식) |
| 2 | api_contract | `Execution.inputData` 응답의 내용 계약이 스키마 변경 없이 "원문"→"마스킹"으로 반전됨(3라운드 연속 지적) — 스키마 기반 계약 테스트로 감지 불가능한 breaking change, 저장소 밖 소비자(QA/운영 자동화, 감사 export 등) 영향 미확인 | `codebase/backend/src/modules/executions/executions.service.ts`(`toExecutionDto`/`toResponseExecution`), `dto/responses/execution-response.dto.ts:49-60` | 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:329`, 여전히 미체크) 항목대로 저장소 밖 소비자 존재 확인 후 릴리스 공지 여부 결정. 이번 PR 비차단 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / api_contract | 서버측(`resolveTriggerParameters`)이 `inputOverride` 에 담긴 마스킹 마커 리터럴(`"***"`)을 거부하지 않음 — 방어는 전적으로 UI 레이어, API 직접 호출 시 우회 가능 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322` (2026-08-20 등재) | 이미 트래커 등재·security 리뷰 INFO 판정 완료. 조치 불요 |
| 2 | maintainability | `touchedMaskedKeys` 이름이 실제로는 "모든 편집 키" 를 담아 이름이 내용보다 좁음(이전 라운드부터 defer) | `codebase/frontend/src/components/executions/rerun-modal.tsx:238, 308-313` | 선택: `touchedKeys` 로 개명 또는 주석 1줄 추가. 조치 불요에 가까움 |
| 3 | maintainability | `blockedByMaskedInput` 판정 근거가 JSDoc 표 하나에만 있어 넷째 조건 추가 시 표 갱신을 잊을 위험 | `codebase/frontend/src/components/executions/rerun-modal.tsx:344-375` | 선택: 술어 옆에 "조건 추가 시 표도 갱신" 포인터 주석 |
| 4 | documentation | plan 제목("소비처 2곳")과 CHANGELOG 제목("소비처 3곳")의 셈법이 다름(각자 내적 일관, 실제 모순 아님, 두 라운드 전 defer 완료) | `plan/in-progress/eia-inputdata-marker-guard.md` frontmatter vs `CHANGELOG.md:3` | 조치 불요(직전 판정 유지) |
| 5 | performance | backend 목록 엔드포인트가 `inputData` 마스킹 스캔을 새로 편입해 행당 작업량 소폭 증가(재귀 깊이 상한 10·WeakMap 캐시로 이미 유계) | `codebase/backend/src/modules/executions/executions.service.ts:1010, 1074` | 조치 불요. 실사용 데이터가 커지면 목록 응답 truncate 고려 |
| 6 | performance | 에디터 JSON 텍스트에어리어 키 입력마다 `hasMaskedMarkerLeaf` 재귀 스캔 추가(파싱과 별개 오버헤드) | `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:103-124` | 조치 불요. 대형 JSON 히스토리 로드가 문제로 관측되면 debounce 고려 |
| 7 | performance | `rerun-modal.tsx` 의 `touchedMaskedKeys` 갱신이 편집마다 `Set` 전체를 복사(필드 수 유계라 무시 가능) | `codebase/frontend/src/components/executions/rerun-modal.tsx:308-313` | 조치 불요 |
| 8 | side_effect | `Execution.inputData` 가 응답 페이로드에서 원문→마스킹으로 반전 — 이 PR 에서 가장 넓은 반경의 공개 인터페이스 변경(WARNING #2 와 동일 사안, side_effect 관점에서 INFO 로 재확인) | `codebase/backend/src/modules/executions/executions.service.ts:1010, 1075, 116-123` | 조치 불요(이미 트래커 등재·의도된 설계 결정) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인증 우회 없음. 방어 로직(값-우선 검사, 3조건 AND, 깊이 상한)이 이전 6라운드가 재현한 우회 경로 전부에 대응하는 캐너리로 고정됨을 재확인 |
| performance | LOW | 신규 알고리즘 복잡도·N+1·블로킹 I/O 없음. 마스킹 스캔이 목록/에디터에 소폭 편입됐으나 모두 유계 |
| architecture | LOW | 신규 구조적 결함 없음. 의존 방향 정리(모달/툴바→공용 유틸)됨. 남은 부채(상수 미러, 판정 로직 분산, `inputOverride` 서버 미검증)는 전부 트래커 등재된 의도적 defer |
| requirement | NONE | spec §R17/§10.2 와 line-level 일치 재검증. i18n·유저가이드·CHANGELOG 정합 확인. 신규 결함 없음 |
| scope | NONE | 최신 커밋(`6f1d4d41d`)은 예고된 두 가지(깊이 상한, JSDoc 순서 재배치)만 수행. 무관 변경·설정 변경 없음 |
| side_effect | LOW | 함수 시그니처·export 이동 전 소비처 동반 갱신 확인. 유일한 넓은 반경 변경(inputData 마스킹 반전)은 의도된 목적이자 이미 트래커 등재 |
| maintainability | LOW | 핵심 로직 단일 책임·낮은 순환 복잡도. `touchedMaskedKeys` 이름 정밀도만 재확인된 기존 defer 항목 |
| testing | LOW | 6라운드 캐너리 전부 유효. `background-runs.service.spec.ts` 의 `inputData` 표면 검증 누락 신규 발견(WARNING) |
| documentation | NONE | "주제문 방치"·"plan 카운트 stale" 등 이전 반복 결함 클래스 전부 해소 확인. 사소한 표기 차이만 잔존(INFO, defer) |
| api_contract | LOW | 신규 엔드포인트/인증 변경 없음. `inputData` 내용 계약 반전이 스키마상 무감지 breaking change(3라운드 연속 WARNING, defer) |
| user_guide_sync | NONE | 매칭된 2개 trigger(run-debug-flow-change, new-ui-string) 모두 동반 갱신 완료(MDX 4파일, dict 키 ko/en) |

## 발견 없는 에이전트

security, requirement, scope, documentation, user_guide_sync — CRITICAL/WARNING 없음(NONE 판정).

## 권장 조치사항

1. `background-runs.service.spec.ts:274` 에 `inputData` 표면 ingestion 마커 보존 단언 추가 — 노드 레벨 배선이 향후 리팩터로 깨져도 잡을 테스트가 현재 없음 (WARNING #1).
2. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:329` 트래커 항목대로, `GET /executions*` 를 직접 소비하는 저장소 밖 클라이언트 존재 여부를 별도로 확인하고 필요 시 릴리스 공지에 `inputData` egress 마스킹 반전을 명시 (WARNING #2, 이번 PR 비차단).
3. 나머지 INFO 8건은 전부 이전 라운드에서 이미 defer 확정된 사안 — 별도 조치 불요, 재지적 방지를 위한 기록 유지.

## 라우터 결정

- `routing=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (11명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음
  - **제외**: 아래 표 (3명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단(prompt 상 근거 미상세, forced whitelist 밖) |
  | database | router 판단(이번 diff 가 DB 스키마/쿼리 변경을 포함하지 않음) |
  | concurrency | router 판단(이번 diff 가 동시성 제어 로직 변경을 포함하지 않음) |