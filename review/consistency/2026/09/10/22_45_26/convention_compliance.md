# 정식 규약 준수 검토 — `spec/5-system/15-chat-channel.md` (`--impl-prep`, 재검토)

검토 대상: `spec/5-system/15-chat-channel.md` §5.4.1 / §5.4.1.1 / R-CC-10 / R-CC-21 (planner PR
`df1962e25` #1311 + telegram carve-out `c0f2a885c` #1313). 직전 라운드(`21_37_56`)가 cross_spec
CRITICAL(telegram server-issued signing 과의 정면 모순)로 BLOCK 됐고, planner 턴이 그 CRITICAL 을
해소한 뒤의 재검토다. convention_compliance 축은 그 직전 라운드에서도 이미 NONE 이었으므로, 본
라운드는 (1) 새로 추가된 telegram carve-out 문면이 `spec/conventions/**` 을 새로 어기지 않는지,
(2) 직전 라운드가 남긴 INFO 2건의 현재 상태를 확인한다.

## 0. 검토 방법

- bundle 프롬프트는 이번에도 `spec/conventions/**` 전 파일(`chat-channel-adapter.md`·
  `secret-store.md`·`error-codes.md`·`audit-actions.md`·`review-citations.md`·`swagger.md` 등)을
  예산 초과로 절단했다 — 저장소 원본을 직접 `Read`/`grep` 해 대조했다(기존에 알려진 `--spec`
  기본 예산의 절단 패턴, 신규 발견 아님).
- `git show c0f2a885c --stat` 로 이번 라운드가 검토하는 diff 의 실제 파일 목록을 확인 —
  `spec/5-system/15-chat-channel.md` 외에 `spec/2-navigation/2-trigger-list.md` ·
  `spec/data-flow/14-chat-channel.md` 도 같은 커밋에서 동반 갱신됐다(교차 정합은 cross_spec 소관,
  여기서는 target 범위인 5-system 파일에 집중).
- 새로 추가된 caveat/표 행이 인용하는 규약 어휘(`server-issued`/`provider-issued`)·필드명
  (`issuedInboundSigning`)이 실제로 `conventions/chat-channel-adapter.md`·`conventions/secret-store.md`·
  `providers/telegram.md`·`triggers.service.spec.ts` 에 존재하는지 `grep` 으로 실측(창작 어휘 여부 확인).
- 리뷰 인용(`review/consistency/2026/09/10/22_04_23` 등)이 가리키는 세션 디렉터리가 실제로
  `git ls-tree`/워킹트리에 존재하는지 확인.

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** `details.field` 가 두 SoT 표 모두에서 여전히 미확정 placeholder
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 3행(`botToken` plaintext 차단)·
    §5.4.1.1 3행(`inboundSigningPlaintext`/`inboundSigning` 차단)
  - 위반 규약: 없음 — 규약 위반이 아니라 미이행 상태를 추적하는 항목. 관련 규약은
    [`2-api-convention.md §5.3`](../../../../../spec/5-system/2-api-convention.md#53-에러-응답)
    (에러 형태는 그 엔드포인트를 문서화하는 절에 명시)
  - 상세: 직전 라운드(`21_37_56`)에서 이미 INFO 로 지적됐고 telegram carve-out PR(`c0f2a885c`)은
    이 두 자리를 건드리지 않았다 — 상태 변화 없음. `3-error-handling.md §2.1` 의 "계획(Planned)"
    유예 선례가 있어 구현 착수를 막을 사유는 아니다.
  - 제안: plan 체크리스트의 "`details.field` 실제 페이로드 캡처" 항목대로 e2e 구현 후 신규
    2필드뿐 아니라 기존 3필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)까지 함께
    캡처한다(직전 SUMMARY 참고 INFO#2 와 동일 제안 — 아직 미집행이라 반복 기록).

## 확인된 것 — telegram carve-out 이 신규로 어긴 규약 없음

- **어휘 재사용, 창작 아님**: caveat 이 쓰는 `server-issued`/`provider-issued` 축은
  `conventions/secret-store.md:353-370`·`conventions/chat-channel-adapter.md:289,352,358` 에 이미
  존재하는 어휘다. R-CC-10/R-CC-21 이 "새 어휘를 만든 것이 아니라 그 구분이 PATCH 정책에도
  걸린다는 것을 적는다"고 스스로 명시한 서술이 실측과 일치한다.
- **필드명 정확성**: `issuedInboundSigning` 은 `providers/telegram.md:58,219` 의
  `SetupResult.issuedInboundSigning`, `conventions/chat-channel-adapter.md:347,361` 의 타입 필드,
  `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 의 실제 테스트 fixture 와
  정확히 일치 — spec 이 존재하지 않는 필드를 인용하지 않는다.
- **Rationale ID 컨벤션 준수**: telegram carve-out 은 새 결정이 아니라 R-CC-10/R-CC-21 의
  스코프를 좁히는 정정이라 신규 `R-CC-22` 를 만들지 않고 기존 항목 안에 날짜(2026-09-10) 를
  단 caveat 블록·표 행으로 붙였다 — 이 문서가 기존에 쓰던 자기-정정 패턴(예: CCH-MP-06 의
  `~~output.rendered~~` 취소선 정정, §5.4.1.1 의 "2026-09-10 정합화" blockquote)과 같은 형식이라
  "Rationale ID 컨벤션" 절의 "본 절 신규 항목만 R-CC-N" 원칙과 충돌하지 않는다.
  (`developer` 자기-반증형 소정정 5조건은 여기 해당 없음 — 이 편집은 planner 턴이 spec 을
  정정하는 정상 경로다.)
- **리뷰 인용 규약 준수 — 직전 INFO 해소**: 직전 라운드(`21_37_56`)가 "R-CC-21 「기각한 대안」
  인용에 세션 경로가 없다"고 지적했던 INFO 가 이번 diff 에서 해소됐다. 새 「기각한 대안」 소절이
  `review/consistency/2026/09/10/22_04_23` · `review/consistency/2026/09/10/22_14_27` 전체 경로를
  명시했고, 두 경로 모두 `git ls-tree`/워킹트리에 실재한다 — `conventions/review-citations.md §2`
  가 "권장"으로 꼽는 "전체 경로" 형태(`review/code/2026/09/04/23_02_51` 예시와 동형)를 정확히
  따른다. bare `hh_mm_ss` 가 아니므로 §2 금지 대상도 아니다.
- **문서 구조 (Overview/본문/Rationale 3섹션)**: 신규 caveat·표 행은 모두 기존 `## Rationale`
  섹션 안, 기존 R-CC-10/R-CC-21 항목 내부에 삽입돼 헤딩 계층·소속을 유지한다. 새 최상위 섹션을
  만들지 않았다.
- **에러 봉투·감사 액션·secret ref·swagger writeOnly**: 이번 diff 는 이 축들을 건드리지 않는다
  (§5.4/§5.4.2/§5.5 응답 계약·DTO 데코레이터 서술 무변경) — 직전 라운드가 확인한 NONE 상태가
  그대로 유지된다.
- **naming_collision 축과의 접점(참고, 본 checker 범위 밖)**: 직전 SUMMARY 의 WARNING(`
  ChatChannelPatchConfigDto` 의 `Patch` 접두 도입)은 plan 문서(`plan/in-progress/
  impl-chat-channel-patch-token.md` D-1)가 이미 `ChatChannelUpdateConfigDto` (Patch 접두 배제,
  근거 명시)로 갱신해 반영했다. 이 이름 자체는 target(`spec/5-system/15-chat-channel.md`) 본문에
  등장하지 않으므로 spec 문서 축의 재확인 대상은 아니다 — naming_collision checker 가 plan/코드
  축에서 재확인할 사안.

## 요약

telegram server-issued signing carve-out(`c0f2a885c`, R-CC-10/R-CC-21/§5.4.1.1 갱신)은
`spec/conventions/**` 의 어떤 축도 새로 위반하지 않는다. caveat 이 인용하는
`server-issued`/`provider-issued` 어휘와 `issuedInboundSigning` 필드명은 기존 컨벤션·구현과
정확히 일치하는 재사용이고, 새 Rationale 항목 번호를 만들지 않고 기존 R-CC 항목 안에서 날짜 붙은
정정으로 처리한 것도 이 문서의 기존 패턴과 정합한다. 직전 라운드(`21_37_56`)가 남긴 INFO 2건 중
리뷰 인용 경로 누락은 이번 diff 로 해소됐고, `details.field` 미확정 placeholder 는 상태 변화 없이
여전히 열려 있다(이미 plan 체크리스트가 추적 중이라 신규 차단 사유 아님). CRITICAL/WARNING 없음 —
구현 착수를 막을 conventions 위반은 없다.

## 위험도

NONE
