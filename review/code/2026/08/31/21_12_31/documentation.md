# 문서화(Documentation) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`), 4라운드 누적 diff

## 배경

이번 diff 는 원 변경 커밋(`adc4a3ff6`) + 1R(`20_27_29`) fix + 2R(`20_43_35`) fix + 3R(`20_59_14`)
fix 의 누적이며, 세 라운드의 리뷰 산출물(총 33개 파일)도 신규 커밋으로 포함된다. 3R
documentation 리뷰는 정확히 이 결함 클래스 — **"2R 코드 fix(생성자 인자 스캔 확장 +
`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 앵커 추가)가 상위 산문에 역전파되지
않음"** — 를 `error-codes.ts` JSDoc 과 `CHANGELOG.md` 두 곳에서 WARNING 으로 잡았고, 3R
RESOLUTION(`review/code/2026/08/31/20_59_14/RESOLUTION.md`)은 둘 다 반영됐다고 기록했다.

이번 라운드에서는 (a) 그 3R fix 가 실제로 정확히 반영됐는지, (b) 같은 결함 클래스가 **세
번째 위치**에 남아있지 않은지를 직접 소스 대조로 검증했다.

## 검증 방법 (실제 실행/열람, 저장소 뮤테이션 없음)

- `git log --oneline -5` + `git status --short` — HEAD 는 `18062a61a`("3R W2건 반영"), 트리는
  이번 세션의 출력 디렉터리 외 clean.
- `codebase/backend/src/nodes/core/error-codes.ts:115-174` 를 `Read` 로 직접 열람 — `EngineErrorCode`
  JSDoc 의 "여기 있는 것/없는 것" 목록이 "아래 **셋**"으로 정정돼 `RESUME_CHECKPOINT_MISSING`/
  `RESUME_INCOMPATIBLE_STATE` 항목이 포함됨을 확인(3R W1 fix 실제 반영 확인).
- `CHANGELOG.md:1-48` 을 `Read` 로 열람 — "옮기지 않은 것도 있다" 단락이 세 카테고리를 모두
  나열함을 확인(3R W2 fix 실제 반영 확인). "가드가 훑는 형태는 다섯이고, 여섯 번째에서
  멈췄다" 경계 결정 문단도 함께 반영됨을 확인.
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts` 를 `Read` 로 전체
  열람 — 근거 수치("가장 짧은 것이 64 자", 3R INFO13 fix)와 하한 30(`ErrorCode` 36 +
  `EngineErrorCode` 4 = 40)을 실제 소스에서 직접 카운트(`awk`)해 재확인. 테스트 개수(14개:
  `it` 8 + `it.each` 5 + positive-path 1)를 직접 세어 plan/RESOLUTION 의 "14건" 서술과 일치함을
  확인.
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` 전체 열람 —
  `ANCHORED_ELSEWHERE` 8개 항목·`collectBoundCodes`/`findUnanchored` JSDoc 이 실제 로직(5형태
  스캔, `Error`-suffix 생성자 제한, 6번째 형태에서 멈춘 경계 근거)과 일치함을 확인.
- `plan/complete/exec-intake-followups.md` 의 ARCH#5 완료 기록 전체(1~114행)를 `Read` 로 열람 —
  **여기서 3R 이 놓친 세 번째 위치의 같은 결함을 발견**(아래 참조). `grep -rn` 으로
  `INVALID_EXECUTION_STATE.*ERROR_PORT_FALLBACK` 패턴이 저장소 안에서 등장하는 모든 실제 위치를
  대조해, 이 plan 파일의 해당 문단이 유일하게 갱신되지 않은 인스턴스임을 확인.

## 발견사항

- **[WARNING]** `plan/complete/exec-intake-followups.md` 의 "④ 옮기지 않은 것과 그 이유" 단락이
  2R fix(`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 앵커 추가)를 반영하지 못해
  여전히 **두 카테고리만** 나열한다 — 정확히 3R 이 `error-codes.ts` JSDoc 과 `CHANGELOG.md`
  에서 잡았던 것과 **같은 결함 클래스**의 세 번째, 아직 잡히지 않은 인스턴스다.
  - 위치: `plan/complete/exec-intake-followups.md:47-51` (Read 로 직접 확인한 실제 줄 번호 —
    이 파일의 diff 는 프롬프트 크기 제한으로 생략돼 있어 게이트 숫자를 인용할 수 없었다)
  - 상세: 해당 문단은 다음과 같다 —

    > **④ 옮기지 않은 것과 그 이유.** `INVALID_EXECUTION_STATE`·`ERROR_PORT_FALLBACK`
    > (에러 클래스 `readonly code`)와 trigger 파라미터 검증 4종
    > (`TriggerParameterErrorDetail['code']` 유니온, 규약 §4.2 의 `details[].code` 레이어)은
    > **이미 타입 앵커가 있다.** 상수로 또 옮기면 앵커가 둘이 되어 갈라진다. 가드의
    > `ANCHORED_ELSEWHERE` 에 **사유와 함께** 등재했다.

    반면 실제 `ANCHORED_ELSEWHERE`(`engine-error-code-anchor-guard.ts:30-53`, 직접 열람 확인)는
    **8개 항목·세 카테고리**다 — 위 두 카테고리에 더해 `RESUME_CHECKPOINT_MISSING`/
    `RESUME_INCOMPATIBLE_STATE`(`RehydrationError.code` 리터럴 유니온, 생성자 positional 인자,
    2R 에서 신설)가 있다. **같은 저장소·같은 브랜치에서 이미 두 번 지적되고 고쳐진 문단**
    (`error-codes.ts:132-139` 는 "아래 셋"으로, `CHANGELOG.md:21-26` 은 세 카테고리 모두 나열하는
    형태로 이미 정정됨)이 이 plan 문서에서는 여전히 원 커밋(`adc4a3ff6`) 시점 그대로다. plan
    문서는 이 작업 항목의 **완료 기록·감사 추적**(다음에 "왜 이 셋을 안 옮겼나" 를 판단할 때
    참조할 문서)이라, 세 위치 중 하나만 낡아 있으면 어느 쪽이 최신인지 다음 사람이 다시
    소스를 뒤져야 한다. 부수적으로 이 문단은 "왜 5형태에서 멈췄는가" 경계 결정
    (`CHANGELOG.md` 는 별도 문단으로 상세히 서술)도 전혀 언급하지 않아, plan 의 "완료" 서술이
    실제 최종 설계보다 좁다.
  - 제안: `INVALID_EXECUTION_STATE`·`ERROR_PORT_FALLBACK` / trigger 파라미터 검증 4종 목록에
    세 번째 항목(`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` — `RehydrationError.code`
    리터럴 유니온, 생성자 positional 인자, 2R 추가)을 보강한다. 여유가 되면 "5형태에서 멈춘
    경계 결정"도 한 줄 요약해 `CHANGELOG.md`/JSDoc 과 세 문서가 서로 어긋나지 않게 한다.

## 확인된 사항 (참고용 — 결함 아님)

- **3R 의 W1/W2(JSDoc·CHANGELOG 역전파 누락)는 실제로 정확히 해소됐다.**
  `error-codes.ts:132` "아래 **셋**은" + 3개 bullet, `CHANGELOG.md:21-26` "옮기지 않은 것도
  있다" 단락 모두 `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 를 포함한다.
- **3R 의 INFO13(가드 spec 주석 수치 오류, "45자"→"64자")·INFO14(plan 테스트 개수, "11건"→"14건")
  도 정확히 반영됐다.** `engine-error-code-anchor.spec.ts:140`, 그리고 plan 파일의 "테스트
  14건" 서술(58행) 둘 다 직접 대조 확인. 특히 spec.ts 는 자신이 어림값을 썼다가 틀렸다는
  사실 자체를 주석에 남겨(리뷰 `20_59_14` INFO13 인용) 재발을 방지한다.
- `readDeclaredCodes` 하한(30)의 근거 "ErrorCode 36 + EngineErrorCode 4 = 40" 을 `awk` 로 직접
  카운트해 재확인 — vacuous 하지 않음.
- `engine-error-code-anchor.spec.ts` 의 테스트 14건(전제 2 + 바인딩 형태 커버리지 5 + 대조군
  3 + positive-path 1 + 본 단언 1 + 예외 목록 사유 1 + 죽은 항목 1)을 직접 세어 plan/
  RESOLUTION 의 "14/14" 서술과 일치함을 확인.
- `collectBoundCodes`/`findUnanchored` JSDoc(다섯 형태 스캔 범위, `Error`-suffix 생성자만 보는
  이유, 6번째 형태(`markExecutionCancelled(executionId, 'RESUME_FAILED')`)에서 멈춘 경계와 그
  근거)가 실제 코드 로직·`CHANGELOG.md`·`error-codes.ts` JSDoc 서술과 전부 일치함을 확인 —
  이 세 문서 사이의 "형태 개수/경계 이유" 서술은 이제 정합적이다(plan 문서 제외).
- README/API 문서/환경변수 문서: 여전히 해당 없음 — 순수 내부 리팩터, API 계약·런타임
  동작·신규 env var/설정 없음.

## 요약

3라운드에 걸쳐 반복된 "코드 fix 가 그 fix 를 설명하는 상위 산문에 역전파되지 않는다" 는
결함 클래스가, 3R 에서 잡힌 두 위치(`error-codes.ts` JSDoc·`CHANGELOG.md`)는 실제로 정확히
고쳐졌지만 **세 번째 위치**(`plan/complete/exec-intake-followups.md` 의 ARCH#5 완료 기록 ④
단락)에는 아직 남아 있다 — 2R 에서 추가된 `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE`
앵커 카테고리가 이 plan 문서에서만 누락된 채다. 이 외에 소스를 직접 열람·카운트해 재검증한
JSDoc·가드 docstring·CHANGELOG·테스트 개수·매직넘버 근거는 전부 정확했고, 3R 에서 반영됐다고
기록된 fix(W1/W2/INFO13/INFO14) 도 모두 실제로 반영돼 있음을 확인했다. 새로 발견된 결함은
plan 문서 한 곳의 문서 동기화 갭(WARNING) 뿐이며, 동작·계약에 영향을 주지 않는다.

## 위험도

LOW
