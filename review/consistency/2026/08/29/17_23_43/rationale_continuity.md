# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 점검 범위와 방법

번들 프롬프트(`_prompts/rationale_continuity.md`, 3356줄)는 컨텍스트 예산 초과로 `spec/5-system/`
15개 파일 중 3개(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)만 본문을 담고 나머지
(`4-execution-engine.md`·`14-external-interaction-api.md` 등)는 절단됐다. 작업 브랜치명
(`eia-idem-resolve-cache-hit`)과 워크트리 내 실제 변경 파일(`idempotency.interceptor.ts`)이
가리키는 실질 영역이 EIA(§14) 임을 확인하고, 절단된 `spec/5-system/14-external-interaction-api.md`
와 `spec/data-flow/15-external-interaction.md`, `spec/5-system/4-execution-engine.md` §9.2 를
저장소에서 직접 `Read`/`grep` 하여 보강했다(프롬프트의 "여기 없다는 사실을 근거로 삼지 말 것"
지시에 따름). 아울러 관련 완료 plan
[`plan/complete/spec-draft-eia-idempotency-key-scope.md`](../../../../../../plan/complete/spec-draft-eia-idempotency-key-scope.md)
를 대조해 "과거 결정"의 실제 이력을 확인했다.

**범위 밖 처리**: 워크트리에 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
의 미커밋 diff 가 존재하나, 본 checker 의 target 문서는 `spec/5-system/`(spec 번들)이며 코드 diff
는 대상이 아니다. 검토 중 해당 diff 를 두 차례 열람했는데 첫 열람과 재확인 사이에 파일의 git
diff index 해시가 바뀌어 있었다(동시에 진행 중인 별도 프로세스가 그 파일을 편집 중) — 이는
코드 리뷰(`code-review-agents`) 트랙의 관심사이지 이 checker 의 target 이 아니므로 본 보고서에서는
다루지 않는다.

## 발견사항

검토한 범위(EIA 캐시 키 스코프 결정 + `1-auth.md`/`2-api-convention.md`/`3-error-handling.md`
Rationale 전문)에서 **기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회는 발견되지
않았다.**

구체적으로 다음을 대조 확인했다:

1. **EIA Idempotency-Key 캐시 스코프 (§R8 "캐시 키 스코프")** — `spec/5-system/14-external-interaction-api.md`
   L1257~L1268 은 완료된 `spec-draft-eia-idempotency-key-scope.md` 가 결정한 3-세그먼트 키
   `interaction:idempotency:<executionId>:<route>:<key>` 를 그대로 유지하고 있다. "스코프
   단위는 토큰이 아니라 execution" 이라는 기각-대안 근거(jti 스코프 시 `refresh-token` 회전
   후 재시도가 깨짐)도 원문 그대로 보존됐다. `EIA-IN-11`(L97)·`EIA-RL-02`(L156) 두 요구사항
   행도 "동일 execution·동일 route 안에서" 한정이 살아있어 표와 Rationale 이 어긋나지 않는다.
   `spec/data-flow/15-external-interaction.md` L93·L98·L260 도 동일 3-세그먼트 형식과 스코프
   근거 각주를 그대로 미러링한다 — 전역 키로의 회귀나 문서 간 drift 없음.
2. **선례 인용 정확성** — §R8 이 인용하는 "실행 단위로 스코프한 Redis 전역 키 선례"
   (`exec:seq:<executionId>`)는 `spec/5-system/4-execution-engine.md` L1166·L1188 의 실제
   서술("executionId 가 이미 전역 유일 UUID")과 정확히 일치한다. 완료 plan 이 명시적으로
   기각한 오인용 후보(`bg:<executionId>:<backgroundRunId>` — `spec/4-nodes/1-logic/12-background.md`
   L95·L310 에 in-memory 전용으로 명시)는 현재 spec 어디에도 Redis 선례로 재인용되지 않았다.
3. **`1-auth.md` §2.3.D / Rationale 1.1.B-4·2.3.D** — 세션 강제종료·이메일 변경 재인증 수단이
   "password OR TOTP" 로 정정된 이력이 본문(§2.3 표)과 Rationale 양쪽에서 일치한다. WebAuthn
   step-up·이메일 OTP 재인증 미지원이 두 자리 모두에서 같은 근거로 명시돼 있어 번복 없음.
4. **`3-error-handling.md` §6.3.1 `Error.cause` 부착 기준** — 최근(2026-08-29) 정본화된
   기준("에러 객체 자신의 성질" C1/C2, 소비처 기준은 명시적으로 기각)이 Rationale 에 기각
   경위와 함께 남아 있고 본문과 모순되지 않는다.

## 요약

검토 대상 spec/5-system/ 번들(예산 내 포함된 3개 파일 전문 + 직접 확인한 EIA/data-flow/실행엔진
발췌)에서 과거 Rationale 이 기각한 대안의 재도입이나 합의 원칙 위반은 발견되지 않았다. 특히 이번
작업의 실질 초점으로 보이는 EIA idempotency 캐시 키 스코프 결정은 완료된 plan 의 근거·기각
대안·선례 인용이 현재 spec 문서에 정확히 보존돼 있다. 다만 컨텍스트 예산으로 `spec/5-system/`
15개 파일 중 12개(4-execution-engine 전문·6-websocket-protocol·12-webhook·13-replay-rerun 등
포함)가 이번 프롬프트에서 절단되어 본 checker 가 전문을 열람하지 못했다 — 이번 구현이 EIA
외 영역(예: 실행 엔진 seq 카운터, WS 프로토콜)에도 손을 댄다면 그 파일들의 Rationale 은 별도
확인이 필요하다.

## 위험도

NONE
