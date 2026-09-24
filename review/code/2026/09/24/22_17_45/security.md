# 보안(Security) 리뷰

## 리뷰 범위 확인

이 PR 은 **테스트/문서 전용 변경**이다 — 프로덕션 코드(`workspaces.service.ts` 등)는 diff 에
포함되어 있지 않다.

- `CHANGELOG.md` — 문서 항목 추가 (신규 텍스트만)
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `removeMember` 판정
  순서(멤버십 → 대상 존재 → self 위임 → admin → owner)의 비어 있던 두 조합을 메우는 단위 테스트
  2건 추가
- `plan/in-progress/remove-member-order-coverage.md` — 신규 plan 문서
- `review/consistency/2026/09/24/22_01_45/**` — `/consistency-check --impl-prep` 산출물(자동 생성,
  BLOCK:NO·Critical 0·Warning 0)

프로덕션 인가 로직(`removeMember` 본체)이 이 diff 로 바뀌지 않으므로, 인젝션·인증/인가 우회·
암호화·의존성 같은 항목에 대해 **새로 만들어진 공격 표면은 없다**.

## 추가된 테스트의 보안적 함의 확인

1. `'비-admin 이 없는 대상을 지목하면 ADMIN_REQUIRED 가 아니라 MEMBER_NOT_FOUND 다'` —
   대상 존재 판정이 admin 판정보다 먼저 실행됨을 고정한다. 테스트 자체의 주석(및 plan §A-1)이
   명시하듯 이 순서는 **보안 불변식이 아니라 문서화된 동작 순서**다 — `listMembers` 가 멤버십만
   요구해 멤버는 이미 워크스페이스의 모든 `memberId` 를 열거할 수 있으므로, 404 대신 403 을 주는
   경로로 바뀌어도 신규 정보 노출은 없다. 이 근거는 실제 소스(`listMembers` 가 `assertMembership`
   만 거치는 것)에 기반한 타당한 주장으로 보이며, 과장이 없다.
2. `'요청자 role 을 한 번만 조회한다'` — `memberRepo.findOne` 호출 중 `where.userId === requesterId`
   모양만 필터링해 정확히 1회임을 단언한다. 쿼리 중복 방지(성능) 목적의 회귀 방지이며 보안과는
   직접 관련이 없다.

두 테스트 모두 mock 기반이고 실제 DB·네트워크·외부 자격증명을 다루지 않는다. 시크릿·PII 를
포함한 fixture 는 없다(`mem-req`, `target-user` 등 합성 식별자만 사용).

## 하드코딩된 시크릿 점검

프롬프트 전체(CHANGELOG 포함, 과거 항목까지)를 `api_key|secret|password|token|bearer|private key`
패턴으로 훑었다. 매칭된 것은 모두 식별자/개념 명칭(`rotateBotToken`, `notification_secret_v2`,
`releaseSecretsAfterCommit`, `hmacSecret` 등 코드/문서 상 고유명사)이며, 실제 키·비밀번호·토큰
값이 리터럴로 박혀 있는 사례는 없었다.

## 그 외 관점

- **인젝션**: 신규 테스트는 SQL/HTML/커맨드를 조립하지 않는다. `wireFindOne` 헬퍼(diff 밖 기존
  코드) 사용만 있다.
- **에러 처리**: 신규 테스트가 검증하는 것은 `code: 'MEMBER_NOT_FOUND'` 여부이며, 응답 payload
  에 내부 스택트레이스·쿼리 등 민감정보를 노출하는 경로는 diff 에 없다.
- **의존성**: 신규 import·패키지 추가 없음.
- **consistency-check 산출물**(파일 4~11)은 리뷰 프로세스 자체의 기록물로, 별도 보안 위험을
  포함하지 않는다(자체적으로도 BLOCK:NO, Critical/Warning 0 보고).

## 뮤테이션 재현에 대한 메모

`plan/in-progress/remove-member-order-coverage.md` §B 는 이 세션 이전에 `cp` 기반 뮤턴트
실측을 이미 완료하고 원복까지 확인했다고 기록되어 있다(별도 세션의 사전 작업). 본 리뷰에서는
저장소 파일에 대한 어떤 뮤테이션도 수행하지 않았고, `git status --short` 로 확인할 필요가 있는
잔여 변경도 만들지 않았다.

## 요약

이번 변경은 프로덕션 코드를 건드리지 않는 순수 단위 테스트 + 문서(CHANGELOG/plan) 추가로, 새로운
인젝션·인증/인가 우회·시크릿 노출·암호화 약화 표면이 없다. 추가된 두 테스트는 `removeMember` 의
기존 판정 순서(이미 배포된 동작)를 회귀로부터 지키는 안전망이며, 테스트 주석이 스스로 "이것은
보안 불변식이 아니라 문서화된 순서"라고 정확히 한계를 명시하고 있어 오도의 소지도 없다. 보안
관점에서 우려할 사항을 찾지 못했다.

## 위험도

NONE
