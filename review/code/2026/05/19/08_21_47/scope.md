# 변경 범위(Scope) 리뷰

## 발견사항

### 코드 파일 (파일 1-4)

- **[INFO]** `send-email.handler.ts` — `normalizeRecipients` 함수 본문 위 주석 블록 대폭 확장
  - 위치: `send-email.handler.ts` diff, `function normalizeRecipients` 직전 주석 (+10줄)
  - 상세: array-only 정준화의 배경, defensive `[]` safety net의 의도, legacy 데이터 처리 방침 등을 상세히 설명하는 주석이 추가됐다. 이 내용은 plan(`send-email-to-array-only.md`)에 "JSDoc 보강 — defensive `[]` safety net + spec §8.1 참조"로 명시된 작업 항목에 해당하므로 범위 내 변경이다. 과도한 주석 추가가 아닌, 의도된 문서화다.
  - 제안: 없음.

- **[INFO]** `send-email.schema.ts` — `isOptionalRecipientSet` 함수에 인라인 주석 3줄 추가
  - 위치: `send-email.schema.ts` diff, `isOptionalRecipientSet` 함수 내부
  - 상세: "unset(undefined/null)과 명시적 빈 배열은 미설정", "그 외는 isRecipientsLike가 array-only 형식 검증으로 reject" 설명 추가. plan의 작업 항목("JSDoc 의 sum type 표현 → array-only 로 갱신") 범위에 포함되며, 동작 변경에 동반된 주석 갱신이다.
  - 제안: 없음.

- **[INFO]** `send-email.schema.spec.ts` — 테스트에 `// array-only 정준화 (spec §8.1)` 주석 추가
  - 위치: `validateSendEmailConfig (imperative)` describe 블록 최상단, 삭제된 테스트 위치
  - 상세: 삭제된 `'returns [] when to is a non-empty string'` 테스트 자리에 이유를 설명하는 블록 주석 추가. plan 작업 항목 범위 내이며, 테스트 삭제/추가의 맥락을 설명하는 적절한 주석이다.
  - 제안: 없음.

### 문서/plan 파일 (파일 6-7)

- **[INFO]** `plan/in-progress/node-config-required-defaults-sweep.md` — B 항목 한 줄 갱신 외에 다른 수정 없음
  - 위치: L84, B 항목 strikethrough 처리 및 분리 마킹 추가
  - 상세: 정확히 plan에 명시된 작업 항목("본 sweep plan 후속 follow-up 섹션에서 B 항목을 → send-email-to-array-only 로 분리로 마킹")에 해당하는 최소 변경. 범위 내.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/node-output-redesign/send-email.md` — 3줄 갱신
  - 위치: L452, L461, L470 (각각 validate 일관성·handler 테스트·normalizeRecipients 설명)
  - 상세: consistency-check W-1에서 "sum-type 전제 분석이 잔존한다"고 지적된 항목을 갱신한 것으로, SUMMARY.md W-1의 "FIXED" 처리 근거가 된다. 이 파일 수정은 plan 작업 항목에 명시되어 있지 않으나, consistency-check 통과 조건으로 필요하며 범위의 자연스러운 확장이다. scope 위반으로 보기보다는 consistency-check 연동 작업으로 간주된다.
  - 제안: 없음.

### review/ 산출물 파일 (파일 9-15)

- **[INFO]** `review/consistency/2026/05/19/08_11_41/` 디렉토리 전체 신규 추가
  - 위치: SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, naming_collision.md, plan_coherence.md, rationale_continuity.md
  - 상세: `/consistency-check` 실행 결과 산출물이다. plan 작업 항목에 "[ ] consistency-check 통과"가 명시되어 있으며, 이 디렉토리는 그 실행 증거다. 프로젝트 컨벤션(`review/consistency/<nested ISO>/`) 준수. 범위 내.
  - 제안: 없음.

### 범위 이탈 의심 항목

- **[WARNING]** `frontend/src/lib/i18n/backend-labels.ts` — i18n 매핑 3건 추가
  - 위치: `WARNING_KO` 객체 내 +5줄 (주석 1줄 + 매핑 3건 + 기존 Y-axis 줄은 이동 아님)
  - 상세: plan 작업 항목에는 "frontend backend-labels.ts — recipient 에러 메시지는 ko 매핑 자체가 없어 동기화 불필요"라고 명시되어 있다. 즉 plan이 *불필요*하다고 판단하고 체크된 항목인데, 실제로는 3건의 ko 매핑이 추가됐다. consistency-check SUMMARY I-2가 "FIXED — 본 PR에 ko 매핑 3건 추가"로 처리한 것을 보면, consistency-check 통과 과정에서 plan의 초기 판단("동기화 불필요")이 번복되어 추가된 것이다. plan의 원래 항목 판단과 실제 변경이 다르다는 점에서 추적성 불일치가 발생하나, 내용 자체는 consistency-check에서 권고한 정당한 변경이다. plan 체크박스 완료 표시("불필요")와 실제 변경 사이의 문서 불일치는 경미한 scope 이탈로 볼 수 있으나, 실질적으로는 범위 내 보완 작업이다.
  - 제안: `send-email-to-array-only.md`의 해당 항목을 "~~불필요 판단~~ → I-2 지적으로 3건 추가 완료"로 갱신해 추적성을 보완하면 좋다.

## 요약

이번 변경은 `send-email` 노드의 수신자 필드를 sum-type(`string | string[]`)에서 array-only(`string[]`)로 정준화하는 것을 목표로 하며, plan에 명시된 작업 항목 — schema.ts / handler.ts / 두 spec 파일 / i18n / plan 문서 갱신 — 과 전반적으로 일치한다. 추가된 주석과 JSDoc은 동작 변경에 동반된 문서화로 과도하지 않으며, review/ 산출물은 프로젝트 컨벤션에 따른 정상 결과물이다. 유일한 scope 이탈 의심은 `backend-labels.ts` 추가인데, 이는 plan이 "불필요"로 판단했다가 consistency-check I-2 지적에 의해 번복된 변경으로, 내용은 정당하나 plan 문서와의 추적성 불일치가 경미하게 존재한다.

## 위험도

LOW
