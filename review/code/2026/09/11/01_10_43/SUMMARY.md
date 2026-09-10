# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 1건(`CHANGELOG.md` 미기재)만 실질 발견, 나머지는 INFO/확인완료. `documentation`(router_safety 강제)·`user_guide_sync` 둘 다 전문 확보됨(forced 화이트리스트 미이행 없음).

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 이 PR 이 닫는 CRITICAL 보안 우회(R-CC-10 single-path)와 wire 계약 변경(`chatChannel` PATCH 가 `botToken`/`inboundSigningPlaintext` 를 400 으로 거부하는 의도된 breaking change)에 대해 `CHANGELOG.md` 항목이 없다. 저장소 루트에 `CHANGELOG.md` 가 실제 존재하며, 최근 backend 보안/계약 수정 커밋(`08fbf133d`·`bfa124920`·`f5d97aa39` 등)은 예외 없이 같은 커밋에서 이를 갱신하는 확립된 관례다. 직전 라운드(`00_21_55/SUMMARY.md` INFO#8)의 "이미 검토·유지 결정" 처분은 실제로는 인접한 `writeOnly` OpenAPI 코드젠 항목에 대한 사유였고 CHANGELOG 축에는 별도 사유가 없다. | 저장소 루트 `CHANGELOG.md` (이 diff 에 미포함) | 마무리 커밋에서 `## Unreleased —` 절 추가(선례 형식: `bfa124920`), 또는 스코프 밖이라면 CHANGELOG 축 전용 사유를 `spec-draft-nullable-notation-followups.md` 에 명시 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `triggers.mdx`/`.en.mdx` 의 "Bot Token 회전 (single-path)" 절 제목이 이번 diff 로 늘어난 범위(비밀 필드 PATCH 금지·최초 부착 금지·provider 전환 금지, 3가지 400 사유)를 더는 정확히 설명하지 않는다. 내용 자체는 정확·완전하며 기능/보안 영향 없음. | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:427` 부근 / `triggers.en.mdx:416` 부근 | 급하지 않음 — 다음 편집 시 제목을 "Chat Channel 설정 변경 제약" 류로 넓히거나 소제목 추가 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | LOW | CHANGELOG.md 미기재(WARNING) 1건, 절 제목 범위 초과(INFO) 1건. 이전 4라운드가 닫은 CRITICAL 2건·WARNING 다수의 실반영을 소스 직접 대조로 재확인(JSDoc/e2e docstring/spec 클래스 서사 분리 등) |
| user_guide_sync | NONE | 매트릭스 21 trigger 중 backend-api-change 1건만 매칭, target (a)(b) 모두 같은 PR 안에서 동반 갱신 완료 확인(swagger jsdoc + ko/en MDX 8파일 parity). `<ImplAnchor>` 가드 268건 + frontend 전체 스위트 6378건 GREEN 실행 확인. 위반 0건 |

## 발견 없는 에이전트

- user_guide_sync (위반 0건 — 매칭된 유일한 trigger 의 동반 갱신이 이미 같은 PR 안에서 완료됨을 실행 검증으로 확인)

## 권장 조치사항
1. `CHANGELOG.md` 에 이번 PR(CRITICAL 보안 우회 차단 + `chatChannel` PATCH breaking change)에 대한 `## Unreleased —` 절 추가, 또는 스코프 제외 사유를 CHANGELOG 축 전용으로 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 명시 등재.
2. (선택, 비긴급) `triggers.mdx`/`.en.mdx` "Bot Token 회전 (single-path)" 절 제목을 실제 범위(3가지 400 사유)에 맞게 확장 검토.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 이번은 5라운드째 타겟(targeted) 재실행이며 router 호출 없이 `documentation`+`user_guide_sync` 두 reviewer 만 명시 지정돼 전원 실행됨.
  - **실행**: `documentation`, `user_guide_sync` (2명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation` — 전문 확보됨 (미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |
