# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-done, webhook endpoint_path 전역 유일)

## 검토 범위

target 은 `spec/2-navigation/2-trigger-list.md`. 실제 구현(diff 10개 파일/594줄 — V131·V132 마이그레이션,
`triggers.service.ts`·`triggers.controller.ts`, `webhook-trigger.e2e-spec.ts`·신규
`trigger-endpoint-path-dedupe.e2e-spec.ts`, 사용자 가이드 mdx 2개)이 이미 세 차례의 `--spec` +
직전 `--impl-prep`(00_16_40, 위험도 NONE) 검토를 거친 계획과 다른 spec 영역 사이에서 여전히 충돌 없이
정합한지를 impl-done 시점에 재확인했다. `--impl-prep` 이후 두 라운드의 `/ai-review` 수정
(`b9162a877` W1/W2/W3/W6, `ec8921dde` 문서 정리)이 새로 만든 표현·상수·e2e 가 기존 spec 서술과
어긋나지 않는지에 초점을 맞췄다.

직접 `git -C <worktree> diff origin/main...HEAD` 및 `Read` 로 확인한 대상:
`codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql`,
`V132__trigger_endpoint_path_global_unique.sql`(+`.conf`),
`codebase/backend/src/modules/triggers/{triggers.service.ts,triggers.controller.ts}`,
`codebase/frontend/src/content/docs/02-nodes/triggers{,.en}.mdx`,
그리고 `spec/1-data-model.md`(§Rationale「Webhook endpoint_path 전역 유일」·§3 인덱스 전략),
`spec/5-system/12-webhook.md`(WH-SC-01·"endpointPath 가변성"),
`spec/5-system/3-error-handling.md` §1.10, `spec/5-system/2-api-convention.md` §12.2,
`spec/data-flow/10-triggers.md`(§"UNIQUE 범위"), `spec/7-channel-web-chat/5-admin-console.md`.

## 발견사항

이번 impl-done 스코프에서 CRITICAL/WARNING 급 cross-spec 충돌을 찾지 못했다. 확인한 항목(전부 INFO
수준의 "정합 확인"):

- **[INFO] 데이터 모델 — 마이그레이션 실물이 spec Rationale 서사와 정확히 일치**
  - target 위치: `2-trigger-list.md` §2.3.1 `endpointPath` 행, §3 UNIQUE 註
  - 대조 대상: `spec/1-data-model.md` §Rationale「Webhook endpoint_path 전역 유일 (2026-09-18)」,
    `V131__trigger_endpoint_path_dedupe.sql`, `V132__trigger_endpoint_path_global_unique.sql`
  - 상세: V131 의 tie-break 규칙(같은 `created_at` 이면 `id` 순)은 fix 라운드(W2)에서 마이그레이션
    헤더 주석에 명시적으로 추가됐고, 이는 `1-data-model.md` Rationale의 "가장 먼저 만든 트리거
    (`created_at`, 같으면 `id`)" 서술과 문자 그대로 일치한다. V132 의 "DROP(새)→CREATE→DROP(옛)"
    순서·인덱스 이름(`idx_trigger_endpoint_path`)·chat-channel 상태 컬럼 미사용도 spec 서술과
    동일하다.
  - 제안: 없음.

- **[INFO] API 계약 — 409 wire 형태 불변, 메시지 문구 변경은 계약 밖**
  - target 위치: `2-trigger-list.md` §3 PATCH 註, §3 하단 UNIQUE 註
  - 대조 대상: `spec/5-system/3-error-handling.md` §1.10, `spec/5-system/2-api-convention.md` §12.2/§5.3
  - 상세: fix 라운드(W6)가 `triggers.controller.ts` 에 도입한
    `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` 상수, 그리고 `triggers.service.ts` 의 사용자 노출
    메시지에서 "같은 워크스페이스에" 문구를 제거한 것("그 엔드포인트 경로는 이미 다른 트리거가 쓰고
    있어요")은 `code=RESOURCE_CONFLICT` / `details.code=TRIGGER_ENDPOINT_PATH_CONFLICT` /
    `details.field='endpoint_path'` wire 계약을 전혀 건드리지 않는다. error-handling.md §1.10 은
    메시지 문구를 규정하지 않고 SoT 를 `2-trigger-list.md §3` 에 위임하므로, 자유 문구 영역의
    변경은 §1.10 과 충돌하지 않는다. 오히려 "다른 워크스페이스의 트리거일 수 있다" 는 현재 정책과
    더 정확히 부합하도록 개선됐다(구 메시지가 "같은 워크스페이스" 라고 말해 실제 충돌 상대와
    어긋날 여지가 있었다).
  - 제안: 없음.

- **[INFO] 사용자 가이드 — WH-SC-01 의 "추측 방지 vs 복사 방지" 구분이 두 mdx 에 정확히 반영**
  - target 위치: (target 문서 밖 — 참조 spec) `spec/5-system/12-webhook.md` WH-SC-01
  - 대조 대상: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx`,
    `triggers.en.mdx`(fix 라운드 W3)
  - 상세: WH-SC-01 은 "비밀성(추측 불가)과 유일성(복사 불가)은 다른 보장" 이라고 명시한다.
    수정된 가이드 문구("UUID 로 발급 — 경로를 추측하기 어렵게" + "이미 알고 있어도 다른
    워크스페이스에 등록하면 거부") 는 이 두 축을 분리해 정확히 반영하며, 이전 문구
    ("워크스페이스 도메인 아래" · "브루트포스 방지")가 갖고 있던 "워크스페이스 스코프" 오도
    표현을 제거했다.
  - 제안: 없음.

- **[INFO] plan 경로 선인용 — cross-spec 도메인 밖(참고만)**
  - 상세: `V131`/`V132` 헤더, e2e 머리말, `1-data-model.md` Rationale 이 모두
    `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 를 인용하지만, 실제로는
    아직 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 에 있다(이 PR 의
    마지막 커밋에서 이동 예정이라고 diff 번들 자체가 명시). 이는 데이터 모델·API 계약·상태
    전이·RBAC·계층 책임 중 어느 관점의 "cross-spec 충돌" 도 아니라 plan 라이프사이클 타이밍
    문제이므로 본 checker 관점에서는 관찰만 기록한다(plan_coherence 관점 소관).

- **[INFO] 요구사항 ID / 상태 전이 / RBAC / 계층 책임 — 영향 없음 (재확인)**
  - 상세: fix 라운드가 추가한 상수·e2e·문구 변경 중 신규 요구사항 ID 부여, 상태 머신 변경, 권한
    모델 변경, 계층 책임 재배치는 없다. `--impl-prep`(00_16_40) 판정과 동일하게 이 네 관점은
    이번 diff 로 인한 새 충돌 후보가 없다.

## 요약

`--impl-prep` 단계(00_16_40, 위험도 NONE)에서 이미 데이터 모델·API 계약·요구사항 ID·상태 전이·
RBAC·계층 책임 여섯 관점을 확인했고, 착수 후 두 차례의 `/ai-review` fix 라운드(`b9162a877`,
`ec8921dde`)가 추가한 변경(V131 tie-break 규칙 명문화, 409 설명 상수화, 서비스 메시지에서
워크스페이스 문구 제거, 사용자 가이드의 추측/복사 방지 재서술, dedupe e2e 신설)은 모두 wire
계약·데이터 모델·에러 카탈로그와 문자 그대로 정합하며 새로운 cross-spec 모순을 만들지 않았다.
마지막 커밋(`ec8921dde`)이 `codebase/**` 를 건드리지 않는 문서/리뷰 산출물 정리였다는 점도
구현이 안정화됐음을 뒷받침한다. plan 파일이 아직 `plan/complete/` 로 이동되지 않아 여러 문서가
선인용 중인 점은 cross-spec 영역이 아니라 plan 라이프사이클 타이밍이므로 관찰로만 남긴다.
구현을 그대로 채택하지 못할 cross-spec 사유는 없다.

## 위험도

NONE
