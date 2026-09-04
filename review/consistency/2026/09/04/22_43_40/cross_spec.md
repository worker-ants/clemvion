# Cross-Spec 일관성 검토 — `spec/` (--impl-prep)

## 검토 방법 및 스코프 제약

전달된 프롬프트는 target 을 `spec/` 전체(386개 파일)로 지정했으나 컨텍스트 예산 초과로
모든 파일 본문이 생략되었고, "관련 spec 본문" 섹션도 비어 있었다(`(없음)`). 이 자리에
내용이 없다는 사실을 "충돌 없음" 의 근거로 삼지 않고, `git log`/`git show` 로 이 worktree 의
최근 커밋을 역추적해 **실제로 변경·검토 대상이 되는 영역**을 특정한 뒤 해당 spec 파일을 직접
`Read`/`grep` 했다.

식별된 실질 대상:
- `plan/in-progress/spec-draft-schedule-index.md` (schedule 인덱스 전략 정정, 2026-09-04 방금 반영)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (nullable 표기 후속 3건 — 대부분 반영 완료, 잔여 developer 항목 2건)
- 위 두 draft 가 건드리는 spec 본문: `spec/1-data-model.md` §3, `spec/data-flow/10-triggers.md` §2.1/§3.2,
  `spec/2-navigation/3-schedule.md`, `spec/5-system/2-api-convention.md` §2.2/§5.4, `spec/5-system/1-auth.md`,
  `spec/conventions/swagger.md`, `spec/conventions/migrations.md`

386개 파일 전체를 전수 대조하지는 못했다 — 아래 "위험도" 판단은 이 실질 대상 범위에 한정된다.

## 발견사항

검토한 범위 내에서 **CRITICAL/WARNING 급 cross-spec 충돌은 발견하지 못했다.** 확인한 정합
지점은 다음과 같다.

- **인덱스 정의 미러 정합** — `spec/1-data-model.md:914-915` 의 `Schedule (workspace_id, next_run_at)`
  / `Schedule (trigger_id)` 두 행이 `spec/data-flow/10-triggers.md:175` 의 서술과 일치한다.
  이 인덱스를 언급하는 자리는 저장소 전체에서 정확히 이 두 spec 위치 + 실물 DDL
  (`codebase/backend/migrations/V002__indexes.sql`) 세 곳뿐임을 grep 으로 확인했다.
- **마이그레이션 버전 정책 정합** — `spec/conventions/migrations.md` §2 는 "신규 V번호 = 현재
  max(V) + 1" 을 요구한다. `codebase/backend/migrations/` 의 실물 최대 버전은 V109 이고, 신규 문서가
  예고하는 V110 은 이 규칙과 정확히 맞는다. V106 (`Schedule (trigger_id)`)은 이미 저장소에 실재하며
  spec 서술("1:1 매핑" 등)과도 일치한다 — `spec/1-data-model.md:280-281` 의 Trigger↔Schedule 1:1
  서술이 V106 마이그레이션 주석의 전제와 같다.
- **`/api/auth/*` 예외 조항과 §1 인증 spec 의 실제 엔드포인트 표 정합** — `spec/5-system/2-api-convention.md:56`
  이 예외로 든 22개 상태 전이 액션 + 2개 read-only capability 조회(`GET /api/auth/oauth/:provider`,
  `GET /api/auth/2fa/webauthn/availability`) 가 `spec/5-system/1-auth.md:481-507` 의 엔드포인트 표와
  1:1 대응한다. 복수형이라 규칙에 포섭되는 `oauth/providers` · `2fa/webauthn/credentials{,/:id}` 는
  예외 목록에서 올바르게 제외돼 있다.
- **swagger.md 예제와 §5.4 정의 정합** — `spec/conventions/swagger.md:90-110` 의 "닫힌 union" 예제가
  이제 `@ApiProperty({ nullable: true })` + non-optional 필드를 쓰며, `spec/5-system/2-api-convention.md`
  §5.4 의 새 DTO 선언 3분류(키 생략/응답 상시 존재 null/타입-데코레이터 불일치 금지)와 어긋나지 않는다.
  §5.4 자체도 "적용 범위 — 응답 바디" 로 명시 스코프를 좁혀 PATCH tri-state 요청 DTO 규칙과
  충돌하지 않게 분리돼 있다.
- **schedule 목록 정렬 화이트리스트와 §2.9 표기 정합** — `spec/2-navigation/3-schedule.md:58,131`
  이 `next_run_at` NULL 표시(`-`)와 `sort`/`order` whitelist 정책을 서술하는데, `spec/1-data-model.md`
  §2.9 의 nullable 정정(§① 변경안 A)과 모순되지 않는다.

## 남은 열린 항목에 대한 참고 (충돌 아님, 정보성)

`spec-draft-nullable-notation-followups.md` 의 "§5.4 drift 배치 2단계" (검증자 없는 응답 DTO 78곳)와
`spec-draft-schedule-index.md` 의 V110 마이그레이션 적용은 모두 **developer 트랙 미착수 항목**으로
문서에 명시돼 있다. 두 항목 다 spec 서술은 이미 목표 상태로 갱신됐고 구현만 남아 있어, 이 impl-prep
게이트 관점에서 spec 자체의 cross-spec 정합성을 막는 요소는 없다.

## 요약

이번 검토는 target 이 `spec/` 전체로 광범위하게 지정됐으나 프롬프트에 실제 diff/본문이 실리지
않아, 최근 커밋 이력에서 실질적으로 변경된 두 draft(스케줄 인덱스 전략, nullable 표기 후속)가
건드리는 spec 영역을 직접 열어 대조했다. 그 범위 안에서는 데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC·계층 책임 어느 관점에서도 모순을 찾지 못했다 — 인덱스 서술은 두 미러 문서와 실물 DDL
사이에서 정확히 일치하고, `/api/auth/*` 신규 예외 조항은 §1 인증 문서의 실제 엔드포인트 표와
1:1 대응하며, DTO nullable 규칙(§5.4)과 swagger.md 예제도 서로 어긋나지 않는다. 다만 386개 파일 중
직접 확인한 것은 이번 변경과 직결된 일부뿐이므로, spec/ 전역에 대한 전수 cross-spec 보증은 아니다.

## 위험도

LOW
