# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 범위와 한계

- 번들에 포함된 target 파일: `spec/5-system/1-auth.md`, `2-api-convention.md`,
  `3-error-handling.md`. 교차 참조로 `spec/0-overview.md`·`spec/1-data-model.md` 포함.
- 컨텍스트 예산 초과로 `spec/5-system/` 하위 15개 파일(4-execution-engine·6-websocket-protocol·
  12-webhook·14-external-interaction-api 등)은 프롬프트에 본문이 없었다 — 부재를 "문제 없음"의
  근거로 삼지 않았다. 필요한 범위는 저장소에서 직접 `Read` 로 열어 `2-navigation/9-user-profile.md`·
  `2-navigation/6-config.md` 의 관련 절(§4.2 역할 매트릭스, §A.4 Reveal 권한)을 대조했고, 두 문서
  모두 `1-auth.md §3.2` RBAC 매트릭스(Auth Config Owner/Admin=CRUD, Editor/Viewer=R)와 정합했다 —
  새 충돌 없음.
- 현재 worktree 의 실제 작업(`plan/in-progress/auth-guard-reflection-hardening.md`)은
  `spec_impact: none` — `RolesGuard`/`@WorkspaceId()` 데코레이터의 Reflector 사용 경화(fail-open
  방지·메모이제이션·UUID 검증)로, spec 문서 변경을 수반하지 않는 순수 코드 경화다. §2.2/§3.3(1-auth.md)·
  §2.3(2-api-convention.md)의 header-first·워크스페이스 클레임 정책 서술은 구현 메커니즘(Reflector
  private API 의존 여부)에 대해 중립적이라 계획된 작업과 직접 충돌하는 지점은 없다.

## 발견사항

- **[WARNING]** §2.3 "동시 세션" 정책이 데이터 모델에 대응 필드가 없고 구현 흔적도 없음
  - target 위치: `spec/5-system/1-auth.md` §2.3 세션 정책 표, "동시 세션 | 기본 5개 (관리자 설정 가능)" /
    "초과 시 | 가장 오래된 세션 자동 종료" 행
  - 충돌 대상: `spec/1-data-model.md` §2.1 User, §2.2 Workspace(`settings` JSONB 의 알려진 키 목록 —
    `timezone`·`interactionAllowedOrigins`·`maxConcurrentExecutions` 만 열거, 세션 개수 상한 키 없음),
    §2.18.1 RefreshToken(세션 cap·eviction 관련 필드 없음)
  - 상세: "관리자 설정 가능"이라는 서술은 워크스페이스(또는 시스템) 단위로 편집 가능한 설정값의 존재를
    암시하지만, `Workspace.settings` 의 알려진 키 목록에 해당 키가 없고 User/RefreshToken 어디에도
    상한을 저장하는 필드가 없다. 코드베이스에도 동시 세션 상한·오래된 세션 자동 종료(eviction) 로직이
    없다(`grep` 결과 0건 — `family_id` 관련 서비스 코드 전체에 limit/max/5 매칭 없음). 이 문서의 다른
    미구현 항목(§1.3 LDAP/SAML, §3.3 `maxInterval` 클램프 등)은 전부 "(Planned)"·"미구현" 으로 명시
    마킹되어 있는데, 이 행만 그 컨벤션 없이 이미 구현된 것처럼 서술돼 있어 인접 행들과 격이 다르다.
    `git blame` 상 이 행은 최초 PRD 초안 커밋(`05089d5a6`, 2026-03-26) 이후 한 번도 수정되지 않았다 —
    같은 파일의 다른 절이 수십 차례의 후속 정합화 pass(#882/#887/#893, refactor 04 후속 등)를 거친 것과
    대조적으로, 이 행만 검토망에서 누락된 것으로 보인다.
  - 제안: (a) 실제로 미구현이면 다른 항목과 동일하게 "(Planned · 미구현)" 마킹 + 추적 plan 연결,
    또는 (b) 실제로 구현 대상이라면 `Workspace.settings`(또는 신규 User/Workspace 필드)에 상한 키를
    추가하고 `1-data-model.md`를 동기화. 어느 쪽이든 현재 상태로 "이미 동작하는 관리자 설정 가능 정책"
    처럼 읽히는 서술은 impl-prep 단계에서 구현자에게 잘못된 기대를 줄 수 있어 정정이 필요하다.
    (본 worktree 의 계획된 작업(guard reflection 경화)과는 직접 연관 없음 — 별도 후속으로 분리 권장)

- **[INFO]** `WORKSPACE_ID_REQUIRED` 에러 설명이 `activeWorkspaceId` rename 이전 표현을 그대로 사용
  - target 위치: `spec/5-system/3-error-handling.md` §1.3, `WORKSPACE_ID_REQUIRED` 행
    ("워크스페이스 컨텍스트 부재 — `X-Workspace-Id` 헤더와 JWT `workspaceId` 둘 다 없음")
  - 충돌 대상: 같은 target 번들의 `1-auth.md` §2.2("활성 워크스페이스 클레임 = `activeWorkspaceId`"), §3.3;
    `2-api-convention.md` §2.3(워크스페이스 스코핑 — 토큰 클레임은 `activeWorkspaceId`, 레거시
    `workspaceId` 는 dual-read 폴백으로만 언급)
  - 상세: `1-auth.md`/`2-api-convention.md` 는 `spec-sync-data-flow-12-workspace-gaps` 결정으로 JWT
    클레임명을 `workspaceId` → `activeWorkspaceId` 로 rename 했고 `activeWorkspaceId ?? workspaceId`
    dual-read 만 legacy 호환으로 남겼다고 명시한다. 반면 `3-error-handling.md` 의 `WORKSPACE_ID_REQUIRED`
    설명은 여전히 "JWT `workspaceId`" 라는 rename 이전 클레임명을 단독으로 지칭해, 같은 target 번들
    안에서 필드명 표기가 갈린다. 기능적으로는 dual-read 로 커버되어 즉시 오작동을 일으키진 않지만,
    새로 이 코드를 읽는 구현자가 "JWT 에 `workspaceId` 라는 클레임이 있다"고 오해할 여지가 있다.
  - 제안: `WORKSPACE_ID_REQUIRED` 설명을 "`X-Workspace-Id` 헤더와 JWT `activeWorkspaceId`(dual-read
    레거시 `workspaceId` 포함) 둘 다 없음" 형태로 §2.2/§2.3 표기와 동기화.

## 요약

`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 는 이미 다수의 과거
consistency-check 라운드(#882/#887/#893, refactor 04 후속, `retry-turn` P1 CRITICAL #1 등)를 거쳐
RBAC 매트릭스·에러 코드 카탈로그·워크스페이스 클레임 모델이 `1-data-model.md`·`0-overview.md` 및
(직접 대조한) `2-navigation/9-user-profile.md`·`6-config.md` 와 폭넓게 정합화된 상태다. 이번 pass 에서
새로 발견한 것은 CRITICAL 급 모순이 아니라 (1) 오랫동안 검토망에서 빠져 있던 것으로 보이는 §2.3 동시
세션 정책의 데이터 모델 미비(WARNING), (2) `activeWorkspaceId` rename 이 `3-error-handling.md` 한
군데에 반영되지 않은 표기 drift(INFO) 뿐이다. 현재 worktree 의 실제 작업(`spec_impact: none` 인 guard
reflection 경화)은 spec 서술과 직접 충돌하지 않는다. 다만 컨텍스트 예산으로 생략된 `spec/5-system/`
15개 파일(webhook·execution-engine·EIA 등)은 이번 pass 의 커버리지 밖이라는 점은 남겨둔다.

## 위험도

LOW
