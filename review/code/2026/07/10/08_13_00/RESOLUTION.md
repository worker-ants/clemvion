# RESOLUTION — EIA §R17 잔여 하드닝 ai-review

리뷰 대상 커밋: `8d39d65ee`. 리뷰어 3종(security / side-effect / testing) 병렬.

## 처분 요약

| 출처 | Severity | 판정 | 조치 |
|---|---|---|---|
| security | NONE | — | getStatus 5개 반환 필드 전부 마스킹 확보(본 커밋이 terminal result/error 마지막 gap 종결). 캐시 교차오염·우회 없음. egress-only 유지. |
| side-effect | LOW (WARNING×1) | Documented | result/error 의 credential-key wholesale 마스킹이 정당한 `token`/`secret` 명 결과 필드를 손상 가능 — **이미 spec §R17 + plan(P1-2/P2-4)에 의도적 결정으로 문서화**. repo 소비처(sdk·channel-web-chat)는 opaque pass-through라 회귀 없음. `deepRedactObject` 추출은 byte-for-byte 동일(무회귀). 캐시 mutate-after-cache 리스크는 호출부 3곳 모두 미트리거(INFO). |
| testing | LOW (WARNING×1) | Fixed | 헤드라인 변경분(terminal result/error 마스킹)이 e2e 미검증(waiting 경로만) → **e2e(J) 추가**: COMPLETED execution seed → getStatus wire 로 result outputData 의 secret 이 `***`, 정상 데이터 보존 검증(249 e2e pass). INFO(vacuous-pass·FAILED 양성체크·캐시 독립성)는 저위험 미조치. |

## 검증
- unit: sanitize-error-message·interaction.service 등 통과. lint 0 error. build clean.
- **e2e: 249 pass** (I: waiting conversationThread/nodeOutput 마스킹, J: terminal result 마스킹).
