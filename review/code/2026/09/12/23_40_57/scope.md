# 변경 범위(Scope) 리뷰 — keyset 커서 UUID 검증 (filter-pg-invalid-text)

## 변경 개요

`git diff --stat` 로 확인한 실제 변경은 정확히 7개 파일, +431/-4 줄이며 프롬프트에 실린 목록과
일치한다.

| 파일 | 성격 |
|---|---|
| `CHANGELOG.md` | 신규 Unreleased 섹션 1건 (behavior change 고지) |
| `codebase/backend/src/modules/auth/login-history.service.ts` | `decodeCursor` 에 `isUuidShaped` 검증 1줄 + import 1줄 + 설명 주석 |
| `codebase/backend/src/modules/auth/login-history.service.spec.ts` | 회귀 테스트 2건 + 기존 fixture 값 교정(`'cursor-id'` → 실제 UUID) |
| `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` | `decodeCursor` 에 `isUuidShaped` 검증 1줄 + import 1줄 + 설명 주석 |
| `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` | 회귀 테스트 2건(거부 + 유효 커서 완주 대조군) |
| `plan/in-progress/keyset-cursor-uuid-validation.md` | 신규 작업 plan (근거·처분·뮤테이션 기록) |
| `plan/in-progress/spec-draft-nullable-notation-followups.md` | 기존 트래커 항목 1건 won't-do 종결(취소선) + 백로그 6건 등재 |

핵심 로직 변경은 `isUuidShaped(id)` 검증 삽입 두 곳뿐이며, 소비하는 유틸 함수(`common/utils/uuid.ts`
의 `isUuidShaped`)는 이번 diff 에 포함되지 않은 **기존 함수**를 재사용한다(신규 유틸 작성 없음,
`grep` 으로 확인). 작업명("filter-pg-invalid-text")과 실제 변경 내용(Postgres 22P02 유발 전
비-UUID 커서를 필터링)이 정확히 일치한다.

## 발견사항

- **[INFO]** 두 서비스 파일의 검증 근거 주석이 거의 동일한 내용(약 12~13줄)으로 복제됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` — `decodeCursor` 내부(전체 파일 컨텍스트 게이트 53~64행), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` — `decodeCursor` 내부(전체 파일 컨텍스트 게이트 165~177행)
  - 상세: "왜 `isUuidShaped` 인가(≠`isValidUuid`)" · "22P02→500 마스킹 메커니즘" · spec Rationale 인용이 두 파일에 거의 같은 문장으로 들어가 유지보수 시 한쪽만 갱신될 위험이 있다. 다만 이는 순수 주석(산문)이며 검증 로직 자체는 공용 유틸 재사용이라 코드 중복은 아니다.
  - 제안: 이미 작성자 스스로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 동일 지적(`/ai-review` maintainability INFO#1)을 백로그로 등재하고 "주석-only 라 이번 배치 수렴 기준(동작·커버리지·계약)에 안 걸림"이라는 이연 근거를 남겨 두었다. 스코프 관점에서 추가 조치 불필요 — 참고용으로만 기재.

- **[INFO]** `login-history.service.spec.ts` 의 기존 테스트 fixture 값이 이번 diff 에서 변경됨(`'cursor-id'` → `3fa85f64-5717-4562-b3fc-2c963f66afa6`)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:152-160` (diff 게이트 기준)
  - 상세: 언뜻 "관련 없는 기존 테스트 값 변경"으로 보일 수 있으나, diff 내 주석이 "이 fixture 가 비-UUID 값을 정상으로 고정하고 있던 결함이었다"는 이유를 명시하고 있고, plan 문서(§B 체크리스트)에도 "기존 fixture 가 그 결함을 정상으로 고정하고 있었다"는 실측을 남겼다. 새 UUID 검증 로직이 들어가면 이 fixture 는 필연적으로 깨지므로(비-UUID 값이라 새 검증에서 걸러짐) 수정이 이번 변경의 직접적 파생물이며 범위 이탈이 아니다.
  - 제안: 조치 불필요. 근거가 diff·plan 양쪽에 명시돼 있어 review 관점에서는 정상.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 작업과 직접 연관되지 않은 신규 백로그 6건(계약 비대칭 통일 · 주석 복제 · 디코더 중복 · spec 갭 3건)이 함께 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff 게이트 3168~3211, 3234~3266)
  - 상세: 언뜻 "관련 없는 다수 항목 추가"로 보이지만, 프로젝트 컨벤션(`CLAUDE.md` 및 memory `feedback_review_fix_stale_loop`: "미룬 항목은 그 턴에 plan/ 에 적어라")상 이번 작업 중 `--impl-prep`/`/ai-review` 로 발견했으나 이번 배치 범위 밖(제품 결정·planner 소관)인 항목은 그 턴에 트래커로 즉시 이관하는 것이 정식 워크플로다. 각 항목이 이번 작업(§C/§D)에서 파생된 것임을 명시하고 있고, 별도 신규 기능 구현은 전혀 수반하지 않는다(문서 등재뿐).
  - 제안: 조치 불필요. 컨벤션 준수 사례로 판단.

- **[INFO]** 동일 plan 문서에서 기존 트래커 항목("`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다")을 취소선 처리하여 won't-do 로 종결
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff 게이트 3234~3241, `-`/`+` 쌍)
  - 상세: 원문을 삭제하지 않고 취소선(`~~...~~`)으로 보존한 뒤 근거(§A 결론)를 각주로 추가하는 방식으로, 원문 삭제 없이 정정한 처리 방식 자체는 문제 없음. 이 항목은 developer 자신이 같은 세션(`7ef8dc993`)에 등재한 것으로 보이며, 이번 실측(§A)이 그 처방을 반증해 종결한 것 — plan 파일 수정 권한은 developer 에게 있어(`plan/**`) 승인 절차상 문제 없음.
  - 제안: 조치 불필요.

## 요약

7개 파일 변경 전부가 "keyset 커서의 id 성분이 검증 없이 uuid 컬럼에 바인딩돼 22P02→500 이 나는" 단일 결함 수정에 직접 종속돼 있다. 핵심 로직 변경은 두 `decodeCursor` 함수에 기존 유틸(`isUuidShaped`, 신규 작성 아님) 호출 1줄씩을 추가한 것이 전부이며, 나머지는 그에 필요한 회귀 테스트, 필연적으로 깨지는 기존 fixture 교정, CHANGELOG 고지, 그리고 프로젝트 컨벤션이 요구하는 plan 문서화(발견된 부수 이슈의 즉시 트래커 등재 및 기존 오처방 항목의 종결)다. 리팩토링·기능 확장·무관한 파일 수정·의미 없는 포맷팅·불필요한 임포트·설정 변경은 발견되지 않았다. 유일하게 눈에 띄는 점은 두 서비스 파일에 걸쳐 근거 설명 주석이 상당 부분(~12줄) 복제된 것인데, 이는 작성자가 이미 자체 인지하고 백로그로 명시적으로 이연 처리해 두었다.

## 위험도
NONE
