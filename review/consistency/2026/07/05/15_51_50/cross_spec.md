# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위

- target: `spec/2-navigation/` (--impl-done, diff-base=`origin/main`)
- 초점: 직전 WARNING — `spec/2-navigation/10-auth-flow.md` §2.6 에 "이미 로그인한 사용자" 리다이렉트 분기가 없다는 지적 → §2.6 에 note 추가로 수정됨. 이번 검토는 그 note 가 `spec/5-system/1-auth.md` §1.5.3 과 잔여 drift 없이 정합하는지, 앵커가 정상 해석되는지 검증.

## 발견사항

이번 diff 범위(`git diff origin/main...HEAD`)에서 두 문서가 함께 갱신되었다:

- `spec/2-navigation/10-auth-flow.md` §2.6 — "이미 로그인한 사용자의 진입 분기" blockquote 신규 추가 (표 1~7 앞).
- `spec/5-system/1-auth.md` §1.5.3 — "경로·진입" blockquote 신규 추가 (에러 안내 문구 뒤, §1.5.4 앞) + frontmatter `code:` 목록에 관련 프론트엔드 파일 3건 추가.

두 note 를 대조한 결과:

| 항목 | 10-auth-flow.md §2.6 | 1-auth.md §1.5.3 | 일치 여부 |
|---|---|---|---|
| 트리거 조건 | 이미 로그인한(다른 계정) 사용자가 `/auth/register?invitationToken=…` 클릭 | 동일 | 일치 |
| 리다이렉트 대상 | `/invitations/accept?token=…` | `/invitations/accept?token=<초대토큰>` | 일치 (쿼리 파라미터 `token`) |
| 미로그인 사용자 처리 | "아래 표(1~7)는 로그인하지 않은 미가입자 경로에만 적용" | "미로그인 사용자는 §1.5.2 가입 경로를 따른다" | 일치 (상호 보완적 표현, 모순 없음) |
| 탐지 메커니즘 상세 | `(auth)` 라우트 그룹에 세션 하이드레이션(AuthProvider) 부재 → `has_session` 힌트 쿠키로 판정, stale 시 accept 페이지 라우트 가드가 로그인 화면으로 되돌림 | "register 페이지가 로그인 상태를 감지해" (메커니즘 상세 서술 없음) | 상호 보완 — 모순 아님. 1-auth.md 는 cross-domain 계약 요약(백엔드·프론트 공통 시퀀스), 10-auth-flow.md 는 프론트엔드 구현 메커니즘(라우트 그룹·쿠키) 상세를 담당하는 계층 분담이 기존 문서 관례(다른 섹션에서도 1-auth.md는 서버 계약, 2-navigation은 화면/클라이언트 흐름 담당)와 일치 |
| 상호 참조 앵커 | `[Spec 인증/인가 §1.5.3](../5-system/1-auth.md#153-흐름-이미-가입한-사용자가-다른-워크스페이스에-초대된-경우)` | (역참조 없음 — 1-auth.md 쪽은 10-auth-flow.md 를 되짚어 링크하지 않음, 기존 관례상 §1.5.2 도 마찬가지로 편도 링크) | 편도 링크 관례와 일치, 문제 없음 |

앵커 해석 검증:

- 대상 heading: `spec/5-system/1-auth.md:254` → `#### 1.5.3 흐름 (이미 가입한 사용자가 다른 워크스페이스에 초대된 경우)`
- 생성된 슬러그: `153-흐름-이미-가입한-사용자가-다른-워크스페이스에-초대된-경우`
- 같은 파일 내 기존 통용 앵커 패턴(`#152-흐름-미가입자-가입-경로`, `#142-로그인-시-인증-방식-선택--webauthn-우선-totp-fallback-자동-금지`)과 동일한 규칙(구두점 제거, 공백→하이픈, 괄호 내용 유지)으로 슬러그가 구성되어 정상 해석됨. 앵커 깨짐 없음.
- 역방향 확인: `spec/2-navigation/10-auth-flow.md#7-인증-상태-관리` 앵커도 동일 파일 §7 heading 과 일치 확인(`has_session` 정의 위치, `10-auth-flow.md:438` 부근).

다른 참조처(`9-user-profile.md`, `data-flow/12-workspace.md`)의 `/api/workspaces/invitations/accept` 엔드포인트 서술도 이번 note 와 충돌 없음 — 엔드포인트 경로·트랜잭션 서술 동일.

잔여 drift, 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 충돌, 계층 책임 충돌 — 해당 없음.

## 요약

직전 WARNING 은 완전히 해소되었다. `spec/2-navigation/10-auth-flow.md` §2.6 에 추가된 "이미 로그인한 사용자" 리다이렉트 note 는 `spec/5-system/1-auth.md` §1.5.3 에 동일 diff 로 함께 추가된 대응 note 와 트리거 조건·목적지 경로·미로그인 사용자 처리 범위에서 정확히 일치하며, 세부 구현 메커니즘(`has_session` 힌트 쿠키, AuthProvider 부재)만 10-auth-flow.md 쪽에 추가로 기술되어 있는 것은 두 문서의 기존 책임 분담(5-system=서버·크로스도메인 계약, 2-navigation=클라이언트 화면·구현 메커니즘)과 일치하는 정상적 계층 분리이지 모순이 아니다. §1.5.3 앵커(`#153-흐름-이미-가입한-사용자가-다른-워크스페이스에-초대된-경우`)는 실제 heading 슬러그와 일치해 정상 해석되며, 관련 타 문서(9-user-profile.md, data-flow/12-workspace.md)의 동일 엔드포인트 서술과도 충돌이 없다.

## 위험도

NONE
