# 테스트(Testing) 리뷰 — `masked-marker-plan-close-d8edad`

## 범위 요약

실질 코드 변경은 `codebase/backend/src/modules/executions/executions.service.ts` 1개 파일뿐이다.
`reRun()` 내부의 40줄 입력 해석 블록(스키마 로드 → 마커 거부 resolve → 검증 실패를 응답 봉투로
매핑)을 `private resolveManualOverrideInput()` 로 그대로 옮긴 **순수 추출 리팩터**다 — diff 를
직접 대조한 결과 로직 텍스트는 한 글자도 바뀌지 않았고(주석 한 줄 "이 함수가" → "그 wrapper 가"
표현만 조정), 신규 로직·신규 분기는 없다. 나머지 파일(2~13번)은 `plan/**`·
`review/consistency/**` 문서/산출물이며 실행 코드가 아니다.

## 검증 절차 (직접 실행)

- `npx jest executions-rerun.service.spec.ts executions.service.spec.ts` → **70/70 PASS**
  (`codebase/backend`, 리뷰 시점 재실행).
- `npx jest masked-reject-callers.spec.ts` → **15/15 PASS** — 추출로 호출 지점이 `reRun` 본문에서
  private 메서드로 옮겨갔지만, 이 가드는 파일 단위 AST 스캔이라 호출 지점 위치 이동에 영향받지
  않음을 실측 확인.
- 추출 전/후 diff 를 라인 단위로 대조 — 제거된 인라인 블록과 신설 `resolveManualOverrideInput`
  본문이 공백/포맷 차이만 있을 뿐 문자열 그대로 일치.
- commit `af0eb4031` 메시지에 기록된 뮤테이션 3종(M1 에러 코드 되돌림·M2 `details`→`errors`
  되돌림·M3 마커 거부 우회)의 예측 RED 지점이 실제 존재하는 테스트(아래)와 대응되는지 교차 확인.

## 발견사항

- **[INFO]** `resolveManualOverrideInput` 의 rethrow 분기(`TriggerParameterValidationException`
  이 아닌 예외를 그대로 다시 던지는 경로)를 직접 겨냥한 테스트가 없다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:580` (`throw err;`,
    `resolveManualOverrideInput` 의 catch 블록 마지막 줄 — 프롬프트 게이트 기준)
  - 상세: `loadTriggerParameterSchema` 나 `resolveTriggerParametersRejectingMasked` 가
    `TriggerParameterValidationException` 이 아닌 임의 오류(예: DB 조회 실패)를 던지는 경우
    그대로 전파돼야 하는데, 이를 직접 확인하는 캐너리가 `executions-rerun.service.spec.ts` 에
    없다. **다만 이 갭은 이번 추출이 만든 것이 아니다** — 추출 전에도 동일 코드가 `reRun` 인라인에
    있었고 같은 상태였다(diff 로 확인). 순수 추출 PR 범위 밖의 선존 갭이라 이번 커밋을 막을 사유는
    아니지만, 다음에 이 함수를 손댈 때 회귀 캐너리로 고정할 가치가 있다.
  - 제안: `resolveTriggerParametersRejectingMasked` 를 mock 해 임의 `Error` 를 던지게 하고
    `reRun()` 이 그 오류를 그대로 전파(`BadRequestException` 으로 감싸지지 않음)하는지 확인하는
    테스트 1개 추가를 백로그에 남길 것.

- **[INFO]** 추출된 `resolveManualOverrideInput` 은 `private` 로 남아 직접 단위 테스트 대상이
  아니며, 전량 공개 메서드 `reRun()` 을 경유한 간접(통합형 unit) 테스트로만 커버된다.
  - 위치: `executions.service.ts:546` (`private async resolveManualOverrideInput(...)`),
    커버 지점: `executions-rerun.service.spec.ts:303-536`
  - 상세: `plan/complete/masked-marker-test-gaps.md` 항목 ②가 "상위 함수 경유 간접 커버로
    모든 분기가 이미 덮여 있다"는 근거로 직접 단위 테스트 부재를 의도적으로 유예한 것과 같은
    설계 판단이 이번 추출에도 이어진다. `reRun()` 자체가 IDOR·chain-depth·dry-run 등 여러
    책임과 얽힌 47-라인 오케스트레이터라, 간접 테스트는 각 검증마다 QueryBuilder 체인 전체를
    mock 해야 하는 비용이 있다(`makeQb()` 헬퍼로 완화돼 있음). 문제로 지적하는 것은 아니고,
    이 트레이드오프가 plan 문서에 근거와 함께 명시돼 있어 감점 사유는 아니다.
  - 제안: 없음(설계상 의도적 선택, 근거 문서화 완료).

## 긍정 평가 (반증까지 마친 항목)

- **뮤테이션 검증이 실제로 유효하다**: commit `af0eb4031` 이 보고한 M1(`INVALID_INPUT` 되돌림)·
  M2(`details`→`errors` 되돌림)은 `executions-rerun.service.spec.ts` 의
  `'throws INVALID_TRIGGER_PARAMETERS...'`(라인 330-363, `code` 값을 정확히 단언)와
  `'[회귀] 거부 응답이 details[] 로...'`(라인 403-441, `body.errors` 가 `undefined` 임을
  명시적으로 확인)가 정확히 겨냥한다 — "instanceof 만 보고 값은 안 본다" 는 vacuous 패턴을
  피해 코드 값을 직접 단언하는 것을 주석(`17_06_14` testing W5 참조)으로 스스로 밝히고 있다.
  M3(마커 거부 우회)는 `'[캐너리] inputOverride 에 마스킹 마커가 실리면 거부한다'`(라인 371-393)
  가 겨냥하며, `masked-reject-callers.spec.ts` 의 AST 스캔 가드가 별도 방어선으로 병존한다.
- **테스트 격리**: `beforeEach` 에서 `getOneQueue`/`getRawOneQueue`/`getManyQueue`/`chainDepth`
  전부 리셋하고 `service` 를 매 테스트 새로 생성한다 — 테스트 간 상태 누수 없음.
- **가독성**: 각 테스트가 무엇을 왜 검증하는지 한글 주석으로 설명하며, 특히
  `'[캐너리]'`/`'[회귀]'`/`'[경계]'` 접두사로 테스트의 성격(신규 방어/회귀 고정/경계값)을
  이름에서 바로 구분할 수 있게 해 둔 관례가 좋다.
- **회귀 유효성**: 리뷰 시점 재실행에서 관련 테스트 전부(70+15) GREEN — 추출이 기존 회귀
  방어선을 깨지 않았음을 직접 확인.

## 요약

이번 diff 의 실질 코드 변경은 `ExecutionsService.reRun` 의 40줄 입력 해석 블록을
`resolveManualOverrideInput` private 헬퍼로 옮긴 것뿐이며, 로직은 문자 그대로 보존됐다(diff
대조로 확인). 이 추출을 겨냥한 방어 테스트는 새로 작성되지 않았지만 — 그럴 필요가 없다. 기존
`executions-rerun.service.spec.ts` 22개 테스트가 공개 메서드 `reRun()` 을 통해 이미 모든 분기
(스키마 부재·검증 실패 코드/봉투 형태·마커 거부·경계값·audit 실패 흡수)를 커버하고 있고, 리뷰
시점 재실행에서도 전부 GREEN 이다. commit 메시지에 기록된 3종 뮤테이션 결과도 실제 테스트
파일의 구체적인 라인과 정확히 대응돼 "GREEN 이 증거가 아니다"라는 이 저장소의 원칙을 스스로
실천했다. 유일한 잔여 갭(비-`TriggerParameterValidationException` rethrow 경로 미검증)은 이번
추출이 만든 것이 아니라 추출 전부터 있던 선존 상태이므로 이 PR 을 막을 사유가 아니다. 나머지
파일들은 plan/consistency 산출물로 테스트 관점에서 다룰 코드가 없다.

## 위험도

NONE
