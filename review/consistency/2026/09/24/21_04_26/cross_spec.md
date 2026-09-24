# Cross-Spec 일관성 검토 — `spec/conventions/spec-impl-evidence.md` (impl-prep)

## 스코프 메모

이번 검토는 신규/변경 spec draft 가 아니라 **읽기 전용 target**(`spec/conventions/spec-impl-evidence.md`, 무수정)을 대상으로 한 `--impl-prep` 게이트다. 실제 구현 대상(`plan/in-progress/docs-guard-trigger.md`)은 `.github/workflows/spec-link-checks.yml` 의 pathspec·실행 범위를 넓히는 **harness/CI 변경**이며 `spec_impact: none` 이다 — spec 본문을 고치지 않는다. 따라서 본 검토의 실질 질문은 "구현 착수 전, target 문서가 이미 다른 spec 영역과 충돌하는 상태가 아닌가" 다.

번들에는 target 전문과 `spec/0-overview.md` 전문만 포함되고 나머지 112개 spec 파일은 컨텍스트 예산 초과로 절단됐다. 판정에 직접 걸리는 주장은 저장소에서 `Read`/`grep` 로 직접 확인했다(`PROJECT.md`, `.github/workflows/{frontend-checks,spec-link-checks}.yml`, `spec/conventions/frontend-layering.md`, `spec/conventions/cafe24-api-catalog/*.md`).

## 발견사항

- **[INFO]** PROJECT.md 의 CI 강제 서술이 이번 plan 착수 후 stale 해질 예정
  - target 위치: `spec-impl-evidence.md` §6 Rollout 4번째 항목 ("PROJECT.md §자동 가드 표에 해당 row 추가") 및 §4 가드 표(4건 "build-time 가드, 빌드 실패=차단")
  - 충돌 대상: `PROJECT.md` §"문서 링크 검증"(376~383행) — "`spec-link-checks` 워크플로가 `spec-link-integrity.test.ts` **하나만** 돈다"고 명시. 실측(`spec-link-checks.yml` 94행)도 이와 일치 — `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` 단일 커맨드만 실행.
  - 상세: target 은 §4 의 4개 가드(`spec-frontmatter`·`spec-code-paths`·`spec-status-lifecycle`·`spec-pending-plan-existence`)를 "build-time 차단"이라고만 서술하고 어느 CI 워크플로가 그것을 강제하는지는 말하지 않는다. 실제로는 `frontend-checks.yml` 이 `codebase/frontend/**` 등만 trigger 하고 `spec/**`·`plan/**` 을 보지 않아(직접 확인, 52~60행), spec-only/plan-only PR 에서는 이 4개 가드 중 어느 것도 CI 에서 돌지 않는다. 이는 target 문서가 새로 만든 모순이 아니라 **plan 자신이 §A 에서 이미 실측·서술한 기존 갭**이며, 이번 plan 이 `spec-link-checks.yml` 을 디렉터리 전체 실행 + `plan/**` pathspec 추가로 넓혀 정확히 이 갭을 닫으려 한다. 다만 그 워크플로 변경이 착지하면 `PROJECT.md` 376~383행의 "가드 하나만 돈다"는 서술이 그 즉시 stale 해진다 — harness 변경과 짝지어 갱신되지 않으면 "문서가 구현보다 좁게(guard 실행 범위를) 말하는" drift 가 남는다.
  - 제안: `spec-link-checks.yml` 변경과 **같은 커밋/PR** 에서 `PROJECT.md` §"문서 링크 검증"(및 필요하면 §자동 가드 표 인접 서술)도 함께 갱신한다. `PROJECT.md` 는 `spec/**` 가 아니므로 이 plan 의 `spec_impact: none` 선언과 모순되지 않는다(거버넌스 문서 갱신은 harness 변경의 일부로 처리 가능) — 다만 빠뜨리면 다음 사람이 "가드가 하나만 돈다"는 문구를 그대로 믿게 된다.

- **[INFO]** target 문서 내 검증 가능한 교차 수치는 현재 일치 확인됨(참고용, 조치 불필요)
  - target 위치: R-7 (카탈로그 최상위 인덱스 "18개") · §4.2 spec-link-integrity 스코프(`codebase/{backend,frontend,channel-web-chat,packages}`)
  - 확인: `spec/conventions/cafe24-api-catalog/*.md`(비-`_*`, 최상위) 실제 파일 수 = 18 → 일치. `spec-link-checks.yml` 의 스캔 대상 pathspec(`codebase/backend/**`·`codebase/frontend/**`·`codebase/channel-web-chat/**`·`codebase/packages/**`)도 target §4.2 서술과 일치. 새로운 충돌 아님, 검증 결과만 기록.

## 다른 영역과의 충돌 점검 결과 (6개 관점)

1. **데이터 모델** — target 은 제품 엔티티를 정의하지 않는다(spec frontmatter 메타 규약). `0-overview.md` 의 엔티티(Workspace/Integration 등)와 겹치는 필드 정의 없음. 충돌 없음.
2. **API 계약** — target 은 endpoint/HTTP 계약을 다루지 않는다. 충돌 없음.
3. **요구사항 ID** — target 은 `NAV-*`/`ED-*` 류 요구사항 ID 를 부여하지 않는다. 충돌 없음.
4. **상태 전이** — target 의 `status` enum(backlog/spec-only/partial/implemented/archived) 은 §2.2 에서 엔티티 `status` 컬럼(`0-overview.md`/`1-data-model.md` 도메인) 및 plan frontmatter `status` 와 의미 도메인을 명시적으로 분리해 이미 방어돼 있다. 새로 발견된 모순 없음.
5. **권한·RBAC** — target 은 RBAC 규칙을 정의하지 않는다. `0-overview.md` §6.1 의 워크스페이스 RBAC(`editor`/`Admin+`)와 겹치는 서술 없음. 충돌 없음.
6. **계층 책임** — target 의 가드가 frontend vitest 로 실행되며 backend/channel-web-chat/packages 소스까지 스캔하는 설계는 `frontend-layering.md`(frontend 디렉터리 간 **import 방향** 규약, `src/lib/**` 등)와 대상 도메인이 다르다 — layering 규약은 "frontend 내부 의존 방향"만 다루고 "테스트 도구가 다른 워크스페이스의 텍스트를 정적 스캔하는 것"은 그 규약의 적용 범위 밖(`__tests__` 배제 조항과도 무관한 별개 축)이다. 충돌 없음.

## 요약

target(`spec-impl-evidence.md`)은 이번 plan 에서 내용이 바뀌지 않으며(`spec_impact: none`), 6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 모두에서 다른 spec 영역(`0-overview.md` 및 직접 확인한 `frontend-layering.md`, cafe24 카탈로그 수치)과 새로운 모순이 발견되지 않았다. target 문서 §2.2·R-4·R-6·R-7 이 이미 인접 도메인과의 혼동을 스스로 방어해 뒀고, 실측한 교차 수치(카탈로그 18개, 워크플로 스캔 pathspec)도 일치한다. 유일하게 남는 항목은 cross-spec 모순이 아니라 **harness 문서 동기화 이슈**다 — 이번 plan 이 CI 실행 범위를 넓히면 `PROJECT.md` §"문서 링크 검증"의 "가드 하나만 돈다"는 서술이 stale 해지므로, 워크플로 변경과 같은 PR 에서 함께 갱신할 것을 권고한다. 구현 착수를 막을 사유 없음.

## 위험도

NONE
