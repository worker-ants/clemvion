# 요구사항(Requirement) 리뷰 결과

## 검증 방법

diff 대상 3개 실질 파일(`reject-masked-resubmission.spec.ts`, `masked-marker-test-gaps.md`,
`spec-sync-external-interaction-api-gaps.md`)을 `Read`/`Grep`으로 전문 대조했고, 나머지
19개 파일(`review/code/2026/08/22/21_15_53/**`, `review/consistency/2026/08/22/20_57_25/**`)은
이전 리뷰/consistency 라운드의 산출물이 그대로 커밋된 것으로 확인했다(프로젝트 컨벤션상
`review/**` 커밋은 정상). 실제 소스(`reject-masked-resubmission.ts`,
`resolve-trigger-parameters.ts`, `coerce-type.ts`, `trigger-parameter.types.ts`)를 읽고
새 테스트의 값·분기를 손으로 트레이스했으며, `npx jest reject-masked-resubmission.spec.ts`
실행으로 실제 통과 여부(22/22 통과)를 실측했다. `spec/4-nodes/7-trigger/1-manual-trigger.md`
§6/Rationale 를 직접 열어 신규 테스트가 고정하는 트레이드오프가 spec 본문과 line-level 로
일치하는지 대조했다. plan 문서의 정량 주장(141줄, 트래커 앵커 인용, 커밋 해시 존재 여부,
`egress-masking.md §3` 문구)도 각각 `grep`/`git log`로 실측 검증했다.

## 발견사항

- **[INFO]** 신규 캐너리 테스트(`[캐너리] 무관한 필드의 coerce 실패가 ② 마커 검사를 선점한다`)는
  코드·spec과 line-level 로 정확히 일치한다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:327-354`
  - 상세: `resolveTriggerParameters`(`resolve-trigger-parameters.ts:167-160`)는 스키마 필드를
    순회하며 `coerce_failed` 를 포함한 `errors` 를 모두 모은 뒤 **`errors.length > 0` 이면
    `resolved` 를 반환하지 않고 통째로 throw** 한다(부분 반환 없음). 따라서 `count:
    'not-a-number'` 로 `coerce_failed` 가 나면 phase②(`throwIfAny(findMaskedResubmissions(...,
    resolved))`)는 아예 도달하지 못한다 — 새 테스트가 주장하는 "마커가 무관한 필드의
    coerce_failed 에 가려진다"는 동작과 정확히 일치. 대조군(`count: 1`)도 직접 트레이스로
    `['payload']` 를 반환함을 확인해 vacuous 하지 않다. `spec/4-nodes/7-trigger/1-manual-trigger.md`
    의 `## Rationale` §"`masked_value_resubmitted` 검사 시점"(L228-229: *"phase 를 합쳐 한 번에
    던지지 않는 이유도 같다 — raw 에서 걸린 뒤에도 resolve 를 강행하면 `coerce_failed` 가 섞여
    안내가 다시 흐려진다"*)이 이 트레이드오프를 이미 의도된 설계로 명문화하고 있어, 이 회귀
    테스트는 spec 위반이 아니라 spec 이 이미 승인한 동작을 기계로 고정한 것이다.
  - 제안: 조치 불요. (참고: `npx jest` 실행 결과 22/22 통과, 기존 21개 + 신규 1개로 plan 의
    "기존 21개"/"18개 테스트"(개별 `it()` 블록 수, `it.each` 3건 제외) 수치와 정확히 일치함을
    직접 카운트로 확인했다.)

- **[INFO]** plan 문서(`masked-marker-test-gaps.md`)의 정량 주장이 전부 실측과 일치한다.
  - 위치: `plan/in-progress/masked-marker-test-gaps.md:61-62` (`ExecutionsService.reRun` "실측
    141줄"), `:43-50` (`findMaskedResubmissions` 분기 커버리지 표)
  - 상세: `ExecutionsService.reRun` 은 `executions.service.ts:420`(`async reRun(`)부터
    `:560`(닫는 `}`)까지로 `560-420+1=141` 줄, 주장과 정확히 일치. 분기 커버리지 표의 6행
    (빈/없는 스키마·비객체 raw·`rawSource` 키 필터·정확 일치 경계·깊이 상한·다중 필드 수집)은
    `reject-masked-resubmission.ts:120-129`(`findMaskedResubmissions` 구현)의 실제 분기와
    직접 대조해도 누락이 없다.
  - 제안: 조치 불요.

- **[INFO]** 이전 리뷰 라운드(`review/code/2026/08/22/21_15_53/`)가 지적한 WARNING 2건(트래커
  줄 번호 인용 stale — `L868`→실제 `L888`, `L826-827`→실제 `L831-832`)이 RESOLUTION.md 주장대로
  **숫자 정정이 아니라 앵커 문구 인용으로 실제로 교체돼 있음**을 확인했다.
  - 위치: `plan/in-progress/masked-marker-test-gaps.md:73,76-77` (현재 "트래커 항목
    `throwIfAny` 의 phase 경계 트레이드오프 미검증 종결" / "트래커 `findMaskedResubmissions`
    직접 단위 테스트 부재 항목" 형태로 되어 있음, 줄 번호 인용 없음)
  - 제안: 조치 불요 — fix 가 실제로 적용됐음을 별도 검증으로 재확인.

- **[INFO]** 조건부 종결 항목("PR #1194 머지 시 흡수") 검증.
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:874-878`
  - 상세: `git log`로 `bdcfdc514`(#1194, `egress-masking.md` 신설) 와 `923b5892e`(#1195) 커밋이
    실제 존재함을 확인했고, `spec/conventions/egress-masking.md:79` 에 실제로 `## 3. 이 문서는
    기계가 지키지 않는다` 섹션과 `:83` 의 "알려진 stale 트리거" 문구가 존재함을 확인했다 —
    plan 의 종결 근거가 실측에 부합한다.
  - 제안: 조치 불요.

CRITICAL/WARNING 급 발견 없음. 프로덕션 코드 변경이 없는 순수 테스트 1건 추가 + plan 문서
갱신 changeset이며, 기능 완전성·엣지 케이스·에러 시나리오·spec fidelity 모든 관점에서 결함을
찾지 못했다.

## 요약

이번 diff는 프로덕션 코드 변경 없이 (1) `resolveTriggerParametersRejectingMasked` 의 이미
docstring/spec Rationale 에 문서화된 phase-경계 트레이드오프(무관 필드의 `coerce_failed` 가
phase② 마커 검사를 선점)를 회귀 테스트로 고정하고, (2) 정본 트래커 두 곳의 이월 항목을
실측 기반으로 재판정·갱신하며, (3) 직전 리뷰 라운드가 지적한 문서 stale-인용 WARNING 2건을
실제로 고쳤다. 신규 테스트는 대조군을 포함해 vacuous 하지 않고, 실제 소스 트레이스·spec
Rationale 대조·`jest` 실행(22/22 통과) 모두로 정확성이 확인됐다. plan 문서의 모든 정량 주장
(141줄, 커밋 해시, 앵커 인용, spec 문구)을 `grep`/`git log`로 개별 실측해 전부 사실과 일치함을
확인했다. Critical/Warning 급 요구사항 결함은 발견되지 않았다.

## 위험도
NONE
