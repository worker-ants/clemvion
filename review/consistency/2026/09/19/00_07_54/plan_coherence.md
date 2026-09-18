# Plan 정합성 검토 — 웹훅 `endpoint_path` 전역 유일 draft

## 검토 범위

- target: `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md`
- 대조: `plan/in-progress/` 전체(누락된 64개는 각 파일 grep 으로 직접 확인), `plan/complete/spec-draft-fk-remaining-dispositions.md`

## 확인한 것

1. **트래커 원 항목과의 관계** — target 이 닫으려는 `plan/in-progress/spec-draft-nullable-notation-followups.md:4632`
   («웹훅 트리거 조회가 `endpoint_path` 인덱스 전체를 훑는다», 2026-09-18 등재)는 여전히 `[ ]` 미체크 상태다. 항목 본문이
   명시한 미해결 결정 — 「`endpoint_path` 를 전역 UNIQUE 로 좁힐지, 비유일 보조 인덱스로 조회만 고칠지」 — 를 target 의
   «결정 (2026-09-18 사용자)» §1 이 전자로 확정했다. target 의 «트래커 반영» 절은 이 항목을 `[x]` 로, 새 항목(묘비 부재)을
   추가하는 것을 **아직 실행하지 않은 채** 체크리스트 미체크 항목(`## 체크리스트` 8번째 줄)으로 남겨 뒀다 — 이는 갭이 아니라
   실행 순서상 정상이다(spec 반영 · 구현 · 리뷰가 끝난 뒤 마무리 커밋에서 트래커를 갱신하는 이 저장소의 표준 패턴과 일치).
   원 항목이 제시한 두 선택지 중 하나를 근거(재현·실측)와 함께 골랐으므로 **일방적 결정 우회가 아니다**.

2. **`plan/complete/spec-draft-fk-remaining-dispositions.md` 와의 선후관계** — target 서두가 인용하는 «비대상» 처분은
   실제로 그 파일(현재 `plan/complete/`, HEAD 최신 커밋 `1cc089343`)에 존재하며, 그 처분이 이 항목을 nullable-notation
   트래커로 넘긴 이력과 target 의 서두 서술이 일치한다. 선행 plan 미해소 없음.

3. **마이그레이션 버전 선점 충돌** — `git grep`/`ls` 로 확인한 결과 다른 어떤 in-progress plan 도 `V131`/`V132` 를 선점하지
   않았고, `codebase/backend/migrations/` 의 최신 파일은 `V130__model_config_workspace_kind_index.*` 다. target 이 이미
   INFO 로 남긴 «구현 착수 직전 `check-migration-versions.py` 재확인» 처분과 정합한다.

4. **채팅 채널 관련 plan 과의 충돌 여부** — `chat_channel_health`/`chat_channel_last_error`/`degraded`/`setupChannel`/
   `R-CC-21`/`R-CC-19` 를 grep 했을 때 `plan/in-progress/chat-channel-visual-ssr-png.md` 만 걸렸고, 그 문서의 `degraded`
   갱신은 SSR PNG 렌더링 실패(CCH-SE-01, v1 텍스트 fallback)에 대한 것으로 target 이 다루는 「경로 복사로 인한 마이그레이션
   재배치」와 실패 계열이 다르다. target 이 2차 처분에서 «`degraded` 두 경로 닫힌 열거를 세 번째 경로로 넓히지 않는다» 고
   내린 결정과 이 plan 사이에 충돌 없음. `chat-channel-discord-gateway.md`/`chat-channel-slack-socket-mode.md` 는 관련 키워드
   0건.

5. **동일 spec 파일을 건드리는 다른 in-progress plan** — `spec-sync-auth-gaps.md` 가 `2-navigation/2-trigger-list.md:182,252`
   를 인용하는 항목이 있었으나 **이미 `[x]` 완료**(2026-08-06)로, target 이 편집하는 같은 파일의 다른 위치(126행 Webhook
   Configuration 행, 197행 §3 409 문단)와 겹치지 않고 활성 참조도 아니다. `spec-sync-external-interaction-api-gaps.md` 는
   `12-webhook.md`/`2-api-convention.md` 를 인용하지만 소유자(자격증명 메타) 구분·에러 코드 401/403 카탈로그 이슈로 target 의
   변경 대상(§12.2 «유니크 제약 범위» 표, WH-SC-01 행)과 텍스트·관심사가 분리돼 있다. 활성 충돌 없음.

6. **묘비(tombstone) 후속 항목 중복 여부** — target 이 «비대상 → 트래커에 새 항목» 으로 미룬 «지운 경로 재등록» 이슈가
   다른 in-progress plan 에 이미 등록돼 있는지 확인했으나 없음(중복 등재 위험 없음).

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급의 plan 정합성 결함을 찾지 못했다.

## 요약

target 은 자신이 닫으려는 트래커 항목(`spec-draft-nullable-notation-followups.md`)이 남긴 미해결 결정("전역 UNIQUE vs
비유일 보조 인덱스")을 근거·재현·실측과 함께 명시적으로 선택해 우회 없이 해소했고, 선행 plan(`plan/complete/spec-draft-fk-remaining-dispositions.md`)과의
인용 관계도 실제 파일 상태와 일치한다. 마이그레이션 버전(V131/V132) 선점, 채팅 채널 관련 in-progress plan 과의 상태 컬럼
의미 충돌, 동일 spec 파일을 인용하는 다른 in-progress plan 과의 라인 충돌을 모두 확인했으나 활성 충돌이 없다. 트래커 반영
(체크·신규 항목 등재)은 아직 실행되지 않았지만 이는 draft 자신의 체크리스트에 미완료 작업으로 정직하게 남아 있어 갭이
아니라 정상적인 미완료 상태다.

## 위험도
NONE
