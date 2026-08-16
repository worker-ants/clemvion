# 유지보수성(Maintainability) 리뷰

## 대상 요약

이번 changeset(107개 리뷰 대상 파일) 중 실제 프로덕션/테스트 코드는 다음 8개뿐이다. 나머지는
`plan/**`·`spec/**`·`review/**`·`.claude/docs/**`(과거 리뷰 라운드 `17_12_34`/`17_35_49`/
`17_56_15`의 산출물이 이 PR에 함께 커밋된 것 포함) — 유지보수성 8개 관점(가독성/네이밍/
함수 길이/중첩/매직넘버/중복/복잡도/일관성)의 직접 대상이 아니라 리뷰에서 제외했다.

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규) + `.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`

이 diff는 `git log`상 이미 3라운드(`17_12_34`→`17_35_49`→`17_56_15`)의 `/ai-review`를 거쳐
maintainability WARNING(무단 `as Execution`/`as NodeExecution` 캐스트, 고아 JSDoc 등)이 전부
반영된 **최종 상태**다. 아래는 그 이후에도 남아 있는 항목만 신규로 적는다.

## 발견사항

- **[INFO]** 신규 테스트 헬퍼 `buildSingleQB` 가 같은 파일에 두 번(사실상 동일 로직) 정의됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:861` (신규 정의, 이
    diff 가 추가) — 기존 정의는 `:396` (이 diff 이전부터 존재)
  - 상세: 이번 diff 가 새로 추가한 `describe('Execution.error 응답 마스킹 — 표면 전수', ...)` 블록
    안에서 상위 스코프의 `buildSingleQB`(leftJoinAndSelect/leftJoin/addSelect/where/getOne 체인
    mock)를 재사용하지 않고 동일한 5줄짜리 헬퍼를 지역으로 다시 정의했다. 직전 라운드
    (`17_12_34`)의 maintainability reviewer 가 이미 지적했고 RESOLUTION 은 "선존 패턴을 따른
    것이라 이 diff 가 만든 중복이 아니다"로 무조치 처리했는데, 실측하면 **정의 자체(861행)는
    이 diff 가 새로 추가한 코드**다 — 패턴이 선존이었다는 것과 이 특정 중복 인스턴스가 신규라는
    것은 별개다. 다만 로직이 완전히 동일하고 스코프가 좁아 즉시 버그로 이어지진 않는다.
  - 제안: 상위 `describe` 블록 스코프(또는 파일 상단)로 끌어올려 단일 정의를 공유하면 향후 QB
    mock 체인이 바뀔 때 두 곳을 동시에 고쳐야 하는 부담이 사라진다. 급하지 않음 — 이미 팀이
    한 차례 검토·의도적 보류한 항목이라는 점을 참고.

- **[INFO]** 리뷰 라운드 세션 ID를 프로덕션 소스 JSDoc 에 영구 인용하는 밀도가 이 파일에서
  특히 높아짐
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`
    JSDoc(`:963-989`, 6줄 함수에 27줄 문서), `stop`/`stopInternal` JSDoc(`:791-829`),
    `findById` 내부 인라인 주석(`:624-637`, 6줄 코드에 14줄 주석)
  - 상세: `` `17_12_34` maintainability W1 ``, `` `17_35_49` maintainability W1 ``,
    `` `16_32_42` cross_spec CRITICAL `` 같은 리뷰 세션 타임스탬프가 함수 JSDoc 안에 근거로
    박혀 있다. `grep` 실측 결과 이 관행 자체는 이 저장소 기존 컨벤션(같은 디렉터리의
    `terminal-error-payload.ts`·`sanitize-error-message.ts` 등도 동일)이라 이번 diff 가
    새로 만든 스타일은 아니고, "왜 이렇게 했는지"를 코드 옆에 남기려는 의도도 이해된다. 다만
    이 PR 은 그 밀도를 한 파일 안에서 크게 늘렸다(`toResponseExecution` 하나가 실제 로직의
    4배가 넘는 주석) — 세션 ID는 그 리뷰 아카이브(`review/code/2026/08/16/*`)가 살아있는
    동안만 의미가 있고, 시간이 지나면 판독 불가능한 토큰으로 남아 향후 독자가 함수를 스캔하는
    비용만 늘린다.
  - 제안: 조치 불요(기존 컨벤션 준수, 팀 의사결정 영역). 다만 "왜"의 근거·타임라인 서사는
    이미 같은 PR 의 `plan/complete/eia-internal-rest-error-masking.md`(또는 대응 in-progress
    plan) 에도 기록되고 있으므로, 향후에는 세션 ID 나열보다 그 plan 문서로의 포인터 한 줄로
    코드 주석을 더 가볍게 유지하는 것도 고려할 만하다.

- **[INFO]** "자매 넷 중 하나만" 계열 근거 문구가 3개 파일에 걸쳐 유사 문장으로 반복됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:801` (`stop` JSDoc),
    `:973-975` (`toResponseExecution` JSDoc), `codebase/backend/src/modules/executions/
    background-runs/background-runs.service.ts:299-301`,
    `codebase/backend/src/shared/utils/redact-stored-error.ts:16-19`
  - 상세: "이 저장소가 자매 넷/자매 중 하나만 놓치는 패턴을 반복해 겪었다"는 동일한 배경
    설명이 네 곳에서 문장만 조금씩 바뀐 채 반복된다. 코드가 아니라 코멘트 중복이라 실행에는
    영향이 없고, 각 파일이 로컬 컨텍스트(그 파일의 관문 함수) 관점에서 "왜 이 관문이
    필요한가"를 설명하려는 의도적 선택으로 읽힌다 — `redact-stored-error.ts` 의 JSDoc 이 이미
    이 배경의 정본(SoT) 서술을 담당하고 있으므로, 굳이 문제로 등재하지 않는다.
  - 제안: 조치 불요. 참고로만 남긴다.

## 긍정적 관찰 (조치 불요)

- `stripPrivateRelations` → `toResponseExecution` 개명과 `stop`/`stopInternal` 책임 분리는
  "무엇을(관계 제거+마스킹) 왜 한 함수에 묶었는지"를 JSDoc 이 명확히 설명하고, 4개 반환 표면을
  단일 관문으로 수렴시켜 "자매 함수 중 하나만 놓친다"는 이 저장소의 반복 결함 클래스를 구조적으로
  막는다 — 순수 함수 추출·단일 책임 원칙에 부합하는 리팩터.
- `ResponseExecution`/`ResponseNodeExecution` 타입 도입으로 `as Execution`/`as NodeExecution`
  무단 단언이 제거되어, `.error` 의 `null` 가능성을 컴파일러가 강제한다 — 캐스트가 결함을
  숨기던 자리를 타입으로 되돌린 좋은 예. 이 저장소에 이미 있는 "서비스 반환 shape 은 `*Dto`
  가 아니라 서술적 이름을 쓴다" 컨벤션(`ExecutionDetailWithTrigger` 등)과도 일관된다.
- `findById` 의 `nodeExecutions[].error` 마스킹은 자매 함수 `reconcilePreParkWaitingStatus`
  와 동일한 copy-on-change 관례(`error == null` 이면 원본 참조 그대로)를 따르도록 3라운드
  리뷰를 거치며 수정됐고, 그 규율을 지키는 이유(uncapped 배열·비-캐시 경로)를 주석에 남겨
  다음 편집자가 실수로 되돌릴 유인을 줄인다.
- `redact-stored-error.ts` 는 단일 책임 leaf 유틸(64줄, 함수 1개), 단언을 한 자리로 모으는
  설계("호출부 4곳에 흩으면 한 곳이 다른 캐스트를 쓴다")를 명시적으로 채택해 이 PR 이 우려하는
  중복·불일치 재발을 원천 차단한다.

## 요약

핵심 코드 변경(신규 `redact-stored-error.ts` + 4개 반환 지점 관문화)은 이미 3라운드의
`/ai-review`를 거치며 캐스트로 가려진 null 누락, copy-on-change 위반, 고아 JSDoc 등 실질적인
maintainability WARNING 이 전부 해소된 상태다. 현재 남은 것은 테스트 헬퍼 미세 중복 1건과
리뷰 세션 서사가 소스 코멘트에 다소 두텁게 쌓인 스타일 관찰뿐이며, 둘 다 기능·복잡도·가독성에
실질적 위험을 주지 않는 INFO 수준이다. 반대로 이번 리팩터(관문 단일화, 명시 타입 도입,
copy-on-change 정합)는 이 저장소가 반복 겪어온 "자매 표면 하나만 놓친다"는 결함 클래스를
구조적으로 줄이는 방향이라 유지보수성 관점에서 순증(positive)으로 평가한다.

## 위험도

LOW — CRITICAL/WARNING 없음. INFO 3건은 전부 조치 불요(참고 기록) 수준이다.
