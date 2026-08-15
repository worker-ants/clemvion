# 요구사항(Requirement) 리뷰 — EIA `durationMs` DB=wire 불변식 닫기 (누적 diff, `15_23_10`)

## 검토 방법

프롬프트가 대용량 파일(핵심 `.ts` 5개, `plan/in-progress/eia-db-wire-invariant.md` 등) diff 를
생략했고, 이 changeset 자체가 이전 3라운드(`13_58_27`/`14_47_14`/`15_00_41`)의 review/RESOLUTION
산출물을 포함하는 누적 diff라 프롬프트만으로는 최종 코드 상태를 판단할 수 없었다. 다음 파일을
`Read`/`grep`으로 직접 열어 실제 소스와 spec 본문을 line-level로 대조했다:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  (`finalizeCancelledExecution`, 4856~4955행)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
  (`finalizeCancelledExecution — 0행 매칭의 두 의미`, 1072~1163행)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
  (`finalizeGuarded` CANCELLED 분기, 590~709행)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` (1290~1400행 부근)
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` / DTO
- `plan/in-progress/eia-db-wire-invariant.md` (전문)
- `spec/5-system/14-external-interaction-api.md` §5.3/§6.5, `spec/conventions/node-cancellation.md`
  §2.4 표 + Rationale

## 발견사항

이번 라운드가 다루는 실질 코드 변경 셋(① `finalizeCancelledExecution` guarded UPDATE 결과 소비
② retry-turn CANCELLED 재진입 `RETURNING` 되읽기 ③ REST `durationMs` 추가)은 새 CRITICAL/WARNING
없이 확인됐다. 직전 라운드(`15_00_41`)가 조치한 항목들 — 재조회 try/catch(fail-closed) · 자매
함수 `finishedAt` 되쓰기 미검증 · `node-cancellation.md`의 "되돌려진 중간 동작" 서술(consistency
`15_01_13` CRITICAL) — 을 실제 소스에서 직접 재확인했고, 셋 다 코드·테스트·spec 문서가 서로
일치하는 최종 상태다.

- **[INFO]** `spec/data-flow/15-external-interaction.md` §1.2 의 `GET /:id` 필드 열거가 여전히
  `durationMs`를 반영하지 못함 (이번 PR 이전부터 있던 비-망라적 요약이 한 칸 더 벌어짐)
  - 위치: `spec/data-flow/15-external-interaction.md` §1.2 (`GET /:id` 는 `execution` row 의
    status/result/error 만 반환한다는 서술)
  - 상세: `spec/5-system/14-external-interaction-api.md`(EIA-IN-04, §5.3)는 이번 PR로
    `durationMs`를 추가했고 이는 SoT로 명시돼 있다. data-flow 문서는 원래도 `currentNode`/
    `context`를 누락하던 비-망라 요약이라 이번 diff가 "새로 깬" 것은 아니다(CRITICAL 아님). 세
    개 회귀 리뷰 라운드(cross_spec `15_01_13`)가 이미 이 갭을 INFO로 기록했고 조치는 보류됐다.
  - 제안: 이미 등재·판단됨(비차단). 여유 있을 때 §1.2 문장에 `durationMs` 추가 또는 "필드 목록은
    EIA §5.3 참조"로 교체 권장 — 새 조치를 요구하지 않는다.

- **[INFO]** plan 체크리스트의 마지막 두 항목("fix 이후 fresh `/ai-review` + `--impl-done`",
  "`--impl-done` BLOCK: NO")이 아직 미체크
  - 위치: `plan/in-progress/eia-db-wire-invariant.md` §체크리스트 (마지막 2줄)
  - 상세: 이 리뷰 라운드(`15_23_10`) 자체가 그 "fresh `/ai-review`"에 해당하므로 미체크 상태는
    시점상 정확하다(허위 서술 아님). 결함이 아니라 관찰.
  - 제안: 이 라운드 결과 반영 후 두 항목 체크.

## 기능 완전성 / 엣지 케이스 / 반환값 검증 (직접 대조)

- `finalizeCancelledExecution`의 0행 분기는 4갈래를 모두 커버한다 — (a) DB가 이미 CANCELLED →
  emit + `durationMs`/`finishedAt`을 DB 정본으로 재대입(`live.durationMs ?? …`가 `??`라 `0`도
  보존), (b) DB가 FAILED/COMPLETED → skip, (c) 재조회 결과가 null → skip(fail-closed),
  (d) 재조회 자체가 throw → catch 후 skip(호출부가 둘 다 catch 블록 안이라는 이유가 주석에
  명시됨). 대응 테스트 4건(`execution-engine.service.spec.ts:1123-1162`)이 각 분기를 discriminate
  하는 fixture(`durationMs: 777`, `LIVE_FINISHED_AT`)로 고정한다.
- `retry-turn.service.ts`의 CANCELLED 재진입 분기는 `.returning(['duration_ms', 'finished_at'])`
  로 두 컬럼을 함께 되읽고, `toFiniteNumber`/`toPersistedDate` 가드를 거쳐서만 in-memory에
  반영한다(`persistedDuration !== null`/`persistedFinishedAt !== null` 가드로 부분 파싱 실패가
  두 컬럼을 불일치 상태로 만들지 않음). 회귀 테스트(`retry-turn.service.spec.ts:1309-1373`)가
  `duration_ms`/`finished_at` 되읽기를 각각 다른 값(`1234` vs 로컬 T2, 문자열 timestamptz)으로
  분기시켜 검증하고 `returningSpy`로 호출 자체도 단언한다.
- REST `durationMs`(`interaction.service.ts:434-438`)는 `execution.durationMs ?? null`로 `0`을
  `null`로 뭉개지 않으며(`??` 사용, `||` 아님), `STATUS_PROJECTION_COLUMNS`에도 추가돼 정확집합
  가드와 응답 조립이 어긋나지 않는다. 대응 테스트(`interaction.service.spec.ts`)가 (1) 종결
  실행이 영속값을 재계산 없이 그대로 싣는지, (2) `durationMs: 0`이 `null`로 뭉개지지 않는지,
  (3) 비종결 실행은 키는 있고 값이 `null`인지 세 갈래를 커버한다.

## Spec fidelity

`spec/5-system/14-external-interaction-api.md`(EIA-IN-04 표 77행, §5.3 응답 예시 485-488행,
§6.5 812-831행)와 `spec/conventions/node-cancellation.md`(§2.4 표 198행, Rationale 209-227행)를
실제 구현과 line-level로 대조한 결과 모두 일치한다. 특히 §2.4 Rationale의 "①원문(과대서술) →
②1차 정정(처방 오류로 실제 버그 유발) → ③최종" 이력 서술은 코드 주석(`execution-engine.service.
ts:4869-4879`, `4903-4923`)이 말하는 극성(자매 `finalizeFailedExecution`과 진입점만 같고
`!persisted` 이후 극성이 반대)과 정확히 대응한다. 직전 라운드가 consistency CRITICAL(`15_01_13`,
"규약 문서가 되돌려진 중간 동작을 서술")로 잡았던 지점이 실제로 최종 동작으로 재정정된 것을
Read로 직접 확인했다.

## 요약

이번 누적 diff의 핵심 세 항목(①guarded UPDATE 반환값 소비 ②retry-turn RETURNING 되읽기
③REST durationMs 추가)은 소스·테스트·spec·plan 네 곳 모두 서로 line-level로 일치하는 최종
상태다. 이전 세 라운드가 발견한 CRITICAL/WARNING(사용자 Stop 무음화, 되쓰기 미검증 컬럼,
규약 문서 극성 서술 오류)은 모두 코드·테스트·spec에서 실제로 해소된 것을 직접 대조로
확인했다. 새로 발견한 CRITICAL/WARNING은 없다. 유일한 잔여 관찰은 `spec/data-flow/15-
external-interaction.md`의 비-망라적 필드 요약이 한 칸 더 벌어진 것(INFO, 이미 이전 라운드가
인지·보류)과 plan 체크리스트 마지막 두 항목이 이 라운드 완료 후 체크될 항목이라는 점(시점상
정상)뿐이다.

## 위험도

NONE
