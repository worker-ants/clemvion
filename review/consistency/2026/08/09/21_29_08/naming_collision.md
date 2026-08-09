# 신규 식별자 충돌 검토 — spec-draft-secret-store-verification-footnote.md

## 검토 대상 요약

target 은 `spec/conventions/secret-store.md` §2.1 `†` 각주의 마지막 문단(“알려진 검증 공백”)을
“검증은 두 층으로 갈라 고정한다” 문단으로 **교체**하는 순수 정정이다. 새 요구사항 ID, 엔티티/DTO,
API endpoint, 이벤트명, 환경변수, spec 파일을 하나도 신설하지 않는다 — 기존 `secret-store.md` 파일
안의 산문 한 단락 치환뿐이다.

## 관점별 확인

1. **요구사항 ID 충돌** — 신규 ID 없음. `secret-store.md` frontmatter `id: secret-store` 도
   불변. 해당 없음.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. `SecretResolver` 인터페이스는 기존
   그대로이며 target 이 건드리지 않는다. 해당 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 해당 없음.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/sse 이벤트 없음. 해당 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/설정키 없음. 해당 없음.
6. **파일 경로 충돌** — target plan 파일 `plan/in-progress/spec-draft-secret-store-verification-footnote.md`
   는 기존 `plan/complete/chat-channel-secret-store-infra.md` 와 이름이 겹치지 않고, `plan/`
   명명 컨벤션(`spec-draft-*`)도 따른다. target 이 수정하는 대상은 기존 파일
   `spec/conventions/secret-store.md` 이며 신규 spec 파일을 만들지 않는다. 해당 없음.
   target 이 증거로 인용하는 두 테스트 파일도 이미 존재한다(신규 경로 아님):
   - `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts` (실존 확인)
   - `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` (실존 확인)

## 발견사항

- **[INFO]** 교체 대상 문단의 옛 텍스트가 자매 in-progress plan 에 남아있음(엄밀한 “신규 식별자
  충돌”은 아님 — 참고용으로만 기록)
  - target 신규 식별자: (해당 없음 — target 은 식별자를 신설하지 않음)
  - 기존 사용처: `plan/in-progress/spec-draft-auth-invariants-sync.md:345-347` 이 “**알려진 검증
    공백**” 문단의 변형(“…본 각주가 유일한 기록이다” 문구는 없고 대신
    `backend-lint-gate-broken-on-main.md §후속` 링크가 붙은 버전)을 여전히 인용하고 있다.
  - 상세: 이는 이름/식별자 충돌이 아니라 **동일 문구를 인용하는 문서가 target 교체 후에도 stale
    상태로 남는** 문서 정합성 이슈다. target 의 체크리스트 항목 “side-effect — 이 각주를 인용하는
    다른 spec 이 없는지 확인”이 `spec/` 만 명시하는데, 실제로는 `plan/in-progress/` 문서 하나가
    옛 문단을 인용 중이다. `plan/` 문서는 이력 성격이라 정정 의무는 없지만, 다음 사람이 이 plan 을
    읽고 “아직 검증 공백이 있다”고 오인할 여지는 있다.
  - 제안: 필수 조치는 아님(범위: `spec/conventions/secret-store.md` 자체만 교체하면 target 목적은
    달성됨). 원하면 `spec-draft-auth-invariants-sync.md` 완료 처리 시 해당 인용문 옆에 “§1113 이후
    `spec-draft-secret-store-verification-footnote.md` 로 대체됨” 각주를 덧붙이는 정도로 충분— 새
    식별자 이름 변경은 불필요.

다른 5개 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수·파일 경로)에서는
발견사항 없음(target 이 어떤 신규 식별자도 도입하지 않으므로 충돌 표면 자체가 없음).

## 요약

target 은 기존 각주 문단을 교체하는 순수 편집이며 새 요구사항 ID·엔티티/타입·API endpoint·이벤트명·
환경변수·spec 파일 경로를 전혀 신설하지 않는다. 따라서 “신규 식별자 충돌” 관점에서 CRITICAL/WARNING
급 충돌은 존재하지 않는다. 유일한 관찰 사항은 자매 in-progress plan(`spec-draft-auth-invariants-sync.md`)
에 남은 옛 문단 인용인데, 이는 식별자 충돌이 아니라 문서 정합성(stale 인용) 성격이라 정보성으로만
기록한다.

## 위험도

NONE
