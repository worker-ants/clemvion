# Code Review 통합 보고서

대상: `WorkflowsService.duplicate()` 재구현 — 워크플로우 복제가 메타 row 만 생성하고 nodes/edges 를
복사하지 않던 결함을 트랜잭션 기반 캔버스 전체 복제(UUID 재매핑 포함)로 수정. 관련 controller
Swagger 설명, unit 11건, e2e 보강, spec 2곳(`spec/2-navigation/1-workflow-list.md`,
`spec/data-flow/11-workflow.md`), 신규 plan 문서 포함 23개 파일.

## 전체 위험도

**MEDIUM** — CRITICAL 은 없으나, (1) 동시 편집 중 `saveCanvas()` 커밋과 겹치면 read skew 로 사본
그래프가 조용히 불일치할 수 있는 실질적 동시성 결함(concurrency, 같은 클래스의 버그가 이 저장소
`executions.service.ts` 에 이미 발견·수정된 선례 있음)과, (2) 신규 단위테스트의 mock 재대입이
`jest.clearAllMocks()` 로 지워지지 않고 뒤이은 `saveCanvas` 테스트 블록으로 누수되는 것을 실제 계측으로
확인한 테스트 오염(testing/side_effect 공통 지적) 두 건이 실질적 WARNING 으로 확인되어 병합 전 검토가
권장된다. **forced(router_safety) 7개 reviewer 전원 결과 확보 확인** — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

이번 리뷰에서 CRITICAL 등급 발견사항 없음(10개 reviewer 전원 CRITICAL 0건).

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `duplicate()` 의 원본 node/edge 조회가 트랜잭션 안에서 별도 `manager.find` 2회(SELECT)로 쪼개져 있고 기본 isolation(Postgres `READ COMMITTED`)은 스냅샷을 공유하지 않는다. 그 사이 동시 `saveCanvas()` 커밋이 끼면(신규 노드+엣지 추가) `idMap` 에 없는 노드를 참조하는 엣지가 조용히 skip 되어 그래프 일관성이 깨진 사본이 만들어진다. 노드 삭제 시에는 드물게 Manual Trigger 불변식 위반 사본도 배제되지 않는다. 동일 클래스의 read-skew 버그가 이 저장소 `executions.service.ts` 에 이미 발견·수정된 선례(`REPEATABLE READ` 트랜잭션으로 해결)가 있다. | `codebase/backend/src/modules/workflows/workflows.service.ts:236`(트랜잭션 오픈, isolation 미지정), `:254-259`(별도 SELECT 2회) | `this.dataSource.transaction('REPEATABLE READ', async (manager) => {...})` 로 isolation 을 명시해 두 SELECT 가 단일 스냅샷을 공유하게 한다(`executions.service.ts` 기존 해법 재사용, 락 불필요라 저비용) |
| 2 | 테스트/부작용 | 신규 `duplicate` describe 의 `beforeEach` 가 파일 전역 공유 mock(`mockTransactionManager.find`/`save`)을 재대입하는데, `jest.clearAllMocks()` 는 호출 이력만 지우고 구현(재대입된 값)은 지우지 않는다. 그 결과 바로 뒤에 실행되는 `saveCanvas` describe 앞쪽 5~12개 테스트가 "기존 노드/엣지 없음"을 가정한 채로 실제로는 `duplicate` fixture 의 유령 데이터(5노드/2엣지)를 물려받아 실행된다. 별도 최소 재현 스펙 + 실제 파일 임시 계측(`console.log`)으로 오염 전파를 직접 관측 확인. 현재는 영향받는 테스트들의 단언이 느슨해 실패로 드러나지 않지만(76/76 통과), 향후 더 엄격한 단언 추가나 실행 순서 변경 시 원인 특정이 어려운 landmine. | `codebase/backend/src/modules/workflows/workflows.service.spec.ts:492-507`(`duplicate` describe 의 재대입), 영향 범위 `:687-1000`(`saveCanvas` describe 앞쪽 테스트들, 첫 리셋은 `:1005` 중첩 describe 에서야 발생) | `saveCanvas` describe 의 `beforeEach`(688행)에 `mockTransactionManager.find = jest.fn().mockResolvedValue([])`(필요시 `.save` 도) 명시적 재설정 추가. 근본적으로는 `mockTransactionManager` 를 매 테스트 새로 생성하는 팩토리로 전환해 describe 간 상호 오염을 구조적으로 차단 |
| 3 | 유지보수성 | Node/Edge row 조립 로직("동일 필드 이름 집합으로 값만 다르게 계산")이 파일 내 3곳(`syncNodes`/`syncEdges`, `importWorkflow()`, `duplicate()`)에 중복 존재. Node/Edge 엔티티에 컬럼이 추가되면 3곳 모두 손으로 동기화해야 하고, `manager.insert` 호출부가 전부 `as QueryDeepPartialEntity<...>[]` 로 타입 체크를 우회해 하나만 빠뜨려도 컴파일 에러 없이 조용히 필드가 유실될 수 있다. | `codebase/backend/src/modules/workflows/workflows.service.ts:271-309`(신규, cf. 기존 `:409-476`, `:913-1000`) | 최소한 필드 이름 집합만 공유하는 얕은 헬퍼(`buildNodeRow`/`buildEdgeRow`) 도입 또는 "컬럼 추가 시 3곳 동기화 필요" 상호참조 주석 추가. 값 계산(게이트) 자체의 완전 통합은 불필요(의도적으로 발산) |
| 4 | 유지보수성 | 신규 e2e 테스트 C 케이스가 183줄·최소 6개 관심사(메타 검증/구조 검증/DB UUID 비중첩/원본 불변/버전 스냅샷 0건 등)를 단일 `it()` 에 담아 다른 테스트(25~40줄) 대비 4~7배 김. 로컬 변수도 15개 이상이라 실패 시 어느 단언인지 파악하려면 전체를 다시 훑어야 함. | `codebase/backend/test/workflow-crud.e2e-spec.ts:144-325` | 최소한 5노드 그래프 payload 구성을 별도 헬퍼로 추출해 테스트 본문을 검증 로직 위주로 축소. 여유가 되면 관심사별로 `it()` 2~3개 분리도 고려(필수 아님) |
| 5 | 테스트 | `if (!sourceNodeId \|\| !targetNodeId) return [];` OR 가드의 대응 테스트가 "target 만 없음" 케이스만 검증한다. "source 만 없고 target 은 있음" fixture 가 없어 `!sourceNodeId` 검사 자체가 통째로 삭제되는 변형(mutation)은 이 스위트로 잡히지 않는다. `importWorkflow` 의 동일 구조 가드도 같은 사각지대 가능성 있음. | `codebase/backend/src/modules/workflows/workflows.service.ts:294`(가드), 대응 테스트 `workflows.service.spec.ts:656-675` | source 노드가 빠지고 target 은 살아있는 두 번째 fixture 케이스를 추가해 두 피연산자를 대칭 검증 |
| 6 | 문서화 | 완전히 깨져 있던 사용자 대면 기능("복제 = 빈 워크플로우 생성")을 고치는 수정인데 `CHANGELOG.md` 에 항목이 없다. 최근 30개 커밋의 `fix(engine)`/`fix(web-chat)`/`fix(navigation)` 류 사용자 대면 회귀 수정은 전부 CHANGELOG 항목을 동반한 저장소 관행과 어긋난다(단, `CLAUDE.md`/`PROJECT.md`/`developer` SKILL 어디에도 명문화된 강제 규칙은 아님). | `CHANGELOG.md`(수정 대상 23개 파일에 없음 — 부재 자체가 지적) | `## Unreleased — 워크플로우 복제가 nodes/edges 를 복사하지 않던 결함 수정` 항목 추가 권장 |
| 7 | 유저가이드동기화 | `POST /workflows/:id/duplicate` 의 동작 변경(빈 워크플로우 생성 버그 → 캔버스 전체 복제, 단 버전 이력·트리거(webhook/schedule)·테스트 데이터셋은 비승계)이 공개 user-guide MDX 에 반영되지 않음. 내부 spec(`spec/2-navigation/1-workflow-list.md` §2.6 등)은 이번 changeset 안에서 정확히 갱신됐으나 최종 사용자가 읽는 문서는 아니다. 특히 "캔버스는 전부 복사되는데 트리거는 왜 안 남지?" 라는 혼란을 낳을 수 있는 비대칭 동작이라 안내 가치가 있다. | `codebase/frontend/src/content/docs/01-getting-started/ui-tour.mdx`(+`.en.mdx`, 97/86행 "복제" 언급, 범위 미설명) | 더보기 메뉴 설명에 "복제는 노드·연결선을 포함한 캔버스 전체를 복사하지만, 버전 기록과 트리거(웹훅/스케줄) 설정은 새로 시작해요" 수준의 한 줄 추가. `verify`/`guard_tests` 없는 수동 검토 항목이라 CRITICAL 아님 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항/데이터베이스 | `findById(id, workspaceId)` 존재확인이 트랜잭션 오픈 **전**에 수행됨. 확인과 트랜잭션 오픈 사이 극히 좁은 창에서 동시 삭제(FK CASCADE)가 발생하면 트랜잭션 내부의 node/edge 조회가 빈 배열을 반환해 "빈 캔버스" 사본이 조용히 생성될 수 있다(단, 인가 우회·교차 테넌트 유출은 아니며 `update`/`remove` 등 기존 메서드도 동일 패턴, 발생확률 극히 낮음). | `codebase/backend/src/modules/workflows/workflows.service.ts:233-236` | 필수 아님. 엄격성이 필요하면 트랜잭션 내부에서 존재 재확인 또는 pessimistic lock 고려 |
| 2 | 동시성 | 원본 메타데이터(`name`/`description`/`tags`/`folderId`/`settings`)가 트랜잭션 **밖**에서 읽혀, 트랜잭션 내부 node/edge 스냅샷과 시점이 어긋날 수 있다(동시 `update()` 시 "메타는 옛 값, 캔버스는 새 값" 조합 가능). 위 WARNING #1 과 근본 원인 동일. | `codebase/backend/src/modules/workflows/workflows.service.ts:234` vs `:236` | WARNING #1 을 `REPEATABLE READ` 로 고칠 때 `findById` 도 같은 트랜잭션에서 첫 쿼리로 재이동하면 함께 해소. 404 fast-path 이점을 유지하려면 현행 유지 + 주석으로 트레이드오프 명시도 가능 |
| 3 | 동시성 | 동시 편집 중 복제(read-skew) 시나리오에 대한 회귀 테스트 부재 — 신규 unit 11건/e2e C 케이스 모두 "복제 도중 원본이 정적"이라는 전제로 작성됨. mock 기반 unit 으로는 이 클래스의 버그를 구조적으로 포착하기 어렵다. | `workflows.service.spec.ts`(신규 `duplicate` describe), `test/workflow-crud.e2e-spec.ts`(C 케이스) | WARNING #1 수정 시 e2e 레벨 회귀 테스트(동시 `saveCanvas` 커밋 흉내) 함께 고려. 필수는 아님 — 코드 수정이 우선 |
| 4 | 범위/문서화 | 신규 주석이 "같은 전제를 고정하는 가드 테스트가 **본 파일 하단**에 있다" 고 적었으나, 실제 가드 테스트(`describe('importWorkflow 전제 — Node/Edge 엔티티 @BeforeInsert 부재·cascade 메타데이터 가드 (W3c)', ...)`)는 `workflows.service.ts` 가 아니라 별도 파일 `workflows.service.spec.ts:2222` 에 있다(소스 파일은 애초에 `describe` 블록을 가질 수 없음). 주장 내용 자체는 사실이라 근거 없는 주석은 아니고 자기참조 표현의 정밀도 문제. | `codebase/backend/src/modules/workflows/workflows.service.ts:263-264` | "본 파일 하단" → "`workflows.service.spec.ts` 의 W3c 가드" 로 구체화 |
| 5 | 요구사항 | `@BeforeInsert` 부재 가드 테스트의 describe 제목이 `importWorkflow` 만 언급해, `duplicate()` 도 같은 전제에 기댄다는 사실을 찾기 번거로움(discoverability). | `workflows.service.spec.ts:2222` | 필수 아님. 제목을 "importWorkflow·duplicate 전제 — ..." 로 확장 권장 |
| 6 | 보안 | `node.config` 을 검증/새니타이징 없이 그대로 복사 — 사용자가 노드에 직접 입력한 시크릿 형태 값(예: HTTP 노드 커스텀 헤더의 수기 토큰)도 함께 복제됨. 다만 사본은 항상 원본과 **동일 워크스페이스**에만 생성되어 테넌트 경계를 넘는 유출은 아니며, "복제" 기능의 의도된 동작과 일치. | `workflows.service.ts:279`(`config: { ...node.config }`) | 별도 조치 불필요. 향후 워크스페이스 간 "템플릿 공유" 기능 추가 시 이 무검증 복사 경로 재사용 주의(그때는 시크릿 redaction 필요) |
| 7 | 유지보수성 | `remap()` 이 컨테이너/toolOwner 참조 매핑 실패 시 조용히 `null` 을 반환하는 이유가 주석으로 설명되지 않음(엣지 쪽 skip 사유는 명시적 방어 주석이 있는 것과 비대칭). | `workflows.service.ts:268-269` | "참조 노드가 원본 조회 결과에 없으면(FK CASCADE 상 발생하지 않아야 하지만) null 로 두어 배치 정보 없는 노드로 취급한다" 같은 한 줄 설명 추가 |
| 8 | 유지보수성 | `duplicate()`(`idMap`/`nodeRows`/`edgeRows`) 와 `importWorkflow()`(`nodeIdMap`/`nodeEntities`/`edgeEntities`) 간 변수 네이밍 컨벤션 드리프트. 참고로 `nodeEntities`/`edgeEntities` 이름은 옆 주석("plain literal, entity 인스턴스 아님")과 실제로 어긋나 있어 오히려 신규 `nodeRows`/`edgeRows` 쪽이 더 정확함. | `workflows.service.ts:265,271,289` cf. `:407,409,461` | 지금 당장 무관한 리네이밍 불필요. 다음에 이 영역을 다시 손댈 때 `nodeEntities`/`edgeEntities` → `nodeRows`/`edgeRows` 통일 고려 |
| 9 | 테스트 | `nodeRows.length > 0` 이면서 `edgeRows.length === 0` 인 조합("노드는 insert 되지만 엣지는 전혀 없음")이 `duplicate` 테스트에 없음. `importWorkflow` 는 대응하는 전용 단언(insert 1회만 호출)이 있는 것과 비대칭. | `workflows.service.ts:285-287,307-309` | 원본 엣지가 없는 케이스를 추가해 `manager.insert` 가 `Node` 로 1회만, `Edge` 로는 전혀 호출되지 않음을 단언 |
| 10 | 테스트 | workflow 레벨 `tags`/`settings` 는 명시적 이유로 얕은 복사를 하지만 `node.config`(이유 주석 없는 얕은 복사)와 `edge.condition`(복사 없이 원본 참조 재사용)은 비대칭 처리이며, 대응 테스트가 `toEqual` 값 비교만 하고 `not.toBe` 참조 비교를 하지 않아 이 비대칭이 의도인지 누락인지 테스트로 고정돼 있지 않음(실무 영향은 낮음 — 두 값 모두 insert 직후 버려지는 일회성 객체). | `workflows.service.ts:243-245` vs `:279,303` | 필수 아님. 참조 독립성이 불변식이라면 `edge.condition` 도 얕은 복사로 맞추고 참조 비교 테스트 추가, 의도된 비대칭이면 주석으로 근거 기록 |
| 11 | 문서화 | 같은 changeset 이 `spec/data-flow/11-workflow.md` 표에서 "trigger" 를 "`trigger`(webhook/schedule)" 로 명확화(Manual Trigger 노드와의 혼동 방지)했는데, `duplicate()` JSDoc 의 "복제 범위 밖" 문구는 이 명확화를 미러링하지 않고 그냥 `` `trigger` `` 로만 적음. | `workflows.service.ts:225-226` | JSDoc 문구도 `` `trigger`(webhook/schedule) `` 로 맞춰 spec 과 코드 주석이 같은 명확화를 공유하게 함 |
| 12 | 문서화 | 갱신된 `@ApiOperation.description` 이 237자로 `spec/conventions/swagger.md §3` 권장 상한(50~150자)을 초과. 다만 같은 컨트롤러 파일에 이미 281자 선례(`graphWarningRules` 계열)가 있어 "복잡한 부수효과를 정확히 설명하기 위한" 용인 패턴과 일치 — 규약 위반이라기보다 참고 메모. | `workflows.controller.ts:215` | 필수 아님. Swagger UI 가독성을 위해 문장을 좀 더 짧게 쪼개는 것도 고려 가능 |
| 13 | 데이터베이스 | `nodeRows`/`edgeRows` 전체가 chunk 분할 없이 단일 다중-VALUES INSERT 로 전송됨 — Postgres 바인드 파라미터 상한(65,535) 기준 이론상 Node ~5,900개/Edge ~9,300개를 넘는 초대형 캔버스에서 실패 가능. 다만 기존 `importWorkflow()` 도 동일한 형태이고, 사용자가 직접 그리는 캔버스 특성상 실질적으로 그 규모에 도달하지 않아 이번 diff 가 새로 만든 리스크는 아님. | `workflows.service.ts:286,308` | 현재 조치 불필요. 향후 대량 자동 import 시나리오가 생기면 `manager.insert(..., { chunk: N })` 분할 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | findById TOCTOU(INFO#1), `node.config` 무검증 복사(INFO#6) — 인가/IDOR/SQLi/시크릿 하드코딩 문제 없음 |
| requirement | LOW | 존재확인-트랜잭션 분리 레이스(INFO#1), 가드 테스트 제목 discoverability(INFO#5) — 기능/spec 정합(line-level 대조) 완전 충족, TODO/FIXME 없음 |
| scope | NONE | 신규 주석 자기참조 표현 정밀도(INFO#4) 1건 외 범위 이탈·불필요 리팩토링·무관한 수정 없음(23개 파일 커밋 단위 응집도까지 확인) |
| side_effect | LOW | mock 누수(WARNING#2, testing 과 동일 결함 공동 지적) — 프로덕션 코드의 쓰기 표면 확장(트랜잭션·참조 얕은 복사·트리거 미승계)은 방어적으로 잘 처리됨, 공개 시그니처/DTO 불변 확인 |
| maintainability | LOW | Node/Edge row 3중 중복(WARNING#3), e2e 케이스 과대(WARNING#4), `remap()` 주석 부재·네이밍 드리프트(INFO#7,8) |
| testing | MEDIUM | mock 누수 실측 확인(WARNING#2), OR 가드 mutation 사각지대(WARNING#5), 커버리지 갭 2건(INFO#9,10) — 핵심 계약(UUID 재매핑·양대 참조 축 분리·원본 불변) 커버리지는 평균 이상 |
| documentation | LOW | CHANGELOG 미갱신(WARNING#6), 주석 위치 오류(INFO#4)·JSDoc 미러링(INFO#11)·설명 길이(INFO#12) — JSDoc/Swagger/spec/plan 간 실제 정합은 매우 높음 |
| database | LOW | 배치 insert 미분할(INFO#13), TOCTOU 레이스(INFO#1) — 인덱스·트랜잭션 원자성·스키마·파라미터 바인딩 전부 양호, 신규 마이그레이션 없음 |
| concurrency | MEDIUM | READ COMMITTED read skew(WARNING#1, 저장소 내 유사 버그 선례 있음), 메타 타이밍(INFO#2)·회귀 테스트 부재(INFO#3) — 쓰기 측 원자성은 문제 없음, 읽기 측만 결함 |
| user_guide_sync | LOW | `ui-tour.mdx` 동반 갱신 누락(WARNING#7) — 내부 spec 2곳은 매트릭스 요건 충족, frontend 변경 없어 다른 trigger 행 전부 무매칭 |

## 발견 없는 에이전트

없음 — 10개 reviewer 전원 최소 1건 이상(WARNING 또는 INFO)의 발견사항을 보고함. 단 `scope` 는
위험도 NONE(발견은 INFO 1건뿐이며 실질적 범위 이탈 없음).

## 권장 조치사항

1. **(WARNING #1)** `duplicate()` 트랜잭션에 `'REPEATABLE READ'` isolation 을 명시해 node/edge 조회의
   read skew 를 차단한다 — `executions.service.ts` 의 기존 해법을 그대로 재사용 가능한, 가장 실질적인
   프로덕션 코드 결함.
2. **(WARNING #2)** `saveCanvas` describe 의 `beforeEach` 에 `mockTransactionManager.find`/`save` 명시적
   리셋을 추가해 `duplicate` describe 로부터의 mock 오염 누수를 차단한다(실제 계측으로 확인된 landmine).
3. **(WARNING #7)** `ui-tour.mdx`(+`.en.mdx`) 에 복제 범위(캔버스 전체 복사, 버전 이력·트리거 비승계)를
   한 줄 보강한다 — 사용자가 체감하는 동작 변화가 크고 비대칭(캔버스는 복사되나 트리거는 안 됨)이라
   혼란 소지가 있다.
4. **(WARNING #6)** `CHANGELOG.md` 에 이번 버그 수정 항목을 추가한다(저장소 관행).
5. **(WARNING #3, #5)** Node/Edge row 조립 로직에 상호참조 주석(또는 얕은 헬퍼) 추가, e2e C 케이스
   fixture 추출, `sourceNodeId`/`targetNodeId` 반대쪽(source-missing) fixture 보강.
6. 나머지 INFO 13건(주석 문구 정정, JSDoc-spec 미러링, 네이밍 드리프트, 테스트 커버리지 미세 갭 등)은
   병합을 막지 않는 수준이므로 여유가 될 때 일괄 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 위 "실행" 목록에 이미 포함됨. router 자체 판단으로는 제외될 수도 있었으나 안전장치로 강제 실행됨. **forced 전원 결과 확보 확인** — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 산정 결과 제외(세부 사유는 이번 세션에 별도 기록되지 않음). 참고: database 리뷰어가 별도로 "N+1 없음(배치 조회/삽입 각 2회), 기존 `importWorkflow` 배치 패턴 재사용"을 확인해 교차 검증됨 |
  | architecture | 라우터 산정 결과 제외(세부 사유 미기록). 참고: scope 리뷰어가 23개 파일 전수 대조로 "신규 모듈 경계·설정 변경 없음, 기존 `WorkflowsService` 내부 메서드 재구현에 국한"을 확인해 교차 검증됨 |
  | dependency | 라우터 산정 결과 제외(세부 사유 미기록). 참고: security 리뷰어가 "신규 npm 패키지 추가 없음(`node:crypto` 내장 모듈만 사용)"을 확인해 교차 검증됨 |
  | api_contract | 라우터 산정 결과 제외(세부 사유 미기록). 참고: side_effect 리뷰어가 "`duplicate()` 시그니처·응답 DTO(`WorkflowDto`) 불변, 유일한 호출부(controller)만 존재"를 확인해 교차 검증됨 |

  제외된 4개 영역 모두 실행된 다른 reviewer 의 부수 확인으로 실질적 결함이 숨어있지 않음을 간접
  교차검증했다(단, 각 영역 전담 심층 리뷰는 아니므로 완전한 대체는 아님).