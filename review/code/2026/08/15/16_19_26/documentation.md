# 문서화(Documentation) 리뷰 — `eia-stalled-atomicity` (재검토, `16_19_26`)

이 세션은 직전 리뷰 라운드(`review/code/2026/08/15/16_04_38`)에서 나온 documentation
WARNING 3건이 실제 소스에 반영됐는지 확인하는 **fresh review**다. 해당 라운드의
`RESOLUTION.md` 는 "W2·W3(CHANGELOG 누락·JSDoc 미갱신) 조치 완료"를 주장했으므로, 주장이
아니라 현재 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` ·
`CHANGELOG.md` · `execution-engine.service.spec.ts` 를 직접 `Read` 해 대조했다.

## 발견사항

- **[INFO]** 직전 라운드 WARNING 3건 모두 실측 반영 확인 — 회귀 없음
  - 위치: `CHANGELOG.md`(게이트 3-15, `## Unreleased — stalled 마감의 부분 커밋` 신규 항목),
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(게이트
    3325-3330, `finalizeStalledExhausted` JSDoc 에 `{@link cancelParkedExecution}` ·
    `markWebChatIdleTimeout` 자매 참조 문단 추가),
    `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`(게이트
    4914-4936 신규 테스트가 `installStalledTx(1)` 헬퍼를 실제로 재사용, 게이트 4968-4976
    `where`/`andWhere` WHERE 가드 assertion 신규 추가)
  - 상세: (1) CHANGELOG 신규 항목은 이 파일의 "짝 전이 원자성" 계열 확립된 형식(문제→원인→
    수정→수신자 영향)을 그대로 따르고, "수신자 영향 없음" 을 명시해 이벤트 payload·상태전이
    불변 사실과 일치한다. (2) JSDoc 문단은 자매 `cancelParkedExecution`(`:1017-1021`)의
    "ai-review WARNING #1 (2026-07-27) — ... 단일 트랜잭션으로 묶는다" 형식과 동일한 깊이로
    작성됐고, 날짜(`2026-08-15`)도 오늘 날짜와 일치한다. (3) 직전 라운드가 지적한
    "installStalledTx 헬퍼를 만들어 놓고 첫 테스트가 우회" 문제는 게이트 4915
    `const { execQb, nodeQb, txSpy, managerCqb } = installStalledTx(1);` 로 실제 교체됐다.
    (4) WHERE 가드 assertion 도 게이트 4971-4976 에 `execution_id`/`status = :running` 양쪽이
    실제로 추가됐다. 세 항목 모두 "고쳤다고 적었는데 실제로는 안 고쳤다" 형태의 재발이 아니다.
  - 제안: 없음 — 조치 없이 상태만 확인.

- **[INFO]** "30줄 아래" 줄-수-의존 주석도 실측 수정됨 (직전 라운드 INFO #3)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (게이트 3390-3392, `// 부모와 같은 code — 위 \`stalledError\` 상수를 도입한 이유(손으로
    반복하면 갈린다)가 이 자리에서 그대로 재현되고 있었다. 거리를 줄 수로 적으면 코드가
    움직일 때마다 틀린다.`)
  - 상세: 트랜잭션 클로저 도입으로 실제 거리가 44→48줄로 더 벌어졌던 문제였는데, 줄 수
    자체를 언급하지 않는 서술로 교체돼 코드가 다시 움직여도 깨지지 않는다.
  - 제안: 없음.

- **[INFO]** `finalizeStalledExhausted` 에는 자매 두 함수에 있는 `@remarks DB 오류는 내부
  흡수` 문구가 여전히 없음 — 단, 이는 직전 라운드에서 이미 검토·의도적 무조치로
  dispositioned 된 항목
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `finalizeStalledExhausted` JSDoc 헤더(게이트 3315-3333) — `cancelParkedExecution`
    (`:1015` `@remarks DB 오류는 내부 흡수...`)·`markWebChatIdleTimeout` 과 달리 이 함수는
    `try/catch` 로 감싸지 않고 트랜잭션 예외를 호출자에 그대로 전파한다
  - 상세: 직전 라운드 database 리뷰어가 이미 지적했고(`review/code/.../16_04_38/database.md`
    INFO), 같은 라운드 `RESOLUTION.md` 가 "무조치 — 유일 호출부(`onFailed`)가 `.catch()` 로
    흡수해 최종 동작 동등. 같은 세션 `--impl-prep` 도 '조치 불요(선택)' 판정" 으로 명시
    dispositioned 했다. 재지적이 아니라 상태 확인 차원의 기록.
  - 제안: 없음 — 이미 내려진 결정을 뒤집을 근거 없음. 다만 이 계열 함수를 다시 손댈 때
    "왜 여기만 함수 내부 try/catch 가 없는가"가 또 헷갈릴 수 있으므로, 다음에 이 함수를
    편집하는 사람이 한 줄(`caller `onFailed`가 `.catch()`로 흡수`) 추가해도 좋다는 이전
    제안은 여전히 유효(비필수).

- **[INFO]** `spec/5-system/4-execution-engine.md` §7.1 도 트랜잭션화 사실을 반영해 갱신됨
  - 위치: `spec/5-system/4-execution-engine.md`(게이트 851, mid-operation stalled 트리거
    문단 안에 "**이 마감은 단일 트랜잭션이다(2026-08-15)**" 문장 추가)
  - 상세: 구현 스펙과 코드가 같은 커밋 안에서 동기화됐다. 자매 함수 명·결함 설명·날짜 모두
    코드 JSDoc·CHANGELOG 와 일치한다.
  - 제안: 없음.

## 확인했으나 문제 없음

- `plan/in-progress/eia-stalled-atomicity.md`(신규): 결함 서술·조치·판별력(뮤테이션
  RED 3/3)·범위 밖 항목·체크리스트가 모두 코드 diff·CHANGELOG·JSDoc 과 일치. 체크리스트
  하단 `- [ ] /ai-review CRITICAL 0` 등 3개 항목이 미체크 상태인 것은 이번 재검토가
  진행 중이라는 정상 상태(허위 완료 주장 아님).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`: 정본 트래커 항목이
  `- [ ]` → `- [x] ... 완료 ([eia-stalled-atomicity](./eia-stalled-atomicity.md))` 로
  정확히 갱신되고, 부수 발견("`affected=0` 테스트 단언이 항상 참이 될 뻔했다")도 기록해
  둬 향후 동일 패턴 재발 방지 근거로 남아 있다.
- `review/code/2026/08/15/16_04_38/**`(RESOLUTION·SUMMARY·10개 reviewer 산출물·
  `_retry_state.json`·`meta.json`): 이번 diff 에 새 파일로 포함된 것은 이 저장소의 확립된
  관례(리뷰 산출물을 `review/**` 에 커밋)이며, 문서 자체로서 리뷰 대상 코드가 아니므로
  독스트링/JSDoc 기준을 적용하지 않았다. 내용상 RESOLUTION 의 조치 주장과 실제 코드가
  일치함은 위 발견사항에서 직접 대조 확인했다.
- `review/consistency/2026/08/15/15_54_20/**`: 마찬가지로 산출물 커밋. 문서화 관점에서
  추가 조치 불필요.
- README 업데이트 불필요 — 이번 변경은 백엔드 내부 트랜잭션 경계 수정으로 공개 API·
  엔드포인트·설정·환경변수·CLI 사용법 변경이 없다.
- 신규 환경변수·설정 옵션 없음 — 설정 문서화 대상 없음.
- 예제 코드 필요성 없음 — 내부 서비스 메서드이며 사용법 예제를 요구하는 공개 API 가 아니다.

## 요약

직전 라운드(`16_04_38`)에서 documentation 리뷰어가 낸 WARNING 3건(CHANGELOG 누락·JSDoc
미갱신·신규 헬퍼 우회)은 소스를 직접 열어 대조한 결과 전부 실측 반영됐다. CHANGELOG 항목은
이 파일의 확립된 "짝 전이 원자성" 서술 형식을 그대로 따랐고, JSDoc 은 자매 함수
`cancelParkedExecution` 의 선례와 동일한 깊이로 갱신됐으며, spec 문서(`4-execution-engine.md`)
도 같은 턴에 동기화됐다. "30줄 아래" 줄-수-의존 주석도 코드-위치-비의존 표현으로 교체돼
INFO 도 해소됐다. 유일하게 남은 관찰(`@remarks` 부재로 인한 에러-흡수-위치 문서화 비대칭)은
이미 직전 라운드에서 "무조치, 최종 동작 동등" 으로 dispositioned 된 사항이며 이번 diff 로
새로 생긴 문제가 아니다. 이번 라운드에서 문서화 관점의 신규 CRITICAL/WARNING 은 없다.

## 위험도
NONE
