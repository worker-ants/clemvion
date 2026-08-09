# Rationale 연속성 검토 — spec/5-system/ (--impl-prep, auth-guard-reflection-hardening)

## 컨텍스트

target 은 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 번들 + 다수 spec 문서의
`## Rationale` 발췌다. 이 --impl-prep 착수 대상은 `plan/in-progress/auth-guard-reflection-hardening.md`
(코드 전용, `spec_impact: none`) — `RolesGuard`/`WorkspaceId` 데코레이터의 reflection 의존성 경화·
비-UUID 헤더 400 화 작업이다. bundle 자체(3개 파일 본문 vs 각자 Rationale, 그리고 교차 인용된 타 문서
Rationale)는 상호 모순 없이 자기정합적이다 — 기존에 정정된 항목(§3.2 멤버 관리 CRUD, §2.3.D 재인증 정합화,
§4.1.A 감사 액션 시제 등)이 본문에 이미 반영돼 있다. 따라서 아래 발견사항은 "target 문서 자체의 기존 모순"이
아니라, **이 bundle 이 가드하는 도메인에서 곧 시행될 작업(plan)이 spec/데이터플로우 Rationale 이 이미 확정한
결정과 충돌할 위험**에 초점을 맞춘다 (--impl-prep 의 취지 — 착수 전에 잡는다).

## 발견사항

- **[WARNING]** Reflector 전환 옵션이 "기각된 opt-in 라우트별 부착" 패턴을 재도입할 위험
  - target 위치: `plan/in-progress/auth-guard-reflection-hardening.md` §1 두 번째 체크박스
    ("또는 공식 확장점 전환 — `SetMetadata` + `Reflector` 로 옮겨 비공개 API 의존 제거. 다만
    `@WorkspaceId()` 사용처 **전부에 마커를 달아야 해** 표면이 넓다 — 캐너리보다 비싸다")
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale` → `### 멤버십 검증은 가드 1곳에서 —
    @Roles() 와 무관 (2026-08-08)` 의 "**기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착**: opt-in
    모델의 연장이라 74번째 라우트에서 같은 누락이 재발한다(이미 최소 2회 발생)." (본 파일은 --impl-prep
    번들에는 포함되지 않았으나, `codebase/backend/src/common/guards/roles.guard.ts` 의 클래스 docstring이
    이 절을 SoT 로 명시 인용하고 있어 직접 열람해 대조함)
  - 상세: 현재 구현(`handlerConsumesWorkspaceId`)은 `@WorkspaceId()` **파라미터 데코레이터가 이미 붙어
    있는 라우트를 reflection 으로 자동 판별**한다 — 사람이 별도로 기억해 붙여야 하는 두 번째 마커가 없다.
    plan 의 "공식 확장점 전환" 옵션은 문면 그대로라면 `@WorkspaceId()` 사용처마다 **추가 마커**를 달아야
    한다고 스스로 적고 있다. 이는 정확히 `data-flow/12-workspace.md` 가 "opt-in 모델의 연장 → 다음
    라우트에서 재발" 이라는 이유로 명시 기각한 패턴과 같은 구조다(신규 라우트 작성자가 `@WorkspaceId()`
    는 붙이면서 새 `SetMetadata` 마커는 잊는 시나리오가 그대로 재현됨 — 이미 2회 발생한 실패 모드의
    3번째 반복이 될 수 있다). W1 의 첫 번째 옵션(부트타임 캐너리)은 이 위험이 없다 — 기존 마커 없는
    reflection 의 정확성만 검증하고 opt-in 표면을 추가하지 않는다.
  - 제안: "공식 확장점 전환"을 선택하게 되면, `SetMetadata` 호출을 **`WorkspaceId()` 파라미터 데코레이터
    팩토리 자체 안에 합성**해 기존 호출부가 아무 것도 추가로 달지 않아도 되게 구현해야 한다(신규 라우트도
    `@WorkspaceId()` 하나만 붙이면 자동으로 마커까지 따라오는 형태). 별도 마커가 실제로 필요한 설계라면
    `data-flow/12-workspace.md` 의 기각 근거를 재검토하는 새 Rationale 항목이 필요하다 — 없이 진행하면
    "결정의 무근거 번복"에 해당한다. 캐너리 옵션(W1-a) 단독 채택이 이 위험을 가장 깔끔히 피한다.

- **[WARNING]** 비-UUID `X-Workspace-Id` 400 화 시 `WORKSPACE_ID_REQUIRED` 재사용 위험
  - target 위치: `spec/5-system/3-error-handling.md` §1.3 `WORKSPACE_ID_REQUIRED` 행 / `plan/in-progress/
    auth-guard-reflection-hardening.md` §3 ("`extractWorkspaceId`/`resolveRequestWorkspaceContext` 단에서
    UUID 형식 검증 → 기존 `WORKSPACE_ID_REQUIRED` 와 같은 400 계열로 조기 거부")
  - 과거 결정 출처: 동일 target 문서 §1.3 자체 정의("워크스페이스 컨텍스트 **부재** — `X-Workspace-Id`
    헤더와 JWT `workspaceId` **둘 다 없음**") + `2-api-convention.md` `## Rationale` "413
    `PAYLOAD_TOO_LARGE`(전역) — 도메인 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 공존" 항의 명시 원칙("일반
    신규 코드는 전역 코드를 쓰고 도메인 특화 한도가 있을 때만 별도 코드를 신설")
  - 상세: `WORKSPACE_ID_REQUIRED` 는 target 문서가 스스로 "헤더·클레임 둘 다 부재" 로 좁게 정의해 놓은
    코드다. plan 이 다루는 케이스는 "헤더가 **present** 하지만 형식이 잘못됨"으로, 정의상 다른 조건이다.
    같은 코드를 그대로 재사용하면 코드명(`REQUIRED`=부재를 함의)과 실제 트리거 조건(malformed-but-present)
    이 어긋나 target 문서 자신이 여러 곳에서 강조하는 "의미 기반 명명" 관행(§1.2.1 말미 "#882/#887
    완결성 pass"·§1.9 note 의 "동일 의미·별개 wire 코드" 구분 등)과 충돌한다. 또한 "일반 신규 코드는
    전역 코드 재사용" 원칙을 적용하면, 형식 오류는 `WORKSPACE_ID_REQUIRED`(워크스페이스 도메인 특화)
    보다 API 규약 §5.3 의 완전 제네릭 기본값 `VALIDATION_ERROR`(400)가 더 정합적인 선택지다.
  - 제안: 구현 시 (a) 제네릭 `VALIDATION_ERROR` 를 재사용하거나, (b) 정말 `WORKSPACE_ID_REQUIRED` 를
    재사용하고 싶다면 그 정의를 "부재 **또는** 형식 오류"로 넓히는 한 줄 스펙 정정 + 그 확장을 설명하는
    Rationale 항목을 `3-error-handling.md`에 추가한다. 어느 쪽이든 코드를 정하고 나면 `error-handling.md`
    §1.3 행 문구를 실제 조건에 맞게 갱신해야 한다(현재 "둘 다 없음"만 남으면 spec-코드 drift 재발).

- **[INFO]** 부트타임 캐너리(W1-a)가 boot-fail-closed 라면 기존 "Production fail-closed 가드" 문서화
  관행과의 정합 여부를 명시적으로 결정할 것
  - target 위치: `spec/5-system/1-auth.md` §2.1 note("`JWT_SECRET` production fail-closed") +
    `## Rationale` → "Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP" / 대응:
    `plan/in-progress/auth-guard-reflection-hardening.md` §1 첫 번째 체크박스("부팅 시 … assert. 거짓이면
    부팅 실패")
  - 과거 결정 출처: 위 target Rationale 항목 — "env 만으로 부팅 직전 판정 가능한 절대-금지 항목만 포함하며,
    DI·요청 컨텍스트가 필요하거나 … 정당 용도가 있는 항목은 의도적으로 분리한다", "dev/test/e2e
    (`NODE_ENV≠production`)는 영향이 없다"
  - 상세: target 문서는 "부팅 거부"급 fail-closed 가드가 도입될 때마다 그 존재를 spec 본문 + Rationale에
    명시적으로 남기는 관행을 이미 5개 항목(JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL·
    OAUTH_STUB_MODE·LLM_STUB_MODE)에 대해 지키고 있고, 그 스코프를 "NODE_ENV=production 한정"으로
    명시적으로 좁혀 dev 편의를 지켰다. W1-a 캐너리는 이 5개와 다른 카테고리(env 값이 아니라 라우트
    reflection의 구조적 불변식)이므로 같은 `assertProductionConfig` 블록에 합치는 것은 그 블록이 이미
    선언한 스코프("env 만으로 판정 가능한 절대-금지 항목")를 흐린다 — 별도 캐너리로 두는 것이 맞다(plan도
    이를 별도 항목으로 두어 이 점에서는 정합적). 다만 (1) 이 캐너리가 프로덕션에서도 부팅을 막을 수
    있는지, dev/test 에도 적용되는지, (2) 프로덕션 부팅 실패라는 운영상 가시적 동작인데도
    `spec_impact: none` 으로 남기는 게 맞는지는 plan 에 미결로 남아 있다.
  - 제안: 캐너리를 `assertProductionConfig` 단일 블록에 합치지 말 것(별도 부트 단계 유지). 프로덕션에서도
    부팅 실패를 일으킬 수 있다면 최소 PR 설명/CHANGELOG 에 그 사실을 명시하고, 필요하면
    `1-auth.md` §2.1 note 옆에 한 줄만 추가해 기존 5개 항목과 같은 수준의 가시성을 맞출지 판단할 것
    (구조적 code invariant 라 스펙 문서화 자체가 불필요하다는 반대 결론도 방어 가능 — 결정만 명시하면 됨).

- **[INFO]** 실제 SoT Rationale(`spec/data-flow/12-workspace.md`)이 --impl-prep 번들에서 누락
  - target 위치: 번들 전체 (`spec/5-system/1-auth.md` §2.2·§2.3·§3.3·`2-api-convention.md` §2.3 이 모두
    `data-flow/12-workspace.md §1.5`를 인용하지만, 그 문서의 `## Rationale` 은 번들에 포함되지 않음)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` `## Rationale`("활성 워크스페이스 = 토큰 클레임"·
    "멤버십 검증은 가드 1곳에서"·"URL slug = FE 라우팅 SoT") — `RolesGuard`/`WorkspaceId` 데코레이터
    코드 docstring 이 이 문서를 명시적 SoT 로 인용한다.
  - 상세: 직접 열람해 대조한 결과 plan 의 방향(캐너리·비-UUID 400화)은 이 문서의 "기각된 대안"·불변식과
    충돌하지 않는다(위 두 WARNING 을 제외하면). 다만 guard/reflection 관련 --impl-prep 요청은
    `spec/5-system/` 스코프만으로는 실제 SoT 를 놓친다 — 이번처럼 checker 가 직접 파일을 열어 보완하지
    않으면 이 카테고리의 Rationale 연속성 검사가 구조적으로 눈가림될 수 있다.
  - 제안: `1-auth.md §2.2/§2.3/§3.3` 또는 `2-api-convention.md §2.3` 을 다루는 --impl-prep 요청에는
    `spec/data-flow/12-workspace.md` 를 번들에 함께 포함하도록 orchestrator 번들링 규칙 보강을 고려할 것.

## 요약

target 번들(spec/5-system/1-auth.md·2-api-convention.md·3-error-handling.md) 자체는 각자·상호 참조된
Rationale 과 자기정합적이며 기각된 결정의 재도입은 발견되지 않았다. 위험은 target 이 아니라 이 스코프에서
곧 착수될 `auth-guard-reflection-hardening` plan 에 있다 — 특히 "공식 확장점 전환" 옵션이 문면 그대로
구현되면 `data-flow/12-workspace.md` 가 2026-08-08 에 명시 기각한 "라우트별 opt-in 마커 부착" 패턴을
3번째로 재현할 실질적 위험이 있고(WARNING), 비-UUID 헤더 처리에서 `WORKSPACE_ID_REQUIRED` 를 정의와 다른
조건에 재사용하면 target 문서 자신의 명명 원칙과 충돌한다(WARNING). 두 항목 모두 구현 방식을 좁혀서
선택하면 회피 가능한 예방적 지적이지, 이미 벌어진 위반은 아니다.

## 위험도

MEDIUM
