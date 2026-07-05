# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

검토 대상: `spec/5-system/1-auth.md`(§1.5 초대 토큰 흐름 중심, invite-accept-confirm-ui 작업 관련), `spec/5-system/10-graph-rag.md`(같은 배치에 포함된 target, 참고용)
대조 규약: `spec/conventions/audit-actions.md`(번들 전문), 실제 저장소의 `spec/conventions/error-codes.md`·`spec/conventions/node-output.md`·`spec/5-system/2-api-convention.md`(번들에는 미포함이었으나 target 이 직접 참조하므로 원본을 대조 확인)

## 발견사항

- **[INFO]** 초대 재발송 엔드포인트가 3단계 중첩이나 RPC-style 예외 목록에 명시적으로 포함되지 않음
  - target 위치: `spec/5-system/1-auth.md` §5 API 엔드포인트 (§1.5 초대 흐름 관련, `spec/2-navigation/9-user-profile.md` §6.1 에 정의된 `POST /api/workspaces/:id/invitations/:invitationId/resend`)
  - 위반 규약: `spec/5-system/2-api-convention.md §2.2` 명명 규칙 — "중첩은 2단계까지", "3단계 이상은 최상위로 분리". 예외 목록은 `rotate-*`/`revoke-*`/`disable-*` 등 sub-channel 부작용 동사를 명시하나 `resend` 는 나열돼 있지 않음
  - 상세: `/api/workspaces/:id/invitations/:invitationId/resend` 는 resource(`workspaces`) → sub-resource(`invitations`) → id → 동작(`resend`) 으로 3단계 중첩이다. 코드(`workspaces.controller.ts:449`)에도 이미 이 형태로 구현돼 있어 기존 패턴이며, 이번 invite-accept-confirm-ui 작업이 신규로 도입하는 경로는 아니다. 다만 §2.2 예외 목록이 열거식이라 `resend` 가 그 목록에 없다는 점에서 표면적으로는 규약 문면과 어긋나 보인다.
  - 제안: 코드 변경은 불필요(이미 정착된 API, breaking 비용이 규약 정합성 이득을 초과). 대신 `2-api-convention.md §2.2` 예외 목록에 `resend`(또는 "부작용 없는 사이드이펙트 재실행 동사" 일반 조항)를 추가해 문서상 사각지대를 없애는 편이 낫다 — 이는 규약 쪽 갱신이 적절한 케이스.

- **[INFO]** 초대 흐름 lowercase 에러 코드는 이미 정식 예외로 등재되어 있음(규약 위반 아님, 확인 결과 보고)
  - target 위치: `spec/5-system/1-auth.md §1.5.4` 에러 응답 표 (`invitation_not_found`/`invitation_expired`/`invitation_already_used`/`invitation_email_mismatch`/`forbidden`/`rate_limited`)
  - 대조 규약: `spec/conventions/error-codes.md §3` historical-artifact 예외 레지스트리
  - 상세: 이 lowercase 코드들은 얼핏 `error-codes.md §1`(의미 기반 명명)·`node-output.md §3.2`(`UPPER_SNAKE_CASE`)를 위반하는 것처럼 보이지만, `error-codes.md §3` 레지스트리에 "초대 API 한정" 예외로 이미 명시 등재돼 있고 1-auth.md §1.5.4 하단의 각주도 그 레지스트리를 정확히 인용한다. 두 문서가 상호 참조로 정합적이다.
  - 제안: 조치 불필요. invite-accept-confirm-ui 프론트엔드 구현 시 이 코드들을 `INVITATION_ERROR_CODES`(`codebase/frontend/src/lib/api/invitations.ts`)와 동일하게 lowercase 그대로 분기해야 하며, 새로 만드는 코드에 이 lowercase 표기를 선례로 삼지 않아야 한다(규약 §3 명시 조항과 1-auth.md 각주가 이미 이 점을 경고하고 있어 구현자가 놓치기 어려운 구조).

- **[INFO]** `GET /api/invitations/:token` 응답 포맷 — api-convention §5.1 단일 리소스 envelope 과 일치
  - target 위치: `spec/5-system/1-auth.md §1.5.2` 흐름 3번째 줄 ("응답: `{ workspaceName, invitedByName, email, expiresAt, role }`")
  - 상세: 표기가 논리 payload(`TransformInterceptor` 래핑 전)만 보여주고 있어 `{ enabled: boolean }`(§1.4.3 `/webauthn/availability`)처럼 "논리 payload 표기로 통일한다"는 명시적 주석이 없다. 다만 문맥상 §5.1 관례(단일 리소스는 `{ data: {...} }`로 래핑)를 따를 것이 자명하고, 다른 유사 GET 엔드포인트(§1.4.3)는 이 점을 명시하고 있어 표기 스타일에 약간의 비일관성이 있다.
  - 제안: `§1.5.2` 흐름 표기에도 §1.4.3 과 동일하게 "wire 에서는 `{ data: {...} }` 로 래핑" 각주를 추가하면 문서 간 일관성이 개선된다(사소한 INFO 수준).

## 요약

이번 --impl-prep 검토 대상인 `spec/5-system/1-auth.md`(§1.5 초대 토큰 흐름 — invite-accept-confirm-ui 작업과 직접 관련)와 `spec/5-system/10-graph-rag.md` 는 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 급 위반이 발견되지 않았다. 문서 구조(Overview/본문/Rationale 3섹션), 감사 액션 명명(`audit-actions.md` 규약과 §4.1/Rationale 4.1.A 의 정합), 에러 코드 명명·historical-artifact 예외 처리(`error-codes.md §3` 와 1-auth.md §1.5.4 의 상호 참조)가 모두 정합적으로 유지되고 있다. API 엔드포인트 중첩 단계(§2.2)에 대해 초대 재발송 엔드포인트가 예외 목록에 명시되지 않은 사소한 문면상 사각지대가 있으나, 이는 기존에 이미 구현·정착된 경로라 코드/spec 변경보다는 규약 문서 쪽의 예외 목록 보완이 적절하다. invite-accept-confirm-ui 작업 착수 시 참고할 lowercase 에러 코드(§1.5.4)는 이미 정식 예외로 등재돼 있으므로 프론트엔드 구현에서 그대로 소비하면 되고, 신규 코드 작성 시에는 이 lowercase 표기를 선례로 삼지 않아야 한다는 점만 유의하면 된다.

## 위험도

NONE
