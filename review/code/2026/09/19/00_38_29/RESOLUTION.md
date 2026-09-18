# RESOLUTION — review/code/2026/09/19/00_38_29

리뷰 대상: `0704b33c3`(V131 · V132 · 서비스 · 테스트) · `b290d236b`(lint · draft 링크) + planner 커밋 `eb5332b57`. Critical 0 · Warning 6 · INFO 12.

정지 규칙(1라운드 결과를 보기 전 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 에 선언): `codebase/**` 수정이 필요한
지적은 고치고 1라운드 더 — 최대 2라운드. W1 · W2 · W3 · W6 이 `codebase/**` 수정이라 고쳤고 2라운드(`review/code/2026/09/19/01_04_31`)를 돌린다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
|---|------|------|------|
| W1 | V131 의 정리 분기가 자동 테스트로 한 번도 실행되지 않는다(CI · e2e 는 빈 테이블) | `test/trigger-endpoint-path-dedupe.e2e-spec.ts` 신설 — 한 트랜잭션 안에 임시 스키마 + `trigger` 사본(인덱스 · FK 없이)에 중복을 심고 `search_path` 로 **V131 파일 그대로** 실행 → 가장 먼저 만든 행 유지 · 나머지 새 v4 · updated_at 갱신 · 중복 0 · NOTICE 에 채팅 채널 여부 있음 · 경로 없음 · 재실행 0건 → ROLLBACK. 공유 테이블을 잠그지 않는다. 뮤턴트 셋(순서 뒤집기 · 동률 뒤집기 · NOTICE 에 경로) 모두 RED — M3 는 비밀 누출 단언에서 실패함을 확인 | `b9162a877` |
| W2 | `created_at` 동률의 tie-break 가 문서 · 테스트에 없다 | V131 헤더에 «트랜잭션 시작 시각이라 동률이 가능하고 그때는 id 순 — 결정적 규칙» 명시 + W1 테스트의 Q 묶음(같은 created_at, id 작은 쪽 유지) | `b9162a877` |
| W3 | 사용자 가이드가 «워크스페이스 도메인 아래 고유 엔드포인트» 로 서술 | `triggers.mdx` · `triggers.en.mdx` — 서비스 전체에서 유일 · 추측 방지(UUID)와 복사 방지(전역 유일) 구분(user-guide-writer, KO/EN parity · 내부 용어 없음) | `b9162a877` |
| W4 | `plan/complete/…` 선인용이 아직 없는 경로 | 이 PR 의 마지막 커밋에서 draft 를 옮기고 grep 으로 확인(draft 체크리스트 마지막 항목) — 코드 수정 없음 | 마무리 커밋 |
| W5 | 채팅 채널 트리거의 provider 재등록이 운영 절차에 의존 | 설계상 선택(`--spec` 2차에서 상태 컬럼을 쓰지 않기로 결정 — `degraded` 는 닫힌 의미). 배포 체크리스트 «V131 NOTICE 의 `chat_channel=t` 대상에게 알렸는가» 를 PR 본문에 싣는다 | PR 본문 |
| W6 | 409 설명 리터럴이 두 데코레이터에 중복 | `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` 상수 하나로(`integrations.controller.ts` 선례) | `b9162a877` |
| INFO 10 | 거부된 PATCH 뒤 경로가 그대로인지 미단언 | e2e B5 에 DB 대조 추가 | `b9162a877` |
| INFO 1~9 · 11 · 12 | 채팅 채널 트레이드오프(W5 와 같은 근원) · 행 단위 UPDATE(NOTICE 요구 · 대상 극소) · V131↔V132 경합(옛 인덱스 유지 · 복구 절차 헤더) · README 일반화(재발 시) · 감사 로그 공백 · 스코프 · 메시지 문구 · breaking 의도 · 409 oracle(경로를 이미 알아야 성립) · e2e 헬퍼 · tracker 선인용 | 조치 불요 또는 PR 배포 체크리스트(INFO 5 · 8 — 영향받은 소유자 통지) | — |

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260919-005909.log`)
- unit: 통과 (`_test_logs/unit-20260919-010308.log` — 첫 실행은 jest 워커 SIGSEGV 로 스위트 하나가 죽었다. 테스트 실패가 아니라 워커 프로세스 종료였고 재실행에서 통과)
- build: 통과 (`_test_logs/build-20260919-010019.log`)
- e2e: 통과 (344, `_test_logs/e2e-20260919-010428.log` — `trigger-endpoint-path-dedupe.e2e-spec.ts` · `webhook-trigger.e2e-spec.ts` PASS. 새 V131 테스트가 e2e 러너 컨테이너에서 마이그레이션 파일을 읽었다)
