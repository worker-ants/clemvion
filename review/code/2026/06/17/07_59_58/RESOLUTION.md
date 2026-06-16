# RESOLUTION — rebase 후 재검토 (origin/main #623 반영)

origin/main 에 #623(보안 백로그 후속, spec-only) 머지 → rebase. 충돌은 `4-security.md §1` 한 곳(#623 deny-by-default 인라인 ↔ 내 §1.1 매트릭스)으로 **양쪽 보존 병합**. rebase 가 커밋 타임스탬프를 갱신해 리뷰 가드 재무장 → rebased 상태에서 TEST WORKFLOW + ai-review + consistency 재수행.

ai-review: **RISK LOW / Critical 0 / Warning 3**. consistency `--impl-done`: **BLOCK: NO**.

## 조치 항목 (ai-review)

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W-1 | Dependency | `otplib ^13.4.1` caret — 보안 경로 patch drift | **무변경(정책 정합)** — PROJECT.md §버전·도구 정책 = "caret 기본 / lock=재현성 SoT". `package-lock.json` 이 13.4.1 고정 + CI `npm ci` 결정적이라 drift 없음. 보안 경로 exact 핀 전환은 별도 정책 논의 사안 |
| W-2 | SPEC-DRIFT | `4-nodes/5-data/2-code.md` `node>=22` 표기 ↔ engines `>=24` | **수정** — "`node>=22` 는 라이브러리 지원 범위, 프로젝트 floor 는 PROJECT.md `>=24`" 명확화 절 추가 |
| W-3 | Documentation | `4-security.md §1` 이 §1.1 과 `ALLOWED_*` 이중 기술 (rebase merge 부산물) | **수정** — §1 셀을 요약(deny-by-default + rationale)으로 간결화, 구현 API 이름은 §1.1 로 일원화 |
| I-1 | Requirement | `(refactor 04 m-1)` 소문자 | **수정** — `M-1` 로 통일 |
| I-4 | Documentation | §1.4.K 의 "ai-review" 내부도구 언급 | **수정** — 의사결정 언어로 정제 |
| I-7 | Dependency | `@noble/hashes`·`@scure/base` 신규 transitive | **참고** — MIT/감사완료 라이브러리, audit 0(직전 `npm audit --omit=dev` 클린). 머지 후 CI audit 재확인 권장 |
| I-8 | Security | 복구코드 SHA-256 KDF 미채택 | **확인됨** — §1.4.K 근거 명문화(OWASP 정합). 조치 불요 |
| 기타 INFO | — | I-3(메인앱 SoT 중기 이전)·I-6(R4 동작문구 위치)·I-9/10(산출물 개행·orchestrator state) | 현위치 유지 또는 orchestrator 영역 — 본 PR 무관 |

## 조치 항목 (consistency-check, BLOCK: NO)

| # | 발견 | 처분 |
|---|---|---|
| CC-W1 | `webchat-eager-start.md` plan `complete/` 이동 미완 + 참조 spec `pending_plans` 정리 | **out of scope** — 내 diff 와 무관한 **기존** channel-web-chat 구현 plan 의 라이프사이클 사안. 별도 후속 |
| CC-W2 | `2-sdk.md` `pending_plans` 에 `eia-sdk-publish.md` 누락 | **out of scope** — "팀 결정 필요"(npm 배포 트랙 소관 여부), 기존 상태·내 diff 무관 |
| INFO | isolated-vm floor(=W-2 중복, 수정됨)·`id: common` 중복(기존)·신규 식별자 충돌 없음 | 처리/무관 |

## TEST 결과 (rebased 트리)

- **lint**: 통과 / **build**: 통과 / **unit**: 통과 / **e2e**: 통과 — `run-test.sh e2e` 34 suites·202 tests PASS, `make e2e-down` 정리. (#623 은 codebase 변경 0 + 내 코드 byte-identical이나 base 이동·가드 재무장으로 전 stage 재수행.)

## 보류·후속 항목

- otplib exact 핀 여부(보안 경로 핀 정책) — 별도 정책 결정.
- channel-web-chat 구현 plan(webchat-eager-start·eia-sdk-publish) 라이프사이클 정리 — 본 PR 무관 별건.
