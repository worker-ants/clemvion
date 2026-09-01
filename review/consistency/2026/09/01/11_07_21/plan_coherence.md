# Plan 정합성 Check — `plan/in-progress/spec-draft-avatar-storage-key.md`

## 발견사항

- **[WARNING]** `spec-update-avatar-upload-implemented.md` 트래커 종결 누락 — 신규 `pending_plans` 등재와 상충
  - target 위치: `plan/in-progress/spec-draft-avatar-storage-key.md` §D-4 (`spec/2-navigation/9-user-profile.md` 및 "나머지 3개 문서" frontmatter `pending_plans`)
  - 관련 plan: `plan/in-progress/spec-update-avatar-upload-implemented.md` — `## 할 일` 체크리스트 전항목 + `### 같은 사실을 말하는 다른 SoT 문서` 섹션
  - 상세: target 의 변경안 A~F 는 `spec-update-avatar-upload-implemented.md` 의 할 일 체크리스트를 항목 단위로 그대로 흡수해 해소한다 —
    - `:334` 표 행 취소선 해제 → target D-2
    - `:136` 아바타 행 서술 정정 → target D-1
    - `§6.1` 엔드포인트 계약 기재 → target D-2 + D-3
    - `spec/0-overview.md` §2.7 트리·표 + `## Rationale` 정정 → target A + B (이 트래커가 지목한 Critical 원인 그 자체)
    - `spec/data-flow/4-file-storage.md` 갱신 → target C
    - `spec/5-system/3-error-handling.md` 에러 카탈로그 등재 → target F

    즉 target 이 적용되는 순간 `spec-update-avatar-upload-implemented.md` 는 실행할 일이 남지 않는다. 그런데 target §D-4 는 **같은 커밋에서** 그 트래커를 `9-user-profile.md`(및 나머지 3개 문서) frontmatter `pending_plans` 에 **새로 등재**하라고 지시한다.

    `.claude/docs/plan-lifecycle.md` §4 는 spec 레벨 `pending_plans` 를 "이 spec 의 미구현 surface 를 **책임지는** plan" (spec → plan, `status: partial` 시 의무, SoT `spec/conventions/spec-impl-evidence.md §2.1`, 가드 `spec-pending-plan-existence.test.ts`/`spec-status-lifecycle.test.ts`) 로 정의하고, "가리키던 plan 을 `complete/` 로 옮기면 이 값도 같은 commit 에서 갱신한다" 고 명시한다. target 커밋 시점에 `spec-update-avatar-upload-implemented.md` 의 책임(avatar 미구현 서술)은 이미 target 자신이 해소했으므로, 새로 추가되는 그 포인터는 등재되는 순간 dangling 이다 — "아직 안 끝난 일" 을 가리키는데 실은 같은 diff 가 이미 끝냈다.

    §D-4 의 근거로 인용된 "consistency INFO 2"(`review/consistency/2026/09/01/01_51_41` cross_spec INFO #2)는 이 target 초안이 존재하기 **이전** 라운드의 제안이라, "avatar 관련 spec 정정은 `spec-update-avatar-upload-implemented.md` 가 전담한다"는 그 시점의 전제를 그대로 이어받은 것 — 이후 Critical #1 이 planner 인계되면서 별도 spec draft(target)로 갈라진 현재 구도를 반영하지 못했다.
  - 제안: target 실행과 같은 턴에 (a) `spec-update-avatar-upload-implemented.md` 의 할 일 체크리스트를 전항목 체크하고 `plan/complete/` 로 이동, (b) §D-4 의 `pending_plans` 등재 대상을 재검토한다 — avatar 관련 gap 이 전부 target 으로 해소되므로 `9-user-profile.md` 는 기존 `pending_plans: [spec-sync-user-profile-gaps.md]` 만으로 충분할 수 있다(그 문서에는 in_app 뮤팅 등 avatar 와 무관한 잔여 항목이 있어 그 자체는 유지). `spec-update-avatar-upload-implemented.md` 를 굳이 참조해야 한다면, 그 문서를 완료 처리하지 않은 채로 남겨두는 이유를 target 에 명시해야 한다.

- **[INFO]** naming_collision WARNING(`01_51_41` #6, `s3.publicBaseUrl`/`app.publicBaseUrl` 혼동 방지 주석)이 어느 `plan/in-progress` 문서에도 추적되지 않음
  - target 위치: 해당 없음 (target 범위 밖 — 코드 변경이라 참고용)
  - 관련 plan: `plan/in-progress/spec-sync-user-profile-gaps.md` (아바타 항목 하위 "리뷰 2라운드에서 유예한 두 건" / "리뷰 3라운드의 구조 제안 처분" 목록)
  - 상세: 같은 BLOCK 리뷰(`review/consistency/2026/09/01/01_51_41`)에서 나온 WARNING 1~6·INFO 1~2 중, WARNING 1·2·3 은 target 문서가, WARNING 4·5·INFO 1·2 는 `spec-sync-user-profile-gaps.md` 가 이미 추적하고 있다(grep 확인: `01_51_41 WARNING 4`/`WARNING 5` 인용 존재). 그런데 **WARNING 6**(신설 `s3.publicBaseUrl`/`S3_PUBLIC_BASE_URL` 이 과거 실제 장애를 낸 `app.publicBaseUrl`/bare `publicBaseUrl` 과 leaf 이름을 공유 — `s3.config.ts`/`.env.example` 에 상호 참조 주석 필요)는 `plan/in-progress/**` 전체를 grep 해도 등장하지 않는다. developer 코드 스코프라 target(spec draft) 이 직접 처리할 항목은 아니지만, 이 BLOCK 이 target 적용으로 종결되면서 이 항목만 어느 트래커에도 안착하지 못한 채 함께 잊힐 위험이 있다.
  - 제안: `spec-sync-user-profile-gaps.md` 아바타 항목 하위에 이 WARNING 을 캐너리(예: 낮은 우선순위 체크박스)로 등재하거나, target 의 `## 관련` 섹션에 "코드 스코프 잔여(WARNING 6, 미추적)"로 명시해 developer 트랙 인계를 남긴다.

## 요약

target 은 `spec/0-overview.md` §2.7 Rationale 이 낸 BLOCK(Critical)과 그에 딸린 WARNING 1~3 을 `plan/in-progress/spec-update-avatar-upload-implemented.md` 트래커의 할 일과 정확히 겹치는 범위로 흡수해 해소하는 정합적인 설계다 — 인용된 spec 원문 줄 번호·구조가 실제 파일과 일치하고, 방향 결정(코드 유지·spec 정정)도 다른 미해결 결정과 충돌하지 않는다. 다만 target §D-4 가 지시하는 `pending_plans` 신규 등재는, 같은 diff 가 그 트래커의 책임을 이미 소진시킨다는 점을 반영하지 못해 등재 즉시 dangling 참조를 만든다 — `plan-lifecycle.md` §4 의 "가리키던 plan 을 complete/ 로 옮기면 같은 commit 에서 pending_plans 도 갱신" 규칙과 정면으로 어긋난다. 이 한 건을 제외하면 target 은 plan/in-progress 와 정합적이다.

## 위험도

MEDIUM
