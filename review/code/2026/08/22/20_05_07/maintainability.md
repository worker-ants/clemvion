# 유지보수성(Maintainability) 리뷰

## 검토 범위 확인

`git diff origin/main...HEAD --stat` 로 46개 파일을 재확인했다. 실제 실행 코드(런타임 로직)가 바뀐 파일은
4개(`trigger-parameter.types.ts` +9, `resolve-trigger-parameters.ts` +27/-2, `re-run.dto.ts` +5/-4,
`workflows.controller.ts` +6/-3)뿐이고, 전부 JSDoc·인라인 주석·Swagger `description` 문자열 변경이다
(조건문·반환값·시그니처 변경 0). 나머지는 `plan/**`·`review/**`·spec frontmatter 등 프로세스 산출물이라
코드 유지보수성 관점 검토 대상이 아니다(구조적 지표에 영향 없음).

이 diff 는 이미 두 차례 AI 리뷰(`19_25_39`, `19_36_12`)를 거쳤고 각 라운드의 지적사항이 RESOLUTION.md 로
처분됐다. 최신 커밋(`4a1c8bc48`, `19_48_18` consistency WARNING 반영으로 `re-run.dto.ts` description 을
축약)까지 반영된 현재 파일 상태를 직접 `Read` 로 열어 대조했다 — 프롬프트의 diff 는 실제 소스와 일치했다.

## 발견사항

- **[INFO]** `REASON_TO_DETAIL` 의 신규 JSDoc 3건 중 하나만 단일행, 나머지 둘은 다중행으로 포맷이 불일치 (직전 라운드부터 이월, 아직 미해소)
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40`(`missing_required` — 단일행 `/** ... */`) vs `:45-48`(`coerce_failed` — 다중행) / `:53-56`(`invalid_schema` — 다중행)
  - 상세: 같은 `Record` 리터럴 안 형제 항목이 동일한 목적("사용자가 취할 행동" 서술)의 주석을 서로 다른 물리적 블록 스타일로 달고 있다. 기존(diff 이전) `masked_value_resubmitted` 항목(`:61-67`)이 다중행이었으므로 다중행이 이 파일의 지배 패턴이다. 이 지적은 직전 라운드(`19_36_12` maintainability)가 이미 낸 것이며, 그 라운드의 RESOLUTION 이 "`missing_required` 는 한 줄로 충분한 내용이고 길이에 맞춰 포맷을 고르는 것이 파일 전체에 이미 섞여 있는 관례" 라는 이유로 **의도적으로 보류**했다. 이번 라운드 확인 결과 그 상태 그대로다 — 새로운 퇴행은 아니지만 여전히 사소한 시각적 비일관은 남아 있다.
  - 제안: 조치 불요(이미 트리아지됨). 다음에 이 맵을 다시 만질 때 `missing_required` 도 다중행으로 통일하거나 반대로 통일 기준을 명시.

- **[INFO]** `resolveTriggerParameters` 함수의 JSDoc 블록(24줄)이 함수 본문(약 30줄)에 근접할 만큼 길다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-123`(JSDoc) / `:124-163`(함수 본문)
  - 상세: 블록은 전부 한국어로 통일되어 있고(`19_25_39` WARNING 이 정확히 해소됨을 재확인) `## ⚠️ Manual 실행 경로는 이 함수를 직접 부르지 않는다` 절이 wrapper 역참조·CI 가드 경로·spec §R17 인용까지 담아 24줄로 늘었다. 이런 "호출 규약" 수준 설명은 함수 하나의 지역 문서라기보다 모듈/아키텍처 지식에 가깝다. 직전 라운드가 이미 같은 관찰을 INFO 로 냈고, "또 다른 wrapper 가 추가되면 분리를 검토" 라는 조건을 달아 지금은 분리를 요구하지 않기로 처분했다. 현재도 wrapper 는 여전히 1개뿐이라 그 조건은 아직 충족되지 않았다.
  - 제안: 조치 불요. 두 번째 wrapper 가 생기는 시점에 별도 모듈 문서로 분리 검토(이미 트래킹됨).

- **[INFO]** `workflows.controller.ts`의 `execute()` 메서드는 여전히 한/영 인라인 주석이 혼재 (의도적으로 좁힌 스코프, 신규 회귀 아님)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:294`(`// Verify workflow belongs to workspace`, 영문), `:297-299`(`// Resolve trigger parameters against...`, 영문), `:332-335`(`// Stamp the trigger-source marker...`, 영문) — 반면 이번 diff 로 한국어화된 `:314-316`, `:320-322`
  - 상세: `plan/complete/masked-marker-cosmetic-followups.md`가 스코프를 "같은 try/catch 블록"으로 명시적으로 좁혔고 실제 diff 도 그 범위(`:320-322`)만 건드렸다. 결과적으로 같은 메서드 안에서 앞뒤 문단은 여전히 영어라 파일 전체 관점의 언어 일관성은 미해결이다. 두 차례 이전 라운드가 이미 이 사실을 INFO 로 기록했고 이번 라운드에도 상태 변화가 없다.
  - 제안: 조치 불요(이미 트래킹됨). 다음에 이 메서드를 손댈 때 나머지 영문 주석도 함께 한국어로 통일.

- **[INFO]** (긍정 기록) `re-run.dto.ts` Swagger description 최신 개정이 중복 제거 + SoT 링크로 유지보수성을 개선
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-25`
  - 상세: 최신 커밋(`4a1c8bc48`)이 마커 리터럴 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 verbatim 나열하던 이전 표현(304자)을 "마스킹 마커와 정확히 일치하는 값 leaf는 예약어로 거부"라는 요약(236자) + `SoT: EIA §R17` 링크로 교체했다. 이는 직전 라운드(`19_25_39` maintainability INFO)가 지적한 "마커 리터럴이 여러 문서에 링크 없이 복사됨" 문제를 부수적으로 해소한다 — 값이 바뀌면 이제 이 description 만 stale 해지는 게 아니라 SoT 를 가리키므로 동기화 표면이 줄었다. 문자열 concatenation(`' +' \n  '...'`) 패턴도 같은 디렉토리 다른 DTO(`create-trigger.dto.ts`, `update-auth-config.dto.ts`, `update-trigger.dto.ts`, `chat-channel-config.dto.ts`)와 동일해 신규 스타일이 아니다.
  - 제안: 없음(긍정 기록).

## 요약

이번 라운드에서 실행 코드가 바뀐 파일은 여전히 4개뿐이며 전부 주석/JSDoc/Swagger description 문자열 변경으로, 함수 길이·중첩 깊이·순환 복잡도·매직 넘버·중복 로직 등 구조적 지표는 이전 라운드와 마찬가지로 변화가 없다. 이전 두 라운드의 유일한 WARNING(base 함수 docblock 언어 혼재)은 이미 해소된 상태를 재확인했고, 이번 라운드의 새 변경(re-run.dto.ts description 축약)은 오히려 마커 리터럴 중복을 줄이고 SoT 링크를 붙여 유지보수성을 개선하는 방향이었다. 남은 세 건(REASON_TO_DETAIL JSDoc 포맷 불일치·base 함수 docblock 길이·controller 부분 언어 통일)은 전부 직전 라운드에서 이미 의도적으로 보류(triaged)된 사소한 스타일 편차이며, 이번 라운드에서 상태 변화나 새로운 퇴행은 없었다. 신규 Critical/Warning 은 없다.

## 위험도
NONE
