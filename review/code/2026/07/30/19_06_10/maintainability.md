# 유지보수성(Maintainability) 코드 리뷰

대상: `WorkflowsService.duplicate()` (캔버스 전체 복제 재구현) + 관련 컨트롤러 문서·단위/e2e 테스트.
이번 세션(`19_06_10`)은 이전 리뷰 라운드(`review/code/2026/07/30/17_54_27`)의 Warning 7건 +
요청 INFO 3건에 대한 fix 커밋(`0cb0ac86d`~`0ab87ac3f`)까지 포함한 전체 diff
(`origin/main...HEAD`, `git diff --stat` 42개 파일)를 대상으로 한다. 실제 "코드" 로 볼 수 있는
파일은 4개(`workflows.controller.ts`, `workflows.service.ts`, `workflows.service.spec.ts`,
`workflow-crud.e2e-spec.ts`)이며, 나머지(CHANGELOG/plan/ui-tour mdx·이전 리뷰/consistency-check
산출물 markdown/json)는 함수 길이·중첩·매직넘버·복잡도 같은 코드 중심 기준이 적용되지 않는 문서
산출물이라 본 리뷰의 핵심 판단 대상에서 제외했다(이전 라운드의 동일 판단과 일치).

## 이전 라운드 Warning/INFO 조치 검증 (실측)

diff 를 직접 읽어 이전 maintainability 라운드의 발견사항이 실제로 해소됐는지 대조했다.

- **WARNING #1 (Node/Edge row 조립 3중 구조적 중복)** — 완전 통합(헬퍼화)이 아니라 상호참조 주석으로
  조치됐다. 실제로 세 지점 모두에 "N/3" 주석이 들어가 있음을 확인했다:
  `workflows.service.ts:284-288`(`duplicate()` nodeRows, "1/3"), `:307-308`(edgeRows, "1/3"),
  `:429-430`(`importWorkflow()` nodeEntities, "2/3"), `:483-484`(edgeEntities, "2/3"),
  `:971-972`(`syncNodes()` newNode, "3/3"), `:1013-1014`(`syncEdges()` newEdges, "3/3"). 세 곳이
  서로를 정확히 가리키고 있어 향후 컬럼 추가 시 최소한 "어디를 더 봐야 하는지" 는 즉시 알 수 있다.
  완전한 헬퍼 통합을 요구하지 않은 원래 제안과 일치하는 최소 조치로, 회귀 없음.
- **WARNING #2 (e2e Test C 183줄·6개 관심사)** — `buildFiveNodeGraphPayload()` 헬퍼로 노드/엣지
  fixture 구성을 추출해 `workflow-crud.e2e-spec.ts:36-118`(헬퍼 정의)로 분리했다. `it('C. ...')`
  본문은 `:226-333`(약 108줄)로 줄었다. 다만 구조적으로는 여전히 메타 검증·export 구조 검증·DB 직접
  쿼리 검증·원본 불변 검증·버전 스냅샷 검증까지 한 `it()` 블록에 남아 있다 — 원래 제안 자체가
  "fixture 추출까지만 필수, `it()` 분리는 선택"이라고 명시했으므로 이는 미조치가 아니라 의도된 범위
  준수다.
- **INFO (`remap()` null 처리 사유 미설명)** — `workflows.service.ts:278-280` 에 "참조 노드가 원본
  조회 결과에 없으면(FK CASCADE 상 발생하지 않아야 하지만) null 로 두어 배치 정보 없는 노드로
  취급한다" 주석이 추가되어 해소됨.
- **INFO (자기참조 위치 부정확 — "본 파일 하단")** — `workflows.service.ts:272-274` 의 JSDoc 이
  "`workflows.service.spec.ts` 의 W3c 가드에 있다" 로 구체화됐고, 대응하는
  `workflows.service.spec.ts:2267` 의 describe 제목도 `importWorkflow·duplicate 전제 — ...` 로
  확장되어 두 방향 모두 일관되게 갱신됨.
- 이 fix 커밋들 자체가 새로 만든 문제는 발견되지 않았다 — `eslint-disable`/`@ts-ignore`/`as any` 류
  타입 우회 신규 도입 없음(grep 확인), `duplicate()` 함수 길이(228-333행, 106줄)는 같은 파일의 기존
  `importWorkflow()`(379-510행, 131줄)와 비슷한 수준이라 이번 diff 가 새로 만든 이례적 규모가 아니다.

## 발견사항 (잔존 — 모두 이미 알려진 트레이드오프, 신규 아님)

- **[INFO]** `duplicate()`/`importWorkflow()` 간 변수 네이밍 컨벤션 드리프트 (재확인, 미해결 — 의도적 보류)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:275`(`idMap`), `:289`(`nodeRows`),
    `:309`(`edgeRows`) — cf. `:427`(`nodeIdMap`), `:431`(`nodeEntities`), `:485`(`edgeEntities`)
  - 상세: 이전 라운드에서 INFO 로 지적된 항목이며, RESOLUTION.md 상 "요청 범위 밖(INFO #8)"으로 명시적
    으로 보류됐다 — 이번에도 그대로 남아 있음을 재확인했다. 기능 영향은 없으나, 같은 파일 안에서
    구조적으로 거의 동일한 로직 3곳이 서로 다른 이름 체계를 쓰는 상태가 그대로다.
  - 제안: 지금 당장 조치는 불필요(의도된 보류). 이 영역을 다음에 다시 손댈 때 `nodeEntities`/
    `edgeEntities` → `nodeRows`/`edgeRows` 로 맞추는 정리를 함께 고려.

- **[INFO]** e2e Test C 가 fixture 추출 후에도 단일 `it()` 안에 5개 관심사(메타/export 구조/DB 직접
  쿼리/원본 불변/버전 스냅샷)를 유지
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:226-333` (`it('C. ...')`)
  - 상세: 위 "이전 라운드 조치 검증"에서 서술한 대로 원래 WARNING 의 필수 요구사항(fixture 추출)은
    충족됐고 `it()` 분리는 처음부터 선택 사항으로 명시됐던 항목이다. 회귀나 신규 결함은 아니지만,
    실패 시 어느 검증이 깨졌는지 파악하려면 여전히 108줄 전체를 훑어야 하는 점은 남아 있다.
  - 제안: 필수 아님. 관심사가 뚜렷이 나뉘므로(메타/구조/DB무결성/원본불변/버전이력) 여유가 될 때
    `it()` 2~3개로 쪼개는 것을 고려할 수 있다.

- **[INFO]** `@ApiOperation.description` 이 237자 단일 라인 문자열로 유지됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:215`
  - 상세: 노드/엣지 복제 범위·재매핑 대상·비승계 항목까지 담아 문장이 상당히 길다. 다만 같은 파일의
    다른 엔드포인트 설명도 동일하게 "단일 긴 문자열" 스타일이라(이전 라운드 확인) 이번 diff 가 새로
    만든 편차는 아니며, 내용 자체는 정확하다.
  - 제안: 필수 아님. 가독성이 중요해지면 Swagger 가 지원하는 멀티라인 template literal 로 분리하는
    정도만 고려.

## 검증했으나 문제 없음 (참고)

- `duplicate()` 트랜잭션 콜백 내부 중첩 깊이는 얕다 — 최대 깊이가 `transaction 콜백 → flatMap 콜백 →
  단일 if` 3단계 수준이고, 분기도 `remap()` 의 삼항 1개·`edgeRows` 의 조기 `return []` 1개뿐이라
  순환 복잡도가 낮다.
- 신규 unit 테스트(`describe('duplicate', ...)`, `workflows.service.spec.ts:387-715`)는 11개 `it()`
  각각이 단일 관심사(메타 승계/버전 비승계/노드 재발급/축 교차 방지/config 보존/게이트 미적용/엣지
  재매핑/원본 불변/빈 캔버스/고아 엣지 skip 대칭 2건/404)로 깔끔히 분리돼 있고, 공유 fixture(`origNodes`/
  `origEdges`)·`insertedRows()` 헬퍼로 중복이 최소화돼 있다. `insertedRows(entity)`(신규, 범용)와
  기존 `insertedNodes()`(`importWorkflow` describe, node 전용, `:1579`)의 이름 체계가 다르지만 서로
  다른 `describe` 블록에 스코프돼 있고 전자가 두 엔티티 타입을 다뤄야 해서 발생한 자연스러운 확장이라
  실질적 불일치는 아니다.
- `mockDataSource.transaction` 어댑터(`workflows.service.spec.ts:91-99`)가 가변 인자에서 콜백 함수를
  찾는 방식으로 일반화된 것은 `executions.service.spec.ts` 의 기존 패턴을 재사용한 것이고, 왜 필요한지
  설명하는 주석도 있어 의도가 명확하다.
- `saveCanvas describe` 의 `beforeEach`(`:719-733`)에 추가된 `mockTransactionManager.find`/`.save`
  재설정과 그 이유를 설명하는 주석("`duplicate` describe 의 beforeEach 가 재대입해둔 잔여가
  `jest.clearAllMocks()` 로도 지워지지 않는다")은 실제로 계측(console.log probe)까지 거쳐 확인된
  결함의 근본 원인을 정확히 설명하고 있어, 향후 유지보수자가 "왜 여기 이 코드가 있는지" 를 다시 조사할
  필요가 없다.
- 매직 넘버/신규 하드코딩 문자열 없음. `" (Copy)"` 접미사는 diff 이전부터 있던 기존 리터럴.
- eslint-disable/@ts-ignore/@ts-expect-error/`as any` 류 타입 안전성 우회가 이번 diff 전체(4개 코드
  파일)에 신규로 추가되지 않았다.

## 요약

이번 라운드는 `WorkflowsService.duplicate()` 최초 구현에 대한 이전 maintainability 리뷰(Warning 2건,
INFO 다수)의 fix 커밋들을 검증하는 성격이 강하다. 직접 diff 를 읽고 대조한 결과 Warning 2건(Node/Edge
row 3중 중복에 대한 상호참조 주석, e2e Test C의 fixture 헬퍼 추출)과 요청된 INFO 2건(remap null 사유
설명, "본 파일 하단" 자기참조 정밀화)이 모두 정확히 그리고 부작용 없이 반영됐음을 line-level 로
확인했다. fix 커밋 자체가 새로 만든 가독성·복잡도·타입 안전성 문제는 발견되지 않았고, `duplicate()`
함수의 길이·중첩 깊이도 같은 파일의 기존 `importWorkflow()` 패턴과 일관된 수준이다. 잔존하는 세 항목
(네이밍 컨벤션 드리프트, e2e 단일 `it()` 다중 관심사, Swagger 설명 장문화)은 전부 이전 라운드에서 이미
식별돼 의도적으로 낮은 우선순위로 보류된 것들의 재확인이며, 병합을 막을 이유가 되는 새로운 문제는
없다.

## 위험도

LOW
