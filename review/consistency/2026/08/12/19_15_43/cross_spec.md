# Cross-Spec 일관성 검토 — `spec/data-flow/15-external-interaction.md` (impl-done)

## 검토 범위 요약

- target: `spec/data-flow/15-external-interaction.md` (Idempotency-Key 캐시 대상 서술 갱신)
- 실제 구현 diff: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  + 그 unit spec + `test/external-interaction.e2e-spec.ts` — `IdempotencyInterceptor` 가
  [Spec EIA §R8](../5-system/14-external-interaction-api.md) 이 규정한 **닫힌 목록**
  (`2xx` · `409 Conflict` · `410 Gone` 캐시, `400 VALIDATION_ERROR`·`5xx`·그 외 `4xx` 는
  캐시 제외)을 그대로 구현하도록 수정한 버그 픽스. 종전 조건(`statusCode >= 400` 제외)이
  409·410 까지 함께 떨구던 선재 결함을 해소.
- 1차 대조 대상(fully bundled): `spec/5-system/14-external-interaction-api.md`
  (§3.2 EIA-IN-11 · §3.4 EIA-RL-02 · §5.1 에러 코드 표 · §Rationale R8), 그리고 나머지
  `spec/data-flow/*` 전 파일, `spec/0-overview.md`, `spec/1-data-model.md`,
  `spec/2-navigation/1-workflow-list.md`. 그 외 다수 spec 은 컨텍스트 예산 초과로
  "의도된 절단" 상태였다(`spec/7-channel-web-chat/*`, `spec/5-system/1·2·3·4·5·6…` 등
  본문 미포함) — 아래 결론은 이 절단된 파일들에서 이 diff 와 직접 충돌하는 서술이 없다는
  전제 위에 있으며, target 문서 자체와 grep 결과로는 그런 참조가 발견되지 않았다.

## 발견사항

없음 — target 문서와 diff 는 [Spec EIA §R8](../5-system/14-external-interaction-api.md#r8-idempotency-key-와-submit_form-검증-실패의-관계)
의 문구(닫힌 목록: `2xx`·`409`·`410`, `400 VALIDATION_ERROR` 제외, `5xx` 제외, "단일 비교로
축약 금지")를 그대로 반영하고 있고, 다음을 대조 확인했다.

- **요구사항 ID 일치**: target 문서가 인용하는 `EIA-RL-02`(§3.4, "동일 응답 24h 재현"),
  `EIA-IN-11`(§3.2, `Idempotency-Key` 헤더), `[Spec EIA §R8]` 은 모두
  `spec/5-system/14-external-interaction-api.md` 에 실제로 그 의미로 정의돼 있다 — 새 ID 를
  만들지 않고 기존 ID 를 재사용했으므로 ID 충돌 없음.
- **API 계약 일치**: 에러 코드 표(§5.1) 의 `409 STATE_MISMATCH` / `410 EXECUTION_TERMINATED`
  / `400 VALIDATION_ERROR` 가 `interaction.service.ts` 의 throw 출처(`ConflictException`/
  `GoneException`/`BadRequestException`)와 target 문서·diff 의 서술과 정합. `409
  IDEMPOTENCY_KEY_CONFLICT`(바디 해시 불일치 시 인터셉터 자체가 던지는 응답)는 캐시 **쓰기**
  대상 판정(`isErrorStatusCacheable`)과 다른 코드 경로라 서로 간섭하지 않는다.
- **Schema 서술 일치**: target 문서 §2.2 의 Redis 엔트리 shape
  `{bodyHash, responseJson, statusCode}` 는 코드의 `IdempotencyEntry` 인터페이스와 1:1
  일치하며 TTL 서술(24h)도 `TTL_SEC = 24*60*60` 과 일치.
  `interaction:idempotency:<key>` 키 prefix 도 `REDIS_KEY_PREFIX` 와 일치.
- **잔존 "선재 결함" 서술 없음**: 이전 리비전에 있던 "R8 과 어긋난 현재 캐시 제외 범위"
  류의 미해결 갭 callout 은 diff 의 `-` 라인(삭제됨)에만 남아 있고, target 문서 본문·
  `spec/5-system/14-external-interaction-api.md` 본문(구현 갭 callout 검색 결과) 어디에도
  이 캐시 범위를 아직 미해결로 서술하는 곳이 없다 — 두 문서가 같은 "해결됨" 상태로 동기화됨.
- **인접 data-flow 문서 무충돌**: `spec/data-flow/14-chat-channel.md`(Chat Channel,
  같은 external-interaction 모듈을 상류로 참조)에는 idempotency/409/410/VALIDATION_ERROR
  관련 서술이 아예 없어 충돌 여지가 없다.
- **계층 책임 변화 없음**: 캐시 판정 로직(`isErrorStatusCacheable`)이 인터셉터 내부에
  머물고, `interaction.service.ts` 가 여전히 예외를 던지는 책임을 유지 — target 문서
  §Overview/§Rationale 이 서술하는 "인터셉터=응답 기록, 서비스=예외 발행" 책임 분할과
  diff 가 일치.

## 요약

이번 diff 는 `spec/5-system/14-external-interaction-api.md` §R8(과 그 Rationale)이 이미
명시한 "캐시 대상은 2xx·409·410 의 닫힌 목록" 계약을 구현이 뒤늦게 따라잡은 버그 픽스이고,
target `spec/data-flow/15-external-interaction.md` 는 그 수정된 동작을 정확히 반영하도록
갱신됐다. 요구사항 ID·API 에러 코드·Redis schema·계층 책임 어느 축에서도 다른 spec 영역과의
모순을 찾지 못했다. 컨텍스트 예산으로 절단된 다수 spec(§7-channel-web-chat 상세, §5-system
나머지 파일 본문)은 grep 상으로 이 diff 와 직접 겹치는 서술이 없어 보이나, 전문을 읽지
못했으므로 완전 배제는 아니다.

## 위험도
NONE
