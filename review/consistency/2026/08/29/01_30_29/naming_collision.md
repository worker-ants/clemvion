STATUS=success naming_collision review complete — no critical/warning collisions found

# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 조사 방법

- `git diff --stat origin/main...HEAD`(전체) 확인 결과, 이번 변경분은 실제로는
  `codebase/backend` 5개 파일(주로 주석 추가) + `plan/`·`review/` 산출물뿐이며,
  `spec/5-system/3-error-handling.md` 는 `git diff origin/main -- spec/5-system/3-error-handling.md`
  가 **0줄**이라 이번 diff 의 대상이 아니다 (`§6.3.1` 은 이전 커밋 `44346ec81`
  "docs(spec): `Error.cause` 부착 기준을 §6.3.1 로 정본화" 로 이미 `origin/main` 에 병합된 상태).
  즉 이번 target 은 **이미 확정된 spec §6.3.1 을 코드 주석이 참조**하는 것이며, spec 자체가
  새 식별자를 이번에 도입하지는 않는다.
- 그럼에도 "target 문서(bundle 된 spec/5-system/ 전체 + 코드 diff)가 새로 부여한 식별자"
  기준으로 §6.3.1 의 조건 라벨 `C1`/`C2`, 절 번호 `§6.3.1` 을 신규 식별자 후보로 보고
  기존 코퍼스 전체(spec/**, codebase/**)를 대조했다.

## 발견사항

해당 없음 — CRITICAL/WARNING 없음.

- **[INFO]** `C1`/`C2` 라벨이 `spec/5-system/` 내에서 이미 다의적으로 쓰이고 있음 (참고용, 충돌 아님)
  - target 신규 식별자: `spec/5-system/3-error-handling.md` §6.3.1 의 조건 라벨 `C1`(message 포함 여부)·`C2`(부가 민감 속성 유무). 코드 diff 5곳 전부 `spec/5-system/3-error-handling.md §6.3.1 (C1 AND C2)` 형태로 **절 번호를 항상 동봉**해 참조한다.
  - 기존 사용처: 같은 `spec/5-system/` 폴더 안에 `C1`/`C2` 가 이미 두 가지 다른 의미로 존재한다.
    - `spec/5-system/13-replay-rerun.md:65,100,509,545,547` — Re-run 범주 티어(`C1`=전체 워크플로만, `C2`=resume-from-failure, `C3`=…).
    - `spec/5-system/6-websocket-protocol.md:1059,1063` — 2026-06-03 spec-drift 결정 식별자(`C2`=타임아웃 제거, `C3`=…).
    - (참고, 범위 밖) `spec/conventions/cafe24-api-catalog/**`·`makeshop-api-catalog/**` 의 외부 쇼핑몰 API 상태 코드(`C1`=입금전취소 등)도 `C1`/`C2` 를 쓰지만 이건 3rd-party API 명세 원문 그대로라 우리 명명 체계와 무관.
  - 상세: 세 용법 모두 **각자 문서/섹션에 로컬 스코프**이고 cross-reference 시 항상 문서명·절 번호를 동봉하므로(예: "RR-PL-03(C1)", "§6.3.1 (C1 AND C2)") 실제 혼동 사례는 관측되지 않았다. 다만 `spec/5-system/` 라는 같은 최상위 영역 안에서 `C1`/`C2` 라는 짧은 토큰이 세 번째로 재사용된 것이므로, 향후 이 영역을 다루는 사람이 절 번호 없이 "C1" 만 인용하면(코드 리뷰 코멘트 등) 어느 문서의 C1 인지 모호해질 잠재 표면이 있다.
  - 제안: 현재 코드 주석은 이미 절 번호(`§6.3.1`)를 동봉하고 있어 즉각 조치는 불필요. 향후 §6.3.1 을 인용할 때도 "C1" 단독이 아니라 "§6.3.1 C1" 형태를 유지할 것을 권장(이미 그렇게 하고 있음 — 유지만 하면 됨).

## 그 외 점검 관점 결과 (전부 해당 없음)

1. **요구사항 ID 충돌** — 이번 target 은 새 요구사항 ID(`RR-*`/`NF-*`/`WH-*` 류)를 부여하지 않는다. 없음.
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 없음 (diff 는 `try/catch` 블록에 주석만 추가, `WebAuthnCredential` 등 기존 타입과 무관).
3. **API endpoint 충돌** — 새 endpoint 없음. `/api/auth/**` 등 `spec/5-system/1-auth.md` 의 기존 표는 이번 diff 대상이 아니다.
4. **이벤트/메시지명 충돌** — webhook·큐·SSE 이벤트 신설 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/설정키 없음 (`WEBAUTHN_*` 등 기존 값과 무관한 변경).
6. **파일 경로 충돌** — `git diff --diff-filter=A origin/main...HEAD -- spec/ codebase/` 결과 신규 파일 0건. 기존 5개 파일(`expression-resolver.service.ts`(+spec)·`secret-resolver.service.ts`·`code.handler.ts`(+spec))만 수정.

## 요약

이번 target(`spec/5-system/`, impl-done 스코프)의 실질 diff 는 `preserve-caught-error`(eslint 10) 대응 주석 5곳뿐이며, 참조 대상인 `spec/5-system/3-error-handling.md` §6.3.1(`Error.cause` 부착 기준 C1/C2)은 이미 `origin/main` 에 병합되어 이번 PR 이 새로 도입하는 식별자가 아니다. 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로 중 어느 것도 신설되지 않아 신규 식별자 충돌 관점의 리스크는 사실상 없다. 유일한 관찰 사항은 `C1`/`C2` 라는 짧은 라벨이 `spec/5-system/` 폴더 내에서 이미 두 군데(재실행 티어, 웹소켓 프로토콜 spec-drift 결정)에 다른 의미로 쓰이고 있다는 점인데, 코드 주석이 항상 절 번호(`§6.3.1`)를 동봉해 참조하므로 실질적 혼동 위험은 낮다(INFO).

## 위험도

NONE
