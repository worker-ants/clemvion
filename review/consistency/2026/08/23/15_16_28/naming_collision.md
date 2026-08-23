# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위에 대한 메모

이 세션은 동일 target(`masking-gate-consolidation`, scope=`spec/5-system/`, diff-base=`origin/main`)에
대한 재검토(`15_16_28`)다. 직전 회차(`13_55_36`)의 naming_collision 산출물이 이미 이 worktree 에
존재하여 대조 기준으로 삼았고, 그 이후 커밋 이력(`git log`)을 통해 코드가 추가로 바뀌었는지
독립적으로 재확인했다.

`git diff origin/main...HEAD --stat` 로 실제 변경 파일을 다시 실측한 결과, `spec/5-system/` 산하
17개 파일 중 **어느 것도 이번 diff 에 포함되지 않는다.** 이번 target 이 실제로 새로 도입하는
식별자는 다음 4개 파일에 한정된다 (`plan/complete/masking-gate-consolidation.md` 기준 — 이미
`in-progress`→`complete` 로 이동 완료):

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규 함수 2개 export + private 헬퍼 1개)
- `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (신규 테스트, 신규 식별자 도입 없음)
- `codebase/backend/src/modules/executions/executions.service.ts` (호출부 교체, `maskIfPresent` 정의 삭제·이동)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (호출부 교체)
- `spec/conventions/egress-masking.md` (§3 "알려진 stale 트리거" 예고 취소선 처리 + 실측 정정 — 기존 파일 본문 수정, 신규 식별자 없음)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (트래커 항목 종결 기록 — 신규 식별자 없음)

직전 회차 대비 추가 커밋(`a9ee86e8e` 테스트 파라미터화, `5d3517457` chore 리뷰 기록)이 있었으나
`git show --stat` 로 확인한 결과 코드 diff 는 없고(chore 커밋은 `review/**` 산출물만), 테스트
커밋도 기존 두 함수(`redactStoredFieldsForResponse`/`redactNodeExecutionRow`)를 파라미터화된
케이스로 더 촘촘히 덮을 뿐 신규 export 심볼을 추가하지 않는다 — 직전 회차의 "신규/이동 식별자
목록"은 이번 회차에도 그대로 유효하다.

## 신규/이동 식별자 목록 (실측)

| 식별자 | 종류 | 위치 | 상태 |
|---|---|---|---|
| `redactStoredFieldsForResponse` | export function | `redact-stored-error.ts` | 신규 |
| `redactNodeExecutionRow` | export function (generic) | `redact-stored-error.ts` | 신규 |
| `maskIfPresent` | module-private function | `redact-stored-error.ts` | **이동** (`executions.service.ts` 에서 동일 이름·동일 시그니처로 옮겨짐 — 원본 정의는 diff 에서 삭제됨, 중복 정의 아님) |

`git grep` 으로 `codebase/`·`spec/`·`plan/` 전체를 재검색한 결과, 위 세 식별자는 신규 도입 자리
(`redact-stored-error.ts`)와 그 소비처(`executions.service.ts`·`background-runs.service.ts`)·
관련 문서(`plan/complete/masking-gate-consolidation.md`·`plan/in-progress/spec-sync-external-interaction-api-gaps.md`·
`spec/conventions/egress-masking.md`) 외에는 등장하지 않는다. 이 이름들과 부분 문자열이
겹치는 기존 항목(`plan/complete/eia-fanout-and-internal-data-masking.md` 의 `maskIfPresent<T>` 언급)은
**과거 이력 문서**가 이 함수의 예전 위치(제네릭이었던 초기 설계)를 회고하는 서술일 뿐, 별도
정의가 아니다.

## 점검 관점별 대조

1. **요구사항 ID 충돌** — 신규 요구사항 ID 부여 없음(frontmatter `id:` 변경 없음). `spec/5-system/`
   전체 17개 파일의 `id:` 를 재대조했으나 전부 고유하다(`14-external-interaction-api.md` 본문 중
   `id: 1/2/3/4/99` 는 예시 payload 스니펫이며 frontmatter 가 아니다). 해당 사항 없음.
2. **엔티티/타입명 충돌** — `redactStoredFieldsForResponse`·`redactNodeExecutionRow` 는 codebase
   전체(backend+frontend)에 이번 신규 자리 외 사용처가 없다. 기존 자매 함수
   `redactStoredErrorForResponse`·`redactStoredDataForResponse` 와는 접두사만 공유하고 의미가
   충돌하지 않는다 — 새 함수는 그 위에 얹히는 래퍼로, 관계가 `spec/conventions/egress-masking.md`
   갱신분에 정확히 기술돼 있다. `maskIfPresent` 는 이동일 뿐 신규 정의 충돌 아님. 유사 명명
   (`maskSensitiveFields`, `maskValueForLog`, `redactSecrets`, `redactThreadForPublic`,
   `stripExternalOnlyFields`, `deepRedactSecrets`)은 모두 이번 변경 이전부터 공존하던 기존
   식별자이며 새로 생긴 충돌이 아니다.
3. **API endpoint 충돌** — 이번 diff 는 REST/WS endpoint 를 추가·변경하지 않는다(응답 조립
   내부 구현 교체만). 해당 사항 없음.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 변경 없음. 해당 사항 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음. 해당 사항 없음.
6. **파일 경로 충돌** — 신규 spec 파일 생성 없음(`egress-masking.md` 는 기존 파일 본문 수정).
   신규 코드 파일도 없음(기존 `redact-stored-error.ts`/`.spec.ts` 에 함수 추가). 해당 사항 없음.

## 재검토에서 새로 짚은 항목

`plan/in-progress/spec-sync-external-interaction-api-gaps.md` diff 에 이번 회차 신규 등재 항목
("developer 의 자기-예측 반증형 spec 소정정 — 권한 경계를 정한다")이 있으나, 이는 **식별자 충돌이
아니라 권한/게이트 절차 논의**(developer 가 `spec/conventions/egress-masking.md` 를 read-only
경계를 넘어 직접 고친 것에 대한 planner 판단 요청)라 본 checker 의 점검 관점(1~6) 밖이다 —
naming_collision 범위에서는 해당 사항 없음으로 처리하고, 다른 관점(convention_compliance 등)의
소관으로 남긴다.

## 요약

이번 target 이 실제로 도입하는 신규 식별자는 백엔드 shared util 함수 2개
(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)와 이동된 private 헬퍼 1개
(`maskIfPresent`)로, 전부 단일 파일(`redact-stored-error.ts`) 안에 있고 codebase·spec 전반에
동일 이름의 다른 의미 사용처가 없다. 직전 회차(`13_55_36`) 이후 추가된 커밋(테스트 파라미터화 +
리뷰 수렴 기록)도 신규 export 심볼을 늘리지 않아 판정에 변화가 없다. 요구사항 ID·엔티티/DTO·API
endpoint·이벤트명·ENV var·spec 파일 경로 축에서는 애초에 신규 도입이 없어 충돌 여지가 없으며,
`spec/5-system/` 은 이번 diff 에 전혀 포함되지 않아 명목상 넓은 scope 에 대해서도 실질 위험이
없다.

## 위험도

NONE
