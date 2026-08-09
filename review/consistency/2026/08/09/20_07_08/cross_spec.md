# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-auth-invariants-sync.md`

## 검토 방식

target 은 5개 spec 파일(`5-system/3-error-handling.md` §1.3, `5-system/15-chat-channel.md` §5.4,
`5-system/1-auth.md` frontmatter+Rationale, `data-flow/12-workspace.md` Rationale,
`conventions/secret-store.md` §2.1)에 대한 diff 묶음이다. 번들에 이 5개 파일의 현재 본문이
포함돼 있지 않아, 저장소의 실제 현재 spec 본문과 관련 backend 소스(`roles.guard.ts`,
`workspace-context.util.ts`, `uuid.ts`, `secret-resolver.service.ts`, `workspaces.controller.ts`,
`triggers.controller.ts`, `main.ts`)를 직접 읽어 diff 의 `-`/`+` 컨텍스트가 실제 파일과
일치하는지, 그리고 인용하는 타 영역 spec(§Rationale 앵커·근거)과 모순이 없는지 대조했다.

## 발견사항

- **[INFO]** 항목 4 삽입 위치 서술 "Rationale 말미" 가 부정확
  - target 위치: §4 "신설 subsection (`12-workspace.md` `## Rationale` 말미, `### URL slug = FE
    라우팅 SoT` 다음)"
  - 충돌 대상: `spec/data-flow/12-workspace.md` 실제 구조 — `### URL slug = FE 라우팅 SoT` 다음에
    `### workspace.deleted 감사 제외` · `### workspace_invitation.email 일치 강제` ·
    `### 명칭 통일 범위` · `### personal 워크스페이스 유일성` 4개 subsection 이 **더** 있고 그
    다음이 파일(및 Rationale) 끝이다.
  - 상세: "말미"(끝)라고 썼지만 실제 삽입 지점은 Rationale 의 중간이다. "URL slug 다음" 이라는
    앵커 자체는 정확해 실제 적용은 문제없지만, 서술이 스스로 모순돼(끝이라 하면서 뒤에 4개
    섹션이 남는다) 적용자가 진짜 파일 말미로 잘못 삽입할 여지가 있다. 항목 5(`1-auth.md`)의
    같은 패턴 서술 "`### Production fail-closed 가드 …` 바로 다음" 은 실측대로 정확하다(그
    subsection 바로 다음이 `### 4.1.A`) — 대조적으로 항목 4만 부정확하다.
  - 제안: "Rationale 말미" → "`### URL slug = FE 라우팅 SoT` 바로 다음(이후에도 4개 subsection 이
    더 있음)" 로 정정. 내용·앵커 자체는 변경 불요.

- **[WARNING]** 항목 4 "ParseUUIDPipe 19곳" 실측 수치 오류
  - target 위치: §4 "경로 파라미터 쪽 실측: `workspaces.controller.ts` 에 `new ParseUUIDPipe()`
    **19곳**." (신설 Rationale subsection 본문에도 동일 수치가 들어간다: "`ParseUUIDPipe`
    (`workspaces.controller.ts`, 19곳)")
  - 충돌 대상: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 실제 코드
  - 상세: `grep -n "new ParseUUIDPipe()" workspaces.controller.ts` 실행 결과 실제 사용 지점은
    **18곳**(라인 131,158,192,216,237,267,290,316,342,343,369,370,390,430,477,478,512,513)이다.
    `grep -c "ParseUUIDPipe"`(문자열 매치, 19)에는 import 문(`ParseUUIDPipe,` 8행)이 섞여 1개
    더 세어진 것으로 보인다 — import 는 사용 지점이 아니다. 이 수치는 새로 신설되는
    `data-flow/12-workspace.md ## Rationale` 의 "UUID 검증 강도 비대칭" subsection 에 근거
    표(evidence)로 박히고, 항목 1 의 새 `VALIDATION_ERROR` 행이 그 subsection 을 canonical 로
    인용한다 — 즉 부정확한 수치가 cross-reference 사슬의 근거 지점에 고정된다. 이 저장소가
    반복적으로 지적해 온 "실측 주장은 실제로 실측해야 한다" 클래스의 결함과 같은 성격이다.
  - 제안: 병합 전 "19곳" → "18곳"으로 정정(두 발생 지점 모두 — §4 본문과 신설 Rationale
    subsection). 결정 자체(비대칭은 의도)·근거(403→400 뒤바뀜)는 영향 없음.

- **[INFO]** 검증 완료 — 그 외 diff 컨텍스트·상호 참조는 전부 실측과 일치
  - 확인한 항목: (1) `3-error-handling.md` §1.3 표 현재 행(76/78행) 이 diff `-` 라인과 정확히
    일치, (2) `15-chat-channel.md` §5.4 표 현재 행(358행)이 diff `-` 라인과 일치하고
    `rotate-bot-token` 라우트에 `@Roles('editor')`+`@WorkspaceId()` 둘 다 실재(코드 확인),
    (3) `1-auth.md` frontmatter `code:` 글로브 현재 목록(4~10행)이 diff 와 일치하고
    `common/decorators/*.ts`·`workspace-context.util.ts`·`uuid.ts` 를 이미 `code:` 로 선언한
    다른 spec 은 없음(신규 클레임 충돌 없음), (4) `roles.guard.ts` 실제 구현이 draft 가
    서술하는 "handlerConsumesWorkspaceId 단축 통과 → resolveRequestWorkspaceContext 호출
    이전에 return true" 로직과 정확히 일치, (5) `uuid.ts`/`workspace-context.util.ts` 의
    `isUuidShaped` vs `isValidUuid` 비대칭 서술이 실제 정규식·throw 로직과 일치, (6)
    `secret-resolver.service.ts` `deleteByPrefix` 의 `secret://` 접두사 검사 + `/[%_\\]/`
    거부 로직이 항목 6 diff·각주와 정확히 일치, (7) `spec-code-paths.test.ts` 의
    `codes.some((c) => globMatchesAny(c, root))` 서술이 실제 assertion 과 일치, (8)
    `data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서" 기존 서술("코드 없는
    403", 73건 실측 등)이 새 3분기 노트와 모순 없이 정합, (9) `main.ts` 가
    `assertProductionConfig` 와 `assertWorkspaceIdReflectionWorks` 를 별도 단계로 호출하는
    실제 코드가 항목 5 서술과 일치. RBAC/상태 전이/요구사항 ID 축에서는 새로 발행되는 요구사항
    ID 가 없고, 기존 `NOT_A_MEMBER`(워크스페이스 전환 전용 코드)와 신설 "코드 없는 403"
    (RolesGuard 일반 경로) 은 서로 다른 endpoint/메커니즘이라 모순 없이 공존한다.

## 요약

target 은 이미 결정·구현·머지된 5건의 auth 관련 불변식을 spec 에 사후 기록하는 순수 문서
동기화 PR이며, 새 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 결정을 도입하지 않는다.
diff 의 `-`/`+` 컨텍스트를 5개 대상 spec 파일의 실제 현재 본문과 대조하고, 서술의 핵심 기술
주장(가드 단축 통과 순서, UUID 검증 비대칭, `deleteByPrefix` 거부 로직, CI 글로브 매칭 허점,
라우트 데코레이터 실재 여부)을 대응 backend 소스와 대조한 결과 전부 일치했다 — CRITICAL 급
cross-spec 모순은 없다. 두 건의 비차단 정확성 이슈만 발견했다: (1) 항목 4 삽입 위치 서술의
자기모순("말미"인데 실제로는 4개 subsection 이 뒤에 남음, 내용에는 영향 없음), (2) 신설
Rationale 에 박히는 "ParseUUIDPipe 19곳" 수치가 실측(18곳)과 어긋나며 이 수치는 다른 두 항목이
canonical 로 인용하는 근거 블록에 위치해 있어 병합 전 정정이 바람직하다.

## 위험도

LOW
