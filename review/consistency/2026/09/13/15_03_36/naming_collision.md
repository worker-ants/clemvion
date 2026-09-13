# 신규 식별자 충돌 검토 — `spec/conventions/` (impl-done)

## 검토 범위 확인

`git diff origin/main...HEAD` 기준 `spec/conventions/` 델타는 **0개 파일**이다 — 이 브랜치는
spec 영역을 바꾸지 않았다(정상, 코드 전용 PR). 실제 구현 diff(5파일/873줄, 예산에 잘려
프롬프트엔 본문이 없었음)를 이 워킹트리에서 `git diff origin/main...HEAD` 로 직접 확인한 결과,
변경은 다음 두 codebase 파일의 신설(리네임)과 사소한 주석 갱신 1건뿐이다:

- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제) →
  `guide-identifier-scan.ts` (신설)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제) →
  `guide-identifier-existence.test.ts` (신설)
- `guide-sanitized-message-parity.test.ts` — 주석 내 파일명 참조만 갱신

spec 신규 요구사항 ID·엔티티·API endpoint·이벤트명·env var·spec 파일 경로는 **이번 diff 에 없다**.
따라서 이번 검토의 실질 대상은 코드 레벨 식별자(타입명·함수명·상수명·axis 라벨·파일 경로)이며,
이는 직전 라운드(`--impl-prep`, `review/consistency/2026/09/13/12_33_41/naming_collision.md`)가
"미확정 상태"로 INFO 3건을 남겼던 바로 그 이름들이 실제로 어떻게 확정됐는지를 검증하는 형태가 된다.

## 발견사항

없음 (CRITICAL/WARNING 0건).

직전 라운드가 남긴 INFO 3건은 구현 시 다음과 같이 해소됐고, 각각 실측으로 충돌 부재를 확인했다.

- 파일명 리네임: `guide-error-code-*` → `guide-identifier-*`.
  `grep -rn "guide-error-code"` 전수 grep 결과 코드 내 잔존 참조 0건(과거 파일을 가리키는
  것은 `plan/complete/`·`plan/in-progress/` 의 역사 서술뿐이며 의도적으로 이름 보존). 옛 파일
  2개는 실제로 삭제됐고(구 189+184줄 delete, 신 247+214줄 add), 새 파일과 겹쳐 남아있는
  중복 정의는 없다. `PROJECT.md` 가드 카탈로그 300행도 새 이름으로 갱신됐다.
- `CitationAxis` 값 `"prose"` 미재사용, `"backtick"` 신설.
  `grep -rn "CitationAxis\b"` 결과 이 타입을 소비하는 곳은 신·구 파일 자신뿐이라 외부
  소비자와의 값 의미 충돌 가능성이 애초에 없고, 실제로도 값 자체가 `"backtick"` 으로
  바뀌어 옛 `"prose"`(실패-문맥 게이팅)의 좁은 의미와 섞이지 않는다.
- 허용목록 상수명 `GUIDE_EXTERNAL_VOCABULARY` — `KNOWN_*` 접두 미공유.
  `grep -rln "KNOWN_DOCS_ABSENT"` 결과 이 이름은 `codebase/backend/.../catalog-docs-drift.spec.ts`
  ·`spec/conventions/cafe24-api-catalog/_overview.md` 등 완전히 다른 도메인(Cafe24 카탈로그
  문서 부재 허용목록)에서만 쓰이고, `GUIDE_EXTERNAL_VOCABULARY` 는 다른 이름공간이라 grep
  상으로도 뒤섞이지 않는다.

새로 도입된 함수명(`scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`)과
타입(`IdentifierCitation`)도 `codebase/` 전수 grep 결과 소비처가 신·구 두 파일 자신뿐이라
외부 이름공간과의 충돌은 없다. 가이드 텍스트가 인용하는 외부 어휘 토큰(`MESSAGE_CREATE`,
Discord Gateway 이벤트명)도 `GUIDE_EXTERNAL_VOCABULARY` 에 출처(system)를 명시해 우리
식별자 체계와 섞이지 않게 구분돼 있다. 정정 대상이던 환경변수 `MCP_ALLOW_INSECURE_URL` 은
`codebase/backend/src/common/config/mcp.config.ts`·`production-guards.spec.ts` 등에서 이미
단일 의미로 쓰이는 기존 식별자와 일치해, 새로 도입된 이름이 아니라 기존 정의를 정확히
가리키게 된 것으로 확인된다.

## 참고 (충돌은 아니나 경계 기록)

`spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표는 여전히 이 가드
계열(`guide-identifier-existence`·`guide-sanitized-message-parity`)을 등재하지 않는다
(delta 0 이므로 이번 PR 의 범위 밖). 이는 **이름 충돌이 아니라 등재 갭**이며, 직전 라운드가
이미 INFO#1 로 지적했고 plan(`plan/in-progress/guide-identifier-existence.md` §D, 체크리스트)이
"planner 등재" 로 명시적으로 이연 처리했다 — 재지적하지 않는다.

## 요약

이번 diff 는 spec 신규 식별자 없음(scope 델타 0)이며, 실제 변경은 코드 테스트 파일 2개의
리네임/스코프 확장이다. 직전 impl-prep 라운드가 남긴 명명 INFO 3건(파일명 스코프-네이밍,
axis 라벨 재사용 회피, 허용목록 접두 분리)은 모두 계획대로 구현됐고, 전수 grep 으로 실제
충돌 부재를 재확인했다. 새로 도입된 타입·함수·상수 어느 것도 기존 코드베이스에서 다른
의미로 이미 쓰이고 있지 않다.

## 위험도

NONE
