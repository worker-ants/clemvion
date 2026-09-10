# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-chat-channel-drift-3.md`

## 검토 범위 재확인

target 문서는 **신규 개념·엔티티·엔드포인트를 도입하지 않는다** — 이미 구현(PR `#1314`)이 실측으로
확정한 두 가지 사실(`details.field` 형태, `store()`/`rotate()` 실제 호출)을 SoT 문면에 뒤늦게
반영하는 **정정(correction)** 작업이다. 그래서 6개 관점 중 다수(요구사항 ID 신설·엔티티/DTO 신설·
신규 endpoint·이벤트명·ENV/설정키·신규 파일 경로)는 해당 사항이 원천적으로 없다. 아래는 그럼에도
실측으로 확인한 결과와, 식별자 충돌에 인접한 두 가지 발견이다.

## 관점별 실측 결과

1. **요구사항 ID 충돌** — target 은 새 ID 를 부여하지 않는다. `R-CC-21`, `R-12`, `CCH-SE-03` 등은
   전부 기존 ID 를 인용만 한다. **해당 없음**.
2. **엔티티/타입명 충돌** — `SecretResolver.rotate()` / `.store()` 는 둘 다 `conventions/secret-store.md
   §2` 의 기존 interface 정의에 이미 존재하는 메서드다(`interface SecretResolver { store(...); rotate(...); resolve(...); }`
   — `secret-store.md:124-132`). target 의 D-3 는 새 이름을 만드는 것이 아니라 **이미 그 문서 자신이
   §2.1 표에서 "rotate() 권장" 이라 적어 둔 규약**에 나머지 9~10곳의 표기를 맞추는 정정이다. 실측
   결과 개수 claim 도 정확했다 — `spec/` 전체에서 `(SecretResolver|secrets|this.secrets).store` 패턴은
   **정확히 10줄**이다(괄호 호출형 7 + 괄호 없는 산문형 3: `15-chat-channel.md:200`,
   `chat-channel-adapter.md:359`, `slack.md:278`). 충돌 없음, claim 검증됨.
3. **API endpoint 충돌** — 신규 endpoint 없음. `POST /api/triggers/:id/chat-channel/rotate-bot-token`
   등은 기존 endpoint 재인용뿐.
4. **이벤트/메시지명 충돌** — 해당 없음.
5. **환경변수·설정키 충돌** — 해당 없음.
6. **파일 경로 충돌** — target 자신(`plan/in-progress/spec-draft-chat-channel-drift-3.md`)은 기존
   `spec-draft-*` 명명 컨벤션(`spec-draft-nullable-notation-followups.md`, `spec-draft-eia-*.md`)을
   따르고, `spec/` 변경 대상도 전부 기존 파일의 기존 라인 수정이다. 신규 파일 없음. 충돌 없음.

## 발견사항

- **[INFO]** `details.field='chatChannel'` / `details.field='provider'` 는 실제로 그 값을 emit 한다 — 재확인만
  - target 신규 사용: D-2 의 신규 400 두 분기(`details.field='chatChannel'`, `details.field='provider'`)
  - 근거: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3160`(`field: 'chatChannel'`), `:3298`(`field: 'provider'`)
  - 상세: 두 필드명 모두 같은 문서 안에서 이미 **다른 의미로 확립된 필드**다 —
    `config.chatChannel.provider`(어댑터 식별자, `15-chat-channel.md:199`)와 PATCH body 의
    top-level 키 `chatChannel`(`2-trigger-list.md:176`). target 이 이 두 필드명을 `details.field` 값으로
    재사용하는 것은 **같은 필드를 가리키는 동일 의미**이지 다른 의미의 충돌이 아니다. 실제 테스트
    코드가 정확히 이 두 값을 등재하므로 claim 은 사실과 부합한다.
  - 제안: 없음 — 확인 완료.

- **[WARNING]** §5.4.1 표 신규 두 행의 제목이 기존 행과 근접해 혼동 가능
  - target 신규 식별자(표 행 레이블): "`chatChannel` 이 없는 트리거에 PATCH 로 처음 붙이려 함" (A3 신규 행)
  - 기존 사용처: `spec/5-system/15-chat-channel.md:373` 기존 행 "최초 트리거 생성 (`POST /api/triggers`)"
  - 상세: 기존 표는 이미 "최초"라는 단어를 **POST 생성 시점의 최초 설정**에 쓰고 있다
    (`373`행, `390`행 모두 "최초 트리거 생성"). target 이 추가하려는 신규 행은 그와 다른 시점 —
    **트리거가 이미 존재하는 상태에서 PATCH 로 처음 `chatChannel` 을 붙이려는 시도(차단)** 다.
    두 "최초"가 같은 표 안에 나란히 있으면 독자가 "최초 트리거 생성" 행과 "최초 부착 시도" 행을
    같은 시점을 가리키는 것으로 오독하기 쉽다 — 전자는 성공(설정 완료), 후자는 차단(400)으로
    결과가 정반대다.
  - 제안: 신규 행 레이블에서 "최초" 대신 "**사후(post-hoc) PATCH 로 부착 시도**" 또는
    "**`chatChannel` 미설정 트리거에 PATCH 로 신규 부착**" 처럼 POST 생성 행과 시각적으로
    구분되는 표현을 쓴다. D-2/A3 적용 시 이 표현을 반영할 것.

- **[INFO]** 동일 결정이 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기존 열린 항목과
  겹친다 — target 체크리스트의 "트래커 3항목 종결" 이 대상을 명시하지 않는다
  - target 신규 식별자: 없음(신규 식별자는 아님) — 다만 **동일한 결정/조사 결과가 이미 다른 plan
    파일에 등재돼 있다**는 점에서 식별자 충돌 검토의 인접 리스크로 기록한다.
  - 기존 사용처:
    - `plan/in-progress/spec-draft-nullable-notation-followups.md:2034-2071` — "§5.4.1·§5.4.1.1 의
      `details.field` 문면이 실제 페이로드와 다를 수 있다" (2026-09-11 실측 완료, "남은 것은 planner 의
      문면 정정뿐" 로 이미 결론까지 남아 있음 — target 의 D-1/D-4 와 동일 결정)
    - 같은 파일 `:2137-2166` — "spec 9곳이 `SecretResolver.store()` 라 적는데 실제 호출은 전부
      `rotate()` 다" + 하위 각주에 "신규 검증 분기 2건(`details.field='chatChannel'`·`='provider'`)이
      §5.4.1 표와 `2-trigger-list.md` PATCH 에러 표에 미등재" (target 의 D-2/D-3 와 동일 결정,
      대상 라인 목록까지 동일)
  - 상세: target 은 자기 체크리스트에 "트래커 3항목 종결"(`plan/in-progress/spec-draft-chat-channel-drift-3.md`
    체크리스트 4번째 항목)이라 적어 위 항목들을 닫을 의도가 있음을 시사하나, **어느 파일의 어느
    항목인지 본문 어디에도 명시적으로 cross-link 하지 않는다**. `spec-draft-nullable-notation-followups.md`
    는 `132,397`자에 달하는 대형 트래커라 대상 항목을 줄 번호/제목으로 못박지 않으면, 이 plan 이
    `plan/complete/` 로 이동한 뒤 nullable-notation-followups.md 쪽 항목이 **미체크(`- [ ]`) 상태로
    고아화**될 위험이 크다(이 저장소가 반복 겪은 실패 패턴 — 체크박스 동기화 누락).
  - 제안: 마무리 커밋 전 `spec-draft-nullable-notation-followups.md:2034`, `:2137-2166` 두 항목을
    찾아 `- [x]` 로 전환하고 "closed by `spec-draft-chat-channel-drift-3.md` (PR #1314 후속)" 근거를
    남긴다. target 본문의 "트래커 3항목 종결" 문구도 이 두 파일 앵커를 명시하도록 보강 권장.

## 요약

target 문서는 신규 식별자를 도입하지 않는 순수 정정 작업이며, 검토 결과 요구사항 ID·엔티티/타입명·
API endpoint·이벤트명·환경변수·파일 경로 6개 관점 모두에서 **기존 식별자와의 의미 충돌은 발견되지
않았다**. `store()`→`rotate()` 정정은 이미 확립된 canonical 규약(`secret-store.md §2.1`)에 표기를
맞추는 것이고, `details.field='chatChannel'`/`='provider'` 는 실제 테스트 증거와 일치하는 기존 필드명의
정합적 재사용이다. 다만 (1) 신규 §5.4.1 표 행 레이블이 기존 "최초 트리거 생성" 행과 어휘가 겹쳐
독자가 시점을 오독할 위험(WARNING), (2) 동일한 조사 결론이 `spec-draft-nullable-notation-followups.md`
에 이미 상세히 등재돼 있는데 target 이 이를 명시적으로 cross-link/종결하지 않아 plan 트래커가
이중화·고아화될 위험(INFO) 을 확인했다. 둘 다 차단 사유는 아니다.

## 위험도

LOW
