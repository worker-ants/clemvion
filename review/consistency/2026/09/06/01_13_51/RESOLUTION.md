# RESOLUTION — `review/consistency/2026/09/06/01_13_51`

**원 결과**: BLOCK: NO · Critical 0 · WARNING 2 · 위험도 LOW

## WARNING 1 (plan_coherence) — 같은 plan 문서가 wire 형태를 정반대로 두 번 적었다

한 blockquote 는 `ScheduleDto.trigger` 를 *"**키 생략**으로 확정했다"* 고 적었고, 아래
bullet 은 *"`trigger` 는 상시 존재라 **기본형**으로 바꿨고"* 라고 적었다. **코드는 후자**다
(`@ApiProperty`, `toResponse` 는 부재 시 아예 던진다).

앞의 기록이 남아 있으면 **후속 planner 턴이 nav-spec 에 틀린 사실을 옮긴다** — 그 bullet 이
바로 nav-spec 문서화 항목이라 위험이 실재한다.

**수정** — 취소선으로 원문을 남기고 정정을 붙였다 (`plan/**` 는 developer 쓰기 영역).
왜 기본형인지(NOT NULL 1:1 + 네 경로가 전부 채움 + 컨트롤러가 던짐)와 **정본이 어느
쪽인지**를 함께 적었고, *"키 생략형인 것은 `trigger.workflow` 한 겹 아래"* 라는 구분도
남겼다 — 두 기록이 갈린 원인이 그 혼동으로 보인다.

## WARNING 2 (naming_collision) — Ref DTO 명명 유사성

checker 스스로 *"이미 양쪽 JSDoc 에 상호 경고 주석으로 완화됨(직전 라운드 W2 반영,
**재발 아님**). 추가 조치는 선택사항"* 이라고 적었다.

**리네임하지 않는다.** `ScheduleTriggerWorkflowNameRefDto` 로 바꾸면 **공개 OpenAPI 스키마
이름**이 바뀐다 — 필드 차이가 의도된 설계인데 이름을 길게 만드는 대가로 얻는 것은 이미
JSDoc 이 주고 있는 정보뿐이다. 세 번째 자매가 생기면 그때 공통 명명 규칙을 정한다.

## INFO#3 — `INTERNAL_ERROR` 문구의 언어 drift → 트래커 등재

`3-error-handling.md` 는 한국어 문구를 정하는데 `GlobalExceptionFilter` 는 영어다.
**이 브랜치가 만든 회귀가 아니다** — 스케줄 가드가 규약 문구를 그대로 쓰면서 두 문구가
처음 나란히 드러났을 뿐이다. 필터를 건드리면 **매핑되지 않은 모든 5xx** 의 문구가 바뀌므로
이 PR 범위를 넘는다.

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재하면서 checker 의 지적을
**한 칸 넓혔다**:

- checker 는 `UNHANDLED_ERROR_MESSAGE` 하나만 짚었는데, 같은 클래스에
  `UNKNOWN_ERROR_MESSAGE`(*"An unexpected error occurred"*)가 따로 있고 **그쪽이 기본값**이다.
  한쪽만 고치면 같은 `INTERNAL_ERROR` 안에서 언어가 세 갈래가 된다.
- 실측: 두 문구를 문자열로 단언하는 자리는 `http-exception.filter.spec.ts` **2곳**뿐이다.
  즉 배선은 작고, 판단이 필요한 것은 **API 응답 문구의 언어 정책**이다.

## INFO#1·#2 — 조치 불요

`secret-store.md §1` stale 화, nav-spec 키-생략 사유 미반영. 둘 다 `spec/` 쓰기라
**developer 권한 밖**이고 이미 plan 트래커가 추적 중이다. 다만 #2 는 WARNING#1 정정이
선행돼야 잘못된 사실을 옮기지 않는데, 그 정정을 이번에 했다.

## 검증

코드 변경 없음 (`plan/**` 단독 편집). 직전 커밋에서 lint/unit/build/e2e 전 단계 PASS.
