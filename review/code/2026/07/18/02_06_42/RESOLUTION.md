# RESOLUTION — review/code/2026/07/18/02_06_42

전체 위험도 **CRITICAL** (C1) 에 대한 처리. 핵심 결정: **손수 짠 `mkdir` 락을 제거하고 마커-only 로
전환**(사용자 결정 2026-07-18). C1 및 락 관련 WARNING 다수가 이로써 moot.

## C1 (CRITICAL) — stale-lock 탈취 TOCTOU → 동시 `npm install`

**해소: 락 제거.** `_lock_is_dead && rm -rf "$lock"; mkdir "$lock"` 이 check-then-act 라, 두 세션이
같은 죽은 락을 보고 둘 다 rm+mkdir → 진 쪽이 이긴 쪽의 fresh 락을 지워 둘 다 설치. main 이 직접
3-way 동시 설치를 재현 확인(리뷰어의 20/20·N=10~30 재현과 일치). 내 커밋 주석의 "dead+aged 락은
fresh 재획득일 수 없다"는 논증이 반증됨.

`mkdir` 락 + owner PID + grace + steal 전체(`_lock_is_dead`, owner 파일, grace, 소유권 해제)를
삭제. `bootstrap-session.sh` 는 이제 마커 + 실패 throttle 만. 설계 노트에 왜 뺐는지(TOCTOU 재현 +
올바른 primitive 는 `fcntl.flock`) 와 수용한 잔여 리스크(첫 cold 설치 동시 실행 → 드문 트리 오염,
`rm -rf node_modules` 복구)를 명시.

→ 락이 없으니 steal 레이스 자체가 존재하지 않는다.

## 코드 fix / 문서화

| SUMMARY # | 분류 | 조치 |
|---|---|---|
| C1 | 코드(제거) | `mkdir` 락 apparatus 전체 삭제 → 마커-only. `.gitignore` 의 `.install.lock` 항목 제거. |
| W2 | moot | `_lock_is_dead` 비수치 env 검증 — 함수 자체가 삭제됨. |
| W5 | 문서 | 동시 테스트 메서드명/의미를 marker-only 수렴(`test_concurrent_cold_start_converges_…`)으로 교체. `tests/README.md` 도 락→마커-only 로 정정. |
| W6 | 문서 | `.githooks/pre-commit` 헤더에 3번째 공유 SoT(`mermaid_lint_ready.py`) 추가. |
| W7 | moot | 락 관련 known-limitation 주석(W2 hung/W12 ABA) 이 락과 함께 삭제됨. |

## 테스트

`test_bootstrap_mermaid_install.py`: 락 테스트 9건 + `_plant_lock` 헬퍼 삭제. 유지: 마커·부분트리·
실패·throttle. 동시 테스트는 **수렴**(마커 존재 + 이후 세션 skip)을 단언 — 락을 뺐으니 exactly-once
는 보장하지 않는다. 비-vacuity: 마커-미기록 뮤턴트에서 수렴 테스트가 실패함을 확인.

- 전체 harness 스위트: **301/301 통과** (락 테스트 9건 제거로 310→301).
- `plan-frontmatter.test.ts`: 93/93.
- e2e: `.claude/**`·`.github/**`·`plan/**` 화이트리스트 → 면제(E2E=skipped).

## 별건 defer (plan §A 후속 / §F / §G 에 등록)

- **W1** (main-root 해석 3곳 중복 + bootstrap 실패 경로 무신호) — 선재, diff 밖. plan §A 후속.
- **W4** (import fail-open 실행 테스트 없음) — 코드는 정답(L116 이 None→skip), 테스트 갭만. plan §A 후속.
- **W3** (테스트 헬퍼 중복) — 위생. plan §A 후속.
- **W8** (harness-checks.yml node 22) — 선재 CI. plan §A 후속.
- **W4/W5**(00_59_56, npm 취약점·스캔 갭) — plan §F.
- **W6**(00_59_56, 추출) → **G** 로 통합: 추출 + `fcntl.flock`(진짜 동시성 필요 시).

## 사용자 결정 (ESCALATE)

락 방향은 `AskUserQuestion` 으로 3안 제시 → **"락을 아예 빼고 마커-only"** 선택. 이 RESOLUTION 은
그 결정의 이행이다.
