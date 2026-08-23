# 문서화(Documentation) Review — `nodeoutput-allowlist` (3라운드, `19_43_33`)

## 검토 방법

이 diff 는 이미 두 차례 `/ai-review` 를 거쳤다(`19_00_23`: WARNING 4건 전부 반영, `19_24_24`:
WARNING 2건 전부 반영). 직전 두 라운드가 잡았던 문서화 WARNING(`getStatus` JSDoc stale 서술,
CHANGELOG 누락, 파일 분리 후 깨진 `{@link}` 참조)이 실제 소스에 반영됐는지 `Read` 로 직접
재확인했고, 그 위에서 아직 어느 라운드도 짚지 않은 새 문제가 있는지를 봤다.

**재확인 결과 — 전부 반영 확인**:
- `interaction.service.ts` `getStatus` JSDoc(`:313-315`): "별개 잔여 항목" → "이 함수의 waiting
  출구 1곳에 fail-closed 로 적용된다 ... 범위 표는 EIA §R17" 로 정정된 상태 확인.
- `CHANGELOG.md`: `_retryState` 발견 배경·운영 영향·`fail-open→fail-closed` 전환 근거를 담은
  신규 `## Unreleased` 절 존재 확인, 선행 `llmCalls` 항목과 동일 형식.
- `node-output-allowlist.ts:16`: `{@link EXTERNAL_STRIPPED_FIELDS}`(파일 분리 후 깨진 링크)가
  "자매 파일 `strip-external-only-fields.ts` 의 `EXTERNAL_STRIPPED_FIELDS`" 산문으로 정정된 상태
  확인.
- `strip-external-only-fields.ts`/`.spec.ts` 에 `NODE_OUTPUT_ALLOWED_KEYS`/
  `allowlistNodeOutputKeys` 잔재 없음(grep 재확인, 0건) — 분리가 완전함.
- `spec/5-system/14-external-interaction-api.md` §R17: 취소선으로 이전 "미구현·잔여" 서술을
  갱신하고, REST 1곳 적용 / terminal 2곳 의도적 제외 / SSE 잔여를 표로 열거 — consistency
  round(`18_30_40`) 의 `plan_coherence` WARNING·`rationale_continuity` WARNING 이 요구한 (a)(b)(c)
  세 가지(적용 범위 1곳 한정·terminal 제외 근거·SSE 잔여 서술 유지)를 모두 반영.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`: 해당 항목 `[x]` flip 확인
  (`:103`), SSE 잔여 신규 항목 `[ ]` 로 별도 등재 확인(`:72`).

## 발견사항

- **[INFO]** `interaction.service.ts` 인라인 주석이 allowlist 를 "타입에서 파생한" 것으로
  서술 — 실제로는 손으로 맞춘 목록 + 컴파일타임 assertion 검증이며, 그마저 9개 키 중 5개
  (핸들러 계약분)에만 해당한다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:390`
    (`// _retryState 가 그렇게 나가고 있었다. NodeHandlerOutput 타입에서 파생한 / // 최상위 키
    집합만 남긴다 — 근거·범위는 그 상수의 JSDoc.`)
  - 상세: 이 세션은 이미 한 번 이 정확한 표현("발명하지 않고 파생") 문제를 다뤘다 —
    consistency round(`18_30_40`) `rationale_continuity` INFO 가 "실제로는 컴파일타임 파생이
    아니라 손으로 맞춘 평행 리스트" 라고 지적했고, `plan/complete/nodeoutput-allowlist.md` §대응
    기록에 따르면 "문구를 낮추는 대신 컴파일타임 assertion 으로 그 주장을 참으로 만들었다"고
    적혀 있다. 그 결과 `node-output-allowlist.ts` 의 메인 JSDoc(`:24-29`)은 더 정확한 표현으로
    정착했다 — "목록을 손으로 나열하면 두 번째 손-동기화 지점이 생기므로, 아래
    `assertAllowlistCoversHandlerContract` 가 컴파일타임에 그 타입의 공개 키를 전부 덮는지
    검사한다"(= 목록은 여전히 수기, 다만 assertion 으로 결속됨을 명시). `CHANGELOG.md`(:18)도
    "목록은 발명하지 않고 ... 컴파일타임 assertion 으로 결속했다" 로 같은 정밀도를 쓴다.
    그런데 이번 diff 가 새로 추가한 호출부 인라인 주석(`interaction.service.ts:390`)만 이전의
    느슨한 "타입에서 파생한"(derived) 표현을 그대로 쓴다 — 같은 PR 안에서 두 정밀도가
    공존한다. 게다가 `NODE_OUTPUT_ALLOWED_KEYS` 9개 키 중 컴파일타임 assertion 이 실제로
    덮는 것은 핸들러 계약분 5개(`config`/`output`/`meta`/`port`/`status`)뿐이고, 나머지
    wire 전용 4개(`formConfig`/`conversationConfig`/`buttonConfig`/`interactionType`)는
    `NodeHandlerOutput` 타입에 아예 없는 키라 "타입에서 파생" 이라는 서술이 전체 집합
    기준으로는 이중으로 부정확하다. 위험은 낮다 — 같은 줄이 "근거·범위는 그 상수의 JSDoc" 으로
    독자를 정확한 문서로 즉시 안내하므로 오독이 오래가진 않는다.
  - 제안: `:390` 주석을 "`NodeHandlerOutput` 타입에서 파생한" 대신 "`NodeHandlerOutput` 공개
    키에 결속된"(bound) 또는 "그 상수(수기 목록 + 컴파일타임 결속)" 정도로 다른 두 곳과
    동일한 정밀도로 맞출 것. 필수는 아님(CRITICAL/WARNING 아님) — 다음 편집 시 함께 정리해도
    충분.

## 참고 (확인했으나 문제 없음)

- `dto/responses/execution-status-response.dto.ts` 의 `nodeOutput`/`buttonConfig` Swagger
  설명("대기 노드 output", "원본 노드 output")은 필드를 열거하지 않는 일반 서술이라 allowlist
  도입으로 스키마 문서가 stale 해지지 않는다.
- CHANGELOG 의 "시도 횟수·TTL·메시지 일부" 서술은 `NodeHandlerOutput._retryState`(`attempt`,
  `expiresAt`, `failedUserMessage`) 실제 필드와 대조해 정확함을 확인했다.
- 새 환경변수·설정 옵션·README 대상 변경 없음(순수 내부 필터링 로직 추가) — README 업데이트
  불요.
- 예제 코드: 단일 소비처 내부 보안 유틸이라 별도 사용 예제 불요, JSDoc 이 "왜/어디까지" 를
  충분히 설명함.

## 요약

이 diff 는 세 번째 리뷰 라운드 대상임에도 문서화 품질이 이 저장소 평균보다 높다. 앞선 두
라운드가 지적한 문서화 WARNING(총 3건 — `getStatus` JSDoc stale, CHANGELOG 누락, 파일 분리 후
깨진 `{@link}`)과 consistency 라운드의 rationale/plan-coherence WARNING(SSE 잔여 미등재, spec
본문에 3-출구 범위 미기록)이 전부 spec/코드/plan 삼중으로 정확히 반영된 상태를 직접 재확인했다.
새로 발견된 것은 CRITICAL/WARNING 없이 INFO 1건뿐 — 같은 PR 안에서 이미 한 번 정밀화된 "타입
결속" 서술이 그 정밀화 이전의 느슨한 "타입에서 파생" 표현으로 새 호출부 주석에 재등장한 것으로,
같은 줄이 정확한 문서(JSDoc)로 독자를 안내하고 있어 실질 위험은 낮다.

## 위험도
LOW
