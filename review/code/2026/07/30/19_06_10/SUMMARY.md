# Code Review 통합 보고서

대상: `WorkflowsService.duplicate()` 캔버스(node/edge) 전체 복제 재구현 + 직전 라운드
(`review/code/2026/07/30/17_54_27`) Warning 7건·요청 INFO 3건에 대한 fix 커밋 반영 검증 (2차/fresh 라운드).

## 전체 위험도

**LOW** — CRITICAL 0건. WARNING 은 1건뿐이며 그마저 **코드 결함이 아니라 `RESOLUTION.md`(직전 라운드
감사 문서) 자체의 테스트 수치 서술 오류**(실제 테스트는 전부 GREEN). 12개 reviewer 전원이 개별 위험도를
LOW 또는 NONE 으로 판정했고, 인가/SQL 인젝션/IDOR/트랜잭션 원자성/REPEATABLE READ 격리 적용 등 핵심
보안·동시성·데이터 무결성 항목은 모두 문제 없음으로 직접 재검증됨. forced(router_safety) 지정 7개
reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원
결과 확보 확인 — 강제 화이트리스트 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `RESOLUTION.md`(직전 라운드 fix 감사 문서)의 테스트 검증 수치 서술이 실측과 불일치 — "`workflows.service.spec.ts` 단독 137/137" 이라 주장하나, `npx jest workflows.service.spec.ts` 단독 실행 결과는 **77/77**이고 "137" 은 workflows 모듈 접두 5개 스펙 파일(`workflows.service.spec.ts`+`workflows.controller.spec.ts`+`workflow-dto-validation.spec.ts`+`workflow-channel-authorizer.spec.ts`+`workflow-ownership.util.spec.ts`) **합산** 수치임. requirement·testing·documentation 3개 reviewer 가 각각 독립적으로 `npx jest` 재실행해 동일하게 확인(중복 발견 통합). 코드/테스트 자체의 결함 아님 — 두 수치 모두 그 자체로는 전부 통과(GREEN)하며 실제 회귀는 없음. 같은 부정확한 수치가 `RESOLUTION.md` 2곳 + 커밋 메시지(`e6c6322f4`) 1곳까지 총 3곳에 전파됨 | `review/code/2026/07/30/17_54_27/RESOLUTION.md:55`, `:74-76` (+ 커밋 메시지 `e6c6322f4`) | `RESOLUTION.md` 의 "137/137" 을 "77/77(단독)" 로 정정. "137" 을 인용하려면 "workflows 접두 5개 스펙 파일 합산 137/137" 처럼 스코프를 명시. 코드 수정 불요 — 감사 문서 표현만 정정하면 됨 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security, requirement, database, concurrency | 존재확인(`findById`, 원본 메타데이터 포함)이 `REPEATABLE READ` 트랜잭션 **밖**에서 수행됨 — 확인 시점과 트랜잭션 오픈 사이 극히 좁은 창에서 원본이 동시 삭제되면 "메타만 있고 캔버스가 빈" 사본이 조용히 생성될 수 있고(security/requirement/database 관점), 동시 `update()` PATCH 가 끼어들면 이름·태그는 옛 값·캔버스는 새 값인 시점 불일치 사본이 만들어질 수 있음(concurrency 관점). 4개 reviewer 공통 지적이나 `id`는 이미 워크스페이스 스코프 검증을 통과한 뒤라 인가 우회·교차 테넌트 유출은 아니고, `RESOLUTION.md`(INFO #2)가 "node/edge 조회 2건 한정 조치, `findById` 는 404 fast-path 이점과의 트레이드오프로 현행 유지"라고 명시한 의식적 보류 항목 | `workflows.service.ts:234`(`findById`, 트랜잭션 밖) ↔ `:245`(`transaction('REPEATABLE READ', ...)` 오픈) | 현행 유지 가능(발생확률 극히 낮음, 크래시·데이터 손상·교차 테넌트 유출 없음). 완전 차단하려면 `findById` 를 트랜잭션 내부 첫 쿼리로 이동(404 fast-path 이점 상실 트레이드오프) |
| 2 | testing, concurrency, requirement | `REPEATABLE READ` isolation 수정 자체를 지키는 저비용 유닛 단언이 없고(`mockDataSource.transaction` 이 인자값이 아니라 콜백 존재 여부만 검사), 동시 편집 중 복제(두 SELECT 사이 실제 커밋 개입) 시나리오를 재현하는 통합/e2e 테스트도 부재 — 향후 isolation 인자가 실수로 제거돼도 어떤 테스트도 못 잡음. 3개 reviewer 공통 지적, `RESOLUTION.md` 가 "요청 범위 밖"으로 명시 보류 | `workflows.service.spec.ts` `describe('duplicate', ...)`(387-714행), `workflow-crud.e2e-spec.ts` `it('C. ...')` | 최소 비용: `expect(mockDataSource.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function))` 단언 1줄 추가 권장(저비용·고효과). 실제 동시성 시나리오 재현 통합 테스트는 비용 대비 선택 사항 |
| 3 | performance, database | Node/Edge 배치 insert 가 chunk 분할 없이 단일 다중-VALUES INSERT 로 전송됨 — 이론상 매우 큰 캔버스(Node 약 5,900개/Edge 약 9,300개 초과)에서 Postgres bind 파라미터 상한 도달 가능. 기존 `importWorkflow()` 가 이미 채택한 동일 패턴 재사용이라 이번 diff 가 새로 만든 리스크 아님, 사용자가 직접 그리는 캔버스 특성상 실무 발생 가능성 낮음 | `workflows.service.ts:303-305`(Node), `:327-329`(Edge) | 조치 불필요. 향후 대량 자동 생성 경로가 추가되면 `manager.insert(..., { chunk: N })` 분할을 `duplicate()`/`importWorkflow()` 양쪽에 함께 검토 |
| 4 | security | `node.config`(JSONB) 를 검증·새니타이징 없이 그대로 복제 — HTTP 노드 커스텀 헤더 등에 사용자가 직접 입력한 시크릿 형태 값도 함께 복제됨. 사본은 항상 원본과 동일한 워크스페이스에만 생성되어(`findById(id, workspaceId)` 로 강제) 테넌트 경계를 넘는 유출은 아니며 "복제" 기능의 의도된 동작과 일치 | `workflows.service.ts:297`(`config: { ...node.config }`) | 조치 불필요. 향후 "워크스페이스 간 템플릿 공유" 등 기능 추가 시 이 무검증 복사 경로 재사용 주의(그때는 시크릿 redaction 필요) |
| 5 | testing | `duplicate()` 컨트롤러 레벨 pass-through wiring 유닛 테스트 부재 — 형제 엔드포인트(`saveCanvas`/`restoreVersion`)는 동일 패턴의 전용 테스트가 있음. 직전 라운드의 "기존 관례와 일관" 판단은 실측 결과 부정확했음(정정). 실제 위험은 낮음 — 타입 시그니처가 인자 오용을 컴파일 타임에 방지하고 e2e 가 인자 순서 오류를 간접 포착 | `workflows.controller.spec.ts`(해당 테스트 없음) / `workflows.controller.ts:224-230` | 선택 사항. `saveCanvas`/`restoreVersion` 과 동일한 3줄짜리 pass-through 테스트 추가 시 관례 회복 + 향후 회귀 지점 특정 용이 |
| 6 | testing | (이월, 의도적 보류 재확인) `nodeRows.length > 0 && edgeRows.length === 0`(엣지만 없는) 조합 전용 단언 부재 — `importWorkflow()` 에는 이 조합의 대칭 단언이 있어 `duplicate()` 와 비대칭 | `workflows.service.ts:303`, `:327` | 우선순위 낮음(이미 검토·보류). 원본 엣지 0건 fixture 추가해 `manager.insert` 가 Node 로만 호출됨을 단언하면 닫힘 |
| 7 | testing | (이월, 의도적 보류 재확인) `node.config`/`edge.condition` 참조 격리(에일리어싱) 미검증 — 테스트가 `toEqual`(값 비교)만 하고 `not.toBe`(참조 비교) 없음. 공유 mock 객체(`mockTransactionManager`)의 구조적 재대입에 `tsc --noEmit` 이 TS2339 를 보고하나 이번 diff 이전부터 있던 패턴이라 신규 결함 아님 | `workflows.service.ts:297`, `:323`(`edge.condition`, 얕은 복사조차 없음) | 우선순위 낮음(이미 보류 결정). 참조 독립성이 실제 불변식이면 `edge.condition` 도 얕은 복사 + 회귀 테스트, `mockTransactionManager` 명시적 타입화 고려 |
| 8 | maintainability | `duplicate()`/`importWorkflow()` 간 변수 네이밍 컨벤션 드리프트(`idMap`/`nodeRows`/`edgeRows` vs `nodeIdMap`/`nodeEntities`/`edgeEntities`) — `RESOLUTION.md` 에 요청 범위 밖으로 명시 보류, 이번에도 미해결 재확인. 기능 영향 없음 | `workflows.service.ts:275,289,309` vs `:427,431,485` | 지금 조치 불필요. 이 영역을 다음에 손댈 때 네이밍 통일 함께 고려 |
| 9 | maintainability | e2e Test C 가 fixture 추출(`buildFiveNodeGraphPayload()`) 후에도 단일 `it()` 안에 5개 관심사(메타/export구조/DB쿼리/원본불변/버전스냅샷) 유지 — 원래 WARNING 의 필수 요구사항(fixture 추출)은 충족됐고 `it()` 분리는 처음부터 선택 사항으로 명시된 항목 | `codebase/backend/test/workflow-crud.e2e-spec.ts:226-333` | 필수 아님. 여유가 되면 관심사별로 `it()` 2~3개 분리 고려 |
| 10 | maintainability | `@ApiOperation.description` 이 237자 단일 라인 문자열 — 같은 파일의 다른 엔드포인트 설명도 동일 스타일이라 이번 diff 가 만든 편차 아니고 내용은 정확함 | `workflows.controller.ts:215` | 필수 아님. 가독성 필요 시 멀티라인 template literal 분리 고려 |
| 11 | concurrency | `originalNodes`/`originalEdges` 두 독립 조회가 순차 `await` — 같은 트랜잭션의 단일 스냅샷을 이미 공유해 정확성 문제는 없으나, 이 fix 가 직접 인용하는 선례(`executions.service.ts`)의 `Promise.all` 병렬화 관례와 스타일이 다름 | `workflows.service.ts:263`(Node), `:266`(Edge) | 필수 아님(RTT 1회 차이 수준). 일관성 원하면 `Promise.all` 로 통일 가능 |
| 12 | side_effect | `duplicate()` 의 신규 2-인자 `transaction(isolationLevel, cb)` 호출이 파일 전체가 공유하는 `mockDataSource.transaction` mock 의 호출 계약을 바꿔야 했음 — `args.find(a => typeof a === 'function')` 로 일반화해 기존 1-인자 호출부(`create`/`importWorkflow`/`saveCanvas`) 에 영향 없이 하위호환 안전함을 직접 검증 | `workflows.service.ts:245` (mock: `workflows.service.spec.ts:90-99`) | 조치 불필요(이미 안전 확인). 향후 유사 호출 추가 시 동일 variadic 어댑터 패턴 재사용 |
| 13 | side_effect | `duplicate` describe 의 `beforeEach` 가 파일 전역 공유 `mockTransactionManager.find`/`.save` 를 재대입해 인접 `saveCanvas` describe 로 오염이 전파될 수 있었으나, 같은 diff 안에서 `saveCanvas` describe 자신의 `beforeEach` 에 명시적 재설정이 이미 추가되어 차단 확인됨(실측 계측 근거 주석 포함) | 오염원 `workflows.service.spec.ts:502-513`, 방어 코드 `:729-735` | 조치 불필요(이미 반영). 향후 `mockTransactionManager` 재대입하는 새 describe 추가 시 동일 패턴(자신의 `beforeEach` 에서 명시적으로 되돌리기) 표준화 |
| 14 | side_effect | (긍정적 변경) `tags`/`settings` 를 원본과 참조 공유하던 기존 코드를 방어적 얕은 복사로 변경 — 사본을 이후 in-place 변이해도 원본 인메모리 객체가 오염되지 않도록 잠재적 에일리어싱 부작용을 제거함 | `workflows.service.ts:252`(`tags`), `:254`(`settings`) | 없음 — 참고용 긍정 기록 |
| 15 | api_contract | `duplicate()` 응답 바디가 여전히 workflow 메타데이터만 담고 새로 복제된 node/edge 배열 자체는 노출하지 않음 — 클라이언트가 결과 캔버스를 확인하려면 별도 `GET /:id/export` 필요. `POST /api/workflows`(신규 생성) 응답도 동일 패턴이라 이번 diff 가 만든 비일관성은 아님 | `workflows.controller.ts:218-220`, `dto/responses/workflow-response.dto.ts:6-54` | 필수 아님. 응답 확장 원하면(`nodeCount`/`edgeCount` 요약 등) 별도 논의 필요 |
| 16 | api_contract | "메타만 복제" 결함에 의존해 duplicate 후 캔버스를 수동 재구성하던 외부 자동화가 있었다면, 이번 fix 이후 캔버스 이중 생성이 이론상 가능 — 내부 제품(비공개 API)이고 결함이 명백히 깨진 상태였다는 점에서 실제 발생 가능성 낮음. breaking change 아님 | `CHANGELOG.md:3-18` | 조치 불필요. 향후 공개 API 화 시 이런 "결함 의존 우회 코드" 리스크를 deprecation notice 급 채널로 공지하는 절차 고려 |
| 17 | user_guide_sync | `saving-and-sharing.mdx`(+`.en.mdx`) 가 export/import 의 "실행이력·버전기록 미포함"은 설명하지만 duplicate 범위는 언급하지 않음 — 1차 리뷰 때부터 선택적 보강 후보였을 뿐 확정 WARNING 대상(`ui-tour.mdx`/`.en.mdx`)은 아니었으므로 새로운 누락 아님. 필수 target 은 이미 충족됨 | `codebase/frontend/src/content/docs/03-workflow-editor/saving-and-sharing.mdx` | 조치 불필요(선택 사항) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | TOCTOU 존재확인-트랜잭션 분리(INFO#1), node.config 시크릿 무검증 복제(INFO#4). 인가/IDOR/SQL인젝션/ID예측가능성/참조무결성/시크릿노출 전부 문제 없음 직접 확인 |
| performance | LOW | 배치 insert chunk 미분할(INFO#3). 알고리즘 O(N+E)·Map 기반 O(1) lookup·N+1 없음·격리수준 변경 성능영향 없음 확인 |
| requirement | LOW | RESOLUTION.md 수치 오기재(WARNING#1, 통합) 최초 발견. TOCTOU/read-skew 테스트 부재는 carry-over(INFO#1,#2). 기능완전성·엣지케이스·spec fidelity 전부 재검증 완료 |
| scope | NONE | 발견 없음 — resolution 라운드 11개 커밋 전부가 SUMMARY 항목과 1:1 대응, 스코프 이탈 0건 |
| side_effect | LOW | 공유 mock 계약 변경(INFO#12, 안전확인)·mock 오염 가능성(INFO#13, 이미 방어)·tags/settings 방어적 복사(INFO#14, 긍정적). 시그니처/인터페이스/전역변수/파일시스템/네트워크/이벤트 전부 불변 확인 |
| maintainability | LOW | 네이밍 드리프트(INFO#8)·e2e it() 다중관심사(INFO#9)·Swagger 장문설명(INFO#10) 전부 의도적 보류 재확인. 직전 WARNING 2건 fix 정확히 반영 확인 |
| testing | LOW | RESOLUTION.md 수치 오기재(WARNING#1, 통합) 재확인. REPEATABLE READ 회귀테스트 부재(INFO#2)·controller wiring 테스트 부재(INFO#5)·carry-over 2건(INFO#6,#7). 직전 WARNING 2건(mock오염·OR가드mutation) 해소를 `npx jest` 재실행(77/77)으로 직접 검증 |
| documentation | LOW | RESOLUTION.md 수치 오기재(WARNING#1, 통합) 최초 발견(문서 관점). CHANGELOG/Swagger/JSDoc/ui-tour ko-en/plan-spec 전부 실측 대조로 정확·일치 확인 |
| database | LOW | 배치 insert chunk 미분할(INFO#3)·TOCTOU carry-over(INFO#1). REPEATABLE READ 적용을 TypeORM 소스·선례(`executions.service.ts`)·saveCanvas 트랜잭션 원자성까지 직접 열어 재검증 |
| concurrency | LOW | 메타데이터 읽기 타이밍(INFO#1)·REPEATABLE READ 회귀테스트 부재(INFO#2)·순차조회 스타일(INFO#11). 직전 라운드 read-skew WARNING 이 REPEATABLE READ 명시로 정확히 해소됐음을 재검증 |
| api_contract | NONE | 응답에 node/edge 미노출(INFO#15)·과거결함의존 우회 이론적 위험(INFO#16). wire contract(라우트/상태코드/DTO/에러응답/인증) 완전 불변, breaking change 없음 |
| user_guide_sync | NONE | saving-and-sharing.mdx 미언급은 선택 사항(INFO#17). 1차 WARNING(ui-tour 미갱신)이 같은 PR 내 `e66bbb9c1` 로 ko/en 동시 해소됐음을 diff+commit log+3개 resolution 산출물 교차 확인 |

## 발견 없는 에이전트

- **scope** — CRITICAL/WARNING/INFO 전부 0건. resolution 라운드 11개 커밋 전부 SUMMARY 항목과 1:1 대응, 스코프 이탈·무관한 수정·불필요한 리팩토링 없음.

## 권장 조치사항

1. (문서 정정, 선택) `review/code/2026/07/30/17_54_27/RESOLUTION.md:55`, `:74-76` 의 "`workflows.service.spec.ts` 단독 137/137" 을 "77/77(단독)"로 정정 — 코드 수정 불요, 3개 reviewer 가 독립 재현한 유일한 WARNING.
2. (테스트 보강, 저비용·권장) `duplicate` describe 에 `expect(mockDataSource.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function))` 단언 1줄 추가 — 향후 isolation level 회귀를 유닛 테스트로 저비용 포착.
3. (선택) `workflows.controller.spec.ts` 에 `duplicate` pass-through wiring 테스트 3줄 추가 — 형제 엔드포인트(saveCanvas/restoreVersion)와 관례 일치.
4. 나머지 INFO(네이밍 드리프트, e2e it() 분리, chunk 미분할, config/condition 참조격리, 응답 노드/엣지 미노출 등)는 전부 우선순위 낮음·의도적 보류로 확인됨 — 즉시 조치 불필요, 다음에 해당 영역을 손댈 때 함께 고려.
5. 병합(merge) 차단 사유 없음 — CRITICAL 0건, 유일한 WARNING 은 코드가 아닌 감사 문서 수치 정정 건.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보 확인 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단 — 이번 changeset 범위(단일 서비스 메서드 재구현) 밖 |
  | dependency | router 판단 — 신규 의존성 추가 없음(코드 리뷰어들이 직접 확인: node:crypto 내장 모듈만 사용) |