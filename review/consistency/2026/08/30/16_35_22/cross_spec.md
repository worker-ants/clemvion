### 발견사항

- **[WARNING]** `node-cancellation.md` §2.4 소급 footnote 위치가 12곳 중 2곳만 커버한다
  - target 위치: `plan/in-progress/spec-draft-raw-query-results.md` §B "#5 는 표 행이 아니라 소비 경로에 건다" — "종결 직전 재조회 후 '조건부 UPDATE 가 0행이면 skip' 분기 ← 여기에만 건다" 및 "붙일 위치: §2.4 네 번째 불릿"
  - 충돌 대상: `spec/conventions/node-cancellation.md` §2.4 본문(불릿 4개) + §6 구현 현황 표
  - 상세: §2.4 의 4번째 불릿("retry 재진입 종결 경로 terminal 가드")은 실측하면 `retry-turn.service.ts` 의 `finalizeGuarded`/`resumeGraphAfterRetry` **2곳**만 서술한다(§6 표 "retry 재진입 종결 경로 terminal 가드" 행이 그 파일만 명시). 그런데 target 자신이 §B 에서 제시하는 "영향 있음" 12곳(§`execution-engine.service.ts` 7 + `ai-turn-orchestrator.service.ts` 3 + `retry-turn.service.ts` 2)은 셋 이상의 서로 다른 메커니즘에 걸쳐 있다:
    - `failFirstSegmentSetup`·`finalizeFailedExecution` → §2.4 **3번째** 불릿("park↔resume 짝 전이 terminal 가드", §6 표 그 행이 명시)에 있다.
    - `finalizeCancelledExecution` → §2.4 **본문에는 불릿이 없고** §6 표에만 "top-level 취소 종결 경로 terminal 가드" 라는 별도 행으로만 존재한다(§2.4 산문에 대응 서술 없음).
    - `driveResumeAwaited`·`driveCallStackResume`·`driveStuckRedrive`(execution-engine.service.ts) 와 `reparkAiResumeTurn`·`emitAiWaitingForInput`·`finalizeAiNode`(ai-turn-orchestrator.service.ts) — 이 6곳은 `node-cancellation.md` 전체에서 **함수명 자체가 한 번도 등장하지 않는다**(§2.4 불릿에도, §6 표에도 없음). `runExecution` 은 1번째 불릿에 나오지만 그건 `assertExecutionNotCancelled()` dispatch 관측용 언급이라 이번 회귀(반환값 소비)와 다른 맥락이다.
    - 결과적으로 footnote 를 "네 번째 불릿에만" 걸면, 그 불릿의 산문을 읽는 독자는 `retry-turn.service.ts` 의 2곳만 떠올리고 나머지 10곳(특히 §2.4 어디에도 안 걸리는 6곳)에 대한 맥락을 얻지 못한다. target 자신이 §B 서두에서 "행 라벨이 아니라 실제 소비 경로 단위로" 걸어야 반대 방향 drift 를 막는다고 명시했는데, 그 원칙을 정작 이 항목 자신의 위치 선정에는 충분히 적용하지 못했다.
  - 제안: footnote 본문에 "네 번째 불릿" 단일 앵커 대신, 영향받는 3개 파일·메커니즘(§2.4 3번째 불릿 `finalizeFailedExecution`/`failFirstSegmentSetup`, §6 표의 `finalizeCancelledExecution` top-level 종결 행, §2.4 4번째 불릿 `retry-turn.service.ts`, 그리고 §2.4/§6 어디에도 없는 `driveResumeAwaited`/`driveCallStackResume`/`driveStuckRedrive`/ai-turn-orchestrator 3곳)에 개별 소급 표시를 두거나, 최소한 12곳 목록을 footnote 에서 직접 참조해 "네 번째 불릿" 이 대표 사례일 뿐임을 명시할 것. 신규 `raw-query-results.md` 작성 시 함께 조정.

- **[WARNING]** `execution-engine.md` footnote 목표 위치(§1.1)가 "admission gate" 내용을 포함하지 않는다
  - target 위치: `plan/in-progress/spec-draft-raw-query-results.md` §B 표 1행 — "대상: `spec/5-system/4-execution-engine.md` | 붙일 위치: `### 1.1 Execution 상태` | 무엇이 깨져 있었나: admission gate·종결 이벤트가 조건부 UPDATE 결과로 분기하는데 그 분기가 죽어 있었다"
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §1.1(실행 상태 머신, 35~100행)과 §8(동시 실행 제한, `admitExecutionOrDefer`/admission gate 서술 위치)
  - 상세: §1.1 은 Execution 상태·전이표만 다루고 "admission" 관련 서술이 전혀 없다(`grep -n "admission" spec/5-system/4-execution-engine.md` 결과가 전부 §4/§7/§8 범위, §1.1 범위인 35~100행엔 0건). admission gate(= 원 plan 이 언급한 `admitExecutionOrDefer` `rows.length===1` 버그)는 §8 "동시성 cap admission gate"(1121~1140, 1705~1723행)의 소관이다. 반면 footnote 서술의 "종결 이벤트"(원 plan 의 `updateExecutionStatus` `updated.length>0` → "동시 cancel 선점" 사문화) 쪽은 §1.1 의 "원자성 보장" 콜아웃이 바로 `ExecutionEngineService.updateExecutionStatus` 를 지목하므로 §1.1 에 어울린다. 즉 이 항목은 서로 다른 두 절(§1.1·§8)에 걸친 내용을 하나의 앵커(§1.1)로만 지정했다. 이 지정 자체는 원 plan(`update-returning-tuple-shape.md` 397행 부근 "[planner 위임]")에서 그대로 물려받은 것이라, target 이 검증 없이 위임 문구를 그대로 옮겼을 가능성이 있다.
  - 제안: admission gate 관련 서술은 §8("동시성 cap admission gate" 섹션, 1705행 부근)에 별도로 소급 각주를 걸고, §1.1 각주는 "종결 이벤트(동시 cancel 선점)" 부분으로 범위를 좁힐 것. 혹은 §1.1 각주에서 admission gate 부분을 §8 참조로 명시해 위치 불일치를 없앨 것.

- **[INFO]** 신규 규약 문서 위치·명명은 기존 `spec/conventions/` 구조와 일관됨
  - target 위치: §A "신규 `spec/conventions/raw-query-results.md`"
  - 충돌 대상: 없음(정보성)
  - 상세: `spec/conventions/` 디렉터리에는 별도 색인 파일이 없고 각 문서가 개별 SoT 로 참조되는 방식이라(`migrations.md`, `node-cancellation.md` 등과 동일 패턴), 신규 파일 추가가 구조적으로 다른 영역과 충돌하지 않는다. `RR-PL-05` 등 기존 requirement ID·"raw-query-results" 문자열도 `spec/` 전체에서 중복 사용처가 없어 ID 충돌 없음.

### 요약

target 이 제안하는 신규 규약 문서(§A)와 `migrations.md` 확장을 기각한 근거(축이 다름), 그리고 §B 의 5개 소급 각주 중 3개(`spec/data-flow/2-auth.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/10-graph-rag.md`)는 실측한 spec 본문과 정확히 대응하며 데이터 모델·API 계약·RBAC 충돌은 발견되지 않았다. 다만 나머지 2개 각주(`execution-engine.md` §1.1, `node-cancellation.md` §2.4 네 번째 불릿)는 target 이 스스로 정의한 "행 라벨이 아니라 실제 소비 경로 단위로 건다" 는 정밀도 원칙을 자기 자신의 위치 지정에는 충분히 적용하지 못했다 — 12개 회귀 지점 중 다수가 지정된 앵커의 산문 범위 밖에 있거나(node-cancellation §2.4), 서로 다른 두 절에 걸친 내용을 한 절에만 건다(execution-engine §1.1 vs §8). 두 건 모두 spec 간 직접 모순은 아니고 spec 자체가 깨지지도 않지만, 이대로 반영하면 각주가 커버 범위를 과소 대표해 다음 사람이 "이 절만 보면 전체 영향을 안다"고 오판할 위험(반대 방향 drift)이 있다.

### 위험도

MEDIUM
