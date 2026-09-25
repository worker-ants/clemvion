# 정식 규약 준수 검토 — spec-draft-workspace-path-guard.md

대상: `plan/in-progress/spec-draft-workspace-path-guard.md` (spec draft, `--spec` 모드)
대조 규약: `spec/conventions/error-codes.md`, `spec/conventions/swagger.md` (spec_impact 에 명시된 두 conventions 파일. `spec/conventions/audit-actions.md` 등 번들의 나머지 conventions 는 이 draft 의 변경 범위와 무관해 대조 대상에서 제외했다.)

## 발견사항

- **[WARNING]** C-5 swagger.md §5-4 체크리스트 패치가 조건절만 고치고 근거 설명문은 그대로 둔다
  - target 위치: target 문서 `### C-5. spec/conventions/swagger.md` 절
  - 위반 규약: `spec/conventions/swagger.md` §5-4 "새 엔드포인트 체크리스트" (`@ApiForbiddenResponse` 항목, 조건절 + 근거 설명문)
  - 상세: draft 의 지시는 체크리스트 항목의 **조건절**("`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는")에만 `@WorkspaceParam()` 을 추가하라고 한다. 그런데 같은 bullet 안에서 그 조건의 **근거를 설명하는 문장**("RolesGuard 는 `@Roles()` 유무와 무관하게 워크스페이스 멤버십을 항상 검증하므로 ..., `@WorkspaceId()` 만 쓰는 조회 엔드포인트도 403 을 낼 수 있다")은 여전히 `@WorkspaceId()` 만 지목한다. `@WorkspaceParam()` 이 이 체크리스트에 오르는 이유는 정확히 같은 근거(RolesGuard 가 `@Roles()` 유무·소비 데코레이터 종류와 무관하게 멤버십을 항상 검사)인데, 패치 후에는 "조건절엔 등재, 근거문엔 누락" 이라는 내적 불일치가 그 문서에 남는다. 다음 작성자가 근거문만 읽으면 `@WorkspaceParam()` 단독 사용 엔드포인트는 `@ApiForbiddenResponse` 가 필요 없다고 오독할 수 있다.
  - 제안: C-5 patch 지시에 "근거 설명문의 `@WorkspaceId()` 언급에도 `@WorkspaceParam()` 을 병기" 를 추가해 조건절과 설명문이 같은 데코레이터 집합을 가리키게 한다.

- **[WARNING]** C-4 error-codes.md §3 등재 문구 "HTTP 밖 호출자 방어선" 이 실측(호출부 grep)과 어긋날 가능성
  - target 위치: target 문서 `### C-4. spec/conventions/error-codes.md` 절, 및 이를 뒷받침하는 C-1 (e) Rationale "서비스 계층 검사는 남는다 — HTTP 밖 호출자의 방어선이다" 문장
  - 위반 규약: `spec/conventions/error-codes.md` §3 머리말 — "§3 은 **부정확한 이름이나 *유지*되는 active 코드**의 예외 등록부다." (즉 §3 등재는 그 코드가 실제로 계속 발행될 수 있는 경로가 있음을 전제한다)
  - 상세: 저장소를 실측하면(`grep -rn "admin_required" codebase/backend/src`) `admin_required` 는 `workspace-invitations.service.ts` 의 private `assertAdmin()` 단 한 곳에서만 발행된다. 이 메서드를 호출하는 서비스 메서드는 `invite`/`resend`/`revoke`/`listPending` 넷뿐이고, 이 넷은 전부 `workspaces.controller.ts` 에서만 호출된다(비-HTTP 호출자 0 — grep 으로 확인, `.claude/worktrees/workspace-path-guard/codebase/backend/src` 전수). 즉 draft 가 계획한 RolesGuard 게이팅이 이 4개 라우트(§1.5.4 초대 발송·재발송·취소·목록)에 적용되면, 비-admin 요청은 서비스에 도달하기 전에 가드가 막으므로 `assertAdmin()` 의 throw 분기는 **도달 불가능한 죽은 코드**가 된다 — "HTTP 밖 호출자" 자체가 이 서비스 메서드엔 존재하지 않기 때문이다. C-4 가 이 상태를 error-codes.md §3(유지되는 *active* 코드 전용 레지스트리)에 "서비스 계층의 `admin_required` 는 HTTP 밖 호출자 방어선으로 남는다" 라고 적으면, §3 자신이 선언한 "active" 전제와 실측이 어긋나는 문서를 새로 만드는 셈이다.
  - 제안: (a) 나머지 14개 라우트의 서비스 메서드에도 실제 비-HTTP 호출자가 있는지 전수 확인해 C-1(e) 의 "서비스 계층 검사는 남는다" 일반 서술 범위를 실측에 맞게 좁히거나, (b) 최소한 `admin_required` 한 건에 한해서는 "방어선으로 남는다" 대신 "구현 시 도달 불가 잔존 분기(dead branch) — 제거 여부는 별도 판단" 으로 정정하고, D절 구현 요구에 이 분기의 정리(cleanup) 여부를 명시적으로 추가한다.

## 검토 관점별 요약

1. **명명 규약** — 신설 코드 `EDITOR_REQUIRED`/기존 `ADMIN_REQUIRED`·`OWNER_REQUIRED`·`NOT_A_MEMBER` 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명으로 `error-codes.md §1` 을 준수한다. 신설 데코레이터 `@WorkspaceParam('<name>')` 도 기존 `@WorkspaceId()` 계열과 형태가 일관된다. 위반 없음.
2. **출력 포맷 규약** — 가드 거부 코드를 전 경로에 일괄 부여하는 결정은 `error-codes.md §1`(의미 기반) 과 상충하지 않으며, 비멤버 응답을 `NOT_A_MEMBER` 로 통일하는 근거(§Rationale "비멤버 코드를 하나로")도 자체적으로 breaking-change 영향(비멤버 10곳의 코드 변경, "그 화면에 도달하지 않는다")을 분석해 뒀다. 위반 없음. 다만 위 두 WARNING 이 세부 문구 정확성에 걸린다.
3. **문서 구조 규약** — 각 spec 파일에 대한 patch 는 기존 `Rationale «title (date)»` 누적 패턴을 그대로 따르고, `spec_impact` frontmatter 는 실재하는 6개 spec 경로의 리스트(Gate C 형식)로 정상 구성됐다. 위반 없음.
4. **API 문서 규약** — `swagger.md §1-7`(DTO 명명), `§5-4`(체크리스트) 패턴을 그대로 확장하는 방식이나, §5-4 관련 WARNING 1건 발견.
5. **금지 항목** — `@Param` 직접 바인딩을 저장소 가드로 금지하는 D-4 항목은 기존 정적 가드 문화(`dto-class-name-collision` 등)와 동형이라 오히려 규약 취지에 부합한다. `error-codes.md §2`("이름 정확성 향상만을 위한 rename 금지")에 저촉되는 사례는 없음 — `forbidden`→`ADMIN_REQUIRED` 전환은 가드 우선순위 변경이라는 실질적 사유가 있다.

## 요약

이 spec draft 는 conventions 문서의 정확한 절 번호·기존 표기 패턴(Rationale 날짜 태그, historical-artifact 등재 형식, 체크리스트 항목 구조)을 매우 충실히 재사용하고 있어 형식적 정합성은 높다. 다만 실측으로 두 지점에서 세부 어긋남을 확인했다 — (1) swagger.md 체크리스트 패치가 조건절만 고치고 근거 설명문을 갱신하지 않아 편집 후 내적 불일치가 남고, (2) error-codes.md §3 에 추가하려는 "HTTP 밖 호출자 방어선" 서술이 실제 호출 그래프(grep 으로 확인한 4개 호출부 전부 controller-only)와 맞지 않아 §3 의 "active 코드" 전제를 깨뜨릴 위험이 있다. 두 건 모두 draft 단계에서 문구 조정으로 해소 가능한 수준이며, 명명·출력 포맷·문서 구조·금지 항목 축에서는 CRITICAL 급 위반을 찾지 못했다.

## 위험도
LOW
