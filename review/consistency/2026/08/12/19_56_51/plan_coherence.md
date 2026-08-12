# Plan 정합성 검토 — spec-draft-eia-idempotency-key-scope.md

## 검토 방법

target(`plan/in-progress/spec-draft-eia-idempotency-key-scope.md`)의 근거 문서인
`plan/in-progress/backend-lint-gate-broken-on-main.md`(target 이 직접 인용하는 "여섯 라운드"
출처)와 `plan/in-progress/spec-draft-eia-r8-alignment.md`(target 이 전제하는 §R8 정합화 선행
plan)를 대조했다. target 이 인용하는 라인 번호(`data-flow/15` L93/L98/L258,
`5-system/14` L81/L140)와 동반 갱신 대상 코드 라인(`idempotency.interceptor.spec.ts:143`,
`external-interaction.e2e-spec.ts:425/495/538`, `REDIS_KEY_PREFIX`, `req.interaction.executionId`
합성 위치, `interact`/`cancel` 두 엔드포인트의 `IdempotencyInterceptor` 부착 여부)는 현재
저장소 상태와 직접 대조해 실측 확인했다.

## 발견사항

- **[WARNING]** 선행 backlog 항목의 "조치 방향" 문구가 target 의 3세그먼트 결정보다 좁다 — 갱신 계획 누락
  - target 위치: `plan/in-progress/spec-draft-eia-idempotency-key-scope.md` §"동반 갱신 (구현
    턴)" 및 §체크리스트 마지막 줄 `- [ ] 구현 백로그 항목에 "선행 spec 해소" 기록`
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L561~578 의 미해결 항목
    **"idempotency 캐시 키가 execution/인증 컨텍스트로 스코프되지 않는다"**, 특히 L571-572:
    > 조치 방향: `redisKey` 에 `executionId`(가드 검증 후 신뢰 가능한 값) 또는 인증 scope
    > 식별자를 포함 — `interaction:idempotency:${executionId}:${rawKey}`.
    (2-세그먼트, endpoint 미포함). 같은 문서 L557 도 e2e 관측점을
    `interaction:idempotency:<key>` 엔트리 직접 조회로 서술해 같은 2-세그먼트 전제를 반복한다.
  - 상세: target 은 이 backlog 항목이 남긴 "실행 필요" 결정을 올바르게 이어받아 해소하지만
    ("execution 단위 스코프" 채택은 정당한 결정 계승이며 미해결 결정 우회가 아님), 스스로
    axis 2(endpoint 간 CancelDto/interact 재생)를 추가해 **3-세그먼트**
    (`<executionId>:<endpoint>:<key>`)로 확장했다. 그런데 이 확장된 최종 형태를 backlog
    항목의 "조치 방향" 서술에 반영하겠다는 계획이 target 체크리스트에 명시돼 있지 않다 —
    "구현 백로그 항목에 '선행 spec 해소' 기록" 이라는 문구만 있고 **어느 문서의 어느 문장을
    무엇으로 고칠지**가 없다. `backend-lint-gate-broken-on-main.md` 자체가 "처분표에 '이미
    있다' 를 쓸 때는 그 자리에서 grep 해 확인할 것" 이라는 교훈을 이미 담고 있는 문서라는
    점에서, 이후 구현자가 target spec 전문을 읽지 않고 backlog 항목의 "조치 방향" 요약만
    보고 착수하면 **endpoint 세그먼트를 빠뜨린 2-세그먼트 키**를 구현할 위험이 있다 — 정확히
    이 저장소가 반복 지적해 온 "방어를 한 칸 좁게 잡는" 실패 클래스(기획자가 스스로 명시한
    axis 2 도입 근거와 동일 형태)다.
  - 제안: target 의 §체크리스트 마지막 항목을 구체화해 —
    `backend-lint-gate-broken-on-main.md` L571-572("조치 방향")와 L557(e2e 관측 서술)을
    **3-세그먼트 키(`<executionId>:<endpoint>:<key>`)로 갱신**하고 axis 2 근거를 한 줄
    남기도록 명시한다. (구현 자체를 바꾸라는 뜻이 아니라 — target 본문은 이미 정확하다 — 그
    안내를 참조할 backlog 문서의 "조치 방향" 문구가 stale 한 채 남지 않도록 후속 작업
    범위에 명문화하라는 것.)

## 정합성 확인된 사항 (참고)

- target 이 인용한 5개 라인(`data-flow/15` L93·L98·L258, `5-system/14` L81·L140)은 모두 현재
  spec 파일과 정확히 일치 — `spec-draft-eia-r8-alignment.md` 가 앞서 §R8 정합화(2xx·409·410
  캐시, 400 VALIDATION_ERROR 만 제외)를 완료해 둔 상태와 라인 드리프트 없이 맞물린다.
- "구현 인계" 절이 전제하는 `req.interaction.executionId`(InteractionGuard 합성값)는
  `interaction.guard.ts` L118/L143 에 실재하고, `interact`(`:executionId/interact`)와
  `cancel`(`:executionId/cancel`) 두 엔드포인트 모두 `@UseInterceptors(IdempotencyInterceptor)`
  가 붙어 있어 axis 2(엔드포인트 간 충돌) 서술이 코드 사실과 일치한다.
  `idempotency.interceptor.ts` 는 현재 `req.interaction` 을 전혀 참조하지 않아(라인 88-94)
  target 이 서술하는 결함 현상과도 일치한다.
- "동반 갱신" 목록의 라인 번호(`idempotency.interceptor.spec.ts:143`,
  `external-interaction.e2e-spec.ts:425/495/538`)도 실측 결과 정확하다.
- target 이 채택한 "토큰(jti)이 아니라 execution" granularity 는 backlog 항목이 열어 둔
  두 옵션("executionId 또는 인증 scope 식별자") 중 하나를 EIA-RL-02(토큰 회전 후 재시도
  재현)를 근거로 명시적으로 선택한 것으로, 미해결 결정을 일방적으로 우회한 것이 아니라
  project-planner 권한 범위 내에서 정당하게 종결한 것이다.
- `spec-draft-eia-r8-alignment.md` §R8 의 "닫힌 목록" 단락과 target 의 신규 스코프 근거
  단락은 서로 다른 주제(캐시 대상 status code vs 캐시 키 네임스페이스)라 텍스트 충돌 없음.

## 요약

target 은 `backend-lint-gate-broken-on-main.md` L561-578 에 5라운드 동안 반복 지적됐던
미해결 보안 항목을 정확히 겨냥해 정당하게 종결하는 draft이며, 인용 라인 번호·코드 전제
(`req.interaction.executionId`, 두 엔드포인트의 인터셉터 부착, 캐시 결함 현상)가 모두 현재
저장소 상태와 실측 일치한다. 유일한 갭은 target 이 스스로 확장한 axis 2(endpoint 세그먼트)가
backlog 원본의 "조치 방향" 문구(2-세그먼트)에 반영될 계획이 체크리스트에 구체화돼 있지
않다는 점 — 문서 갱신 누락 수준의 WARNING이며 target 의 스펙 변경 결정 자체를 무효화하지
않는다.

## 위험도

LOW
