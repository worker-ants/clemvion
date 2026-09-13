# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — documentation 리뷰어가 CRITICAL 1건(이 PR 이 닫으려 한 "AST 축 예고" 문장이 정작 소스 주석에 정정 없이 남아, 같은 파일 안에서 서로 모순되는 두 서술이 공존)을 지적했다. 기능·보안·데이터 무결성에 영향을 주는 결함은 아니며(테스트 전용 harness 파일의 주석), documentation 리뷰어 본인도 종합 위험도를 MEDIUM 으로 매겼다 — 이를 그대로 채택한다. 그 외 WARNING 3건(리서치 루트 불일치, orphan 주석 잔존, 구분자 비검증)도 전부 국소 수정으로 해소 가능하다. **forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨** — 강제 목록 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 이 PR 이 닫으려 한 바로 그 "예고" 문장이 소스 주석에 정정 없이 남아 있다 — plan 문서는 "AST 로 특정하는 축이 트래커에 등재돼 있다"는 낡은 예고를 닫는 것이 이 PR 의 존재 이유라고 명시하는데, 정작 그 문장이 파일에 한 글자도 안 고쳐진 채 남아 같은 파일 안에서 "이미 발행 축이 구현됐다"는 새 절과 모순된다. 게다가 "AST" 서술은 이 PR 이 실제로 채택한 설계(정규식 기반 메시지 접두 ∩ 카탈로그 부재 교집합)와도 다르다. | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:77` | 77행을 `## 발행 축` 절(245행 이하)로의 전방 참조로 바꾸거나, 원문을 취소선으로 남기고 "2026-09-13 error-code-emission-axis 가 닫았다 — AST 가 아니라 메시지 접두 ∩ 카탈로그 부재 교집합으로" 정정문을 추가 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `resolveSourceLines` 가 자신의 `walkTree` 검색 루트를 독립적으로 재선언하며 `codebase/backend/src` 만 포함 — 같은 파일의 `sourceTexts`(발행 축 판정이 실제로 쓰는 기준집합)는 `codebase/packages` 도 포함해, 같은 기능 안에 서로 다른 두 "백엔드 소스" 정의가 공존한다. 오늘 등록 3항목은 전부 `backend/src` 를 가리켜 발화하지 않지만, 다음 항목이 `packages/` 소스를 `where` 로 인용하면 발행 축 판정은 정상 처리해도 `where` 검증만 "파일을 유일하게 특정할 수 없다"로 거짓 실패한다. | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:92` (vs `:110`) | 루트 배열 `["codebase/backend/src", "codebase/packages"]` 를 공유 상수로 뽑아 두 호출부가 함께 참조하게 한다 |
| 2 | documentation, scope | 헤더 주석 교체 편집이 옛 문장의 꼬리 한 줄을 지우지 않고 남겨, 지금은 어떤 문장에도 붙지 않는 문법적으로 붕 뜬 조각이 됐다 — `spec/5-system/3-error-handling.md §1 (카탈로그)` 를 5행과 중복 인용한다. 이 저장소가 반복 관측해 온 "블록 교체 시 꼬리 미삭제" 결함 클래스의 재발. | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:11` | 11행 삭제(5행이 이미 같은 내용 포함) |
| 3 | maintainability | `parseWhereRefs` 의 다중-위치 구분자(`·`)가 타입/검증으로 강제되지 않는 순수 문자열 관례다. 다음 등록 항목이 `·` 대신 다른 구분자(쉼표 등)를 쓰면 정규식이 첫 번째 줄 번호까지만 매치하고 나머지는 조용히 누락되는데, `refs.length === 0` 가드는 이를 못 잡는다 — 이 PR 이 방금 고친 "여러 위치 중 일부만 검증됨" 결함이 실패 모드만 바꿔 재발할 수 있다. | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:56-63` (`parseWhereRefs`), 데이터 `guide-identifier-scan.ts:339-360` | `where` 를 `{file, lines: number[]}[]` 구조화 타입으로 바꾸거나, `parseWhereRefs` 안에서 매치되지 않고 남은 `\.ts:\d` 패턴이 없는지 검증 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec 6파일(`5-system/4-execution-engine.md`, `3-workflow-editor/{0-canvas,2-edge}.md`, `4-nodes/1-logic/{0-common,7-map,9-foreach}.md`)이 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 여전히 구조화된 "코드"처럼 서술한다. 이 PR 이 실측으로 반증했다(`execution-engine.service.ts:7121·7125·7130` 이 메시지 접두일 뿐이고 `:8017` 의 `nodeExec.error` 엔 `code` 필드가 없다) — 코드(가이드 mdx 정정 + 가드)가 옳고 spec 서술이 낡았다. | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` | 코드는 유지, spec 반영은 project-planner 가 이미 등재된 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:3457`) 처리 시 수행 — (a) `3-error-handling.md §1.4` 에 CONTAINER_* backfill 하거나 (b) 6파일 서술을 `3-loop.md` 가 이미 쓰는 "메시지 접두 전문 인용" 형태로 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `where` 필드가 자유 텍스트 + 정규식 재파싱 설계 — 이미 한 번 결함(단일 매치 누락)을 낳았고, 자매 가드(`impl-anchor-existence.test.ts`)의 구조화 `{file, symbol}` 필드보다 취약한 표현이다 | `guide-identifier-scan.ts:339-357`, `guide-identifier-existence.test.ts:56-63` | 다음 축 추가 시 구조화 필드 고려 |
| 2 | architecture | `GUIDE_EXTERNAL_VOCABULARY`/`GUIDE_NON_EMITTED_VOCABULARY` 두 "거울상" 목록이 여전히 공유 베이스 타입 없음(전 라운드부터 명시적으로 낮은 우선순위 유예, 상태 변화 없음 재확인) | `guide-identifier-scan.ts:306-309, 339-344` | 세 번째 거울상 목록 추가 시 공유 인터페이스 고려 |
| 3 | maintainability | `collectCatalogCodes`(본문 2줄, JSDoc ~38줄)·`computeNonEmittedOffenders`(본문 4줄, JSDoc 15줄) 등 JSDoc 이 본문 대비 과도하게 길어 "무엇을 하는가" 파악에 서사를 통과해야 함 | `guide-identifier-scan.ts:394-434, 461-479` | "무엇을 하는가" 요약 문단을 앞에 분리 |
| 4 | maintainability | 로컬 변수명 `sets` 가 지나치게 일반적(실제로는 발행 축 전용 4-집합 번들) | `guide-identifier-existence.test.ts:158-163` | `nonEmittedSets` 등으로 개명 |
| 5 | maintainability | 리뷰 세션 폴더 경로가 소스 JSDoc 에 영구 인용됨 — `review/**` 는 SoT/영구 보관 대상이 아니라 나중에 정리되면 깨진 링크로 남을 수 있음(기존 파일 스타일과 일치, 신규 도입 아님) | `guide-identifier-scan.ts:251-252, 277, 441, 472-474` | 축이 늘어나면 서지 인용을 CHANGELOG/plan 링크로 이전 검토 |
| 6 | maintainability | 두 허용목록의 "상한 준수"/"재인용" `it()` 골격이 구조적으로 거의 동일하게 반복(판정 로직 자체는 `staleGuideEntries` 로 이미 공유) | `guide-identifier-existence.test.ts:317-330, 450-459` | 세 번째 유사 목록이 생기면 `it.each` 통합 검토, 지금은 조치 불필요 |
| 7 | testing | `resolveSourceLines` 의 `[2건 이상]` 경계 테스트가 이 파일의 다른 모든 대조군과 달리 합성 입력이 아니라 실제 저장소 상태(`index.ts` 46개 중복)에 결합됨 — 실패 방향은 안전(RED, vacuous 아님)하나 무관한 리팩터에 의해 깨질 수 있음 | `guide-identifier-existence.test.ts:576-578` | 향후 리팩터 시 탐색 디렉토리를 주입 가능하게 바꿔 합성 fixture로 전환 검토 |
| 8 | requirement | `where` 검증의 `hits.length !== 1`(0건/2건 이상) 분기를 소비하는 `broken.push` 쪽은 실코퍼스 경로로만 간접 검증(4라운드 연속 문서화된 기존 유예, 상태 변화 없음) | `guide-identifier-existence.test.ts:287` | 조치 불필요(기존 유예 유지) |
| 9 | side_effect | 모듈 스코프 `sourceLinesCache` 에 무효화 경로가 없음 — 오늘은 인-프로세스 소스 뮤테이션 호출부가 없어 안전, 향후 그런 대조군을 추가할 때만 주의 필요 | `guide-identifier-existence.test.ts:87, 562-583` | 필요 시 `sourceLinesCache.delete(key)` 또는 캐시 우회 파라미터 추가 |
| 10 | performance | `resolveSourceLines` 의 basename 캐시가 이전 라운드가 지적한 N+1 `walkTree`(where 참조마다 backend 전체 재순회)를 실제로 닫았음을 확인 | `guide-identifier-existence.test.ts:87-101` | 조치 불필요 — 개선 반영 확인 |
| 11 | performance | `matchAll` 채택으로 인한 정규식 재클론 오버헤드 — 공유 `lastIndex` 오염을 피하기 위한 의도적·문서화된 트레이드오프, 테스트 전용 코드라 영향 미미(기존 라운드 처분과 동일) | `guide-identifier-scan.ts:281-291` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | MEDIUM | CRITICAL 1건(낡은 AST 예고 주석 미정정) + WARNING 1건(orphan 주석 잔존) |
| architecture | LOW | WARNING 1건(resolveSourceLines 검색 루트 불일치) + INFO 2건(기존 유예 재확인) |
| scope | LOW | WARNING 1건(documentation과 동일 지점, 헤더 주석 잔여 꼬리) |
| maintainability | LOW | WARNING 1건(where 구분자 비검증) + INFO 다수(스타일) |
| requirement | LOW | SPEC-DRIFT 1건(이미 등재·역참조 완료) + INFO 2건(기존 유예 재확인) |
| testing | LOW | 신규 결함 없음, INFO 1건(테스트 격리 관점 실코퍼스 결합) |
| performance | NONE | 이전 N+1 이슈 해결 확인, 신규 결함 없음 |
| security | NONE | ReDoS·경로탐색·시크릿·커맨드실행 전부 부재 확인 |
| side_effect | NONE | 신규 결함 없음, INFO 1건(캐시 무효화 경로 부재, 오늘은 안전) |
| user_guide_sync | NONE | 매트릭스 21행 전수 대조, 누락 갱신 0건(KO/EN parity 확인) |

## 발견 없는 에이전트

없음 — 10개 에이전트 전원이 최소 INFO 이상을 남겼다(단, security·performance·side_effect·user_guide_sync 는 실질 결함 없이 "문제 없음" 확인 또는 낮은 우선순위 관찰만 기록).

## 권장 조치사항

1. **[CRITICAL]** `guide-identifier-scan.ts:77` 의 낡은 "AST 축 등재" 예고 문장을 정정한다 — 취소선 + 정정문 추가, 또는 `## 발행 축` 절로의 전방 참조로 교체.
2. **[WARNING]** `guide-identifier-scan.ts:11` 의 orphan 주석 꼬리를 삭제한다(5행과 중복).
3. **[WARNING]** `resolveSourceLines` 와 `sourceTexts` 의 `walkTree` 검색 루트를 공유 상수로 통일해 "소스 기준집합" 정의를 하나로 수렴시킨다.
4. **[WARNING]** `parseWhereRefs` 의 구분자 오기재를 탐지할 수 있도록 `where` 파싱에 커버리지 검증을 추가하거나, 장기적으로 구조화 타입 전환을 검토한다.
5. **[SPEC-DRIFT]** spec 6파일의 `CONTAINER_*` 서술 정정은 project-planner 가 이미 등재된 트래커 항목 처리 시 수행 — 이 PR 이 새로 등재할 것은 없음.
6. 그 외 INFO 항목은 즉시 조치 불요, 축이 늘어나거나 관련 코드가 재구성될 때 함께 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (10명)
  - **제외**: 표 (아래, 4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — **forced 전원 결과 확보됨, 미이행 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단 — 이 diff 는 의존성 추가/변경 없음(harness 테스트/문서 정정만) |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 관련 코드 변경 없음 |
  | api_contract | 라우터 판단 — API/DTO 계약 변경 없음 |