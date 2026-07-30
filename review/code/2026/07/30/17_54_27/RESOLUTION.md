# RESOLUTION — review/code/2026/07/30/17_54_27

대상: `WorkflowsService.duplicate()` 캔버스 전체 복제 재구현에 대한 code review (Critical 0 ·
Warning 7 · INFO 13). Warning 7건 전부 + 요청받은 INFO 3건(#4/#5/#7)을 조치했다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING #1 | 코드(동시성) | `a7ab2750a` | `duplicate()` 트랜잭션에 `'REPEATABLE READ'` 명시. `executions.service.ts` 선례 확인 후 재시도(40001) 로직 **없이** 동일하게 적용 — 근거는 아래 "WARNING #1 판단 근거" 참조 |
| WARNING #2 | 코드(테스트 오염) | `0cb0ac86d` (+ 포맷 수정 `e6c6322f4`) | 오염을 먼저 실측 재현한 뒤 조치 — 아래 "WARNING #2 재현 결과" 참조 |
| WARNING #3 | 코드(유지보수성) | `6d3595319` | Node/Edge row 조립 3곳(`duplicate`/`importWorkflow`/`syncNodes`·`syncEdges`)에 "N/3 상호참조" 주석 추가. 값 계산 통합은 리뷰어 자신이 "의도적 발산" 이라 명시해 손대지 않음 |
| WARNING #4 | 코드(유지보수성) | `d98acd850` | e2e C 케이스의 5노드 그래프 payload(72줄)를 `buildFiveNodeGraphPayload()` 헬퍼로 추출 — 183→109줄. 관심사별 `it()` 분리는 SUMMARY 상 선택 사항이라 보류 |
| WARNING #5 | 코드(테스트) | `e782bb829` | "source 만 없고 target 은 있음" fixture 추가. mutation 으로 vacuous 아님을 직접 증명 — 아래 "WARNING #5 mutation 증명" 참조 |
| WARNING #6 | 코드(문서화) | `8783c63d8` | `CHANGELOG.md` 최상단에 항목 추가(SoT: plan/spec 링크 포함) |
| WARNING #7 | 코드(유저가이드) | `e66bbb9c1` | `ui-tour.mdx` + `ui-tour.en.mdx` 양쪽 "더보기(⋮)" 항목에 복제 범위(캔버스 전체 복사, 버전·트리거 비승계) 한 줄 동반 추가 |
| INFO #4 | 코드(범위/문서화, 요청 반영) | `6d3595319` | "본 파일 하단" → "`workflows.service.spec.ts` 의 W3c 가드" 로 구체화 |
| INFO #5 | 코드(요구사항, 요청 반영) | `6d3595319` | W3c 가드 describe 제목·상단 주석을 "importWorkflow·duplicate 전제" 로 확장 |
| INFO #7 | 코드(유지보수성, 요청 반영) | `6d3595319` | `remap()` null 반환 사유 한 줄 주석 추가(엣지 skip 방어 주석과 대칭) |
| (부수) | 위생 | `0ab87ac3f` | `plan/in-progress/workflow-duplicate-nodes-edges.md` 체크리스트의 `/ai-review` 항목을 완료로 갱신 |

spec 관련 항목·SPEC-DRIFT 없음 — Warning/처리 INFO 전부 `codebase/**` 범위였고, 이 브랜치의 spec
정정(`f71839fe6`/`0502e43c7`)은 이미 planner 턴에서 완료된 상태였다.

### WARNING #1 판단 근거 (REPEATABLE READ 재시도 정책)

`executions.service.ts:538-539` 선례(`findById`)를 실제로 읽었다. **순수 read-only** 트랜잭션이고
재시도(40001) 로직이 없다("단순 read 라 deadlock 위험 없음" 주석). `duplicate()`도 같은 성질이다 —
원본 node/edge 를 **다시 write(UPDATE/DELETE)하지 않고** 새 UUID 의 사본 row 만 INSERT 하므로,
Postgres 가 REPEATABLE READ 에서 serialization failure 를 내는 조건(같은 행에 대한 동시
write-write 충돌)이 발생하지 않는다. 따라서 선례와 동일하게 재시도 로직 없이 isolation 만
명시했다 — 선례와 다르게 갈 이유 없음.

테스트 mock 부작용: `duplicate()` 만 `transaction(isolationLevel, cb)` 2-arg 형태로 바뀌어
`mockDataSource.transaction`(1-arg 가정)이 깨졌다. `executions.service.spec.ts` 의 기존 어댑터
패턴(`args.find(a => typeof a === 'function')`)을 그대로 재사용해 해결.

### WARNING #2 재현 결과 (테스트 오염 — 실측 확인)

고치기 전에 `syncNodes()`(`workflows.service.ts`)에 임시 `console.log`를 삽입해
`npx jest workflows.service.spec.ts --runInBand` 로 직접 관측했다:

```
[POLLUTION-PROBE] wf-uuid-1 [ 'n-trig', 'n-loop', 'n-http', 'n-agent', 'n-tool' ]   ← 5회 (오염)
[POLLUTION-PROBE] wf-uuid-1 []                                                      ← 이후 정상
```

`saveCanvas` describe 의 앞쪽 12개 테스트 중 사전 검증(Manual Trigger/reserved-name/label 중복)을
통과해 실제 트랜잭션에 도달하는 5개 테스트가 `duplicate` describe 의 5노드/2엣지 fixture 를
`existingNodes` 로 그대로 물려받고 있음을 확인 — 리뷰어의 주장이 **참**이었다. (중첩 describe
`graphWarningRules backend enforcement` 의 첫 테스트가 `mockTransactionManager.find.mockResolvedValue([])`
를 호출하는 시점부터만 정상화되고, 그 전까지는 아무도 재설정하지 않는다.)

임시 계측을 제거한 뒤 `saveCanvas` describe 자체의 `beforeEach` 에 `mockTransactionManager.find`/`.save`
명시적 재설정을 추가했다. 반영 후 그대로 통과 — 오염이 현재 시점엔 단언 loose 로 인해 실패로
드러나지 않던 landmine 이었을 뿐, 실질 회귀는 없었다.

> **수치 정정 (2차 리뷰 `review/code/2026/07/30/19_06_10` WARNING #1)**: 최초 작성 시 여기와 아래
> §TEST 결과에 적은 "`workflows.service.spec.ts` 단독 137/137" 은 틀렸다. 재실측 결과 —
> `npx jest src/modules/workflows/workflows.service.spec.ts` **단독은 77/77**(1 suite)이고,
> **137/137 은 `src/modules/workflows` 접두 5개 스펙 합산**(workflows.service / workflows.controller /
> workflow-dto-validation / workflow-channel-authorizer / workflow-ownership.util)이다. 두 수치 모두
> 전부 GREEN 이라 테스트 결과 자체는 바뀌지 않지만, 스코프를 잘못 붙인 서술이었다. 같은 오류가 커밋
> 메시지 `e6c6322f4` 에도 전파돼 있다 (커밋 히스토리는 재작성하지 않고 본 노트로 정정을 고정한다).

### WARNING #5 mutation 증명 (vacuous 아님)

"source 만 없고 target 은 있음" fixture 추가 직후:

1. GREEN 확인 — `npx jest -t "대칭 가드 검증"` 통과.
2. `if (!sourceNodeId || !targetNodeId) return [];` 를 `if (!targetNodeId) return [];` 로 임시
   변경(= `!sourceNodeId` 항 제거) 후 재실행 → **RED**: `edges` 길이가 1 대신 2, `sourceNodeId:
   undefined` 인 오염된 행이 insert 페이로드에 노출됨을 직접 확인.
3. 원복 후 재실행 → GREEN, `workflows.service.ts` diff 는 mutation 전후로 무변화(byte-identical)
   임을 `git diff`로 확인.

## TEST 결과

- lint  : 통과 (전체 monorepo — backend/frontend/web-chat/channel-web-chat/internal packages).
  1건의 prettier 오류(WARNING #2 커밋의 줄바꿈)를 발견해 `e6c6322f4` 로 즉시 수정 후 재통과.
  기존 101건의 warning(우리 diff 밖 파일)은 손대지 않음 — 요청 범위 아님.
- unit  : 통과 — backend 412 suites · frontend 281 test files · web-chat 3 suites ·
  channel-web-chat 23 test files · internal packages(6개) 전부. `workflows.service.spec.ts`
  **단독 77/77**, `src/modules/workflows` 접두 5개 스펙 **합산 137/137** (위 수치 정정 노트 참조).
- build : 통과 — backend/frontend/web-chat/channel-web-chat 빌드 + internal packages tsc +
  docker 이미지 빌드(backend/frontend) + backend 프로덕션 이미지 위생 스모크.
- e2e   : 통과 — backend Jest e2e 260/260(310s) + playwright frontend e2e 51/51(54.6s),
  `.claude/tools/run-test.sh e2e`(`make e2e-test-full`) 1회 실행으로 재시도 없이 통과.
  로그: `_test_logs/e2e-20260730-185208.log`

## 보류·후속 항목

- **민감 변경 없음** — DB 마이그레이션·외부 API 계약·인증·결제 관련 항목 없어 sensitive-fix 가드에
  걸린 항목 없음.
- **spec 변경 없음** — 이번 세션에서 spec 반영이 필요한 발견사항 없음(SPEC-DRIFT/spec 결함 모두 0건).
- **INFO 10건 미처리(요청 범위 밖)** — #1(findById TOCTOU), #2(메타 트랜잭션 밖 타이밍, WARNING #1과
  근본 원인 공유하나 `findById` 재이동은 별도 트레이드오프라 미반영), #3(read-skew 회귀 테스트 부재),
  #6(`node.config` 무검증 복사 — 의도된 동작), #8(네이밍 드리프트 `nodeEntities`/`edgeEntities` vs
  `nodeRows`/`edgeRows`), #9(엣지 0건 케이스 전용 단언 부재), #10(`edge.condition` 참조 비교 테스트
  부재), #11(JSDoc `trigger` 문구 spec 명확화 미러링 누락), #12(Swagger 설명 237자), #13(배치 insert
  chunk 미분할). 전부 "필수 아님" 표기 항목이며 이번 요청에 포함되지 않아 그대로 둠 — 필요 시 별도
  세션에서 반영 가능.
- **WARNING #1 관련 INFO #2 (메타-트랜잭션 타이밍)** — REPEATABLE READ 적용 후에도 `findById` 는
  여전히 트랜잭션 밖에서 실행된다(요청받은 조치 범위는 node/edge 조회 2건에 한정). 404 fast-path
  이점과의 트레이드오프이므로 별도 판단 필요 시 후속 검토 권장.
