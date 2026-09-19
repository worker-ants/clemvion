# 신규 식별자 충돌 검토 — `spec-draft-integration-db-test-waits`

## 검토 대상

target: `plan/in-progress/spec-draft-integration-db-test-waits.md` (`--spec` draft, spec_impact:
`spec/2-navigation/4-integration.md`)

target 이 실제로 제안하는 변경은 두 건뿐이다.

- **A. §5.4 (Database) 테스트 문장** — 「연결 대기는 10초.」를 「연결과 `SELECT 1` 을 각각 10초까지 기다린다 …」로 교체. 새 필드·새
  값·새 코드명 없음 — 기존 문장의 서술 범위만 넓힌다.
- **B. §6 `pending_install` 설명 괄호의 절 번호** — 「§9.3」을 「§9.1」로 정정. 두 절 번호 모두 문서에 **이미 존재**하며, target 은
  가리키는 대상만 바로잡는다.

두 변경 모두 **새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로를 하나도 도입하지 않는다** — 순수 사실
정정(A)과 교차참조 정정(B)이다.

## 검증

- §5.4 원문(490행 부근, 실측 499행)이 target 의 "before" 문구와 정확히 일치함을 `spec/2-navigation/4-integration.md` 에서 직접 확인.
- §6 의 `pending_install` 설명(현재 §9.3 을 가리킴, 706~747행 구간)과 §9.1(805~816행, `POST /api/integrations/:id/test` 행에
  `INTEGRATION_INCOMPLETE` 서술 존재) · §9.3(834행 이하, 사용처·활동 — `pending_install`/`INTEGRATION_INCOMPLETE` 서술 없음)을 대조.
  target 이 정정하려는 방향(§9.3 → §9.1)이 실제 표 위치와 일치함을 확인 — 이는 새 식별자가 아니라 기존 두 섹션 번호 사이의 참조 오류
  교정이다.
- target 의 plan 파일 경로 `plan/in-progress/spec-draft-integration-db-test-waits.md` 는 저장소 전체에서 이번에 새로 생성된
  단 하나의 경로이며(`find` 결과 1건), 기존 `spec-draft-*` 명명 컨벤션(`spec-draft-integration-connection-tests.md` 등)과
  일치한다. 충돌 없음.
- 저장소 전체에서 `SELECT 1` · `query_timeout` · "연결 대기" 관련 표현을 grep 했을 때 target 이 손대는 §5.4 한 줄 외에 다른 정의처가
  없다 — A 가 새 용어를 만드는 것이 아니라 기존 문장 하나를 좁힌 것뿐임을 재확인.

## 발견사항

없음. target 이 새로 도입하는 식별자(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로)가 전혀 없어
6개 점검 관점 중 어느 것도 위반 후보가 나오지 않았다.

## 요약

이 draft 는 같은 브랜치 구현 리뷰가 드러낸 두 가지 기존 spec 문장의 사실 오류를 정정하는 것이 전부다 — Database 연결 테스트 대기 시간
서술을 실제 구현(연결·쿼리 각각 10초)에 맞추고, `pending_install` 설명이 가리키는 절 번호를 표 실제 위치(§9.1)로 고친다. 두 변경 모두
새 식별자를 만들지 않고 기존에 이미 존재하는 문장·섹션 번호만 바로잡으므로, 신규 식별자 충돌 관점에서는 검토할 표면 자체가 없다.

## 위험도

NONE
