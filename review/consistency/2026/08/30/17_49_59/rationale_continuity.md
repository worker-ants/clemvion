# Rationale 연속성 검토 — `plan/in-progress/spec-draft-else-branch-transaction.md`

## 조사 방법 (번들 갭 보정)

프롬프트에 첨부된 Rationale 번들에서 target 의 `spec_impact` 대상인
`spec/5-system/4-execution-engine.md` 자체가 **컨텍스트 예산 초과로 절단**되어 있었다
(번들 882번째 줄 "본문 생략됨"). 정작 대조해야 할 문서가 빠진 채로는 판정이 거짓
음성이 될 위험이 커서, 해당 spec 파일과 관련 convention·plan·codebase 를 직접 읽어
보강했다.

- `spec/5-system/4-execution-engine.md` §1.1 원자성 보장 블록 + `## Rationale` 전문 직접 열람
- `spec/conventions/node-cancellation.md` §6/§Rationale (else 분기와 인접한 terminal 가드 표)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
  `updateExecutionStatus` 실제 구현 (else 분기 `dataSource.transaction` 배선 확인)
- `git show 8332d9a20` (커밋 존재·내용 확인)
- `plan/in-progress/update-returning-tuple-shape.md`, `plan/in-progress/backend-lint-gate-broken-on-main.md`
  (else 분기 트랜잭션화 작업 이력 — "완료(2026-08-30)" 항목 대조)
- `git log --oneline --all | grep 1242` (소급 각주 원 커밋 `5fbcd20b8 docs(spec): ... (#1242)` 확인)

## 발견사항

이번 target 은 CRITICAL/WARNING 급 Rationale 연속성 위반을 발견하지 못했다. 아래는
검증 결과와 INFO 1건이다.

- **[INFO] `node-cancellation.md` §6 구현 현황 표에도 대응 각주가 필요할 수 있음**
  - target 위치: target 문서 "(1) §1.1 「원자성 보장」 블록 — 문장 추가" (spec_impact 는
    `4-execution-engine.md` 한정)
  - 과거 결정 출처: `spec/conventions/node-cancellation.md` §6 표의
    "§2.4 park↔resume 짝 전이 terminal 가드" 행(222번째 줄) + 그 아래 2026-08-30 소급 각주
    (227~234번째 줄, `8332d9a20` 관련 — `4-execution-engine.md` 의 동일 날짜 각주와 자매 문서)
  - 상세: `node-cancellation.md` 는 이미 같은 `8332d9a20` 결함에 대한 소급 각주를 갖고 있고,
    그 표는 else 분기(직접 마감)와 인접한 terminal 가드들을 열거한다. else 분기가 이번에
    트랜잭션으로 격상된 사실이 이 자매 문서의 표/각주에는 반영 대상으로 명시돼 있지 않다 —
    두 문서가 같은 근본 결함(`8332d9a20`)의 소급 각주를 각각 이미 갖고 있었던 선례
    (`update-returning-tuple-shape.md` 227번째 줄대의 "두 plan 이 같은 항목을 추적" 기록)를
    감안하면, spec 쪽도 두 문서가 같은 후속(else 분기 트랜잭션화)을 각각 반쪽만 반영할
    위험이 있다.
  - 제안: 필수는 아니나(표는 "terminal 가드 존재 여부"를 추적하지 다.transaction 내부
    구현 형태까지는 추적하지 않음), planner 가 이 draft 를 spec 에 반영할 때
    `node-cancellation.md` §6 표/각주도 함께 볼지 1회성으로 점검할 가치가 있다. 이 검토
    자체는 Rationale 위반이 아니라 완결성 관점의 보완 제안이라 등급을 INFO 로 둔다.

## 검증한 사항 (문제 없음으로 판정한 근거)

1. **"기각된 대안의 재도입" 아님** — spec 어디에도 "else 분기 guarded UPDATE 를 트랜잭션
   밖에 둔다" 는 명시적 결정이 기록된 적이 없다(`grep -n "M-3" spec/5-system/4-execution-engine.md`
   결과 0건 — M-3 은 코드 주석에만 있던 미문서화 설계였다). 즉 target 은 과거에 거부된
   대안을 되살리는 것이 아니라, **spec Rationale 에 한 번도 존재한 적 없던 갭**을 코드와
   맞춰 채우는 것이다.

2. **"결정의 무근거 번복" 아님** — 실제 코드(`execution-engine.service.ts:8691-8697`,
   `:8699-8734`)를 직접 읽어 target 의 서술(else 분기가 `dataSource.transaction` 으로
   감싸졌고, "shape 가드의 throw 가 UPDATE 를 롤백하게" 하는 것이 목적)이 코드 주석과
   토씨까지 정확히 일치함을 확인했다. `plan/in-progress/update-returning-tuple-shape.md`
   238번째 줄, `plan/in-progress/backend-lint-gate-broken-on-main.md` 1308번째 줄도
   같은 작업을 "완료(2026-08-30)"로 이미 추적 중이다 — target 은 이미 일어난 코드 변경을
   spec 에 소급 반영하는 SPEC-DRIFT 교정이지, spec 결정을 근거 없이 뒤집는 것이 아니다.

3. **"합의된 원칙 위반" 아님** — 오히려 기존에 확립된 원칙(§7.5.1 fail-closed 원칙, "가드가
   없으면 소실 된다" 계열의 §1.1 기존 각주들, `recoverStuckExecutions` 는 non-terminal 만
   스캔한다는 §7 불변식)과 정합한다. target 이 문제 삼는 "가드가 발동한 순간 무기한 대기가
   생긴다" 노출은 이미 §1.1 기존 서술("이 가드가 없으면 ... 소실된다")과 §7 stuck-recovery
   서술이 이미 세운 원칙의 연장선에서 정확히 예측 가능한 결과이며, target 은 그 원칙이
   실제로 어떻게 깨졌었는지(그리고 지금은 트랜잭션으로 닫혔는지)를 기록하려는 것이다.

4. **"암묵적 가정 충돌" 아님** — §1.1 이 이미 기록한 원자성 정의("running ↔ waiting_for_input
   짝 전이", "waiting_for_input → failed", "§7.5 재개 claim")는 그대로 두고, else 분기라는
   **네 번째, 지금까지 미문서화됐던 경로**를 별개 사유로 추가한다. 기존 세 항목의 서술을
   수정·삭제하지 않으므로 기존에 기록된 시스템 invariant 를 우회하지 않는다.

5. **"소급 각주" 작성 방식(원문 유지 + 후속 각주 추가)이 이 저장소의 기존 관례와 일치** —
   같은 문서 §7.5 Rationale "대가(의도된 트레이드오프) — 서술 정정(2026-07-30)", "옛 서술
   철회 (2026-07-28)"(1580번째 줄), `node-cancellation.md` §6 의 "~~지금은 트랜잭션 밖
   단발 UPDATE...~~" 취소선 패턴(`backend-lint-gate-broken-on-main.md` 1309번째 줄)이 모두
   "원문은 보존하고 정정/철회를 층으로 얹는다" 는 동일한 문서화 관례를 따른다. target 이
   기존 각주(#1242)를 고쳐 쓰지 않고 "후속 각주 추가"로 접근하는 것은 이 관례에 부합한다.

6. **`developer` 자기-반증 예외를 스스로 배제한 판단이 CLAUDE.md 규약과 일치** — target 의
   "왜 planner 턴인가" 절은 대상이 "소급 각주(이력 서술)"이지 "예고·트리거 문장"이 아니므로
   조건 2 를 충족하지 못해 예외가 열리지 않는다고 스스로 판단했다. 이는 CLAUDE.md
   §자기-반증형 소정정의 다섯 조건 중 조건 2 ("그 문장이 예고·트리거다 — 제품 정의·요구사항·
   API 계약은 해당 없음")를 정확히 적용한 것이며, 실제로 #1242 커밋(`5fbcd20b8
   docs(spec): ...`)이 project-planner 소유(`docs(spec)`)임도 git log 로 확인돼 target 의
   "내가 쓴 각주" 자기 귀속과 정합한다.

7. **사실관계 실측** — "노출 창 17일"(`8332d9a20` 2026-08-13 ~ 오늘 2026-08-30) 산술이
   맞고, "창이 있었다"와 "발동했다"를 구분하는 절제된 서술은 이 문서 다른 Rationale 항목들
   (예: 1450번째 줄대 "이론적 orphan row", 1505번째 줄 zombie race 서술)의 기존 인식론적
   엄격성과 정합한다 — 근거 없는 과장이나 임의 확신을 추가하지 않는다.

## 요약

target 은 이미 코드에 반영·완료된 변경(else 분기 `updateExecutionStatus` 트랜잭션화,
`18_19_33` concurrency INFO 9 / `plan/in-progress/update-returning-tuple-shape.md` ②)을
spec Rationale 로 소급 반영하는 순수 SPEC-DRIFT 교정이다. 코드·plan·git 이력을 직접
대조한 결과 target 의 모든 사실 서술(트랜잭션 배경, else 분기가 왜 짝 전이와 다른
이유로 트랜잭션을 쓰는지, `#1242` 각주의 불완전성, 노출 창 산술)이 정확했고, 과거
spec Rationale 에서 명시적으로 기각된 대안을 되살리거나 합의된 원칙(fail-closed,
stuck-recovery 는 non-terminal 한정 등)을 위반하는 지점은 없었다. "각주는 고쳐 쓰지 않고
층으로 쌓는다"는 이 문서·자매 convention 문서의 기존 관례에도 부합한다. 유일한
보완 여지는 자매 문서(`node-cancellation.md`)의 병행 각주 필요성 검토(INFO)뿐이다.

## 위험도

LOW
