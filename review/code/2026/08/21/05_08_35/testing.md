# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (11라운드째, `05_08_35`)

## 검토 방법

`git show --name-only 210398cc7`(이번 라운드가 리뷰하는 유일한 신규 커밋)로 실제 변경 파일을
확인했다: `CHANGELOG.md`(신규 문단)와 `production-build-devdep.spec.ts`(주석 3줄 추가)
**둘뿐**이다. 프롬프트가 diff 를 생략한 8개 파일(`reject-masked-resubmission.ts/.spec.ts`,
`executions-rerun.service.spec.ts`, `workflows.controller.spec.ts`,
`masked-reject-callers-guard.ts/.spec.ts`, `production-build-devdep-guard.ts/.spec.ts`)을 `Read`
로 직접 열어, 직전 라운드(`04_46_40`)가 검토한 상태와 코드가 동일함을 대조했다. 관련 8개 spec
스위트를 `jest` 로 직접 재실행해 **199/199 통과**를 실측했다.

## 이번 라운드의 실제 diff 성격

커밋 메시지가 스스로 밝히듯 **"코드 동작 변경 없음"** — `CHANGELOG.md` 에 이전 리뷰
(`04_46_40` WARNING: 저장소 전역 가드 두 개가 "마스킹 재제출 거부" 기능 범위를 넘어 CI
불변식을 신설하는데 CHANGELOG 에 미고지)에 대한 문서 처분과, `production-build-devdep.spec.ts`
의 vacuous 방지 캐너리 하한값(`500`)에 대한 근거 주석 3줄이 전부다. 두 변경 모두 **테스트
동작에 영향이 없다** — 주석 추가는 어떤 assertion 도 바꾸지 않았고(`toBeGreaterThan(500)` 그대로),
`CHANGELOG.md` 는 프로덕션·테스트 코드가 아니다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 신규 없음). 이번 diff 자체가 테스트 관점에서 검토할 새 코드
경로를 만들지 않는다.

참고로, 이전 라운드(`04_46_40`)에서 이미 식별·의도적으로 보류(deferred)된 항목들이 이번
diff 로 상태 변화 없이 유지된다 — 재지적이 아니라 상태 불변 확인:

- `findMaskedResubmissions`(exported, `reject-masked-resubmission.ts`)는 여전히 직접 단위
  테스트가 없다 — `grep -rl findMaskedResubmissions --include=*.spec.ts` 실측 결과, 코드로서
  이 함수를 부르는 spec 은 0건이고(`sanitize-error-message.spec.ts` 의 매치는 doc-comment 안의
  언급일 뿐), 상위 함수 `resolveTriggerParametersRejectingMasked` 경유로만 간접 커버된다.
  상위 함수가 raw/resolve 두 phase·경계값·왕복 통합을 촘촘히 덮고 있어 실질 회귀 위험은
  낮다는 기존 판단은 유효하다.
- `throwIfAny` 의 doc comment 가 서술하는 phase-경계 트레이드오프("① 통과 후 무관한 필드의
  진짜 `coerce_failed` 가 resolve 를 조기 중단시켜 ②(JSON 문자열 안 마커)가 실행되지 않는
  경우")를 직접 고정하는 회귀 테스트는 여전히 없다. 보안 우회가 아니라 UX 지연 성격이라는
  판단은 타당하고, 이미 의식적으로 미조치 확정된 항목이다.
- 프런트(`masked-markers.ts`)·백엔드(`sanitize-error-message.ts`) 의 `MASKED_MARKERS` 리터럴
  동기화를 강제하는 크로스-런타임(jest↔vitest) 테스트는 없다 — 프런트 테스트 자신의
  doc comment 가 이미 자백·별도 트래커 항목으로 관리 중이다.

## 강점 (이번 diff 대상)

- **근거 있는 매직 넘버**: `production-build-devdep.spec.ts` 의 하한 `500` 은 이전까지
  "왜 500 인가" 가 코드에 없었다. 이번 커밋이 "도입 시점 실측 805 파일" + "이 아래로
  떨어지면 설정 해석이 고장난 것으로 의심" 이라는 판단 기준을 주석으로 남겨, 다음 사람이
  이 값을 조정할 때 근거 없이 좁히거나 넓히는 것을 막는다 — 테스트 가독성/유지보수성 관점의
  개선.
- **재실행 검증**: `reject-masked-resubmission.spec.ts` · `resolve-trigger-parameters.spec.ts` ·
  `executions-rerun.service.spec.ts` · `workflows.controller.spec.ts` ·
  `masked-reject-callers.spec.ts` · `production-build-devdep.spec.ts` ·
  `sanitize-error-message.spec.ts` 등 8개 스위트, **199건 전부 통과** 재확인(`npx jest` 직접
  실행). 회귀 없음.

## 요약

이번 라운드가 리뷰하는 실제 diff 는 `CHANGELOG.md` 문서 정정과 기존 테스트 파일의 주석
3줄 추가뿐이며, 테스트 동작·커버리지·assertion 에 아무 변화가 없다. 관련 스위트 8개 199건을
직접 재실행해 회귀가 없음을 실측했고, 신규 CRITICAL/WARNING/INFO 없음. 직전 라운드까지
이미 식별·보류된 INFO 3건(`findMaskedResubmissions` 직접 단위 테스트 부재, phase-경계
트레이드오프 미검증, 마커 리터럴 크로스-런타임 미검증)은 이번 diff 와 무관하게 상태
불변이다. 런타임 방어 로직 자체는 `01_15_47` 이후 11라운드 연속 CRITICAL 0/WARNING 0 을
유지한다.

## 위험도

NONE
