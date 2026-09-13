# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 2건(모두 동작에 영향 없는 라벨/주석 사안). forced 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation/Requirement | 라운드 8 fix 커밋이 새로 넣은 주석이 자기 자신을 "라운드 9 정정"으로 잘못 표기 — 같은 커밋의 커밋 메시지·`plan/in-progress/error-code-emission-axis.md` §L 은 정확히 "라운드 8"로 서술해 자기모순. 이 저장소는 "라운드 N" 라벨을 커밋·리뷰 세션과 대조 가능한 감사 추적으로 쓰므로, 다음 라운드(진짜 라운드 9)가 fix 커밋을 만들면 동일 PR 안에 "라운드 9"를 자칭하는 두 지점이 생겨 추적이 헷갈린다. | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:12` | `(라운드 9 정정)` → `(라운드 8 정정)`으로 1단어 수정 |
| 2 | Maintainability | 함수 본문 대비 JSDoc(라운드별 반증·재반증 서사) 비중이 과도 — 예: `collectCatalogCodes`(본문 2줄 vs JSDoc 37줄), `isMessagePrefixOnly`(본문 3줄 vs JSDoc 17줄). 파일 전체 622줄 중 약 71%가 주석이고 17곳이 리뷰 세션 타임스탬프 경로를 직접 인용해, 이 PR의 리뷰 이력을 모르는 다음 유지보수자에게 진입장벽이 된다. | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`collectCatalogCodes` 415~455행, `isMessagePrefixOnly` 457~473행, `GUIDE_NON_EMITTED_VOCABULARY` 337~359행) | 라운드별 반증 서사는 CHANGELOG/RESOLUTION.md에 두고 소스 주석은 "현재 유효한 설계 근거 + 최소 인용"만 남기는 방향의 후속 정리 고려(이번 PR 진행 방식과 상충하므로 즉시 강제 사안은 아님) |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` spec 6개 파일이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`을 여전히 정식 에러 코드처럼 서술 — 실측(`execution-engine.service.ts:7121·7125·7130`+`:8017`)으로 이 두 이름이 `error.code`로 방출되지 않고 메시지 접두일 뿐임을 확인했고, 이번 PR의 가이드 문장 정정(`logic{,.en}.mdx`)이 코드와 일치한다. 코드가 옳고 spec이 낡은 SPEC-DRIFT 케이스로, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3473`에 planner 항목으로 등재돼 9라운드 연속 동일 판정이 반복 확인됨 — **코드 fix 대상 아님**. | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` | 조치 불요(이미 planner 트래커 등재분) — spec 반영 시 `3-loop.md` 선례(발행 문자열 전문 인용) 패턴을 따를 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `parseWhereRefs`의 `rest.replace(m[0], "")`는 위치가 아니라 문자열 내용으로 첫 occurrence를 지운다 — 동일한 `파일:줄` 표기가 head 안에 문자 그대로 두 번 이상 반복되는 입력은 아직 fixture로 검증되지 않은 코너케이스(실코퍼스에는 없음, 리스크 낮음) | `guide-identifier-existence.test.ts` — `parseWhereRefs` 함수 본문 | 조치 불필요(낮은 우선순위). 닫으려면 `matchAll` 인덱스 기반 절단으로 강화 가능 |
| 2 | Maintainability | 정규식 캡처 그룹 인덱스(`collectMatches(texts, rx, group)`의 세 번째 인자)가 각 정규식 내부 그룹 순서에 암묵 결속 — 그룹 순서 변경 시 컴파일 타임에 안 잡히고 조용히 잘못된 그룹을 수집할 수 있음. 하나는 주석으로 방어돼 있으나 나머지 둘은 무방비 | `guide-identifier-scan.ts:400,412,454` | Named capture group(`(?<token>...)`)으로 전환하면 인덱스-순서 결속 제거 가능(시급도 낮음) |
| 3 | Scope | 공유 백로그 트래커(`spec-draft-nullable-notation-followups.md`)에 이 작업과 직접 관련 없어 보이는 부수 편집 2건(spec_impact 보강, consistency 예산 재현 기록) — 저장소 규약("작업 중 발견한 부수 사실은 그 턴에 트래커에 기록")을 따른 것이라 스코프 위반 아님 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 규약 준수. 병합 시 트래커 충돌만 확인 |
| 4 | Scope | 8라운드 `/ai-review`+`--impl-done` 산출물(178개 파일)이 실질 코드 변경(2개 파일)에 비해 압도적으로 큼 — 이 프로젝트의 강제 게이트 산출물 규약에 따른 정상 결과이며 임의 확장은 발견되지 않음 | `review/code/2026/09/13/{19_23_22..22_06_10}/**` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경 없음(테스트 전용 정적 스캐너). 신규 정규식 3종 ReDoS 없음(선형, 비-사용자 입력), 경로 탐색 벡터 없음, 하드코딩 시크릿 없음 |
| requirement | LOW | 82/82 테스트 독립 재현 GREEN, `CONTAINER_*` 비-발행 핵심 주장 코드 실측 일치 확인. 라운드 라벨 자기모순(WARNING #1) 신규 발견. SPEC-DRIFT 재확인(신규 아님) |
| scope | NONE | 변경이 "가이드 문구 정정 + 가드 발행축 추가"라는 단일 목적에 정확히 국한. 부수 리팩터·트래커 편집 모두 규약/필연적 사유 확인 |
| side_effect | NONE | `parseWhereRefs` 반환형 변경은 비-export 로컬 전용(호출자 영향 없음), 탐색 루트 확장은 읽기 전용, 모듈 캐시 무변경 — 회귀 없음 |
| maintainability | LOW | JSDoc 과다로 진입장벽(WARNING #2). 정규식 그룹 인덱스 매직넘버·타입 미공유는 이미 낮은 위험으로 유예/처분됨 |
| testing | NONE | 82/82 GREEN 직접 실행 확인, 타입체크 ratchet baseline 일치, 신규 대조군 2건 뮤테이션 추론으로 판별력 확인 |
| documentation | LOW | CHANGELOG/PROJECT.md/가이드 mdx 전부 코드와 일치 재확인. 라운드 라벨 오기 1건 신규 발견(WARNING #1과 동일 사안) |

## 발견 없는 에이전트

없음 — 전원 최소 INFO 이상의 관측을 보고했으나, security·scope·side_effect·testing 4개 에이전트는 실질적 조치가 필요한 항목 없이 위험도 NONE으로 수렴함.

## 권장 조치사항

1. `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:12`의 `(라운드 9 정정)`을 `(라운드 8 정정)`으로 정정한다(WARNING #1, 1단어 수정, 동작 영향 없음).
2. (선택, 후속 정리) `collectCatalogCodes`/`isMessagePrefixOnly` 등 함수의 과도한 JSDoc 서사를 CHANGELOG/RESOLUTION.md로 이관하고 소스 주석은 현재 유효한 설계 근거만 남기는 압축을 고려한다(WARNING #2, 이번 PR 스코프 밖 별도 항목으로 처리 가능).
3. SPEC-DRIFT 항목(spec 6파일의 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 서술)은 이미 planner 트래커에 등재돼 있으므로 이번 PR에서 추가 조치 불필요 — planner 턴에서 처리.
4. INFO 항목들(정규식 그룹 인덱스, `parseWhereRefs` 코너케이스)은 조치 불요이나 후속 하드닝 시 참고.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 전원 — 이번 라우팅은 실행된 7명이 전부 강제 화이트리스트에 해당하며, 전원 결과 확보 확인됨)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff(테스트 전용 정적 스캐너, 문서 정정)와 관련성 낮음 |
  | architecture | 라우터 판단 — 신규 아키텍처 변경 없음 |
  | dependency | 라우터 판단 — 의존성 변경 없음 |
  | database | 라우터 판단 — DB 접근 코드 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 관련 코드 변경 없음 |
  | api_contract | 라우터 판단 — API 계약 변경 없음 |
  | user_guide_sync | 라우터 판단 — (참고: 이번 diff 는 유저 가이드 문구 자체를 수정하는 변경이라 관련성이 있어 보이나, forced 목록에 없어 라우터가 제외했다. requirement/documentation reviewer 가 가이드-코드 일치를 직접 대조 검증해 실질적으로 이 축을 커버했다) |
