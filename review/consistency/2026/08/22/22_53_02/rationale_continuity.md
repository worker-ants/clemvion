# Rationale 연속성 검토 — `plan/in-progress/spec-draft-swagger-401-drift.md`

## 검토 방법

target 이 인용하는 두 항목의 근거를 각각 1차 소스에서 직접 재검증했다:

- ① 401 코드명: `codebase/backend/src/common/filters/http-exception.filter.ts:145`
  (`getCodeFromStatus`)·`spec/5-system/2-api-convention.md:171`·`spec/5-system/3-error-handling.md:42`·
  `spec/conventions/error-codes.md §2/§5`·`spec/5-system/13-replay-rerun.md:240,269` 를 직접 열람.
- ② swagger 길이-예외: `spec/conventions/swagger.md` 전문(§3 본문 + `## Rationale`) 을 직접 열람,
  `git log -S "예외 — 보안·정책 캐비엇"` 로 2026-08-17 원 커밋(`89c3f3c53`)의 정확한 범위를 확인.
- 두 항목의 출처 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:852-879`)를
  대조해 target 의 실측 수치·인용이 트래커와 일치하는지 확인.

## 발견사항

### ① 401 `UNAUTHORIZED` → `AUTH_REQUIRED` — Rationale 과 정합, 위반 없음

- target 위치: `## ① 13-replay-rerun.md §8.1·§8.2`
- 과거 결정 출처: `spec/conventions/error-codes.md §2`(rename=breaking change 정책)·`§5`(Rename 이력 레지스트리)
- 상세: target 은 "이건 rename 이 아니라 오기 정정" 이라 주장한다. 직접 검증 결과 정확하다 —
  `http-exception.filter.ts:145` 의 `getCodeFromStatus(401)` 은 처음부터 `AUTH_REQUIRED` 를
  반환하며, `UNAUTHORIZED` 가 실제로 클라이언트에 발행된 적이 없다. `error-codes.md` 에도
  `UNAUTHORIZED`/`AUTH_REQUIRED` 관련 rename 이력이 없다(grep 0건) — 즉 §5 등재 대상이 될
  "교체된 구 코드" 자체가 존재하지 않는다. 오히려 이 패턴(코드가 옳고 문서만 틀렸을 때
  "정정"으로 처리)은 `spec/1-data-model.md` Rationale "`WorkflowVersion.snapshot` 구성 서술
  정정" 과 `spec/5-system/2-api-convention.md` Rationale "비-페이징 고정 컬렉션…문서 정직화"
  가 이미 확립한 선례와 **같은 결의 결정**이다. target 이 이 두 선례를 명시 인용하지는
  않지만, 결론·근거 구조는 일치한다.
- 제안: (선택) target 본문에 위 두 선례(`1-data-model.md`·`2-api-convention.md`) 를 "동일 패턴
  선례" 로 1줄 인용하면 이후 리뷰어가 "이게 왜 §5 Rename 대상이 아닌가" 를 재차 묻는 왕복을
  줄일 수 있다. 필수는 아니다 — 등급 부여 대상 아님(정보 보완 수준).

### ② swagger.md §3 길이-예외 양방향 확장 — 기각된 대안 재도입 아님, 다만 `## Rationale` 미러링 관행과 어긋남

- target 위치: `## ② swagger.md §3` 제안 diff
- 과거 결정 출처: `spec/conventions/swagger.md §3`(2026-08-17 규약화, 커밋 `89c3f3c53`) + 동일 파일
  `## Rationale`(§0·§1-4·§5·§5-4 항목들)
- 상세: 2026-08-17 원 커밋을 diff 로 직접 확인한 결과, 예외 범위가 "응답" 으로 좁게 적힌 것은
  **명시적으로 "요청 필드는 대상 아님" 이라 결정한 것이 아니라, 당시 실측(9곳 이상 DTO)이
  응답 필드에서만 관측됐기 때문**이다. 즉 §1 "기각된 대안의 재도입" 에 해당하지 않는다 —
  과거에 "요청 필드 확장" 을 검토했다가 거부한 이력이 없다(원 커밋 diff·swagger.md 전문
  어디에도 그런 논의가 없음). target 이 제시하는 실측(요청 DTO 73개·`re-run.dto.ts` 3필드
  3/3 초과)도 트래커(`spec-sync-external-interaction-api-gaps.md:867-870`)의 이전 라운드
  실측과 정합적으로 이어진다(수치가 라운드마다 갱신된 것은 실제 코드 변경 때문 — 트래커 자체가
  "이 PR 은 129자로 둔다" 고 기록해 둠).
  다만 한 가지 **구조적 어긋남**이 있다: swagger.md 는 §0·§1-4·§5·§5-4 처럼 "왜 이 결정인가"
  를 별도 `## Rationale` 섹션에 미러링하는 관행을 갖고 있는데, **§3 예외(2026-08-17 원본도
  포함)는 애초에 이 관행을 따르지 않고 본문 인용구 안에만 근거를 적어 왔다.** target 은 이
  기존 결함(?)을 그대로 답습해 §3 본문만 확장하고 `## Rationale` 미러 항목을 추가하지 않는다.
  이건 target 이 새로 만든 drift 가 아니라 **선존 패턴을 답습**한 것이므로 CRITICAL/WARNING
  등급의 "번복" 은 아니다 — 다만 이 기회에 정합화할 수 있는 지점이다.
- 제안(INFO): target 의 "작업" 체크리스트에 `## Rationale` 절에 "§3 보안·정책 캐비엇 예외 —
  응답→양방향 확장 (2026-08-22)" 미니 항목을 추가하는 안을 넣을 것을 권장한다. 필수 아님 —
  swagger.md 자체가 모든 본문 결정을 Rationale 에 미러링하지는 않으므로(예: §2-4 상태코드
  표, §3 톤 규칙 자체는 Rationale 미러 없음), 이 파일의 기존 관행 범위 안에 있다.

### ③ "기본 수치 규칙(10~40자) 재검토는 범위 밖" — 원칙 위반 없음, 오히려 정합

- target 위치: `### 넓히지 않는 것 — 기본 수치 규칙`
- 상세: target 이 34% 초과율을 발견하고도 손대지 않고 트래커에 별도 등재하기로 한 결정은,
  이 저장소 Rationale 전반에 흐르는 "범위 한정" 원칙(`3-error-handling.md` Rationale
  "**범위 한정**: … 별도 pass 범위 아님" · `5-system/2-api-convention.md` §1.9 "그 외 … 코드는
  별도 pass")과 같은 결의 관행을 따른다. 위반 없음 — 오히려 원칙 준수 사례로 기록할 만하다.

## 요약

target 의 두 편집 모두 실측(런타임 코드·git 커밋 diff·트래커 이력)으로 직접 재검증했으며,
과거 Rationale 이 명시적으로 기각한 대안을 재도입하는 사례나 합의된 invariant 를 우회하는
설계는 발견되지 않았다. ① 은 rename 정책(§2/§5)의 적용 대상이 아님을 코드 레벨에서 확인했고
(런타임이 처음부터 `AUTH_REQUIRED` 를 냈다), 기존 "문서 정직화" 선례와 같은 결의 결정이다.
② 는 2026-08-17 원 결정이 "요청 필드 배제" 를 의도적으로 정한 적이 없어 재도입/번복이 아니라
순수 확장이며, 실측 수치도 트래커의 앞선 라운드와 이어진다. 유일하게 지적할 지점은 swagger.md
가 다른 절(§0·§1-4·§5·§5-4)과 달리 §3 결정을 `## Rationale` 에 미러링하지 않는 선존 관행을
target 이 그대로 답습한다는 점인데, 이는 target 이 새로 만든 결함이 아니라 파일 전체의 기존
스타일이라 CRITICAL/WARNING 으로 볼 근거가 약하다 — INFO 로 정합 보완을 제안한다.

## 위험도
LOW
