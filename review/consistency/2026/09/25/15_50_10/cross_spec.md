# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-workspace-path-guard-followup.md`

## 검토 방법

번들이 컨텍스트 예산으로 대상 spec 본문 다수(`spec/5-system/1-auth.md`, `spec/conventions/swagger.md`,
`spec/conventions/error-codes.md`, `spec/data-flow/12-workspace.md` 포함)를 절단했으므로, harness 가 지목한
8개 파일을 전부 절대경로로 직접 `Read` 해 draft 의 "전/후" 인용과 대조했다. 추가로 `git show e2e257707 --stat` /
`git log --follow` 로 선행 spec 커밋의 실제 diff 범위를 확인하고, 저장소의 신설 가드 파일 존재 여부를 `find` 로
실측했다.

## 발견사항

- **[WARNING]** 같은 decision 의 세 번째 전파 누락 — `spec/5-system/2-api-convention.md` §2.3 이 여전히 "모든 리소스 API" 로 단언
  - target 위치: 변경 1 (`spec/2-navigation/9-user-profile.md` §3) — "backend 인가 모델은 **불변**: header-first → 토큰 클레임" 문장에 경로 파라미터 예외를 추가하는 부분
  - 충돌 대상: `spec/5-system/2-api-convention.md` §2.3 "워크스페이스 스코핑" (실측 line 82) — "**모든 리소스 API는** 현재 워크스페이스 컨텍스트에서 동작한다... **전환기 하위호환 — header-first**: `X-Workspace-Id` 헤더가 있으면... 우선 사용하고, 헤더가 없으면 토큰 클레임을 사용한다."
  - 상세: draft 의 Rationale 은 "왜 이 넷을 한 턴에 묶나 — 전부 `e2e257707` 이 착지시킨 결정의 **전파 누락**" 이라 명시한다. 그런데 같은 결정(경로 파라미터 워크스페이스 라우트는 header-first/토큰-클레임이 아니라 **경로 값 자체가 인가 대상**)을 반복 서술하는 지점이 draft 가 잡은 두 곳(`9-user-profile.md` §3, `1-auth.md` §부트 캐너리 (b)) 외에 **한 곳 더** 있다 — `2-api-convention.md` §2.3 이다. 이 절은 "모든 리소스 API" 라는 전칭으로 header-first→토큰-클레임 모델을 서술하며, 2026-09-25 이후 경로 파라미터 워크스페이스 라우트 15곳(`/api/workspaces/:id/...` · `POST /api/auth/workspaces/:id/switch`)에는 이 모델이 적용되지 않는다는 사실을 반영하지 않는다. `git show e2e257707 -- spec/5-system/2-api-convention.md` 로 실측한 결과, 이 커밋이 이 파일을 건드리긴 했으나 §5.3 에러 코드 기본값 문단(`RolesGuard` 거부 코드 등재)만 고쳤고 §2.3 본문은 그대로다. §2.3 은 자신을 "SoT 는 `data-flow/12-workspace.md §1.5`" 로 가리키는데, §1.5 는 토큰 재발급 흐름만 다루고 새 예외(«경로 파라미터 워크스페이스도 가드가 본다», 다른 Rationale 섹션)는 다루지 않아 참조가 새 결정에 착지하지 않는다.
  - 제안: 이 draft 의 변경 1 과 동일한 패턴(각주 추가, 원문 보존)으로 `2-api-convention.md` §2.3 에도 "단, 경로 파라미터로 워크스페이스를 받는 라우트는 예외다" 각주를 보태거나, 최소한 이 draft 의 `spec_impact` 에 `spec/5-system/2-api-convention.md` 를 추가해 같은 턴에서 처리할지 명시적으로 defer 할지 결정한다. (`spec/5-system/2-api-convention.md` 전체·`spec/2-navigation/9-user-profile.md` §3·`spec/data-flow/12-workspace.md` §Rationale "경로 파라미터 워크스페이스도 가드가 본다" 대조로 확인.)

## 그 외 검증 결과 (충돌 없음 확인)

아래는 draft 의 핵심 주장을 실제 spec 파일 직접 Read 로 대조한 결과이며, 전부 정합했다(참고용으로 남긴다 — 발견사항 아님):

- 변경 1 의 "전" 인용문은 `spec/2-navigation/9-user-profile.md:159` 원문과 정확히 일치(파일 내 유일 occurrence, 중복 없음).
- 변경 2 의 "전" 인용문은 `spec/5-system/1-auth.md:830-831` 원문과 정확히 일치. §부트 캐너리 (a) 는 이미 `e2e257707` 이 `@WorkspaceParam(...)` 판별을 반영했으나 (b) 는 아직 미반영 — draft 설명과 실측이 일치.
- 인용 anchor `data-flow/12-workspace.md#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25` 는 실제 heading(`### 경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)`, line 354)과 슬러그가 일치.
- 변경 3 의 세 가드 미등재 주장(`grep -rln` 0건)을 저장소 전체 spec 대상으로 재현 — 0건 확인. 세 가드 파일(`workspace-param-binding{.spec,-guard}.ts`, `param-uuid-pipe{.spec,-guard}.ts`, fixture 디렉터리, `workspace-roles-attachment.spec.ts`)도 실제 존재 확인.
- `data-flow/*.md` 16개 파일 전부 frontmatter(`code:`) 미보유 — Change 3 이 가드를 `data-flow/12-workspace.md` 가 아니라 `5-system/1-auth.md`/`conventions/swagger.md` 에 등재하려는 선택은 저장소 관례와 일치.
- `spec/conventions/swagger.md` 현재 frontmatter `code:` 에 `param-uuid-pipe*` 미포함, §5-4(line 493) `@ApiParam({format:'uuid'})` 참조와 draft 인용 일치.
- `spec/conventions/error-codes.md` §3 의 초대 코드 행에 이미 "(2026-09-25 `forbidden` 을 이 행에서 뺐다 — 발행처가 없었다)" 문구가 존재 — 변경 4 가 §5 머리말에 남기려는 선례 서술과 사실관계 일치.
- `spec/5-system/3-error-handling.md` 의 `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 카탈로그는 `data-flow/12-workspace.md` §Rationale "가드 거부의 오류 코드" 표와 코드·HTTP status 일치.
- `spec/2-navigation/_layout.md`·`0-dashboard.md`·`10-auth-flow.md` 도 "URL slug = FE 라우팅 SoT" 를 언급하지만, 이들은 전부 9-user-profile §3 를 SoT 로 **가리키기만** 하고 backend 인가 불변 문장을 **반복 서술하지 않는다** — 따라서 이 셋은 변경 1 의 동반 갱신 대상이 아니다(위 WARNING 대상인 `2-api-convention.md` 와 달리 서술을 복제하지 않음).

## 요약

Draft 는 `e2e257707`(선행 spec 커밋)이 착지시킨 "경로 파라미터 워크스페이스 가드" 결정의 전파 누락 셋 + INFO 하나를 정정하는 소규모 후속 패치이며, 인용된 "전/후" 문구·anchor·가드 파일 존재 여부를 모두 실제 저장소 상태와 직접 대조한 결과 전부 정합했다. 다만 draft 자신이 내세운 "전파 누락을 닫는다" 는 목적 기준으로 볼 때, 같은 backend 인가 모델(header-first→토큰 클레임)을 전칭("모든 리소스 API")으로 서술하면서 새 경로 파라미터 예외를 아직 반영하지 않은 지점이 `spec/5-system/2-api-convention.md` §2.3 에 하나 더 남아 있다 — draft 의 스코프(4개 파일)에 없는 네 번째 위치다. CRITICAL 급 모순은 없으며, 이 WARNING 은 draft 를 이번 턴에 넓히거나 명시적으로 defer 하면 해소된다.

## 위험도

LOW
