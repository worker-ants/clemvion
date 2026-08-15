# 문서화(Documentation) Review — `finalizeStalledExhausted` 트랜잭션 원자화 + 후속 하드닝 (`16_31_53`)

## 리뷰 대상

이 세션은 이전 두 라운드(`16_04_38`, `16_19_26`)의 documentation WARNING 이 실제로
반영됐는지, 그리고 그 이후 커밋(`5ba4b125c`, `749488801`, `0d9c6166f`)이 새 문서화 결함을
만들지 않았는지 확인하는 재검토다. 실질 코드 변경은 두 파일뿐이다.

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
  `finalizeStalledExhausted` 두 UPDATE 를 `dataSource.transaction` 으로 원자화 + Execution
  UPDATE 의 `WHERE id` 하드닝 테스트 대응 + 중복 주석 정리
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` —
  `installStalledTx` 헬퍼 도입/재사용, WHERE 가드 assertion 추가
- `spec/5-system/4-execution-engine.md`, `CHANGELOG.md`, `plan/in-progress/eia-stalled-atomicity.md`
  (신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
  `plan/in-progress/update-returning-tuple-shape.md`,
  `plan/complete/eia-db-wire-invariant.md`(rename) — 문서/plan 갱신
- 나머지(`review/**`)는 이전 라운드 산출물로, 이 저장소의 확립된 관례(리뷰 산출물 커밋)이며
  리뷰 대상 코드가 아니다.

`git diff origin/main...HEAD` 로 코드 두 파일의 실제 diff 를 직접 열어 확인했다(프롬프트에서는
크기 제한으로 elide 됨).

## 발견사항

- **[INFO]** 직전 두 라운드의 documentation WARNING/INFO 전부 실측 반영 확인 — 회귀 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`finalizeStalledExhausted` JSDoc, 함수 시작 지점 근처 — `**두 UPDATE 는 단일
    트랜잭션이다 (2026-08-15)**` 문단), `CHANGELOG.md`(`## Unreleased — stalled 마감의
    부분 커밋` 항목), `spec/5-system/4-execution-engine.md` §7.1 + §Rationale
    ("dead-letter 마감의 원자성 (2026-08-15 정정)" 문단)
  - 상세: JSDoc 에 `{@link cancelParkedExecution}` · `markWebChatIdleTimeout` 자매 참조와
    부분 커밋 결함 설명이 남아 있고, CHANGELOG 항목은 이 파일의 "짝 전이 원자성" 계열 확립된
    형식(문제→원인→수정→수신자 영향)을 그대로 따른다. spec 문서는 §7.1 본문과 §Rationale
    양쪽에 동기화됐다(직전 라운드 `--impl-done` W2 가 지적한 "Rationale 미러 누락"도 해소).
  - 제안: 없음.

- **[INFO]** 최신 커밋(`0d9c6166f`)의 중복 주석 정리가 "근거는 위 JSDoc 참조" 로 정확히
  1곳만 남기고 나머지를 지웠는지 확인 — 확인됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `finalizeStalledExhausted` 본문, `dataSource.transaction(...)` 호출 직전 인라인 주석
  - 상세: 이전엔 JSDoc 문단과 거의 동일한 문장(자매 참조 + 부분 커밋 결함 설명)이 인라인
    주석에도 반복돼 있었다. 최신 커밋이 인라인 쪽을 `// 자매 둘과 동형인 단일 트랜잭션 —
    **근거는 위 JSDoc 참조**(같은 설명을 두 곳에 두면 한쪽만 갱신돼 모순된다).` 로 축약해
    SoT 를 JSDoc 한 곳으로 모았다. 자매 `cancelParkedExecution`/`markWebChatIdleTimeout`
    도 근거를 JSDoc 한 곳에만 두는 것과 동형이 됐다.
  - 제안: 없음.

- **[INFO]** 신규 WHERE 가드 assertion(`execQb.where`)에 붙은 주석이 정확한 세션 번호로
  이전 라운드 발견을 인용 — 사실 확인됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`,
    `'RUNNING 이면 failed + ... EXECUTION_FAILED emit'` 테스트 본문의
    `expect(execQb.where).toHaveBeenCalledWith('id = :id', ...)` 바로 위 주석(`16_19_26`
    testing W1 인용)
  - 상세: `review/code/2026/08/15/16_19_26/testing.md`(또는 `RESOLUTION.md` W1)에 실제로
    "Execution UPDATE 의 `WHERE id` 가드가 뮤테이션에서 생존했다"는 기록이 존재해, 인용이
    지어낸 것이 아니라 실제 이력과 일치한다.
  - 제안: 없음.

- **[INFO]** `finalizeStalledExhausted` 에는 여전히 자매 두 함수의 `@remarks DB 오류는 내부
  흡수` 문구가 없음 — 기존 dispositioned 항목, 재발 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `finalizeStalledExhausted` (try/catch 없음) vs `cancelParkedExecution`(`@remarks DB
    오류는 내부 흡수 — 호출자에 예외 전파 없음`, try/catch 로 함수 전체를 감쌈)
  - 상세: `16_04_38` database/maintainability 라운드에서 이미 지적됐고, 유일 호출부
    (`execution-run.processor.ts` `onFailed`)가 `.catch()` 로 흡수해 최종 동작이 동등함을
    근거로 "무조치(선택)" 로 dispositioned 됐다(`--impl-prep` 도 동일 판정). 이번 커밋도
    이 비대칭을 넓히거나 좁히지 않았다 — 재지적이 아니라 상태 확인.
  - 제안: 없음(선택 사항으로 이미 기록됨) — 이 함수를 다시 편집할 사람을 위해 "호출부가
    catch 하므로 함수 내부에서 흡수하지 않는다" 한 줄을 JSDoc 에 남기면 좋다는 제안은 여전히
    유효하나 필수는 아니다.

## 확인했으나 문제 없음

- `plan/in-progress/eia-stalled-atomicity.md`(신규): 결함 서술·조치·판별력(뮤테이션 결과)·
  체크리스트가 코드 diff·CHANGELOG·JSDoc 과 일치. frontmatter `spec_impact` 가 YAML 리스트
  형식(convention 준수). 체크리스트 하단 `- [ ] /ai-review CRITICAL 0` 등 3개 항목이
  미체크인 것은 이 리뷰(`16_31_53`)가 아직 진행 중이라는 정상 상태.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`: 정본 트래커 체크박스가
  `[ ]` → `[x] ... 완료` 로 정확히 갱신되고, 새 결함(실 DB 롤백 미검증)이 별도 항목으로
  등재됐으며 그 등재 자체가 "정정" 임을 스스로 명시(과거 잘못된 등재 주장을 시인).
  `plan/complete/eia-db-wire-invariant.md`·`update-returning-tuple-shape.md` 의 상호
  링크(`./eia-db-wire-invariant.md` → `../complete/eia-db-wire-invariant.md`)도 실제
  `git mv` 이관과 일치해 dangling link 없음.
- `spec/5-system/4-execution-engine.md`: §7.1 본문과 §Rationale 양쪽에 트랜잭션화 사실이
  동기 반영됨(같은 커밋).
- README 업데이트 불필요 — 내부 트랜잭션 경계 수정으로 공개 API·CLI·설정 변경 없음.
- 신규 환경변수·설정 옵션 없음 — 설정 문서화 대상 없음.
- 예제 코드 필요성 없음 — 내부 서비스 메서드.
- `review/code/2026/08/15/{16_04_38,16_19_26}/**`, `review/consistency/2026/08/15/{15_54_20,16_19_57}/**`:
  이 저장소의 확립된 관례(리뷰/consistency-check 산출물 커밋)이며 실제 세션 디렉토리가
  디스크에 존재함을 확인(`review/code/2026/08/15/` ls 로 대조) — RESOLUTION/plan 이 인용한
  세션 번호가 지어낸 것이 아니다.

## 요약

이 라운드는 이전 두 documentation 리뷰(`16_04_38`, `16_19_26`)에서 지적된 CHANGELOG 누락·
JSDoc 미갱신·헬퍼 우회·줄수의존 주석이 모두 실측 반영됐음을 재확인했고, 그 이후 커밋
(`0d9c6166f`)이 추가한 "JSDoc 근거 참조로 인라인 중복 제거"도 자매 함수와 동형으로 정확히
적용됐다. `spec/5-system/4-execution-engine.md`(§7.1 + §Rationale)·`CHANGELOG.md`·
plan 문서 3종(`eia-stalled-atomicity.md` 신규, 정본 트래커 체크박스, rename 이관에 따른
링크 갱신) 모두 코드와 동기 상태다. 유일하게 남은 관찰(`finalizeStalledExhausted` 함수
레벨 try/catch·`@remarks` 부재)은 두 라운드 전부터 이미 "무조치, 최종 동작 동등"으로
공식 dispositioned된 사항이며 이번 diff 가 새로 만들거나 넓히지 않았다. 신규 CRITICAL/
WARNING 없음.

## 위험도

NONE
