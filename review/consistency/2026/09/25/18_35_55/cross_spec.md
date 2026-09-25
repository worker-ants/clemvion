# Cross-Spec 일관성 검토 — 경로 워크스페이스 가드 `@Roles` 라우트 수 실측 정정

## 검토 대상

`plan/in-progress/spec-draft-workspace-path-guard-role-census.md` — `spec/data-flow/12-workspace.md`
§Rationale "가드 거부의 오류 코드" 의 두 실측 수치(취소선 + 정정문)만 바꾸는 draft. API·데이터모델·상태전이·RBAC 규칙 자체는
**무변경**("결정은 바뀌지 않는다")이라고 draft 스스로 명시.

## 발견사항

교차-spec 충돌 없음. 근거:

1. **수치 중복 소재 확인** — `spec/**` 전체에서 `editor 66` / `66곳` 패턴은 `spec/data-flow/12-workspace.md` 두 곳
   (L415, L420, target 이 정확히 이 두 자리를 고친다) 외에는 존재하지 않는다. `plan/complete/spec-draft-workspace-path-guard.md`
   에도 같은 옛 수치가 남아 있으나, target 의 Rationale 이 "결정 당시 기록이니 고치지 않는다" 로 명시 스코프 제외했고
   그 파일은 `spec/` 가 아니라 `plan/` 이라 본 검토 범위(cross-**spec**) 밖이다.

2. **CHANGELOG 와의 산술 일치** — `CHANGELOG.md` L31-32 는 이미 머지 시점 실측(88곳 — editor 63 · admin 17 · owner 4 ·
   viewer 4)을 기록해 두었고, target 의 "후 (1)" 문구가 적는 "이 PR 브랜치(머지 시점)" 행(63/17/4/4, 합 88)과 **정확히 일치**한다.
   또한 origin/main 기준(63/9/3/4, 합 79)과 delta(9 = admin 8 + owner 1)의 산술도 같은 spec 파일의 "경로 파라미터 워크스페이스도
   가드가 본다" 절이 이미 서술한 "Owner/Admin 요구 8곳은 `@Roles('admin')`, Owner 요구 2곳(`remove`·`transferOwnership`)은
   `@Roles('owner')`" 및 "`transferOwnership` 은 이미 `@Roles('owner')` 였다"와 내적으로 정합한다(신규 추가는 admin 8 + owner 1(`remove`)
   = 9, 기존 `transferOwnership` 의 owner 는 이미 79 안에 포함).

3. **API 계약·데이터 모델·상태 전이·RBAC 규칙 불변** — 수정 대상은 두 문장의 인용 수치뿐이며, 오류 코드 표
   (`NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED`)·적용 범위("전역")·"비멤버는 항상 `NOT_A_MEMBER`" 규칙은
   원문 그대로 유지된다. 따라서 `spec/5-system/1-auth.md`(권한 매트릭스)·`spec/2-navigation/6-config.md`(Model Config
   `@Roles('editor')` 게이트, R-7)·`spec/2-navigation/9-user-profile.md`(워크스페이스 역할 매트릭스 §4.2, 멤버십 가드 참조)
   등 이 spec 을 참조하는 다른 영역 문서와의 계약에는 영향이 없다 — 이들은 라우트 개수가 아니라 역할 요구·오류 코드·엔드포인트
   shape 을 인용할 뿐이고, 그 부분은 target 이 건드리지 않는다.

4. **spec_impact 범위 정확** — frontmatter `spec_impact: [spec/data-flow/12-workspace.md]` 는 실제 변경 대상과 일치한다.
   다른 spec 파일에 대한 파급(동반 갱신 필요)은 없다.

발견된 CRITICAL/WARNING 없음. 아래는 INFO 성격의 참고 사항 하나뿐이다.

- **[INFO]** `plan/complete/spec-draft-workspace-path-guard.md` 의 잔존 옛 수치
  - target 위치: target 문서 `## Rationale` — "`plan/complete/...` 의 같은 수치는 고치지 않는다"
  - 충돌 대상: `plan/complete/spec-draft-workspace-path-guard.md` L151, L296 (동일한 옛 `editor 66` 문구)
  - 상세: `spec/` 안에서는 완전히 정정되지만, 과거 결정 기록(`plan/complete/`)에는 반증된 수치가 그대로 남는다. cross-**spec** 충돌은
    아니다(그 파일은 spec 이 아니라 완료된 plan 이며, 정의상 결정 당시 스냅샷을 보존한다) — 다만 향후 이 plan 파일을 근거로 재인용하는
    사람이 옛 수치를 다시 끌어올 여지가 있다.
  - 제안: 별도 조치 불요. target 의 Rationale 이 이미 이 비대칭을 의도적으로 설명했고, 정정의 단일 진실은 spec(`data-flow/12-workspace.md`)
    이라는 점이 명시돼 있어 혼선 위험은 낮다.

## 요약

target 은 `spec/data-flow/12-workspace.md` 한 절의 인용 수치 두 곳만 취소선+정정으로 바꾸는 좁은 draft 이며, 오류 코드·적용
범위·RBAC 규칙 등 실제 계약은 무변경이다. 정정된 수치는 이미 존재하는 `CHANGELOG.md` 머지 시점 기록 및 같은 spec 파일 내
"경로 파라미터" 절의 8/2 분해와 산술적으로 정합하고, `spec/**` 어디에도 이 수치를 다르게 인용하는 자리가 없다. Cross-spec
데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 충돌이 발견되지 않았다.

## 위험도

NONE
