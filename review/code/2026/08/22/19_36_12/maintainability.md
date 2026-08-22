# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `REASON_TO_DETAIL` 신규 주석 3건의 JSDoc 블록 스타일이 형제 항목끼리 불일치(단일행 vs 다중행)
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40`(`missing_required` — 단일행 `/** ... */`), `:45-48`(`coerce_failed` — 다중행 `/** \n * ... \n */`), `:53-56`(`invalid_schema` — 다중행)
  - 상세: 이번 diff 가 `REASON_TO_DETAIL` 4개 항목 중 3개(`missing_required`/`coerce_failed`/`invalid_schema`)에 새로 JSDoc 주석을 붙였는데, `missing_required` 만 한 줄짜리 `/** 텍스트 */` 형식이고 나머지 둘은 `/** \n * ... \n */` 다중행 형식이다. 같은 `Record` 리터럴 안 형제 항목이 같은 목적(행동 기준 설명)의 주석을 서로 다른 물리적 포맷으로 달고 있어, 파일을 훑을 때 시각적 리듬이 깨진다. 기존(변경 전) `masked_value_resubmitted` 항목은 다중행이었으므로, 다중행이 이 파일의 지배적 패턴이다. 내용 자체(“사용자가 취할 행동” 기준 서술)는 4종 모두 일관되어 이전 리뷰(19_25_39 documentation INFO #18)가 이미 긍정 평가했다 — 이번 지적은 그 내용이 아니라 **주석의 물리적 포맷**이다.
  - 제안: `missing_required` 도 다중행 블록으로 통일하거나(파일의 지배 패턴에 맞춤), 텍스트가 한 줄에 들어가는 짧은 항목은 전부 단일행으로 통일한다. 어느 쪽이든 사소한 스타일 정정이라 급하지 않다.

- **[INFO]** `resolveTriggerParameters` 함수 JSDoc 블록이 함수 본문보다 훨씬 길다(문서:본문 비율 역전)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-123`(JSDoc, 24줄) vs `:124-163`(함수 본문, 실질 로직은 약 30줄)
  - 상세: 직전 리뷰 라운드(19_25_39)의 WARNING(“영문 설명 뒤에 한국어 설명이 이어붙어 블록 내부에서 언어가 전환됨”)이 이번 diff 로 정확히 해소됐음을 직접 파일을 읽어 확인했다 — 블록 전체가 한국어로 통일되어 있고 원문 영문 bullet 3개(기본값 채움·누락/coerce 실패 전부 수집·pass-through)의 정보 손실도 없다. 다만 그 결과 JSDoc 자체가 24줄로 늘어나 “왜 base 를 직접 부르면 안 되는가”라는 아키텍처적 맥락(CI 가드 경로·spec §R17 인용 포함)까지 함수 docblock 하나에 들어가 있다. 이런 유형의 “호출 규약” 설명은 함수 하나의 지역 문서라기보다 모듈/아키텍처 수준 지식에 가까워, 다음에 이 블록이 더 늘어나면 함수 docblock 과 별도 아키텍처 노트(spec 이나 모듈 README)로 분리하는 것을 고려할 만하다. 현재 크기(24줄)와 내용(중요한 안전 불변식 경고)을 고려하면 지금 시점에 분리를 요구할 정도는 아니다.
  - 제안: 즉시 조치 불요. 이 docblock 이 더 늘어나면(예: 또 다른 wrapper 가 생기는 경우) 호출 규약 설명을 별도 모듈 문서로 옮기는 것을 검토.

- **[INFO]** `workflows.controller.ts` `execute()` 메서드는 이번 fix 이후에도 여전히 한/영 주석 혼재(신규 회귀 아님, 의도된 스코프)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute()` 메서드 내부. 이번 diff 로 한국어로 통일된 부분: `:320-322`(`details` 관련 주석). 영어로 남은 부분: `:294`(`// Verify workflow belongs to workspace`), `:297-299`(`// Resolve trigger parameters against...`), `:332-335`(`// Stamp the trigger-source marker...`).
  - 상세: `plan/complete/masked-marker-cosmetic-followups.md` 가 스코프를 “같은 try/catch 블록”으로 명시적으로 좁혔고 실제로 그 블록만 번역됐다. 직전 리뷰 라운드(19_25_39 documentation/maintainability)가 이미 같은 사실을 INFO 로 기록했고 이번 diff 는 그 스코프를 넘지 않는다 — 새로운 결함이 아니라 기존에 트래킹된 사실의 재확인이다.
  - 제안: 별도 액션 불요. 다음에 이 메서드를 만질 때 나머지 영문 주석도 함께 통일(이미 트래커에 기록됨).

## 요약

이번 diff 는 직전 리뷰 라운드(`19_25_39`)가 지적한 유일한 WARNING(“`resolveTriggerParameters` JSDoc 블록 안에서 영어→한국어로 언어가 전환됨”)을 정확히 해소한 후속 커밋이다 — 실제 파일을 직접 열어 확인한 결과 해당 docblock 은 이제 전부 한국어이고, 원문 영문 bullet 의 정보 손실도 없다. `re-run.dto.ts` 의 다중 문자열 리터럴 연결(`' +'`) 패턴도 저장소 내 다른 DTO(`create-trigger.dto.ts`, `update-auth-config.dto.ts` 등)와 동일해 신규 패턴이 아니다. 남은 지적은 전부 INFO 수준의 사소한 스타일 편차(신규 JSDoc 3건 간 단일행/다중행 포맷 불일치, base 함수 docblock 길이 증가, 컨트롤러의 의도적으로 좁힌 스코프 잔존 혼재)이며, 실행 로직·함수 길이·중첩·매직 넘버·중복 로직 등 구조적 지표에는 변화가 없다.

## 위험도
LOW
