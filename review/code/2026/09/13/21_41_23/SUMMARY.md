# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(문서 인용 1줄 오프셋 · dev-time 가드 커버리지 갭 1건) 모두 저위험. forced 7명 전원 결과 확보(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 문단 2곳이 인용하는 소스 줄 번호가 실제 위치보다 1줄 앞이다 — `nodeExec.error = { message }`는 8016행이 아니라 **8017행**(8016행은 `nodeExec.status = ...FAILED`). 결론(`code` 필드 없음) 자체는 참이라 설계 결정에는 영향 없음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3446, :3475` (실제 코드: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8017`) | 두 인용 모두 `:8016` → `:8017`로 정정 |
| 2 | testing | 라운드 6이 도입한 `resolveSourceLines`의 유일성 가드(`found.length === 1` → 아니면 `null`)를 겨눈 판별 fixture가 없음 — 뮤테이션(`=== 1` → `>= 1`)으로 76/76 GREEN 생존을 직접 확인. 저장소에 동일 basename(`index.ts`) 46개 존재해 등록 항목이 늘면 현실적으로 부딪힐 수 있는 경로. 이 파일이 이미 3차례 반복한 "헬퍼 테스트 ≠ 호출부 테스트" 패턴의 4번째 재발 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:86-100`(정의), `:96`(가드), `:285`(유일 호출부) | 별도 `describe` 블록으로 (a) 존재하지 않는 basename → `null`, (b) 2건 이상 매치(예: `index.ts`) → `null` 케이스를 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` spec 6파일이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 여전히 "에러/코드"로 서술 — 실제 구현(`nodeExec.error = { message }`, code 필드 없음)과 형제 문서(`3-loop.md`, 발행 문자열 전문 인용)는 이 PR이 반영한 서술과 일치. 코드가 옳고 spec이 낡음. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`(3457, 3478)에 planner 항목으로 등재·위임됨 — 이번 PR 범위 밖 | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` | 코드(가이드 mdx·스캐너) 유지. spec 6파일 + `3-error-handling.md §1.4` 정정은 planner 트래커 항목 집행 시 함께 |
| 2 | requirement | `guide-identifier-existence.test.ts`가 `spec/conventions/user-guide-evidence.md §2` build-time 가드 목록(3건)에 미등재 — 선재 갭(#1330 이전부터), 9라운드 연속 동일 판정 | `spec/conventions/user-guide-evidence.md:68-76` | 조치 불요(이 PR 범위 밖). 추후 표 갱신 시 반영 |
| 3 | maintainability | 파일 서두 반증 이력 주석이 `guide-identifier-scan.ts` 595줄 중 약 69%(412줄) 차지 — 코드 자신이 명시적으로 요구하는 의도된 설계(가드가 무엇을 보장 안 하는지 기록). 세션 경로 인용이 7라운드에 걸쳐 계속 늘어나는 추세 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:1-124` | 이번 PR 조치 불요. plan 종료 시점에 안정화 서술만 남기고 일회성 반증 서사는 CHANGELOG/RESOLUTION에 위임하는 정리 고려 |
| 4 | maintainability | `where` 검증 로직 4단 중첩 잔존(라운드 6 캐시 도입으로 각 단계 본문은 축소됐으나 구조는 유지) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:273-298` | 조치 불요(기존 유예 유지). `where` 검증을 순수 함수로 완전 분리할 때 함께 정리 |
| 5 | maintainability | vacuity floor 매직 넘버, `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 타입 미공유 — 5라운드 연속 이월, 낮은 우선순위 | `existence.test.ts:166-235`, `guide-identifier-scan.ts:300-304, 333-338` | 세 번째 유사 목록 생길 때 공유 타입 추출 검토 |
| 6 | testing | `computeNonEmittedOffenders`의 `new Set` 중복 제거 겨눈 fixture 부재 — 라운드 6에 이미 등재, "거짓 PASS 아님, 진단 품질만" 낮은 우선순위 처분 | `guide-identifier-scan.ts` (`computeNonEmittedOffenders`) | 조치 불요(누적 처분 유지) |
| 7 | side_effect | `sourceLinesCache`가 단일 호출부인데도 모듈 스코프에 선언됨. 값이 순수 파일시스템 읽기 결과라 새 위험은 아님 | `guide-identifier-existence.test.ts:86-99`(선언), `:285`(유일 호출부) | 조치 불요(현재 유일 호출부). 두 번째 호출부 생기면 재검토, 선택적으로 `it()` 콜백 내부로 스코프 축소 |
| 8 | side_effect | 카탈로그 파일 read(`spec/5-system/3-error-handling.md`)가 존재 가드 없이 이뤄짐 — 라운드 1부터 이어진 기존 관행, 변경 없음 | `guide-identifier-existence.test.ts:142-147` | 조치 불요(누적 처분 유지). 강화 시 `readIfPresent`로 통일 |
| 9 | security/scope/etc | 정규식 ReDoS 없음, 경로 하드코딩(traversal 없음), 시크릿 없음, `child_process`/`eval`/네트워크 호출 없음, 135개 review 산출물 파일은 정상 절차 기록, 신규 코드 전부 순수 추가/시그니처 무변경 | 각 리포트 참조 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | ReDoS·경로탈출·시크릿·위험 API 없음. dev-time 정적 스캐너, 프로덕션 런타임 미영향 |
| requirement | NONE | 핵심 판정 로직(`computeNonEmittedOffenders`) 실측 근거 전수 재확인, 76/76 GREEN. SPEC-DRIFT 1건은 이미 위임됨 |
| scope | NONE | 실질 변경 8파일로 국한, 전부 plan 체크리스트 항목과 1:1 대응. 무관한 리팩터/포맷팅 없음 |
| side_effect | NONE | 신규 캐시는 순수 읽기 memoize, 뮤테이션 검증 기록 있음. 전역상태/시그니처 파괴 없음 |
| maintainability | LOW | 서두 주석 비중(69%)·중첩 4단·매직넘버 — 전부 기존 이월 판정 유지, 새 결함 없음 |
| testing | LOW(WARNING 1건) | `resolveSourceLines` 유일성 가드 fixture 부재 — 뮤테이션으로 생존 확인, "헬퍼≠호출부 테스트" 4번째 재발 |
| documentation | LOW(WARNING 1건) | plan 신규 문단 2곳 줄 번호 1줄 오프셋(`:8016`→`:8017`), 결론에는 영향 없음. 나머지 문서는 코드와 정확히 일치 |

## 발견 없는 에이전트

security, requirement, scope, side_effect — 이번 라운드 신규 CRITICAL/WARNING 없음(NONE 판정).

## 권장 조치사항

1. `plan/in-progress/spec-draft-nullable-notation-followups.md:3446, :3475`의 소스 줄 인용을 `execution-engine.service.ts:8016` → `:8017`로 정정한다.
2. `resolveSourceLines`(`guide-identifier-existence.test.ts:86-100`)에 유일성 가드(0건/2건 이상 → `null`)를 검증하는 별도 `describe` 블록을 추가한다 — 존재하지 않는 basename 케이스와, 저장소에 실재하는 다중매치 basename(`index.ts`, 46개)을 이용한 케이스 2가지.
3. (권장, 비긴급) `[SPEC-DRIFT]` 항목 6개 spec 파일(`4-execution-engine.md` 외 5개) 정정은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 위임돼 있으므로 해당 planner 턴 집행 시 함께 반영한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원 — forced 전원 결과 확보됨, 누락 없음)
  - **제외**: 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 변경 범위(dev-time 스캐너·문서) 밖 |
  | architecture | router 판단 — 신규 아키텍처 결정 없음 |
  | dependency | router 판단 — 의존성 변경 없음 |
  | database | router 판단 — DB 접근 코드 변경 없음 |
  | concurrency | router 판단 — 동시성 코드 변경 없음 |
  | api_contract | router 판단 — API 계약 변경 없음 |
  | user_guide_sync | router 판단 — (참고: 실질 변경이 유저 가이드 문서 자체이나 forced 목록에 documentation·requirement가 이미 이 축을 포괄 검증함) |