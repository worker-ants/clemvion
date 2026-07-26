# 변경 범위(Scope) Review — review/code/2026/07/26/16_20_52 (7R)

대상: HEAD `3428129b1` — "fix(engine): 6R W26·W27 — JSDoc 고아 해소 + error 키 부재 불변식 결속"

프롬프트(`_prompts/scope.md`)에는 실제 소스 diff가 아니라 직전 라운드(`13_47_42`)의 review 산출물 diff만
담겨 있어(리뷰 대상 파일 1~10이 전부 `review/code/2026/07/26/13_47_42/*`), 지시대로 `git show HEAD --stat` /
`git show HEAD -- <path>` 로 실제 코드 diff를 직접 열어 검증했다.

## 검증 1: `.ts` 변경이 순수 블록 이동인가 (로직 0줄 변경)

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff 전문을 확인:

- 삭제된 20줄과 추가된 20줄이 **글자 단위로 완전히 동일**하다 — `finalizeCancelledExecution` 의 JSDoc
  블록(`top-level 실행을 CANCELLED 로 종결하는 공통 처리...` ~ `@param logContext...`)이 원래 위치
  (`markNodeCancelled` JSDoc 과 그 함수 선언 사이)에서 삭제되고, 동일 텍스트가 `private async
  finalizeCancelledExecution(` 선언 바로 앞으로 재삽입됐다.
- 코드(함수 본문·시그니처·호출부)는 diff에 전혀 등장하지 않는다 — 두 hunk 모두 `/** ... */` 주석
  블록의 삭제/추가뿐이고, 실행 가능한 코드 라인은 0줄 변경.
- `git show HEAD --stat` 이 보고하는 `40 +--` 는 20 삭제 + 20 추가 = 40과 정확히 일치, 순net 변경은
  텍스트 재배치 하나뿐임을 뒷받침한다.
- 커밋 메시지가 주장하는 목적("W26 — JSDoc 이 고아가 되어 헬퍼가 자기 문서와 멀어진 문제를, 블록을
  자기 함수 앞으로 옮겨 해소")과 diff 내용이 정확히 일치한다.

**결론**: `.ts` 변경은 로직 한 줄도 건드리지 않은 **순수 JSDoc 블록 이동**임을 확인. 의도 이상의 변경
없음.

## 검증 2: "spec" 변경이 단언 2줄 추가뿐인가

`codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` diff (`+7` 전체):

```
+      // ai-review 6R (testing) — 위 문자열 단언만으로는 부족하다. `markNodeCancelled`
+      // 이 `errorEnvelope` 없이 호출될 때 **`error` 키/필드 자체가 생기지 않는다**는
+      // 것이 이 헬퍼의 존재 이유(W15/W19: sentinel message 에 executionId 가 있다)인데,
+      // 실측 mutation 에서 임의의 leaked `error` 를 강제 주입해도 기존 단언들이 전부
+      // GREEN 이었다. 구조적으로 고정한다.
+      expect(ne?.error).toBeUndefined();
+      expect(cancelCall?.[3]).not.toHaveProperty('error');
```

- 실질 단언(assertion)은 정확히 2줄(`expect(ne?.error)...`, `expect(cancelCall?.[3])...`) 뿐이다.
- 나머지 5줄은 그 단언을 추가한 근거(W27 mutation 실측)를 설명하는 주석으로, 커밋 메시지·RESOLUTION.md
  에 기록된 근거와 동일한 내용이며 임의의 무관한 주석 추가가 아니다.
- 기존 테스트 케이스(문자열 단언 등) 자체는 그대로이고, 새 테스트 케이스나 새 `describe`/`it` 블록
  추가 없이 **기존 테스트 안에 단언 2줄만 삽입**됐다.
- 제품 `spec/` 폴더(제품 정의·기술 명세) 변경은 이번 커밋에 없다(`git show --stat` 확인) — "spec 변경"
  지시는 `.spec.ts` 테스트 파일을 가리키는 것으로 해석했고, 그 해석 기준으로도 "단언 2줄 추가"라는
  전제가 정확히 성립한다.

**결론**: 테스트 파일 변경은 지시된 대로 단언 2줄(+근거 주석)뿐. 과잉 리팩터링·불필요한 테스트 확장 없음.

## 검증 3: 백로그로 분리한 항목이 코드에 손대지 않았는지

`review/code/2026/07/26/15_56_53/RESOLUTION.md` 가 명시한 이번 라운드(6R) 미조치 항목:

- 미조치(INFO): harness diff-list 갭, mock `save` 참조-기록 한계, `durationMs` 값 미검증,
  `errorEnvelope` 익명 타입 2곳, 헬퍼 파라미터 순서, 테스트 위치(`describe` 블록), CHANGELOG·plan 미갱신
- 이월 백로그(4R부터): 선재 spec 파일 구조적 flakiness · `runParallel` 의 `failures` 미소비 ·
  `ParallelExecutor 'stop'` 의 `failures[0]` 우선순위 레이스 · 가드 시퀀스 헬퍼 전면 승격 · shutdown
  `FAILED` 미감지 · WS 프로토콜 spec 의 `execution.node.cancelled` 생산자·필드 서술(planner 위임)

이번 커밋의 실제 코드 diff는 앞서 확인한 두 파일(`execution-engine.service.ts` JSDoc 이동,
`execution-engine.service.spec.ts` 단언 2줄)이 전부다 — `git show HEAD --stat` 결과 다른 `.ts`/`.tsx`
소스 파일(`foreach-executor.ts`, `parallel-executor.ts`, `workflow.handler.ts`, `retry-turn.service.ts`,
`workflow-errors.ts`, WS 프로토콜 spec 등 백로그가 언급하는 파일들)은 이번 diff에 전혀 등장하지 않는다.
CHANGELOG.md 역시 이번 커밋에서 변경되지 않았다(RESOLUTION.md 의 "CHANGELOG·plan 미갱신" 기록과 일치).

**결론**: 백로그로 분리한 항목 전부 이번 커밋에서 미착수 상태 그대로 확인. 새로 손댄 흔적 없음.

## 검증 4: `review/` 산출물 변경

나머지 diff는 전부 `review/code/2026/07/26/{15_29_59→15_56_53, 신규}/*` — 이전 라운드 산출물 정리
(`meta.json` 삭제 → 신규 round 로 이동/갱신) + 이번 라운드(6R) 산출물 신규 작성
(`RESOLUTION.md`/`SUMMARY.md`/각 관점 `.md`/`meta.json`/`_routing_decision.json`/`_retry_state.json`
rename)이다. 이는 프로젝트 규약(`code-review-agents` skill, `review/code/**` 산출물 관리)이 요구하는
정규 워크플로 부산물이며, 코드 리뷰 프로세스 자체의 스코프이므로 별도 지적 대상이 아니다.

## 발견사항

없음. 이번 라운드(7R)에서 새로 발견된 스코프 결함이 없다.

## 요약

HEAD 커밋(`3428129b1`)은 지시된 범위(W26 JSDoc 재배치 + W27 불변식 단언 추가)를 정확히 지켰다.
`.ts` 소스 변경은 diff 텍스트가 삭제/추가 20줄씩 글자 단위로 동일함을 직접 확인해 **로직 변경 0줄인
순수 블록 이동**임을 검증했고, `.spec.ts` 변경은 실질 단언 정확히 2줄(+근거 주석 5줄)뿐임을 확인했다.
직전 라운드까지 이월된 백로그 항목들이 언급하는 파일들은 이번 diff에 전혀 등장하지 않아 여전히
미착수 상태다. `review/` 폴더 변경은 리뷰 하네스 자체의 정규 산출물 관리이므로 스코프 이탈이 아니다.
7라운드 연속으로 scope 관점 결함 없음.

## 위험도

NONE
