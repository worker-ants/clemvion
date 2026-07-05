# 정식 규약 준수 검토 — convention_compliance

## 검토 대상

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- 실제 diff(HEAD vs origin/main) 근거로 확인한 변경:
  - `spec/5-system/1-auth.md` — frontmatter `code:` 3건 추가, §1.5.3 에 "경로·진입" 안내 문단 추가
  - `spec/2-navigation/10-auth-flow.md` — §2 흐름 표 앞에 "이미 로그인한 사용자의 진입 분기" 안내 문단 추가
  - `codebase/frontend/src/components/auth/register-form.tsx` — `has_session` 힌트 쿠키 감지 후 `/invitations/accept` 로 redirect 하는 `useEffect` 추가
  - `codebase/frontend/src/lib/i18n/dict/{ko,en}/invitations.ts` — `mismatchTitle`/`mismatchHint`/`logoutAndSwitch` 3개 키 추가
  - `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — V-09 체크박스 완료 처리(plan bookkeeping, spec/conventions 범위 밖)
- 프롬프트 페이로드에 인라인된 `spec/conventions/` 문서는 `audit-actions.md` 와 `cafe24-api-catalog/*` 뿐이었고, 본 변경과 직접 관련된 `error-codes.md`·`node-output.md`·`spec-impl-evidence.md` 는 포인터로만 언급되어 있어 실제 파일(`/Volumes/.../invite-accept-confirm-ui-c51e95/spec/conventions/*.md`)을 절대경로로 직접 읽어 대조했다.

## 발견사항

### INFO — historical-artifact 예외 인용이 규약 SoT 와 정확히 일치
- target 위치: `spec/5-system/1-auth.md` §1.5.4 하단 "명명 — historical-artifact 예외" 문단 (변경 범위 밖이지만 본 PR 의 §1.5.3 인접 수정과 함께 재확인)
- 위반 규약: 해당 없음 (준수 확인)
- 상세: `error-codes.md §3` historical-artifact 레지스트리의 초대 흐름 lowercase 코드 항목(`invitation_not_found` 등, `forbidden`/`rate_limited` 의 "초대 API 한정" 각주 포함)과 `1-auth.md` 의 인용 문구가 표현까지 정확히 대응한다. 새로 추가된 §1.5.3 "경로·진입" 문단도 이 규약을 재선언하거나 어기지 않고 순수하게 라우팅 설명만 추가했다.
- 제안: 없음. 이번 PR 의 범위에서 이 부분은 grep 크로스체크 결과 이상 없음을 확인하는 차원의 기록.

### INFO — `has_session` 힌트 쿠키 재사용은 기존 명명을 그대로 따름
- target 위치: `codebase/frontend/src/components/auth/register-form.tsx` 신규 `useEffect` (line ~104-124), `codebase/frontend/src/app/(main)/invitations/accept/accept-invitation-content.tsx` `handleLogout`
- 위반 규약: 해당 없음
- 상세: `has_session` 쿠키명·목적(`spec/2-navigation/10-auth-flow.md §7` "인증 상태 관리")은 이번 PR 이전부터 존재하는 기존 규약이다. 신규 코드는 이 쿠키를 **읽기만** 하고 새 이름을 발명하지 않았으며, `logout()` 이 쿠키를 지운다는 기존 계약도 재사용했다. 새 SoT 문단(`10-auth-flow.md §2` 삽입부)이 `§7` 을 앵커 링크로 정확히 참조해 중복 정의를 피했다.
- 제안: 없음.

### INFO — i18n 키 명명·구조 컨벤션 준수
- target 위치: `codebase/frontend/src/lib/i18n/dict/ko/invitations.ts`, `.../en/invitations.ts`
- 위반 규약: 해당 없음 — 명시적 `spec/conventions/i18n-userguide.md` 는 사용자 가이드 evidence 규약이라 본 UI 문자열 키에는 직접 적용되지 않지만, 프로젝트 관례(camelCase, `ko` 를 구조적 SoT 로 삼아 `Dict["invitations"]` 타입을 `WidenString<typeof ko>` 로 유도)를 확인했다.
- 상세: 신규 키 `mismatchTitle`/`mismatchHint`/`logoutAndSwitch` 는 기존 형제 키(`missingHint`, `goDashboard`, `statusAccepting`)와 동일한 camelCase 규칙을 따르고, `ko`·`en` 양쪽에 동시 추가되어 `dict/types.ts` 의 구조적 타입(`ko` 가 SoT) 계약을 깨지 않는다.
- 제안: 없음.

### INFO — `code:` frontmatter 중복 글롭 (경미)
- target 위치: `spec/5-system/1-auth.md` frontmatter (`codebase/frontend/src/components/auth/register-form.tsx`, `codebase/frontend/src/lib/api/invitations.ts` 추가)
- 위반 규약: `spec/conventions/spec-impl-evidence.md` — 명시적 금지 조항은 없음 (직접 위반 아님)
- 상세: `register-form.tsx` 와 `invitations.ts` 는 `spec/2-navigation/10-auth-flow.md` 의 기존 glob(`codebase/frontend/src/components/auth/**`, 그리고 `invitations.ts` 명시적 나열)에도 이미 포함된다. 두 spec 문서가 같은 구현 파일을 `code:` 로 중복 소유하는 것은 spec-impl-evidence.md 에 명시적으로 금지되어 있지 않고, 프로젝트 내 "관점이 다른 두 문서가 같은 코드를 가리키는" 선례(예: `1-auth.md` 가 세션/감사만, config CRUD 표는 `6-config.md` SoT 로 포인터 위임하는 방식과 유사한 책임분리 패턴)와도 결이 맞는다. 다만 evidence 스캐너가 "이 파일은 어느 spec 이 커버하는가"를 판정할 때 다중 매치가 흔해지면 장기적으로 커버리지 리포트의 노이즈가 될 수 있다.
- 제안: 규약 위반은 아니므로 조치 불필요. 다만 향후 `spec-coverage` 감사에서 다중 매치 파일이 늘어나면, "코드 파일당 대표 SoT 스펙 1개 + 보조 참조는 텍스트 포인터로" 원칙을 `spec-impl-evidence.md` 에 명문화하는 것을 고려할 수 있음(정보 제공 수준의 제안, 이번 PR 액션 아님).

## 요약

이번 PR(`invite-accept-confirm-ui`, V-09)의 실질 변경은 `register-form.tsx` 의 리다이렉트 훅, `accept-invitation-content.tsx` 의 이메일 불일치 UI, 그리고 대응하는 i18n 키·spec 문서 갱신(`1-auth.md` §1.5.3, `10-auth-flow.md` §2)이다. 명명 규약(`has_session` 쿠키 재사용, camelCase i18n 키), 출력 포맷 규약(에러 코드·API 응답 변경 없음), 문서 구조 규약(Overview/본문/Rationale 기존 골격 유지, 신규 문단은 기존 섹션 내 삽입), API 문서 규약(Swagger/DTO 변경 없음 — 순수 프론트엔드 라우팅) 어느 축에서도 `spec/conventions/**` 위반을 발견하지 못했다. 특히 §1.5.4 하단의 historical-artifact 예외 인용은 `error-codes.md §3` 레지스트리와 문구까지 정확히 대응해 정합성이 확인됐다. 유일하게 언급할 만한 점은 `1-auth.md` frontmatter 의 `code:` 글롭이 `10-auth-flow.md` 와 부분적으로 겹치는 것인데, 이는 규약이 명시적으로 금지하지 않는 경미한 구조적 포인트로 CRITICAL/WARNING 대상이 아니다.

## 위험도

NONE
