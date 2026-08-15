# Rationale 연속성 검토 — spec/5-system/ (EIA DB=wire invariant, --impl-prep)

## 조사 방법 메모 (중요)

전달된 `prompt_file` 의 조립 번들은 **컨텍스트 예산 초과로 이번 검토의 실질 target 인
`spec/5-system/14-external-interaction-api.md`(원문 28,522자)와 `4-execution-engine.md`
(원문 222,200자)를 포함해 5-system 하위 다수 파일·related_specs 대부분을 통째로 생략**했다
(`> ⚠️ 본문 생략됨 — 컨텍스트 예산 초과` 마커, 15개+57개 파일). 번들만으로는 이번 라운드
(plan `eia-db-wire-invariant.md`, spec_impact=`spec/5-system/14-external-interaction-api.md`)의
Rationale 연속성을 사실상 검증할 수 없어, 실제 저장소 파일(`spec/5-system/14-external-interaction-api.md`
전문, `spec/5-system/4-execution-engine.md` 관련 절, `spec/conventions/node-cancellation.md`,
작업 트리의 미커밋 diff)을 직접 Read 해 보완했다. (§요약 참조 — 이 자체도 하나의 발견사항으로 기록)

---

## 대상 plan 요약

`plan/in-progress/eia-db-wire-invariant.md` — PR #1171(종결 이벤트 `durationMs`)이 세운
"DB=wire" 불변식의 잔여 3항목을 닫는 작업:

- ① `finalizeCancelledExecution` 이 guarded UPDATE 결과(`persisted`)를 확인하지 않고 emit
- ② retry-turn CANCELLED 재진입의 `RETURNING` 부재로 §6.5 "알려진 예외 1건" 을 닫음
- ③ REST 재조회(`GET /api/external/executions/:id`)에 `durationMs` 필드 추가

작업 트리에는 이미 ①②에 해당하는 **미커밋 코드 diff**가 존재한다
(`execution-engine.service.ts`/`retry-turn.service.ts` + 대응 spec.ts, `RETURNING`/`persisted`
가드 추가). `spec/5-system/14-external-interaction-api.md` 자체는 아직 diff 에 없다 — 즉 spec
동기화(§6.5 캐비엇 정리, §5.3 필드 추가)는 착수 전 상태다.

---

## 발견사항

### [WARNING] §6.5 "알려진 예외 1건" 캐비엇을 "문구 제거"로 처리하면 이 문서가 같은 날 세운 이력 보존 관행과 어긋난다

- target 위치: `plan/in-progress/eia-db-wire-invariant.md` ② 체크리스트 두 번째 항목
  — `"spec §6.5 의 '알려진 예외 1건' 문구 제거 (닫혔으므로)"`
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §6 "종결 이벤트의 필드 집합"
  표(577행) 및 §6.5(803~823행) 자체, 그리고 `13-replay-rerun.md`(469행)·
  `17-agent-memory.md`(140~144행)·`8-embedding-pipeline.md`(411행)
- 상세: 바로 이 파일의 577행이 **같은 durationMs 주제**로 이미 이 패턴을 실증한다 —
  `~~cancelled 계열은 계산·영속조차 하지 않는다~~ **(2026-08-15 해소)**` 처럼 **취소선으로
  옛 문구를 보존한 채 해소 시점·근거를 덧붙이는 방식**이지, 문장을 지우는 방식이 아니다.
  §6.5 본문(816행)도 스스로 이 관행을 명시한다 — *"이 문서의 관행대로 **알려진 갭은
  invariant 옆에 적는다**(R14·R17·§6.4 와 동형)"*. 같은 취소선+해소날짜 패턴은
  `5-system/13-replay-rerun.md`(C3 single-node debug)·`17-agent-memory.md`(증분 추출 등
  4건)·`8-embedding-pipeline.md`(union 이벤트 수)에서도 반복돼 **저장소 전반의 정식 관행**임을
  뒷받침한다. 그런데 plan ②의 체크리스트 문구는 "문구 제거" 라고만 적어, 실행자가 §6.5 의
  "알려진 예외 1건" 단락 전체를 **취소선 없이 삭제**할 위험이 있다 — 이는 "결정을 뒤집을 때
  이력을 지우지 않는다" 는 합의된 원칙(같은 파일이 같은 커밋 라운드에 스스로 세운 선례)과
  충돌한다.
- 제안: plan 체크리스트 문구를 `"§6.5 알려진 예외 1건 단락을 취소선 + (YYYY-MM-DD 해소) 노트로
  전환 (577행 durationMs 캐비엇과 동일 패턴, 원문 보존)"` 로 구체화하거나, spec 편집 시
  577행과 동형으로 처리할 것. 삭제가 아니라 취소선 처리가 목적임을 plan 에 명시하면 실행
  단계의 해석 분기를 없앤다.

### [INFO] `finalizeCancelledExecution` 수정이 `spec/conventions/node-cancellation.md` §2.4 구현 현황 표의 최신화를 요구하는데 plan 의 `spec_impact` 에 없다

- target 위치: `plan/in-progress/eia-db-wire-invariant.md` frontmatter `spec_impact`
  (현재 `spec/5-system/14-external-interaction-api.md` 단독) 및 ① 체크리스트
- 과거 결정 출처: `spec/conventions/node-cancellation.md` §2.4 구현 현황 표(195~199행) +
  `## Rationale` "왜 취소 시각 보존 메커니즘이 두 가지인가"(203~220행)
- 상세: 이 컨벤션 문서는 "§2.4 park↔resume 짝 전이 terminal 가드" 구현 현황 행(197행)에
  `finalizeFailedExecution`·`failFirstSegmentSetup`·`executeSync timeout` 을 "SELECT … FOR
  UPDATE 로 비-terminal 확인 후에만 쓰기 + 선점 시 이벤트 처리" 의 예시로 명시하면서도
  `finalizeCancelledExecution` 은 이름을 올리지 않았다 — Rationale 본문(208~209행)도
  `finalizeCancelledExecution` 을 "guarded UPDATE 가 이미 terminal 인 행을 걸러낸다" 고만
  적어 **쓰기(UPDATE) 차단**만 서술하고, emit skip 여부는 언급하지 않는다. 이번 plan ①이
  `finalizeCancelledExecution` 에 `persisted` 체크 + emit skip 을 추가하면 이 함수도
  `finalizeFailedExecution` 과 완전히 동형(§2.4 패턴 전체 구현)이 된다. 이 컨벤션 문서가
  "구현 현황" 을 표 단위로 추적하는 것이 그 자체 존재 이유이므로, 코드가 바뀐 뒤에도 표가
  갱신되지 않으면 SoT 가 stale 해진다. Rationale 을 뒤집는 것은 아니지만(원칙 위반은 아님),
  이 변경을 추적하는 문서가 plan 의 `spec_impact` 목록에서 빠져 있다는 점은 스코프 누락
  후보다.
- 제안: `spec_impact` 에 `spec/conventions/node-cancellation.md` 추가 검토. §2.4 표 197행에
  `finalizeCancelledExecution` 을 추가하거나, "왜 취소 시각 보존 메커니즘이 두 가지인가" 문단에
  "이제 두 메커니즘 모두 emit-skip 을 구현한다" 는 한 줄을 보강.

### [INFO] Payload 조립 갭 — 이번 target 의 SoT 파일이 예산 초과로 전량 생략됨

- target 위치: `prompt_file` §Target 문서 (`spec/5-system/14-external-interaction-api.md`
  1929~1932행 인근, `4-execution-engine.md` 1884~1887행 인근)
- 상세: `--impl-prep scope=spec/5-system/` 번들 조립이 15개(1차)+57개(2차, related_specs 대부분)
  파일을 "본문 생략됨 — 컨텍스트 예산 초과" 로 대체했다. 그중에는 이번 plan 의 `spec_impact`
  단일 대상인 `14-external-interaction-api.md` 본문 전체가 포함된다 — 즉 조립된 payload
  만으로는 이번 라운드의 Rationale 연속성 검토가 사실상 불가능했다. 기존에 알려진 이슈
  (`feedback_consistency_spec_mode_budget.md`)와 같은 유형이며, 이번엔 "관련 spec 이 못
  들어옴" 이 아니라 **target 본문 자체가 못 들어온** 더 심한 사례다.
- 제안: orchestrator 쪽 예산 배분에서 `spec_impact` 로 명시된 파일은 truncation 대상에서
  제외(최우선 보존)하는 규칙을 검토. 이번 리포트는 직접 파일 Read 로 보완했으므로 이 항목
  자체가 판정을 막지는 않는다.

---

## 확인된 정합 사항 (참고 — 위반 아님)

- 코드 diff(미커밋)의 ① 처리 — `updateExecutionStatus` 반환값(`persisted`)을 확인해 `false`
  면 emit 을 skip 하는 방식은 `node-cancellation.md` §2.4 의 "선점이 관측되면 저장·종결 이벤트
  emit 을 모두 skip" 원칙과 정확히 합치한다. 기각된 대안의 재도입이 아니라 원칙을 실제로
  성립시키는 수정이다.
- ② 코드 diff — `finalizeGuarded` CANCELLED 분기에 `.returning(['duration_ms', 'finished_at'])`
  를 추가해 DB 영속값을 in-memory 에 되쓰는 방식은 같은 컨벤션 문서의 "SQL COALESCE 로 SELECT–
  UPDATE 창을 신뢰하지 않는다" Rationale(212~214행)과 그대로 정렬된다.
- ③ REST 재조회(§5.3) 필드 추가는 §6 처럼 "이 표가 전부다" 류의 닫힌 목록 선언이 없는 자리라
  additive 확장에 막히는 기존 Rationale이 없다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 diff(② 관련 처방 정정)는
  "실측 후 정정, 날짜 명시" 방식으로 이 저장소의 기존 관행(과거 서술이 반증되면 지우지 않고
  정정 노트를 남긴다)을 그대로 따르고 있다 — 모범 사례.

---

## 요약

이번 target 문서 자체(spec/5-system/ 현재 상태)는 과거 Rationale 을 위반하지 않으며, 착수
전 코드 diff(①②)도 기존 §2.4 원칙에 정확히 부합한다. 다만 plan 의 남은 spec 동기화 작업
지시가 다소 느슨해 위험이 남아있다 — ②의 "§6.5 문구 제거" 지시는 바로 같은 파일이 같은 날
세운 "취소선+해소노트" 관행과 충돌할 문구로 읽히고(WARNING), ①의 코드 수정이 실제로
`node-cancellation.md` §2.4 구현 현황 표의 대상임에도 plan 의 `spec_impact` 에서 그 문서가
빠져 있다(INFO). 두 항목 모두 구현을 막을 CRITICAL 은 아니며, plan 체크리스트 문구를
구체화하거나 spec_impact 를 한 줄 보강하는 것으로 해소된다. 별도로, 이번 검토에 전달된
payload 자체가 target SoT 파일을 예산 초과로 통째로 생략한 조립 결함을 발견했다(INFO,
직접 파일 Read 로 보완 완료).

## 위험도

LOW
