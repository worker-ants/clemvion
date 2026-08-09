# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 방법

- target: `spec/5-system/` (전 파일 번들, 21개 파일 + Rationale)
- diff: `origin/main...HEAD` (`codebase/backend/**`) — README 배포 주의 절 재구성, 워크스페이스
  UUID 픽스처 공용 모듈 신설, 캐너리 주석 수치 정정(73→142 + 포함관계 명시), nil-UUID 앵커
  정정(uuid.ts/uuid.spec.ts/workspace-id-fixtures.ts), secret-store LIKE 메타문자 e2e 신설,
  http-request.handler.spec.ts 죽은 mock 스캐폴딩 제거. **spec/ 파일은 이 diff 에 없다.**
- 대조 대상: `plan/in-progress/**` 전체(약 70개), 그중 diff 와 직접 연결된
  `auth-guard-reflection-hardening.md` · `backend-lint-gate-broken-on-main.md` ·
  `spec-draft-auth-invariants-sync.md` 를 전문 확인. 나머지는 diff 내용(auth 가드/워크스페이스
  헤더 검증/secret-store LIKE)과의 교차 여부로 스캔.
- git log 로 이 브랜치의 커밋 5개(`222ce1e30`~`3d2260a04`)와 origin/main 의 선행 커밋
  (`8d84f6e9f` #1103 · `602f677cd` #1112)을 실측해 "이미 머지된 것"과 "이 diff 가 하는 것"을
  구분했다.

## 발견사항

- **[INFO]** `spec/conventions/secret-store.md §2.1` 각주가 이 diff 로 인해 사실과 어긋나게 됐다 — 이미 추적 중, 조치 불요
  - target 위치: 엄밀히는 `spec/5-system/` 밖(`spec/conventions/secret-store.md:91-93`)이라
    본 검토의 직접 대상은 아니지만, 검토 중인 diff 가 만든 결과라 기록한다.
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` §"후속" 의
    `[ ] secret-store.md §2.1 각주의 "알려진 검증 공백" 문단 철회 — planner 권한`
  - 상세: 그 각주는 "in-memory mock 이 `startsWith` 라 LIKE 와일드카드 의미론이 아직 실행
    가능한 테스트로 고정돼 있지 않다"고 적혀 있는데, 이 diff 가 정확히 그 공백을 메우는
    `test/secret-store-like-prefix.e2e-spec.ts`(3건) + 단위 연결점 단언 2건을 신설했다. 따라서
    각주는 이제 **거짓**이다. 다만 이 사실은 developer 권한(`spec/` read-only) 밖이라
    `backend-lint-gate-broken-on-main.md` 가 이미 정확한 위치·정확한 대체 문구 초안까지
    남겨 두고 "planner 권한" 으로 명시적으로 넘겨 둔 상태다 — 프로세스가 이미 올바르게
    작동했다(누락이 아니라 정상적인 role 경계 처리).
  - 제안: 별도 조치 불요. 다음 planner 턴(`spec-draft-auth-invariants-sync.md` 계열의 후속,
    또는 신규 planner PR)에서 그 plan 이 이미 제시한 대체 문구로 각주를 갱신하면 된다.

## 요약

target `spec/5-system/` 은 이 diff 와 정합하며, 미해결 결정을 우회하거나 다른 plan 의
전제를 어기는 지점을 찾지 못했다. diff 자체가 코드/테스트 전용(spec 파일 변경 0건)이고, 이
직전에 머지된 `#1112`(spec 동기화 PR)가 이미 `1-auth.md` §Rationale·`data-flow/12-workspace.md`
§Rationale·`3-error-handling.md` §1.3·`15-chat-channel.md` §5.4 에 이 작업 계열(RolesGuard
reflection 경화·UUID 검증 강도 비대칭·부트 캐너리)의 spec 반영을 전부 마쳐 두었음을
`git log`·현재 spec 본문 대조로 확인했다. 이 diff 가 손대는 캐너리 주석 수치(73→142)·nil-UUID
캐너리 지목 앵커는 spec 쪽에 이미 올바른 값이 실려 있어 stale 이 되지 않는다. 유일하게 남은
파급은 `spec/conventions/secret-store.md` 의 각주 하나(spec/5-system/ 범위 밖)이며, 이는 이미
정확한 plan 항목으로 추적되어 있어 새 위험이 아니다. `plan/in-progress/**` 의 나머지 미해결
결정 항목(node-output-redesign 계열 D4/allSettled envelope, node-cancellation BLOCKED 항목 등)은
이 diff 의 변경 영역(auth/workspace 헤더 검증·secret-store LIKE 이스케이프·http-request 테스트
정리)과 교차하지 않는다.

## 위험도

LOW
