# 요구사항(Requirement) 리뷰 — `AlertRuleDto.threshold` wire 타입 정정 + 재발방지 가드 + e2e (최종 상태 재검증)

## 검토 방법

`origin/main...HEAD` 실 diff(`git diff --stat`)로 이번 changeset 의 non-review 실질 변경을
확인했다: `CHANGELOG.md` · `alert-rule-response.dto.ts` · `swagger-dto-contract-guard.ts` ·
`swagger-dto-contract.spec.ts` · `test/alerts-threshold-wire-type.e2e-spec.ts` ·
`plan/in-progress/spec-draft-nullable-notation-followups.md` (+ `review/consistency/2026/09/04/20_05_42/**`,
`review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,21_10_30,21_25_50}/**` — 전부 이전 라운드
산출물의 정식 커밋으로, 관례에 부합, 코드 결함 표면 아님). 이 changeset 은 이미 5라운드
(`19_43_18`→`21_25_50`)의 코드 리뷰·mutation 검증을 거쳤고, 각 RESOLUTION.md 가 조치와 실측을
기록하고 있다. 본 라운드는 그 최종 상태를 독립적으로(신뢰 없이 grep/Read 로) 재검증했다 —
저장소에는 아무것도 쓰지 않았다(`Read`/`Bash grep`만 사용, mutation 없음. `git status --short`
확인 불필요 — 트리 변경 자체가 없었다).

핵심 코드 변경 하나(`AlertRuleDto.threshold: number → string`)를 entity·service·controller·
frontend·spec 전 계층에 대해 line-level 로 직접 grep 대조했다.

## 발견사항

- **[INFO]** `spec/1-data-model.md:873` 이 `threshold` 를 `Float` 로 라벨링 — 이번 정정으로
  드러난 실제 타입(`string`, `numeric(12,4)` 컬럼)과 불일치. 이미 이 PR 의
  `plan/in-progress/spec-draft-nullable-notation-followups.md:331`-`333` 에 planner 트랙
  항목으로 정확히 등재돼 있음을 확인했다(중복 등재 아님, 새 발견 아님 — 기존 등재의 정확성만
  재확인).
  - 위치: `spec/1-data-model.md:873` (`| threshold | Float | 임계치 (DB 는 NUMERIC(12,4) 고정소수) |`)
  - 상세: `spec/1-data-model.md` §2.25 AlertRule 표가 `threshold` 를 `Float` 로 표기하지만,
    엔티티(`alert-rule.entity.ts:35` `threshold: string`)·이번에 고친 응답 DTO
    (`threshold: string`)·실제 wire(e2e 로 확인) 모두 문자열이다. spec 이 코드보다 낡은 축
    (SPEC-DRIFT 성격)이지만, 이미 `developer` 자신이 아니라 별도 planner 트랙 항목으로
    정확히 넘겨 두었으므로 이 리뷰가 추가로 지적할 새 사실은 없다 — 등재의 정확성만 확인.
  - 제안: 없음(이미 조치 경로가 지정돼 있다 — planner 턴에서 `spec/1-data-model.md` 갱신).

## 그 외 확인된 사항 (결함 아님, 독립 재검증)

- **entity ↔ service ↔ controller ↔ frontend 전 계층 정합**: `alert-rule.entity.ts:35`
  `threshold: string` · `alerts.service.ts:30,53` `String(dto.threshold)` 로 저장(비대칭
  의도와 일치) · `alerts.controller.ts` 의 `list`/`create`/`update` 세 핸들러 모두 반환 타입
  미애노테이트, 엔티티를 그대로 반환(CHANGELOG "세 응답 모두" 서술과 일치, `list()` 단수
  서술로 축소돼 있던 이전 라운드 WARNING 은 현재 CHANGELOG 본문에서 이미 정정 확인) ·
  `codebase/frontend/src/lib/api/alerts.ts` 읽기/쓰기 타입 분리 기존 상태와 일치.
- **쓰기측 검증 규칙 무변경 확인**: `CreateAlertRuleDto.threshold` 는 `@IsNumber() @Min(0)`
  유지(`alert-rule.dto.ts:33-34`) — spec `2-navigation/9-user-profile.md:406`
  `threshold(number, ≥0, ...)` 서술과 계속 일치. 이번 diff 가 요청측 유효성 검증을 건드리지
  않았음을 확인.
- **가드 로직(`swagger-dto-contract-guard.ts`) 엣지 케이스 재검토**: `readColumnType` 이
  `@Column('numeric', {...})`(포지셔널)·`@Column({ type: 'numeric' })`(옵션) 두 형태를 모두
  처리 · `collectNumericFields` 는 numeric 필드가 하나도 없는 클래스는 아예 등록하지 않음(정상
  — 매칭 시 `undefined` 로 스킵) · `<Entity>Dto` 이름 관례를 벗어난 케이스(`StatisticsResponseDto`)
  는 못 잡는 것으로 문서화·테스트에 음성 대조군으로 고정돼 있음(알려진 한계, 은폐 아님) ·
  `scanNumericExposure` 가 위반 목록뿐 아니라 스캔이 실제로 무엇을 집었는지(`numericColumns`/
  `responseDtoClasses`)도 반환해 "위반 0건" 과 "애초에 스캔 안 됨"을 구분하는 전제 테스트가
  존재함을 확인 — vacuous-pass 형태의 결함 없음.
- **e2e (`alerts-threshold-wire-type.e2e-spec.ts`) 분기 판별력**: `12.3456`/`7.0625` 처럼
  `numeric(12,4)` 의 scale 4자리를 꽉 채운 값을 사용해 `Math.round`/`parseInt` 개입 시에도
  분기가 갈리도록 설계돼 있음을 확인(초기엔 정수값이라 vacuous 였던 것을 자기반증으로 고침,
  `21_25_50` INFO#2 → `4e7a52bc9`). POST/PATCH 직후 in-memory 응답뿐 아니라 GET 으로 DB
  재조회까지 단언해 저장 경로에서의 정밀도 손실도 포착. 타입뿐 아니라 값(`Number(...)`,
  문자열 정확 일치)까지 확인해 "타입만 맞으면 통과"하는 공허한 단언이 아님.
- **plan 문서 산술 정정 확인**: `spec-draft-nullable-notation-followups.md` 현재 상태에서
  46(Date→string) + 6(enum→string) + 4(관계 축소) + 3(그 밖, `AlertRuleDto.threshold` 포함) =
  **59** — 이전 라운드(`19_43_18`)가 지적한 57 vs 59 산술 불일치가 현재 문서에서는 해소됐음을
  직접 재계산으로 확인.
- **TODO/FIXME/HACK/XXX**: 이번 diff 의 6개 non-review 실질 변경 파일 전체에서 0건.
- **`spec/conventions/swagger.md`**: `numeric`/`decimal`/`threshold` 어느 키워드도 없음 —
  plan 문서가 "가드는 전역 강제되는데 규약 문서에는 없다"고 적은 서술과 실제 상태가 일치함을
  확인(별도 지적 아님, 이미 planner 트랙 항목으로 등재돼 있음).

## 요약

핵심 요구사항(응답 DTO 의 `threshold` 타입을 실제 wire — `numeric(12,4)` 컬럼이 TypeORM 을
통해 직렬화되는 문자열 — 에 맞춰 정정하고, 같은 결함 클래스의 재발을 정적 가드(`readColumnType`
포지셔널/옵션 양 형태 대응)와 런타임 e2e(POST/GET/PATCH, scale 을 꽉 채운 판별력 있는 입력값)
양쪽으로 막는다)는 코드 5개 파일에 걸쳐 완전하고 정확하게 구현돼 있다. entity·service·
controller·frontend·spec §6.3(쓰기측) 전 계층을 독립적으로 grep 대조한 결과 어긋나는 지점이
없었다. 이 changeset 은 이미 5라운드의 코드 리뷰와 mutation 실측(예측/실측 쌍, RED/GREEN 대조군)
을 거쳤고, 이번 재검증에서도 새로운 CRITICAL/WARNING 을 발견하지 못했다. 유일한 spec 관련
사항(`spec/1-data-model.md:873` 의 `Float` 오표기)은 이미 이 PR 자신이 planner 트랙 후속
항목으로 정확히 등재해 두었으므로 INFO 로만 재확인한다.

## 위험도

NONE
