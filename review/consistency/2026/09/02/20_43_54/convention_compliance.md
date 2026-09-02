# 정식 규약 준수 검토 — `spec-draft-api-convention-status-and-password-codes.md`

## 검토 범위

target: `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md` (검토 모드 `--spec`).
대조 대상: 번들에 포함된 `spec/conventions/error-codes.md`(전문), `spec/conventions/audit-actions.md`(전문),
cafe24 계열 카탈로그 규약(무관), 그리고 예산 초과로 절단된 `spec/conventions/swagger.md` 는 실제
저장소 파일을 직접 열어 확인. 아울러 target 이 다루는 실제 SoT 문서(`spec/5-system/2-api-convention.md`
§5.3·§6, `spec/5-system/3-error-handling.md` §1.2)도 원문을 대조했다.

## 발견사항

- **[INFO]** `## Rationale` 헤딩에 접미 문구가 붙어 있다
  - target 위치: `plan/in-progress/spec-draft-api-convention-status-and-password-codes.md:143` — `## Rationale (본 draft 의 결정 근거)`
  - 위반 규약: `.claude/skills/project-planner/SKILL.md:31` "본문 끝에 `## Rationale` 로 결정 근거 명시"
  - 상세: 워크플로 규약 문언은 정확히 `## Rationale` 을 요구한다. target 은 그 뒤에 괄호 설명을 덧붙였다.
    같은 `plan/in-progress/**` 안의 형제 draft 19개 중 순수 `## Rationale` 이 17개, 이 접미 변형은
    target 과 `spec-draft-ws-badge-flip-tracker-close.md` 단 2개뿐이다 — 확산되면 앵커/파싱 규약이
    흐트러질 소지가 있는 소수 패턴.
  - 제안: 굳이 표기가 필요하면 괄호 없이 순수 `## Rationale` 로 두고, "본 draft 의 결정 근거" 같은
    설명은 헤딩 바로 아래 첫 문장으로 옮긴다. 두 파일이 이미 이 변형을 쓰고 있으므로, 반대로 이 접미
    패턴을 정식으로 허용할 의도라면 SKILL.md 문언을 갱신하는 편이 낫다(현재는 문서와 실제 관행이
    2/19 대 17/19 로 어긋나 있다).

- **[INFO]** `swagger.md §2-4` 데코레이터 표에 `202`/`410` 대응이 없다는 점을 언급하지 않음
  - target 위치: `## 변경안 — spec 5곳` 표 전체 (5개 항목이 `2-api-convention.md`·`error-codes.md`·
    `3-error-handling.md` 만 다룸)
  - 위반 규약: 없음 (직접 위반 아님) — `spec/conventions/swagger.md §2-4` "상태 코드 응답 규칙"
  - 상세: target 이 실측한 대로 `@HttpCode(HttpStatus.ACCEPTED)` 가 7 컨트롤러 13곳에서 이미
    쓰이고 있는데(실측 재확인: `grep` 결과 정확히 13/7 로 target 수치와 일치), `swagger.md §2-4` 의
    상태 코드→데코레이터 매핑 표는 200/201/204/400/401/403/404/409 만 나열하고 202/410 은 없다.
    다만 이 표는 `api-convention.md §6` 처럼 "SoT" 로 선언·참조되는 캐논 테이블이 아니라 데코레이터
    사용 가이드 성격이라, target 의 결정①이 지적한 "§5.3 이 §6 을 SoT 로 참조하는데 §6 에 없다" 는
    자기모순 구조와는 강도가 다르다. 따라서 이것은 target 의 누락이 아니라 **별도 후속 검토 여지**로만
    남긴다.
  - 제안: 이번 draft 의 스코프를 넓힐 필요는 없음(5곳으로 좁게 간 판단 자체가 이 규약 저장소가
    반복 강조하는 "정의를 한 칸 좁게" 원칙에 부합). 다만 `swagger.md` 관리자가 후속으로 `@ApiResponse`
    유사 매핑을 검토할 만하다는 점만 기록.

## 검증한 준수 사항 (근거 요약)

- **파일 명명**: `plan/in-progress/spec-draft-<name>.md` — `project-planner/SKILL.md:31` 규약과 일치.
  같은 폴더의 기존 3개 `spec-draft-*.md` 와 패턴 동일.
- **frontmatter**: `worktree`/`started`/`owner` 3필드 + `spec_impact` 가 **리스트** 형태(bare string
  아님) — `plan-lifecycle.md §4`·Gate C 규약과 일치. `worktree: plan-in-progress-items-b0c80b` 는
  현재 실행 중인 worktree 와 일치(연결 판정 통과).
- **SoT 경계 준수**: 결정①·②는 `2-api-convention.md`(HTTP 상태 코드 선택·에러 응답 envelope 의 SoT)만
  건드리고, 결정③은 `error-codes.md §3`(historical-artifact 예외 레지스트리, 명명 규율의 SoT)만
  건드린다 — `error-codes.md` Overview 가 선언한 "책임 경계"(카탈로그=3-error-handling.md §1,
  envelope=api-convention §5.3, HTTP status 선택=api-convention §6, 명명 규율=본 문서)와 정확히
  일치. 카탈로그(3-error-handling.md §1.2)에는 이미 `INVALID_PASSWORD` 행이 존재하고 그 안에
  "`login_history.failure_reason` 동명값과 별개" 라는 주석이 실제로 있음을 원문 대조로 확인 —
  target 의 인용이 정확하다.
  target 결정③은 §3 표의 기존 컬럼 구조(코드/HTTP/이름이 부정확한 이유/진실(의미)/근거)를 그대로
  따르는 변경만 제안해 표 스키마를 깨지 않는다.
- **rename 금지 원칙 준수**: `error-codes.md §2` "이름 정확성 향상만을 위한 rename 은 하지 않는다" —
  target 은 `INVALID_PASSWORD` 를 rename 하지 않고 §3 예외 등재로 흡수하는 쪽을 선택, §2 원칙을
  그대로 따른다.
- **규약 확장 자제**: 체커의 원제안(W2, §3 을 "부정확/혼동 소지 이름" 까지 확장)을 채택하지 않고
  기존 §3 기준("이름이 부정확한") 안에서 좁게 해소 — 규약 자체를 넓히지 않는 선택은 이 저장소가
  반복 강조하는 원칙(넓히는 편집은 다음 판단 기준을 바꾼다)과 일치.
- **"문서한 보장이 구현보다 넓으면 안 된다" 원칙 준수**: 결정②는 `GlobalExceptionFilter.
  getCodeFromStatus` 에 `case 410` 이 없다는 실측(원문 대조로 확인: switch 문에 410 분기 부재)에
  근거해 §5.3 에 "410 기본값을 만들지 않는다" 로 결정 — 구현에 없는 기본값을 spec 이 약속하지
  않도록 하는 선택으로, 이 저장소가 과거 반복 데인 패턴(문서한 보장 > 구현)을 정확히 피한다.
- **실측 수치 재검증**: `202` 사용처 "13 엔드포인트/7 컨트롤러", `410` 발행처 "6곳/3모듈" 을
  독립적으로 재실측(grep) 한 결과 target 의 숫자와 정확히 일치.
- **HTTP 상태 코드 표 형식**: `2-api-convention.md §6` 실제 표의 "의미" 컬럼은 `Accepted`/`Gone` 같은
  표준 HTTP reason phrase 를 쓰는 관행이며, target 의 "202 Accepted"·"410 Gone" 라벨이 그 관행과
  일치.
- **표기(UPPER_SNAKE_CASE)**: `INVALID_PASSWORD` 는 기존 프로덕션 코드로 이미 규약을 따르는 표기이며
  target 은 신규 코드를 만들지 않는다 — §1 표기 규율 위반 없음.

## 요약

target 은 `spec/conventions/error-codes.md` 와 실제 SoT 문서(`2-api-convention.md`, `3-error-handling.
md`)가 선언한 책임 경계·rename 금지·명명 원칙을 모두 정확히 지키며, 규약을 넓히기보다 기존 기준
안에서 좁게 해소하는 이 저장소의 관례를 따른다. frontmatter·파일 명명·`spec_impact` 리스트 형식도
`plan-lifecycle.md`/`project-planner/SKILL.md` 규약과 부합한다. 실측 수치(202/410 발행처 개수)도
독립 재검증 결과 정확했다. 발견된 사항은 헤딩 접미 표기 관례 편차(INFO)와 swagger.md 데코레이터
표의 별개 후속 검토 여지(INFO) 뿐이며, 어느 것도 규약 위반이나 다른 시스템의 invariant 파괴로
이어지지 않는다.

## 위험도

NONE
