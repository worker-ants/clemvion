---
title: Personal 통합 소유자 강제 — 후속(노드 실행 · pending 재사용 · Viewer · 화면)
status: in-progress
owner: developer
worktree: (unstarted)
spec_impact:
  - spec/2-navigation/4-integration.md
started: 2026-09-25
---

# Personal 통합 소유자 강제 — 후속

`spec/2-navigation/4-integration.md` 의 `pending_plans` 다(`status: partial`). §8 «판정 규칙» 블록의 **«아직 강제되지 않는 것»** 을
책임진다. 선행 PR — 목록 · `:id` 경로 · `oauth/begin` · precheck · 워크플로우 어시스턴트의 소유자 강제 — 은
`plan/complete/integration-personal-owner.md`.

이 파일의 항목이 모두 닫히면 spec 을 `status: implemented` 로 승격하고 `pending_plans` 에서 이 파일을 뺀다(`spec-impl-evidence.md`
§3 라이프사이클).

## 항목

- [ ] **«워크플로우 노드에서 사용: 본인 것만» 을 강제한다** (planner 결정 → developer). 두 층이다.
      1. **노드 설정 저장** — `config.integrationId` · `config.mcpServers[].integrationId` 가 남의 personal 을 가리키면 저장을 거부할지.
         지금은 workflows · nodes 모듈 어디도 이 값을 검증하지 않는다.
      2. **실행 시점** — `IntegrationsService.getForExecution` 은 워크스페이스만 본다. 스케줄 · 웹훅 실행에는 요청 사용자가 없어
         «본인» 을 워크플로우 생성자로 볼지, 노드를 마지막으로 저장한 사람으로 볼지, 실행 시점 검사를 두지 않을지부터 정해야 한다.
      **착수 전 실측**: 기존 워크플로우 중 생성자와 다른 사람의 personal 통합을 참조하는 노드 수 — 0 이 아니면 강제가 곧 실행
      중단이다(마이그레이션 · 안내 필요).
      **왜 급한가** (`/ai-review` `review/code/2026/09/25/23_58_59` WARNING 1): API 로는 남의 personal 이 보이지 않지만, 그 UUID 를
      아는 Editor 가 자기 워크플로우 노드의 `integrationId` 에 넣어 실행하면 실행 엔진(`getForExecution` — 워크스페이스만 본다)이 그
      자격 증명으로 외부를 호출한다. 이 PR 의 §8 불변식이 실행 표면에서는 아직 성립하지 않는다 — 저장 시점 검증만으로도 이
      경로의 대부분이 닫힌다(실행 시점 판정은 «본인» 기준 결정이 먼저). 착수 시 `getForExecution` 이 가시성 판정을 우회하는
      **유일한** 경로임을 보는 경계 캐너리도 함께(같은 리뷰 INFO 11).
- [ ] **cafe24 Private · MakeShop 의 `pending_install` 행 재사용이 생성자를 보지 않는다** (developer — 거부 응답 설계는 planner).
      `integration-oauth.service.ts` 의 `createPrivatePendingIntegration`(같은 몰의 private pending 행) · `createMakeshopPendingIntegration`
      (같은 `client_id` 의 pending 행)이 **누가 만든 행이든** 재사용해 `client_id` · `client_secret` · `scopes` 를 덮어쓰고 그 행의
      `integrationId` · 설치 URL 을 돌려준다. 남의 personal pending 행이면 거부해야 하는데, 기존 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`
      는 «이미 연결됨» 이라 뜻이 맞지 않는다 — 코드부터 정한다. 매장 식별자 유일성이 워크스페이스 단위라 «새 행을 만든다» 는 선택지는 없다.
- [ ] **Viewer 가 자기 personal 을 만들고 · 이름을 바꾸고 · rotate · 삭제하지 못한다** (planner 결정 → developer). §8 표 · RBAC §3.2
      는 허용하는데 라우트 가드(`@Roles('editor')` — create · update · rotate · remove)가 막는다. 가드를 내리면 Viewer 가 Organization
      통합에 닿는 경로를 서비스가 전부 막는지(Admin 판정은 이미 서비스에 있다) 확인 후 내리거나, 표를 Editor 로 정정한다.
      (2026-09-26 보탬) 가드를 내리면 이 네 라우트의 `@ApiForbiddenResponse` 설명(`forbiddenForRole('editor')` 로 시작)도 **손으로**
      바꿔야 한다 — 저장소 가드 `forbidden-response-codes` 는 설명에 **빠진** 가드 코드만 잡고 **남은** 코드(`EDITOR_REQUIRED`)는 못 잡는다
      (서비스가 같은 이름의 코드를 내는 자리와 구별할 수 없어서다 — `plan/complete/forbidden-desc-codes.md`).
      네 라우트의 설명은 모듈 상수 `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 한 곳이다 — `forbiddenWithService(forbiddenForRole('editor'), …)` 의
      첫 인자를 바꾼다(`plan/complete/forbidden-helper-sentences.md` 가 이음을 헬퍼로 옮겼다).
- [ ] **통합 상세 화면이 역할 · 소유에 따라 버튼을 가리지 않는다** (developer). Editor 가 Organization 통합의 이름 변경 · 삭제 ·
      reauthorize · rotate 버튼을 눌러야 403 토스트로 안다. `useHasRole("admin")` 선례(`spec/2-navigation/6-config.md §A.4`)처럼
      Organization 통합의 변경 액션은 Admin+ 에만 보인다.
